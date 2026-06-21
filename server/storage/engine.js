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
let defaultDbTemplate = null;

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function cloneDefault(defaultDb) {
  return structuredClone(defaultDb);
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Merge missing top-level keys from template; keep existing data when valid */
function repairDb(db, defaultDb) {
  const base = isPlainObject(db) ? db : {};
  const template = defaultDb || defaultDbTemplate || {};
  const repaired = { ...base };

  for (const [key, value] of Object.entries(template)) {
    if (repaired[key] === undefined || repaired[key] === null) {
      repaired[key] = structuredClone(value);
    }
  }

  if (!isPlainObject(repaired.meta)) {
    repaired.meta = { version: 1, created_at: new Date().toISOString() };
  }
  if (!Array.isArray(repaired.idempotency_keys)) repaired.idempotency_keys = [];
  if (!Array.isArray(repaired.users)) repaired.users = [];
  if (!Array.isArray(repaired.drivers)) repaired.drivers = [];
  if (!Array.isArray(repaired.bookings)) repaired.bookings = [];
  if (!Array.isArray(repaired.transactions)) repaired.transactions = [];
  if (!isPlainObject(repaired.wallet)) repaired.wallet = {};

  return repaired;
}

function isUsableDb(db) {
  return isPlainObject(db) && (
    Array.isArray(db.users) ||
    Array.isArray(db.drivers) ||
    Array.isArray(db.bookings) ||
    db.meta != null
  );
}

function backupCorruptFile(raw) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(DATA_DIR, `db.json.corrupt.${stamp}`);
    fs.writeFileSync(backupPath, raw ?? '', 'utf8');
    console.warn(`[storage] Backed up corrupt db.json → ${path.basename(backupPath)}`);
  } catch (err) {
    console.warn('[storage] Could not backup corrupt db.json:', err.message);
  }
}

/**
 * Load db.json safely — never throws; returns null if file should be recreated.
 */
function loadFromDisk() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) return null;

  let raw;
  try {
    raw = fs.readFileSync(DB_FILE, 'utf8');
  } catch (err) {
    console.warn('[storage] Could not read db.json:', err.message);
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    console.warn('[storage] db.json is empty — will recreate from defaults');
    backupCorruptFile(raw);
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!isPlainObject(parsed)) {
      console.warn('[storage] db.json root is not an object — will recreate');
      backupCorruptFile(raw);
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[storage] db.json parse error — will recreate:', err.message);
    backupCorruptFile(raw);
    return null;
  }
}

function resolveDb(defaultDb) {
  const template = defaultDb || defaultDbTemplate;
  if (!template) {
    throw new Error('Database default template not set — call engine.init(defaultDb) first');
  }

  const loaded = loadFromDisk();
  if (!loaded || !isUsableDb(loaded)) {
    const fresh = cloneDefault(template);
    if (!fresh.meta) fresh.meta = { version: 1, created_at: new Date().toISOString() };
    if (!fresh.idempotency_keys) fresh.idempotency_keys = [];
    saveToDisk(fresh);
    return fresh;
  }

  const repaired = repairDb(loaded, template);
  const needsSave = JSON.stringify(repaired) !== JSON.stringify(loaded);
  if (needsSave) saveToDisk(repaired);
  return repaired;
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
    const stub = defaultDbTemplate ? cloneDefault(defaultDbTemplate) : { meta: { version: 1 } };
    if (!stub.meta) stub.meta = { version: 1, created_at: new Date().toISOString() };
    saveToDisk(stub);
  }
  const release = lockfile.lockSync(DB_FILE, LOCK_OPTS);
  try {
    return fn();
  } finally {
    release();
  }
}

function init(defaultDb) {
  defaultDbTemplate = cloneDefault(defaultDb);
  withLockSync(() => {
    memCache = resolveDb(defaultDb);
    cacheLoadedAt = Date.now();
  });
}

function hydrate(defaultDb) {
  if (defaultDb) defaultDbTemplate = cloneDefault(defaultDb);
  if (!memCache) init(defaultDb || defaultDbTemplate);
  let changed = false;
  if (!memCache.idempotency_keys) { memCache.idempotency_keys = []; changed = true; }
  if (!memCache.meta) { memCache.meta = { version: 1 }; changed = true; }
  if (!Array.isArray(memCache.users)) { memCache.users = []; changed = true; }
  if (!Array.isArray(memCache.drivers)) { memCache.drivers = []; changed = true; }
  if (!Array.isArray(memCache.bookings)) { memCache.bookings = []; changed = true; }
  if (!Array.isArray(memCache.transactions)) { memCache.transactions = []; changed = true; }
  if (!isPlainObject(memCache.wallet)) { memCache.wallet = {}; changed = true; }
  if (changed) mutate((db) => db);
  return memCache;
}

function ensureMemCache() {
  if (!memCache) {
    memCache = resolveDb(defaultDbTemplate);
    cacheLoadedAt = Date.now();
  }
  return memCache;
}

/** Read-only under lock (returns fn result, no save) */
function readFn(fn) {
  return withLockSync(() => {
    ensureMemCache();
    return fn(memCache);
  });
}

/** Mutate + atomic save */
function mutate(fn) {
  return withLockSync(() => {
    ensureMemCache();
    const result = fn(memCache);
    saveToDisk(memCache);
    cacheLoadedAt = Date.now();
    return result;
  });
}

/** Force reload from disk (multi-process deployments) */
function reload() {
  withLockSync(() => {
    memCache = resolveDb(defaultDbTemplate);
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
