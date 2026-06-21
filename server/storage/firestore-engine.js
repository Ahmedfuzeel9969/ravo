/**
 * Firestore storage engine — persistent cloud DB, same API as json-engine.
 * Stores full app state in one document (p2p/state) for zero changes in db.js logic.
 */
const crypto = require('crypto');
const { getFirestore } = require('./firebase-admin');
const {
  cloneDefault,
  createFreshDb,
  repairDb,
  isUsableDb,
  touchMeta,
  hydrateMemCache
} = require('./db-helpers');

const COLLECTION = process.env.FIRESTORE_COLLECTION || 'p2p';
const STATE_DOC = process.env.FIRESTORE_STATE_DOC || 'state';

let memCache = null;
let cacheLoadedAt = 0;
let defaultDbTemplate = null;
let persistChain = Promise.resolve();

function stateRef() {
  return getFirestore().collection(COLLECTION).doc(STATE_DOC);
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

async function loadFromFirestore(template) {
  const ref = stateRef();
  const snap = await ref.get();

  if (!snap.exists) {
    const fresh = createFreshDb(template);
    await ref.set({
      payload: fresh,
      updated_at: fresh.meta.updated_at
    });
    console.log('[firestore] Seeded default database');
    return fresh;
  }

  const payload = snap.data()?.payload;
  if (!isUsableDb(payload)) {
    const fresh = createFreshDb(template);
    await ref.set({
      payload: fresh,
      updated_at: fresh.meta.updated_at
    });
    console.warn('[firestore] Invalid state document — reseeded defaults');
    return fresh;
  }

  const repaired = repairDb(payload, template, defaultDbTemplate);
  const needsSave = JSON.stringify(repaired) !== JSON.stringify(payload);
  if (needsSave) {
    touchMeta(repaired);
    await ref.set({
      payload: repaired,
      updated_at: repaired.meta.updated_at
    });
  }
  return repaired;
}

async function persistToFirestore(db) {
  touchMeta(db);
  await stateRef().set({
    payload: db,
    updated_at: db.meta.updated_at
  });
}

function queuePersist(db) {
  persistChain = persistChain
    .then(() => persistToFirestore(db))
    .catch((err) => {
      console.error('[firestore] Persist failed:', err.message);
    });
}

function ensureMemCache() {
  if (!memCache) {
    throw new Error('Database not initialized — call initAsync() before handling requests');
  }
  return memCache;
}

async function initAsync(defaultDb) {
  defaultDbTemplate = cloneDefault(defaultDb);
  memCache = await loadFromFirestore(defaultDb);
  cacheLoadedAt = Date.now();
  console.log(`[firestore] Loaded — users: ${memCache.users?.length || 0}, bookings: ${memCache.bookings?.length || 0}`);
}

async function hydrateAsync(defaultDb) {
  if (defaultDb) defaultDbTemplate = cloneDefault(defaultDb);
  if (!memCache) await initAsync(defaultDb || defaultDbTemplate);
  hydrateMemCache(memCache, mutate);
  return memCache;
}

function readFn(fn) {
  ensureMemCache();
  return fn(memCache);
}

function mutate(fn) {
  ensureMemCache();
  const result = fn(memCache);
  queuePersist(memCache);
  cacheLoadedAt = Date.now();
  return result;
}

async function reload() {
  memCache = await loadFromFirestore(defaultDbTemplate);
  cacheLoadedAt = Date.now();
}

function getStats() {
  return readFn((db) => ({
    mode: 'firestore',
    collection: COLLECTION,
    document: STATE_DOC,
    version: db.meta?.version || 0,
    bookings: db.bookings?.length || 0,
    drivers: db.drivers?.length || 0,
    users: db.users?.length || 0,
    cacheAgeMs: Date.now() - cacheLoadedAt
  }));
}

function getStorageMode() {
  return 'firestore';
}

/** Wait for pending writes (graceful shutdown / tests) */
async function flush() {
  await persistChain;
}

module.exports = {
  DB_FILE: null,
  DATA_DIR: null,
  newId,
  initAsync,
  hydrateAsync,
  readFn,
  mutate,
  reload,
  getStats,
  getStorageMode,
  flush
};
