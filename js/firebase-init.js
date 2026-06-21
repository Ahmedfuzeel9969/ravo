/**
 * Firebase — Analytics + App init (Ravo / P2P Transport)
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAnalytics, isSupported, logEvent } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC9KucoNkgi2dc2u4cv1j-2NRG3cqakwfk',
  authDomain: 'ravo-44c4c.firebaseapp.com',
  projectId: 'ravo-44c4c',
  storageBucket: 'ravo-44c4c.firebasestorage.app',
  messagingSenderId: '651256529267',
  appId: '1:651256529267:web:5e0f629aa2348671178506',
  measurementId: 'G-QF8V8E16ZC'
};

const app = initializeApp(firebaseConfig);

const FirebaseHub = {
  app,
  analytics: null,
  ready: false,

  track(eventName, params = {}) {
    if (!this.analytics) return;
    try {
      logEvent(this.analytics, eventName, params);
    } catch { /* ignore */ }
  },

  trackScreen(screenName) {
    this.track('screen_view', { firebase_screen: screenName, firebase_screen_class: screenName });
  }
};

async function boot() {
  try {
    if (await isSupported()) {
      FirebaseHub.analytics = getAnalytics(app);
      FirebaseHub.ready = true;
      FirebaseHub.track('app_open', { platform: 'web' });
    }
  } catch {
    /* localhost / blocked analytics */
  }
  window.FirebaseHub = FirebaseHub;
  window.dispatchEvent(new CustomEvent('firebase-ready', { detail: FirebaseHub }));
}

boot();
