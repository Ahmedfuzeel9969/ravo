/**
 * AppSideRail — دائیں عمودی لائن + گروپ باکسز
 */
const RailHub = {
  openGroupId: null,

  init() {
    this.buildLangMenu();
    this.bindGroups();
    this.syncLangBadge();
    document.addEventListener('langchange', () => this.syncLangMenu());
  },

  buildLangMenu() {
    const box = document.getElementById('LangDropdown');
    const badge = document.getElementById('LangBadge');
    if (!box) return;

    box.innerHTML = I18n.languages.map((lang) =>
      `<button type="button" class="rail-menu-item rail-menu-item--lang" data-lang="${lang.id}" role="menuitem">${lang.flag} ${lang.label}</button>`
    ).join('');

    if (badge) badge.textContent = String(I18n.languages.length);
    this.syncLangMenu();
  },

  syncLangMenu() {
    document.querySelectorAll('#LangDropdown [data-lang]').forEach((item) => {
      item.classList.toggle('rail-menu-item--active', item.dataset.lang === I18n.lang);
    });
  },

  syncLangBadge() {
    this.syncLangMenu();
  },

  bindGroups() {
    document.querySelectorAll('.rail-group').forEach((group) => {
      const btn = group.querySelector('.rail-group-btn');
      const menu = group.querySelector('.rail-group-menu');
      if (!btn || !menu) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = group.dataset.railGroup;
        const opening = menu.classList.contains('hidden');
        this.closeAll();
        if (opening) {
          this.openGroupId = groupId;
          menu.classList.remove('hidden');
          btn.setAttribute('aria-expanded', 'true');
          btn.classList.add('rail-group-btn--open');
          this.placeMenu(btn, menu);
        }
      });

      menu.addEventListener('click', (e) => {
        const langItem = e.target.closest('[data-lang]');
        if (langItem) {
          e.stopPropagation();
          I18n.setLang(langItem.dataset.lang);
          this.closeAll();
          return;
        }
        if (e.target.closest('.rail-menu-item') || e.target.closest('.rail-role-select')) {
          e.stopPropagation();
        }
      });
    });

    document.addEventListener('click', () => this.closeAll());
    window.addEventListener('resize', () => {
      if (!this.openGroupId) return;
      const group = document.querySelector(`[data-rail-group="${this.openGroupId}"]`);
      const btn = group?.querySelector('.rail-group-btn');
      const menu = group?.querySelector('.rail-group-menu');
      if (btn && menu && !menu.classList.contains('hidden')) this.placeMenu(btn, menu);
    });
  },

  placeMenu(anchor, menu) {
    const rect = anchor.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - menu.offsetHeight - 8))}px`;
    menu.style.right = `${Math.max(8, window.innerWidth - rect.left + 8)}px`;
    menu.style.left = 'auto';
  },

  closeAll() {
    document.querySelectorAll('.rail-group-menu').forEach((m) => m.classList.add('hidden'));
    document.querySelectorAll('.rail-group-btn').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
      b.classList.remove('rail-group-btn--open');
    });
    this.openGroupId = null;
  },

  openGroup(groupId) {
    const group = document.querySelector(`[data-rail-group="${groupId}"]`);
    const btn = group?.querySelector('.rail-group-btn');
    if (!btn) return;
    this.closeAll();
    btn.click();
  }
};
