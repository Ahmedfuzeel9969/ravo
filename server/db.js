const engine = require('./storage/engine');

const DEFAULT_DB = {
  meta: { version: 1, created_at: new Date().toISOString() },
  idempotency_keys: [],
  users: [
    { id: 'user-1', name: 'صارف', phone: '0300-1234567', rating: 4.9, member_since: '2024', role: 'passenger' }
  ],
  drivers: [
    { id: 'd1', name: 'احمد خان', rating: 4.9, vehicle: 'Suzuki WagonR', vehicle_type: 'ride', plate: 'LEB-1234', fare: 350, fare_type: 'طے شدہ', lat: 31.522, lng: 74.356, avatar_color: '#2563eb', is_available: 1, linked: 1, kyc_verified: 1, user_id: 'driver-user-d1' },
    { id: 'd2', name: 'عمر فاروق', rating: 4.7, vehicle: 'Toyota Hiace', vehicle_type: 'cargo', plate: 'LEB-5678', fare: 1200, fare_type: 'بولی', lat: 31.518, lng: 74.361, avatar_color: '#16a34a', is_available: 1, linked: 1, kyc_verified: 1, user_id: 'driver-user-d2' },
    { id: 'd3', name: 'بلال حسین', rating: 4.8, vehicle: 'Honda City', vehicle_type: 'ride', plate: 'LEB-9012', fare: 420, fare_type: 'طے شدہ', lat: 31.5245, lng: 74.354, avatar_color: '#7c3aed', is_available: 1, linked: 1, kyc_verified: 1, user_id: 'driver-user-d3' },
    { id: 'd4', name: 'زین العابدین', rating: 4.6, vehicle: 'Mazda Bongo', vehicle_type: 'cargo', plate: 'LEB-3456', fare: 800, fare_type: 'بولی', lat: 31.516, lng: 74.365, avatar_color: '#ea580c', is_available: 1, linked: 1, kyc_verified: 1, user_id: 'driver-user-d4' },
    { id: 'd5', name: 'حسن رضا', rating: 5.0, vehicle: 'Suzuki Cultus', vehicle_type: 'ride', plate: 'LEB-7890', fare: 280, fare_type: 'طے شدہ', lat: 31.521, lng: 74.359, avatar_color: '#0891b2', is_available: 1, linked: 1, kyc_verified: 1, user_id: 'driver-user-d5' }
  ],
  wallet: { 'user-1': { balance: 5200, pending: 0, monthly_total: 18900 } },
  bookings: [
    { id: 'b1', user_id: 'user-1', driver_id: 'd1', booking_type: 'ride', ride_type: 'instant', pickup: 'ماڈل ٹاؤن', destination: 'گلبرگ', fare: 350, status: 'active', created_at: '2026-06-20T10:00:00.000Z', scheduled_at: null },
    { id: 'b2', user_id: 'user-1', driver_id: 'd3', booking_type: 'ride', ride_type: 'scheduled', pickup: 'جوہر ٹاؤن', destination: 'الامہڑ اڈا', fare: 420, status: 'upcoming', created_at: '2026-06-19T10:00:00.000Z', scheduled_at: '2026-06-21T10:00:00.000Z' },
    { id: 'b3', user_id: 'user-1', driver_id: 'd2', booking_type: 'cargo', ride_type: 'small', pickup: 'Faisalabad Road', destination: 'DHA Phase 5', fare: 1200, status: 'completed', created_at: '2026-06-18T10:00:00.000Z', scheduled_at: null },
    { id: 'b4', user_id: 'user-1', driver_id: 'd5', booking_type: 'ride', ride_type: 'instant', pickup: 'Liberty', destination: 'Anarkali', fare: 280, status: 'completed', created_at: '2026-06-17T10:00:00.000Z', scheduled_at: null },
    { id: 'b5', user_id: 'user-1', driver_id: 'd4', booking_type: 'cargo', ride_type: 'office', pickup: 'Industrial Area', destination: 'Gulshan Ravi', fare: 800, status: 'cancelled', created_at: '2026-06-16T10:00:00.000Z', scheduled_at: null }
  ],
  transactions: [
    { id: 't1', user_id: 'user-1', booking_id: 'b3', amount: 1200, type: 'payment', status: 'completed', description: 'سامان ڈیلیوری — عمر فاروق', created_at: '2026-06-18T11:00:00.000Z' },
    { id: 't2', user_id: 'user-1', booking_id: 'b4', amount: 280, type: 'payment', status: 'completed', description: 'سفر — حسن رضا', created_at: '2026-06-17T11:00:00.000Z' },
    { id: 't3', user_id: 'user-1', booking_id: 'b1', amount: 350, type: 'payment', status: 'pending', description: 'فعال سفر — احمد خان', created_at: '2026-06-20T10:30:00.000Z' },
    { id: 't4', user_id: 'user-1', booking_id: null, amount: 5000, type: 'topup', status: 'completed', description: 'والیٹ ٹاپ اپ — JazzCash', created_at: '2026-06-15T10:00:00.000Z' }
  ]
};

async function initDatabase() {
  await engine.initAsync(DEFAULT_DB);
  await engine.hydrateAsync(DEFAULT_DB);

  engine.mutate((db) => {
    db.bookings
      .filter((b) => ['active', 'upcoming'].includes(b.status))
      .forEach((b) => {
        const d = db.drivers.find((x) => x.id === b.driver_id);
        if (d) {
          d.is_available = 0;
          d.active_booking_id = b.id;
        }
      });
    if (!db.idempotency_keys) db.idempotency_keys = [];
  });

  const { ensureFeatureSchema } = require('./features-store');
  ensureFeatureSchema();
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateEta(distanceKm) {
  return Math.max(2, Math.round(distanceKm * 3));
}

function formatDriver(row, userLat, userLng) {
  let distance = null;
  let eta = null;
  if (userLat != null && userLng != null) {
    distance = Math.round(haversineKm(userLat, userLng, row.lat, row.lng) * 10) / 10;
    eta = estimateEta(distance);
  }
  return {
    id: row.id,
    name: row.name,
    rating: row.rating,
    vehicle: row.vehicle,
    vehicleType: row.vehicle_type,
    plate: row.plate,
    fare: row.fare,
    fareType: row.fare_type,
    lat: row.lat,
    lng: row.lng,
    avatarColor: row.avatar_color,
    isAvailable: !!row.is_available,
    linked: !!row.linked,
    kycVerified: !!row.kyc_verified,
    cnicMasked: row.cnic_masked || '',
    womenOnly: !!row.women_only,
    gender: row.gender || 'male',
    carbonSavedKg: row.carbon_saved_kg || 0,
    distance,
    eta
  };
}

function enrichDriver(driver, db) {
  const live = require('./live-registry');
  const ad = (db.community_posts || []).find((p) => p.driver_id === driver.id);
  return {
    ...driver,
    isOnline: live.isOnline(driver.id),
    hasAd: !!ad,
    adId: ad?.id,
    adText: ad?.text,
    adFrom: ad?.from,
    adTo: ad?.to
  };
}

function formatBooking(b, db) {
  const driver = db.drivers.find((d) => d.id === b.driver_id);
  return {
    id: b.id,
    userId: b.user_id,
    driverId: b.driver_id,
    driverName: driver?.name,
    vehicle: driver?.vehicle,
    avatarColor: driver?.avatar_color,
    bookingType: b.booking_type,
    rideType: b.ride_type,
    pickup: b.pickup,
    destination: b.destination,
    fare: b.fare,
    status: b.status,
    createdAt: b.created_at,
    scheduledAt: b.scheduled_at
  };
}

function ensureWallet(db, userId) {
  if (!db.wallet[userId]) db.wallet[userId] = { balance: 0, pending: 0, monthly_total: 0 };
  return db.wallet[userId];
}

function recalcPending(db, userId) {
  const wallet = ensureWallet(db, userId);
  wallet.pending = db.transactions
    .filter((t) => t.user_id === userId && t.type === 'payment' && t.status === 'pending')
    .reduce((s, t) => s + t.amount, 0);
}

function driverHasActiveBooking(db, driverId, excludeId = null) {
  return db.bookings.some(
    (b) => b.driver_id === driverId && b.id !== excludeId && ['active', 'upcoming'].includes(b.status)
  );
}

function releaseDriver(db, driverId) {
  const d = db.drivers.find((x) => x.id === driverId);
  if (d && !driverHasActiveBooking(db, driverId)) {
    d.is_available = 1;
    d.active_booking_id = null;
  }
}

function lockDriver(db, driverId, bookingId) {
  const d = db.drivers.find((x) => x.id === driverId);
  if (!d) throw new Error('Driver not found');
  if (!d.is_available || driverHasActiveBooking(db, driverId)) {
    throw new Error('Driver not available');
  }
  d.is_available = 0;
  d.active_booking_id = bookingId;
}

module.exports = {
  initDatabase,
  haversineKm,
  formatDriver,
  engine,

  getDrivers({ type, lat, lng, womenOnly, onlineOnly, limit = 50, offset = 0 } = {}) {
    return engine.readFn((db) => {
      const live = require('./live-registry');
      let rows = db.drivers.filter((d) => d.linked);

      if (onlineOnly === true || onlineOnly === 'true') {
        rows = rows.filter((d) => live.isOnline(d.id));
      } else {
        rows = rows.filter((d) => d.is_available || live.isOnline(d.id));
      }

      if (type && type !== 'all') rows = rows.filter((d) => d.vehicle_type === type);
      if (womenOnly === true || womenOnly === 'true') {
        rows = rows.filter((d) => d.women_only || d.gender === 'female');
      }

      const userLat = lat != null ? parseFloat(lat) : null;
      const userLng = lng != null ? parseFloat(lng) : null;
      let drivers = rows.map((r) => {
        const online = live.getOnline(r.id);
        const formatted = formatDriver(
          online ? { ...r, lat: online.lat, lng: online.lng } : r,
          userLat,
          userLng
        );
        return enrichDriver(formatted, db);
      });

      if (userLat != null && userLng != null) {
        drivers.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
      }

      const total = drivers.length;
      drivers = drivers.slice(offset, offset + Math.min(limit, 100));
      return { drivers, total, limit, offset };
    });
  },

  getDriverById(id, lat, lng) {
    return engine.readFn((db) => {
      const row = db.drivers.find((d) => d.id === id);
      if (!row) return null;
      return formatDriver(row, lat != null ? parseFloat(lat) : null, lng != null ? parseFloat(lng) : null);
    });
  },

  getBookings(userId, status, { limit = 30, offset = 0 } = {}) {
    return engine.readFn((db) => {
      let bookings = db.bookings.filter((b) => b.user_id === userId);
      if (status) bookings = bookings.filter((b) => b.status === status);
      bookings = bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const total = bookings.length;
      return {
        items: bookings.slice(offset, offset + Math.min(limit, 100)).map((b) => formatBooking(b, db)),
        total,
        limit,
        offset
      };
    });
  },

  getBookingById(userId, bookingId) {
    return engine.readFn((db) => {
      const b = db.bookings.find((x) => x.id === bookingId && x.user_id === userId);
      return b ? formatBooking(b, db) : null;
    });
  },

  getBookingStats(userId) {
    return engine.readFn((db) => {
      const stats = { active: 0, upcoming: 0, completed: 0, cancelled: 0, total: 0 };
      db.bookings.filter((b) => b.user_id === userId).forEach((b) => {
        stats[b.status] = (stats[b.status] || 0) + 1;
        stats.total += 1;
      });
      return stats;
    });
  },

  getGlobalTripInsights() {
    return engine.readFn((db) => {
      const now = Date.now();
      if (!global.__p2pInsightsCache || now - global.__p2pInsightsCache.ts > 60000) {
        const completed = db.bookings.filter((b) => b.status === 'completed');
        const routes = {};
        completed.forEach((b) => {
          const key = `${b.pickup}→${b.destination}`;
          if (!routes[key]) routes[key] = { pickup: b.pickup, destination: b.destination, count: 0, fares: [] };
          routes[key].count += 1;
          routes[key].fares.push(b.fare);
        });
        global.__p2pInsightsCache = {
          ts: now,
          data: {
            totalCompletedTrips: completed.length,
            avgFareAll: completed.length
              ? Math.round(completed.reduce((s, b) => s + b.fare, 0) / completed.length)
              : 0,
            popularRoutes: Object.values(routes)
              .map((r) => ({
                ...r,
                avgFare: Math.round(r.fares.reduce((a, c) => a + c, 0) / r.fares.length)
              }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 8),
            activeTripsNow: db.bookings.filter((b) => b.status === 'active').length
          }
        };
      }
      return global.__p2pInsightsCache.data;
    });
  },

  getUserTravelProfile(userId) {
    const { items: trips } = this.getBookings(userId, null, { limit: 20 });
    const active = trips.find((b) => b.status === 'active');
    const recent = trips.slice(0, 6);
    const stats = this.getBookingStats(userId);
    const routes = {};
    trips.filter((b) => b.status === 'completed').forEach((b) => {
      const key = `${b.pickup}→${b.destination}`;
      routes[key] = (routes[key] || 0) + 1;
    });
    const frequentRoute = Object.entries(routes).sort((a, b) => b[1] - a[1])[0];
    return { active, recent, stats, frequentRoute: frequentRoute ? frequentRoute[0] : null };
  },

  createBooking({
    userId, driverId, bookingType, rideType, pickup, destination, fare,
    scheduledAt, stops, recurring, safeRide, idempotencyKey
  }) {
    return engine.mutate((db) => {
      if (idempotencyKey) {
        const existing = db.idempotency_keys.find(
          (k) => k.key === idempotencyKey && k.user_id === userId
        );
        if (existing) {
          const b = db.bookings.find((x) => x.id === existing.booking_id);
          if (b) return formatBooking(b, db);
        }
      }

      const driver = db.drivers.find((d) => d.id === driverId);
      if (!driver || !driver.linked) throw new Error('Driver not found');
      if (!driver.is_available || driverHasActiveBooking(db, driverId)) {
        throw new Error('Driver not available');
      }

      const id = engine.newId('b');
      const status = scheduledAt ? 'upcoming' : 'active';
      const bookingFare = fare || driver.fare;

      const booking = {
        id,
        user_id: userId,
        driver_id: driverId,
        booking_type: bookingType || 'ride',
        ride_type: rideType || 'instant',
        pickup: pickup || 'موجودہ مقام',
        destination: destination || '',
        stops: stops || [],
        recurring: recurring || null,
        safe_ride: !!safeRide,
        fare: bookingFare,
        status,
        created_at: new Date().toISOString(),
        scheduled_at: scheduledAt || null,
        started_at: status === 'active' ? new Date().toISOString() : null
      };

      lockDriver(db, driverId, id);
      db.bookings.push(booking);

      db.transactions.push({
        id: engine.newId('t'),
        user_id: userId,
        booking_id: id,
        amount: bookingFare,
        type: 'payment',
        status: 'pending',
        description: `بکنگ — ${driver.name}`,
        created_at: new Date().toISOString()
      });

      if (idempotencyKey) {
        db.idempotency_keys.push({
          key: idempotencyKey,
          user_id: userId,
          booking_id: id,
          created_at: new Date().toISOString()
        });
        if (db.idempotency_keys.length > 50000) {
          db.idempotency_keys = db.idempotency_keys.slice(-40000);
        }
      }

      recalcPending(db, userId);
      return formatBooking(booking, db);
    });
  },

  updateBookingStatus(userId, bookingId, status) {
    return engine.mutate((db) => {
      const booking = db.bookings.find((b) => b.id === bookingId && b.user_id === userId);
      if (!booking) throw new Error('Booking not found');

      const tx = db.transactions.find((t) => t.booking_id === bookingId && t.type === 'payment');
      const wallet = ensureWallet(db, userId);

      if (status === 'completed') {
        if (tx && tx.status === 'pending') {
          if (wallet.balance < booking.fare) throw new Error('Insufficient balance — پہلے ادائیگی کریں');
          wallet.balance -= booking.fare;
          tx.status = 'completed';
          wallet.monthly_total += booking.fare;
        }
        booking.completed_at = new Date().toISOString();
        releaseDriver(db, booking.driver_id);
      }

      if (status === 'cancelled') {
        if (tx && tx.status === 'pending') tx.status = 'cancelled';
        releaseDriver(db, booking.driver_id);
      }

      booking.status = status;
      recalcPending(db, userId);
      return formatBooking(booking, db);
    });
  },

  getWallet(userId) {
    return engine.readFn((db) => {
      recalcPending(db, userId);
      const wallet = db.wallet[userId];
      if (!wallet) return { balance: 0, pending: 0, monthlyTotal: 0 };
      return { balance: wallet.balance, pending: wallet.pending, monthlyTotal: wallet.monthly_total };
    });
  },

  getTransactions(userId, { limit = 50, offset = 0 } = {}) {
    return engine.readFn((db) => {
      const all = db.transactions
        .filter((t) => t.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const total = all.length;
      const items = all.slice(offset, offset + Math.min(limit, 100)).map((t) => ({
        id: t.id,
        bookingId: t.booking_id,
        amount: t.amount,
        type: t.type,
        status: t.status,
        description: t.description,
        createdAt: t.created_at
      }));
      return { items, total, limit, offset };
    });
  },

  getFinanceStats(userId) {
    return engine.readFn((db) => {
      recalcPending(db, userId);
      const wallet = db.wallet[userId] || { balance: 0, pending: 0, monthly_total: 0 };
      const completed = db.bookings.filter((b) => b.user_id === userId && b.status === 'completed');
      return {
        balance: wallet.balance,
        pending: wallet.pending,
        monthlyTotal: wallet.monthly_total,
        totalTrips: completed.length,
        totalSpent: completed.reduce((sum, b) => sum + b.fare, 0)
      };
    });
  },

  getHistoryStats(userId) {
    return engine.readFn((db) => {
      const stats = { active: 0, upcoming: 0, completed: 0, cancelled: 0, total: 0 };
      db.bookings.filter((b) => b.user_id === userId).forEach((b) => {
        stats[b.status] = (stats[b.status] || 0) + 1;
        stats.total += 1;
      });
      const totalSpent = db.bookings
        .filter((b) => b.user_id === userId && b.status === 'completed')
        .reduce((sum, b) => sum + b.fare, 0);
      const user = db.users.find((u) => u.id === userId);
      return {
        totalTrips: stats.completed,
        totalSpent,
        avgRating: user?.rating ?? 4.9,
        cancelled: stats.cancelled
      };
    });
  },

  getProfile(userId) {
    return engine.readFn((db) => {
      const user = db.users.find((u) => u.id === userId);
      let completed = 0;
      let active = 0;
      let total = 0;
      db.bookings.filter((b) => b.user_id === userId).forEach((b) => {
        if (b.status === 'completed') completed += 1;
        if (b.status === 'active') active += 1;
        total += 1;
      });
      return {
        name: user?.name,
        phone: user?.phone,
        rating: user?.rating,
        memberSince: user?.member_since,
        totalTrips: completed + active,
        totalBookings: total
      };
    });
  },

  processPayment(userId, bookingId, idempotencyKey) {
    return engine.mutate((db) => {
      if (idempotencyKey) {
        const dup = db.idempotency_keys.find((k) => k.key === idempotencyKey && k.user_id === userId);
        if (dup?.payment_result) return dup.payment_result;
      }

      const booking = db.bookings.find((b) => b.id === bookingId && b.user_id === userId);
      if (!booking) throw new Error('Booking not found');
      if (!['active', 'upcoming'].includes(booking.status)) {
        throw new Error('Booking cannot be paid');
      }

      const wallet = ensureWallet(db, userId);
      const tx = db.transactions.find((t) => t.booking_id === bookingId && t.type === 'payment');
      if (tx?.status === 'completed') {
        return {
          success: true,
          paid: booking.fare,
          wallet: { balance: wallet.balance, pending: wallet.pending, monthlyTotal: wallet.monthly_total },
          duplicate: true
        };
      }
      if (wallet.balance < booking.fare) throw new Error('Insufficient balance');

      wallet.balance -= booking.fare;
      if (tx) tx.status = 'completed';
      recalcPending(db, userId);

      const result = {
        success: true,
        paid: booking.fare,
        wallet: { balance: wallet.balance, pending: wallet.pending, monthlyTotal: wallet.monthly_total }
      };

      if (idempotencyKey) {
        db.idempotency_keys.push({
          key: idempotencyKey,
          user_id: userId,
          booking_id: bookingId,
          payment_result: result,
          created_at: new Date().toISOString()
        });
      }
      return result;
    });
  }
};
