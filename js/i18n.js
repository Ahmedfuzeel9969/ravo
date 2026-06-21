const I18n = {
  lang: localStorage.getItem('p2p-lang') || 'ur',

  languages: [
    { id: 'ur', label: 'اردو', flag: '🇵🇰' },
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'pa', label: 'پنجابی', flag: '🇵🇰' }
  ],

  strings: {
    ur: {
      home: 'ہوم', ride: 'سفر', cargo: 'سامان', search: 'تلاش',
      destination: 'منزل', pickup: 'موجودہ مقام', book: 'بک',
      womenOnly: 'خواتین سفر', safeRide: 'محفوظ سفر', sos: 'SOS',
      chat: 'چیٹ', bid: 'بولی', pay: 'ادائیگی', share: 'شیئر',
      farePredict: 'AI کرایہ', carbon: 'CO₂ بچت', fleet: 'فلیٹ',
      jazzcash: 'JazzCash', easypaisa: 'Easypaisa', kyc: '✓ تصدیق شدہ',
      multiStop: 'اضافی منزل', scheduled: 'شیڈول', recurring: 'مستقل'
    },
    en: {
      home: 'Home', ride: 'Ride', cargo: 'Cargo', search: 'Search',
      destination: 'Destination', pickup: 'Pickup', book: 'Book',
      womenOnly: 'Women Only', safeRide: 'Safe Ride', sos: 'SOS',
      chat: 'Chat', bid: 'Bid', pay: 'Pay', share: 'Share',
      farePredict: 'AI Fare', carbon: 'CO₂ Saved', fleet: 'Fleet',
      jazzcash: 'JazzCash', easypaisa: 'Easypaisa', kyc: '✓ Verified',
      multiStop: 'Extra stop', scheduled: 'Schedule', recurring: 'Recurring'
    },
    pa: {
      home: 'گھر', ride: 'سفر', cargo: 'سامان', search: 'لبو',
      destination: 'منزل', pickup: 'توں', book: 'بک',
      womenOnly: 'زنانیاں', safeRide: 'محفوظ', sos: 'SOS',
      chat: 'گل بات', bid: 'بولی', pay: 'ادائیگی', share: 'شیئر',
      farePredict: 'AI کرایہ', carbon: 'CO₂', fleet: 'فلیٹ',
      jazzcash: 'JazzCash', easypaisa: 'Easypaisa', kyc: '✓ تصدیق',
      multiStop: 'ہور منزل', scheduled: 'شیڈول', recurring: 'مستقل'
    }
  },

  t(key) {
    return this.strings[this.lang]?.[key] || this.strings.ur[key] || key;
  },

  getLangMeta(id) {
    return this.languages.find((l) => l.id === id) || this.languages[0];
  },

  setLang(lang) {
    this.lang = lang;
    localStorage.setItem('p2p-lang', lang);
    document.documentElement.lang = lang === 'en' ? 'en' : 'ur';
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }
};
