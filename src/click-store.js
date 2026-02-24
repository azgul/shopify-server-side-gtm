const Database = require('better-sqlite3');
const logger = require('./logger');

let db;

function init(dbPath) {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS click_ids (
      token TEXT PRIMARY KEY,
      gclid TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  logger.info('Click store initialized', { path: dbPath });
}

const storeGclid = (token, gclid) => {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO click_ids (token, gclid, created_at) VALUES (?, ?, ?)'
  );
  stmt.run(token, gclid, Date.now());
};

const lookupGclid = (token) => {
  if (!token) return null;
  const row = db.prepare('SELECT gclid FROM click_ids WHERE token = ?').get(token);
  return row ? row.gclid : null;
};

const cleanup = (maxAgeDays = 90) => {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const result = db.prepare('DELETE FROM click_ids WHERE created_at < ?').run(cutoff);
  if (result.changes > 0) {
    logger.info('Click store cleanup', { deleted: result.changes });
  }
};

const close = () => {
  if (db) db.close();
};

module.exports = { init, storeGclid, lookupGclid, cleanup, close };
