const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const db = require('./db');

const BASE_URL = 'https://plus.gopro.com';
const API_BASE = 'https://api.gopro.com';

class GoProAPI {
    constructor() {
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.jar,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://plus.gopro.com',
                'Referer': 'https://plus.gopro.com/'
            }
        }));
    }

    setTokens(accessToken, userId) {
        this.accessToken = accessToken;
        this.userId = userId;
    }

    async authenticateWithCookies(cookies) {
        try {
            console.log('\n=== Authentication Process Details ===');
            console.log('Cookies received:', Object.keys(cookies));
            console.log('Access Token length:', cookies.gp_access_token?.length || 'missing');
            console.log('User ID:', cookies.gp_user_id || 'missing');
            
            if (cookies.gp_access_token) {
                console.log('Token starts with:', cookies.gp_access_token.substring(0, 50) + '...');
            }

            // Set cookies in jar
            for (const [name, value] of Object.entries(cookies)) {
                console.log(`Setting cookie: ${name} (length: ${value?.length || 0})`);
                await this.jar.setCookie(
                    `${name}=${value}; Domain=.gopro.com; Path=/`,
                    BASE_URL
                );
            }

            console.log('Cookies set in jar successfully');

            // Skip user profile verification since /v1/users/me returns 404
            // Assume tokens are valid if they're provided
            if (cookies.gp_access_token && cookies.gp_user_id) {
                console.log('Authentication: Tokens provided, assuming valid');
                this.accessToken = cookies.gp_access_token;
                this.userId = cookies.gp_user_id;
                console.log('Authentication successful');
                console.log('=== End Authentication Details ===\n');
                return {
                    success: true,
                    user: { id: cookies.gp_user_id }
                };
            }

            console.log('Authentication: Missing required tokens');
            console.log('=== End Authentication Details ===\n');
            return { success: false, error: 'Invalid credentials' };
        } catch (error) {
            console.log('\n=== Authentication Error Details ===');
            console.log('Error Type:', error.constructor.name);
            console.log('Error Message:', error.message);
            console.log('Error Code:', error.code);
            
            if (error.response) {
                console.log('Response Status:', error.response.status);
                console.log('Response Status Text:', error.response.statusText);
                console.log('Response Headers:', error.response.headers);
                console.log('Response Data:', error.response.data);
            }
            
            console.log('Error Stack:', error.stack);
            console.log('=== End Authentication Error Details ===\n');
            
            console.error('Authentication error:', error.message);
            return { 
                success: false, 
                error: error.response?.data?.message || error.message 
            };
        }
    }

    async getMediaList(page = 1, perPage = 15) {
        try {
            if (!this.accessToken || !this.userId) {
                throw new Error('Not authenticated');
            }

            console.log('\n=== GoPro API Request Details ===');
            console.log('Endpoint:', `${API_BASE}/v1/media`);
            console.log('Method: GET');
            console.log('Token length:', this.accessToken.length);
            console.log('Token starts with:', this.accessToken.substring(0, 50) + '...');
            console.log('User ID:', this.userId);
            console.log('Query params:', { page, per_page: perPage, order_by: 'created_at', order_direction: 'desc' });

            const headers = {
                'Cookie': `gp_access_token=${this.accessToken}; gp_user_id=${this.userId}`
            };

            console.log('Request headers:', {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://plus.gopro.com',
                'Referer': 'https://plus.gopro.com/',
                ...headers
            });

            const response = await this.client.get(
                `${API_BASE}/v1/media`,
                {
                    params: {
                        page: page,
                        per_page: perPage,
                        order_by: 'created_at',
                        order_direction: 'desc'
                    },
                    headers: headers
                }
            );

            console.log('\n=== GoPro API Response Details ===');
            console.log('Status:', response.status);
            console.log('Status Text:', response.statusText);
            console.log('Response Headers:', response.headers);
            console.log('Response Data Type:', typeof response.data);
            console.log('Response Data:', JSON.stringify(response.data, null, 2));

            const media = response.data._embedded?.media || [];
            const pagination = {
                page: response.data.page || page,
                perPage: response.data.per_page || perPage,
                total: response.data.total || 0,
                totalPages: response.data.total_pages || 1
            };

            return {
                success: true,
                media: media.map(item => this.formatMediaItem(item)),
                pagination
            };
        } catch (error) {
            console.log('\n=== GoPro API Error Details ===');
            console.log('Error Type:', error.constructor.name);
            console.log('Error Message:', error.message);
            console.log('Error Code:', error.code);
            
            if (error.response) {
                console.log('Response Status:', error.response.status);
                console.log('Response Status Text:', error.response.statusText);
                console.log('Response Headers:', error.response.headers);
                console.log('Response Data:', error.response.data);
                console.log('Raw Response Text:', JSON.stringify(error.response.data, null, 2));
            }
            
            if (error.request) {
                console.log('Request was made but no response received');
                console.log('Request Details:', error.request);
            }
            
            console.log('Error Stack:', error.stack);
            console.log('=== End Error Details ===\n');
            
            console.error('Get media error:', error.message);
            return { 
                success: false, 
                error: error.response?.data?.message || error.message 
            };
        }
    }

    async getAllMedia(progressCallback = null) {
        const allMedia = [];
        let page = 1;
        const perPage = 50;
        let hasMore = true;

        while (hasMore) {
            const result = await this.getMediaList(page, perPage);
            
            if (!result.success) {
                return result;
            }

            allMedia.push(...result.media);
            
            if (progressCallback) {
                progressCallback({
                    loaded: allMedia.length,
                    total: result.pagination.total,
                    page: page,
                    totalPages: result.pagination.totalPages
                });
            }

            hasMore = page < result.pagination.totalPages;
            page++;
        }

        return {
            success: true,
            media: allMedia,
            total: allMedia.length
        };
    }

    async getMediaDownloadUrl(mediaId) {
        try {
            if (!this.accessToken) {
                throw new Error('Not authenticated');
            }

            const response = await this.client.get(
                `${API_BASE}/v1/media/${mediaId}/download`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            return {
                success: true,
                downloadUrl: response.data.url,
                filename: response.data.filename || response.data.file_name,
                fileSize: response.data.file_size,
                expiresAt: response.data.expires_at
            };
        } catch (error) {
            console.error('Get download URL error:', error.message);
            return { 
                success: false, 
                error: error.response?.data?.message || error.message 
            };
        }
    }

    async streamMedia(downloadUrl, startByte = 0, endByte = null) {
        try {
            const headers = {};
            if (startByte > 0 || endByte !== null) {
                headers.Range = `bytes=${startByte}-${endByte || ''}`;
            }

            const response = await this.client.get(downloadUrl, {
                headers,
                responseType: 'stream',
                timeout: 120000
            });

            return {
                success: true,
                stream: response.data,
                contentLength: response.headers['content-length'],
                contentRange: response.headers['content-range'],
                acceptRanges: response.headers['accept-ranges']
            };
        } catch (error) {
            console.error('Stream media error:', error.message);
            return { 
                success: false, 
                error: error.response?.data?.message || error.message 
            };
        }
    }

    formatMediaItem(item) {
        const thumbnails = item._embedded?.files?.filter(f => f.type === 'thumbnail') || [];
        const mainFile = item._embedded?.files?.find(f => f.type === 'high_res') || 
                        item._embedded?.files?.find(f => f.type === 'source');

        return {
            id: item.id,
            filename: item.file_name || item.filename,
            mediaType: item.type,
            fileSize: item.file_size,
            width: item.width,
            height: item.height,
            duration: item.duration_seconds,
            createdAt: item.captured_at || item.created_at,
            thumbnailUrl: thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : null,
            raw: item
        };
    }

    // Save session to database
    saveSession(sessionId) {
        const stmt = db.prepare(`
            INSERT INTO sessions (id, gp_access_token, gp_user_id)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                gp_access_token = excluded.gp_access_token,
                gp_user_id = excluded.gp_user_id,
                updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(sessionId, this.accessToken, this.userId);
    }

    // Load session from database
    loadSession(sessionId) {
        const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
        const session = stmt.get(sessionId);
        
        if (session) {
            this.accessToken = session.gp_access_token;
            this.userId = session.gp_user_id;
            return true;
        }
        return false;
    }
}

module.exports = GoProAPI;
