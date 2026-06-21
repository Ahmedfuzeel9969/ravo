/**
 * Live linked drivers — in-memory GPS (Redis-ready interface)
 */
const onlineDrivers = new Map();
const activeTrips = new Map();
const MAX_ONLINE = 500000;

function goOnline(driverId, userId, lat, lng) {
  if (onlineDrivers.size >= MAX_ONLINE && !onlineDrivers.has(driverId)) return;
  onlineDrivers.set(driverId, {
    driverId,
    userId,
    lat,
    lng,
    heading: 0,
    speed: 0,
    updatedAt: Date.now(),
    isOnline: true
  });
}

function updateLocation(driverId, lat, lng, heading = 0, speed = 0) {
  const d = onlineDrivers.get(driverId);
  if (!d) return null;
  d.lat = lat;
  d.lng = lng;
  d.heading = heading;
  d.speed = speed;
  d.updatedAt = Date.now();
  return d;
}

function goOffline(driverId) {
  onlineDrivers.delete(driverId);
}

function getOnline(driverId) {
  return onlineDrivers.get(driverId) || null;
}

function getAllOnline() {
  return [...onlineDrivers.values()];
}

function isOnline(driverId) {
  return onlineDrivers.has(driverId);
}

function pruneStale(maxAgeMs = 120000) {
  const cutoff = Date.now() - maxAgeMs;
  onlineDrivers.forEach((d, id) => {
    if (d.updatedAt < cutoff) onlineDrivers.delete(id);
  });
}

function setTripProgress(bookingId, data) {
  activeTrips.set(bookingId, { ...data, updatedAt: Date.now() });
}

function getTripProgress(bookingId) {
  return activeTrips.get(bookingId) || null;
}

function removeTrip(bookingId) {
  activeTrips.delete(bookingId);
}

module.exports = {
  goOnline,
  updateLocation,
  goOffline,
  getOnline,
  getAllOnline,
  isOnline,
  pruneStale,
  setTripProgress,
  getTripProgress,
  removeTrip
};
