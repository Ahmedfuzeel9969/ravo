/**
 * P2P Transport — مستقل ایپ کنفیگریشن
 * تمام ماڈیولز، زیلی باریں، اور ڈیٹا یہاں مرکزی طور پر منظم ہیں
 */
const AppConfig = {
  defaultCenter: [31.5204, 74.3587],
  defaultZoom: 13,
  geocodeUrl: 'https://nominatim.openstreetmap.org/search',
  currency: '₨',
  apiBaseUrl: typeof EnvConfig !== 'undefined' ? EnvConfig.apiBaseUrl : '/api',
  defaultUserId: 'user-1',

  mapModules: ['home', 'ride', 'cargo', 'map', 'bookings'],

  modules: {
    home: {
      showMap: true,
      showVehicleZone: true,
      subBarId: 'HomeSubMenu',
      content: null
    },
    ride: {
      showMap: true,
      showVehicleZone: true,
      subBarId: 'RideSubMenu',
      content: null
    },
    cargo: {
      showMap: true,
      showVehicleZone: true,
      subBarId: 'CargoSubMenu',
      content: null
    },
    bookings: {
      showMap: true,
      showVehicleZone: false,
      subBarId: 'BookingsSubMenu',
      apiModule: 'bookings'
    },
    map: {
      showMap: true,
      showVehicleZone: true,
      subBarId: 'MapSubMenu',
      content: null
    },
    history: {
      showMap: false,
      showVehicleZone: false,
      subBarId: null,
      apiModule: 'history'
    },
    finance: {
      showMap: false,
      showVehicleZone: false,
      subBarId: null,
      apiModule: 'finance'
    },
    favorites: {
      showMap: false,
      showVehicleZone: false,
      subBarId: null,
      content: {
        title: 'پسندیدہ',
        body: 'محفوظ ڈرائیورز، راستے اور گاڑیاں۔',
        stats: [
          { label: 'ڈرائیور', value: '6' },
          { label: 'راستے', value: '4' },
          { label: 'گاڑیاں', value: '3' }
        ]
      }
    },
    fleet: {
      showMap: false,
      showVehicleZone: false,
      subBarId: null,
      apiModule: 'fleet'
    },
    notifications: {
      showMap: false,
      showVehicleZone: false,
      subBarId: null,
      content: {
        title: 'اطلاعات',
        body: 'سفر، سامان اور سسٹم الرٹس۔',
        stats: [
          { label: 'نئی', value: '3' },
          { label: 'پڑھی ہوئی', value: '24' },
          { label: 'کل', value: '27' }
        ]
      }
    },
    safety: {
      showMap: false,
      showVehicleZone: false,
      subBarId: null,
      content: {
        title: 'حفاظت',
        body: 'SOS، سفر شیئرنگ اور ایمرجنسی رابطے۔',
        stats: [
          { label: 'SOS', value: 'فعال' },
          { label: 'شیئرڈ', value: '2' },
          { label: 'الرٹ', value: '0' }
        ]
      }
    },
    profile: {
      showMap: false,
      showVehicleZone: false,
      subBarId: null,
      apiModule: 'profile'
    }
  },

  subBars: {
    HomeSubMenu: [
      { id: 'nearby', label: 'قریبی گاڑیاں', highlight: true },
      { id: 'quick-book', label: 'فوری بکنگ' },
      { id: 'offers', label: 'آج کے آفر' },
      { id: 'share-location', label: 'لوکیشن شیئر' },
      { id: 'saved-places', label: 'محفوظ مقامات' }
    ],
    RideSubMenu: [
      { id: 'instant', label: 'فوری سفر', highlight: true },
      { id: 'scheduled', label: 'شیڈول سفر' },
      { id: 'regular', label: 'مستقل سفر' },
      { id: 'group', label: 'گروپ سفر' },
      { id: 'negotiate', label: 'بات چیت سے کرایہ' }
    ],
    CargoSubMenu: [
      { id: 'small', label: 'چھوٹا سامان', highlight: true },
      { id: 'home-move', label: 'گھر کی منتقلی' },
      { id: 'office', label: 'دفتری / صنعتی' },
      { id: 'heavy', label: 'مزدا / ٹرک / ٹریلر' }
    ],
    BookingsSubMenu: [
      { id: 'active', label: 'فعال بکنگ', highlight: true },
      { id: 'upcoming', label: 'آنے والی' },
      { id: 'completed', label: 'مکمل' },
      { id: 'cancelled', label: 'منسوخ' }
    ],
    MapSubMenu: [
      { id: 'standard', label: 'نارمل نقشہ', highlight: true },
      { id: 'satellite', label: 'سیٹلائٹ' },
      { id: 'traffic', label: 'ٹریفک' },
      { id: 'my-location', label: 'میری جگہ' }
    ]
  },

  moreMenuActions: {
    settings: { title: 'سیٹنگز', body: 'نوٹیفکیشن، پرائیویسی اور اکاؤنٹ سیٹنگز۔' },
    language: { title: 'زبان', body: 'اردو / English زبان منتخب کریں۔' },
    legal: { title: 'قانونی معلومات', body: 'Terms of Service اور Privacy Policy۔' },
    support: { title: 'سپورٹ', body: 'رابطہ: support@p2ptransport.pk | 0800-12345' },
    logout: { title: 'لاگ آؤٹ', body: 'کیا آپ واقعی لاگ آؤٹ کرنا چاہتے ہیں؟' }
  }
};
