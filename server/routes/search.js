const express = require('express');
const searchEngine = require('../search-engine');

const router = express.Router();
const uid = (req) => req.userId || req.headers['x-user-id'] || 'user-1';

router.get('/categories', (_req, res) => {
  res.json({ success: true, data: searchEngine.getCategories() });
});

router.get('/poi', async (req, res) => {
  try {
    const { q, lat, lng, category, limit } = req.query;
    const data = await searchEngine.searchPOI({
      q: (q || '').slice(0, 200),
      lat: parseFloat(lat) || 31.52,
      lng: parseFloat(lng) || 74.35,
      category: category || 'all',
      limit: Math.min(parseInt(limit, 10) || 15, 30)
    });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/ai/chat', async (req, res) => {
  try {
    const { message, lat, lng, history, tripContext } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, error: 'Message required' });
    if (message.length > 2000) return res.status(400).json({ success: false, error: 'Message too long' });
    const data = await searchEngine.aiChat(uid(req), { message, lat, lng, history, tripContext });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/ai/book', async (req, res) => {
  try {
    const data = await searchEngine.aiNegotiateBooking(uid(req), req.body);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
