const express = require('express');
const features = require('../features-store');
const store = require('../db');

const router = express.Router();
const uid = (req) => req.headers['x-user-id'] || 'user-1';

router.get('/fare/predict', (req, res) => {
  const distance = parseFloat(req.query.distance) || 5;
  res.json({ success: true, data: features.predictFare(distance) });
});

router.post('/cargo/estimate', (req, res) => {
  try {
    res.json({ success: true, data: features.estimateCargo(req.body) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/bids', (req, res) => {
  try {
    const bid = features.createBid({ userId: uid(req), ...req.body });
    res.status(201).json({ success: true, data: bid });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/bids/:bookingId', (req, res) => {
  res.json({ success: true, data: features.getBids(req.params.bookingId) });
});

router.post('/chat', (req, res) => {
  try {
    const msg = features.sendMessage({ userId: uid(req), ...req.body });
    res.status(201).json({ success: true, data: msg });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/chat/:bookingId', (req, res) => {
  res.json({ success: true, data: features.getMessages(req.params.bookingId) });
});

router.get('/call/:driverId', (req, res) => {
  res.json({ success: true, data: features.getMaskedPhone(req.params.driverId) });
});

router.post('/payments/jazzcash', (req, res) => {
  try {
    const { amount, bookingId } = req.body;
    const result = features.payExternal({ userId: uid(req), method: 'jazzcash', amount, bookingId });
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/payments/easypaisa', (req, res) => {
  try {
    const { amount, bookingId } = req.body;
    const result = features.payExternal({ userId: uid(req), method: 'easypaisa', amount, bookingId });
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/fleet', (req, res) => {
  res.json({ success: true, data: features.getFleet(uid(req)) });
});

router.post('/safety/sos', (req, res) => {
  res.json({ success: true, data: features.triggerSOS(uid(req), req.body.location) });
});

router.post('/safety/share-trip', (req, res) => {
  res.json({ success: true, data: features.shareTrip(uid(req), req.body.bookingId) });
});

router.get('/carbon', (req, res) => {
  res.json({ success: true, data: features.getCarbonStats(uid(req)) });
});

router.post('/push/subscribe', (req, res) => {
  try {
    res.json({ success: true, data: features.savePushSubscription(uid(req), req.body.subscription) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/kyc/:driverId', (req, res) => {
  const d = store.getDriverById(req.params.driverId);
  if (!d) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({
    success: true,
    data: { id: d.id, name: d.name, kycVerified: d.kycVerified, cnicMasked: d.cnicMasked, rating: d.rating }
  });
});

router.get('/community/nearby', (req, res) => {
  const lat = parseFloat(req.query.lat) || 31.52;
  const lng = parseFloat(req.query.lng) || 74.35;
  const q = (req.query.q || '').toLowerCase();
  const type = req.query.type || 'all';
  let data = features.getCommunityNearby(lat, lng, 50);
  if (type !== 'all') data = data.filter((p) => p.type === type);
  if (q) {
    data = data.filter((p) =>
      `${p.from} ${p.to} ${p.text} ${p.userName}`.toLowerCase().includes(q)
    );
  }
  res.json({ success: true, data: data.slice(0, 30) });
});

router.get('/traffic', (req, res) => {
  const lat = parseFloat(req.query.lat) || 31.52;
  const lng = parseFloat(req.query.lng) || 74.35;
  res.json({ success: true, data: features.getTrafficSegments(lat, lng) });
});

router.get('/routes/options', (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  res.json({
    success: true,
    data: features.getRouteOptions(
      parseFloat(fromLat) || 31.52,
      parseFloat(fromLng) || 74.35,
      parseFloat(toLat) || 31.54,
      parseFloat(toLng) || 74.37
    )
  });
});

router.post('/pool', (req, res) => {
  try {
    res.status(201).json({ success: true, data: features.createRidePool(uid(req), req.body) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/family', (req, res) => {
  res.json({ success: true, data: features.getFamilyMembers(uid(req)) });
});

router.post('/family', (req, res) => {
  try {
    res.status(201).json({ success: true, data: features.addFamilyMember(uid(req), req.body) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/pricing/alerts', (req, res) => {
  res.json({ success: true, data: features.getPricingAlerts(uid(req)) });
});

router.post('/dashcam/start', (req, res) => {
  res.json({ success: true, data: features.startDashcam(uid(req), req.body.bookingId) });
});

router.post('/dashcam/stop', (req, res) => {
  res.json({ success: true, data: features.stopDashcam(uid(req), req.body.bookingId) });
});

router.get('/offline/bounds', (req, res) => {
  const lat = parseFloat(req.query.lat) || 31.52;
  const lng = parseFloat(req.query.lng) || 74.35;
  res.json({ success: true, data: features.getOfflineBounds(lat, lng) });
});

module.exports = router;
