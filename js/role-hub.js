/**
 * Role Hub — Passenger | Driver | Owner | Super Admin
 */
const RoleHub = {
  app: null,
  role: localStorage.getItem('p2p_role') || 'passenger',
  driverWatchId: null,

  init(app) {
    this.app = app;
    this.bindUI();
    this.applyRole();
  },

  bindUI() {
    document.getElementById('RoleSelect')?.addEventListener('change', (e) => {
      this.setRole(e.target.value);
    });
    document.getElementById('DriverGoOnline')?.addEventListener('click', () => this.goOnline());
    document.getElementById('DriverGoOffline')?.addEventListener('click', () => this.goOffline());
    document.getElementById('DriverPostAd')?.addEventListener('click', () => this.postAd());
    document.getElementById('DriverPageBack')?.addEventListener('click', () => InteractionUI.showPage('map'));
  },

  setRole(role) {
    this.role = role;
    localStorage.setItem('p2p_role', role);
    ApiClient.userRole = role;
    if (role === 'superadmin') ApiClient.userId = 'admin-1';
    else if (role === 'driver') ApiClient.userId = 'driver-user-d1';
    else if (role === 'owner') ApiClient.userId = 'owner-1';
    else ApiClient.userId = 'user-1';
    this.applyRole();
    this.app.notify(`رول: ${this.roleLabel(role)}`, 'info');
  },

  roleLabel(r) {
    return { passenger: 'مسافر', driver: 'ڈرائیور', owner: 'مالک', superadmin: 'Super Admin' }[r] || r;
  },

  applyRole() {
    const sel = document.getElementById('RoleSelect');
    if (sel) sel.value = this.role;
    document.body.dataset.role = this.role;
  },

  async goOnline() {
    try {
      const loc = await this.app.mapEngine.locateUser();
      await ApiClient.driverGoOnline(loc.lat, loc.lng);
      WSClient.sendDriverOnline('d1', loc.lat, loc.lng);
      this.startLocationStream();
      document.getElementById('DriverStatus')?.classList.add('driver-status--online');
      document.getElementById('DriverStatusText').textContent = '🟢 Online — لوکیشن شیئر';
      this.app.notify('آپ آن لائن — گاڑی نقشے پر', 'success');
      await this.app.loadDrivers('all');
    } catch (e) {
      this.app.notify(e.message || 'Online نہیں ہو سکے', 'error');
    }
  },

  async goOffline() {
    await ApiClient.driverGoOffline();
    WSClient.sendDriverOffline('d1');
    this.stopLocationStream();
    document.getElementById('DriverStatus')?.classList.remove('driver-status--online');
    document.getElementById('DriverStatusText').textContent = '⚫ Offline';
    this.app.notify('Offline', 'info');
  },

  startLocationStream() {
    if (!navigator.geolocation) return;
    this.driverWatchId = navigator.geolocation.watchPosition((pos) => {
      const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
      WSClient.sendDriverLocation('d1', lat, lng, heading, speed);
      ApiClient.driverUpdateLocation(lat, lng, heading, speed);
    }, () => {}, { enableHighAccuracy: true });
  },

  stopLocationStream() {
    if (this.driverWatchId) navigator.geolocation.clearWatch(this.driverWatchId);
  },

  async postAd() {
    const text = document.getElementById('DriverAdText')?.value.trim();
    const from = document.getElementById('DriverAdFrom')?.value.trim();
    const to = document.getElementById('DriverAdTo')?.value.trim();
    if (!text) { this.app.notify('اشتہار لکھیں', 'error'); return; }
    await ApiClient.postDriverAd({ text, from, to, type: 'ride' });
    this.app.notify('📢 اشتہار شائع — گاڑی پر badge', 'success');
  },

  async loadOwnerFleet(container) {
    const fleet = await ApiClient.getOwnerFleet();
    container.innerHTML = fleet.map((f) => `
      <div class="fleet-live-card ${f.isOnline ? 'fleet-live-card--on' : ''}">
        <div class="fleet-live-card__head">
          <strong>${f.vehicle}</strong>
          <span>${f.isOnline ? '🟢 Live' : '⚫ Offline'}</span>
        </div>
        <p>${f.driver} · ${f.plate}</p>
        <div class="mini-map-placeholder">📍 ${f.lat?.toFixed(4)}, ${f.lng?.toFixed(4)}</div>
        <button type="button" class="community-card__btn" data-track="${f.id}">لوکیشن دیکھیں</button>
      </div>
    `).join('') || '<p class="empty-msg">کوئی گاڑی نہیں</p>';

    container.querySelectorAll('[data-track]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = fleet.find((x) => x.id === btn.dataset.track);
        if (f) {
          InteractionUI.showPage('map');
          this.app.mapEngine.setView(f.lat, f.lng, 16);
        }
      });
    });
  }
};
