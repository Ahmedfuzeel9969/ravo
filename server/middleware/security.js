const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const DEFAULT_USER = 'user-1';

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — thora انتظار کریں' }
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Write limit exceeded' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  message: { success: false, error: 'AI rate limit — 1 منٹ بعد کوشش کریں' }
});

function resolveUser(req, _res, next) {
  const userId = (req.headers['x-user-id'] || DEFAULT_USER).toString().slice(0, 64);
  req.userId = userId;
  req.userRole = (req.headers['x-user-role'] || 'passenger').toString().slice(0, 32);
  next();
}

function requireAdmin(req, res, next) {
  if (req.userRole !== 'superadmin' && req.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin only' });
  }
  next();
}

function parsePagination(req) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return { limit, offset };
}

function idempotencyKey(req) {
  return req.headers['idempotency-key'] || req.body?.idempotencyKey || null;
}

module.exports = {
  helmet,
  apiLimiter,
  writeLimiter,
  aiLimiter,
  resolveUser,
  requireAdmin,
  parsePagination,
  idempotencyKey,
  DEFAULT_USER
};
