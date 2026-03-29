const { google } = require('googleapis');
const { createWebdavClient } = require('webdav');
const db = require('./db');
const fs = require('fs');
const path = require('path');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/cloud/google/callback';

class CloudUploadManager {
    constructor() {
        this.googleOAuth2Client = null;
        if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
            this.googleOAuth2Client = new google.auth.OAuth2(
                GOOGLE_CLIENT_ID,
                GOOGLE_CLIENT_SECRET,
                GOOGLE_REDIRECT_URI
            );
        }
    }

    // Google Drive methods
    getGoogleAuthUrl() {
        if (!this.googleOAuth2Client) {
            throw new Error('Google OAuth not configured');
        }

        const scopes = [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.readonly'
        ];

        return this.googleOAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
    }

    async handleGoogleCallback(code) {
        if (!this.googleOAuth2Client) {
            throw new Error('Google OAuth not configured');
        }

        const { tokens } = await this.googleOAuth2Client.getToken(code);
        this.googleOAuth2Client.setCredentials(tokens);

        // Save credentials to database
        const stmt = db.prepare(`
            INSERT INTO cloud_credentials (id, provider, access_token, refresh_token, expiry_date)
            VALUES (?, 'google', ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                access_token = excluded.access_token,
                refresh_token = excluded.refresh_token,
                expiry_date = excluded.expiry_date,
                updated_at = CURRENT_TIMESTAMP
        `);

        const id = 'google_' + Date.now();
        stmt.run(
            id,
            tokens.access_token,
            tokens.refresh_token || '',
            tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
        );

        return { success: true, credentialsId: id };
    }

    async listGoogleDriveFolders(credentialsId) {
        const credentials = this.getCredentials(credentialsId);
        if (!credentials) {
            throw new Error('Google credentials not found');
        }

        this.googleOAuth2Client.setCredentials({
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token
        });

        const drive = google.drive({ version: 'v3', auth: this.googleOAuth2Client });
        
        const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id, name, createdTime)',
            pageSize: 100
        });

        return response.data.files;
    }

    async uploadToGoogleDrive(credentialsId, fileStream, filename, folderId = null, onProgress = null) {
        const credentials = this.getCredentials(credentialsId);
        if (!credentials) {
            throw new Error('Google credentials not found');
        }

        this.googleOAuth2Client.setCredentials({
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token
        });

        const drive = google.drive({ version: 'v3', auth: this.googleOAuth2Client });

        const fileMetadata = {
            name: filename,
            ...(folderId && { parents: [folderId] })
        };

        const media = {
            body: fileStream
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, size'
        }, {
            onUploadProgress: (event) => {
                if (onProgress && event.bytesRead) {
                    onProgress(event.bytesRead);
                }
            }
        });

        return {
            success: true,
            fileId: response.data.id,
            name: response.data.name
        };
    }

    // iCloud/WebDAV methods
    async connectICloud(username, password, serverUrl = 'https://webdav.icloud.com') {
        try {
            const client = createWebdavClient({
                username,
                password,
                remoteURL: serverUrl
            });

            // Test connection by listing directory
            await client.getDirectoryContents('/');

            // Save credentials
            const stmt = db.prepare(`
                INSERT INTO cloud_credentials (id, provider, access_token, folder_id)
                VALUES (?, 'icloud', ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    access_token = excluded.access_token,
                    folder_id = excluded.folder_id,
                    updated_at = CURRENT_TIMESTAMP
            `);

            const id = 'icloud_' + Date.now();
            const creds = JSON.stringify({ username, password, serverUrl });
            stmt.run(id, creds, serverUrl);

            return { success: true, credentialsId: id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async listICloudFolders(credentialsId, path = '/') {
        const credentials = this.getCredentials(credentialsId);
        if (!credentials) {
            throw new Error('iCloud credentials not found');
        }

        const creds = JSON.parse(credentials.access_token);
        const client = createWebdavClient({
            username: creds.username,
            password: creds.password,
            remoteURL: creds.serverUrl
        });

        const contents = await client.getDirectoryContents(path);
        return contents.filter(item => item.type === 'directory');
    }

    async uploadToICloud(credentialsId, fileStream, filename, targetPath = '/', onProgress = null) {
        const credentials = this.getCredentials(credentialsId);
        if (!credentials) {
            throw new Error('iCloud credentials not found');
        }

        const creds = JSON.parse(credentials.access_token);
        const client = createWebdavClient({
            username: creds.username,
            password: creds.password,
            remoteURL: creds.serverUrl
        });

        const fullPath = path.join(targetPath, filename);
        
        // WebDAV doesn't have built-in progress tracking, so we'll need to wrap the stream
        let bytesUploaded = 0;
        const trackingStream = fileStream.on('data', (chunk) => {
            bytesUploaded += chunk.length;
            if (onProgress) {
                onProgress(bytesUploaded);
            }
        });

        await client.putFileContents(fullPath, trackingStream, { overwrite: true });

        return {
            success: true,
            path: fullPath
        };
    }

    getCredentials(credentialsId) {
        const stmt = db.prepare('SELECT * FROM cloud_credentials WHERE id = ?');
        return stmt.get(credentialsId);
    }

    async getAllCredentials() {
        const stmt = db.prepare('SELECT id, provider, folder_id, created_at FROM cloud_credentials ORDER BY created_at DESC');
        return stmt.all();
    }

    deleteCredentials(credentialsId) {
        const stmt = db.prepare('DELETE FROM cloud_credentials WHERE id = ?');
        stmt.run(credentialsId);
        return { success: true };
    }
}

module.exports = CloudUploadManager;
