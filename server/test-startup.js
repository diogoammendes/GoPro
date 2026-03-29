console.log('=== Server Startup Test ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());
console.log('Environment variables:', Object.keys(process.env));

// Test basic Node.js functionality
try {
    const fs = require('fs');
    console.log('fs module loaded');
} catch (err) {
    console.error('Failed to load fs:', err);
}

try {
    const path = require('path');
    console.log('path module loaded');
} catch (err) {
    console.error('Failed to load path:', err);
}

try {
    const express = require('express');
    console.log('express module loaded');
} catch (err) {
    console.error('Failed to load express:', err);
}

try {
    const Database = require('better-sqlite3');
    console.log('better-sqlite3 module loaded');
} catch (err) {
    console.error('Failed to load better-sqlite3:', err);
}

// Test database connection
try {
    const db = require('./db');
    console.log('Database loaded successfully');
} catch (err) {
    console.error('Failed to load database:', err);
}

console.log('=== Startup test complete ===');
