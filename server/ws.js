const { WebSocketServer } = require('ws');
const features = require('./features-store');
const live = require('./live-registry');
const store = require('./db');

const BROADCAST_MS = 5000;
const LOCATION_MIN_MS = 2000;
const MAX_MSG_BYTES = 8192;
const lastBroadcast = { ts: 0, hash: '' };
const lastLocationWrite = new Map();

function seedLinkedDrivers() {
  if (live.getAllOnline().length > 0) return;
  store.engine.readFn((db) => {
    db.drivers.filter((d) => d.linked && d.is_available).forEach((d) => {
      live.goOnline(d.id, d.user_id || d.id, d.lat, d.lng);
    });
  });
}

function attachWebSocket(server) {
  seedLinkedDrivers();
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MSG_BYTES });

  wss.on('connection', (ws, req) => {
    ws.clientId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    ws.isAlive = true;
    ws.subscribedGeo = null;

    ws.send(JSON.stringify({ type: 'connected', message: 'P2P Live — real linked drivers' }));

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      if (raw.length > MAX_MSG_BYTES) return;
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));

        if (msg.type === 'live_location') {
          const { lat, lng, userId } = msg.payload || {};
          if (lat == null || lng == null) return;
          wss.clients.forEach((c) => {
            if (c !== ws && c.readyState === 1 && c.shareLocation) {
              c.send(JSON.stringify({ type: 'user_location', lat, lng, userId }));
            }
          });
        }

        if (msg.type === 'driver_online') {
          const { driverId, userId, lat, lng } = msg.payload || {};
          if (driverId && lat != null && lng != null) {
            live.goOnline(driverId, userId, lat, lng);
            features.markDriverLinked(driverId, userId);
            throttledBroadcast(wss);
          }
        }

        if (msg.type === 'driver_offline') {
          live.goOffline(msg.payload?.driverId);
          throttledBroadcast(wss);
        }

        if (msg.type === 'driver_location') {
          const { driverId, lat, lng, heading, speed } = msg.payload || {};
          if (!driverId || lat == null || lng == null) return;
          const now = Date.now();
          const last = lastLocationWrite.get(driverId) || 0;
          if (now - last < LOCATION_MIN_MS) return;
          lastLocationWrite.set(driverId, now);
          live.updateLocation(driverId, lat, lng, heading, speed);
          throttledBroadcast(wss);
        }

        if (msg.type === 'subscribe_geo') {
          ws.subscribedGeo = msg.payload?.cell || null;
        }
      } catch { /* ignore malformed */ }
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
    live.pruneStale(120000);
  }, 30000);

  const broadcastTimer = setInterval(() => throttledBroadcast(wss), BROADCAST_MS);

  wss.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(broadcastTimer);
  });

  return wss;
}

function throttledBroadcast(wss) {
  const now = Date.now();
  if (now - lastBroadcast.ts < 1500) return;
  const drivers = features.getLiveDriversForBroadcast();
  const hash = JSON.stringify(drivers.map((d) => [d.id, d.lat, d.lng]));
  if (hash === lastBroadcast.hash && now - lastBroadcast.ts < BROADCAST_MS) return;
  lastBroadcast.ts = now;
  lastBroadcast.hash = hash;
  const payload = JSON.stringify({ type: 'drivers_update', drivers, ts: now });
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(payload);
  });
}

module.exports = { attachWebSocket };
