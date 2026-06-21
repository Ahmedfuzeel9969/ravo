const express = require('express');
const store = require('../db');
const { parsePagination, idempotencyKey } = require('../middleware/security');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    const { limit, offset } = parsePagination(req);
    const result = store.getBookings(req.userId, status || null, { limit, offset });
    res.json({ success: true, data: result.items, meta: { total: result.total, limit: result.limit, offset: result.offset } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    res.json({ success: true, data: store.getBookingStats(req.userId) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { driverId, bookingType, rideType, pickup, destination, fare, scheduledAt, stops, recurring, safeRide } = req.body;

    if (!driverId) {
      return res.status(400).json({ success: false, error: 'driverId required' });
    }

    const booking = store.createBooking({
      userId: req.userId,
      driverId,
      bookingType: bookingType || 'ride',
      rideType,
      pickup,
      destination,
      fare,
      scheduledAt,
      stops,
      recurring,
      safeRide,
      idempotencyKey: idempotencyKey(req)
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'upcoming', 'completed', 'cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    if (status === 'completed' || status === 'cancelled') {
      const current = store.getBookingById(req.userId, req.params.id);
      if (!current) return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const booking = store.updateBookingStatus(req.userId, req.params.id, status);
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
