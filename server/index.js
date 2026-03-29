require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const GoProAPI = require('./gopro-api');
const CloudUploadManager = require('./cloud-upload');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false
}));

app.use(cors({
    origin: NODE_ENV === 'production' ? false : ['http://localhost:3000'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Stricter rate limit for authentication
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many authentication attempts, please try again later.' }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session store (in-memory for single user, persists across restarts via DB)
const sessions = new Map();

// Helper to get or create GoPro API instance for a session
function getGoProAPI(sessionId) {
    if (!sessions.has(sessionId)) {
        const api = new GoProAPI();
        // Try to load from database
        if (api.loadSession(sessionId)) {
            sessions.set(sessionId, api);
        } else {
            return null;
        }
    }
    return sessions.get(sessionId);
}

// ===== AUTHENTICATION ROUTES =====

// Check authentication status
app.get('/api/auth/status', (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
        return res.json({ authenticated: false });
    }

    const api = getGoProAPI(sessionId);
    if (api && api.accessToken) {
        return res.json({ 
            authenticated: true, 
            userId: api.userId 
        });
    }

    res.json({ authenticated: false });
});

// Authenticate with GoPro cookies
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { gp_access_token, gp_user_id } = req.body;

        if (!gp_access_token || !gp_user_id) {
            return res.status(400).json({ 
                error: 'Missing required cookies: gp_access_token and gp_user_id' 
            });
        }

        const api = new GoProAPI();
        const result = await api.authenticateWithCookies({
            gp_access_token,
            gp_user_id
        });

        if (!result.success) {
            return res.status(401).json({ error: result.error || 'Authentication failed' });
        }

        // Create session
        const sessionId = uuidv4();
        api.saveSession(sessionId);
        sessions.set(sessionId, api);

        res.json({
            success: true,
            sessionId,
            user: result.user
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
        sessions.delete(sessionId);
        // Also remove from DB
        const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
        stmt.run(sessionId);
    }
    res.json({ success: true });
});

// ===== MEDIA ROUTES =====

// Get media list (paginated)
app.get('/api/media', async (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'];
        const api = getGoProAPI(sessionId);

        if (!api) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 15;

        const result = await api.getMediaList(page, perPage);
        res.json(result);
    } catch (error) {
        console.error('Get media error:', error);
        res.status(500).json({ error: 'Failed to fetch media' });
    }
});

// Get all media (for bulk operations)
app.get('/api/media/all', async (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'];
        const api = getGoProAPI(sessionId);

        if (!api) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Send progress updates via Server-Sent Events if requested
        const useSSE = req.headers.accept === 'text/event-stream';

        if (useSSE) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const result = await api.getAllMedia((progress) => {
                res.write(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
            });

            res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);
            res.end();
        } else {
            const result = await api.getAllMedia();
            res.json(result);
        }
    } catch (error) {
        console.error('Get all media error:', error);
        res.status(500).json({ error: 'Failed to fetch all media' });
    }
});

// Get download URL for a media item
app.get('/api/media/:id/download-url', async (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'];
        const api = getGoProAPI(sessionId);

        if (!api) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const result = await api.getMediaDownloadUrl(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Get download URL error:', error);
        res.status(500).json({ error: 'Failed to get download URL' });
    }
});

// Stream download (chunked)
app.get('/api/media/:id/download', async (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'];
        const api = getGoProAPI(sessionId);

        if (!api) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Get download URL first
        const urlResult = await api.getMediaDownloadUrl(req.params.id);
        if (!urlResult.success) {
            return res.status(400).json(urlResult);
        }

        // Parse range header for chunked download
        const range = req.headers.range;
        let start = 0;
        let end = null;

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            start = parseInt(parts[0], 10);
            end = parts[1] ? parseInt(parts[1], 10) : null;
        }

        // Stream the file
        const streamResult = await api.streamMedia(urlResult.downloadUrl, start, end);
        
        if (!streamResult.success) {
            return res.status(400).json(streamResult);
        }

        // Set headers
        res.setHeader('Content-Disposition', `attachment; filename="${urlResult.filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        if (streamResult.acceptRanges) {
            res.setHeader('Accept-Ranges', 'bytes');
        }
        
        if (streamResult.contentRange) {
            res.setHeader('Content-Range', streamResult.contentRange);
            res.status(206);
        } else {
            res.status(200);
        }

        streamResult.stream.pipe(res);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download media' });
    }
});

// ===== CLOUD UPLOAD ROUTES =====

const cloudManager = new CloudUploadManager();

// Google Drive auth
app.get('/api/cloud/google/auth', (req, res) => {
    try {
        const authUrl = cloudManager.getGoogleAuthUrl();
        res.json({ authUrl });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/cloud/google/callback', async (req, res) => {
    try {
        const { code } = req.query;
        const result = await cloudManager.handleGoogleCallback(code);
        
        if (result.success) {
            // Redirect back to app with success
            res.redirect('/?google_connected=true');
        } else {
            res.redirect('/?google_connected=false');
        }
    } catch (error) {
        console.error('Google callback error:', error);
        res.redirect('/?google_connected=false');
    }
});

// List Google Drive folders
app.get('/api/cloud/google/folders', async (req, res) => {
    try {
        const { credentialsId } = req.query;
        const folders = await cloudManager.listGoogleDriveFolders(credentialsId);
        res.json({ success: true, folders });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// iCloud connect
app.post('/api/cloud/icloud/connect', async (req, res) => {
    try {
        const { username, password, serverUrl } = req.body;
        const result = await cloudManager.connectICloud(username, password, serverUrl);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// List cloud credentials
app.get('/api/cloud/credentials', async (req, res) => {
    try {
        const credentials = await cloudManager.getAllCredentials();
        res.json({ success: true, credentials });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete cloud credentials
app.delete('/api/cloud/credentials/:id', (req, res) => {
    try {
        const result = cloudManager.deleteCredentials(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ===== STATIC FILES =====

if (NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
    });
}

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`GoPro Media Downloader server running on port ${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
});

module.exports = app;
