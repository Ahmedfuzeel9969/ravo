function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function cloneDefault(defaultDb) {
  return structuredClone(defaultDb);
}

function createFreshDb(template) {
  const fresh = cloneDefault(template);
  if (!fresh.meta) fresh.meta = { version: 1, created_at: new Date().toISOString() };
  if (!fresh.idempotency_keys) fresh.idempotency_keys = [];
  return fresh;
}

function repairDb(db, defaultDb, defaultDbTemplate) {
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
  if (!isPlainObject(db)) return false;
  // Reject {} or meta-only stubs — require real seeded collections
  return (
    (Array.isArray(db.users) && db.users.length > 0) ||
    (Array.isArray(db.drivers) && db.drivers.length > 0) ||
    (Array.isArray(db.bookings) && db.bookings.length > 0)
  );
}

function touchMeta(db) {
  if (!db.meta) db.meta = {};
  db.meta.version = (db.meta.version || 0) + 1;
  db.meta.updated_at = new Date().toISOString();
}

function hydrateMemCache(memCache, mutate) {
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

module.exports = {
  isPlainObject,
  cloneDefault,
  createFreshDb,
  repairDb,
  isUsableDb,
  touchMeta,
  hydrateMemCache
};
