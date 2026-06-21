/**
 * Smart Search Engine — POI (OSM) + Map AI Assistant + Auto Negotiation
 */
const store = require('./db');

const POI_CATEGORIES = {
  mosque: { icon: '🕌', label: 'مسجد', query: 'mosque', amenity: 'place_of_worship' },
  school: { icon: '🏫', label: 'اسکول', query: 'school', amenity: 'school' },
  fuel: { icon: '⛽', label: 'پٹرول پمپ', query: 'petrol fuel', amenity: 'fuel' },
  hotel: { icon: '🏨', label: 'ہوٹل', query: 'hotel', tourism: 'hotel' },
  hospital: { icon: '🏥', label: 'ہسپتال', query: 'hospital', amenity: 'hospital' },
  market: { icon: '🛒', label: 'مارکیٹ', query: 'market bazaar', shop: 'mall' },
  restaurant: { icon: '🍽️', label: 'ریستوران', query: 'restaurant', amenity: 'restaurant' },
  bank: { icon: '🏦', label: 'بینک', query: 'bank', amenity: 'bank' },
  all: { icon: '📍', label: 'سب', query: '', amenity: null }
};

const LAHORE_POIS = [
  { name: 'بادشاہی مسجد', category: 'mosque', lat: 31.588, lng: 74.310, address: 'لاہور قلعہ' },
  { name: 'فیصل مسجد', category: 'mosque', lat: 31.520, lng: 74.358, address: 'شاہراہ-e-فیصل' },
  { name: 'لی مارکیٹ', category: 'market', lat: 31.549, lng: 74.329, address: 'ملتان روڈ' },
  { name: 'انارکلی بازار', category: 'market', lat: 31.568, lng: 74.312, address: 'انارکلی' },
  { name: 'گلبرگ', category: 'market', lat: 31.515, lng: 74.342, address: 'گلبرگ III' },
  { name: 'ماڈل ٹاؤن', category: 'market', lat: 31.492, lng: 74.325, address: 'ماڈل ٹاؤن' },
  { name: 'DHA Phase 5', category: 'market', lat: 31.468, lng: 74.405, address: 'DHA' },
  { name: 'الامہڑ اڈا', category: 'market', lat: 31.549, lng: 74.338, address: 'الامہڑ' },
  { name: 'Services Hospital', category: 'hospital', lat: 31.558, lng: 74.318, address: 'Services Hospital' },
  { name: 'Jinnah Hospital', category: 'hospital', lat: 31.472, lng: 74.305, address: 'جوہر ٹاؤن' },
  { name: 'Aitchison College', category: 'school', lat: 31.556, lng: 74.329, address: 'ملتان روڈ' },
  { name: 'LGS', category: 'school', lat: 31.510, lng: 74.348, address: '55 Main Gulberg' },
  { name: 'PSO Pump Gulberg', category: 'fuel', lat: 31.512, lng: 74.345, address: 'گلبرگ' },
  { name: 'Shell MM Alam', category: 'fuel', lat: 31.518, lng: 74.352, address: 'MM Alam Road' },
  { name: 'Pearl Continental', category: 'hotel', lat: 31.549, lng: 74.338, address: 'شارع Quaid-e-Azam' },
  { name: 'Nishat Hotel', category: 'hotel', lat: 31.505, lng: 74.358, address: 'گلبرگ' },
  { name: 'لبرٹی مارکیٹ', category: 'market', lat: 31.556, lng: 74.318, address: 'لبرٹی' },
  { name: 'جوہر ٹاؤن', category: 'market', lat: 31.468, lng: 74.278, address: 'جوہر ٹاؤن' }
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function nominatimSearch(q, lat, lng, limit = 12) {
  const params = new URLSearchParams({
    q: `${q} Lahore Pakistan`,
    format: 'json',
    limit: String(limit),
    countrycodes: 'pk',
    addressdetails: '1'
  });
  if (lat != null) {
    params.set('viewbox', `${lng - 0.15},${lat + 0.15},${lng + 0.15},${lat - 0.15}`);
    params.set('bounded', '1');
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'P2P-Transport-App/1.0', Accept: 'application/json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r) => ({
      id: `nom-${r.place_id}`,
      name: r.display_name.split(',')[0],
      fullName: r.display_name,
      category: detectCategory(r),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      address: r.display_name.split(',').slice(0, 3).join(', '),
      source: 'osm'
    }));
  } catch {
    return [];
  }
}

function detectCategory(r) {
  const t = `${r.type} ${r.class} ${JSON.stringify(r.address || {})}`.toLowerCase();
  if (/mosque|masjid|worship|مسجد/.test(t)) return 'mosque';
  if (/school|college|university|اسکول/.test(t)) return 'school';
  if (/fuel|petrol|gas/.test(t)) return 'fuel';
  if (/hotel|hostel/.test(t)) return 'hotel';
  if (/hospital|clinic/.test(t)) return 'hospital';
  if (/market|mall|shop|bazaar/.test(t)) return 'market';
  return 'place';
}

function searchLocalPOIs(q, lat, lng, category, limit = 15) {
  const ql = (q || '').toLowerCase();
  let results = LAHORE_POIS.filter((p) => {
    if (category && category !== 'all' && p.category !== category) return false;
    if (!ql) return true;
    return `${p.name} ${p.address} ${p.category}`.toLowerCase().includes(ql);
  });

  if (lat != null && lng != null) {
    results = results.map((p) => ({
      ...p,
      distanceKm: Math.round(haversineKm(lat, lng, p.lat, p.lng) * 10) / 10
    })).sort((a, b) => a.distanceKm - b.distanceKm);
  }

  return results.slice(0, limit).map((p) => ({
    ...p,
    icon: POI_CATEGORIES[p.category]?.icon || '📍',
    label: POI_CATEGORIES[p.category]?.label || p.category,
    source: 'local'
  }));
}

function cleanPlaceQuery(message, category) {
  let q = message
    .replace(/(\d+)\s*(روپے|rs|₨|rupee|fare|کرایہ)/gi, '')
    .replace(/\s*(بک کرو|بکنگ|booking|book|negotiat|طے)\s*/gi, ' ')
    .replace(/\s*(قریبی|nearby|near|ڈھونڈو|ڈھونڈ|تلاش کرو|تلاش|find|search|دکھاؤ|show|list|کہاں|where)\s*/gi, ' ')
    .replace(/\s*(جانا|جاؤ|go|take me|لے چلو|راستہ)\s*/gi, ' ')
    .replace(/\s*(سے|from|تک|to|→)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!q || q.length < 2) {
    const catWord = POI_CATEGORIES[category]?.label;
    if (catWord && category !== 'all') return catWord;
  }
  return q;
}

function isOffTopic(message) {
  const m = message.trim();
  const onTopic = /سفر|travel|ride|بک|book|گاڑ|vehicle|driver|ڈرائیور|نقش|map|nav|نیب|راست|route|منزل|destination|کرای|fare|سامان|cargo|مسجد|mosque|market|مارکی|ہوٹل|hotel|building|بلڈ|عمارت|tower|plaza|تلاش|search|find|ڈھونڈ|GPS|ETA|pool|tracking|بکنگ|pickup|drop|wait|انتظار|مشور|suggest|taxi|careem|پٹرول|fuel|اسکول|school|ہسپتال|hospital|negotiat|طے|رہوں|بدل|switch|available|دستیاب|بکنگ|کروا|کرو/i;
  if (onTopic.test(m)) return false;

  const offTopic = /موسم|weather|کھیل|sport|سیاست|politic|جوک|joke|کہانی|story|recipe|پکوان|film|movie|song|gossip|general|عام علم|ریاضی|math|history|تاریخ|news|خبر|hello|how are|آپ کیسے|کیا حال|who is|کون ہے|what is life|philosophy/i;
  return offTopic.test(m);
}

function buildTravelContext(userId, lat, lng, tripContext = {}) {
  const profile = store.getUserTravelProfile(userId);
  const global = store.getGlobalTripInsights();
  const drivers = store.getDrivers({ lat, lng, onlineOnly: true, limit: 20 }).drivers || [];
  const nearbyDrivers = drivers.slice(0, 5);

  let routeInsight = null;
  const dest = tripContext.destination || profile.active?.destination;
  const pickup = tripContext.pickup || profile.active?.pickup;
  if (pickup && dest) {
    const key = `${pickup}→${dest}`;
    routeInsight = global.popularRoutes.find(
      (r) => `${r.pickup}→${r.destination}`.includes(pickup.slice(0, 4))
        || `${r.pickup}→${r.destination}`.includes(dest.slice(0, 4))
    );
  }

  return { profile, global, nearbyDrivers, routeInsight, tripContext };
}

function adviseFromContext(ctx, message) {
  const ml = message.toLowerCase();
  const { profile, global, nearbyDrivers, routeInsight } = ctx;
  const lines = [];

  if (/بدل|switch|change.*driver|گاڑی بدل/.test(ml)) {
    if (profile.active) {
      lines.push(`⚠️ آپ کا فعال سفر ${profile.active.driverName} (${profile.active.vehicle}) کے ساتھ ہے۔`);
      lines.push('تبدیلی سے اضافی انتظار ہو سکتا ہے۔ اگر کوئی مسئلہ نہیں تو انہی کے ساتھ رہیں۔');
    } else {
      lines.push(`قریب ${nearbyDrivers.length} آن لائن گاڑیاں ہیں۔`);
      if (nearbyDrivers[0]) {
        lines.push(`سب سے قریب: ${nearbyDrivers[0].name} — ${nearbyDrivers[0].vehicle} (${nearbyDrivers[0].distance}km)`);
      }
    }
    return lines.join('\n');
  }

  if (/رہوں|wait|انتظار|کب|when|available|دستیاب/.test(ml)) {
    if (profile.active) {
      lines.push(`✅ ${profile.active.driverName} آپ کے سفر میں منسلک ہیں — انہیں رہنے دیں۔`);
      lines.push(`راستہ: ${profile.active.pickup} → ${profile.active.destination} · ₨${profile.active.fare}`);
    } else if (nearbyDrivers.length) {
      const d = nearbyDrivers[0];
      lines.push(`${d.name} (${d.vehicle}) ~${d.eta} منٹ میں پہنچ سکتے ہیں۔`);
      lines.push(`دیگر ${nearbyDrivers.length - 1} ڈرائیور بھی قریب ہیں۔`);
    } else {
      lines.push('اس وقت قریب کوئی آن لائن گاڑی نہیں — 2-3 منٹ بعد دوبارہ دیکھیں۔');
    }
    return lines.join('\n');
  }

  if (/مشور|suggest|کیا کرو|best|اچھا|suitable/.test(ml) || profile.active) {
    if (profile.active) {
      lines.push(`📍 فعال سفر: ${profile.active.pickup} → ${profile.active.destination}`);
      lines.push(`🚕 ${profile.active.driverName} · ${profile.active.vehicle} — انہیں رہنے کی سفارش`);
    }
    if (profile.frequentRoute) {
      lines.push(`📊 آپ کا اکثر راستہ: ${profile.frequentRoute}`);
    }
    if (routeInsight) {
      lines.push(`👥 دیگر مسافروں کا تجربہ: ${routeInsight.pickup}→${routeInsight.destination} اوسط ₨${routeInsight.avgFare} (${routeInsight.count} سفر)`);
    } else if (global.popularRoutes[0]) {
      const r = global.popularRoutes[0];
      lines.push(`🌍 مقبول راستہ: ${r.pickup}→${r.destination} · اوسط ₨${r.avgFare}`);
    }
    if (global.avgFareAll) {
      lines.push(`📈 پلیٹ فارم اوسط کرایہ: ₨${global.avgFareAll}`);
    }
    return lines.length ? lines.join('\n') : null;
  }

  return null;
}

module.exports = {
  getCategories() {
    return Object.entries(POI_CATEGORIES).map(([id, c]) => ({ id, icon: c.icon, label: c.label }));
  },

  async searchPOI({ q = '', lat, lng, category = 'all', limit = 15 }) {
    const userLat = lat != null ? parseFloat(lat) : 31.52;
    const userLng = lng != null ? parseFloat(lng) : 74.35;
    const ql = (q || '').toLowerCase().trim();
    let categoryFromQuery = false;

    const detect = (cat, pattern, keywordOnly) => {
      if (pattern.test(ql)) {
        category = cat;
        categoryFromQuery = keywordOnly ? keywordOnly.test(ql) : false;
        return true;
      }
      return false;
    };

    if (category === 'all' && ql) {
      if (detect('mosque', /مسجد|masjid|mosque/, /^(مسجد|masjid|mosque)$/)) { /* set */ }
      else if (detect('school', /اسکول|school|college|university/, /^(اسکول|school|college)$/)) { /* set */ }
      else if (detect('fuel', /پٹرول|petrol|fuel|pump|gas/, /^(پٹرول\s*پمپ?|petrol|fuel|pump|gas)$/)) { /* set */ }
      else if (detect('hotel', /ہوٹل|hotel/, /^(ہوٹل|hotel)$/)) { /* set */ }
      else if (detect('hospital', /ہسپتال|hospital|clinic/, /^(ہسپتال|hospital|clinic)$/)) { /* set */ }
      else if (/مارکیٹ|market|bazaar|mall/.test(ql) && /^(مارکیٹ|market|bazaar|mall)$/.test(ql)) {
        category = 'market';
        categoryFromQuery = true;
      }
      else if (detect('restaurant', /ریستوران|restaurant|food/, /^(ریستوران|restaurant|food)$/)) { /* set */ }
      else if (detect('bank', /بینک|bank|atm/, /^(بینک|bank|atm)$/)) { /* set */ }
    }

    const searchQ = categoryFromQuery || !q ? '' : q;

    let local = searchLocalPOIs(searchQ, userLat, userLng, category, limit);
    let remote = [];

    if (searchQ.length >= 2) {
      const catQ = category !== 'all' ? `${POI_CATEGORIES[category]?.query || ''} ${searchQ}` : searchQ;
      remote = await nominatimSearch(catQ.trim(), userLat, userLng, limit);
      remote.forEach((r) => {
        r.distanceKm = Math.round(haversineKm(userLat, userLng, r.lat, r.lng) * 10) / 10;
        r.icon = POI_CATEGORIES[r.category]?.icon || POI_CATEGORIES[category]?.icon || '📍';
        r.label = POI_CATEGORIES[r.category]?.label || 'جگہ';
      });
    } else if (category !== 'all') {
      local = searchLocalPOIs('', userLat, userLng, category, limit);
    }

    const merged = [...local];
    remote.forEach((r) => {
      if (!merged.some((m) => Math.abs(m.lat - r.lat) < 0.001 && m.name === r.name)) {
        merged.push(r);
      }
    });

    return merged.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999)).slice(0, limit);
  },

  parseIntent(message) {
    const m = message.trim();
    const ml = m.toLowerCase();

    const fareMatch = m.match(/(\d+)\s*(روپے|rs|₨|rupee|fare|کرایہ)/i);
    const maxFare = fareMatch ? parseInt(fareMatch[1], 10) : null;

    const bookIntent = /بک|book|کرایہ|booking|بکنگ|طے|negotiat/.test(ml);
    const searchIntent = /ڈھونڈ|تلاش|find|search|کہاں|قریبی|near|دکھاؤ|show|list/.test(ml);
    const goIntent = /جانا|جاؤ|go|take me|لے چلو|راستہ/.test(ml);

    let category = 'all';
    for (const [id, c] of Object.entries(POI_CATEGORIES)) {
      if (id === 'all') continue;
      if (ml.includes(id) || ml.includes(c.label) || ml.includes(c.query.split(' ')[0])) {
        category = id;
        break;
      }
    }
    if (/مسجد|masjid|mosque/.test(ml)) category = 'mosque';
    if (/اسکول|school|college/.test(ml)) category = 'school';
    if (/پٹرول|petrol|fuel|pump/.test(ml)) category = 'fuel';
    if (/ہوٹل|hotel/.test(ml)) category = 'hotel';
    if (/ہسپتال|hospital/.test(ml)) category = 'hospital';
    if (/مارکیٹ|market|bazaar|لی مارکیٹ|liberty|گulberg|gulberg|dha|ماڈل/.test(ml)) category = 'market';
    if (/بلڈ|building|عمارت|tower|plaza|complex|سنٹر|center/.test(ml)) category = 'all';

    let pickup = null;
    let destination = null;
    const fromTo = m.match(/(.+?)\s+(?:سے|from)\s+(.+?)(?:\s+(?:تک|to|→|جانا|جاؤ|بک|book|\d))/i)
      || m.match(/(.+?)\s+(?:سے|from)\s+(.+)/i);
    if (fromTo) {
      pickup = fromTo[1].replace(/^(میں|me|I)\s+/i, '').trim();
      destination = fromTo[2].trim();
    } else {
      const toOnly = m.match(/(?:تک|to|→|جانا)\s+(.+)/i);
      if (toOnly) destination = toOnly[1].trim();
    }

    const placeQuery = cleanPlaceQuery(m, category);

    return { bookIntent, searchIntent, goIntent, category, maxFare, pickup, destination, placeQuery, raw: m };
  },

  async aiChat(userId, { message, lat, lng, history = [], tripContext = {} }) {
    if (isOffTopic(message)) {
      return {
        offTopic: true,
        reply: '🚫 معذرت — میں صرف **نقشہ، سفر، گاڑی، بکنگ اور منزل** سے متعلق مدد کرتا ہوں۔\nمثال: "قریبی مسجد"، "لی مارکیٹ بک کرو"، "کیا اس گاڑی میں رہوں؟"',
        actions: [],
        intent: { offTopic: true }
      };
    }

    const intent = this.parseIntent(message);
    const userLat = lat || 31.52;
    const userLng = lng || 74.35;
    const ctx = buildTravelContext(userId, userLat, userLng, tripContext);
    const actions = [];
    const adviseIntent = /رہوں|بدل|wait|انتظار|مشور|suggest|recommend|stay|switch|کیا اس|گاڑی میں|کون سی گاڑی|should i/i;

    if (intent.bookIntent && (intent.pickup || intent.destination || intent.maxFare)) {
      const neg = await this.aiNegotiateBooking(userId, {
        pickup: intent.pickup || tripContext.pickup || 'موجودہ مقام',
        destination: intent.destination || intent.placeQuery || tripContext.destination || 'منزل',
        maxFare: intent.maxFare || 500,
        lat: userLat,
        lng: userLng
      });
      return {
        reply: neg.summary,
        actions: neg.actions,
        negotiation: neg.negotiation,
        booking: neg.booking,
        contextUsed: true
      };
    }

    if (adviseIntent.test(message)) {
      const advice = adviseFromContext(ctx, message);
      if (advice) return { reply: advice, actions: [], intent, contextUsed: true };
    }

    if (intent.searchIntent || intent.category !== 'all' || (intent.placeQuery.length > 1 && !adviseIntent.test(message))) {
      const browseOnly = intent.searchIntent && intent.category !== 'all' &&
        (!intent.placeQuery || intent.placeQuery === POI_CATEGORIES[intent.category]?.label);
      const q = browseOnly ? '' : (intent.placeQuery || '');
      const cat = intent.category !== 'all' ? intent.category : 'all';
      const pois = await this.searchPOI({ q, lat: userLat, lng: userLng, category: cat });
      let reply = '';
      if (pois.length) {
        reply = `📍 ${pois.length} نتائج ملے${intent.category !== 'all' ? ` (${POI_CATEGORIES[intent.category]?.label})` : ''}:`;
        pois.slice(0, 5).forEach((p, i) => { reply += `\n${i + 1}. ${p.icon} ${p.name} — ${p.distanceKm ?? '?'}km`; });
        actions.push({ type: 'show_pois', pois });
        if (intent.goIntent && pois[0]) {
          actions.push({ type: 'select_destination', poi: pois[0] });
          reply += `\n\n✅ "${pois[0].name}" نقشے پر سیٹ کر دیا۔`;
        }
        if (/بک|book/.test(message)) {
          reply += '\n\n💡 بکنگ کے لیے کہیں: "یہاں سے [منزل] 350 روپے بک کرو"';
        }
      } else {
        reply = '😕 کوئی نتیجہ نہیں ملا۔ دوسرا نام آزمائیں۔';
      }
      return { reply, actions, intent, contextUsed: true };
    }

    if (intent.destination) {
      const pois = await this.searchPOI({ q: intent.destination, lat: userLat, lng: userLng });
      if (pois[0]) {
        actions.push({ type: 'select_destination', poi: pois[0] });
        if (intent.pickup) {
          const fromPois = await this.searchPOI({ q: intent.pickup, lat: userLat, lng: userLng });
          if (fromPois[0]) actions.push({ type: 'select_pickup', poi: fromPois[0] });
        }
        const reply = `🗺️ راستہ: ${intent.pickup || 'یہاں'} → ${pois[0].name}. نقشے پر دکھایا۔`;
        return { reply, actions, intent, contextUsed: true };
      }
      return { reply: `"${intent.destination}" نہیں ملا۔ مزید تفصیل دیں۔`, actions: [], intent };
    }

    const advice = adviseFromContext(ctx, message);
    if (advice) {
      return { reply: advice, actions: [], intent, contextUsed: true };
    }

    let reply = `🤖 میں آپ کا **سفر AI** ہوں — صرف نقشہ، گاڑی اور بکنگ:`;
    if (ctx.profile.active) {
      reply += `\n\n📍 فعال: ${ctx.profile.active.pickup} → ${ctx.profile.active.destination} (${ctx.profile.active.driverName})`;
    }
    if (ctx.profile.recent.length) {
      reply += `\n📋 حالیہ: ${ctx.profile.recent[0].pickup} → ${ctx.profile.recent[0].destination}`;
    }
    reply += `\n\n• "قریبی مسjid ڈھونڈو"
• "فلاں بلڈنگ تلاش کرو"
• "لی مارکیٹ سے گلبرگ 350 روپے بک کرو"
• "کیا اس گاڑی میں رہوں؟"`;
    return { reply, actions: [], intent, contextUsed: true };
  },

  async aiNegotiateBooking(userId, { pickup, destination, maxFare = 500, lat, lng }) {
    const drivers = store.getDrivers({ lat, lng, onlineOnly: false, limit: 4 }).drivers || [];
    const negotiation = [];
    const budget = maxFare || 500;

    for (const d of drivers) {
      const base = Math.min(d.fare, budget);
      const counter = Math.round(base * (0.82 + Math.random() * 0.22));
      const accepted = counter <= budget;
      negotiation.push({
        driverId: d.id,
        driverName: d.name,
        vehicle: d.vehicle,
        sent: `🤖 AI: ${pickup} → ${destination}, ₨${budget} میں OK؟`,
        reply: accepted
          ? `✅ ${d.name}: ٹھیک ہے ₨${counter}!`
          : `💬 ${d.name}: ₨${counter} (آپ کا بجٹ ₨${budget} ہے)`,
        offered: counter,
        accepted
      });
    }

    const acceptedOffers = negotiation.filter((n) => n.accepted).sort((a, b) => a.offered - b.offered);
    const winner = acceptedOffers[0] || null;

    let booking = null;
    let destPoi = null;
    let pickupPoi = null;

    if (winner) {
      try {
        const destResults = await this.searchPOI({ q: destination, lat, lng, limit: 1 });
        const pickupResults = pickup && pickup !== 'موجودہ مقام'
          ? await this.searchPOI({ q: pickup, lat, lng, limit: 1 })
          : [];
        destPoi = destResults[0] || { name: destination, lat: lat + 0.02, lng: lng + 0.02 };
        pickupPoi = pickupResults[0] || (pickup !== 'موجودہ مقام' ? { name: pickup, lat, lng } : null);

        booking = store.createBooking({
          userId,
          driverId: winner.driverId,
          bookingType: 'ride',
          rideType: 'instant',
          pickup,
          destination,
          fare: winner.offered,
          idempotencyKey: `ai_${pickup}_${destination}_${budget}`.slice(0, 120)
        });
      } catch { /* fallback */ }
    }

    const summary = winner
      ? `✅ AI نے ${winner.driverName} سے ₨${winner.offered} پر طے کر لیا!\n${pickup} → ${destination}\n${negotiation.length} ڈرائیورز سے بات ہوئی۔`
      : `⚠️ ₨${budget} میں کوئی ڈرائیور نہ ملا۔ تھوڑا بجٹ بڑھائیں یا دوبارہ کوشش کریں۔`;

    const actions = [];
    if (winner) {
      if (pickupPoi) actions.push({ type: 'select_pickup', poi: pickupPoi });
      if (destPoi) actions.push({ type: 'select_destination', poi: destPoi });
      actions.push({ type: 'booking_done', bookingId: booking?.id, fare: winner.offered, driver: winner.driverName });
    }

    return { summary, negotiation, booking, actions };
  }
};
