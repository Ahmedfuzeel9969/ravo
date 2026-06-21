/**
 * Environment — localhost vs production API / WebSocket origins
 *
 * Local dev (npm start): same-origin /api and ws://localhost:PORT/ws
 * Firebase Hosting: set meta[name="p2p-api-origin"] to your Render URL
 */
const EnvConfig = (() => {
  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    (window.location.protocol === 'file:' && !hostname);

  const fromMeta = document.querySelector('meta[name="p2p-api-origin"]')?.content?.trim();
  const fromWindow = typeof window.__P2P_API_ORIGIN__ === 'string' ? window.__P2P_API_ORIGIN__.trim() : '';
  const fromStorage = localStorage.getItem('p2p_api_origin')?.trim() || '';

  /** Render.com service URL — update meta tag after first deploy */
  const PRODUCTION_API_ORIGIN =
    fromWindow || fromMeta || fromStorage || 'https://p2p-transport-api.onrender.com';

  const apiOrigin = isLocal ? window.location.origin : PRODUCTION_API_ORIGIN.replace(/\/$/, '');

  function wsUrlFromOrigin(origin) {
    const u = new URL(origin);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${u.host}/ws`;
  }

  return {
    isLocal,
    isProduction: !isLocal,
    apiOrigin,
    apiBaseUrl: `${apiOrigin}/api`,
    wsUrl: wsUrlFromOrigin(apiOrigin),

    /** Override at runtime (e.g. staging) — persists in localStorage */
    setApiOrigin(origin) {
      if (!origin) {
        localStorage.removeItem('p2p_api_origin');
        return;
      }
      localStorage.setItem('p2p_api_origin', origin.replace(/\/$/, ''));
    }
  };
})();
