/**
 * PWA & Cross-Platform Features
 * iPhone · Android · Windows · Web
 */
const PWAManager = {
  deferredPrompt: null,

  init(app) {
    this.app = app;
    this.registerServiceWorker();
    this.initTheme();
    this.initInstall();
    this.initOffline();
    this.initShare();
    this.initMobileNav();
    this.initMobileViewport();
    this.initMoreSheet();
    this.initPullToRefresh();
    this.initUrlModule();
    this.hideSplash();
  },

  registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js?v=13').then((reg) => {
      reg.update?.();
    }).catch(() => {});
  },

  initTheme() {
    const saved = localStorage.getItem('p2p-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    this.setTheme(theme);

    document.getElementById('BtnTheme')?.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      this.setTheme(next);
      this.haptic(8);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('p2p-theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('p2p-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0f172a' : '#2563eb';
    const btn = document.getElementById('BtnTheme');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  },

  initInstall() {
    const banner = document.getElementById('InstallBanner');
    const btnInstall = document.getElementById('BtnInstall');
    const btnDismiss = document.getElementById('InstallDismiss');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      banner?.classList.remove('hidden');
      btnInstall?.classList.remove('hidden');
    });

    const doInstall = async () => {
      if (!this.deferredPrompt) {
        this.app?.notify('Safari/Chrome میں "Add to Home Screen" منتخب کریں۔', 'info');
        return;
      }
      this.deferredPrompt.prompt();
      await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      banner?.classList.add('hidden');
    };

    btnInstall?.addEventListener('click', doInstall);
    document.getElementById('InstallBannerBtn')?.addEventListener('click', doInstall);
    btnDismiss?.addEventListener('click', () => banner?.classList.add('hidden'));

    if (window.matchMedia('(display-mode: standalone)').matches) {
      banner?.classList.add('hidden');
    }
  },

  initOffline() {
    const banner = document.getElementById('OfflineBanner');
    const update = () => banner?.classList.toggle('hidden', navigator.onLine);
    window.addEventListener('online', () => {
      update();
      this.app?.notify('انternet دوبارہ منسلک!', 'success');
    });
    window.addEventListener('offline', () => {
      update();
      this.app?.notify('آپ آف لائن ہیں — محفوظ موڈ', 'error');
    });
    update();
  },

  initShare() {
    document.getElementById('BtnShare')?.addEventListener('click', async () => {
      const shareData = {
        title: 'P2P Transport',
        text: 'سفر اور سامان — P2P Transport ایپ',
        url: window.location.href
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch { /* cancelled */ }
      } else {
        await navigator.clipboard?.writeText(shareData.url);
        this.app?.notify('لنک کاپی ہو گیا!', 'success');
      }
      this.haptic(10);
    });
  },

  initMobileNav() {
    document.querySelectorAll('.mobile-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const module = tab.dataset.module;
        if (module === 'more') {
          document.getElementById('MobileMoreSheet')?.classList.remove('hidden');
          return;
        }
        this.activateModule(module);
        this.haptic(6);
      });
    });

    document.querySelectorAll('.more-sheet-item').forEach((item) => {
      item.addEventListener('click', () => {
        this.activateModule(item.dataset.module);
        document.getElementById('MobileMoreSheet')?.classList.add('hidden');
        this.haptic(6);
      });
    });

    document.getElementById('MoreSheetClose')?.addEventListener('click', () => {
      document.getElementById('MobileMoreSheet')?.classList.add('hidden');
    });

    document.getElementById('MobileMoreSheet')?.addEventListener('click', (e) => {
      if (e.target.id === 'MobileMoreSheet') {
        e.currentTarget.classList.add('hidden');
      }
    });
  },

  initMobileViewport() {
    const setVh = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', () => setTimeout(setVh, 100));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setVh);
    }
  },

  initMoreSheet() {
    document.getElementById('BtnMenuMobile')?.addEventListener('click', () => {
      document.getElementById('MobileMoreSheet')?.classList.remove('hidden');
    });
  },

  activateModule(moduleName) {
    document.querySelectorAll('.nav-item[data-module]').forEach((n) => {
      n.classList.toggle('active', n.dataset.module === moduleName);
    });
    document.querySelectorAll('.mobile-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.module === moduleName);
    });
    this.app?.switchModule(moduleName);
  },

  initPullToRefresh() {
    const workspace = document.getElementById('WorkspaceContainer');
    const indicator = document.getElementById('PullRefresh');
    if (!workspace || !indicator) return;

    let startY = 0;
    let pulling = false;

    workspace.addEventListener('touchstart', (e) => {
      if (workspace.scrollTop === 0) startY = e.touches[0].clientY;
    }, { passive: true });

    workspace.addEventListener('touchmove', (e) => {
      if (startY === 0) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 60 && workspace.scrollTop === 0) {
        pulling = true;
        indicator.classList.add('pull-refresh--visible');
      }
    }, { passive: true });

    workspace.addEventListener('touchend', async () => {
      if (pulling) {
        indicator.classList.remove('pull-refresh--visible');
        this.app?.notify('تازہ کیا جا رہا ہے...', 'info');
        await this.app?.loadDrivers(this.app.currentModule === 'cargo' ? 'cargo' : 'all');
        this.haptic(12);
      }
      startY = 0;
      pulling = false;
    });
  },

  initUrlModule() {
    const params = new URLSearchParams(window.location.search);
    const mod = params.get('module');
    if (mod && this.app) {
      setTimeout(() => this.activateModule(mod), 300);
    }
  },

  hideSplash() {
    const splash = document.getElementById('SplashScreen');
    if (!splash) return;
    setTimeout(() => {
      splash.classList.add('splash--hide');
      setTimeout(() => splash.remove(), 500);
    }, 800);
  },

  haptic(ms = 10) {
    if (navigator.vibrate) navigator.vibrate(ms);
  },

  showSkeleton(container, count = 3) {
    if (!container) return;
    container.innerHTML = Array(count)
      .fill('<div class="skeleton-card"><div class="skeleton skeleton--avatar"></div><div class="skeleton skeleton--line"></div><div class="skeleton skeleton--line short"></div></div>')
      .join('');
  }
};
