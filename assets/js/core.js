/* ============================================================
   LukySchool — jádro: router, přihlášení, shell, tmavý režim,
   toasty, modály, ikony a globální dispatcher akcí.
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
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  arrowR: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  chevUp: '<path d="m18 15-6-6-6 6"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  flag: '<path d="M4 22V4c0-.5.5-1 1-1h11l-2 4 2 4H5"/>'
};
function ic(name, size) {
  return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (I[name] || I.alert) + '</svg>';
}
function subjBadge(key, size) {
  const s = SUBJECTS[key] || { name: key, color: '#64748B' };
  const short = { M: 'M', CJ: 'ČJ', AJ: 'AJ', D: 'D', F: 'FY', P: 'PŘ', TV: 'TV', HV: 'HV', INF: 'IN', Z: 'Z' }[key] || key;
  const sz = size || 36;
  return '<span class="subj-badge" style="width:' + sz + 'px;height:' + sz + 'px;background:' + s.color + '" title="' + escapeHtml(s.name) + '">' + short + '</span>';
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
const ADMIN_NAV = [{ key: 'sprava', icon: 'users', label: 'Správa školy' }];
const ROLE_NAV = {
  admin: [
    { key: 'sprava', icon: 'users', label: 'Správa školy' }
  ],
  ucitel: [
    { key: 'prehled',   icon: 'home', label: 'Přehled' },
    { key: 'dochazka',  icon: 'calendar', label: 'Docházka' },
    { key: 'klasifikace', icon: 'book', label: 'Známkování' },
    { key: 'prubezna',  icon: 'list', label: 'Průběžná klasifikace' },
    { key: 'pololetka', icon: 'check', label: 'Pololetní klasifikace' },
    { key: 'kniha',     icon: 'clipboard', label: 'Třídní kniha' },
    { key: 'zpravy',    icon: 'chat', label: 'Zprávy' },
    { key: 'omluvenky', icon: 'shield', label: 'Omluvenky' },
    { key: 'rozvrh',    icon: 'clock', label: 'Rozvrh a rezervace' },
    { key: 'predmety',  icon: 'book', label: 'Předměty' },
    { key: 'ucebny',    icon: 'home', label: 'Učebny' },
    { key: 'ukoly',     icon: 'check', label: 'Úkoly' },
    { key: 'hesla',     icon: 'zap', label: 'Resetování hesel' },
    { key: 'oznameni',  icon: 'bell', label: 'Oznámení' }
  ],
  student: [
    { key: 'prehled', icon: 'home', label: 'Přehled' },
    { key: 'znamky',  icon: 'book', label: 'Známky' },
    { key: 'prubezna', icon: 'list', label: 'Průběžná klasifikace' },
    { key: 'pololetka', icon: 'check', label: 'Vysvědčení' },
    { key: 'dochazka', icon: 'calendar', label: 'Docházka' },
    { key: 'rozvrh',  icon: 'clock', label: 'Rozvrh' },
    { key: 'ukoly',   icon: 'check', label: 'Moje úkoly' },
    { key: 'zpravy',  icon: 'chat', label: 'Zprávy' },
    { key: 'oznameni', icon: 'bell', label: 'Oznámení' }
  ],
  rodic: [
    { key: 'prehled',   icon: 'home', label: 'Přehled' },
    { key: 'prubezna',  icon: 'list', label: 'Průběžná klasifikace' },
    { key: 'pololetka', icon: 'check', label: 'Vysvědčení' },
    { key: 'dochazka',  icon: 'calendar', label: 'Docházka' },
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
  return base.filter(n => n.key !== 'sprava');
}
function defKeyFor(user) {
  if (user && user.isAdmin && user.role === 'ucitel') return 'sprava';
  return DEFAULT_KEY[user.role] || 'prehled';
}

/* souhrnný odznáček „Více“ pro učitele na mobilu (čekající omluvenky + zprávy + žádosti) */
function navBadgeTotal(user) {
  if (!user || user.role !== 'ucitel' || user.isAdmin) return 0;
  return pendingExcusesFor(user).length + userUnreadMsgs(user.id) + (db.absReq || []).filter(r => r.status === 'ceka').length + teacherResetUnread(user.id) + annUnreadCount(user);
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
    if (key === 'rozvrh') {
      const n = (db.absReq || []).filter(r => r.status === 'ceka').length;
      return n ? '<span class="nav-n badge-dot" data-n="' + n + '">' + ic('clock', 16) + '</span>' : '';
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
  const nav = navForUser(user);
  /* učitel: 5 hlavních položek v 1. řádku; zbytek (index >= 5) se schová
     za „Více“ – „Více“/„Sbalit“ sedí vždy na konci 2. řádku docku.
     Ředitel (admin) má jen Správu – bez docku a bez badge. */
  const isTeacher = role === 'ucitel' && !user.isAdmin;
  const roleLabel = (role === 'ucitel' && user.isAdmin) ? 'Ředitel' : ROLES_CS[role];
  const navExtraAt = 5;
  const bell = (role === 'student' || role === 'rodic')
    ? '<button class="icon-btn" data-act="bell" id="bell-btn" style="position:relative">' + ic('bell', 18) +
      (notifUnreadFor(user.id) ? '<span style="position:absolute;top:-2px;right:-2px;background:var(--bad);color:#fff;border-radius:99px;min-width:15px;height:15px;font-size:10px;font-weight:900;display:grid;place-items:center;padding:0 3px">' + notifUnreadFor(user.id) + '</span>' : '') + '</button>'
    : '';
  return '' +
    '<header class="topbar">' +
      '<span class="brand"><span class="logo">' + ic('home', 15) + '</span>Luky<small>School</small></span>' +
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
          '<button class="nav-item' + (n.key === activeKey ? ' active' : '') + (isTeacher && i >= navExtraAt ? ' nav-extra' : '') + '" data-act="goto:#/' + role + '/' + n.key + '">' +
            ic(n.icon, 18) + '<span>' + n.label + '</span>' + navBadge(role, n.key, user) + '</button>'
        ).join('') +
        (isTeacher
          ? '<button type="button" class="dock-more" data-act="dock-more" title="Další sekce / sbalit">' +
              '<span class="dm-ic dm-open">' + ic('chevUp', 18) + '</span>' +
              '<span class="dm-ic dm-close">' + ic('chevDown', 18) + '</span>' +
              '<span class="dm-lbl dm-open">Více</span>' +
              '<span class="dm-lbl dm-close">Sbalit</span>' +
              (navBadgeTotal(user) ? '<span class="dm-badge">' + navBadgeTotal(user) + '</span>' : '') +
            '</button>'
          : '') +
      '</aside>' +
      '<main class="main"><div id="view"></div></main>' +
    '</div>' +
    '<div id="notif-panel"></div>';
}

/* ---------- router ---------- */
function route() {
  const user = currentUser();
  if (!user) { renderLogin(); return; }
  const role = user.role;
  let h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/');
  // povolíme parametr za „|" (např. #/student/znamky|M) – base klíč pro lookup
  const rawKey = parts.length > 1 && parts[0] === role ? parts[1] : null;
  const baseKey = rawKey ? rawKey.split('|')[0] : null;
  const navKeys = VIEWS[role] || {};
  const onlyAdmin = user.isAdmin && user.role === 'ucitel'; // ředitel vidí jen Správu
  let useKey;
  if (baseKey && navKeys[baseKey] && (!onlyAdmin || baseKey === 'sprava')) {
    useKey = baseKey;
    if (!rawKey.includes('|')) location.hash = '#/' + role + '/' + baseKey; // normalizace
  } else {
    useKey = defKeyFor(user);
    location.hash = '#/' + role + '/' + useKey;
  }
  if (!useKey) useKey = defKeyFor(user);
  const app = document.getElementById('app');
  app.innerHTML = shellHTML(user, useKey);
  document.body.classList.remove('dock-open');
  if (user.role === 'student' || user.role === 'rodic') renderBell();
  const fn = VIEWS[role][useKey];
  if (fn) { document.getElementById('view').innerHTML = fn(user); bindView(); }
}

/* ---------- přihlášení ---------- */
function renderLogin() {
  const app = document.getElementById('app');
  const remHtml = rememberedLoginHtml();
  app.innerHTML =
    '<div class="login-wrap"><div class="login-card card">' +
      '<div class="login-brand"><span class="brand"><span class="logo" style="width:44px;height:44px;border-radius:13px;font-size:22px">' + ic('home', 20) + '</span><span style="font-size:26px">Luky<small style="color:var(--accent)">School</small></span></span></div>' +
      '<h1>Vítejte zpět 👋</h1>' +
      '<p class="login-sub">Přihlaste se do aplikace.</p>' +
      '<form data-form="login">' +
        '<div class="field"><label>Uživatelské jméno</label><input name="user" autocomplete="username" placeholder="admin" required></div>' +
        '<div class="field"><label>Heslo</label><input name="pass" type="password" autocomplete="current-password" placeholder="••••••••" required></div>' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;margin:10px 0 2px"><input type="checkbox" name="remember" style="width:16px;height:16px;accent-color:var(--accent)"> Zapamatovat si účet (rychlé přihlášení)</label>' +
        '<button class="btn btn-primary" style="width:100%;margin-top:6px">' + ic('arrowR', 16) + ' Přihlásit se</button>' +
      '</form>' +
      '<button type="button" class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" data-act="forgot-pass">' + ic('zap', 15) + ' Zapomněl jsem heslo</button>' +
      (remHtml ? remHtml : '') +
      '<p class="small-note" style="text-align:center;margin-top:14px">Učitelé, žáci a rodiče se přihlásí údaji, které jim správce vygeneroval.</p>' +
    '</div></div>';
}

function tryLogin(user, pass) {
  const u = (db.users || []).find(x => x.username === user && x.pass === pass);
  if (!u) { toast('Nesprávné uživatelské jméno nebo heslo', 'bad'); return false; }
  saveSession({ user: u.username });
  location.hash = '#/' + u.role + '/' + defKeyFor(u);
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
  saveSession({ user: u.username });
  location.hash = '#/' + u.role + '/' + defKeyFor(u);
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
function dockToggle(open) {
  const sb = document.querySelector('.sidebar');
  if (!sb) return;
  sb.classList.toggle('expanded', open);
  document.body.classList.toggle('dock-open', open);
}
onAct('dock-more', () => dockToggle(!document.querySelector('.sidebar').classList.contains('expanded')));

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
    '<p class="small-note" style="margin-bottom:12px">Podmínky: alespoň 8 znaků a minimálně 1 číslice. Přihlašovací jméno se měnit nedá.</p>' +
    '<form data-form="pass-change">' + passFieldsHtml('') +
      '<button class="btn btn-primary">Uložit nové heslo</button>' +
    '</form>');
});
onAct('form:pass-change', f => {
  const fd = new FormData(f);
  const u = currentUser();
  if (!u) return;
  if (applyPassError(String(fd.get('new1') || ''), String(fd.get('new2') || ''))) return;
  u.pass = String(fd.get('new1'));
  saveDB();
  closeModal();
  toast('Heslo změněno ✓', 'ok');
});
onAct('forgot-pass', () => {
  openModal(
    '<h3>Zapomněli jste heslo?</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Zadejte své přihlašovací jméno. Správci přijde žádost a po obnovení vám nové heslo předá třídní učitel.</p>' +
    '<form data-form="forgot-send">' +
      '<div class="field"><label>Přihlašovací jméno</label><input name="login" required autocomplete="username" placeholder="např. hana.dostupilova" style="font-family:monospace"></div>' +
      '<button class="btn btn-primary">' + ic('arrowR', 15) + ' Odeslat žádost</button>' +
    '</form>');
});
onAct('form:forgot-send', f => {
  const login = String(new FormData(f).get('login') || '').trim();
  if (!login) { toast('Zadejte přihlašovací jméno', 'bad'); return; }
  db.resetReq = db.resetReq || [];
  if (db.resetReq.some(r => r.status === 'ceka' && r.login.toLowerCase() === login.toLowerCase())) {
    toast('Žádost pro tento účet už čeká na vyřízení', 'bad'); return;
  }
  db.resetReq.push({ id: uid(), login, status: 'ceka', ts: nowISO() });
  saveDB();
  closeModal();
  toast('Žádost odeslána správci ✓ – nové heslo vám předá třídní učitel', 'ok');
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
function closeBell() {
  const box = document.getElementById('notif-box');
  if (box) box.style.display = 'none';
}
document.addEventListener('click', e => {
  if (!e.target.closest('#notif-box') && !e.target.closest('#bell-btn')) closeBell();
});

/* ---------- po vyrenderování view: naskrolovat, doplnit data ---------- */
function bindView() { /* hook pro views */ }

/* ---------- start ---------- */
function boot() {
  loadDB();
  loadSession();
  themeInit();
  const app = document.getElementById('app');
  if (!app) return;
  if (!location.hash) {
    const u = currentUser();
    location.hash = u ? '#/' + u.role + '/' + defKeyFor(u) : '#/login';
  }
  window.addEventListener('hashchange', route);
  route();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
