const express = require('express');
const store = require('../db');
const features = require('../features-store');
const live = require('../live-registry');

const router = express.Router();
const uid = (req) => req.headers['x-user-id'] || 'user-1';
const role = (req) => req.headers['x-user-role'] || 'passenger';

router.get('/me', (req, res) => {
  const userId = uid(req);
  const userRole = role(req);
  const profile = store.getProfile(userId);
  const driverId = features.getDriverIdForUser(userId);
  res.json({
    success: true,
    data: {
      userId,
      role: userRole,
      profile,
      driverId,
      isOnline: driverId ? live.isOnline(driverId) : false
    }
  });
});

router.post('/driver/go-online', (req, res) => {
  try {
    const userId = uid(req);
    const { lat, lng, driverId } = req.body;
    const dId = driverId || features.getDriverIdForUser(userId);
    if (!dId) return res.status(400).json({ success: false, error: 'No linked vehicle' });
    live.goOnline(dId, userId, lat || 31.52, lng || 74.35);
    features.markDriverLinked(dId, userId);
    res.json({ success: true, data: { driverId: dId, online: true } });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/driver/go-offline', (req, res) => {
  const userId = uid(req);
  const dId = features.getDriverIdForUser(userId);
  if (dId) live.goOffline(dId);
  res.json({ success: true, data: { online: false } });
});

router.post('/driver/location', (req, res) => {
  const userId = uid(req);
  const { lat, lng, heading, speed } = req.body;
  const dId = features.getDriverIdForUser(userId);
  if (!dId) return res.status(400).json({ success: false, error: 'Not a driver' });
  if (!live.isOnline(dId)) live.goOnline(dId, userId, lat, lng);
  else live.updateLocation(dId, lat, lng, heading, speed);
  features.persistDriverLocation(dId, lat, lng);
  res.json({ success: true, data: { updated: true } });
});

router.post('/driver/ad', (req, res) => {
  try {
    const ad = features.createDriverAd(uid(req), req.body);
    res.status(201).json({ success: true, data: ad });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/owner/fleet', (req, res) => {
  const userId = uid(req);
  res.json({ success: true, data: features.getOwnerFleet(userId) });
});

router.get('/admin/dashboard', (req, res) => {
  if (role(req) !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Super admin only' });
  }
  res.json({ success: true, data: features.getAdminDashboard() });
});

router.get('/trips/:bookingId/progress', (req, res) => {
  try {
    const data = features.getTripProgress(uid(req), req.params.bookingId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, error: e.message });
  }
});

module.exports = router;
