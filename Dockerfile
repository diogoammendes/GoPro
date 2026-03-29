# Multi-stage build for production
FROM node:18-alpine AS builder

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install && cd client && npm install

# Copy source code
COPY . .

# Build client
RUN cd client && CI=false npm run build

# Production stage
FROM node:18-alpine

# Install SQLite library (runtime dependency)
RUN apk add --no-cache sqlite-libs

# Create app directory
WORKDIR /app

# Copy node_modules from builder (includes compiled native modules)
COPY --from=builder /app/node_modules ./node_modules

# Copy built assets and server code
COPY --from=builder /app/client/build ./client/build
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./

# Create data directory for SQLite
RUN mkdir -p /data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "server/index.js"]
