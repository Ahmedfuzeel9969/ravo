const express = require('express');
const store = require('../db');
const { parsePagination } = require('../middleware/security');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { type, lat, lng, womenOnly, onlineOnly } = req.query;
    const { limit, offset } = parsePagination(req);
    const result = store.getDrivers({ type, lat, lng, womenOnly, onlineOnly, limit, offset });
    res.json({ success: true, data: result.drivers, meta: { total: result.total, limit: result.limit, offset: result.offset } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { lat, lng } = req.query;
    const driver = store.getDriverById(req.params.id, lat, lng);
    if (!driver) return res.status(404).json({ success: false, error: 'Driver not found' });
    res.json({ success: true, data: driver });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
