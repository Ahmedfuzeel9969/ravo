/**
 * Firebase Admin SDK — service account from environment (Render/Koyeb/Firebase)
 */
const admin = require('firebase-admin');

let initialized = false;

function parseServiceAccountJson(raw) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is empty');

  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
    } catch (err) {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${err.message}`);
    }
  }
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return null;
  }
  throw new Error(
    'Firebase credentials missing — set FIREBASE_SERVICE_ACCOUNT_JSON (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path)'
  );
}

function initFirebase() {
  if (initialized) return admin;

  const serviceAccount = loadServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    serviceAccount?.project_id;

  if (!projectId) {
    throw new Error('Firebase project ID missing — set FIREBASE_PROJECT_ID or include project_id in service account JSON');
  }

  const options = { projectId };

  if (serviceAccount) {
    options.credential = admin.credential.cert(serviceAccount);
  } else {
    options.credential = admin.credential.applicationDefault();
  }

  if (!admin.apps.length) {
    admin.initializeApp(options);
  }

  initialized = true;
  console.log(`[firebase] Admin SDK ready — project: ${projectId}`);
  return admin;
}

function getFirestore() {
  initFirebase();
  return admin.firestore();
}

function isFirebaseReady() {
  return initialized;
}

module.exports = {
  admin,
  initFirebase,
  getFirestore,
  isFirebaseReady
};
