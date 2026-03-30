const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

console.log('Initializing database...');
console.log('DATA_DIR:', DATA_DIR);

// Ensure data directory exists
try {
    if (!fs.existsSync(DATA_DIR)) {
        console.log('Creating data directory...');
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    console.log('Data directory ready');
} catch (err) {
    console.error('Failed to create data directory:', err);
    throw err;
}

const DB_PATH = path.join(DATA_DIR, 'gopro.db');
console.log('Database path:', DB_PATH);

let db;
try {
    db = new Database(DB_PATH);
    console.log('Database connection established');
} catch (err) {
    console.error('Failed to open database:', err);
    throw err;
}

// Initialize database tables
try {
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
            cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    console.log('Database tables initialized');
} catch (err) {
    console.error('Failed to initialize database tables:', err);
    throw err;
}

module.exports = db;
