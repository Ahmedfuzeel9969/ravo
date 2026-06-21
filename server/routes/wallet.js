const express = require('express');
const store = require('../db');
const { parsePagination, idempotencyKey } = require('../middleware/security');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.json({ success: true, data: store.getWallet(req.userId) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    res.json({ success: true, data: store.getFinanceStats(req.userId) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/transactions', (req, res) => {
  try {
    const { limit, offset } = parsePagination(req);
    const result = store.getTransactions(req.userId, { limit, offset });
    res.json({ success: true, data: result.items, meta: { total: result.total, limit: result.limit, offset: result.offset } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pay', (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ success: false, error: 'bookingId required' });
    }

    const result = store.processPayment(req.userId, bookingId, idempotencyKey(req));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
