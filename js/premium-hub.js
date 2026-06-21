/**
 * Premium Hub — Traffic, Voice, Offline, Pool, Family, Dashcam, Routes, Alerts
 */
const PremiumHub = {
  app: null,
  trafficOn: false,
  voiceNavOn: false,
  dashcamActive: false,
  alertTimer: null,
  selectedRoute: 'fast',

  init(app) {
    this.app = app;
    this.bindUI();
    this.startPricingAlerts();
    this.checkOffline();
  },

  bindUI() {
    document.getElementById('BtnTraffic')?.addEventListener('click', () => this.toggleTraffic());
    document.getElementById('BtnVoiceSearch')?.addEventListener('click', () => this.startVoiceSearch());
    document.getElementById('BtnVoiceNav')?.addEventListener('click', () => this.toggleVoiceNav());
    document.getElementById('BtnRouteAI')?.addEventListener('click', () => this.showRouteOptions());
    document.getElementById('BtnOfflineMap')?.addEventListener('click', () => this.cacheOfflineArea());
    document.getElementById('BtnFamily')?.addEventListener('click', () => this.showFamilyPanel());
    document.getElementById('BtnDashcam')?.addEventListener('click', () => this.toggleDashcam());
    document.getElementById('FamilyClose')?.addEventListener('click', () => this.hideFamilyPanel());
    document.getElementById('BtnAddFamily')?.addEventListener('click', () => this.addFamilyMember());
    document.getElementById('RouteOptionsClose')?.addEventListener('click', () => {
      document.getElementById('RouteOptionsPanel')?.classList.add('hidden');
    });
  },

  async toggleTraffic() {
    this.trafficOn = !this.trafficOn;
    document.getElementById('BtnTraffic')?.classList.toggle('rail-menu-item--active', this.trafficOn);
    if (!this.trafficOn) {
      this.app.mapEngine.clearTraffic();
      return;
    }
    const loc = this.app.userLocation || { lat: 31.52, lng: 74.35 };
    const segs = await ApiClient.getTraffic(loc.lat, loc.lng);
    this.app.mapEngine.showTraffic(segs);
    this.app.notify('🚦 Live traffic — سرخ=بھاری، پیلا=درمیانہ', 'info');
  },

  startVoiceSearch() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.app.notify('Voice اس browser میں نہیں', 'error');
      return;
    }
    const rec = new SR();
    rec.lang = I18n.lang === 'en' ? 'en-PK' : I18n.lang === 'pa' ? 'pa-PK' : 'ur-PK';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      const input = document.getElementById('DestinationInput');
      if (input) input.value = text;
      this.app.notify(`🎤 "${text}"`, 'success');
      this.app.handleSearch?.();
    };
    rec.onerror = () => this.app.notify('Voice نہیں سنا', 'error');
    rec.start();
    this.app.notify('🎤 بولیں — منزل کہیں', 'info');
  },

  toggleVoiceNav() {
    this.voiceNavOn = !this.voiceNavOn;
    document.getElementById('BtnVoiceNav')?.classList.toggle('rail-menu-item--active', this.voiceNavOn);
    const msg = I18n.lang === 'en'
      ? 'Voice navigation on'
      : I18n.lang === 'pa'
        ? 'آواز نیویگیشن آن'
        : 'آواز نیویگیشن آن';
    this.app.notify(this.voiceNavOn ? `🔊 ${msg}` : '🔇 بند', 'info');
  },

  speak(text) {
    if (!this.voiceNavOn || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = I18n.lang === 'en' ? 'en-US' : 'ur-PK';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  },

  onTripStart(pickup, destination, etaMin) {
    if (!this.voiceNavOn) return;
    const t = I18n.lang === 'en'
      ? `Trip started. Arriving in ${etaMin} minutes to ${destination}`
      : `سفر شروع۔ ${etaMin} منٹ میں ${destination} پہنچیں گے`;
    this.speak(t);
  },

  async showRouteOptions() {
    const panel = document.getElementById('RouteOptionsPanel');
    const list = document.getElementById('RouteOptionsList');
    if (!panel || !list) return;

    const from = InteractionUI.getPickup() || { lat: 31.52, lng: 74.35 };
    const to = InteractionUI.getDestination() || { lat: 31.54, lng: 74.37 };
    const routes = await ApiClient.getRouteOptions(from.lat, from.lng, to.lat, to.lng);

    list.innerHTML = routes.map((r) => `
      <button type="button" class="route-opt-card ${this.selectedRoute === r.id ? 'route-opt-card--active' : ''}" data-route="${r.id}" style="border-color:${r.color}">
        <strong>${r.label}</strong>
        <span>⏱ ${r.etaMinutes}m · ₨ ${r.fare}</span>
        <small>ٹریفک: ${r.traffic}</small>
      </button>
    `).join('');

    list.querySelectorAll('[data-route]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedRoute = btn.dataset.route;
        const r = routes.find((x) => x.id === this.selectedRoute);
        this.app.mapEngine.drawRouteOptions(from, to, r.color);
        this.app.notify(`${r.label} راستہ منتخب`, 'success');
        panel.classList.add('hidden');
      });
    });

    panel.classList.remove('hidden');
  },

  async cacheOfflineArea() {
    const loc = this.app.userLocation || { lat: 31.52, lng: 74.35 };
    await ApiClient.getOfflineBounds(loc.lat, loc.lng);
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'cache_tiles', lat: loc.lat, lng: loc.lng });
    }
    this.app.notify('📥 Offline maps — علاقہ cache ہو رہا ہے', 'success');
    document.getElementById('BtnOfflineMap')?.classList.add('rail-menu-item--active');
  },

  checkOffline() {
    window.addEventListener('offline', () => {
      document.getElementById('OfflineBanner')?.classList.remove('hidden');
      this.app.notify('آف لائن — cached maps استعمال', 'info');
    });
    window.addEventListener('online', () => {
      document.getElementById('OfflineBanner')?.classList.add('hidden');
    });
  },

  async showFamilyPanel() {
    const panel = document.getElementById('FamilyPanel');
    const list = document.getElementById('FamilyList');
    if (!panel || !list) return;

    const members = await ApiClient.getFamilyMembers();
    list.innerHTML = members.map((m) => `
      <div class="family-card">
        <span class="family-card__avatar">${m.relation === 'child' ? '👦' : '👵'}</span>
        <div>
          <strong>${m.name}</strong>
          <small>${m.sharing ? '🟢 Live' : '⚫'} · ${m.relation}</small>
        </div>
        <button type="button" class="btn-link" data-floc="${m.id}">📍</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-floc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = members.find((x) => x.id === btn.dataset.floc);
        if (m) {
          this.app.mapEngine.showLiveUser(m.id, m.lat, m.lng, m.name);
          this.app.mapEngine.setView(m.lat, m.lng, 15);
          panel.classList.add('hidden');
        }
      });
    });

    panel.classList.remove('hidden');
  },

  hideFamilyPanel() {
    document.getElementById('FamilyPanel')?.classList.add('hidden');
  },

  async addFamilyMember() {
    const name = document.getElementById('FamilyNameInput')?.value.trim();
    if (!name) return;
    await ApiClient.addFamilyMember({ name, relation: 'child', lat: 31.52, lng: 74.35 });
    this.showFamilyPanel();
    this.app.notify('خاندان شامل', 'success');
  },

  async toggleDashcam() {
    const bookingId = FeatureHub.activeBookingId || 'b1';
    if (!this.dashcamActive) {
      await ApiClient.startDashcam(bookingId);
      this.dashcamActive = true;
      document.getElementById('BtnDashcam')?.classList.add('rail-menu-item--active');
      document.getElementById('DashcamIndicator')?.classList.remove('hidden');
      this.app.notify('🔴 Dashcam recording', 'error');
    } else {
      await ApiClient.stopDashcam(bookingId);
      this.dashcamActive = false;
      document.getElementById('BtnDashcam')?.classList.remove('rail-menu-item--active');
      document.getElementById('DashcamIndicator')?.classList.add('hidden');
      this.app.notify('✓ Recording saved', 'success');
    }
  },

  startPricingAlerts() {
    this.pollAlerts();
    this.alertTimer = setInterval(() => this.pollAlerts(), 60000);
  },

  async pollAlerts() {
    try {
      const alerts = await ApiClient.getPricingAlerts();
      const box = document.getElementById('PricingAlertBar');
      if (!box || !alerts.length) return;
      const a = alerts[0];
      box.innerHTML = `<span>${a.message}</span>`;
      box.classList.remove('hidden');
      if (a.type === 'surge_drop' && Notification.permission === 'granted') {
        new Notification('P2P — سستا سفر!', { body: a.message, icon: '/icons/icon.svg' });
      }
    } catch { /* ignore */ }
  },

  getPoolOptions() {
    const pool = document.getElementById('RidePoolCheck')?.checked;
    const seats = parseInt(document.getElementById('PoolSeats')?.value, 10) || 2;
    return pool ? { ridePool: true, poolSeats: seats } : {};
  }
};
