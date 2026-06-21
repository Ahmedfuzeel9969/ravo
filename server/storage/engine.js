/**
 * Storage Engine — mutex, atomic writes, in-memory cache, safe IDs
 * Production path: swap JSON backend for PostgreSQL; keep this API surface.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const lockfile = require('proper-lockfile');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_TMP = path.join(DATA_DIR, 'db.json.tmp');
const LOCK_OPTS = { stale: 10000, update: 5000 };

let memCache = null;
let cacheLoadedAt = 0;

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromDisk() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) return null;
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(raw);
}

function saveToDisk(db) {
  ensureDataDir();
  if (!db.meta) db.meta = {};
  db.meta.version = (db.meta.version || 0) + 1;
  db.meta.updated_at = new Date().toISOString();
  const json = JSON.stringify(db);
  fs.writeFileSync(DB_TMP, json, 'utf8');
  fs.renameSync(DB_TMP, DB_FILE);
}

function withLockSync(fn) {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, '{}', 'utf8');
  }
  const release = lockfile.lockSync(DB_FILE, LOCK_OPTS);
  try {
    return fn();
  } finally {
    release();
  }
}

function init(defaultDb) {
  withLockSync(() => {
    if (!fs.existsSync(DB_FILE)) {
      const db = structuredClone(defaultDb);
      if (!db.meta) db.meta = { version: 1, created_at: new Date().toISOString() };
      if (!db.idempotency_keys) db.idempotency_keys = [];
      saveToDisk(db);
      memCache = db;
    } else {
      memCache = loadFromDisk();
    }
    cacheLoadedAt = Date.now();
  });
}

function hydrate(defaultDb) {
  if (!memCache) init(defaultDb);
  let changed = false;
  if (!memCache.idempotency_keys) { memCache.idempotency_keys = []; changed = true; }
  if (!memCache.meta) { memCache.meta = { version: 1 }; changed = true; }
  if (changed) mutate((db) => db);
  return memCache;
}

/** Read-only under lock (returns fn result, no save) */
function readFn(fn) {
  return withLockSync(() => {
    if (!memCache) memCache = loadFromDisk();
    if (!memCache) throw new Error('Database not initialized');
    return fn(memCache);
  });
}

/** Mutate + atomic save */
function mutate(fn) {
  return withLockSync(() => {
    if (!memCache) memCache = loadFromDisk();
    if (!memCache) throw new Error('Database not initialized');
    const result = fn(memCache);
    saveToDisk(memCache);
    cacheLoadedAt = Date.now();
    return result;
  });
}

/** Force reload from disk (multi-process deployments) */
function reload() {
  withLockSync(() => {
    memCache = loadFromDisk();
    cacheLoadedAt = Date.now();
  });
}

function getStats() {
  return readFn((db) => ({
    version: db.meta?.version || 0,
    bookings: db.bookings?.length || 0,
    drivers: db.drivers?.length || 0,
    users: db.users?.length || 0,
    cacheAgeMs: Date.now() - cacheLoadedAt
  }));
}

module.exports = {
  DB_FILE,
  DATA_DIR,
  newId,
  init,
  hydrate,
  readFn,
  mutate,
  reload,
  getStats
};
