const WSClient = {
  ws: null,
  handlers: [],
  reconnectTimer: null,
  onDrivers: null,

  connect(onDrivers) {
    this.onDrivers = onDrivers;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const wsUrl = typeof EnvConfig !== 'undefined'
      ? EnvConfig.wsUrl
      : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'drivers_update' && this.onDrivers) this.onDrivers(msg.drivers);
        if (msg.type === 'user_location') {
          this.handlers.forEach((h) => h('user_location', msg));
        }
      } catch { /* ignore */ }
    };

    this.ws.onerror = () => { /* reconnect via onclose */ };

    this.ws.onclose = () => {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(this.onDrivers), 3000);
    };
  },

  disconnect() {
    clearTimeout(this.reconnectTimer);
    this.handlers = [];
    this.ws?.close();
    this.ws = null;
  },

  sendLiveLocation(lat, lng) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'live_location', payload: { lat, lng, userId: ApiClient.userId } }));
    }
  },

  sendDriverOnline(driverId, lat, lng) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'driver_online', payload: { driverId, userId: ApiClient.userId, lat, lng } }));
    }
  },

  sendDriverOffline(driverId) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'driver_offline', payload: { driverId } }));
    }
  },

  sendDriverLocation(driverId, lat, lng, heading, speed) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'driver_location', payload: { driverId, lat, lng, heading, speed } }));
    }
  },

  on(handler) {
    this.handlers.push(handler);
  }
};
