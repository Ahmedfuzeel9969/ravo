/**
 * Trip Tracker — ETA, progress ring, traffic-aware (Google-style)
 */
const TripTracker = {
  app: null,
  activeBookingId: null,
  timer: null,

  init(app) {
    this.app = app;
    this.dom = {
      panel: document.getElementById('TripProgressPanel'),
      ring: document.getElementById('TripProgressRing'),
      bar: document.getElementById('TripProgressBar'),
      eta: document.getElementById('TripEtaText'),
      phase: document.getElementById('TripPhaseText')
    };
  },

  async start(bookingId) {
    if (this.timer) clearInterval(this.timer);
    this.activeBookingId = bookingId;
    this.dom.panel?.classList.remove('hidden');
    await this.tick();
    this.timer = setInterval(() => this.tick(), 5000);
  },

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.activeBookingId = null;
    this.dom.panel?.classList.add('hidden');
  },

  async tick() {
    if (!this.activeBookingId) return;
    try {
      const p = await ApiClient.getTripProgress(this.activeBookingId);
      this.render(p);
    } catch { /* ignore */ }
  },

  render(p) {
    Charts.progressArc(this.dom.ring, p.progressPct, p.destinationEtaMinutes, p.arrivalTime);

    if (this.dom.bar) {
      this.dom.bar.innerHTML = `
        <div class="trip-bar">
          <div class="trip-bar__done" style="width:${p.progressPct}%"></div>
          <div class="trip-bar__remain" style="width:${p.remainingPct}%"></div>
        </div>
        <div class="trip-bar__labels">
          <span class="trip-bar__green">✓ ${p.progressPct}% طے</span>
          <span class="trip-bar__red">${p.remainingPct}% باقی</span>
        </div>`;
    }

    if (this.dom.eta) {
      this.dom.eta.innerHTML = p.phase === 'pickup'
        ? `🚕 ${p.pickupEtaMinutes} منٹ میں گاڑی پہنچے گی`
        : `🏁 ${p.destinationEtaMinutes} منٹ میں منزل · ${p.arrivalTime}`;
    }

    if (this.dom.phase) {
      const traffic = { heavy: '🔴 بھاری', moderate: '🟡 درمیانہ', light: '🟢 ہلکا' };
      this.dom.phase.textContent = `ٹریفک: ${traffic[p.trafficLevel] || p.trafficLevel} · ${p.distanceKm}km`;
    }

    if (p.status === 'completed') this.stop();
  }
};
