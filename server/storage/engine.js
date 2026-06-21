/**
 * Storage backend selector — json (db.json) or firestore (Firebase)
 *
 * STORAGE_BACKEND=json     → local file (default)
 * STORAGE_BACKEND=firestore → Firebase Firestore (persistent, stateless-safe)
 */
function resolveBackend() {
  return (process.env.STORAGE_BACKEND || 'json').trim().toLowerCase();
}

const backend = resolveBackend();

if (backend === 'firestore') {
  module.exports = require('./firestore-engine');
} else if (backend === 'json' || backend === 'file') {
  module.exports = require('./json-engine');
} else {
  throw new Error(`Unknown STORAGE_BACKEND="${backend}" — use "json" or "firestore"`);
}
