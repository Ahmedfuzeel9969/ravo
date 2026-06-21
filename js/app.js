/**
 * P2P Transport — مرکزی ایپلیکیشن کنٹرولر (SPA + Backend API)
 */
class P2PApp {
  constructor() {
    this.config = AppConfig;
    this.api = ApiClient;
    this.currentModule = 'home';
    this.selectedDriver = null;
    this.userLocation = null;
    this.mapEngine = null;
    this.drivers = [];
    this.bookings = [];
    this.bookingFilter = 'active';
    this.isLiveSharing = false;
    this.isCompactMobile = window.matchMedia('(max-width: 768px)').matches;

    this.cacheDom();
    this.buildSubBars();
    this.init();
  }

  cacheDom() {
    this.dom = {
      navItems: document.querySelectorAll('.nav-item:not(.more-menu-trigger)'),
      moreMenuTrigger: document.querySelector('.more-menu-trigger'),
      moreDropdown: document.getElementById('MoreDropdown'),
      subBarContainer: document.getElementById('BottomSubBar'),
      subBarGroups: document.querySelectorAll('.sub-action-group'),
      mapContainer: document.getElementById('MapContainer'),
      workspace: document.getElementById('WorkspaceContainer'),
      vehicleZone: document.getElementById('VehicleZone'),
      vehicleList: document.getElementById('VehicleList'),
      dynamicContent: document.getElementById('DynamicContentContainer'),
      notificationContainer: document.getElementById('NotificationContainer'),
      overlayContainer: document.getElementById('OverlayContainer'),
      modalContainer: document.getElementById('ModalContainer'),
      modalBody: document.getElementById('ModalBody'),
      modalCloseBtn: document.getElementById('ModalCloseBtn'),
      currentLocationInput: document.getElementById('CurrentLocationInput'),
      destinationInput: document.getElementById('DestinationInput'),
      btnSearch: document.getElementById('BtnSearch'),
      searchFab: document.getElementById('SearchFab'),
      searchSheet: document.getElementById('SearchSheet'),
      searchSheetBackdrop: document.getElementById('SearchSheetBackdrop'),
      routeChip: document.getElementById('RouteChip'),
      routeChipText: document.getElementById('RouteChipText'),
      btnLiveShare: document.getElementById('BtnLiveShare')
    };
  }

  openSearchSheet() {
    InteractionUI.expandSearch();
    this.dom.searchSheet?.classList.remove('hidden');
    this.dom.mapContainer?.classList.add('search-open');
    setTimeout(() => this.dom.destinationInput?.focus(), 200);
  }

  closeSearchSheet() {
    InteractionUI.minimizeSearch();
    this.dom.searchSheet?.classList.add('hidden');
    this.dom.mapContainer?.classList.remove('search-open');
    this.updateRouteChip();
    this.mapEngine?.invalidateSize();
  }

  updateRouteChip() {
    const pickup = this.dom.currentLocationInput?.value?.trim();
    const dest = this.dom.destinationInput?.value?.trim();
    if (pickup && dest) {
      const short = (s) => (s.length > 12 ? `${s.slice(0, 12)}…` : s);
      this.dom.routeChipText.textContent = `📍 ${short(pickup)} → 🏠 ${short(dest)}`;
      this.dom.routeChip?.classList.remove('hidden');
    } else {
      this.dom.routeChip?.classList.add('hidden');
    }
  }

  tryAutoCloseSearch() {
    const pickup = this.dom.currentLocationInput?.value?.trim();
    const dest = this.dom.destinationInput?.value?.trim();
    if (pickup && dest) {
      this.closeSearchSheet();
    }
  }

  async init() {
    this.bindEvents();
    this.mapEngine = new MapEngine('LiveMapRenderArea', this.config);
    PWAManager.init(this);
    FeatureHub.init(this);
    InteractionUI.init(this);
    RoleHub.init(this);
    TripTracker.init(this);
    AdminHub.init(this);
    PremiumHub.init(this);
    SearchAI.init(this);

    window.addEventListener('firebase-ready', () => {
      window.FirebaseHub?.track('p2p_init', { module: 'home' });
    });

    PWAManager.showSkeleton(this.dom.vehicleList, 3);

    try {
      await this.api.healthCheck();
      this.mapEngine.locateUser()
        .then(async (loc) => {
          this.userLocation = loc;
          this.dom.currentLocationInput.value = 'میری موجودہ جگہ';
          await this.loadDrivers('all');
          this.updateRouteChip();
        })
        .catch(async () => {
          this.dom.currentLocationInput.placeholder = 'موجودہ مقام درج کریں';
          await this.loadDrivers('all');
        });
    } catch {
      this.notify('سرور سے رابطہ نہیں ہو سکا۔', 'error');
    }

    this.switchModule('home');
  }

  buildSubBars() {
    Object.entries(this.config.subBars).forEach(([barId, items]) => {
      const container = document.getElementById(barId);
      if (!container) return;
      container.innerHTML = items
        .map(
          (item) =>
            `<button class="action-btn${item.highlight ? ' highlight' : ''}" data-action="${item.id}">${item.label}</button>`
        )
        .join('');
    });
  }

  bindEvents() {
    this.dom.navItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        this.dom.navItems.forEach((n) => n.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.switchModule(e.currentTarget.getAttribute('data-module'));
      });
    });

    this.dom.moreMenuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dom.moreDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (
        !this.dom.moreMenuTrigger.contains(e.target) &&
        !this.dom.moreDropdown.classList.contains('hidden')
      ) {
        this.dom.moreDropdown.classList.add('hidden');
      }
    });

    this.dom.moreDropdown.querySelectorAll('li[data-action]').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') return;
        const action = item.getAttribute('data-action');
        this.dom.moreDropdown.classList.add('hidden');
        if (action === 'language') {
          RailHub.openGroup('lang');
          return;
        }
        const msg = this.config.moreMenuActions[action];
        if (msg) {
          this.showModal(msg.title, msg.body);
          if (action === 'logout') this.notify('لاگ آؤٹ کی درخواست موصول ہو گئی۔', 'info');
        }
      });
    });

    this.dom.subBarContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.action-btn');
      if (!btn) return;
      this.handleSubBarAction(btn);
    });

    document.getElementById('BtnZoomIn')?.addEventListener('click', () => this.mapEngine.zoomIn());
    document.getElementById('BtnZoomOut')?.addEventListener('click', () => this.mapEngine.zoomOut());
    document.getElementById('BtnMyLocation')?.addEventListener('click', () => this.goToMyLocation());
    this.dom.btnSearch?.addEventListener('click', () => this.handleSearch());

    this.dom.searchFab?.addEventListener('click', () => this.openSearchSheet());
    this.dom.routeChip?.addEventListener('click', () => this.openSearchSheet());
    this.dom.searchSheetBackdrop?.addEventListener('click', () => this.closeSearchSheet());

    this.dom.destinationInput?.addEventListener('input', () => this.tryAutoCloseSearch());
    this.dom.destinationInput?.addEventListener('change', () => this.tryAutoCloseSearch());

    this.dom.btnLiveShare?.addEventListener('click', () => this.toggleLiveShare());

    this.dom.vehicleList?.addEventListener('click', (e) => {
      const bookBtn = e.target.closest('.btn-book');
      if (bookBtn) {
        e.stopPropagation();
        this.createBooking(bookBtn.dataset.driverId);
        return;
      }
      const callBtn = e.target.closest('.btn-call');
      const chatBtn = e.target.closest('.btn-chat');
      if (callBtn) {
        e.stopPropagation();
        ApiClient.getMaskedCall(this.selectedDriver?.id || '').then((r) => {
          this.notify(`کال: ${r.masked}`, 'success');
        });
        return;
      }
      if (chatBtn) {
        e.stopPropagation();
        FeatureHub.toggleChat();
        return;
      }
      const card = e.target.closest('.vehicle-card');
      if (!card) return;
      const driver = this.drivers.find((d) => d.id === card.dataset.driverId);
      if (driver) this.selectDriver(driver);
    });

    this.dom.dynamicContent?.addEventListener('click', (e) => {
      const payBtn = e.target.closest('[data-pay-booking]');
      if (payBtn) {
        this.handlePayment(payBtn.dataset.payBooking);
        return;
      }
      const cancelBtn = e.target.closest('[data-cancel-booking]');
      if (cancelBtn) {
        this.cancelBooking(cancelBtn.dataset.cancelBooking);
        return;
      }
      const completeBtn = e.target.closest('[data-complete-booking]');
      if (completeBtn) {
        this.completeBooking(completeBtn.dataset.completeBooking);
      }
    });

    this.dom.modalCloseBtn?.addEventListener('click', () => this.hideModal());
    this.dom.modalContainer?.addEventListener('click', (e) => {
      if (e.target === this.dom.modalContainer) this.hideModal();
    });
  }

  async loadDrivers(type = 'all', opts = {}) {
    PWAManager.showSkeleton(this.dom.vehicleList, 3);
    try {
      const params = { type: type === 'home' ? 'all' : type };
      if (this.userLocation) {
        params.lat = this.userLocation.lat;
        params.lng = this.userLocation.lng;
      }
      if (opts.womenOnly || FeatureHub.womenOnly) params.womenOnly = true;
      this.drivers = await this.api.getDrivers(params);

      if (this.selectedDriver && !this.drivers.some((d) => d.id === this.selectedDriver.id)) {
        this.selectedDriver = null;
      }

      this.renderDrivers(this.drivers);
    } catch {
      this.notify('ڈرائیورز لوڈ نہیں ہو سکے۔', 'error');
    }
  }

  switchModule(moduleName) {
    this.currentModule = moduleName;
    window.FirebaseHub?.trackScreen(moduleName);
    const mod = this.config.modules[moduleName];
    if (!mod) return;

    document.querySelectorAll('.nav-item[data-module]').forEach((n) => {
      n.classList.toggle('active', n.dataset.module === moduleName);
    });
    document.querySelectorAll('.mobile-tab[data-module]').forEach((t) => {
      if (t.dataset.module !== 'more') {
        t.classList.toggle('active', t.dataset.module === moduleName);
      }
    });

    this.dom.subBarGroups.forEach((g) => g.classList.add('hidden'));
    if (mod.subBarId) {
      document.getElementById(mod.subBarId)?.classList.remove('hidden');
    }

    if (mod.showMap) {
      this.dom.mapContainer.classList.remove('hidden');
      this.dom.dynamicContent.classList.add('hidden');
      this.mapEngine.invalidateSize();
    } else {
      this.dom.mapContainer.classList.add('hidden');
    }

    if (mod.showVehicleZone) {
      this.dom.vehicleZone.classList.remove('hidden');
      this.dom.workspace?.classList.remove('central-workspace--no-vehicles');
      this.filterDriversByModule(moduleName);
    } else {
      this.dom.vehicleZone.classList.add('hidden');
      this.dom.workspace?.classList.add('central-workspace--no-vehicles');
    }

    if (mod.apiModule) {
      this.loadApiModule(mod.apiModule);
    } else if (!mod.showMap) {
      this.renderStaticModule(moduleName);
    } else if (moduleName === 'bookings') {
      this.loadBookingsPanel();
    }

    document.getElementById('CargoFields')?.classList.toggle('hidden', moduleName !== 'cargo');
  }

  filterDriversByModule(moduleName) {
    const type = moduleName === 'ride' ? 'ride' : moduleName === 'cargo' ? 'cargo' : 'all';
    this.loadDrivers(type);
  }

  async loadApiModule(module) {
    this.showOverlay(true);
    try {
      if (module === 'bookings') await this.loadBookingsPanel();
      else       if (module === 'finance') await this.loadFinancePanel();
      else if (module === 'history') await this.loadHistoryPanel();
      else if (module === 'profile') await this.loadProfilePanel();
      else if (module === 'fleet') await FeatureHub.loadFleetPanel(this.dom.dynamicContent);
    } catch (err) {
      this.notify(err.message || 'ڈیٹا لوڈ نہیں ہو سکا۔', 'error');
    } finally {
      this.showOverlay(false);
    }
  }

  renderStaticModule(moduleName) {
    const content = this.config.modules[moduleName]?.content;
    if (!content) return;

    const statsHtml = content.stats
      .map((s) => `<div class="stat-card"><strong>${s.value}</strong><span>${s.label}</span></div>`)
      .join('');

    this.dom.dynamicContent.innerHTML = `
      <article class="content-panel">
        <h2>${content.title}</h2>
        <p>${content.body}</p>
        <div class="stat-grid">${statsHtml}</div>
      </article>
    `;
    this.dom.dynamicContent.classList.remove('hidden');
  }

  async loadBookingsPanel(status = this.bookingFilter) {
    this.bookingFilter = status;
    const [bookings, stats] = await Promise.all([
      this.api.getBookings(status),
      this.api.getBookingStats()
    ]);
    this.bookings = bookings;

    const statusLabels = { active: 'فعال', upcoming: 'آنے والی', completed: 'مکمل', cancelled: 'منسوخ' };

    const listHtml = bookings.length
      ? bookings.map((b) => this.buildBookingCard(b)).join('')
      : '<p class="empty-msg">اس زمرے میں کوئی بکنگ نہیں۔</p>';

    this.dom.dynamicContent.innerHTML = `
      <article class="content-panel">
        <h2>میری بکنگز</h2>
        <div class="stat-grid">
          <div class="stat-card"><strong>${stats.active}</strong><span>فعال</span></div>
          <div class="stat-card"><strong>${stats.completed}</strong><span>مکمل</span></div>
          <div class="stat-card"><strong>${stats.cancelled}</strong><span>منسوخ</span></div>
        </div>
        <h3 class="section-title">${statusLabels[status] || status} بکنگز</h3>
        <div class="booking-list">${listHtml}</div>
      </article>
    `;

    if (this.currentModule === 'bookings') {
      this.dom.dynamicContent.classList.remove('hidden');
    }
  }

  buildBookingCard(b) {
    const statusClass = `booking-card--${b.status}`;
    const actions = [];

    if (b.status === 'active' || b.status === 'upcoming') {
      actions.push(`<button class="btn-action btn-action--pay" data-pay-booking="${b.id}">💳 ادائیگی</button>`);
      actions.push(`<button class="btn-action btn-action--cancel" data-cancel-booking="${b.id}">✕ منسوخ</button>`);
    }
    if (b.status === 'active') {
      actions.push(`<button class="btn-action btn-action--complete" data-complete-booking="${b.id}">✓ مکمل</button>`);
    }

    return `
      <div class="booking-card ${statusClass}">
        <div class="booking-card__header">
          <strong>${b.driverName}</strong>
          <span class="booking-card__status">${b.status}</span>
        </div>
        <p class="booking-card__route">${b.pickup} → ${b.destination}</p>
        <div class="booking-card__meta">
          <span>${b.vehicle}</span>
          <span>${this.config.currency} ${b.fare}</span>
          <span>${b.bookingType === 'cargo' ? 'سامان' : 'سفر'}</span>
        </div>
        ${actions.length ? `<div class="booking-card__actions">${actions.join('')}</div>` : ''}
      </div>
    `;
  }

  async loadFinancePanel() {
    const [stats, transactions] = await Promise.all([
      this.api.getFinanceStats(),
      this.api.getTransactions()
    ]);

    const txHtml = transactions
      .map(
        (t) => `
        <div class="tx-row tx-row--${t.status}">
          <span>${t.description}</span>
          <strong>${this.config.currency} ${t.amount}</strong>
          <small>${t.status}</small>
        </div>`
      )
      .join('');

    this.dom.dynamicContent.innerHTML = `
      <article class="content-panel">
        <h2>مالیات</h2>
        <div class="stat-grid">
          <div class="stat-card"><strong>${this.config.currency} ${stats.balance.toLocaleString()}</strong><span>بیلنس</span></div>
          <div class="stat-card"><strong>${this.config.currency} ${stats.monthlyTotal.toLocaleString()}</strong><span>اس ماہ</span></div>
          <div class="stat-card"><strong>${this.config.currency} ${stats.pending.toLocaleString()}</strong><span>زیر التواء</span></div>
        </div>
        <h3 class="section-title">حالیہ لین دین</h3>
        <div class="tx-list">${txHtml}</div>
      </article>
    `;
    this.dom.dynamicContent.classList.remove('hidden');
  }

  async loadHistoryPanel() {
    const stats = await this.api.getHistoryStats();

    this.dom.dynamicContent.innerHTML = `
      <article class="content-panel">
        <h2>سفر کا ریکارڈ</h2>
        <p>مکمل شدہ سفر اور کل خرچ کا خلاصہ۔</p>
        <div class="stat-grid">
          <div class="stat-card"><strong>${stats.totalTrips}</strong><span>کل سفر</span></div>
          <div class="stat-card"><strong>${this.config.currency} ${stats.totalSpent.toLocaleString()}</strong><span>کل خرچ</span></div>
          <div class="stat-card"><strong>${stats.avgRating}</strong><span>اوسط ریٹنگ</span></div>
        </div>
      </article>
    `;
    this.dom.dynamicContent.classList.remove('hidden');
  }

  async loadProfilePanel() {
    const profile = await this.api.getProfile();

    this.dom.dynamicContent.innerHTML = `
      <article class="content-panel">
        <h2>پروفائل</h2>
        <div class="profile-card">
          <p><strong>نام:</strong> ${profile.name}</p>
          <p><strong>فون:</strong> ${profile.phone}</p>
          <p><strong>ریٹنگ:</strong> ⭐ ${profile.rating}</p>
          <p><strong>رکن از:</strong> ${profile.memberSince}</p>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><strong>${profile.totalTrips}</strong><span>کل سفر</span></div>
          <div class="stat-card"><strong>${profile.totalBookings}</strong><span>کل بکنگ</span></div>
          <div class="stat-card"><strong>${profile.rating}</strong><span>ریٹنگ</span></div>
        </div>
      </article>
    `;
    this.dom.dynamicContent.classList.remove('hidden');
  }

  renderDrivers(drivers) {
    this.mapEngine.addDriverMarkers(
      drivers,
      (driver) => this.selectDriver(driver),
      (driver) => this.showDriverAd(driver)
    );

    this.dom.vehicleList.innerHTML = drivers.length
      ? drivers.map((d) => this.buildVehicleCard(d)).join('')
      : '<p class="empty-msg">کوئی linked گاڑی online نہیں — ڈرائیورز لوکیشن کھولیں</p>';

    if (drivers.length) {
      const current = this.selectedDriver && drivers.find((d) => d.id === this.selectedDriver.id);
      this.selectDriver(current || drivers[0], false);
    }
  }

  buildVehicleCard(driver) {
    const initials = driver.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
    const dist = driver.distance != null ? `${driver.distance}km` : '—';
    const eta = driver.eta != null ? `${driver.eta}m` : '—';
    const compact = this.isCompactMobile ? ' vehicle-card--compact' : '';
    const active = this.selectedDriver?.id === driver.id ? ' vehicle-card--active' : '';
    const kyc = driver.kycVerified ? '<span class="kyc-badge">✓</span>' : '';
    const adBadge = driver.hasAd ? '<span class="ad-badge">📢</span>' : '';
    const etaBig = driver.eta != null ? `<span class="eta-pill">⏱ ${driver.eta} منٹ</span>` : '';

    return `
      <article class="vehicle-card${compact}${active}" data-driver-id="${driver.id}">
        <div class="vehicle-card__avatar" style="background:${driver.avatarColor}">${initials}${adBadge}</div>
        <div class="vehicle-card__body">
          <h4>${driver.name} ${kyc}</h4>
          ${etaBig}
          <span class="vehicle-card__rating">⭐ ${driver.rating}</span>
          <p class="vehicle-card__vehicle">${driver.vehicle}</p>
          <div class="vehicle-card__meta">
            <span>${this.config.currency}${driver.fare}</span>
            <span>${dist}</span>
            <span>${eta}</span>
          </div>
        </div>
        <div class="vehicle-card__actions">
          <button type="button" class="btn-book" data-driver-id="${driver.id}" aria-label="بک">📅</button>
          <button type="button" class="btn-call" aria-label="کال">📞</button>
          <button type="button" class="btn-chat" aria-label="چیٹ">💬</button>
        </div>
      </article>
    `;
  }

  selectDriver(driver, pan = true) {
    this.selectedDriver = driver;
    this.mapEngine.highlightDriver(driver.id);
    if (pan) this.mapEngine.setView(driver.lat, driver.lng, 16);

    this.dom.vehicleList.querySelectorAll('.vehicle-card').forEach((card) => {
      card.classList.toggle('vehicle-card--active', card.dataset.driverId === driver.id);
    });
  }

  async createBooking(driverId) {
    const driver = this.drivers.find((d) => d.id === driverId) || this.selectedDriver;
    if (!driver) {
      this.notify('پہلے ڈرائیور منتخب کریں۔', 'error');
      return;
    }

    this.showOverlay(true);
    try {
      const poolOpts = PremiumHub.getPoolOptions();
      const booking = await this.api.createBooking({
        driverId: driver.id,
        bookingType: driver.vehicleType,
        rideType: this.currentModule === 'cargo' ? 'small' : 'instant',
        pickup: this.dom.currentLocationInput.value || 'موجودہ مقام',
        destination: this.dom.destinationInput.value || 'منزل',
        fare: driver.fare,
        ...FeatureHub.getBookingExtras(),
        ...poolOpts
      });

      if (poolOpts.ridePool) {
        await ApiClient.createRidePool({ bookingId: booking.id, seats: poolOpts.poolSeats });
      }

      this.notify(`بکنگ #${booking.id.slice(-4)} کامیاب!`, 'success');
      window.FirebaseHub?.track('booking_created', {
        booking_id: booking.id,
        driver_id: driver.id,
        fare: driver.fare,
        type: driver.vehicleType
      });
      this.showModal('بکنگ تصدیق', `${driver.name} کے ساتھ ${this.config.currency} ${driver.fare} کی بکنگ ہو گئی۔`);
      TripTracker.start(booking.id);
      PremiumHub.onTripStart(
        this.dom.currentLocationInput.value,
        this.dom.destinationInput.value,
        driver.eta || 10
      );
    } catch (err) {
      this.notify(err.message, 'error');
    } finally {
      this.showOverlay(false);
    }
  }

  async handlePayment(bookingId) {
    this.showOverlay(true);
    try {
      const result = await this.api.payBooking(bookingId);
      this.notify(`${this.config.currency} ${result.paid} ادائیگی ہو گئی۔`, 'success');
      await this.loadBookingsPanel(this.bookingFilter);
    } catch (err) {
      this.notify(err.message, 'error');
    } finally {
      this.showOverlay(false);
    }
  }

  async cancelBooking(bookingId) {
    this.showOverlay(true);
    try {
      await this.api.updateBooking(bookingId, 'cancelled');
      this.notify('بکنگ منسوخ ہو گئی۔', 'info');
      await this.loadBookingsPanel(this.bookingFilter);
    } catch (err) {
      this.notify(err.message, 'error');
    } finally {
      this.showOverlay(false);
    }
  }

  async completeBooking(bookingId) {
    this.showOverlay(true);
    try {
      await this.api.updateBooking(bookingId, 'completed');
      this.notify('سفر مکمل ہوا!', 'success');
      await this.loadBookingsPanel(this.bookingFilter);
    } catch (err) {
      this.notify(err.message, 'error');
    } finally {
      this.showOverlay(false);
    }
  }

  handleSubBarAction(btn) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.action-btn').forEach((b) => b.classList.remove('highlight'));
    btn.classList.add('highlight');

    const action = btn.dataset.action;
    const module = this.currentModule;

    if (module === 'home') {
      this.handleHomeAction(action, btn.textContent);
    } else if (module === 'ride' || module === 'cargo') {
      this.notify(`آپ نے "${btn.textContent}" منتخب کیا ہے۔`);
      this.filterDriversByModule(module);
    } else if (module === 'map') {
      this.handleMapAction(action);
    } else if (module === 'bookings') {
      const statusMap = { active: 'active', upcoming: 'upcoming', completed: 'completed', cancelled: 'cancelled' };
      this.loadBookingsPanel(statusMap[action] || 'active');
      this.notify(`فلٹر: ${btn.textContent}`);
    }
  }

  handleHomeAction(action, label) {
    switch (action) {
      case 'nearby':
        this.filterDriversByModule('home');
        this.notify('قریبی گاڑیاں لوڈ ہو رہی ہیں...', 'success');
        break;
      case 'quick-book':
        if (this.selectedDriver) this.createBooking(this.selectedDriver.id);
        else this.notify('پہلے کوئی گاڑی منتخب کریں۔', 'error');
        break;
      case 'offers':
        this.showModal('آج کے آفر', '20% رعایت: پہلی سفر پر۔ کوڈ: P2P20');
        break;
      case 'share-location':
        this.toggleLiveShare(true);
        this.notify('آپ کی لوکیشن live نقشے پر ہے۔', 'success');
        break;
      case 'saved-places':
        this.showModal('محفوظ مقامات', 'گھر، دفتر، اور حالیہ مقامات یہاں محفوظ ہیں۔');
        break;
      default:
        this.notify(`"${label}" منتخب کیا۔`);
    }
  }

  handleMapAction(action) {
    switch (action) {
      case 'standard':
        this.mapEngine.setLayer('standard');
        this.notify('نارمل نقشہ فعال۔');
        break;
      case 'satellite':
        this.mapEngine.setLayer('satellite');
        this.notify('سیٹلائٹ ویو فعال۔');
        break;
      case 'traffic':
        this.notify('ٹریفک لیئر جلد دستیاب ہوگی۔', 'info');
        break;
      case 'my-location':
        this.goToMyLocation();
        break;
    }
  }

  toggleLiveShare(forceOn) {
    this.isLiveSharing = forceOn ?? !this.isLiveSharing;

    if (this.isLiveSharing) {
      this.mapEngine.startWatchingUser((loc) => {
        this.userLocation = loc;
        this.dom.currentLocationInput.value = 'میری موجودہ جگہ';
        if (InteractionUI.mapLocked) this.mapEngine.lockToUser(loc.lat, loc.lng);
        WSClient.sendLiveLocation(loc.lat, loc.lng);
      }, true);
      this.dom.btnLiveShare?.classList.add('btn-tool--active');
      this.notify('📡 Live لوکیشن آن — آپ نقشے پر نظر آئیں گے', 'success');
    } else {
      this.mapEngine.stopWatchingUser();
      this.dom.btnLiveShare?.classList.remove('btn-tool--active');
      this.notify('Live لوکیشن بند', 'info');
    }
  }

  async goToMyLocation() {
    try {
      this.showOverlay(true);
      const loc = await this.mapEngine.locateUser();
      this.userLocation = loc;
      this.dom.currentLocationInput.value = 'میری موجودہ جگہ';
      this.mapEngine.lockToUser(loc.lat, loc.lng, 16);
      await this.loadDrivers(this.currentModule === 'cargo' ? 'cargo' : this.currentModule === 'ride' ? 'ride' : 'all');
      this.notify('آپ کی موجودہ جگہ نقشے پر دکھائی گئی۔', 'success');
    } catch {
      this.notify('لوکیشن حاصل نہیں ہو سکی۔', 'error');
    } finally {
      this.showOverlay(false);
    }
  }

  async handleSearch() {
    const destText = this.dom.destinationInput.value.trim();
    if (!destText && !InteractionUI.destLoc) {
      this.notify('براہ کرم منزل درج کریں۔', 'error');
      return;
    }

    this.showOverlay(true);
    try {
      let destination = InteractionUI.destLoc;
      if (!destination && destText) {
        destination = await this.mapEngine.geocode(destText);
        InteractionUI.destLoc = destination;
        this.dom.destinationInput.value = destination.label.split(',')[0];
        this.mapEngine.setDestinationPoint(destination.lat, destination.lng);
      }

      const pickup = InteractionUI.getPickup();
      if (pickup && destination) {
        this.mapEngine.drawRoute(pickup, destination);
      } else if (destination) {
        this.mapEngine.setView(destination.lat, destination.lng, 14);
      }

      await this.loadDrivers(this.currentModule === 'cargo' ? 'cargo' : 'ride');
      this.closeSearchSheet();
      this.notify('راستہ نقشے پر دکھایا گیا۔', 'success');
    } catch {
      this.notify('منزل نہیں ملی۔ دوبارہ کوشش کریں۔', 'error');
    } finally {
      this.showOverlay(false);
    }
  }

  notify(message, type = 'info') {
    PWAManager.haptic(8);
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    this.dom.notificationContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  showOverlay(show) {
    this.dom.overlayContainer.classList.toggle('hidden', !show);
  }

  showModal(title, body) {
    this.dom.modalBody.innerHTML = `<h3>${title}</h3><p>${body}</p>`;
    this.dom.modalContainer.classList.remove('hidden');
  }

  hideModal() {
    this.dom.modalContainer.classList.add('hidden');
    this.dom.modalBody.innerHTML = '';
  }

  showDriverAd(driver) {
    const text = driver.adText || 'اشتہار';
    this.showModal('📢 گاڑی کا اشتہار', `
      <strong>${driver.name}</strong> — ${driver.vehicle}<br>
      ${driver.adFrom ? `${driver.adFrom} → ${driver.adTo}<br>` : ''}
      ${text}
    `);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.p2pApp = new P2PApp();
});
