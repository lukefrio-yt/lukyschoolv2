/* ============================================================
   LukySchool — datová vrstva v10
   Třídy → učitelé (třídní) → žáci. Známkování jako TABULKA:
   sloupce = testy (název, váha, datum), buňky = známky.
   Známky: 1, 1-, 2, 2-, 3, 3-, 4, 4-, 5, S, N, A, ?
   1-=1,5 · 2-=2,5 · 3-=3,5 · 4-=4,5; N/A/? se nepočítají.
   Docházka: po hodinách v třídní knize (✓/A/Č/N//), omluvenky
   rodičů se promítají automaticky (Č → schválená A → N po 3 dnech).
   Předměty: základní + vlastní, které si zakládají učitelé.
   Zprávy: vlákna typu rodič / žák (thread.recipientType),
   učitel může psát třídě, rodičům i žákům.
   Úkoly: db.tasks (třída / jednotlivec), propis z třídní knihy.
   ============================================================ */
'use strict';

const DB_KEY = 'lukySchool.db.v12';
const DB_KEY_PREV = 'lukySchool.db.v11';
const SES_KEY = 'lukySchool.session';
const THEME_KEY = 'lukySchool.theme';
const DB_TS_KEY = 'lukySchool.cloud.ts'; /* čas posledního lokálního uložení (cloud sync) */
const DB_VERSION = 12;

/* ---------- časy hodin (8 vyučovacích, 45 min) ---------- */
const PERIODS = [
  { s: '7:55',  e: '8:40'  },
  { s: '8:50',  e: '9:35'  },
  { s: '9:55',  e: '10:40' },
  { s: '10:50', e: '11:35' },
  { s: '11:45', e: '12:30' },
  { s: '12:40', e: '13:25' },
  { s: '13:35', e: '14:20' },
  { s: '14:25', e: '15:10' }
];
function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
const PERIOD_START = PERIODS.map(p => toMin(p.s));
const PERIOD_END = PERIODS.map(p => toMin(p.e));

/* ---------- předměty ---------- */
const SUBJECTS = {
  M:   { name: 'Matematika',      color: '#3B82F6' },
  CJ:  { name: 'Český jazyk',     color: '#8B5CF6' },
  AJ:  { name: 'Angličtina',      color: '#F59E0B' },
  D:   { name: 'Dějepis',         color: '#EF4444' },
  F:   { name: 'Fyzika',          color: '#06B6D4' },
  P:   { name: 'Přírodopis',      color: '#10B981' },
  TV:  { name: 'Tělesná výchova', color: '#F97316' },
  HV:  { name: 'Hudební výchova', color: '#EC4899' },
  INF: { name: 'Informatika',     color: '#14B8A6' },
  Z:   { name: 'Zeměpis',         color: '#84CC16' }
};
const SUBJ_KEYS = Object.keys(SUBJECTS);
/* vestavěné předměty (nejdou smazat); vlastní si zakládají učitelé */
const SUBJECT_KEYS_BUILTIN = Object.keys(SUBJECTS);
const SUBJECT_PALETTE = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#14B8A6', '#F97316', '#84CC16', '#6366F1', '#F43F5E', '#0EA5E9', '#22C55E', '#EAB308', '#A855F7', '#FB7185', '#2DD4BF', '#60A5FA', '#64748B'];
/* šablona témat pro předměty bez ŠVP (např. vlastní předměty) */
const DEFAULT_TOPICS = ['Úvod a opakování', 'Nové učivo', 'Procvičování', 'Shrnutí a opakování'];

/* registr předmětů: vestavěné + vlastní z db.subjects (volá se po načtení dat).
   db.subjDeleted = zkratky smazaných vestavěných předmětů (aby se nevracely). */
function dbSubjects() { return db.subjects || (db.subjects = {}); }
function subjDeletedList() { return db.subjDeleted || (db.subjDeleted = []); }
function refreshSubjects() {
  const custom = dbSubjects();
  const del = subjDeletedList();
  /* odeber smazané předměty (vlastní i vestavěné), doplň nové */
  Object.keys(SUBJECTS).forEach(k => {
    if (!Object.prototype.hasOwnProperty.call(custom, k) && (del.includes(k) || !SUBJECT_KEYS_BUILTIN.includes(k))) delete SUBJECTS[k];
  });
  Object.keys(custom).forEach(code => { SUBJECTS[code] = { name: custom[code].name, color: custom[code].color }; });
  SUBJ_KEYS.length = 0;
  SUBJECT_KEYS_BUILTIN.forEach(k => { if (!del.includes(k)) SUBJ_KEYS.push(k); });
  Object.keys(custom).forEach(code => { if (SUBJECTS[code] && !del.includes(code) && !SUBJ_KEYS.includes(code)) SUBJ_KEYS.push(code); });
}
/* seznam předmětů pro výběry: {code, name, color, builtin} */
function subjectsList() {
  return SUBJ_KEYS.map(code => ({
    code,
    name: SUBJECTS[code].name,
    color: SUBJECTS[code].color,
    builtin: SUBJECT_KEYS_BUILTIN.includes(code)
  }));
}
function subjectName(code) { const s = SUBJECTS[code]; return s ? s.name : (code || ''); }
function nextSubjectColor() {
  const used = Object.keys(dbSubjects()).map(k => dbSubjects()[k].color);
  return SUBJECT_PALETTE.find(c => !used.includes(c)) || SUBJECT_PALETTE[Object.keys(dbSubjects()).length % SUBJECT_PALETTE.length];
}
function genSubjectCode(name) {
  const words = String(name || '').trim().split(/\s+/).filter(w => w.length > 0);
  let base;
  if (words.length > 1) base = words.map(w => w.charAt(0)).join('').slice(0, 3);
  else base = (name || '').trim().slice(0, 3);
  base = slugBase(base).toUpperCase() || 'PRED';
  let code = base, i = 2;
  while (Object.prototype.hasOwnProperty.call(SUBJECTS, code)) code = base + (i++);
  return code;
}
/* kontrola, že zkratka (kód) je volná a v rozumném tvaru */
function subjectCodeAvailable(code) {
  const c = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return { valid: c.length >= 1 && c.length <= 4, clean: c, taken: c ? Object.prototype.hasOwnProperty.call(SUBJECTS, c) : false };
}
/* vytvoří vlastní předmět; vrací jeho kód.
   code = vlastní zkratka (např. „TV“); prázdné = vygeneruje se automaticky. */
function addSubject(name, code, color) {
  let final = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (final && Object.prototype.hasOwnProperty.call(SUBJECTS, final)) return null; // zkratka je obsazená
  if (!final) final = genSubjectCode(name);
  dbSubjects()[final] = { name: String(name).trim(), color: color || nextSubjectColor() };
  refreshSubjects();
  saveDB();
  return final;
}
function renameSubject(code, name) {
  let c = dbSubjects()[code];
  if (!c && SUBJECTS[code]) c = dbSubjects()[code] = { name: SUBJECTS[code].name, color: SUBJECTS[code].color };
  if (!c) return false;
  c.name = String(name).trim();
  if (SUBJECTS[code]) SUBJECTS[code].name = c.name;
  saveDB();
  return true;
}
/* přejmenování zkratky předmětu (vlastního i vestavěného): přepíšeme kód v rozvrhu, třídní knize,
   známkovacích sloupcích i úkolech (známky zůstávají zachované). */
function renameSubjectCode(code, newCode) {
  let c = dbSubjects()[code];
  if (!c && SUBJECTS[code]) c = dbSubjects()[code] = { name: SUBJECTS[code].name, color: SUBJECTS[code].color };
  if (!c) return false;
  const n = String(newCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!n || (n !== code && Object.prototype.hasOwnProperty.call(SUBJECTS, n))) return false;
  if (n !== code) {
    delete dbSubjects()[code];
    dbSubjects()[n] = c;
    if (SUBJECT_KEYS_BUILTIN.includes(code) && !subjDeletedList().includes(code)) subjDeletedList().push(code);
  }
  (db.classes || []).forEach(cls => {
    const sc = db.schedule && db.schedule[cls.id];
    if (!sc || !sc.days) return;
    [1, 2, 3, 4, 5].forEach(d => (sc.days[d] || []).forEach(en => { if (en && en.subj === code) en.subj = n; }));
  });
  (db.classbook || []).forEach(r => { if (r.subj === code) r.subj = n; });
  (db.columns || []).forEach(c2 => { if (c2.subj === code) c2.subj = n; });
  (db.tasks || []).forEach(t => { if (t.subj === code) t.subj = n; });
  if (n !== code) { delete SUBJECTS[code]; }
  SUBJECTS[n] = { name: c.name, color: c.color };
  refreshSubjects();
  saveDB();
  return true;
}
function setSubjectColor(code, color) {
  let c = dbSubjects()[code];
  if (!c && SUBJECTS[code]) c = dbSubjects()[code] = { name: SUBJECTS[code].name, color: SUBJECTS[code].color };
  if (!c) return false;
  c.color = color;
  if (SUBJECTS[code]) SUBJECTS[code].color = color;
  saveDB();
  return true;
}
/* smazání předmětu (vlastního i vestavěného) vč. použití v rozvrhu / třídní knize / známkách */
function deleteSubjectCascade(code) {
  if (!SUBJECTS[code]) return false;
  if (SUBJECT_KEYS_BUILTIN.includes(code) && !subjDeletedList().includes(code)) subjDeletedList().push(code);
  delete dbSubjects()[code];
  (db.classes || []).forEach(cls => {
    const sc = db.schedule && db.schedule[cls.id];
    if (!sc || !sc.days) return;
    [1, 2, 3, 4, 5].forEach(d => {
      const day = sc.days[d] || [];
      day.forEach((en, i) => { if (en && en.subj === code) day[i] = null; });
    });
  });
  (db.classbook || []).forEach(r => { if (r.subj === code) r.subj = null; });
  db.columns = (db.columns || []).filter(c => c.subj !== code);
  db.tasks = (db.tasks || []).filter(t => t.subj !== code);
  refreshSubjects();
  saveDB();
  return true;
}
/* kolik míst předmět aktuálně zabírá (pro potvrzení smazání) */
function subjectUsageCount(code) {
  let n = 0;
  (db.classes || []).forEach(cls => {
    const sc = db.schedule && db.schedule[cls.id];
    if (!sc || !sc.days) return;
    [1, 2, 3, 4, 5].forEach(d => (sc.days[d] || []).forEach(en => { if (en && en.subj === code) n++; }));
  });
  n += (db.classbook || []).filter(r => r.subj === code).length;
  n += (db.columns || []).filter(c => c.subj === code).length;
  n += (db.tasks || []).filter(t => t.subj === code).length;
  return n;
}

/* ŠVP témata pro předvyplnění třídní knihy */
const SVP_TOPICS = {
  M:   ['Zlomky – sčítání a odčítání', 'Zlomky – násobení a dělení', 'Desetinná čísla', 'Lineární rovnice', 'Kladná a záporná čísla'],
  CJ:  ['Shoda přísudku s podmětem', 'Sloh – charakteristika', 'Věty podle postoje mluvčího', 'Čtenářská dílna'],
  AJ:  ['Past simple – pravidelná slovesa', 'Unit 3 – My town', 'Slovní zásoba – škola', 'Present perfect – úvod'],
  D:   ['Středověká města', 'Husitství', 'Renesance v Evropě', 'Karel IV. a Praha'],
  F:   ['Síly a jejich skládání', 'Tlak, tlaková síla', 'Hustota a měření', 'Elektrický proud'],
  P:   ['Savci – přežvýkavci', 'Hmyz – životní cyklus', 'Lidské tělo – kůže', 'Geologie – nerosty'],
  TV:  ['Atletika – sprinty', 'Volejbal – přihrávky', 'Gymnastika – kotouly', 'Basketbal – dribling'],
  HV:  ['Lidová píseň', 'Hudební formy', 'Rock a jeho historie', 'Notový zápis'],
  INF: ['Tabulkový procesor', 'Programování ve Scratchi', 'Bezpečnost na internetu', 'Prezentace'],
  Z:   ['Evropa – povrch', 'Česká republika – kraje', 'Měření na mapách', 'Podnebné pásy']
};

/* výchozí časy hodin (od–do) pro nový rozvrh třídy */
const DEFAULT_SLOT_TIMES = [
  { s: '7:55',  e: '8:40'  },
  { s: '8:50',  e: '9:35'  },
  { s: '9:55',  e: '10:40' },
  { s: '10:50', e: '11:35' },
  { s: '11:45', e: '12:30' },
  { s: '12:40', e: '13:25' },
  { s: '13:35', e: '14:20' },
  { s: '14:25', e: '15:10' }
];
function cloneDefaultSlots() { return JSON.parse(JSON.stringify(DEFAULT_SLOT_TIMES)); }
function defaultScheduleDays(n) {
  const days = {};
  for (let d = 1; d <= 5; d++) days[d] = [];
  for (let i = 0; i < n; i++) { for (let d = 1; d <= 5; d++) days[d].push(null); }
  return days;
}
function nextTime(hhmm, addMin) {
  const m = toMin(hhmm) + addMin;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

const RESOURCES = [
  { id: 'rc1', name: 'Počítačová učebna' },
  { id: 'rc2', name: 'Tělocvična' },
  { id: 'rc3', name: 'Laboratoř chemie' },
  { id: 'rc4', name: 'Dataprojektor' },
  { id: 'rc5', name: 'Tablety (15 ks)' }
];
const RES_BY_ID = {}; RESOURCES.forEach(r => { RES_BY_ID[r.id] = r; });

/* ---------- známky ---------- */
const GRADE_TOKENS = ['1', '1-', '2', '2-', '3', '3-', '4', '4-', '5', 'S', 'N', 'A', '?'];
const TOKEN_VAL = { '1': 1, '1-': 1.5, '2': 2, '2-': 2.5, '3': 3, '3-': 3.5, '4': 4, '4-': 4.5, '5': 5 };
function tokenVal(t) { return Object.prototype.hasOwnProperty.call(TOKEN_VAL, t) ? TOKEN_VAL[t] : null; }
function tokenShort(t) { return t === '?' ? '?' : t; }
function tokenCounted(t) { return tokenVal(t) !== null; }
/* české skloňování počtu: csPlural(n, 'žák','žáci','žáků') */
function csPlural(n, one, few, many) {
  const x = Math.abs(Number(n) || 0);
  if (x === 1) return one;
  if (x >= 2 && x <= 4) return few;
  return many;
}
function gradeColor(v) {
  const n = (typeof v === 'number' ? v : tokenVal(v));
  if (n === null) return '';
  if (n <= 1.5) return 'grad-1';
  if (n <= 2.5) return 'grad-2';
  if (n <= 3.5) return 'grad-3';
  if (n <= 4.5) return 'grad-4';
  return 'grad-5';
}
function gradeCssColor(v) {
  const n = (typeof v === 'number' ? v : tokenVal(v));
  if (n === null) return 'var(--muted)';
  if (n <= 1.5) return 'var(--ok)';
  if (n <= 2.5) return '#A3E635';
  if (n <= 3.5) return 'var(--warn)';
  if (n <= 4.5) return '#F87171';
  return 'var(--bad)';
}

/* ---------- datové pomocníky ---------- */
const WD_CS = ['Po', 'Út', 'St', 'Čt', 'Pá'];
let _uid = 1000;
function uid() { return 'id' + (++_uid) + Math.random().toString(36).slice(2, 7); }

function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayISO() { return isoDate(new Date()); }
function nowISO() { return new Date().toISOString(); }
function addDaysISO(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDate(d); }
function weekdayOf(iso) { return new Date(iso + 'T12:00:00').getDay(); }
function isSchoolDay(iso) { const w = weekdayOf(iso); return w >= 1 && w <= 5; }
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
}
function fmtDateLong(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtTime(iso) { return new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }); }
function tsLabel(iso) {
  const t = new Date(iso);
  const diff = Date.now() - t.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'právě teď';
  if (min < 60) return 'před ' + min + ' min';
  const h = Math.floor(min / 60);
  if (h < 24) return 'před ' + h + ' h';
  const d = Math.floor(h / 24);
  if (d < 7) return 'před ' + d + (d === 1 ? ' dnem' : ' dny');
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}
function nextSchoolDayISO(base, ahead) {
  let iso = addDaysISO(base, ahead || 0);
  let guard = 0;
  while (!isSchoolDay(iso) && guard < 10) { iso = addDaysISO(iso, 1); guard++; }
  return iso;
}
function schoolDaysBack(n, beforeISO) {
  const out = [];
  let iso = addDaysISO(beforeISO || todayISO(), -1);
  let guard = 0;
  while (out.length < n && guard < 40) {
    if (isSchoolDay(iso)) out.push(iso);
    iso = addDaysISO(iso, -1);
    guard++;
  }
  return out.reverse();
}
function lastSchoolDayOnOrBefore(iso) {
  let cur = iso; let guard = 0;
  while (!isSchoolDay(cur) && guard < 7) { cur = addDaysISO(cur, -1); guard++; }
  return cur;
}
function todayOrLastSchoolDay() { return lastSchoolDayOnOrBefore(todayISO()); }
function todayLabel() { return fmtDateLong(todayISO()); }

/* ---------- seed (prázdná škola – jen ředitelský účet, žádná demo data) ---------- */
const DEFAULT_ROOMS = [
  { id: 'rm-kmena', name: 'Kmenová učebna' },
  { id: 'rm-telocvicna', name: 'Tělocvična' },
  { id: 'rm-pc', name: 'Počítačová učebna' },
  { id: 'rm-lab', name: 'Laboratoř přírodopisu' },
  { id: 'rm-jazyk', name: 'Jazyková učebna' }
];
const ADMIN_USER = {
  id: 'u-admin', username: 'admin', pass: 'admin1234*', role: 'ucitel', isAdmin: true,
  name: 'Ředitel školy', note: 'správa školy · ředitel'
};
function buildSeed() {
  const now = nowISO();
  return {
    v: DB_VERSION,
    meta: { seededAt: now, schoolYear: schoolYearLabel() },
    classes: [],
    users: [JSON.parse(JSON.stringify(ADMIN_USER))],
    students: [],
    rooms: JSON.parse(JSON.stringify(DEFAULT_ROOMS)),
    subjects: {},
    schedule: {},
    /* sloupcový známkovač: {id, cls, subj, title, date, weight, note, cells:{sid:token}} */
    columns: [],
    tasks: [],
    classbook: [],
    threads: {},
    excuses: [],
    subs: [],
    reservations: [],
    absReq: [],
    notifs: [],
    notifsSeen: {},
    reports: {}, /* pololetní klasifikace: {clsId: {1:{...},2:{...}}} */
    records: [], /* pochvaly a výchovná opatření: {id,sid,type,reason,date,sem,by,ts} */
    notes: [],   /* poznámky učitele k žákovi: {id,sid,title,reason,sev,date,by,ts} */
    actions: [], /* plán akcí: {id,cls,sid?,title,desc,date,by,ts} */
    seen: { 'u-admin': null }
  };
}

/* ---------- načtení / uložení ---------- */
let db = null;
/* migrace starších verzí:
   v11 → v12 (release): končí demo verze. Stará data (demo žáci, třídy,
   rozvrhy, zprávy) se NEPŘEVÁDĚJÍ – škola se vyčistí a zůstane jen
   ředitelský účet admin / admin1234*. Všechno se staví znovu ve Správě.
   Další verze (>= 12) už migrují běžně, bez mazání. */
function migrateDB(parsed) {
  /* posun školního roku, pokud data pocházejí z předchozího roku */
  if (parsed && parsed.meta && parsed.meta.schoolYear && parsed.meta.schoolYear !== schoolYearLabel()) {
    parsed.meta.schoolYear = schoolYearLabel();
  }
  if (parsed && parsed.v && parsed.v < DB_VERSION) {
    if (parsed.v < 12) return buildSeed();
    if (parsed.v < 10) {
      /* v9 → v10: vlákna zpráv dostanou typ „rodič“ (do v9 uměli psát jen rodiče) */
      Object.keys(parsed.threads || {}).forEach(k => {
        const t = parsed.threads[k];
        if (!t.recipientType) t.recipientType = 'rodic';
        if (t.parent === undefined) t.parent = null;
      });
    }
    if (parsed.v < 11) {
      /* v10 → v11: staré ručně zapsané A/Č/N se berou jako nepřítomen (✗),
         o omluvení teď rozhodují jen omluvenky rodičů */
      (parsed.classbook || []).forEach(r => {
        if (!r.statuses) return;
        Object.keys(r.statuses).forEach(sid => {
          const t = r.statuses[sid];
          if (t === 'A' || t === 'C' || t === 'N') r.statuses[sid] = 'X';
        });
      });
    }
    parsed.v = DB_VERSION;
  }
  return parsed;
}
function loadDB() {
  try {
    /* uklidíme zastaralé klíče starších verzí (od konce, ať se indexy neposunou) */
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.indexOf('lukySchool.db.v') === 0 && k !== DB_KEY) localStorage.removeItem(k);
    }
    let raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      const prev = localStorage.getItem(DB_KEY_PREV);
      if (prev) { try { const m = migrateDB(JSON.parse(prev)); const s = JSON.stringify(m); localStorage.setItem(DB_KEY, s); raw = s; } catch (e) { /* reseed */ } }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      migrateDB(parsed);
      if (parsed && parsed.v === DB_VERSION && parsed.classes) {
        db = parsed;
        dbSubjects(); // zaručí klíč v databázi
        refreshSubjects();
        roomsEnsure(); // starším učebnám doplní zkratku a barvu
        reportsEnsure(); // starší data bez pololetní klasifikace
        recordsEnsure();
        notesEnsure();
        actionsEnsure();
        return db;
      }
    }
  } catch (e) { /* reseed */ }
  db = buildSeed();
  saveDB();
  refreshSubjects();
  roomsEnsure();
  reportsEnsure();
  recordsEnsure();
  notesEnsure();
  actionsEnsure();
  return db;
}
function saveDB() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { console.error('Uložení selhalo', e); }
  try { localStorage.setItem(DB_TS_KEY, String(Date.now())); } catch (e) { /* noop */ }
  try { if (window.cloudDirty) window.cloudDirty(); } catch (e) { /* noop */ }
}
function resetDB() {
  try { localStorage.removeItem(DB_KEY); } catch (e) { /* noop */ }
  db = buildSeed();
  saveDB();
  refreshSubjects();
}
/* kompletní vymazání školy (release): zůstane jen správcovský účet */
function wipeSchool() {
  db = {
    v: DB_VERSION,
    meta: { seededAt: nowISO(), schoolYear: schoolYearLabel() },
    classes: [], users: [JSON.parse(JSON.stringify(ADMIN_USER))],
    students: [], rooms: JSON.parse(JSON.stringify(DEFAULT_ROOMS)), subjects: {}, schedule: {}, columns: [], tasks: [], classbook: [],
    threads: {},
    subs: [], reservations: [], absReq: [], notifs: [],
    changes: [], /* změny rozvrhu: {id,cls,date,period,kind:'odpadla'|'mistnost'|'ucitel'|'predmet',reason,newRoom,newTeacher,newSubj,by,ts} */
    reports: {}, records: [], notes: [], actions: [], subjDeleted: [], resetReq: [], resetPass: [], scheduledMsgs: [], seen: { 'u-admin': null }
  };
  saveDB();
  refreshSubjects();
}

/* ---------- relace ---------- */
let session = null;
function loadSession() {
  try { session = localStorage.getItem(SES_KEY) ? JSON.parse(localStorage.getItem(SES_KEY)) : null; } catch (e) { session = null; }
  return session;
}
function saveSession(s) { session = s; try { localStorage.setItem(SES_KEY, JSON.stringify(s)); } catch (e) { /* noop */ } }
function logout() { session = null; try { localStorage.removeItem(SES_KEY); } catch (e) { /* noop */ } }
function currentUser() {
  if (!session) return null;
  return (db.users || []).find(u => u.username === session.user) || null;
}
function currentStudentId() {
  const u = currentUser();
  return u && u.role === 'student' ? u.studentId : null;
}

/* ---------- školy: třídy, učitelé, žáci ---------- */
function classOf(id) { return (db.classes || []).find(c => c.id === id) || null; }
function studentOf(sid) { return (db.students || []).find(s => s.id === sid) || null; }
function studentFull(sid) { const s = studentOf(sid); return s ? s.first + ' ' + s.last : '—'; }
function studentsOfClass(clsId) { return (db.students || []).filter(s => s.cls === clsId); }
function teachersOfClass(clsId) {
  const c = classOf(clsId);
  return (c ? c.teacherIds || [] : []).map(id => (db.users || []).find(u => u.id === id)).filter(Boolean);
}
/* třídy, které učitel učí (admin-hybrid vidí vše) */
function myClasses() {
  const u = currentUser();
  if (!u) return [];
  if (u.isAdmin) return (db.classes || []).slice();
  return (db.classes || []).filter(c => (c.teacherIds || []).includes(u.id));
}
function activeClsId() {
  const list = myClasses();
  if (!list.length) return null;
  const saved = localStorage.getItem('t_cls');
  return list.some(c => c.id === saved) ? saved : list[0].id;
}
function studentsOfActive() { const id = activeClsId(); return id ? studentsOfClass(id) : []; }

/* ---------- rozvrh třídy: { slots:[{s,e}], days:{1:[{subj,room,teacherId}|null,…]} } ---------- */
function scheduleOf(clsId) {
  if (!db.schedule) db.schedule = {};
  let sc = db.schedule[clsId];
  if (!sc) {
    sc = { slots: cloneDefaultSlots(), days: defaultScheduleDays(DEFAULT_SLOT_TIMES.length) };
    db.schedule[clsId] = sc;
    saveDB();
  } else {
    // migrace starého formátu {1:['M','CJ',…]} → nový
    if (sc.days && sc.days[1] && typeof sc.days[1][0] === 'string') {
      const old = sc.days;
      sc.days = defaultScheduleDays(old[1].length);
      [1, 2, 3, 4, 5].forEach(d => {
        (old[d] || []).forEach((code, i) => { if (code) sc.days[d][i] = { subj: code, room: null, teacherId: null }; });
      });
    }
    if (!sc.slots) sc.slots = cloneDefaultSlots();
    [1, 2, 3, 4, 5].forEach(d => {
      if (!Array.isArray(sc.days[d])) sc.days[d] = [];
      while (sc.days[d].length < sc.slots.length) sc.days[d].push(null);
      sc.days[d].length = Math.max(sc.days[d].length, sc.slots.length);
    });
  }
  return sc;
}
function scheduleSlots(clsId) { return scheduleOf(clsId).slots; }
function slotOf(clsId, i) { return scheduleOf(clsId).slots[i] || PERIODS[i] || { s: '?', e: '?' }; }
function scheduleEntry(clsId, iso, i) {
  const sc = scheduleOf(clsId);
  const wd = weekdayOf(iso);
  if (wd < 1 || wd > 5) return null;
  return sc.days[wd][i] || null;
}
function scheduleSetSlotTime(clsId, i, s, e) {
  const sc = scheduleOf(clsId);
  if (!sc.slots[i]) sc.slots[i] = {};
  sc.slots[i].s = s;
  sc.slots[i].e = e;
}
function scheduleSetCell(clsId, day, i, entry) {
  const sc = scheduleOf(clsId);
  const arr = sc.days[day];
  while (arr.length <= i) arr.push(null);
  if (entry && entry.subj) arr[i] = Object.assign({ room: null, teacherId: null }, arr[i], entry);
  else arr[i] = null;
}
function scheduleAddSlot(clsId) {
  const sc = scheduleOf(clsId);
  const last = sc.slots[sc.slots.length - 1] || { e: '14:25' };
  sc.slots.push({ s: last.e, e: nextTime(last.e, 45) });
  [1, 2, 3, 4, 5].forEach(d => sc.days[d].push(null));
}
function scheduleRemoveSlot(clsId) {
  const sc = scheduleOf(clsId);
  if (sc.slots.length <= 1) return;
  sc.slots.pop();
  [1, 2, 3, 4, 5].forEach(d => sc.days[d].pop());
}
function lessonsOfDay(clsId, iso) {
  const out = [];
  const sc = scheduleOf(clsId);
  const wd = weekdayOf(iso);
  if (wd < 1 || wd > 5) return out;
  sc.days[wd].forEach((en, i) => { if (en && en.subj) out.push({ period: i, subj: en.subj, room: en.room || null, teacherId: en.teacherId || null }); });
  return out;
}
function subjOf(clsId, iso, period) {
  const en = scheduleEntry(clsId, iso, period);
  return en ? (en.subj || null) : null;
}
function scheduleSubjectsOf(clsId) {
  const set = new Set();
  const sc = scheduleOf(clsId);
  [1, 2, 3, 4, 5].forEach(d => sc.days[d].forEach(en => { if (en && en.subj) set.add(en.subj); }));
  return set;
}
function currentLessonInfo(clsId, iso) {
  if (iso !== todayISO()) return { state: 'off', lesson: null };
  const lessons = lessonsOfDay(clsId, iso);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  for (const l of lessons) {
    const t = slotOf(clsId, l.period);
    const s = toMin(t.s), e = toMin(t.e);
    if (nowMin >= s && nowMin < e) {
      return { state: 'now', lesson: l, remainSec: (e - nowMin) * 60, prog: Math.min(100, ((nowMin - s) / Math.max(1, e - s)) * 100) };
    }
  }
  for (const l of lessons) {
    const t = slotOf(clsId, l.period);
    if (nowMin < toMin(t.s)) return { state: 'next', lesson: l, inMin: toMin(t.s) - nowMin };
  }
  return { state: 'done', lesson: null };
}
/* ---------- učebny školy ---------- */
const ROOM_DEF_COLOR = '#64748B';
const ROOM_PALETTE = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#14B8A6', '#F97316', '#84CC16', '#6366F1', '#F43F5E', '#0EA5E9', '#22C55E', '#EAB308', '#A855F7', '#FB7185', '#2DD4BF', '#60A5FA', '#64748B'];
function roomsList() { return db.rooms || (db.rooms = []); }
/* krátká zkratka učebny (např. „A607“); prázdná → první písmena názvu */
function genRoomShort(name, roomsArr) {
  const list = roomsArr || roomsList();
  const used = new Set(list.map(r => (r.short || '').toUpperCase()).filter(Boolean));
  const base = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  let short = base || 'UC';
  let i = 2;
  while (used.has(short)) short = (base || 'UC') + (i++);
  return short;
}
function roomShort(roomId) {
  const r = roomsList().find(x => x.id === roomId);
  return r ? (r.short || r.name || '') : (roomId || '');
}
function roomColor(roomId) {
  const r = roomsList().find(x => x.id === roomId);
  return r ? (r.color || ROOM_DEF_COLOR) : ROOM_DEF_COLOR;
}
/* starší záznamy učeben bez zkratky/barvy doplní automaticky (uloží jen když je co doplňovat) */
function roomsEnsure() {
  let dirty = false;
  roomsList().forEach(r => {
    if (!r.short || !r.color) { dirty = true; }
    if (!r.short) r.short = genRoomShort(r.name, roomsList());
    if (!r.color) r.color = ROOM_PALETTE[roomsList().indexOf(r) % ROOM_PALETTE.length];
  });
  if (dirty) saveDB();
}
function roomName(roomId) {
  const r = roomsList().find(x => x.id === roomId);
  return r ? r.name : (roomId || '');
}
function roomCodeTaken(code) {
  const c = String(code || '').trim().toUpperCase();
  return c ? roomsList().some(r => (r.short || '').toUpperCase() === c) : false;
}
function addRoom(name, short, color) {
  const id = uid();
  const s = String(short || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  roomsList().push({ id, name, short: s || genRoomShort(name), color: color || ROOM_DEF_COLOR });
  saveDB();
  return id;
}
function removeRoom(roomId) {
  db.rooms = roomsList().filter(r => r.id !== roomId);
  (db.classes || []).forEach(c => {
    const sc = db.schedule[c.id];
    if (!sc || !sc.days) return;
    [1, 2, 3, 4, 5].forEach(d => sc.days[d].forEach(en => { if (en && en.room === roomId) en.room = null; }));
  });
  saveDB();
}
/* na kolika místech se učebna používá v rozvrhu (pro potvrzení smazání) */
function roomUsageCount(roomId) {
  let n = 0;
  (db.classes || []).forEach(c => {
    const sc = db.schedule[c.id];
    if (!sc || !sc.days) return;
    [1, 2, 3, 4, 5].forEach(d => (sc.days[d] || []).forEach(en => { if (en && en.room === roomId) n++; }));
  });
  return n;
}

/* ================= POLOLETNÍ KLASIFIKACE (vysvědčení) =================
   1. pololetí = známky do 31. 1., 2. pololetí = od 1. 2. daného školního roku.
   db.reports[clsId][sem] = { closed, closedAt, checked:{sid:{subj:grade}} }  */
function reportsEnsure() {
  if (!db.reports) db.reports = {};
}
/* hranice pololetí dle školního roku, který PRÁVĚ běží (začíná v září).
   Příklad dnes (září 2026): školní rok 2026/2027, 1. pololetí 9/2026–1/2027. */
function currentSchoolYear() {
  const now = new Date();
  const y = now.getFullYear();
  return (now.getMonth() + 1 >= 9 ? y : y - 1) + 1; // koncový rok (např. 2027)
}
function schoolYearLabel() { return (currentSchoolYear() - 1) + '/' + currentSchoolYear(); }
function schoolYearBounds() {
  const y1 = currentSchoolYear();
  return { s1Start: (y1 - 1) + '-09-01', s1End: y1 + '-01-31', s2Start: y1 + '-02-01', s2End: y1 + '-06-30' };
}
function semLabel(sem) { return sem === 1 ? '1. pololetí' : '2. pololetí'; }
function semDateLabel(sem) { return sem === 1 ? 'leden' : 'červen'; }
/* do kterého pololetí spadá datum (1/2); mimo školní rok → 1 */
function semOfDate(iso) {
  const b = schoolYearBounds();
  if (!iso) return 1;
  if (iso >= b.s2Start && iso <= b.s2End) return 2;
  return 1;
}
/* známky žáka za pololetí vč. zobrazení: sloupec + token (bez „?“ plánovaných) */
function semesterColumnGradesOf(sid, subj, sem) {
  const b = schoolYearBounds();
  const [a, c] = sem === 1 ? [b.s1Start, b.s1End] : [b.s2Start, b.s2End];
  return columnsFor(sid)
    .filter(col => col.subj === subj && col.date && col.date >= a && col.date <= c && col.cells && col.cells[sid] !== undefined && col.cells[sid] !== '' && col.cells[sid] !== '?')
    .sort((x, y) => (x.date === y.date ? 0 : x.date < y.date ? -1 : 1));
}

/* ---------- pochvaly a výchovná opatření (průběžná klasifikace) ---------- */
const REC_TYPES = [
  { id: 'pch-tu', label: 'Pochvala třídního učitele', tone: 'ok' },
  { id: 'pch-red', label: 'Pochvala ředitele školy', tone: 'accent' },
  { id: 'nap-tu', label: 'Napomenutí třídního učitele', tone: 'warn' },
  { id: 'du-tu', label: 'Důtka třídního učitele', tone: 'bad' },
  { id: 'du-red', label: 'Důtka ředitele školy', tone: 'bad' }
];
const REC_BY_ID = {}; REC_TYPES.forEach(r => { REC_BY_ID[r.id] = r; });
function recordsOf(sid) { return (db.records || []).filter(r => r.sid === sid); }
function recordsEnsure() { if (!db.records) db.records = []; }

/* ---------- poznámky učitele k žákovi (závažnost 1–3) ---------- */
const NOTE_SEVS = [
  { id: 1, label: '1 · drobná', cls: 'chip-ok' },
  { id: 2, label: '2 · střední', cls: 'chip-warn' },
  { id: 3, label: '3 · závažná', cls: 'chip-bad' }
];
function notesEnsure() { if (!db.notes) db.notes = []; }
function notesOf(sid) { return (db.notes || []).filter(n => n.sid === sid); }
function noteSevChip(sev) {
  const s = NOTE_SEVS.find(x => x.id === Number(sev)) || NOTE_SEVS[0];
  return '<span class="chip ' + s.cls + '" style="padding:2px 9px;font-size:11px">' + s.label + '</span>';
}

/* ---------- plán akcí (budoucí akce třídy / vybraného žáka) ---------- */
function actionsEnsure() { if (!db.actions) db.actions = []; }
function actionsOfClass(clsId) { return (db.actions || []).filter(a => a.cls === clsId); }
/* akce, které se týkají žáka: celotřídní + jeho vlastní */
function actionsFor(sid) {
  const st = studentOf(sid);
  if (!st) return [];
  return (db.actions || []).filter(a => a.cls === st.cls && (!a.sid || a.sid === sid));
}
/* kolik dní zbývá do akce: 0 = dnes, záporné = proběhla před |d| dny */
function daysUntilAction(iso) {
  if (!iso) return 0;
  const t = new Date(iso + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((t - now) / 86400000);
}

/* ---------- změny rozvrhu (odpadlá hodina, změna místnosti / učitele / předmětu) ---------- */
const CHANGE_KINDS = [
  { id: 'odpadla',  label: 'Odpadlá hodina' },
  { id: 'mistnost', label: 'Změna místnosti' },
  { id: 'ucitel',   label: 'Změna učitele' },
  { id: 'predmet',  label: 'Změna předmětu' }
];
function changesEnsure() { if (!db.changes) db.changes = []; }
function changeFor(clsId, iso, period) {
  return (db.changes || []).find(c => c.cls === clsId && c.date === iso && c.period === period) || null;
}
function changesOfClass(clsId) { return (db.changes || []).filter(c => c.cls === clsId); }
function changeShortLabel(c) {
  return ({ odpadla: 'odpadlá', mistnost: 'místnost', ucitel: 'učitel', predmet: 'předmět' })[c.kind] || 'změna';
}
function actionCountdownChip(days) {
  if (days < 0) return '<span class="chip" style="opacity:.7">proběhlo</span>';
  if (days === 0) return '<span class="chip chip-bad">dnes</span>';
  const txt = 'za ' + days + ' ' + csPlural(days, 'den', 'dny', 'dní');
  return days <= 7 ? '<span class="chip chip-warn">' + txt + '</span>' : '<span class="chip chip-ok">' + txt + '</span>';
}
/* známky žáka z předmětu omezené na pololetí (vč. váhy) */
function semesterGradesOf(sid, subj, sem) {
  const b = schoolYearBounds();
  const [a, c] = sem === 1 ? [b.s1Start, b.s1End] : [b.s2Start, b.s2End];
  return columnsFor(sid)
    .filter(col => col.subj === subj && col.date && col.date >= a && col.date <= c && col.cells && col.cells[sid] !== undefined && col.cells[sid] !== '' && col.cells[sid] !== '?')
    .map(col => ({ v: tokenVal(col.cells[sid]), w: col.weight || 1 }))
    .filter(x => x.v !== null);
}
/* průměr za pololetí (započítané známky) – {avg,count} */
function semesterAvgOf(sid, subj, sem) {
  const list = semesterGradesOf(sid, subj, sem);
  const sw = list.reduce((s, g) => s + g.w, 0);
  const sv = list.reduce((s, g) => s + g.v * g.w, 0);
  return sw ? { avg: sv / sw, count: list.length } : { avg: null, count: 0 };
}
/* navržená známka z průměru dle tabulky pololetí:
   rozhodne: true = „Rozhoduje učitel“ (1,45–1,55 atd.), známka se nevyplní sama. */
function gradeFromAvg(a) {
  if (a === null || a === undefined) return { g: null, decide: false };
  if (a < 1.45) return { g: 1, decide: false };
  if (a <= 1.55) return { g: null, decide: true };
  if (a < 2.45) return { g: 2, decide: false };
  if (a <= 2.55) return { g: null, decide: true };
  if (a < 3.45) return { g: 3, decide: false };
  if (a <= 3.55) return { g: null, decide: true };
  if (a < 4.45) return { g: 4, decide: false };
  if (a <= 4.55) return { g: null, decide: true };
  return { g: 5, decide: false };
}
/* report třídy pro pololetí (vytvoří, když chybí) */
function classReport(clsId, sem) {
  reportsEnsure();
  const byCls = db.reports[clsId] || (db.reports[clsId] = {});
  const r = byCls[sem] || (byCls[sem] = { closed: false, closedAt: null, checked: {} });
  return r;
}
function reportClosed(clsId, sem) { const r = classReport(clsId, sem); return !!r.closed; }
/* předměty dané třídy (rozvrh + zapsané známky) */
function classSubjects(clsId) {
  const set = scheduleSubjectsOf(clsId);
  (db.columns || []).forEach(c => { if (c.cls === clsId) set.add(c.subj); });
  return SUBJ_KEYS.filter(k => set.has(k));
}
/* předměty, u kterých má žák v pololetí nějaké známky */
function semesterGradedSubjects(sid, sem) {
  return classSubjects(studentOf(sid) ? studentOf(sid).cls : null)
    .filter(sub => semesterGradesOf(sid, sub, sem).length > 0);
}
/* zbývající „rozhoduje učitel“ bez vybrané známky */
function reportPendingCount(clsId, sem) {
  let n = 0;
  studentsOfClass(clsId).forEach(st => {
    const subjList = classSubjects(clsId);
    subjList.forEach(sub => {
      const a = semesterAvgOf(st.id, sub, sem);
      if (!a.avg) return;
      const g = gradeFromAvg(a.avg);
      if (g.decide && !(classReport(clsId, sem).checked[st.id] || {})[sub]) n++;
    });
  });
  return n;
}
/* navrhované známky celé třídy naplní do checked (bez přepsání ručně zadaných) */
function reportAutoFill(clsId, sem) {
  const r = classReport(clsId, sem);
  studentsOfClass(clsId).forEach(st => {
    classSubjects(clsId).forEach(sub => {
      const a = semesterAvgOf(st.id, sub, sem);
      if (!a.avg) return;
      const g = gradeFromAvg(a.avg);
      if (!g.g) return; // hraniční pásmo: rozhodne učitel
      const m = r.checked[st.id] || (r.checked[st.id] = {});
      if (m[sub] === undefined || m[sub] === null || m[sub] === '') m[sub] = String(g.g);
    });
  });
  saveDB();
}

/* ---------- známky ze sloupců ---------- */
function columnsFor(sid) {
  const st = studentOf(sid);
  if (!st) return [];
  return (db.columns || []).filter(c => c.cls === st.cls)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}
function subjectKeysOf(sid) {
  const st = studentOf(sid);
  if (!st) return [];
  const set = scheduleSubjectsOf(st.cls);
  (db.columns || []).forEach(c => { if (c.cls === st.cls) set.add(c.subj); });
  return SUBJ_KEYS.filter(k => set.has(k));
}
/* číselné známky pro průměr (započítané, datum ≤ dnes) */
function numericGradesOf(sid, subj) {
  return columnsFor(sid)
    .filter(c => c.subj === subj && c.date <= todayISO())
    .map(c => ({ col: c, cell: c.cells ? c.cells[sid] : undefined }))
    .filter(x => tokenCounted(x.cell))
    .map(x => ({
      id: x.col.id, sid, subj, v: tokenVal(x.cell), raw: x.cell, w: x.col.weight,
      title: x.col.title, date: x.col.date, note: x.col.note || ''
    }));
}
/* všechny známky žáka (včetně S/N/A/?) k zobrazení */
function gradesOf(sid, subj) {
  return columnsFor(sid)
    .filter(c => c.subj === subj && c.cells && c.cells[sid] !== undefined && c.cells[sid] !== '')
    .map(c => ({
      id: c.id, sid, subj, v: c.cells[sid], w: c.weight,
      title: c.title, date: c.date, note: c.note || '',
      planned: c.cells[sid] === '?'
    }))
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}
function weightedAvgOf(sid, subj) {
  const list = numericGradesOf(sid, subj);
  const sw = list.reduce((s, g) => s + (g.w || 1), 0);
  const sv = list.reduce((s, g) => s + g.v * (g.w || 1), 0);
  return sw ? { avg: sv / sw, count: list.length, sw, sv } : { avg: null, count: 0, sw: 0, sv: 0 };
}
function overallAvgOf(sid) {
  const avgs = [];
  subjectKeysOf(sid).forEach(sub => {
    const a = weightedAvgOf(sid, sub);
    if (a.avg !== null && a.count > 0) avgs.push(a.avg);
  });
  return avgs.length ? avgs.reduce((s, a) => s + a, 0) / avgs.length : null;
}
function hasGradeData(sid) {
  return columnsFor(sid).some(c => c.cells && c.cells[sid] !== undefined && c.cells[sid] !== '');
}
function worstSubjectOf(sid) {
  let worst = null;
  subjectKeysOf(sid).forEach(sub => {
    const a = weightedAvgOf(sid, sub);
    if (a.avg === null || a.count === 0) return;
    if (!worst || a.avg > worst.avg) worst = { subj: sub, avg: a.avg };
  });
  return worst;
}

/* uložení známky do tabulky: najde sloupec (předmět+název+datum+váha) nebo založí nový */
function gradeColFind(clsId, subj, title, date, weight) {
  return (db.columns || []).find(c => c.cls === clsId && c.subj === subj && c.title === title && c.date === date && Number(c.weight) === Number(weight));
}
function ensureColumn(clsId, subj, title, date, weight, note) {
  let col = gradeColFind(clsId, subj, title, date, weight);
  if (!col) {
    col = { id: uid(), cls: clsId, subj, title, date, weight: Number(weight || 1), note: note || '', cells: {} };
    db.columns.push(col);
  } else if (note) { col.note = note; }
  return col;
}
function addGrade(g) {
  const st = studentOf(g.sid);
  if (!st) return;
  const col = ensureColumn(st.cls, g.subj, g.title, g.date, g.w, g.note);
  col.cells[g.sid] = g.v;
  notifyGrade(g, st);
  saveDB();
  toast('Zapsáno: ' + st.first + ' ' + st.last + ' · ' + tokenShort(g.v) + ' z ' + SUBJECTS[g.subj].name + ' ✓', 'ok');
  try { navigator.vibrate && navigator.vibrate(40); } catch (e) { /* noop */ }
}
function setCell(colId, sid, token) {
  const col = (db.columns || []).find(c => c.id === colId);
  if (!col) return;
  if (token === '' || token === null || token === undefined) { if (col.cells) delete col.cells[sid]; }
  else {
    if (!col.cells) col.cells = {};
    col.cells[sid] = token;
  }
  saveDB();
}
function deleteColumnById(id) {
  db.columns = (db.columns || []).filter(c => c.id !== id);
  saveDB();
}
function notifyGrade(g, st) {
  db.users.forEach(uu => {
    if (uu.role === 'student' && uu.studentId === g.sid) {
      db.notifs.push({ userId: uu.id, type: 'grade', text: 'Nová známka z ' + SUBJECTS[g.subj].name + ' – ' + tokenShort(g.v), ts: nowISO(), route: 'znamky' });
    }
    if (uu.role === 'rodic' && (uu.children || []).includes(g.sid)) {
      db.notifs.push({ userId: uu.id, type: 'grade', text: 'Nové hodnocení pro ' + st.first + ': ' + SUBJECTS[g.subj].name + ' – ' + tokenShort(g.v), ts: nowISO(), route: 'prehled' });
    }
  });
}

/* ---------- docházka (po hodinách, v třídní knize) ----------
   Učitel zapisuje u každé hodiny (datum + hodina) ÚČAST každého žáka:
     /  = zatím nezadáno · P = přítomen (✓) · X = nepřítomen (✗) ·
     D  = dočasně / byl jen chvíli (✓ D) – omluvenka se očekává,
         ale hodina se nepočítá jako absence.
   ŠTÍTEK OMLUVENÍ (A / Č / N) se NEzapisuje – odvozuje se automaticky
   z omluvenek rodičů a zobrazuje se jen učiteli v třídní knize vpravo:
     – omluvenka čeká na schválení / učitel žádá doplnění → Č (čeká)
     – omluvenka schválená                              → A (omluveno)
     – omluvenka zamítnutá                              → N (neomluveno)
     – ✗ / D bez omluvenky: do 3 dnů Č, poté N (omluvit jde dál)
   Statistiky: absence = jen ✗ (A + Č + N); D se vede zvlášť jako
   „dočasně“ a nikdy se nepočítá do zameškaných hodin ani do rizika.
   Riziko žáka: neomluvená absence (N) nad 25 % zapsaných hodin.
*/
const ATT_CS = {
  P: 'Přítomen',
  X: 'Nepřítomen',
  D: 'Dočasně – byl jen chvíli',
  A: 'Omluveno',
  C: 'Čeká na omluvení',
  N: 'Neomluveno'
};
/* pořadí ikon ÚČASTI v třídní knize (co může nastavit učitel) */
const ATT_ICONS = [
  ['P', 'Přítomen'],
  ['X', 'Nepřítomen (omluvenka se očekává)'],
  ['D', 'Dočasně – byl v hodině jen chvíli']
];
const ATT_GLYPH = { P: '✓', X: '✗', D: 'D' };
/* štítky omluvení (auto) */
const ATT_MARK = {
  A: ['A · omluveno', 'chip-ok'],
  C: ['Č · čeká', 'chip-warn'],
  N: ['N · neomluveno', 'chip-bad']
};
function excuseFor(sid, date, period) {
  return (db.excuses || []).find(x => x.childId === sid && x.date === date && (x.periods || []).includes(period));
}
/* záznam třídní knihy třídy pro danou hodinu (jeden na lekci) */
function cbRecOf(clsId, date, period) {
  return (db.classbook || []).find(r => r.cls === clsId && r.date === date && r.period === period) || null;
}
/* lekce zapsané v třídní knize třídy = proběhlé vyučovací hodiny (jmenovatel „3/10“) */
function classbookLessonsOf(clsId) {
  const out = [];
  (db.classbook || []).forEach(r => {
    if (r.cls !== clsId) return;
    const sub = r.subj || subjOf(clsId, r.date, r.period);
    if (!sub) return;
    out.push({ date: r.date, period: r.period, subj: sub, rec: r });
  });
  return out.sort((a, b) => (a.date === b.date ? a.period - b.period : a.date < b.date ? -1 : 1));
}
/* lekce třídy žáka (dle třídní knihy) */
function recordedLessonsOf(sid) {
  const st = studentOf(sid);
  return st ? classbookLessonsOf(st.cls) : [];
}
/* Zapsaná účast učitelem: P (✓), X (✗ = absence), D (dočasně – jen chvíli).
   Účel štítku omluvení (A/Č/N): odpovědět učiteli „je hodina omluvena?“;
   odvozuje se z omluvenek rodičů pro ✗ i D (u D se ale nepočítá do absence). */
function excuseMarkFor(sid, date, period, ex) {
  if (ex && ex.status === 'schvaleno') return 'A';
  if (ex && (ex.status === 'ceka' || ex.status === 'doplnit')) return 'C';
  if (ex && ex.status === 'zamitnuto') return 'N';
  /* ✗/D bez omluvenky: do 3 dnů „čeká“, poté „neomluveno“ */
  return date < addDaysISO(todayISO(), -3) ? 'N' : 'C';
}
/* ŠTÍTEK OMLUVENÍ pro třídní knihu (jen učitel): A/Č/N nebo null.
   Vztahuje se na nepřítomné (✗) i dočasné (D) – u „přítomen“ a „/“ nic. */
function absenceMark(sid, date, period) {
  const st = studentOf(sid);
  if (!st) return null;
  const rec = cbRecOf(st.cls, date, period);
  const stored = rec && rec.statuses ? rec.statuses[sid] : null;
  if (stored !== 'X' && stored !== 'D') return null;
  return excuseMarkFor(sid, date, period, excuseFor(sid, date, period));
}
/* odvozený stav pro STATISTIKY žáka (null = nic nezadáno „/“):
     P = přítomen · A/Č/N = absence ✗ (dle omluvenky) · D = dočasně
   D se NIKDY nepočítá jako zameškaná hodina (jen samostatný údaj). */
function lessonAbsStatus(sid, date, period) {
  const st = studentOf(sid);
  if (!st) return null;
  const rec = cbRecOf(st.cls, date, period);
  const stored = rec && rec.statuses ? rec.statuses[sid] : null;
  const ex = excuseFor(sid, date, period);
  if (stored === 'P') return 'P';
  if (stored === 'D') return 'D';
  const isAbs = stored === 'X' || stored === 'A' || stored === 'C' || stored === 'N';
  if (ex && ex.status === 'schvaleno') return 'A';
  if (ex && (ex.status === 'ceka' || ex.status === 'doplnit')) return 'C';
  if (ex && ex.status === 'zamitnuto') return 'N';
  if (isAbs) return date < addDaysISO(todayISO(), -3) ? 'N' : 'C';
  return null;
}
/* přehled absence žáka: celkem a rozpad po předmětech (dle třídní knihy třídy).
   missing = jen ✗ (A+Č+N); D = „dočasně“ zvlášť, mimo zameškané hodiny. */
function absenceOverview(sid) {
  const st = studentOf(sid);
  const mk = () => ({ lessons: 0, P: 0, A: 0, C: 0, N: 0, D: 0 });
  const total = mk();
  const bySubj = {};
  if (st) {
    classbookLessonsOf(st.cls).forEach(l => {
      const s = lessonAbsStatus(sid, l.date, l.period);
      const b = bySubj[l.subj] || (bySubj[l.subj] = mk());
      total.lessons++; b.lessons++;
      if (s) { total[s]++; b[s]++; }
    });
  }
  Object.keys(bySubj).forEach(k => {
    const o = bySubj[k];
    o.missing = o.A + o.C + o.N;
    o.unexPct = o.lessons ? Math.round((o.N / o.lessons) * 100) : 0;
  });
  total.missing = total.A + total.C + total.N;
  total.unexPct = total.lessons ? Math.round((total.N / total.lessons) * 100) : 0;
  return { total, bySubj };
}
/* události žáka (zameškané ✗ hodiny + dočasné D – u D jen informace) */
function absenceEvents(sid) {
  const st = studentOf(sid);
  if (!st) return [];
  const ev = [];
  classbookLessonsOf(st.cls).forEach(l => {
    const s = lessonAbsStatus(sid, l.date, l.period);
    if (!s || s === 'P') return;
    ev.push({ date: l.date, period: l.period, subj: l.subj, stts: s, note: (l.rec && l.rec.note) || '' });
  });
  return ev.sort((a, b) => (a.date === b.date ? a.period - b.period : a.date < b.date ? -1 : 1));
}
function absenceStats(sid) {
  const ov = absenceOverview(sid);
  return {
    A: ov.total.A,          // omluvené hodiny
    C: ov.total.C,          // čeká na omluvení
    N: ov.total.N,          // neomluvené hodiny
    D: ov.total.D,          // dočasně (nepočítá se jako absence)
    missing: ov.total.missing,
    present: ov.total.P,
    lessons: ov.total.lessons,
    pct: ov.total.unexPct
  };
}
/* předměty třídy: z rozvrhu + třídní knihy + známkovacích sloupců */
function subjectsOfClass(clsId) {
  const set = scheduleSubjectsOf(clsId);
  (db.classbook || []).forEach(r => { if (r.cls === clsId && r.subj) set.add(r.subj); });
  (db.columns || []).forEach(c => { if (c.cls === clsId) set.add(c.subj); });
  return SUBJ_KEYS.filter(k => set.has(k));
}
/* počet zapsaných hodin třídy po předmětech */
function classSubjectLessonCounts(clsId) {
  const m = {};
  classbookLessonsOf(clsId).forEach(l => { m[l.subj] = (m[l.subj] || 0) + 1; });
  return m;
}
/* popisek hodin omluvenky: „1.–3. hod. · Matematika, ČJ“ */
function excuseHoursLabel(clsId, date, periods) {
  if (!periods || !periods.length) return '';
  const ps = periods.slice().sort((a, b) => a - b);
  const ranges = [];
  let cur = [ps[0]];
  for (let i = 1; i < ps.length; i++) {
    if (ps[i] === cur[cur.length - 1] + 1) cur.push(ps[i]);
    else { ranges.push(cur); cur = [ps[i]]; }
  }
  ranges.push(cur);
  const parts = ranges.map(r => (r.length === 1 ? (r[0] + 1) + '. hod.' : (r[0] + 1) + '.–' + (r[r.length - 1] + 1) + '. hod.'));
  const subs = ps.map(p => {
    const s = subjOf(clsId, date, p);
    return s ? SUBJECTS[s].name : '';
  }).filter(Boolean);
  const subTxt = subs.length && subs.length <= 4 ? ' · ' + subs.join(', ') : '';
  return parts.join(', ') + subTxt;
}
/* hodiny, které lze omluvit v daný den (hodiny dle rozvrhu; bez rozvrhu všechny časy) */
function excusablePeriods(clsId, date) {
  const wd = weekdayOf(date);
  if (wd < 1 || wd > 5) return [];
  const sc = scheduleOf(clsId);
  const day = sc.days[wd] || [];
  const anySubj = day.some(en => en && en.subj);
  if (anySubj) return day.map((en, i) => (en && en.subj ? i : -1)).filter(i => i >= 0);
  return sc.slots.map((t, i) => i);
}
/* riziko: neomluvená absence nad 25 % zapsaných hodin nebo průměr horší než 3,5 */
function isAtRisk(sid) {
  const w = worstSubjectOf(sid);
  const ov = absenceOverview(sid);
  return (w && w.avg > 3.5) || ov.total.unexPct > 25;
}
function riskReason(sid) {
  const parts = [];
  const w = worstSubjectOf(sid);
  const ov = absenceOverview(sid);
  if (w && w.avg > 3.5) parts.push(SUBJECTS[w.subj].name + ': průměr ' + w.avg.toFixed(2));
  if (ov.total.unexPct > 25) parts.push('neomluvená absence ' + ov.total.unexPct + ' % (limit 25 %)');
  return parts;
}
/* učitelé třídy (pro notifikace o omluvenkách); bez učitele aspoň správce */
function classTeacherUsers(clsId) {
  const cls = classOf(clsId);
  const ids = cls ? (cls.teacherIds || []) : [];
  const out = (db.users || []).filter(u => u.role === 'ucitel' && ids.includes(u.id));
  return out.length ? out : (db.users || []).filter(u => u.isAdmin);
}
function notifyClassTeachers(clsId, text, route) {
  const seen = new Set();
  classTeacherUsers(clsId)
    .concat((db.users || []).filter(u => u.isAdmin))
    .forEach(u => { if (!seen.has(u.id)) { seen.add(u.id); db.notifs.push({ userId: u.id, type: 'excuse', text, ts: nowISO(), route: route || 'omluvenky' }); } });
}

/* ---------- zprávy a notifikace ---------- */
function threadUnreadFor(thread, userId) {
  return thread.msgs.filter(m => m.from !== userId && !m.readAt).length;
}
/* červený kroužek s počtem nepřečtených zpráv konverzace – zmizí po otevření */
function unreadDot(n) {
  return n > 0 ? '<span class="unread-dot">' + (n > 99 ? '99+' : n) + '</span>' : '';
}
function userUnreadMsgs(userId) {
  let n = 0;
  Object.keys(db.threads || {}).forEach(k => { n += threadUnreadFor(db.threads[k], userId); });
  return n;
}
function notifUnreadFor(userId) {
  const seen = db.seen[userId];
  return (db.notifs || []).filter(n => n.userId === userId && (!seen || new Date(n.ts) > new Date(seen))).length;
}
function markNotifsRead(userId) {
  db.seen[userId] = nowISO();
  saveDB();
}

/* ---------- generování přihlašovacích údajů ---------- */
function slugBase(s) {
  return s.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[č]/g, 'c').replace(/[ď]/g, 'd')
    .replace(/[éěè]/g, 'e').replace(/[íì]/g, 'i').replace(/[ň]/g, 'n')
    .replace(/[óö]/g, 'o').replace(/[ř]/g, 'r').replace(/[š]/g, 's')
    .replace(/[ť]/g, 't').replace(/[úů]/g, 'u').replace(/[ý]/g, 'y')
    .replace(/[ž]/g, 'z').replace(/[^a-z0-9]/g, '');
}
function genUsername(first, last) {
  const base = slugBase(first) + '.' + slugBase(last);
  let uname = base; let i = 2;
  while (db.users.some(u => u.username === uname)) { uname = base + (i++); }
  return uname;
}
function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
  /* generovaná hesla taky splňují podmínku „alespoň 1 číslice“ */
  if (!/[0-9]/.test(p)) p = p.slice(0, 7) + '23456789'[Math.floor(Math.random() * 8)];
  return p;
}
function addUserAccount(username, pass, role, extra) {
  const user = Object.assign({ id: uid(), username, pass, role }, extra);
  db.users.push(user);
  db.seen = db.seen || {};
  db.seen[user.id] = null;
  return user;
}
function usersLinkedToStudent(sid) {
  return db.users.filter(u =>
    (u.role === 'student' && u.studentId === sid) ||
    (u.role === 'rodic' && (u.children || []).includes(sid))
  );
}
/* třídní učitel žáka: hlavní třídní, jinak první přiřazený učitel */
function classTeacherOf(sid) {
  const st = studentOf(sid);
  if (!st) return null;
  const c = classOf(st.cls);
  if (!c) return null;
  const ts = db.users.filter(u => u.role === 'ucitel');
  let t = ts.find(u => u.id === c.mainTeacher) || null;
  if (!t) t = (c.teacherIds || []).map(id => ts.find(u => u.id === id)).find(Boolean) || null;
  return t || null;
}
/* nepřečtená nová hesla čekající na předání (sekce „Resetování hesel“ učitele) */
function teacherResetUnread(uid) {
  return (db.resetPass || []).filter(r => r.teacherId === uid && !r.read).length;
}
/* ---------- oznámení učitelů ---------- */
function annWhoLabel(w) {
  return ({ both: 'Rodiče i žáci', rodice: 'Pouze rodiče', zaci: 'Pouze žáci' })[w] || '';
}
/* oznámení viditelná pro uživatele: učitel vidí oznámení svých tříd,
   žák/rodič oznámení třídy podle příjemce (who: both/rodice/zaci) */
function annVisibleFor(user) {
  if (!user) return [];
  if (user.role === 'ucitel') {
    if (user.isAdmin) return (db.ann || []).slice();
    const mine = myClasses().map(c => c.id);
    return (db.ann || []).filter(a => mine.includes(a.cls));
  }
  if (user.role === 'student' || user.role === 'rodic') {
    let clsIds = [];
    if (user.role === 'student') {
      const s = studentOf(user.studentId);
      if (s) clsIds = [s.cls];
    } else {
      clsIds = (user.children || []).map(id => { const s = studentOf(id); return s ? s.cls : null; }).filter(Boolean);
    }
    return (db.ann || []).filter(a => clsIds.includes(a.cls) &&
      (a.who === 'both' || (user.role === 'student' ? a.who === 'zaci' : a.who === 'rodice')));
  }
  return [];
}
function annUnreadCount(user) {
  if (!user) return 0;
  const read = (db.annRead || {})[user.id] || {};
  return annVisibleFor(user).filter(a => a.teacherId !== user.id && !read[a.id]).length;
}
function annMarkRead(user) {
  if (!user) return;
  const vis = annVisibleFor(user);
  if (!vis.length) return;
  const read = (db.annRead = db.annRead || {});
  read[user.id] = read[user.id] || {};
  let dirty = false;
  vis.forEach(a => { if (!read[user.id][a.id]) { read[user.id][a.id] = 1; dirty = true; } });
  if (dirty) saveDB();
}
function removeStudentCascade(sid) {
  const st = studentOf(sid);
  if (!st) return;
  db.students = db.students.filter(s => s.id !== sid);
  db.columns.forEach(c => { if (c.cells) delete c.cells[sid]; });
  db.columns = db.columns.filter(c => !(c.cls === st.cls && Object.keys(c.cells || {}).length === 0));
  db.classbook.forEach(r => { if (r.statuses) delete r.statuses[sid]; });
  db.tasks.forEach(t => { if (t.done) delete t.done[sid]; });
  db.excuses = db.excuses.filter(e => e.childId !== sid);
  Object.keys(db.threads).forEach(k => {
    if (db.threads[k].childId === sid) delete db.threads[k];
  });
  const linked = usersLinkedToStudent(sid);
  db.users = db.users.filter(u => !linked.includes(u));
  db.notifs = db.notifs.filter(n => !linked.some(u => u.id === n.userId));
  saveDB();
}
function removeTeacherCascade(uid2) {
  db.classes.forEach(c => {
    c.teacherIds = (c.teacherIds || []).filter(id => id !== uid2);
    if (c.mainTeacher === uid2) c.mainTeacher = c.teacherIds[0] || null;
  });
  db.users = db.users.filter(u => u.id !== uid2);
  saveDB();
}
/* přejmenování třídy: id třídy se používá jako klíč rozvrhu a odkazuje se na něj
   ve sloupcích známek, třídní knize, úkolech, suplování i omluvenkách → vše migrujeme. */
function renameClassCascade(cid, newName) {
  const c = classOf(cid);
  if (!c) return false;
  if (db.classes.some(x => x.id === newName && x.id !== cid)) return false;
  c.name = newName;
  if (cid !== newName) {
    if (db.schedule) { db.schedule[newName] = db.schedule[cid]; delete db.schedule[cid]; }
    (db.students || []).forEach(s => { if (s.cls === cid) s.cls = newName; });
    (db.columns || []).forEach(x => { if (x.cls === cid) x.cls = newName; });
    (db.classbook || []).forEach(x => { if (x.cls === cid) x.cls = newName; });
    (db.tasks || []).forEach(x => { if (x.cls === cid) x.cls = newName; });
    (db.subs || []).forEach(x => { if (x.cls === cid) x.cls = newName; });
    (db.reservations || []).forEach(x => { if (x.cls === cid) x.cls = newName; });
    c.id = newName;
  }
  saveDB();
  return true;
}

/* ---------- úkoly ---------- */
/* úkoly třídy (třídní úkol: sid=null; úkol pro jednotlivce: sid=id žáka) */
function tasksOfClass(clsId) {
  return (db.tasks || []).filter(t => t.cls === clsId).sort((a, b) => (a.due === b.due ? 0 : a.due < b.due ? -1 : 1));
}
/* vytvoří úkol; deduplikace dle třídy+názvu (kvůli propisu z třídní knihy) */
function addTask(clsId, subj, title, due, note, sid, teacherId) {
  const dup = (db.tasks || []).find(t => t.cls === clsId && t.title === title);
  if (dup) return dup;
  const tk = { id: uid(), cls: clsId, sid: sid || null, subj: subj || null, title, due: due || nextSchoolDayISO(todayISO(), 0), note: note || '', done: {}, createdAt: nowISO(), teacherId: teacherId || null };
  db.tasks.push(tk);
  return tk;
}
function taskStudents(t) {
  if (t.sid) { const s = studentOf(t.sid); return s ? [s] : []; }
  return studentsOfClass(t.cls);
}
function taskDoneCount(t) { return taskStudents(t).filter(s => t.done && t.done[s.id]).length; }
function notifyTask(t) {
  taskStudents(t).forEach(s => {
    const acc = (db.users || []).find(x => x.role === 'student' && x.studentId === s.id);
    if (acc) db.notifs.push({ userId: acc.id, type: 'task', text: 'Nový úkol: ' + t.title, ts: nowISO(), route: 'ukoly' });
  });
}

/* čekající omluvenky pro uživatele (jeho třídy; admin vše) */
function pendingExcusesFor(u) {
  if (!u) return [];
  const clsIds = u.isAdmin
    ? (db.classes || []).map(c => c.id)
    : (db.classes || []).filter(c => (c.teacherIds || []).includes(u.id)).map(c => c.id);
  const kidSet = new Set((db.students || []).filter(s => clsIds.includes(s.cls)).map(s => s.id));
  return (db.excuses || []).filter(x => kidSet.has(x.childId) && (x.status === 'ceka' || x.status === 'doplnit'));
}

/* ---------- utility ---------- */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function avgColor(a) {
  if (a === null || a === undefined) return 'var(--muted)';
  if (a <= 1.5) return 'var(--ok)';
  if (a <= 2.5) return '#A3E635';
  if (a <= 3.5) return 'var(--warn)';
  return 'var(--bad)';
}
function avgTxt(a) { return a === null ? '—' : a.toFixed(2); }
function gradeCellHtml(token, title) {
  const cls = gradeColor(token);
  return '<span class="g-cell ' + (cls || '') + '" title="' + escapeHtml(title || '') + '">' + escapeHtml(tokenShort(token)) + '</span>';
}
