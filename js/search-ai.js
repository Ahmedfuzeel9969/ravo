/**
 * Smart Search + Travel AI (front map bar only)
 */
const SearchAI = {
  app: null,
  debounceTimer: null,
  chatHistory: [],
  lastResults: [],
  voiceRec: null,

  init(app) {
    this.app = app;
    this.bindUI();
    this.renderCategories();
  },

  bindUI() {
    const smartInput = document.getElementById('SmartSearchInput');
    smartInput?.addEventListener('input', () => this.onSmartSearch());
    smartInput?.addEventListener('focus', () => this.onSmartSearch());

    document.getElementById('DestinationInput')?.addEventListener('input', (e) => {
      if (smartInput && !smartInput.value) smartInput.value = e.target.value;
      this.onSmartSearch();
    });

    document.getElementById('MapAiSend')?.addEventListener('click', () => this.sendAiMessage());
    document.getElementById('MapAiInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendAiMessage();
    });
    document.getElementById('MapAiInput')?.addEventListener('focus', () => {
      document.getElementById('MapAiPanel')?.classList.add('map-ai-panel--open');
    });
    document.getElementById('MapAiVoice')?.addEventListener('click', () => this.startVoiceInput());

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#SmartSearchWrap')) {
        document.getElementById('SmartSearchResults')?.classList.add('hidden');
      }
    });
  },

  startVoiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.app.notify('آواز اس براؤزر میں نہیں', 'error');
      return;
    }
    if (this.voiceRec) {
      this.voiceRec.stop();
      return;
    }
    this.voiceRec = new SR();
    this.voiceRec.lang = 'ur-PK';
    this.voiceRec.interimResults = false;
    this.voiceRec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      const input = document.getElementById('MapAiInput');
      if (input) input.value = text;
      this.sendAiMessage();
    };
    this.voiceRec.onend = () => { this.voiceRec = null; };
    this.voiceRec.start();
    this.app.notify('🎤 بولیں...', 'info');
  },

  async renderCategories() {
    const box = document.getElementById('PoiCategories');
    if (!box) return;
    try {
      const cats = await ApiClient.getSearchCategories();
      box.innerHTML = cats.filter((c) => c.id !== 'all').map((c) =>
        `<button type="button" class="poi-cat-btn" data-cat="${c.id}">${c.icon} ${c.label}</button>`
      ).join('');
      box.querySelectorAll('.poi-cat-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.searchCategory(btn.dataset.cat));
      });
    } catch { /* ignore */ }
  },

  async onSmartSearch() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      const q = document.getElementById('SmartSearchInput')?.value.trim()
        || document.getElementById('DestinationInput')?.value.trim() || '';
      if (q.length < 1) {
        document.getElementById('SmartSearchResults')?.classList.add('hidden');
        return;
      }
      await this.showResults(q);
    }, 280);
  },

  async showResults(q, category = 'all') {
    const list = document.getElementById('SmartSearchResults');
    if (!list) return;
    const loc = this.app.userLocation || { lat: 31.52, lng: 74.35 };
    list.innerHTML = '<div class="poi-loading">🔍 تلاش...</div>';
    list.classList.remove('hidden');

    try {
      const pois = await ApiClient.searchPOI({ q, lat: loc.lat, lng: loc.lng, category });
      if (!pois.length) {
        list.innerHTML = '<div class="poi-empty">کوئی نتیجہ نہیں</div>';
        return;
      }
      this.lastResults = pois;
      list.innerHTML = pois.map((p, i) => `
        <button type="button" class="poi-result" data-poi-idx="${i}">
          <span class="poi-result__icon">${p.icon || '📍'}</span>
          <span class="poi-result__body">
            <strong>${p.name}</strong>
            <small>${p.label || p.category} · ${p.distanceKm ?? '?'}km · ${p.address || ''}</small>
          </span>
        </button>
      `).join('');

      list.querySelectorAll('.poi-result').forEach((btn) => {
        btn.addEventListener('click', () => {
          const poi = this.lastResults[parseInt(btn.dataset.poiIdx, 10)];
          if (poi) this.selectPOI(poi, 'destination');
        });
      });

      this.app.mapEngine.showPOIs(pois);
    } catch {
      list.innerHTML = '<div class="poi-empty">تلاش fail</div>';
    }
  },

  async searchCategory(cat) {
    document.querySelectorAll('.poi-cat-btn').forEach((b) => {
      b.classList.toggle('poi-cat-btn--active', b.dataset.cat === cat);
    });
    await this.showResults('', cat);
  },

  selectPOI(poi, role = 'destination') {
    const input = role === 'pickup'
      ? document.getElementById('CurrentLocationInput')
      : document.getElementById('DestinationInput');
    const smart = document.getElementById('SmartSearchInput');
    if (input) {
      input.value = poi.name;
      if (role === 'pickup') input.readOnly = false;
    }
    if (smart) smart.value = poi.name;

    if (role === 'pickup') {
      InteractionUI.pickupLoc = { lat: poi.lat, lng: poi.lng, label: poi.name };
      this.app.mapEngine.setPickupPoint(poi.lat, poi.lng);
    } else {
      InteractionUI.destLoc = { lat: poi.lat, lng: poi.lng, label: poi.name };
      this.app.mapEngine.setDestinationPoint(poi.lat, poi.lng);
    }

    this.app.mapEngine.setView(poi.lat, poi.lng, 16);
    document.getElementById('SmartSearchResults')?.classList.add('hidden');
    this.app.updateRouteChip?.();

    const pickup = InteractionUI.getPickup();
    if (pickup && InteractionUI.destLoc) {
      this.app.mapEngine.drawRoute(pickup, InteractionUI.destLoc);
    }

    this.app.notify(`📍 ${poi.name} منتخب`, 'success');
  },

  async sendAiMessage() {
    const input = document.getElementById('MapAiInput');
    const msg = input?.value.trim();
    if (!msg) return;

    document.getElementById('MapAiPanel')?.classList.add('map-ai-panel--open');
    this.appendChat('user', msg);
    input.value = '';

    const loc = this.app.userLocation || { lat: 31.52, lng: 74.35 };
    const tripCtx = {
      pickup: InteractionUI.getPickup()?.label || InteractionUI.pickupLoc?.label,
      destination: InteractionUI.destLoc?.label || document.getElementById('DestinationInput')?.value
    };

    try {
      const res = await ApiClient.aiChat({
        message: msg,
        lat: loc.lat,
        lng: loc.lng,
        history: this.chatHistory,
        tripContext: tripCtx
      });

      if (res.offTopic) {
        this.appendChat('ai', res.reply);
        return;
      }

      this.appendChat('ai', res.reply);

      if (res.negotiation?.length) {
        res.negotiation.forEach((n) => this.appendChat('driver', n.reply));
      }

      this.executeActions(res.actions || []);
      this.chatHistory.push({ role: 'user', text: msg }, { role: 'ai', text: res.reply });
      if (this.chatHistory.length > 40) this.chatHistory = this.chatHistory.slice(-40);

      if (res.booking) {
        this.app.notify(`✅ بکنگ #${res.booking.id?.slice(-4)}`, 'success');
        TripTracker.start(res.booking.id);
      }
    } catch (e) {
      this.appendChat('ai', `❌ ${e.message}`);
    }
  },

  executeActions(actions) {
    actions.forEach((a) => {
      if (a.type === 'show_pois') this.app.mapEngine.showPOIs(a.pois);
      if (a.type === 'select_destination') this.selectPOI(a.poi, 'destination');
      if (a.type === 'select_pickup') this.selectPOI(a.poi, 'pickup');
      if (a.type === 'booking_done') {
        this.app.showModal('🤖 AI بکنگ', `${a.driver} — ₨${a.fare} پر طے`);
      }
    });
  },

  appendChat(role, text) {
    const box = document.getElementById('MapAiMessages');
    if (!box) return;
    const cls = role === 'user' ? 'ai-msg--user' : role === 'driver' ? 'ai-msg--driver' : 'ai-msg--ai';
    const icon = role === 'user' ? '👤' : role === 'driver' ? '🚕' : '🤖';
    box.innerHTML += `<div class="ai-msg ${cls}">${icon} ${text.replace(/\n/g, '<br>')}</div>`;
    box.scrollTop = box.scrollHeight;
  }
};
