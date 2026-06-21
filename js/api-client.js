/**
 * P2P Transport — API Client (Extended)
 */
const ApiClient = {
  get baseUrl() {
    return typeof EnvConfig !== 'undefined' ? EnvConfig.apiBaseUrl : '/api';
  },
  userId: localStorage.getItem('p2p_user_id') || 'user-1',
  userRole: localStorage.getItem('p2p_role') || 'passenger',

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-User-Id': this.userId,
      'X-User-Role': this.userRole,
      ...(options.headers || {})
    };

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (e) {
      throw new Error('Network error — انٹرنیٹ چیک کریں');
    }

    let json;
    try {
      json = await response.json();
    } catch {
      throw new Error(`Server error: ${response.status}`);
    }

    if (!response.ok || !json.success) {
      throw new Error(json.error || `API error: ${response.status}`);
    }

    return json.data;
  },

  getDrivers({ type, lat, lng, womenOnly, onlineOnly } = {}) {
    const params = new URLSearchParams();
    if (type && type !== 'all') params.set('type', type);
    if (lat != null) params.set('lat', lat);
    if (lng != null) params.set('lng', lng);
    if (womenOnly) params.set('womenOnly', 'true');
    if (onlineOnly !== false) params.set('onlineOnly', 'true');
    const qs = params.toString();
    return this.request(`/drivers${qs ? `?${qs}` : ''}`);
  },

  getDriver(id, lat, lng) {
    const params = new URLSearchParams();
    if (lat != null) params.set('lat', lat);
    if (lng != null) params.set('lng', lng);
    const qs = params.toString();
    return this.request(`/drivers/${id}${qs ? `?${qs}` : ''}`);
  },

  getBookings(status) {
    const qs = status ? `?status=${status}` : '';
    return this.request(`/bookings${qs}`);
  },

  getBookingStats() {
    return this.request('/bookings/stats');
  },

  createBooking(payload) {
    return this.request('/bookings', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateBooking(id, status) {
    return this.request(`/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  getWallet() { return this.request('/wallet'); },
  getFinanceStats() { return this.request('/wallet/stats'); },
  getTransactions() { return this.request('/wallet/transactions'); },
  payBooking(bookingId) {
    return this.request('/wallet/pay', { method: 'POST', body: JSON.stringify({ bookingId }) });
  },

  getHistoryStats() { return this.request('/history/stats'); },
  getProfile() { return this.request('/profile'); },
  healthCheck() { return this.request('/health'); },

  predictFare(distance) {
    return this.request(`/fare/predict?distance=${distance}`);
  },

  estimateCargo(body) {
    return this.request('/cargo/estimate', { method: 'POST', body: JSON.stringify(body) });
  },

  createBid(body) {
    return this.request('/bids', { method: 'POST', body: JSON.stringify(body) });
  },

  getBids(bookingId) {
    return this.request(`/bids/${bookingId}`);
  },

  sendChat(bookingId, text) {
    return this.request('/chat', { method: 'POST', body: JSON.stringify({ bookingId, text }) });
  },

  getChat(bookingId) {
    return this.request(`/chat/${bookingId}`);
  },

  getMaskedCall(driverId) {
    return this.request(`/call/${driverId}`);
  },

  payJazzCash(amount, bookingId) {
    return this.request('/payments/jazzcash', { method: 'POST', body: JSON.stringify({ amount, bookingId }) });
  },

  payEasyPaisa(amount, bookingId) {
    return this.request('/payments/easypaisa', { method: 'POST', body: JSON.stringify({ amount, bookingId }) });
  },

  getFleet() {
    return this.request('/fleet');
  },

  triggerSOS(location) {
    return this.request('/safety/sos', { method: 'POST', body: JSON.stringify({ location }) });
  },

  shareTrip(bookingId) {
    return this.request('/safety/share-trip', { method: 'POST', body: JSON.stringify({ bookingId }) });
  },

  getCarbonStats() {
    return this.request('/carbon');
  },

  getDriverKyc(driverId) {
    return this.request(`/kyc/${driverId}`);
  },

  getCommunityNearby(lat, lng, q, type) {
    const params = new URLSearchParams({ lat, lng });
    if (q) params.set('q', q);
    if (type && type !== 'all') params.set('type', type);
    return this.request(`/community/nearby?${params}`);
  },

  driverGoOnline(lat, lng, driverId) {
    return this.request('/roles/driver/go-online', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, driverId })
    });
  },

  driverGoOffline() {
    return this.request('/roles/driver/go-offline', { method: 'POST', body: JSON.stringify({}) });
  },

  driverUpdateLocation(lat, lng, heading, speed) {
    return this.request('/roles/driver/location', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, heading, speed })
    });
  },

  postDriverAd(body) {
    return this.request('/roles/driver/ad', { method: 'POST', body: JSON.stringify(body) });
  },

  getOwnerFleet() {
    return this.request('/roles/owner/fleet');
  },

  getAdminDashboard() {
    return this.request('/roles/admin/dashboard');
  },

  getTripProgress(bookingId) {
    return this.request(`/roles/trips/${bookingId}/progress`);
  },

  getTraffic(lat, lng) {
    return this.request(`/traffic?lat=${lat}&lng=${lng}`);
  },

  getRouteOptions(fromLat, fromLng, toLat, toLng) {
    return this.request(`/routes/options?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`);
  },

  createRidePool(body) {
    return this.request('/pool', { method: 'POST', body: JSON.stringify(body) });
  },

  getFamilyMembers() {
    return this.request('/family');
  },

  addFamilyMember(body) {
    return this.request('/family', { method: 'POST', body: JSON.stringify(body) });
  },

  getPricingAlerts() {
    return this.request('/pricing/alerts');
  },

  startDashcam(bookingId) {
    return this.request('/dashcam/start', { method: 'POST', body: JSON.stringify({ bookingId }) });
  },

  stopDashcam(bookingId) {
    return this.request('/dashcam/stop', { method: 'POST', body: JSON.stringify({ bookingId }) });
  },

  getOfflineBounds(lat, lng) {
    return this.request(`/offline/bounds?lat=${lat}&lng=${lng}`);
  },

  getSearchCategories() {
    return this.request('/search/categories');
  },

  searchPOI({ q, lat, lng, category, limit }) {
    const params = new URLSearchParams({ lat, lng });
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (limit) params.set('limit', limit);
    return this.request(`/search/poi?${params}`);
  },

  aiChat(body) {
    return this.request('/search/ai/chat', { method: 'POST', body: JSON.stringify(body) });
  },

  aiBook(body) {
    return this.request('/search/ai/book', { method: 'POST', body: JSON.stringify(body) });
  }
};
