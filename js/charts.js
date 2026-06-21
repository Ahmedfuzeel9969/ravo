/**
 * Simple SVG charts — text + graphics
 */
const Charts = {
  donut(container, segments, size = 80) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    let offset = 0;
    const r = 16;
    const c = 2 * Math.PI * r;
    const arcs = segments.map((seg) => {
      const pct = seg.value / total;
      const dash = pct * c;
      const arc = `<circle cx="20" cy="20" r="${r}" fill="none" stroke="${seg.color}" stroke-width="8"
        stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 20 20)"/>`;
      offset += dash;
      return arc;
    }).join('');
    container.innerHTML = `
      <svg viewBox="0 0 40 40" width="${size}" height="${size}" class="chart-donut">${arcs}</svg>
      <div class="chart-donut__legend">${segments.map((s) =>
        `<span><i style="background:${s.color}"></i>${s.label} ${Math.round((s.value / total) * 100)}%</span>`
      ).join('')}</div>`;
  },

  bars(container, values, labels, color = '#2563eb') {
    const max = Math.max(...values, 1);
    container.innerHTML = values.map((v, i) => `
      <div class="chart-bar-row">
        <span class="chart-bar-label">${labels[i] || ''}</span>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(v / max) * 100}%;background:${color}"></div></div>
        <span class="chart-bar-val">${v}</span>
      </div>
    `).join('');
  },

  statRing(container, pct, label, color = '#16a34a') {
    const r = 36;
    const c = 2 * Math.PI * r;
    const green = (pct / 100) * c;
    container.innerHTML = `
      <div class="stat-ring">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle cx="40" cy="40" r="${r}" fill="none" stroke="#fecaca" stroke-width="10"/>
          <circle cx="40" cy="40" r="${r}" fill="none" stroke="${color}" stroke-width="10"
            stroke-dasharray="${green} ${c - green}" transform="rotate(-90 40 40)"/>
          <text x="40" y="44" text-anchor="middle" font-size="14" font-weight="bold" fill="#0f172a">${pct}%</text>
        </svg>
        <span class="stat-ring__label">${label}</span>
      </div>`;
  },

  progressArc(container, pct, eta, arrival) {
    const r = 42;
    const c = 2 * Math.PI * r;
    const green = (pct / 100) * c;
    container.innerHTML = `
      <div class="trip-progress-ring">
        <svg viewBox="0 0 100 100" width="100" height="100">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="#ef4444" stroke-width="8" opacity="0.5"/>
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="#22c55e" stroke-width="8"
            stroke-dasharray="${green} ${c - green}" transform="rotate(-90 50 50)"/>
          <text x="50" y="46" text-anchor="middle" font-size="16" font-weight="bold">${pct}%</text>
          <text x="50" y="62" text-anchor="middle" font-size="9" fill="#64748b">${eta}m · ${arrival}</text>
        </svg>
      </div>`;
  }
};
