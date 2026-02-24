const path = require('path');
const express = require('express');
const clickStore = require('./click-store');
const googleAds = require('./google-ads');
const webhookHandler = require('./webhook-handler');
const logger = require('./logger');

const PORT = process.env.PORT || 3000;
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'click-store.db');
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });

// Initialize stores
clickStore.init(SQLITE_PATH);
googleAds.init();

const app = express();

// Raw body parsing on webhook route only (needed for HMAC verification)
app.post('/webhooks/shopify', express.raw({ type: 'application/json' }), webhookHandler.createHandler());

// JSON parsing for all other routes
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const server = app.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
});

// Hourly cleanup of expired click IDs
const cleanupTimer = setInterval(() => {
  clickStore.cleanup();
}, CLEANUP_INTERVAL_MS);

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down');
  clearInterval(cleanupTimer);
  server.close(() => {
    clickStore.close();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
