/**
 * Interaction UI — collapse panels, map location pick, swipe community
 */
const InteractionUI = {
  app: null,
  searchState: 'hidden', // hidden | expanded | mini
  bottomState: 'expanded', // expanded | mini | hidden
  pickMode: null, // null | 'pickup' | 'destination'
  pickupLoc: null,
  destLoc: null,
  touchStartX: 0,
  touchStartY: 0,
  swiping: false,
  touchOnMap: false,
  topDockCollapsed: false,
  bottomDockCollapsed: false,
  mapLocked: false,

  init(app) {
    this.app = app;
    this.cacheDom();
    this.bindEvents();
    this.dom.appLayout?.setAttribute('data-swipe-page', 'map');
    this.loadCommunityAds();
  },

  cacheDom() {
    this.dom = {
      swipeTrack: document.getElementById('SwipeTrack'),
      swipeViewport: document.getElementById('SwipeViewport'),
      communityList: document.getElementById('CommunityList'),
      searchSheet: document.getElementById('SearchSheet'),
      searchSideTab: document.getElementById('SearchSideTab'),
      bottomPanel: document.getElementById('BottomPanel'),
      bottomSideTab: document.getElementById('BottomSideTab'),
      pickHint: document.getElementById('PickHint'),
      mapContainer: document.getElementById('MapContainer'),
      appLayout: document.getElementById('AppContainer'),
      mapFocusBtn: document.getElementById('MapFocusBtn'),
      btnUseGPS: document.getElementById('BtnUseGPS'),
      btnPickPickup: document.getElementById('BtnPickPickupMap'),
      btnPickDest: document.getElementById('BtnPickDestMap'),
      btnLocModeGPS: document.getElementById('BtnLocModeGPS'),
      btnLocModeManual: document.getElementById('BtnLocModeManual'),
      pickupInput: document.getElementById('CurrentLocationInput'),
      destInput: document.getElementById('DestinationInput'),
      communityBack: document.getElementById('CommunityBack'),
      adSearch: document.getElementById('AdSearchInput'),
      adFilter: document.getElementById('AdFilterSelect'),
      pageNav: document.getElementById('PageNav'),
      topMapDock: document.getElementById('TopMapDock'),
      topDockTab: document.getElementById('TopDockTab')
    };
  },

  bindEvents() {
    document.getElementById('TopDockToggle')?.addEventListener('click', () => this.toggleTopDock());
    this.dom.topDockTab?.addEventListener('click', () => this.toggleTopDock(false));
    document.getElementById('BottomDockToggle')?.addEventListener('click', () => this.toggleBottomDock());
    document.getElementById('SearchMinimize')?.addEventListener('click', () => this.toggleTopDock(true));
    this.dom.searchSideTab?.addEventListener('click', () => this.expandSearch());
    document.getElementById('BottomMinimize')?.addEventListener('click', () => this.toggleBottomDock(true));
    document.getElementById('BottomHide')?.addEventListener('click', () => this.toggleBottomDock(true));
    this.dom.bottomSideTab?.addEventListener('click', () => this.toggleBottomDock(false));
    this.dom.mapFocusBtn?.addEventListener('click', () => this.toggleMapClean());

    document.getElementById('BtnMapLock')?.addEventListener('click', () => this.toggleMapLock());

    this.dom.btnUseGPS?.addEventListener('click', () => this.useGPSPickup());
    this.dom.btnPickPickup?.addEventListener('click', () => this.startMapPick('pickup'));
    this.dom.btnPickDest?.addEventListener('click', () => this.startMapPick('destination'));

    this.dom.btnLocModeGPS?.addEventListener('click', () => this.setLocMode('gps'));
    this.dom.btnLocModeManual?.addEventListener('click', () => this.setLocMode('manual'));

    this.dom.communityBack?.addEventListener('click', () => this.showPage('map'));
    this.dom.adSearch?.addEventListener('input', () => this.loadCommunityAds());
    this.dom.adFilter?.addEventListener('change', () => this.loadCommunityAds());

    document.querySelectorAll('[data-goto-page]').forEach((btn) => {
      btn.addEventListener('click', () => this.showPage(btn.dataset.gotoPage));
    });

    const vp = this.dom.swipeViewport;
    if (vp) {
      vp.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
      vp.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: true });
      vp.addEventListener('touchend', (e) => this.onTouchEnd(e));
    }
  },

  toggleTopDock(forceCollapse) {
    this.topDockCollapsed = forceCollapse ?? !this.topDockCollapsed;
    this.dom.topMapDock?.classList.toggle('map-ui-dock--collapsed', this.topDockCollapsed);
    const btn = document.getElementById('TopDockToggle');
    if (btn) {
      btn.textContent = this.topDockCollapsed ? '🔼' : '🔽';
      btn.classList.toggle('rail-menu-item--active', this.topDockCollapsed);
    }
    if (this.topDockCollapsed) this.minimizeSearch();
    else if (this.searchState === 'mini') this.expandSearch();
    this.app.mapEngine?.invalidateSize();
  },

  toggleBottomDock(forceCollapse) {
    this.bottomDockCollapsed = forceCollapse ?? !this.bottomDockCollapsed;
    this.dom.bottomPanel?.classList.toggle('bottom-panel--collapsed', this.bottomDockCollapsed);
    const btn = document.getElementById('BottomDockToggle');
    if (btn) {
      btn.textContent = this.bottomDockCollapsed ? '🔽' : '🔼';
      btn.classList.toggle('rail-menu-item--active', this.bottomDockCollapsed);
    }
    if (this.bottomDockCollapsed) {
      this.app.dom.vehicleZone?.classList.add('vehicle-zone--collapsed');
    } else {
      this.app.dom.vehicleZone?.classList.remove('vehicle-zone--collapsed');
      this.bottomState = 'expanded';
    }
    this.app.mapEngine?.invalidateSize();
  },

  toggleMapLock() {
    this.mapLocked = !this.mapLocked;
    this.app.mapEngine?.setMapLocked(this.mapLocked);
    const btn = document.getElementById('BtnMapLock');
    if (btn) {
      btn.textContent = this.mapLocked ? '🔒' : '🔓';
      btn.title = this.mapLocked ? 'لاک کھولیں — نقشہ موو کریں' : 'میری جگہ لاک';
      btn.classList.toggle('btn-tool--locked', this.mapLocked);
    }
    if (this.mapLocked && this.app.userLocation) {
      this.app.mapEngine.lockToUser(this.app.userLocation.lat, this.app.userLocation.lng);
    }
    this.app.notify(this.mapLocked ? '🔒 نقشہ آپ کی جگہ پر لاک — zoom ہو سکتا ہے' : '🔓 نقشہ موو — اوپر نیچے گھسیٹیں', 'info');
  },

  /* ── Search panel states ── */
  minimizeSearch() {
    this.searchState = 'mini';
    this.dom.searchSheet?.classList.add('search-sheet--mini');
    this.dom.searchSheet?.classList.add('hidden');
    this.dom.searchSideTab?.classList.remove('hidden');
    this.app.updateRouteChip();
  },

  expandSearch() {
    this.searchState = 'expanded';
    this.dom.searchSheet?.classList.remove('search-sheet--mini', 'hidden');
    this.dom.searchSideTab?.classList.add('hidden');
    this.dom.mapContainer?.classList.add('search-open');
  },

  /* ── Bottom panel states ── */
  minimizeBottom() {
    this.bottomState = 'mini';
    this.dom.bottomPanel?.classList.add('bottom-panel--mini');
    this.dom.bottomPanel?.classList.remove('bottom-panel--hidden');
    this.dom.bottomSideTab?.classList.remove('hidden');
    this.app.dom.vehicleZone?.classList.add('vehicle-zone--collapsed');
    this.app.mapEngine?.invalidateSize();
  },

  hideBottom() {
    this.bottomState = 'hidden';
    this.dom.bottomPanel?.classList.add('bottom-panel--hidden', 'bottom-panel--mini');
    this.dom.bottomSideTab?.classList.remove('hidden');
    this.app.dom.vehicleZone?.classList.add('vehicle-zone--collapsed');
    this.app.mapEngine?.invalidateSize();
  },

  expandBottom() {
    this.bottomState = 'expanded';
    this.dom.bottomPanel?.classList.remove('bottom-panel--mini', 'bottom-panel--hidden');
    this.dom.bottomSideTab?.classList.add('hidden');
    this.app.dom.vehicleZone?.classList.remove('vehicle-zone--collapsed');
    this.app.mapEngine?.invalidateSize();
  },

  toggleMapClean() {
    const on = this.dom.appLayout?.classList.toggle('map-clean');
    this.dom.mapFocusBtn?.classList.toggle('rail-menu-item--active', on);
    if (on) {
      this.toggleTopDock(true);
      this.toggleBottomDock(true);
    }
  },

  /* ── Location modes ── */
  setLocMode(mode) {
    this.dom.btnLocModeGPS?.classList.toggle('loc-mode-tab--active', mode === 'gps');
    this.dom.btnLocModeManual?.classList.toggle('loc-mode-tab--active', mode === 'manual');
    if (mode === 'gps') this.useGPSPickup();
    else if (this.dom.pickupInput) this.dom.pickupInput.readOnly = false;
  },

  async useGPSPickup() {
    this.dom.btnUseGPS?.classList.add('loc-btn--active');
    try {
      const loc = await this.app.mapEngine.locateUser();
      this.app.userLocation = loc;
      this.pickupLoc = { ...loc, label: 'میری موجودہ جگہ' };
      if (this.dom.pickupInput) {
        this.dom.pickupInput.value = 'میری موجودہ جگہ';
        this.dom.pickupInput.readOnly = true;
      }
      this.app.mapEngine.setPickupPoint(loc.lat, loc.lng);
      this.app.notify('📍 آپ کی موجودہ جگہ سیٹ ہو گئی', 'success');
      this.app.updateRouteChip();
    } catch {
      this.app.notify('GPS نہیں ملا — دستی انتخاب کریں', 'error');
    } finally {
      setTimeout(() => this.dom.btnUseGPS?.classList.remove('loc-btn--active'), 600);
    }
  },

  startMapPick(mode) {
    this.pickMode = mode;
    this.minimizeSearch();
    this.dom.pickHint?.classList.remove('hidden');
    this.dom.pickHint.textContent =
      mode === 'pickup'
        ? '📍 نقشے پر کلک کریں — کہاں سے اٹھنا ہے'
        : '🏠 نقشے پر کلک کریں — کہاں جانا ہے';
    this.dom.mapContainer?.classList.add('map-pick-cursor');

    this.app.mapEngine.enableMapPick((lat, lng) => this.onMapPicked(lat, lng));
  },

  async onMapPicked(lat, lng) {
    const mode = this.pickMode;
    if (!mode) return;

    let label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    try {
      const rev = await this.app.mapEngine.reverseGeocode(lat, lng);
      label = rev.label.split(',')[0];
    } catch { /* coords fallback */ }

    if (mode === 'pickup') {
      this.pickupLoc = { lat, lng, label };
      this.app.userLocation = { lat, lng };
      if (this.dom.pickupInput) {
        this.dom.pickupInput.value = label;
        this.dom.pickupInput.readOnly = false;
      }
      this.app.mapEngine.setPickupPoint(lat, lng);
    } else {
      this.destLoc = { lat, lng, label };
      if (this.dom.destInput) this.dom.destInput.value = label;
      this.app.mapEngine.setDestinationPoint(lat, lng);
    }

    this.stopMapPick();
    this.expandSearch();
    this.app.updateRouteChip();

    if (this.pickupLoc && this.destLoc) {
      this.app.mapEngine.drawRoute(this.pickupLoc, this.destLoc);
    }

    this.app.notify(`${mode === 'pickup' ? 'اٹھانے' : 'منزل'} کی جگہ سیٹ`, 'success');
  },

  stopMapPick() {
    this.pickMode = null;
    this.dom.pickHint?.classList.add('hidden');
    this.dom.mapContainer?.classList.remove('map-pick-cursor');
    this.app.mapEngine.disableMapPick();
  },

  getPickup() {
    return this.pickupLoc || this.app.userLocation;
  },

  getDestination() {
    return this.destLoc;
  },

  /* ── Swipe navigation ── */
  onTouchStart(e) {
    if (this.pickMode) return;
    this.touchOnMap = !!e.target.closest('.leaflet-container, #LiveMapRenderArea, .leaflet-pane');
    if (this.touchOnMap) return;
    const t = e.touches[0];
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
    this.swiping = false;
  },

  onTouchMove(e) {
    if (this.pickMode || this.touchOnMap) return;
    const t = e.touches[0];
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) this.swiping = true;
  },

  onTouchEnd(e) {
    if (!this.swiping || this.pickMode || this.touchOnMap) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - this.touchStartX;
    const pages = ['map', 'ads', 'driver', 'admin'];
    const cur = this.dom.swipeTrack?.getAttribute('data-page') || 'map';
    const idx = pages.indexOf(cur);

    if (dx < -60 && idx < pages.length - 1) this.showPage(pages[idx + 1]);
    else if (dx > 60 && idx > 0) this.showPage(pages[idx - 1]);
  },

  showPage(page) {
    this.dom.swipeTrack?.setAttribute('data-page', page);
    this.dom.appLayout?.setAttribute('data-swipe-page', page);
    document.getElementById('MapAiBar')?.classList.toggle('hidden', page !== 'map');
    document.getElementById('AppSideRail')?.classList.toggle('hidden', page !== 'map');
    document.querySelectorAll('[data-goto-page]').forEach((b) => {
      b.classList.toggle('page-nav--active', b.dataset.gotoPage === page);
    });
    if (page === 'ads') this.loadCommunityAds();
    if (page === 'driver') this.loadDriverPage();
    if (page === 'admin') AdminHub.load();
    if (page === 'map') {
      this.app.mapEngine?.invalidateSize();
      setTimeout(() => this.app.mapEngine?.invalidateSize(), 300);
    }
    PWAManager.haptic(8);
  },

  showCommunityPage() { this.showPage('ads'); },
  showMapPage() { this.showPage('map'); },

  loadDriverPage() {
    const ownerBox = document.getElementById('OwnerFleetList');
    if (RoleHub.role === 'owner' && ownerBox) RoleHub.loadOwnerFleet(ownerBox);
  },

  async loadCommunityAds() {
    const box = this.dom.communityList;
    if (!box) return;

    box.innerHTML = '<p class="empty-msg">لوڈ ہو رہا ہے...</p>';
    try {
      const loc = this.app.userLocation || { lat: 31.52, lng: 74.35 };
      const q = this.dom.adSearch?.value?.trim() || '';
      const type = this.dom.adFilter?.value || 'all';
      const posts = await ApiClient.getCommunityNearby(loc.lat, loc.lng, q, type);
      if (!posts.length) {
        box.innerHTML = '<p class="empty-msg">کوئی اشتہار نہیں</p>';
        return;
      }
      box.innerHTML = posts.map((p) => `
        <article class="community-card">
          <div class="community-card__user">
            <span class="community-card__avatar">${p.userName.charAt(0)}</span>
            <div>
              <strong>${p.userName}</strong>
              <div class="community-card__meta">${p.type === 'cargo' ? '🚚 سامان' : '🚕 سفر'} · ${p.distanceKm}km</div>
            </div>
          </div>
          <div class="community-card__route">${p.from} → ${p.to}</div>
          <p class="community-card__text">${p.text}</p>
          <div class="community-card__meta">⏱ ${p.timeAgo}</div>
          <button type="button" class="community-card__btn" data-ad="${p.id}">رابطہ کریں</button>
        </article>
      `).join('');

      box.querySelectorAll('[data-ad]').forEach((btn) => {
        btn.addEventListener('click', () => this.app.notify('رابطہ بھیج دیا', 'success'));
      });
    } catch {
      box.innerHTML = '<p class="empty-msg">اشتہارات لوڈ نہیں ہو سکے</p>';
    }
  }
};
