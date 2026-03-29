# GoPro Media Downloader

A self-hosted web application to download your GoPro cloud media in bulk, bypassing the 25-file limit on the GoPro website.

## Features

- **Bulk Download**: Download all your GoPro media at once, no 25-file limit
- **Session Persistence**: Login once, credentials securely stored in SQLite
- **Gallery View**: Browse your media with thumbnails, metadata (date, file size, duration)
- **Selective Download**: Choose individual files or bulk-select all media
- **Cloud Upload**: Upload directly to Google Drive or iCloud
- **Chunked Downloads**: Large video files are streamed in chunks to prevent timeouts
- **Docker Support**: Easy deployment with Docker or Docker Compose
- **Railway Ready**: One-click deploy to Railway

## Tech Stack

- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Frontend**: React
- **Authentication**: GoPro session cookies (gp_access_token, gp_user_id)
- **Cloud Uploads**: Google Drive API, WebDAV (iCloud)
- **Containerization**: Docker, Docker Compose

## Quick Start

### Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repo-url>
cd gopro-media-downloader

# Create .env file (optional, for Google Drive integration)
cp .env.example .env
# Edit .env with your Google OAuth credentials

# Start with Docker Compose
docker-compose up -d

# Access the app
open http://localhost:3001
```

### Manual Setup

```bash
# Install dependencies
npm run setup

# Start development mode
npm run dev

# Or build and start production
npm run build
npm start
```

### Railway Deployment

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

Or deploy manually:
```bash
railway login
railway init
railway up
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3001) | No |
| `DATA_DIR` | Directory for SQLite database (default: ./data) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | For Google Drive |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | For Google Drive |
| `GOOGLE_REDIRECT_URI` | Google OAuth Callback URL | For Google Drive |

### Getting GoPro Credentials

1. Go to [plus.gopro.com/media-library/](https://plus.gopro.com/media-library/)
2. Sign in to your GoPro account
3. Open Developer Tools (F12)
4. Go to Network tab
5. Refresh the page
6. Look for a request to `user` or `media`
7. In the Cookies, find:
   - `gp_access_token` - JWT token (starts with `eyJhbGc...`)
   - `gp_user_id` - Your numeric user ID
8. Paste these into the app login form

## Usage

1. **Login**: Enter your GoPro credentials (obtained from browser cookies)
2. **Browse**: View your media in the gallery with thumbnails
3. **Select**: Click items to select, or use "Select All" for bulk download
4. **Download**: Click download button on individual items or "Download Selected" for bulk
5. **Cloud Upload**: Connect Google Drive or iCloud to upload directly to cloud storage

## API Endpoints

### Authentication
- `GET /api/auth/status` - Check auth status
- `POST /api/auth/login` - Login with GoPro cookies
- `POST /api/auth/logout` - Logout and clear session

### Media
- `GET /api/media` - List media (paginated)
- `GET /api/media/all` - List all media (for bulk operations)
- `GET /api/media/:id/download-url` - Get temporary download URL
- `GET /api/media/:id/download` - Stream download (chunked)

### Cloud Upload
- `GET /api/cloud/google/auth` - Get Google OAuth URL
- `GET /api/cloud/google/callback` - Google OAuth callback
- `GET /api/cloud/google/folders` - List Google Drive folders
- `POST /api/cloud/icloud/connect` - Connect iCloud/WebDAV
- `GET /api/cloud/credentials` - List saved cloud credentials
- `DELETE /api/cloud/credentials/:id` - Remove cloud credentials

## Data Persistence

The application uses SQLite to persist:
- GoPro session tokens (gp_access_token, gp_user_id)
- Cloud storage credentials (encrypted)
- Download progress tracking

Data is stored in the `DATA_DIR` directory (default: `./data` in development, `/data` in Docker).

## Security

- Session tokens are stored server-side in SQLite
- No multi-tenancy - single user application
- Helmet.js for security headers
- Rate limiting on authentication endpoints
- CORS protection in production

## License

MIT
