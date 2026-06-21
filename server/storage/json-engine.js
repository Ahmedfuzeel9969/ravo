/**
 * JSON file storage engine — local db.json with memory fallback for stateless hosts.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const lockfile = require('proper-lockfile');
const {
  isPlainObject,
  cloneDefault,
  createFreshDb,
  repairDb,
  isUsableDb,
  touchMeta,
  hydrateMemCache
} = require('./db-helpers');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_TMP = path.join(DATA_DIR, 'db.json.tmp');
const LOCK_FILE = path.join(DATA_DIR, 'db.json.lock');
const LOCK_OPTS = { stale: 10000, update: 5000 };

let memCache = null;
let cacheLoadedAt = 0;
let defaultDbTemplate = null;
/** @type {'disk' | 'memory'} */
let storageMode = null;

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function wantsMemoryMode() {
  const mode = (process.env.STORAGE_MODE || '').trim().toLowerCase();
  return mode === 'memory' || mode === 'stateless';
}

function enableMemoryMode(reason) {
  if (storageMode === 'memory') return;
  storageMode = 'memory';
  console.warn(`[storage] In-memory mode enabled${reason ? ` (${reason})` : ''} — data resets on restart`);
}

function probeDiskWritable() {
  if (wantsMemoryMode()) return false;
  try {
    ensureDataDir();
    const probe = path.join(DATA_DIR, '.write-probe');
    fs.writeFileSync(probe, '1', 'utf8');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolveStorageMode() {
  if (storageMode) return storageMode;
  if (wantsMemoryMode() || !probeDiskWritable()) {
    enableMemoryMode(wantsMemoryMode() ? 'STORAGE_MODE' : 'disk unavailable');
  } else {
    storageMode = 'disk';
  }
  return storageMode;
}

function backupCorruptFile(raw) {
  if (resolveStorageMode() === 'memory') return;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(DATA_DIR, `db.json.corrupt.${stamp}`);
    fs.writeFileSync(backupPath, raw ?? '', 'utf8');
    console.warn(`[storage] Backed up corrupt db.json → ${path.basename(backupPath)}`);
  } catch (err) {
    console.warn('[storage] Could not backup corrupt db.json:', err.message);
  }
}

function loadFromDisk() {
  if (resolveStorageMode() === 'memory') return null;

  try {
    ensureDataDir();
  } catch (err) {
    console.warn('[storage] Could not create data directory:', err.message);
    enableMemoryMode('data directory unavailable');
    return null;
  }

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
    console.warn('[storage] db.json is empty — using defaults');
    backupCorruptFile(raw);
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!isPlainObject(parsed)) {
      console.warn('[storage] db.json root is not an object — using defaults');
      backupCorruptFile(raw);
      return null;
    }
    if (!isUsableDb(parsed)) {
      console.warn('[storage] db.json is empty or missing seed data — using defaults');
      backupCorruptFile(raw);
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[storage] db.json parse error — using defaults:', err.message);
    backupCorruptFile(raw);
    return null;
  }
}

function saveToDisk(db) {
  if (resolveStorageMode() === 'memory') {
    touchMeta(db);
    return true;
  }

  try {
    ensureDataDir();
    touchMeta(db);
    const json = JSON.stringify(db);
    fs.writeFileSync(DB_TMP, json, 'utf8');
    fs.renameSync(DB_TMP, DB_FILE);
    return true;
  } catch (err) {
    console.warn('[storage] Disk write failed — switching to in-memory mode:', err.message);
    enableMemoryMode('write failed');
    touchMeta(db);
    return false;
  }
}

function withMemoryLockSync(fn) {
  return fn();
}

function clearStaleLockArtifacts() {
  const companions = [LOCK_FILE, `${LOCK_FILE}.lock`];
  for (const file of companions) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch { /* ignore */ }
  }
}

function withDiskLockSync(fn) {
  try {
    ensureDataDir();
    if (!fs.existsSync(LOCK_FILE)) {
      fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');
    }
  } catch (err) {
    console.warn('[storage] Could not prepare lock file:', err.message);
    enableMemoryMode('lock prep failed');
    return withMemoryLockSync(fn);
  }

  const acquire = () => lockfile.lockSync(LOCK_FILE, LOCK_OPTS);

  try {
    let release;
    try {
      release = acquire();
    } catch (err) {
      if (err.code === 'ELOCKED') {
        console.warn('[storage] Lock held — clearing stale lock and retrying');
        clearStaleLockArtifacts();
        fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');
        release = acquire();
      } else {
        throw err;
      }
    }
    try {
      return fn();
    } finally {
      release();
    }
  } catch (err) {
    console.warn('[storage] File lock failed — using in-memory lock:', err.message);
    enableMemoryMode('lock failed');
    return withMemoryLockSync(fn);
  }
}

function withLockSync(fn) {
  if (resolveStorageMode() === 'memory') return withMemoryLockSync(fn);
  return withDiskLockSync(fn);
}

function resolveDb(defaultDb) {
  const template = defaultDb || defaultDbTemplate;
  if (!template) {
    throw new Error('Database default template not set — call initAsync(defaultDb) first');
  }

  if (resolveStorageMode() === 'memory') {
    return createFreshDb(template);
  }

  const loaded = loadFromDisk();
  if (!loaded || !isUsableDb(loaded)) {
    const fresh = createFreshDb(template);
    saveToDisk(fresh);
    return fresh;
  }

  const repaired = repairDb(loaded, template, defaultDbTemplate);
  const needsSave = JSON.stringify(repaired) !== JSON.stringify(loaded);
  if (needsSave) saveToDisk(repaired);
  return repaired;
}

function init(defaultDb) {
  defaultDbTemplate = cloneDefault(defaultDb);
  resolveStorageMode();
  withLockSync(() => {
    memCache = resolveDb(defaultDb);
    cacheLoadedAt = Date.now();
  });
}

function hydrate(defaultDb) {
  if (defaultDb) defaultDbTemplate = cloneDefault(defaultDb);
  if (!memCache) init(defaultDb || defaultDbTemplate);
  hydrateMemCache(memCache, mutate);
  return memCache;
}

async function initAsync(defaultDb) {
  init(defaultDb);
}

async function hydrateAsync(defaultDb) {
  hydrate(defaultDb);
}

function ensureMemCache() {
  if (!memCache) {
    memCache = resolveDb(defaultDbTemplate);
    cacheLoadedAt = Date.now();
  }
  return memCache;
}

function readFn(fn) {
  return withLockSync(() => {
    ensureMemCache();
    return fn(memCache);
  });
}

function mutate(fn) {
  return withLockSync(() => {
    ensureMemCache();
    const result = fn(memCache);
    saveToDisk(memCache);
    cacheLoadedAt = Date.now();
    return result;
  });
}

function reload() {
  withLockSync(() => {
    if (resolveStorageMode() === 'memory') {
      memCache = resolveDb(defaultDbTemplate);
    } else {
      memCache = loadFromDisk();
      if (!memCache || !isUsableDb(memCache)) {
        memCache = resolveDb(defaultDbTemplate);
      } else {
        memCache = repairDb(memCache, defaultDbTemplate, defaultDbTemplate);
      }
    }
    cacheLoadedAt = Date.now();
  });
}

function getStats() {
  return readFn((db) => ({
    mode: resolveStorageMode(),
    dataDir: resolveStorageMode() === 'disk' ? DATA_DIR : os.tmpdir(),
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
  initAsync,
  hydrateAsync,
  readFn,
  mutate,
  reload,
  getStats,
  getStorageMode: () => resolveStorageMode(),
  flush: async () => {}
};
