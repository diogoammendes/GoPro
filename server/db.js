const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'gopro.db');

const db = new Database(DB_PATH);

// Initialize database tables
db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        gp_access_token TEXT,
        gp_user_id TEXT,
        gp_refresh_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media_cache (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        filename TEXT,
        file_size INTEGER,
        duration INTEGER,
        created_at DATETIME,
        thumbnail_url TEXT,
        download_url TEXT,
        media_type TEXT,
        width INTEGER,
        height INTEGER,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES sessions(gp_user_id)
    );

    CREATE TABLE IF NOT EXISTS download_progress (
        id TEXT PRIMARY KEY,
        media_id TEXT,
        status TEXT,
        bytes_downloaded INTEGER DEFAULT 0,
        total_bytes INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cloud_credentials (
        id TEXT PRIMARY KEY,
        provider TEXT,
        access_token TEXT,
        refresh_token TEXT,
        expiry_date DATETIME,
        folder_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

module.exports = db;
