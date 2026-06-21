/**
 * P2P Feature Hub — Uber/Careem سے آگے
 */
const FeatureHub = {
  app: null,
  womenOnly: false,
  safeRide: false,
  activeBookingId: 'b1',

  init(app) {
    this.app = app;
    this.bindUI();
    RailHub.init();
    WSClient.connect((drivers) => this.onLiveDrivers(drivers));
    WSClient.on((type, data) => {
      if (type === 'user_location' && this.app?.mapEngine) {
        this.app.mapEngine.showLiveUser(data.userId || 'peer', data.lat, data.lng, 'Live');
      }
    });
    this.requestPush();
  },

  bindUI() {
    document.getElementById('BtnSOS')?.addEventListener('click', () => this.triggerSOS());
    document.getElementById('BtnChat')?.addEventListener('click', () => this.toggleChat());
    document.getElementById('BtnBid')?.addEventListener('click', () => this.openBid());
    document.getElementById('BtnWomenOnly')?.addEventListener('click', () => this.toggleWomenOnly());
    document.getElementById('BtnSafeRide')?.addEventListener('click', () => this.toggleSafeRide());
    document.getElementById('BtnShareTrip')?.addEventListener('click', () => this.shareTrip());
    document.getElementById('BtnCarbon')?.addEventListener('click', () => this.showCarbon());
    document.getElementById('ChatSend')?.addEventListener('click', () => this.sendChat());
    document.getElementById('BtnJazzCash')?.addEventListener('click', () => this.pay('jazzcash'));
    document.getElementById('BtnEasyPaisa')?.addEventListener('click', () => this.pay('easypaisa'));
    document.getElementById('BtnCargoEstimate')?.addEventListener('click', () => this.estimateCargo());
    document.getElementById('BtnAddStop')?.addEventListener('click', () => this.addStopField());
    document.getElementById('BtnFarePredict')?.addEventListener('click', () => this.showFarePredict());

    document.getElementById('ChatClose')?.addEventListener('click', () => {
      document.getElementById('ChatPanel')?.classList.add('hidden');
    });
  },

  onLiveDrivers(drivers) {
    if (!this.app?.mapEngine) return;
    this.app.mapEngine.updateLivePositions(drivers);
    drivers.forEach((live) => {
      const d = this.app.drivers.find((x) => x.id === live.id);
      if (d) {
        d.lat = live.lat;
        d.lng = live.lng;
        d.hasAd = live.hasAd;
      }
    });
  },

  async showFarePredict() {
    try {
      const data = await ApiClient.predictFare(5);
      this.app.showModal('AI کرایہ', `${data.tip}<br><strong>₨ ${data.low} — ₨ ${data.high}</strong><br>تخمینہ: ₨ ${data.predicted}`);
    } catch (e) {
      this.app.notify(e.message, 'error');
    }
  },

  async estimateCargo() {
    const desc = document.getElementById('CargoDescription')?.value || '';
    const weight = parseFloat(document.getElementById('CargoWeight')?.value) || 0;
    try {
      const est = await ApiClient.estimateCargo({ description: desc, weightKg: weight });
      document.getElementById('CargoResult').innerHTML =
        `<strong>${est.vehicle}</strong> · ~${est.estimatedWeightKg}kg · ₨ ${est.estimatedFare}`;
      document.getElementById('CargoResult').classList.remove('hidden');
    } catch (e) {
      this.app.notify(e.message, 'error');
    }
  },

  addStopField() {
    const box = document.getElementById('MultiStops');
    if (!box) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'search-input-group stop-input';
    input.placeholder = I18n.t('multiStop');
    input.style.cssText = 'width:100%;padding:10px;margin-top:6px;border-radius:8px;border:1px solid #e2e8f0';
    box.appendChild(input);
  },

  getStops() {
    return [...document.querySelectorAll('#MultiStops .stop-input')]
      .map((i) => i.value.trim()).filter(Boolean);
  },

  toggleWomenOnly() {
    this.womenOnly = !this.womenOnly;
    document.getElementById('BtnWomenOnly')?.classList.toggle('rail-menu-item--active', this.womenOnly);
    this.app.loadDrivers(this.app.currentModule === 'cargo' ? 'cargo' : 'all', { womenOnly: this.womenOnly });
    this.app.notify(this.womenOnly ? 'خواتین ڈرائیورز فلٹر' : 'تمام ڈرائیورز', 'info');
  },

  toggleSafeRide() {
    this.safeRide = !this.safeRide;
    document.getElementById('BtnSafeRide')?.classList.toggle('rail-menu-item--active', this.safeRide);
    this.app.notify(this.safeRide ? '🛡️ محفوظ سفر آن' : 'محفوظ سفر بند', 'success');
  },

  async triggerSOS() {
    const loc = this.app.userLocation || { lat: 31.52, lng: 74.35 };
    const data = await ApiClient.triggerSOS(loc);
    this.app.notify(data.message, 'error');
    PWAManager.haptic(200);
  },

  async shareTrip() {
    const data = await ApiClient.shareTrip(this.activeBookingId);
    if (navigator.share) {
      await navigator.share({ title: 'My Trip', url: data.link });
    } else {
      await navigator.clipboard?.writeText(data.link);
      this.app.notify('سفر لنک کاپی!', 'success');
    }
  },

  toggleChat() {
    document.getElementById('ChatPanel')?.classList.toggle('hidden');
    this.loadChat();
  },

  async loadChat() {
    const msgs = await ApiClient.getChat(this.activeBookingId);
    const box = document.getElementById('ChatMessages');
    if (!box) return;
    box.innerHTML = msgs.map((m) =>
      `<div class="chat-msg chat-msg--${m.sender}">${m.text}</div>`
    ).join('') || '<p class="empty-msg">پیغام بھیجیں</p>';
    box.scrollTop = box.scrollHeight;
  },

  async sendChat() {
    const input = document.getElementById('ChatInput');
    const text = input?.value.trim();
    if (!text) return;
    await ApiClient.sendChat(this.activeBookingId, text);
    input.value = '';
    this.loadChat();
  },

  openBid() {
    const driver = this.app.selectedDriver;
    if (!driver) { this.app.notify('ڈرائیور منتخب کریں', 'error'); return; }
    const amount = prompt(`بولی لگائیں (₨) — موجودہ: ${driver.fare}`, driver.fare - 30);
    if (amount) this.submitBid(driver.id, parseInt(amount, 10));
  },

  async submitBid(driverId, amount) {
    await ApiClient.createBid({ driverId, amount, bookingId: this.activeBookingId });
    this.app.notify(`بولی ₨ ${amount} بھیج دی`, 'success');
  },

  async pay(method) {
    const fare = this.app.selectedDriver?.fare || 350;
    const fn = method === 'jazzcash' ? ApiClient.payJazzCash : ApiClient.payEasyPaisa;
    const r = await fn(fare, this.activeBookingId);
    this.app.notify(`${method} ✓ ${r.reference}`, 'success');
  },

  async showCarbon() {
    const c = await ApiClient.getCarbonStats();
    this.app.showModal('🌱 CO₂ بچت', `آپ نے ${c.carbonSavedKg}kg CO₂ بچایا!<br>بیج: ${c.badge}`);
  },

  async loadFleetPanel(container) {
    const fleet = await ApiClient.getFleet();
    container.innerHTML = `
      <article class="content-panel">
        <h2>${I18n.t('fleet')} Dashboard</h2>
        <div class="booking-list">${fleet.map((f) => `
          <div class="booking-card booking-card--active">
            <strong>${f.vehicle}</strong> — ${f.driver}<br>
            <small>${f.status} · ${f.trips} trips</small>
          </div>`).join('')}</div>
      </article>`;
    container.classList.remove('hidden');
  },

  async requestPush() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      this.app.notify('Push notifications فعال', 'success');
      reg.showNotification?.('P2P Transport', { body: 'آپ کو سفر اپڈیٹس ملیں گے', icon: '/icons/icon.svg' });
    }
  },

  getBookingExtras() {
    return {
      stops: this.getStops(),
      safeRide: this.safeRide,
      scheduledAt: document.getElementById('ScheduledAt')?.value || null,
      recurring: document.getElementById('RecurringRide')?.checked ? 'weekly' : null
    };
  }
};
