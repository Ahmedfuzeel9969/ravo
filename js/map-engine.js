/**
 * Leaflet Map Engine — Live vehicles + location tracking
 */
class MapEngine {
  constructor(containerId, config) {
    this.config = config;
    this.driverMarkers = new Map();
    this.driverStates = new Map();
    this.userMarker = null;
    this.liveUserMarkers = new Map();
    this.routeLine = null;
    this.pickupMarker = null;
    this.destinationMarker = null;
    this.mapPickHandler = null;
    this.trafficLines = [];
    this.activeLayer = 'standard';
    this.animationTimer = null;
    this.watchId = null;
    this.onDriverMove = null;

    this.map = L.map(containerId, {
      zoomControl: false,
      attributionControl: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true
    }).setView(config.defaultCenter, config.defaultZoom);

    this.mapLocked = false;

    this.layers = {
      standard: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }),
      satellite: L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: '&copy; Esri' }
      )
    };

    this.layers.standard.addTo(this.map);
  }

  driverIcon(type, hasAd = false, eta = null) {
    const emoji = type === 'cargo' ? '🚚' : '🚕';
    const adBadge = hasAd ? '<span class="driver-ad-badge">📢</span>' : '';
    const etaBadge = eta != null ? `<span class="driver-eta-badge">${eta}m</span>` : '';
    return L.divIcon({
      className: 'driver-map-icon',
      html: `<span class="driver-pin driver-pin--${type} driver-pin--real">${emoji}${adBadge}${etaBadge}</span>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  }

  userIcon(sharing = false) {
    return L.divIcon({
      className: 'user-map-icon',
      html: `<span class="user-pin${sharing ? ' user-pin--sharing' : ''}">🎯</span>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  }

  liveUserIcon(label) {
    return L.divIcon({
      className: 'live-user-map-icon',
      html: `<span class="driver-pin driver-pin--moving live-user-pin">📍</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }

  pickIcon(kind) {
    const cls = kind === 'pickup' ? 'pick-pin--pickup' : 'pick-pin--dest';
    const emoji = kind === 'pickup' ? '📍' : '🏁';
    return L.divIcon({
      className: 'pick-map-icon',
      html: `<span class="pick-pin ${cls}">${emoji}</span>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
  }

  setPickupPoint(lat, lng) {
    const icon = this.pickIcon('pickup');
    if (this.pickupMarker) {
      this.pickupMarker.setLatLng([lat, lng]);
    } else {
      this.pickupMarker = L.marker([lat, lng], { icon, zIndexOffset: 1100 }).addTo(this.map);
    }
  }

  setDestinationPoint(lat, lng) {
    const icon = this.pickIcon('dest');
    if (this.destinationMarker) {
      this.destinationMarker.setLatLng([lat, lng]);
    } else {
      this.destinationMarker = L.marker([lat, lng], { icon, zIndexOffset: 1100 }).addTo(this.map);
    }
  }

  enableMapPick(onPick) {
    this.disableMapPick();
    this.mapPickHandler = (e) => onPick(e.latlng.lat, e.latlng.lng);
    this.map.on('click', this.mapPickHandler);
  }

  disableMapPick() {
    if (this.mapPickHandler) {
      this.map.off('click', this.mapPickHandler);
      this.mapPickHandler = null;
    }
  }

  async reverseGeocode(lat, lng) {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json'
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Reverse geocode failed');
    const data = await response.json();
    return { lat, lng, label: data.display_name || `${lat}, ${lng}` };
  }

  invalidateSize() {
    setTimeout(() => this.map.invalidateSize(), 100);
  }

  setLayer(layerName) {
    if (!this.layers[layerName] || this.activeLayer === layerName) return;
    this.map.removeLayer(this.layers[this.activeLayer]);
    this.layers[layerName].addTo(this.map);
    this.activeLayer = layerName;
  }

  zoomIn() { this.map.zoomIn(); }
  zoomOut() { this.map.zoomOut(); }
  setView(lat, lng, zoom) { this.map.setView([lat, lng], zoom || this.map.getZoom()); }

  setMapLocked(locked) {
    this.mapLocked = locked;
    if (locked) {
      this.map.dragging.disable();
    } else {
      this.map.dragging.enable();
    }
    this.map.touchZoom.enable();
    this.map.scrollWheelZoom.enable();
    return locked;
  }

  isMapLocked() {
    return this.mapLocked;
  }

  lockToUser(lat, lng, zoom = 16) {
    if (lat == null || lng == null) return;
    this.setView(lat, lng, zoom);
  }

  addDriverMarkers(drivers, onClick, onAdClick) {
    this.stopDriverAnimation();
    this.onDriverClick = onClick;
    this.onAdClick = onAdClick;
    const ids = new Set(drivers.map((d) => d.id));
    this.driverMarkers.forEach((marker, id) => {
      if (!ids.has(id)) {
        this.map.removeLayer(marker);
        this.driverMarkers.delete(id);
      }
    });
    drivers.forEach((driver) => this.upsertDriverMarker(driver));
  }

  upsertDriverMarker(driver) {
    const icon = this.driverIcon(driver.vehicleType, driver.hasAd, driver.eta);
    const etaLine = driver.eta ? `⏱ ${driver.eta} منٹ میں پہنچے گی` : '📡 Live linked';
    const adLine = driver.hasAd
      ? `<br><a href="#" class="map-ad-link" data-driver="${driver.id}">📢 اشتہار دیکھیں</a>`
      : '';
    const popupHtml = `<strong>${driver.name}</strong><br>${driver.vehicle}<br>⭐ ${driver.rating}<br>${etaLine}${adLine}`;

    let marker = this.driverMarkers.get(driver.id);
    if (marker) {
      marker.setLatLng([driver.lat, driver.lng]);
      marker.setIcon(icon);
    } else {
      marker = L.marker([driver.lat, driver.lng], { icon, zIndexOffset: 800 }).addTo(this.map);
      marker.on('click', () => this.onDriverClick?.(driver));
      this.driverMarkers.set(driver.id, marker);
    }
    marker.bindPopup(popupHtml);
    marker.off('popupopen');
    marker.on('popupopen', () => {
      const el = marker.getPopup()?.getElement()?.querySelector('.map-ad-link');
      el?.addEventListener('click', (e) => {
        e.preventDefault();
        this.onAdClick?.(driver);
      });
    });
  }

  updateLivePositions(liveDrivers) {
    liveDrivers.forEach((live) => {
      const marker = this.driverMarkers.get(live.id);
      if (marker) marker.setLatLng([live.lat, live.lng]);
    });
  }

  stopDriverAnimation() {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  highlightDriver(driverId) {
    this.driverMarkers.forEach((marker, id) => {
      const el = marker.getElement();
      if (el) {
        const pin = el.querySelector('.driver-pin');
        if (pin) pin.classList.toggle('driver-pin--active', id === driverId);
      }
    });
  }

  clearDriverMarkers() {
    this.stopDriverAnimation();
    this.driverMarkers.forEach((marker) => this.map.removeLayer(marker));
    this.driverMarkers.clear();
    this.driverStates.clear();
  }

  setUserLocation(lat, lng, sharing = false) {
    const icon = this.userIcon(sharing);
    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
      this.userMarker.setIcon(icon);
    } else {
      this.userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(this.map);
    }
  }

  locateUser() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          this.setUserLocation(loc.lat, loc.lng, false);
          resolve(loc);
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  startWatchingUser(onUpdate, sharing = true) {
    if (!navigator.geolocation) return null;
    if (this.watchId) navigator.geolocation.clearWatch(this.watchId);

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.setUserLocation(loc.lat, loc.lng, sharing);
        onUpdate(loc);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return this.watchId;
  }

  stopWatchingUser() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.userMarker) {
      this.setUserLocation(
        this.userMarker.getLatLng().lat,
        this.userMarker.getLatLng().lng,
        false
      );
    }
  }

  showLiveUser(id, lat, lng, label) {
    if (this.liveUserMarkers.has(id)) {
      this.liveUserMarkers.get(id).setLatLng([lat, lng]);
      return;
    }
    const marker = L.marker([lat, lng], {
      icon: this.liveUserIcon(label),
      zIndexOffset: 900
    }).addTo(this.map);
    marker.bindPopup(`<strong>${label || 'Live User'}</strong><br>لوکیشن آن`);
    this.liveUserMarkers.set(id, marker);
  }

  async geocode(query) {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'pk'
    });

    const response = await fetch(`${this.config.geocodeUrl}?${params}`, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) throw new Error('Geocoding failed');

    const results = await response.json();
    if (!results.length) throw new Error('Location not found');

    const { lat, lon, display_name } = results[0];
    return { lat: parseFloat(lat), lng: parseFloat(lon), label: display_name };
  }

  drawRoute(from, to, color = '#2563eb') {
    if (this.routeLine) this.map.removeLayer(this.routeLine);
    this.routeLine = L.polyline(
      [[from.lat, from.lng], [to.lat, to.lng]],
      { color, weight: 5, opacity: 0.85 }
    ).addTo(this.map);
    this.map.fitBounds(this.routeLine.getBounds(), { padding: [80, 80] });
  }

  drawRouteOptions(from, to, color) {
    this.drawRoute(from, to, color);
  }

  showTraffic(segments) {
    this.clearTraffic();
    const colors = { heavy: '#ef4444', moderate: '#eab308', light: '#22c55e' };
    segments.forEach((s) => {
      const line = L.polyline([s.from, s.to], {
        color: colors[s.level] || '#eab308',
        weight: 7,
        opacity: 0.75
      }).addTo(this.map);
      line.bindPopup(`🚦 ${s.level} · +${s.delayMin}m`);
      this.trafficLines.push(line);
    });
  }

  clearTraffic() {
    this.trafficLines.forEach((l) => this.map.removeLayer(l));
    this.trafficLines = [];
  }

  poiIcon(poi) {
    return L.divIcon({
      className: 'poi-map-icon',
      html: `<span class="poi-pin">${poi.icon || '📍'}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });
  }

  showPOIs(pois) {
    this.clearPOIs();
    this.poiMarkers = this.poiMarkers || [];
    pois.forEach((poi) => {
      const m = L.marker([poi.lat, poi.lng], { icon: this.poiIcon(poi), zIndexOffset: 500 })
        .addTo(this.map)
        .bindPopup(`<strong>${poi.name}</strong><br>${poi.label || poi.category}<br>${poi.distanceKm ?? ''}km`);
      this.poiMarkers.push(m);
    });
    if (pois.length > 1) {
      const bounds = L.latLngBounds(pois.map((p) => [p.lat, p.lng]));
      this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }
  }

  clearPOIs() {
    (this.poiMarkers || []).forEach((m) => this.map.removeLayer(m));
    this.poiMarkers = [];
  }

  clearRoute() {
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
  }

  destroy() {
    this.disableMapPick();
    this.stopDriverAnimation();
    this.stopWatchingUser();
  }
}
