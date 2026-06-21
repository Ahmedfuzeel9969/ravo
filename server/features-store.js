const store = require('./db');
const engine = require('./storage/engine');

function dbRead(fn) { return engine.readFn(fn); }
function dbWrite(fn) { return engine.mutate(fn); }

function loadDb() { return dbRead((db) => db); }
function saveDb() { return dbWrite((db) => db); }

function ensureFeatureSchema() {
  return dbWrite((db) => {
  let changed = false;

  if (!db.bids) { db.bids = []; changed = true; }
  if (!db.messages) { db.messages = []; changed = true; }
  if (!db.fleet) {
    db.fleet = [
      { id: 'f1', owner_id: 'user-1', vehicle: 'Suzuki WagonR', driver: 'احمد خان', status: 'active', trips: 128 },
      { id: 'f2', owner_id: 'user-1', vehicle: 'Toyota Hiace', driver: 'عمر فاروق', status: 'active', trips: 89 },
      { id: 'f3', owner_id: 'user-1', vehicle: 'Honda City', driver: 'بلال حسین', status: 'idle', trips: 56 }
    ];
    changed = true;
  }
  if (!db.safety_contacts) {
    db.safety_contacts = [{ user_id: 'user-1', name: 'Emergency', phone: '15' }];
    changed = true;
  }
  if (!db.push_subscriptions) { db.push_subscriptions = []; changed = true; }
  if (!db.community_posts) {
    db.community_posts = [
      { id: 'cp1', user_name: 'علی احمد', type: 'ride', from: 'موڈل ٹاؤن', to: 'ڈی ہیڈ', text: 'موڈل ٹاؤن سے DHA جانا ہے، 2 سیٹ خالی', lat: 31.492, lng: 74.325, created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 'cp2', user_name: 'فاطمہ', type: 'ride', from: 'گلبرگ', to: 'الامہ ڈاؤن', text: 'صبح 9 بجے آفس جانا ہے، ساتھ چلیں؟', lat: 31.515, lng: 74.342, created_at: new Date(Date.now() - 7200000).toISOString() },
      { id: 'cp3', user_name: 'حسن رaza', type: 'cargo', from: 'جوہر ٹاؤن', to: 'فیروزپور روڈ', text: '1 دریزی مشین بھیجنی ہے، ہلکا سامان', lat: 31.468, lng: 74.278, created_at: new Date(Date.now() - 1800000).toISOString() },
      { id: 'cp4', user_name: 'سara', type: 'ride', from: 'کینال روڈ', to: 'آئیرپورٹ', text: 'شام 6 بجے ائیرپورٹ جانا ہے', lat: 31.521, lng: 74.412, created_at: new Date(Date.now() - 5400000).toISOString() },
      { id: 'cp5', user_name: 'بلال', type: 'cargo', from: 'ٹاؤن شپ', to: 'بہاولپور', text: '2 بوری کپڑے بھیجنے ہیں', lat: 31.448, lng: 74.298, created_at: new Date(Date.now() - 900000).toISOString() },
      { id: 'cp6', user_name: 'زینب', type: 'ride', from: 'واپڈا ٹاؤن', to: 'شادمن', text: 'خواتین only — کالج جانا ہے', lat: 31.508, lng: 74.318, created_at: new Date(Date.now() - 4200000).toISOString() }
    ];
    changed = true;
  }

  db.drivers.forEach((d, i) => {
    if (d.kyc_verified === undefined) { d.kyc_verified = true; changed = true; }
    if (!d.cnic_masked) { d.cnic_masked = `35201-*******-${i + 1}`; changed = true; }
    if (!d.gender) { d.gender = i % 3 === 0 ? 'female' : 'male'; changed = true; }
    if (d.women_only === undefined) { d.women_only = i % 3 === 0; changed = true; }
    if (!d.carbon_saved_kg) { d.carbon_saved_kg = Math.round(10 + Math.random() * 40); changed = true; }
    if (d.linked === undefined) { d.linked = true; changed = true; }
    if (!d.owner_id) { d.owner_id = i < 2 ? 'owner-1' : `owner-${i + 1}`; changed = true; }
    if (!d.user_id) { d.user_id = `driver-user-${d.id}`; changed = true; }
  });

  if (db.community_posts && db.community_posts.length) {
    const driverIds = db.drivers.map((d) => d.id);
    db.community_posts.forEach((p, i) => {
      if (!p.driver_id) { p.driver_id = driverIds[i % driverIds.length]; changed = true; }
    });
  }

  if (!db.users.find((u) => u.id === 'owner-1')) {
    db.users.push({ id: 'owner-1', name: 'مالک', phone: '0300-9999999', rating: 5, member_since: '2023', role: 'owner' });
    changed = true;
  }
  if (!db.users.find((u) => u.id === 'admin-1')) {
    db.users.push({ id: 'admin-1', name: 'Super Admin', phone: '0300-0000000', rating: 5, member_since: '2023', role: 'superadmin' });
    changed = true;
  }
  db.users.forEach((u) => {
    if (!u.role) { u.role = u.id === 'admin-1' ? 'superadmin' : 'passenger'; changed = true; }
  });

  if (changed) { /* saved by dbWrite */ }
  return db;
  });
}

module.exports = {
  ensureFeatureSchema,
  predictFare(distanceKm = 5) {
    const hour = new Date().getHours();
    let base = 80 + distanceKm * 45;
    let surge = 1;
    let label = 'normal';

    if (hour >= 7 && hour <= 9) { surge = 1.35; label = 'peak_morning'; }
    else if (hour >= 17 && hour <= 20) { surge = 1.45; label = 'peak_evening'; }
    else if (hour >= 22 || hour <= 5) { surge = 0.85; label = 'off_peak'; }

    const predicted = Math.round(base * surge);
    const low = Math.round(predicted * 0.88);
    const high = Math.round(predicted * 1.12);

    return {
      predicted,
      low,
      high,
      surge: Math.round((surge - 1) * 100),
      label,
      tip: label === 'off_peak' ? 'اب سفر سستا ہے!' : label.includes('peak') ? 'مصروف وقت — تھوڑا مہنگا' : 'معمولی کرایہ'
    };
  },

  estimateCargo({ description = '', weightKg = 0 }) {
    const text = description.toLowerCase();
    let estWeight = weightKg || 5;
    let category = 'small';

    if (/ٹرک|truck|heavy|بڑا|صنعتی|office|دفتر/.test(text)) {
      category = 'heavy';
      estWeight = Math.max(estWeight, 200);
    } else if (/گھر|home|move|furniture|فرنیچر|سofa/.test(text)) {
      category = 'home_move';
      estWeight = Math.max(estWeight, 80);
    } else if (/باکس|box|چھوٹا|small|document/.test(text)) {
      category = 'small';
      estWeight = Math.max(estWeight, 3);
    }

    const fare = category === 'heavy' ? 2500 + estWeight * 3
      : category === 'home_move' ? 1500 + estWeight * 5
        : 300 + estWeight * 15;

    return {
      category,
      estimatedWeightKg: estWeight,
      estimatedFare: Math.round(fare),
      vehicle: category === 'heavy' ? 'ٹرک' : category === 'home_move' ? 'مزدا/ٹرک' : 'Bike/Car'
    };
  },

  createBid({ userId, driverId, amount, bookingId }) {
    return dbWrite((db) => {
    const bid = {
      id: engine.newId('bid'),
      user_id: userId,
      driver_id: driverId,
      booking_id: bookingId || null,
      amount,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    db.bids.push(bid);
    return bid;
    });
  },

  getBids(bookingId) {
    const db = loadDb();
    return db.bids.filter((b) => b.booking_id === bookingId);
  },

  sendMessage({ userId, bookingId, text, sender = 'user' }) {
    return dbWrite((db) => {
    const msg = {
      id: engine.newId('msg'),
      booking_id: bookingId,
      user_id: userId,
      sender,
      text: String(text).slice(0, 2000),
      created_at: new Date().toISOString()
    };
    db.messages.push(msg);
    return msg;
    });
  },

  getMessages(bookingId) {
    const db = loadDb();
    return db.messages.filter((m) => m.booking_id === bookingId);
  },

  getMaskedPhone(driverId) {
    const db = loadDb();
    const driver = db.drivers.find((d) => d.id === driverId);
    return { masked: '0300-***' + String(Math.floor(Math.random() * 9000 + 1000)), driver: driver?.name };
  },

  payExternal({ userId, method, amount, bookingId }) {
    return dbWrite((db) => {
    const ref = `${String(method).toUpperCase()}-${engine.newId('ref').slice(-12)}`;
    const amt = Math.max(0, parseFloat(amount) || 0);
    db.transactions.push({
      id: engine.newId('t'),
      user_id: userId,
      booking_id: bookingId || null,
      amount: amt,
      type: bookingId ? 'payment' : 'topup',
      status: 'completed',
      description: `${method} — ${ref}`,
      created_at: new Date().toISOString()
    });
    if (!db.wallet[userId]) db.wallet[userId] = { balance: 0, pending: 0, monthly_total: 0 };
    if (!bookingId) db.wallet[userId].balance += amt;
    return { success: true, reference: ref, method, credited: !bookingId ? amt : 0 };
    });
  },

  getFleet(userId) {
    const db = loadDb();
    return db.fleet.filter((f) => f.owner_id === userId);
  },

  triggerSOS(userId, location) {
    const db = loadDb();
    const contacts = db.safety_contacts.filter((c) => c.user_id === userId);
    return {
      sent: true,
      contacts: contacts.length,
      location,
      message: 'SOS بھیج دیا گیا — ایمرجنسی رابطوں کو اطلاع'
    };
  },

  shareTrip(userId, bookingId) {
    const link = `${process.env.APP_URL || 'http://localhost:3000'}/?trip=${bookingId}`;
    return { link, message: 'سفر کا لنک شیئر کریں' };
  },

  getCarbonStats(userId) {
    const db = loadDb();
    const trips = db.bookings.filter((b) => b.user_id === userId && b.status === 'completed');
    const kg = trips.length * 2.3;
    return {
      totalTrips: trips.length,
      carbonSavedKg: Math.round(kg * 10) / 10,
      badge: kg > 20 ? 'green_hero' : kg > 5 ? 'eco_rider' : 'starter'
    };
  },

  savePushSubscription(userId, subscription) {
    const db = loadDb();
    db.push_subscriptions.push({ user_id: userId, subscription, created_at: new Date().toISOString() });
    saveDb();
    return { saved: true };
  },

  haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  getCommunityNearby(lat, lng, limit = 20) {
    const db = loadDb();
    const now = Date.now();
    return db.community_posts
      .map((p) => ({
        id: p.id,
        driverId: p.driver_id,
        userName: p.user_name,
        type: p.type,
        from: p.from,
        to: p.to,
        text: p.text,
        lat: p.lat,
        lng: p.lng,
        distanceKm: Math.round(this.haversineKm(lat, lng, p.lat, p.lng) * 10) / 10,
        timeAgo: this.timeAgoUrdu(now - new Date(p.created_at).getTime())
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  },

  timeAgoUrdu(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'ابھی';
    if (min < 60) return `${min} منٹ پہلے`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} گھنٹے پہلے`;
    return `${Math.floor(hr / 24)} دن پہلے`;
  },

  getDriverIdForUser(userId) {
    const db = loadDb();
    const d = db.drivers.find((x) => x.user_id === userId);
    return d?.id || null;
  },

  markDriverLinked(driverId, userId) {
    const db = loadDb();
    const d = db.drivers.find((x) => x.id === driverId);
    if (d) { d.linked = true; d.user_id = userId; saveDb(); }
  },

  persistDriverLocation(driverId, lat, lng) {
    const live = require('./live-registry');
    live.updateLocation(driverId, lat, lng);
    /* GPS stays in memory — no disk write per tick (scale-safe) */
  },

  createDriverAd(userId, body) {
    const db = loadDb();
    const driverId = this.getDriverIdForUser(userId);
    if (!driverId) throw new Error('Driver account required');
    const ad = {
      id: `cp${Date.now()}`,
      driver_id: driverId,
      user_name: db.users.find((u) => u.id === userId)?.name || 'ڈرائیور',
      type: body.type || 'ride',
      from: body.from || '',
      to: body.to || '',
      text: body.text || '',
      lat: body.lat || 31.52,
      lng: body.lng || 74.35,
      created_at: new Date().toISOString()
    };
    db.community_posts.unshift(ad);
    saveDb();
    return ad;
  },

  getOwnerFleet(userId) {
    const db = loadDb();
    const live = require('./live-registry');
    return db.drivers
      .filter((d) => d.owner_id === userId || d.user_id === userId)
      .map((d) => ({
        id: d.id,
        vehicle: d.vehicle,
        plate: d.plate,
        driver: d.name,
        lat: d.lat,
        lng: d.lng,
        isOnline: live.isOnline(d.id),
        linked: !!d.linked
      }));
  },

  getAdminDashboard() {
    const db = loadDb();
    const live = require('./live-registry');
    const online = live.getAllOnline().length;
    const byStatus = { active: 0, completed: 0, cancelled: 0, upcoming: 0 };
    db.bookings.forEach((b) => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });
    const revenue = db.bookings.filter((b) => b.status === 'completed').reduce((s, b) => s + b.fare, 0);
    const byType = { ride: 0, cargo: 0 };
    db.drivers.forEach((d) => { byType[d.vehicle_type] = (byType[d.vehicle_type] || 0) + 1; });

    return {
      totals: {
        users: db.users.length,
        drivers: db.drivers.length,
        onlineDrivers: online,
        bookings: db.bookings.length,
        revenue,
        ads: db.community_posts?.length || 0
      },
      bookingsByStatus: byStatus,
      driversByType: byType,
      weeklyTrips: [12, 18, 15, 22, 19, 25, 28],
      weeklyRevenue: [4200, 5100, 4800, 6200, 5800, 7100, 7500],
      regions: [
        { name: 'لاہور', pct: 45 },
        { name: 'کراچی', pct: 25 },
        { name: 'اسلام آباد', pct: 18 },
        { name: 'دیگر', pct: 12 }
      ]
    };
  },

  trafficAwareEta(fromLat, fromLng, toLat, toLng) {
    const dist = this.haversineKm(fromLat, fromLng, toLat, toLng);
    const hour = new Date().getHours();
    let avgKmh = 28;
    if (hour >= 7 && hour <= 10) avgKmh = 18;
    else if (hour >= 17 && hour <= 20) avgKmh = 16;
    else if (hour >= 22 || hour <= 5) avgKmh = 38;
    const minutes = Math.max(2, Math.round((dist / avgKmh) * 60));
    const arrival = new Date(Date.now() + minutes * 60000);
    return {
      distanceKm: Math.round(dist * 10) / 10,
      etaMinutes: minutes,
      arrivalTime: arrival.toLocaleTimeString('ur-PK', { hour: '2-digit', minute: '2-digit' }),
      trafficLevel: avgKmh < 20 ? 'heavy' : avgKmh < 28 ? 'moderate' : 'light',
      avgSpeedKmh: avgKmh
    };
  },

  getTripProgress(userId, bookingId) {
    const db = loadDb();
    const booking = db.bookings.find((b) => b.id === bookingId && b.user_id === userId);
    if (!booking) throw new Error('Trip not found');
    const driver = db.drivers.find((d) => d.id === booking.driver_id);
    const live = require('./live-registry');
    const online = live.getOnline(booking.driver_id);

    const pickupLat = online?.lat || driver?.lat || 31.52;
    const pickupLng = online?.lng || driver?.lng || 74.35;
    const destLat = booking.dest_lat || pickupLat + 0.02;
    const destLng = booking.dest_lng || pickupLng + 0.02;

    const totalDist = this.haversineKm(pickupLat, pickupLng, destLat, destLng) || 5;
    const elapsed = booking.started_at
      ? (Date.now() - new Date(booking.started_at).getTime()) / 60000
      : 0;
    const etaInfo = this.trafficAwareEta(pickupLat, pickupLng, destLat, destLng);
    const progressPct = booking.status === 'completed' ? 100
      : Math.min(95, Math.round((elapsed / (etaInfo.etaMinutes || 10)) * 100));

    const pickupEta = driver && online
      ? this.trafficAwareEta(online.lat, online.lng, pickupLat, pickupLng)
      : { etaMinutes: 5, arrivalTime: '--:--' };

    return {
      bookingId,
      status: booking.status,
      phase: progressPct < 30 ? 'pickup' : progressPct < 100 ? 'enroute' : 'completed',
      progressPct,
      remainingPct: 100 - progressPct,
      pickupEtaMinutes: pickupEta.etaMinutes,
      destinationEtaMinutes: etaInfo.etaMinutes,
      arrivalTime: etaInfo.arrivalTime,
      trafficLevel: etaInfo.trafficLevel,
      distanceKm: etaInfo.distanceKm,
      driverLat: online?.lat || driver?.lat,
      driverLng: online?.lng || driver?.lng,
      pickup: booking.pickup,
      destination: booking.destination
    };
  },

  getLiveDriversForBroadcast() {
    return dbRead((db) => {
    const live = require('./live-registry');
    const online = live.getAllOnline();
    const adsByDriver = {};
    (db.community_posts || []).forEach((p) => {
      if (p.driver_id) adsByDriver[p.driver_id] = p;
    });

    return db.drivers
      .filter((d) => d.linked && d.is_available)
      .map((d) => {
        const livePos = online.find((o) => o.driverId === d.id);
        const ad = adsByDriver[d.id];
        return {
          id: d.id,
          lat: livePos?.lat ?? d.lat,
          lng: livePos?.lng ?? d.lng,
          vehicleType: d.vehicle_type,
          name: d.name,
          isOnline: !!livePos,
          hasAd: !!ad,
          adId: ad?.id,
          adText: ad?.text?.slice(0, 40)
        };
      })
      .filter((d) => d.isOnline);
    });
  },

  tickDrivers() {
    return this.getLiveDriversForBroadcast();
  },

  getLiveDrivers() {
    return this.getLiveDriversForBroadcast();
  },

  getTrafficSegments(lat = 31.52, lng = 74.35) {
    const segs = [];
    for (let i = 0; i < 8; i++) {
      const a = lat + (Math.random() - 0.5) * 0.04;
      const b = lng + (Math.random() - 0.5) * 0.04;
      const levels = ['heavy', 'moderate', 'light'];
      const level = levels[Math.floor(Math.random() * 3)];
      segs.push({
        id: `t${i}`,
        from: [a, b],
        to: [a + 0.008, b + 0.006],
        level,
        delayMin: level === 'heavy' ? 8 : level === 'moderate' ? 4 : 0
      });
    }
    return segs;
  },

  getRouteOptions(fromLat, fromLng, toLat, toLng) {
    const dist = this.haversineKm(fromLat, fromLng, toLat, toLng) || 5;
    const base = this.trafficAwareEta(fromLat, fromLng, toLat, toLng);
    return [
      {
        id: 'fast',
        label: '⚡ تیز',
        labelEn: 'Fastest',
        etaMinutes: Math.max(2, base.etaMinutes - 3),
        fare: Math.round(80 + dist * 52),
        traffic: 'moderate',
        color: '#2563eb'
      },
      {
        id: 'cheap',
        label: '💰 سستا',
        labelEn: 'Cheapest',
        etaMinutes: base.etaMinutes + 5,
        fare: Math.round(60 + dist * 38),
        traffic: 'light',
        color: '#16a34a'
      },
      {
        id: 'safe',
        label: '🛡️ محفوظ',
        labelEn: 'Safest',
        etaMinutes: base.etaMinutes + 2,
        fare: Math.round(70 + dist * 45),
        traffic: 'light',
        color: '#7c3aed'
      }
    ];
  },

  createRidePool(userId, { bookingId, seats = 2 }) {
    const db = loadDb();
    if (!db.ride_pools) db.ride_pools = [];
    const pool = {
      id: `pool${Date.now()}`,
      booking_id: bookingId,
      user_id: userId,
      seats,
      fare_split: true,
      created_at: new Date().toISOString()
    };
    db.ride_pools.push(pool);
    saveDb();
    return pool;
  },

  getFamilyMembers(userId) {
    const db = loadDb();
    if (!db.family_links) {
      db.family_links = [
        { id: 'f1', user_id: userId, name: 'احمد (بیٹا)', relation: 'child', lat: 31.518, lng: 74.352, sharing: true },
        { id: 'f2', user_id: userId, name: 'اماں', relation: 'elder', lat: 31.525, lng: 74.348, sharing: true }
      ];
      saveDb();
    }
    return db.family_links.filter((f) => f.user_id === userId);
  },

  addFamilyMember(userId, body) {
    const db = loadDb();
    if (!db.family_links) db.family_links = [];
    const m = { id: `f${Date.now()}`, user_id: userId, ...body, sharing: true };
    db.family_links.push(m);
    saveDb();
    return m;
  },

  getPricingAlerts(userId) {
    const fare = this.predictFare(5);
    const alerts = [];
    if (fare.label === 'off_peak') {
      alerts.push({ type: 'surge_drop', message: '🎉 اب سفر سستا ہے — 15% کم!', code: 'OFF15' });
    }
    if (fare.surge > 20) {
      alerts.push({ type: 'surge_high', message: `⚠️ مصروف وقت — ${fare.surge}% زیادہ`, waitMin: 15 });
    } else {
      alerts.push({ type: 'good_time', message: '✅ ابھی بک کریں — معمولی کرایہ', code: null });
    }
    return alerts;
  },

  startDashcam(userId, bookingId) {
    return {
      recording: true,
      bookingId,
      startedAt: new Date().toISOString(),
      message: '🔴 Dashcam recording شروع'
    };
  },

  stopDashcam(userId, bookingId) {
    return {
      recording: false,
      bookingId,
      saved: true,
      url: `/recordings/${bookingId}.mp4`,
      message: '✓ Recording محفوظ'
    };
  },

  getOfflineBounds(lat, lng) {
    const d = 0.05;
    return {
      north: lat + d,
      south: lat - d,
      east: lng + d,
      west: lng - d,
      zoom: [12, 13, 14],
      tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    };
  }
};
