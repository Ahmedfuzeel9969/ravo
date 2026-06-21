/**
 * Super Admin Dashboard — widgets + charts
 */
const AdminHub = {
  app: null,

  init(app) {
    this.app = app;
    document.getElementById('AdminPageBack')?.addEventListener('click', () => InteractionUI.showPage('map'));
    document.querySelectorAll('.admin-widget').forEach((w) => {
      w.addEventListener('click', () => w.classList.toggle('admin-widget--expanded'));
    });
  },

  async load() {
    const root = document.getElementById('AdminDashboard');
    if (!root) return;
    if (RoleHub.role !== 'superadmin') {
      root.innerHTML = '<p class="empty-msg">Super Admin رول منتخب کریں</p>';
      return;
    }

    root.innerHTML = '<p class="empty-msg">لوڈ...</p>';
    try {
      const d = await ApiClient.getAdminDashboard();
      root.innerHTML = `
        <div class="admin-widgets">
          <div class="admin-widget admin-widget--expanded" data-w="stats">
            <h3>📊 Live Stats</h3>
            <div class="admin-stat-grid">
              ${this.statTile('👥', d.totals.users, 'صارف')}
              ${this.statTile('🚕', d.totals.drivers, 'ڈرائیور')}
              ${this.statTile('🟢', d.totals.onlineDrivers, 'Online')}
              ${this.statTile('📅', d.totals.bookings, 'بکنگ')}
              ${this.statTile('💰', '₨'+d.totals.revenue, 'آمدنی')}
              ${this.statTile('📢', d.totals.ads, 'اشتہار')}
            </div>
          </div>
          <div class="admin-widget" data-w="bookings">
            <h3>📈 بکنگز</h3>
            <div id="ChartBookings"></div>
          </div>
          <div class="admin-widget" data-w="trips">
            <h3>📊 ہفتہ وار سفر</h3>
            <div id="ChartWeekly"></div>
          </div>
          <div class="admin-widget" data-w="regions">
            <h3>🌍 علاقے</h3>
            <div id="ChartRegions"></div>
          </div>
          <div class="admin-widget" data-w="revenue">
            <h3>💵 آمدنی</h3>
            <div id="ChartRevenue"></div>
          </div>
          <div class="admin-widget" data-w="drivers">
            <h3>🚗 گاڑیاں</h3>
            <div id="ChartDrivers"></div>
          </div>
        </div>`;

      Charts.donut(document.getElementById('ChartBookings'), [
        { label: 'فعال', value: d.bookingsByStatus.active || 0, color: '#2563eb' },
        { label: 'مکمل', value: d.bookingsByStatus.completed || 0, color: '#16a34a' },
        { label: 'منسوخ', value: d.bookingsByStatus.cancelled || 0, color: '#dc2626' }
      ]);
      Charts.bars(document.getElementById('ChartWeekly'), d.weeklyTrips, ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
      Charts.donut(document.getElementById('ChartRegions'), d.regions.map((r, i) => ({
        label: r.name, value: r.pct, color: ['#2563eb','#16a34a','#ea580c','#7c3aed'][i]
      })));
      Charts.bars(document.getElementById('ChartRevenue'), d.weeklyRevenue, ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], '#16a34a');
      Charts.donut(document.getElementById('ChartDrivers'), [
        { label: 'سفر', value: d.driversByType.ride || 0, color: '#2563eb' },
        { label: 'سامان', value: d.driversByType.cargo || 0, color: '#ea580c' }
      ]);
    } catch (e) {
      root.innerHTML = `<p class="empty-msg">${e.message}</p>`;
    }
  },

  statTile(icon, val, label) {
    return `<div class="admin-stat-tile"><span class="admin-stat-tile__icon">${icon}</span><strong>${val}</strong><small>${label}</small></div>`;
  }
};
