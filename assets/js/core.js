/* ============================================================
   SchoolSys — jádro: router, přihlášení, shell, tmavý režim,
   toasty, modály, ikony a globální dispatcher akcí.
   Organizace: kontaktní účet (isOrgContact) = jen PC, hlavní admin
   (isRoot) spravuje žádosti i organizace, každý si mění heslo.
   ============================================================ */
'use strict';

/* ---------- ikony (feather-style, stroke) ---------- */
const I = {
  home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  alert: '<path d="m10.3 3.9-8.2 14a2 2 0 0 0 1.7 3h16.4a2 2 0 0 0 1.7-3l-8.2-14a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  arrowR: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  chevUp: '<path d="m18 15-6-6-6 6"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  flag: '<path d="M4 22V4c0-.5.5-1 1-1h11l-2 4 2 4H5"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  swap: '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>'
};
function ic(name, size) {
  return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (I[name] || I.alert) + '</svg>';
}
function subjBadge(key, size) {
  const s = SUBJECTS[key] || { name: key, color: '#64748B' };
  const sz = size || 36;
  return '<span class="subj-badge" style="width:' + sz + 'px;height:' + sz + 'px;background:' + s.color + '" title="' + escapeHtml(s.name) + '">' + escapeHtml(subjShort(key)) + '</span>';
}
/* zkratka předmětu (M, ČJ, AJ…) – používá i rozvrh při změně předmětu */
function subjShort(key) {
  return { M: 'M', CJ: 'ČJ', AJ: 'AJ', D: 'D', F: 'FY', P: 'PŘ', TV: 'TV', HV: 'HV', INF: 'IN', Z: 'Z' }[key] || key;
}
/* barevná čipka učebny v rozvrhu (zkratka typu „A607“, celý název v tooltipu) */
function roomChip(roomId, size) {
  const r = roomsList().find(x => x.id === roomId);
  if (!r) return '';
  const sz = size || 20;
  const label = (r.short || genRoomShort(r.name, roomsList()) || '?');
  return '<span class="room-chip" style="background:' + (r.color || ROOM_DEF_COLOR) + ';font-size:' + Math.max(10, sz - 7) + 'px;height:' + sz + 'px;min-width:' + sz + 'px;padding:0 ' + Math.max(4, Math.round(sz / 4)) + 'px" title="' + escapeHtml(r.name) + '">' + escapeHtml(label) + '</span>';
}

/* ---------- akce (delegace) ---------- */
const ACT = {};
function fireAct(el) {
  const a = el.getAttribute('data-act') || el.getAttribute('data-chg');
  if (!a) return;
  if (ACT[a]) { ACT[a](el); return; }
  // prefix akce: registrovaný „t-ok:" má pokrýt atribut „t-ok:id123"
  const prefix = Object.keys(ACT).filter(k => k.endsWith(':') && a.indexOf(k) === 0).sort((x, y) => y.length - x.length)[0];
  if (prefix) { ACT[prefix](el); return; }
  if (a.indexOf('goto:') === 0) gotoHash(a.slice(5));
}
function onAct(name, fn) { ACT[name] = fn; }
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  /* Kliknutí Uvnitř modalu (data-stop) nesmí spustit akci nad modem
     (např. overlay s data-act="close-modal") – jinak se formulář zavře
     při kliknutí na libovolné pole. */
  const stop = e.target.closest('[data-stop]');
  if (stop && !stop.contains(el)) return;
  fireAct(el);
  if (e.target.closest('a[data-act]')) e.preventDefault();
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-chg]');
  if (el) fireAct(el);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const fn = ACT['form:' + f.dataset.form];
  if (fn) fn(f);
});

/* ---------- toasty & modály ---------- */
function toast(msg, kind) {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.innerHTML = msg;
  box.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 3400);
}
function openModal(innerHTML, wide) {
  let root = document.getElementById('modal-root');
  if (!root) { root = document.createElement('div'); root.id = 'modal-root'; document.body.appendChild(root); }
  root.innerHTML = '<div class="overlay" data-act="close-modal"><div class="modal' + (wide ? ' wide' : '') + '" data-stop>' + innerHTML + '</div></div>';
  const overlay = root.firstElementChild;
  overlay.addEventListener('click', ev => { if (ev.target === overlay || ev.target.getAttribute('data-close')) closeModal(); });
}
function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}
onAct('close-modal', () => closeModal());

/* ---------- navigace (hash) ---------- */
function gotoHash(h) { location.hash = h; route(); window.scrollTo({ top: 0 }); }

const VIEWS = {}; // role -> { key: renderFn }
function registerView(role, key, fn) { (VIEWS[role] = VIEWS[role] || {})[key] = fn; }

const ROLES_CS = { ucitel: 'Učitel', student: 'Žák', rodic: 'Rodič', admin: 'Správce' };
/* kontaktní účet organizace je přístupný POUZE na počítači */
function contactPcBlocked(u) { return isContactUser(u) && isAppMode(); }
const ADMIN_NAV = [{ key: 'sprava', icon: 'users', label: 'Správa školy' }];
const ROLE_NAV = {
  admin: [
    { key: 'sprava', icon: 'users', label: 'Správa školy' }
  ],
  ucitel: [
    { key: 'prehled',   icon: 'home', label: 'Přehled' },
    { key: 'dochazka',  icon: 'calendar', label: 'Docházka' },
    { key: 'klasifikace', icon: 'book', label: 'Známkování' },
    { key: 'pololetka', icon: 'check', label: 'Pololetní klasifikace' },
    { key: 'kniha',     icon: 'clipboard', label: 'Třídní kniha' },
    { key: 'zpravy',    icon: 'chat', label: 'Zprávy' },
    { key: 'omluvenky', icon: 'shield', label: 'Omluvenky' },
    { key: 'rozvrh',    icon: 'clock', label: 'Rozvrh' },
    { key: 'predmety',  icon: 'book', label: 'Předměty' },
    { key: 'ucebny',    icon: 'home', label: 'Učebny' },
    { key: 'ukoly',     icon: 'check', label: 'Úkoly' },
    { key: 'udaje',     icon: 'user', label: 'Údaje' },
    { key: 'poznamky',  icon: 'edit', label: 'Vých. opatření' },
    { key: 'planakci',  icon: 'flag', label: 'Plán akcí' },
    { key: 'hesla',     icon: 'zap', label: 'Resetování hesel' },
    { key: 'oznameni',  icon: 'bell', label: 'Oznámení' },
    { key: 'zmenyrozvrh', icon: 'alert', label: 'Změny v rozvrhu' }
  ],
  student: [
    { key: 'prehled', icon: 'home', label: 'Přehled' },
    { key: 'znamky',  icon: 'book', label: 'Známky' },
    { key: 'pololetka', icon: 'check', label: 'Pololetní klasifikace' },
    { key: 'dochazka', icon: 'calendar', label: 'Docházka' },
    { key: 'rozvrh',  icon: 'clock', label: 'Rozvrh' },
    { key: 'vyuka',   icon: 'book', label: 'Výuka' },
    { key: 'poznamky', icon: 'edit', label: 'Vých. opatření' },
    { key: 'planakci', icon: 'flag', label: 'Plán akcí' },
    { key: 'ukoly',   icon: 'check', label: 'Moje úkoly' },
    { key: 'zpravy',  icon: 'chat', label: 'Zprávy' },
    { key: 'oznameni', icon: 'bell', label: 'Oznámení' }
  ],
  rodic: [
    { key: 'prehled',   icon: 'home', label: 'Přehled' },
    { key: 'pololetka', icon: 'check', label: 'Pololetní klasifikace' },
    { key: 'dochazka', icon: 'calendar', label: 'Docházka' },
    { key: 'rozvrh',    icon: 'clock', label: 'Rozvrh' },
    { key: 'vyuka',     icon: 'book', label: 'Výuka' },
    { key: 'poznamky',  icon: 'edit', label: 'Vých. opatření' },
    { key: 'planakci',  icon: 'flag', label: 'Plán akcí' },
    { key: 'omluvenky', icon: 'shield', label: 'Omluvenky' },
    { key: 'zpravy',    icon: 'chat', label: 'Zprávy s učiteli' },
    { key: 'oznameni',  icon: 'bell', label: 'Oznámení' }
  ]
};
const DEFAULT_KEY = { ucitel: 'prehled', student: 'prehled', rodic: 'prehled', admin: 'sprava' };
/* Ředitelský (admin) účet = POUZE Správa školy. Učitel bez isAdmin vidí
   běžné moduly a Správu nikdy – ta logicky zmizí. */
function navForUser(user) {
  if (user.isAdmin && user.role === 'ucitel') return ADMIN_NAV;
  const base = ROLE_NAV[user.role] || [];
  const nav = base.filter(n => n.key !== 'sprava');
  /* kontaktní účet organizace: POUZE Správa organizace (žádné učitelské moduly) */
  if (isContactUser(user)) return [{ key: 'sprava', icon: 'users', label: 'Správa organizace' }];
  return nav;
}
function defKeyFor(user) {
  if (user && user.isAdmin && user.role === 'ucitel') return 'sprava';
  if (user && isContactUser(user)) return 'sprava';
  return DEFAULT_KEY[user.role] || 'prehled';
}

/* souhrnný odznáček „Více“ pro učitele na mobilu (čekající omluvenky + zprávy + žádosti) */
function navBadgeTotal(user) {
  if (!user || user.role !== 'ucitel' || user.isAdmin) return 0;
  return pendingExcusesFor(user).length + userUnreadMsgs(user.id) + teacherResetUnread(user.id) + annUnreadCount(user);
}
function navBadge(role, key, user) {
  if (role === 'ucitel' && user && user.isAdmin) return '';
  if (role === 'ucitel') {
    if (key === 'omluvenky') {
      const n = pendingExcusesFor(currentUser()).length;
      return n ? '<span class="nav-n badge-dot" data-n="' + n + '">' + ic('shield', 16) + '</span>' : '';
    }
    if (key === 'zpravy') {
      const n = userUnreadMsgs(user.id);
      return n ? '<span class="nav-n badge-dot" data-n="' + n + '">' + ic('chat', 16) + '</span>' : '';
    }
    if (key === 'hesla') {
      const n = teacherResetUnread(user.id);
      return n ? '<span class="nav-n badge-dot" data-n="' + n + '">' + ic('zap', 16) + '</span>' : '';
    }
    if (key === 'oznameni') {
      const n = annUnreadCount(user);
      return n ? '<span class="nav-n badge-dot" data-n="' + n + '">' + ic('bell', 16) + '</span>' : '';
    }
  }
  if ((role === 'student' || role === 'rodic') && key === 'zpravy') {
    const n = userUnreadMsgs(user.id);
    return n ? '<span class="nav-n badge-dot" data-n="' + n + '">' + ic('chat', 16) + '</span>' : '';
  }
  if ((role === 'student' || role === 'rodic') && key === 'oznameni') {
    const n = annUnreadCount(user);
    return n ? '<span class="nav-n badge-dot" data-n="' + n + '">' + ic('bell', 16) + '</span>' : '';
  }
  return '';
}

/* ---------- shell ---------- */
function shellHTML(user, activeKey) {
  const role = user.role;
  const mob = isAppMode();
  const nav = navForUser(user);
  /* Ředitel (admin) má jen Správu – bez docku a bez badge. */
  const roleLabel = (role === 'ucitel' && user.isAdmin) ? 'Ředitel'
    : isContactUser(user) ? 'Kontakt · ' + orgLabel(user.orgId)
    : ROLES_CS[role];
  const bell = (role === 'student' || role === 'rodic')
    ? '<button class="icon-btn" data-act="bell" id="bell-btn" style="position:relative">' + ic('bell', 18) +
      (notifUnreadFor(user.id) ? '<span style="position:absolute;top:-2px;right:-2px;background:var(--bad);color:#fff;border-radius:99px;min-width:15px;height:15px;font-size:10px;font-weight:900;display:grid;place-items:center;padding:0 3px">' + notifUnreadFor(user.id) + '</span>' : '') + '</button>'
    : '';
  return '' +
    '<header class="topbar">' +
      '<span class="brand"><span class="logo">' + ic('home', 15) + '</span><span class="brand-name">School<small>Sys</small></span></span>' +
      /* v režimu aplikace místo ☰ tlačítko Zpět na launcher (na launcheru žádné) */
      (mob
        ? (activeKey !== 'prehled'
            ? '<button type="button" class="icon-btn" data-act="goto:#/' + role + '/prehled" aria-label="Zpět" title="Zpět na přehled">' + ic('back', 19) + '</button>'
            : '')
        : '<button type="button" class="icon-btn nav-menu-btn" data-act="nav-menu" aria-label="Menu" title="Menu">' + ic('menu', 19) + '</button>') +
      '<div class="user-pill">' + bell +
        '<button class="icon-btn" data-act="ch-pass" title="Změnit heslo">' + ic('lock', 17) + '</button>' +
        '<button class="icon-btn" data-act="theme" title="Přepnout tmavý / světlý režim">' + ic(document.documentElement.getAttribute('data-theme') === 'light' ? 'moon' : 'sun', 17) + '</button>' +
        '<div class="user-meta"><b>' + escapeHtml(user.name) + '</b><span>' + escapeHtml(user.note || ROLES_CS[role]) + '</span></div>' +
        '<span class="ava" style="background:linear-gradient(135deg,#3B82F6,' + (role === 'rodic' ? '#10B981' : role === 'ucitel' ? '#8B5CF6' : '#F59E0B') + ')">' + escapeHtml(user.name.charAt(0)) + '</span>' +
        '<button class="icon-btn" data-act="logout" title="Odhlásit se">' + ic('logout', 17) + '</button>' +
      '</div>' +
    '</header>' +
    '<div class="layout">' +
      '<aside class="sidebar' + (role === 'ucitel' && !user.isAdmin ? ' role-ucitel' : '') + '"><div class="side-label">' + roleLabel + (role === 'ucitel' && !user.isAdmin && myClasses().length ? ' · ' + escapeHtml(classOf(activeClsId()).name) : '') + '</div>' +
        nav.map((n, i) =>
          '<button class="nav-item' + (n.key === activeKey ? ' active' : '') + '" data-act="goto:#/' + role + '/' + n.key + '">' +
            ic(n.icon, 18) + '<span>' + n.label + '</span>' + navBadge(role, n.key, user) + '</button>'
        ).join('') +
      '</aside>' +
      '<main class="main"><div id="view"></div></main>' +
    '</div>' +
    '<div class="nav-backdrop" data-act="nav-close"></div>' +
    '<div id="notif-panel"></div>';
}

/* ---------- router ---------- */
function route() {
  const user = currentUser();
  /* režim „aplikace“ se řídí šířkou + rolí (žák/rodič na telefonu i tabletu) */
  const mob = isAppMode() && !!user; // telefon/tablet = launcher pro všechny role (i učitele)
  document.body.dataset.mob = (mob ? '1' : '0');
  if (!user) {
    if (location.hash.replace(/^#\/?/, '') === 'org-request') { routeOrgRequest(); return; }
    renderLogin(); return;
  }
  const role = user.isAdmin ? 'admin' : user.role;   /* admin i kontakt = rozhoduje isAdmin, ne role */
  const isContact = isContactUser(user);
  /* kontaktní účet na mobilu/tabletu = zámek s vysvětlením */
  if (isContact && isAppMode()) { showContactMobileBlock(user); return; }
  let h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/');
  // povolíme parametr za „|" (např. #/student/znamky|M) – base klíč pro lookup
  const rawKey = parts.length > 1 && parts[0] === role ? parts[1] : null;
  const baseKey = rawKey ? rawKey.split('|')[0] : null;
  const navKeys = VIEWS[role] || {};
  const onlyAdmin = !!user.isAdmin && !isContact; // admin bez kontaktu vidí jen Správu
  const contactSpravaOnly = isContact;           /* kontaktní účet organizace = POUZE Správa organizace (žádné učitelské moduly jako docházka/známkování) */
  let useKey;
  if (baseKey && navKeys[baseKey] && (!onlyAdmin || baseKey === 'sprava') && (!contactSpravaOnly || baseKey === 'sprava')) {
    useKey = baseKey;
    if (!rawKey.includes('|')) location.hash = '#/' + role + '/' + baseKey; // normalizace
  } else {
    useKey = defKeyFor(user);
    location.hash = '#/' + role + '/' + useKey;
  }
  if (!useKey) useKey = defKeyFor(user);
  const app = document.getElementById('app');
  /* mobilní/tabletový launcher: přehled se zobrazí jako ikonky „aplikací“ */
  if (mob && useKey === 'prehled') {
    app.innerHTML = shellHTML(user, 'prehled');
    document.body.classList.remove('nav-open', 'dock-open');
    renderBell();
    document.getElementById('view').innerHTML = mobileHomeHTML(user);
    return;
  }
  app.innerHTML = shellHTML(user, useKey);
  document.body.classList.remove('nav-open', 'dock-open');
  if (user.role === 'student' || user.role === 'rodic') renderBell();
  const fn = VIEWS[role][useKey];
  if (fn) { document.getElementById('view').innerHTML = fn(user); bindView(); }
}

/* ---------- přihlášení ---------- */
function renderLogin() {
  const app = document.getElementById('app');
  document.body.classList.remove('nav-open', 'dock-open');
  const remHtml = rememberedLoginHtml();
  app.innerHTML =
    '<div class="login-wrap"><div class="login-card card">' +
      '<div class="login-brand"><span class="brand"><span class="logo" style="width:44px;height:44px;border-radius:13px;font-size:22px">' + ic('home', 20) + '</span><span class="brand-name" style="font-size:26px">School<small style="color:var(--accent)">Sys</small></span></span></div>' +
      '<h1>Vítejte zpět 👋</h1>' +
      '<p class="login-sub">Přihlaste se do aplikace.</p>' +
      '<form data-form="login">' +
        '<div class="field"><label>Uživatelské jméno</label><input name="user" autocomplete="username" placeholder="admin" required></div>' +
        '<div class="field"><label>Heslo</label><input name="pass" type="password" autocomplete="current-password" placeholder="••••••••" required></div>' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;margin:10px 0 2px"><input type="checkbox" name="remember" style="width:16px;height:16px;accent-color:var(--accent)"> Zapamatovat si účet (rychlé přihlášení)</label>' +
        '<button class="btn btn-primary" style="width:100%;margin-top:6px">' + ic('arrowR', 16) + ' Přihlásit se</button>' +
      '</form>' +
      '<button type="button" class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" data-act="forgot-pass">' + ic('zap', 15) + ' Zapomněl jsem heslo</button>' +
      (window.innerWidth >= 1024
        ? '<button type="button" class="btn btn-soft btn-sm" style="width:100%;margin-top:8px" data-act="goto:#/org-request">' + ic('plus', 15) + ' Založit organizaci</button>'
        : '') +
      (remHtml ? remHtml : '') +
      '<p class="small-note" style="text-align:center;margin-top:14px">Přihlásíte se údaji, které vám vygeneroval správce</p>' +
    '</div></div>';
}

function tryLogin(user, pass) {
  const u = (db.users || []).find(x => x.username === user);
  if (!u || !verifyPassword(u, pass)) { toast('Nesprávné uživatelské jméno nebo heslo', 'bad'); return false; }
  if (contactPcBlocked(u)) {
    toast('Kontaktní účet organizace je dostupný pouze na počítači 🖥️', 'bad');
    return false;
  }
  saveSession({ user: u.username });
  location.hash = '#/' + (u.isAdmin ? 'admin' : u.role) + '/' + defKeyFor(u);
  route();
  return true;
}
/* ---------- zapamatované účty (rychlé přihlášení pro rodiče a žáky) ---------- */
const REM_KEY = 'lukySchool.remembered';
function rememberedAccounts() {
  try { const a = JSON.parse(localStorage.getItem(REM_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function saveRemembered(list) { try { localStorage.setItem(REM_KEY, JSON.stringify(list)); } catch (e) { /* noop */ } }
function rememberAccount(username) {
  const list = rememberedAccounts().filter(x => x.username !== username);
  list.unshift({ username });
  saveRemembered(list.slice(0, 8));
}
function forgetAccount(username) { saveRemembered(rememberedAccounts().filter(x => x.username !== username)); }
function rememberedLoginHtml() {
  const list = rememberedAccounts();
  if (!list.length) return '';
  const rows = list.map(a => {
    const u = (db.users || []).find(x => x.username === a.username);
    if (!u) return '';
    const roleCz = u.role === 'rodic' ? 'Rodič' : u.role === 'student' ? 'Žák' : (u.isAdmin ? 'Ředitel' : 'Učitel');
    const grad = { rodic: '#10B981', student: '#F59E0B', ucitel: '#8B5CF6' }[u.role] || '#64748B';
    return '<div class="demo-btn" role="button" style="display:flex;align-items:center;gap:10px;cursor:pointer" data-act="quick-login:' + a.username + '">' +
      '<span class="ava" style="background:linear-gradient(135deg,#3B82F6,' + grad + ')">' + escapeHtml((u.name || a.username).charAt(0)) + '</span>' +
      '<span class="who" style="flex:1"><span>' + escapeHtml(u.name || a.username) + '<small>' + roleCz + ' · ' + escapeHtml(a.username) + '</small></span></span>' +
      '<span data-stop><button type="button" class="icon-btn sm" style="color:var(--bad)" data-act="rm-acc:' + a.username + '" title="Odstranit ze seznamu">' + ic('x', 15) + '</button></span>' +
      '</div>';
  }).join('');
  return '<div class="demo-logins" style="margin-top:12px"><b>Vaše účty</b>' + rows + '</div>';
}
onAct('form:login', f => {
  const fd = new FormData(f);
  const ok = tryLogin(String(fd.get('user')).trim(), String(fd.get('pass')));
  if (!ok) return;
  const u = currentUser();
  if (u && (u.role === 'student' || u.role === 'rodic') && fd.get('remember')) rememberAccount(u.username);
});
onAct('quick-login:', el => {
  const username = el.getAttribute('data-act').slice(12);
  const u = (db.users || []).find(x => x.username === username);
  if (!u) { forgetAccount(username); route(); toast('Účet už neexistuje – odebrán ze seznamu', 'bad'); return; }
  if (contactPcBlocked(u)) { toast('Kontaktní účet organizace je dostupný pouze na počítači 🖥️', 'bad'); return; }
  saveSession({ user: u.username });
  location.hash = '#/' + (u.isAdmin ? 'admin' : u.role) + '/' + defKeyFor(u);
  route();
  toast('Přihlášeno jako ' + escapeHtml(u.name), 'ok');
});
onAct('rm-acc:', el => {
  const username = el.getAttribute('data-act').slice(7);
  const u = (db.users || []).find(x => x.username === username);
  openModal(
    '<h3>Odstranit účet ze seznamu?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Jste si jistý/á? Účet <b>' + escapeHtml((u ? u.name : username) + ' (' + username + ')') + '</b> se už nebude nabízet k rychlému přihlášení.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="rm-acc-ok:' + username + '">' + ic('x', 14) + ' Ano, odstranit</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('rm-acc-ok:', el => {
  forgetAccount(el.getAttribute('data-act').slice(10));
  closeModal();
  route();
  toast('Účet odebrán ze seznamu', 'bad');
});
onAct('logout', () => { logout(); location.hash = ''; renderLogin(); toast('Byl jste odhlášen'); });
/* mobilní zásuvka s navigací – otevře ji ☰ vedle loga */
onAct('nav-menu', () => document.body.classList.add('nav-open'));
onAct('nav-close', () => document.body.classList.remove('nav-open'));
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.body.classList.remove('nav-open'); });

/* ---------- hesla: změna vlastního + zapomenuté heslo ---------- */
function passErr(p) {
  if (!p || p.length < 8) return 'Heslo musí mít alespoň 8 znaků.';
  if (!/[0-9]/.test(p)) return 'Heslo musí obsahovat alespoň 1 číslici.';
  return null;
}
function passFieldsHtml(hidden) {
  return (hidden || '') +
    '<div class="field"><label>Nové heslo</label><input name="new1" autocomplete="new-password" required placeholder="min. 8 znaků a alespoň 1 číslice"></div>' +
    '<div class="field"><label>Potvrzení hesla</label><input name="new2" autocomplete="new-password" required placeholder="stejné heslo znovu"></div>';
}
function applyPassError(p1, p2) {
  const err = passErr(p1);
  if (err) { toast(err, 'bad'); return true; }
  if (p1 !== p2) { toast('Hesla se neshodují', 'bad'); return true; }
  return false;
}
onAct('ch-pass', () => {
  const u = currentUser();
  if (!u) return;
  openModal(
    '<h3>Změnit heslo</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Alespoň 8 znaků a 1 číslice</p>' +
    '<form data-form="pass-change">' + passFieldsHtml('') +
      '<button class="btn btn-primary">Uložit nové heslo</button>' +
    '</form>');
});
onAct('form:pass-change', f => {
  const fd = new FormData(f);
  const u = currentUser();
  if (!u) return;
  if (applyPassError(String(fd.get('new1') || ''), String(fd.get('new2') || ''))) return;
  u.pass = hashPassword(String(fd.get('new1')));
  u.passChanged = true; /* generované heslo už nikdo neuvidí – jen uživatel */
  delete u.genPass;   /* třídní už původní heslo neuvidí */
  saveDB();
  closeModal();
  toast('Heslo změněno ✓', 'ok');
});
onAct('forgot-pass', () => {
  openModal(
    '<h3>Zapomněli jste heslo?</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Zadejte přihlašovací jméno – žádost dorazí tomu, kdo ji vyřídí</p>' +
    '<form data-form="forgot-send">' +
      '<div class="field"><label>Přihlašovací jméno</label><input name="login" required autocomplete="username" placeholder="např. hana.dostupilova" style="font-family:monospace"></div>' +
      '<button class="btn btn-primary">' + ic('arrowR', 15) + ' Odeslat žádost</button>' +
    '</form>');
});
onAct('form:forgot-send', f => {
  const login = String(new FormData(f).get('login') || '').trim();
  if (!login) { toast('Zadejte přihlašovací jméno', 'bad'); return; }
  const acc = accByLoginLoose(login);
  /* admin (zakladatel aplikace) nemá kdo resetovat – heslo si mění jen v aplikaci */
  if (acc && acc.isRoot) {
    closeModal();
    toast('Heslo správce aplikace se žádostí resetovat nedá – přihlaste se a změňte ho přes 🔒', 'bad');
    return;
  }
  /* kontaktní účet organizace (zakladatel školy) → řeší jen hlavní admin aplikace */
  if (acc && acc.isOrgContact) {
    db.resetReq = db.resetReq || [];
    if (db.resetReq.some(r => r.status === 'ceka' && r.login.toLowerCase() === login.toLowerCase())) {
      toast('Žádost pro tento účet už čeká na vyřízení', 'bad'); return;
    }
    db.resetReq.push({ id: uid(), login, status: 'ceka', ts: nowISO() });
    (db.users || []).filter(u => u.isRoot || u.isAdmin).forEach(adm => {
      db.notifs = db.notifs || [];
      db.notifs.push({ userId: adm.id, type: 'reset', text: 'Žádost o reset hesla zakladatele organizace: ' + login, ts: nowISO(), route: 'sprava' });
    });
    saveDB();
    closeModal();
    toast('Žádost odeslána ✓ – heslo vám po ověření resetuje zakladatel aplikace (admin)', 'ok');
    return;
  }
  db.resetReq = db.resetReq || [];
  if (db.resetReq.some(r => r.status === 'ceka' && r.login.toLowerCase() === login.toLowerCase())) {
    toast('Žádost pro tento účet už čeká na vyřízení', 'bad'); return;
  }
  db.resetReq.push({ id: uid(), login, status: 'ceka', ts: nowISO() });
  /* upozorníme řešitele podle hierarchie (třídní / kontakt / admin) */
  try {
    const res = resetResolverOf(acc);
    if (res.kind === 'teacher') {
      db.notifs = db.notifs || [];
      db.notifs.push({ userId: res.teacherId, type: 'reset', text: 'Nová žádost o reset hesla: ' + login, ts: nowISO(), route: 'hesla' });
    } else if (res.kind === 'contact') {
      (db.users || []).filter(x => x.isOrgContact && x.orgId === res.orgId).forEach(x => {
        db.notifs = db.notifs || [];
        db.notifs.push({ userId: x.id, type: 'reset', text: 'Nová žádost o reset hesla: ' + login, ts: nowISO(), route: 'sprava' });
      });
    } else if (res.kind === 'root') {
      (db.users || []).filter(x => x.isRoot || x.isAdmin).forEach(x => {
        db.notifs = db.notifs || [];
        db.notifs.push({ userId: x.id, type: 'reset', text: 'Nová žádost o reset hesla: ' + login, ts: nowISO(), route: 'sprava' });
      });
    }
  } catch (e) { /* resolver není načtený – žádost zůstane vidět v seznamu */ }
  saveDB();
  closeModal();
  toast('Žádost odeslána ✓ – nové heslo vám předá třídní učitel', 'ok');
});

/* ============================================================
   ŽÁDOST O ZALOŽENÍ ORGANIZACE (pouze PC)
   Formulář: Jméno, Příjmení zakladatele, Jméno organizace, Telefon,
   Email na kontakt a kontaktní účet (username + heslo).
   Žádost se odešle hlavnímu adminovi k přijetí/odmítnutí.
   ============================================================ */
const ORGREQ_FIELDS = ['first', 'last', 'orgName', 'phone', 'email', 'username', 'pass'];
function draftOrgReqGet() { try { return JSON.parse(localStorage.getItem('ss.orgreq.draft') || 'null'); } catch (e) { return null; } }
function draftOrgReqSet(d) { try { const c = Object.assign({}, d); delete c.pass; /* heslo se v draftu ukládat nikdy nebude */ localStorage.setItem('ss.orgreq.draft', JSON.stringify(c)); } catch (e) { /* noop */ } }
function draftOrgReqClear() { try { localStorage.removeItem('ss.orgreq.draft'); } catch (e) { /* noop */ } }
function orgReqRender(mode, draft) {
  const app = document.getElementById('app');
  document.body.classList.remove('nav-open', 'dock-open');
  const d = draft || {};
  const val = k => d[k] ? escapeHtml(String(d[k])) : '';
  const pcOnly = mode !== 'mobile';
  app.innerHTML =
    '<div class="login-wrap"><div class="login-card card">' +
      '<div class="login-brand"><span class="brand"><span class="logo" style="width:44px;height:44px;border-radius:13px;font-size:22px">' + ic('home', 20) + '</span><span class="brand-name" style="font-size:26px">School<small style="color:var(--accent)">Sys</small></span></span></div>' +
      '<h1>Založit organizaci 🏫</h1>' +
      '<p class="login-sub">Odešlete žádost správci SchoolSys – po schválení dostanete vlastní správu tříd a loginů.</p>' +
      (!pcOnly
        ? '<div class="card" style="border-color:var(--warn);margin-bottom:14px"><b>🖥️ Pouze na počítači</b><p class="small-note" style="margin:6px 0 0">Žádost lze odeslat jen z počítače</p></div>'
        : '') +
      '<form data-form="org-request"' + (pcOnly ? '' : ' data-disabled="1"') + '>' +
        '<div class="field-row">' +
          '<div class="field"><label>Jméno zakladatele *</label><input name="first" required value="' + val('first') + '" placeholder="Jan"' + (pcOnly ? '' : ' disabled') + '></div>' +
          '<div class="field"><label>Příjmení zakladatele *</label><input name="last" required value="' + val('last') + '" placeholder="Novák"' + (pcOnly ? '' : ' disabled') + '></div>' +
        '</div>' +
        '<div class="field"><label>Jméno organizace *</label><input name="orgName" required value="' + val('orgName') + '" placeholder="např. ZŠ Hvezda"' + (pcOnly ? '' : ' disabled') + '></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>Telefon na kontakt *</label><input name="phone" required value="' + val('phone') + '" placeholder="+420 …"' + (pcOnly ? '' : ' disabled') + '></div>' +
          '<div class="field"><label>Email na kontakt *</label><input name="email" type="email" required value="' + val('email') + '" placeholder="kontakt@organizace.cz"' + (pcOnly ? '' : ' disabled') + '></div>' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field"><label>Uživatelské jméno pro kontakt *</label><input name="username" required value="' + val('username') + '" placeholder="např. jan.novak" style="font-family:monospace"' + (pcOnly ? '' : ' disabled') + '></div>' +
          '<div class="field"><label>Heslo pro kontakt *</label><input name="pass" type="password" required value="" placeholder="min. 8 znaků a 1 číslice"' + (pcOnly ? '' : ' disabled') + '></div>' +
        '</div>' +
        '<p class="small-note" style="margin:4px 0 10px">Přihlášení až po schválení žádosti (jen na PC)</p>' +
        (pcOnly ? '<button class="btn btn-primary" style="width:100%">' + ic('send', 16) + ' Odeslat žádost správci</button>' : '') +
      '</form>' +
      '<button type="button" class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" data-act="goto:#/login">Zpět na přihlášení</button>' +
      '<p class="small-note" style="text-align:center;margin-top:14px">Správce žádost posoudí – kontaktní účet dostane správu své organizace</p>' +
    '</div></div>';
}
function routeOrgRequest() {
  const pc = !isAppMode();
  orgReqRender(pc ? 'pc' : 'mobile', pc ? draftOrgReqGet() : null);
  if (!pc) draftOrgReqClear();
}
function normalizeOrgReq(d) {
  const out = {};
  ORGREQ_FIELDS.forEach(k => { out[k] = String(d && d[k] || '').trim(); });
  return out;
}
onAct('form:org-request', f => {
  const d = normalizeOrgReq(Object.fromEntries(new FormData(f).entries()));
  if (!d.first || !d.last || !d.orgName || !d.phone || !d.email) { toast('Vyplňte prosím všechna pole žádosti', 'bad'); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) { toast('Zadejte platný email', 'bad'); return; }
  if (!d.username) { toast('Zvolte uživatelské jméno pro kontakt', 'bad'); return; }
  const err = passErr(d.pass);
  if (err) { toast(err, 'bad'); return; }
  if (usernameTaken(d.username)) { toast('Uživatelské jméno „' + escapeHtml(d.username) + '“ je už zabrané', 'bad'); return; }
  if (d.username.length < 3) { toast('Uživatelské jméno musí mít alespoň 3 znaky', 'bad'); return; }
  if (orgRequestsList().some(r => r.status === 'ceka' && r.username.toLowerCase() === d.username.toLowerCase())) {
    toast('Pro toto uživatelské jméno už čeká žádost na vyřízení', 'bad'); return;
  }
  const req = {
    id: uid(), first: d.first, last: d.last, orgName: d.orgName, phone: d.phone, email: d.email,
    username: d.username, pass: hashPassword(d.pass), status: 'ceka', ts: nowISO()
  };
  orgRequestsList().push(req);
  draftOrgReqClear();
  saveDB();
  /* notifikace pro zakladatele aplikace (isRoot/admin) */
  (db.users || []).filter(u => u.isRoot || u.isAdmin).forEach(u => {
    db.notifs.push({ userId: u.id, type: 'orgreq', text: 'Nová žádost o organizaci: ' + req.orgName + ' (' + req.username + ')', ts: nowISO(), route: 'sprava' });
  });
  saveDB();
  route();
  openModal(
    '<h3>' + ic('check', 18) + ' Žádost odeslána</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Žádost pro organizaci <b>' + escapeHtml(req.orgName) + '</b> byla odeslána správci SchoolSys. Až ji schválí, přihlásíte se na PC kontaktním účtem <code class="mono">' + escapeHtml(req.username) + '</code>.</p>' +
    '<button class="btn btn-primary" style="width:100%" data-act="goto:#/login">Hotovo – zpět na přihlášení</button>');
});

/* ---------- téma ---------- */
function themeInit() {
  let t = localStorage.getItem(THEME_KEY) || 'dark';
  if (t !== 'light') t = 'dark';
  document.documentElement.setAttribute('data-theme', t);
}
onAct('theme', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  route(); // přerenderuje ikonu
});

/* ---------- zvonek notifikací ---------- */
function renderBell() {
  const user = currentUser();
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const list = db.notifs.filter(n => n.userId === user.id)
    .sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 12);
  panel.innerHTML = '<div class="card" id="notif-box" style="position:fixed;top:62px;right:18px;width:330px;z-index:70;max-height:60vh;overflow:auto;display:none">' +
    '<div class="card-title">' + ic('bell', 17) + ' Notifikace</div>' +
    (list.length
      ? '<div class="list">' + list.map(n =>
          '<div class="list-row" style="cursor:pointer" data-act="notif-go:' + n.route + '"><span class="chip chip-accent">' +
            ({ grade: 'známka', task: 'úkol', excuse: 'omluvenka', msg: 'zpráva' }[n.type] || n.type) + '</span>' +
            '<div class="grow"><div class="row-sub">' + escapeHtml(n.text) + '</div><div style="font-size:11px;color:var(--muted)">' + tsLabel(n.ts) + '</div></div></div>'
        ).join('') + '</div>'
      : '<div class="empty"><b>Žádné novinky</b>Jste v obraze 🙂</div>') +
  '</div>';
}
onAct('bell', () => {
  const box = document.getElementById('notif-box');
  if (!box) return;
  const visible = box.style.display !== 'none';
  box.style.display = visible ? 'none' : 'block';
  if (!visible) {
    const user = currentUser();
    markNotifsRead(user.id);
    const btn = document.getElementById('bell-btn');
    if (btn) { btn.innerHTML = ic('bell', 18); }
  }
});
onAct('notif-go:známky', () => { closeBell(); gotoHash('#/student/znamky'); });
onAct('notif-go:ukoly', () => { closeBell(); gotoHash('#/student/ukoly'); });
onAct('notif-go:omluvenky', () => { closeBell(); const u = currentUser(); gotoHash('#/' + u.role + '/omluvenky'); });
onAct('notif-go:prehled', () => { closeBell(); const u = currentUser(); gotoHash('#/' + u.role + '/prehled'); });
onAct('notif-go:zpravy', () => { closeBell(); const u = currentUser(); gotoHash('#/' + u.role + '/zpravy'); });
onAct('notif-go:pololetka', () => { closeBell(); const u = currentUser(); gotoHash('#/' + u.role + '/pololetka'); });
onAct('notif-go:prubezna', () => { closeBell(); const u = currentUser(); gotoHash('#/' + u.role + '/pololetka'); });
/* ostatní route notifikací (dochazka, rozvrh, oznameni…) řešíme genericky přes existující view */
onAct('notif-go:dochazka', () => { closeBell(); const u = currentUser(); gotoHash('#/' + u.role + '/dochazka'); });
onAct('notif-go:oznameni', () => { closeBell(); const u = currentUser(); gotoHash('#/' + u.role + '/oznameni'); });
onAct('notif-go:sprava', () => { closeBell(); const u = currentUser(); gotoHash('#/' + (u.isAdmin ? 'admin' : u.role) + '/sprava'); });
onAct('notif-go:hesla', () => { closeBell(); gotoHash('#/ucitel/hesla'); });
function closeBell() {
  const box = document.getElementById('notif-box');
  if (box) box.style.display = 'none';
}
document.addEventListener('click', e => {
  if (!e.target.closest('#notif-box') && !e.target.closest('#bell-btn')) closeBell();
});

/* ---------- po vyrenderování view: naskrolovat, doplnit data ---------- */
function bindView() { /* hook pro views */ }

/* ---------- mobilní režim: žák/rodič = launcher dlaždic, učitel = pouze počítač ---------- */
function isMobile() { return window.innerWidth < 768; }
/* režim „aplikace“: telefon i tablet (pod 1024 px) – žák/rodič dostane launcher */
function isAppMode() { return window.innerWidth < 1024; }
function isFamilyRole(r) { return r === 'student' || r === 'rodic'; }
function showTeacherMobileBlock() {
  const app = document.getElementById('app');
  document.body.classList.remove('nav-open', 'dock-open');
  if (app) app.innerHTML =
    '<div class="teacher-block"><div class="teacher-block-in">' +
      '<div class="tb-ring">' + ic('home', 30) + '</div>' +
      '<h1>Pro učitele jen na počítači</h1>' +
      '<p>Tato verze aplikace je na telefonu určena <b>pro žáky a rodiče</b>.<br>Učitelská rozhraní (třídní kniha, známkování, docházka…) otevřete prosím na počítači nebo tabletu.</p>' +
      '<button class="btn btn-ghost tb-btn" data-act="logout">' + ic('logout', 16) + ' Zpět na přihlášení</button>' +
    '</div></div>';
  document.body.classList.add('device-locked');
}
/* kontaktní účet organizace: přihlášení a správa jen z počítače */
function showContactMobileBlock(user) {
  const app = document.getElementById('app');
  document.body.classList.remove('nav-open', 'dock-open');
  if (app) app.innerHTML =
    '<div class="teacher-block"><div class="teacher-block-in">' +
      '<div class="tb-ring">' + ic('home', 30) + '</div>' +
      '<h1>Kontaktní účet je jen pro počítač 🖥️</h1>' +
      '<p>Účet kontaktu organizace <b>' + escapeHtml(user ? orgLabel(user.orgId) : '') + '</b> funguje pouze na počítači.<br>Přihlaste se na něm k správě tříd a loginů své organizace.</p>' +
      '<button class="btn btn-ghost tb-btn" data-act="logout">' + ic('logout', 16) + ' Zpět na přihlášení</button>' +
    '</div></div>';
  document.body.classList.add('device-locked');
}
/* ikonková obrazovka „jako aplikace“ – vidí ji žák i rodič na telefonu */
const MOBILE_TILE_BG = {
  znamky: 'linear-gradient(135deg,#3B82F6,#2563EB)', pololetka: 'linear-gradient(135deg,#8B5CF6,#6D28D9)',
  dochazka: 'linear-gradient(135deg,#14B8A6,#0F766E)', rozvrh: 'linear-gradient(135deg,#F59E0B,#D97706)',
  vyuka: 'linear-gradient(135deg,#6366F1,#4338CA)', poznamky: 'linear-gradient(135deg,#F43F5E,#BE123C)',
  planakci: 'linear-gradient(135deg,#10B981,#059669)',  ukoly: 'linear-gradient(135deg,#06B6D4,#0E7490)',
  zpravy: 'linear-gradient(135deg,#EC4899,#BE185D)', oznameni: 'linear-gradient(135deg,#F97316,#C2410C)',
  omluvenky: 'linear-gradient(135deg,#84CC16,#4D7C0F)',
  klasifikace: 'linear-gradient(135deg,#0EA5E9,#0369A1)', kniha: 'linear-gradient(135deg,#F43F5E,#BE123C)',
  predmety: 'linear-gradient(135deg,#22D3EE,#0E7490)', ucebny: 'linear-gradient(135deg,#A78BFA,#6D28D9)',
  hesla: 'linear-gradient(135deg,#FBBF24,#D97706)', zmenyrozvrh: 'linear-gradient(135deg,#FB7185,#E11D48)',
  udaje: 'linear-gradient(135deg,#38BDF8,#2563EB)'
};
const MOBILE_TILE_FALLBACK = ['linear-gradient(135deg,#3B82F6,#2563EB)', 'linear-gradient(135deg,#8B5CF6,#6D28D9)', 'linear-gradient(135deg,#10B981,#059669)', 'linear-gradient(135deg,#F59E0B,#D97706)', 'linear-gradient(135deg,#EC4899,#BE185D)', 'linear-gradient(135deg,#06B6D4,#0E7490)'];
function mobileHomeHTML(user) {
  const role = user.role;
  const tiles = navForUser(user).filter(n => n.key !== 'prehled');
  const avatar = '<span class="m-ava" style="background:linear-gradient(135deg,#3B82F6,' + (role === 'rodic' ? '#10B981' : '#F59E0B') + ')">' + escapeHtml(user.name.charAt(0)) + '</span>';
  const grid = tiles.map((n, i) => {
    let badgeN = 0;
    if (n.key === 'zpravy') badgeN = userUnreadMsgs(user.id);
    if (n.key === 'oznameni') badgeN = annUnreadCount(user);
    return '<button class="m-tile" data-act="goto:#/' + role + '/' + n.key + '">' +
      '<span class="m-ico" style="background:' + (MOBILE_TILE_BG[n.key] || MOBILE_TILE_FALLBACK[i % MOBILE_TILE_FALLBACK.length]) + '">' + ic(n.icon, 26) + '</span>' +
      (badgeN ? '<span class="m-n">' + badgeN + '</span>' : '') +
      '<span class="m-lbl">' + n.label + '</span></button>';
  }).join('');
  return '<div class="m-home">' +
    '<div class="m-hero">' + avatar + '<b>' + escapeHtml(user.name) + '</b>' +
      '<span>' + escapeHtml(user.note || ROLES_CS[role]) + '</span></div>' +
    '<div class="m-grid">' + grid + '</div>' +
  '</div>';
}
/* záložky uvnitř pohledů (mobil/tablet) – „jako u Rozvrhu“ */
function viewTab(key, tabs) {
  const a = localStorage.getItem('ls_tab_' + key);
  return tabs.some(t => t.k === a) ? a : tabs[0].k;
}
function tabbarHtml(key, tabs, active) {
  return '<div class="rcpt-row" style="flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px">' +
    tabs.map(t => '<button class="rcpt-pill' + (t.k === active ? ' active' : '') + '" data-act="v-tab:' + key + ':' + t.k + '" style="flex:0 0 auto">' + t.label + '</button>').join('') + '</div>';
}
onAct('v-tab:', el => { const p = el.getAttribute('data-act').split(':'); localStorage.setItem('ls_tab_' + p[1], p[2]); route(); });
window.addEventListener('resize', () => { if (String(isAppMode()) !== (document.body.dataset.mobAt || '0')) location.reload(); });

/* ---------- start ---------- */
function boot() {
  loadDB();
  loadSession();
  themeInit();
  document.body.dataset.mob = '0';
  document.body.dataset.mobAt = isAppMode() ? '1' : '0';
  const app = document.getElementById('app');
  if (!app) return;
  if (!location.hash || location.hash === '#/org-request') {
    const u = currentUser();
    location.hash = u ? '#/' + (u.isAdmin ? 'admin' : u.role) + '/' + defKeyFor(u) : '#/login';
  }
  window.addEventListener('hashchange', route);
  route();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
