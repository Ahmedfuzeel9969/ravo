const http = require('http');
const express = require('express');
const path = require('path');
const cors = require('cors');
const store = require('./db');
require('./features-store');

const {
  helmet, apiLimiter, writeLimiter, aiLimiter, resolveUser
} = require('./middleware/security');

const driversRouter = require('./routes/drivers');
const bookingsRouter = require('./routes/bookings');
const walletRouter = require('./routes/wallet');
const featuresRouter = require('./routes/features');
const rolesRouter = require('./routes/roles');
const searchRouter = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const API_ONLY = process.env.API_ONLY === 'true';

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : true;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: corsOrigin, maxAge: 86400 }));
app.use(express.json({ limit: '512kb' }));
app.use(resolveUser);
app.use('/api', apiLimiter);

app.use('/api/drivers', driversRouter);
app.use('/api/bookings', writeLimiter, bookingsRouter);
app.use('/api/wallet', writeLimiter, walletRouter);
app.use('/api', featuresRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/search', aiLimiter, searchRouter);

const { attachWebSocket } = require('./ws');

app.get('/api/history/stats', (req, res) => {
  try {
    res.json({ success: true, data: store.getHistoryStats(req.userId) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/profile', (req, res) => {
  try {
    res.json({ success: true, data: store.getProfile(req.userId) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  try {
    const dbStats = store.engine.getStats();
    res.json({
      success: true,
      status: 'ok',
      ws: '/ws',
      db: dbStats,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({ success: false, status: 'degraded', error: err.message });
  }
});

if (!API_ONLY) {
  app.use(express.static(ROOT));
}

if (API_ONLY) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ success: false, error: 'API route not found' });
    }
    res.status(404).json({
      success: false,
      error: 'API only — frontend is hosted separately (Firebase Hosting)'
    });
  });
} else {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ success: false, error: 'API route not found' });
    }
    if (req.path.endsWith('.html') || (req.path.includes('.') && !req.path.startsWith('/?'))) {
      return res.status(404).send('Not found');
    }
    res.sendFile(path.join(ROOT, 'index.html'));
  });
}

const server = http.createServer(app);
attachWebSocket(server);

function shutdown(signal) {
  console.log(`\n  ⏹ ${signal} — shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🚀 P2P Transport Server (production-hardened)`);
  console.log(`  🏡 Local:   http://localhost:${PORT}`);
  console.log(`  📡 API:     http://localhost:${PORT}/api/health`);
  console.log(`  🔴 Live WS: ws://localhost:${PORT}/ws`);
  if (API_ONLY) console.log(`  📦 Mode:    API_ONLY (static frontend not served)`);
  console.log('');
});
