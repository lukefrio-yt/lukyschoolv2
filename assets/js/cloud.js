/* ============================================================
   LukySchool – cloudová synchronizace přes Supabase (PostgREST)

   Celá škola se ukládá jako JEDEN řádek tabulky school_state
   (sloupec payload = celý JSON aplikace, viz supabase.sql).

   Jak to funguje:
   - při startu (a návratu do okna) se aplikace podívá do cloudu:
     je-li tam verze novější (nebo je místní zařízení „prázdné“),
     stáhne ji; jinak počká na první změny,
   - každé uložení dat (saveDB → window.cloudDirty) pošle změny
     nahoru (s malým zpožděním, aby se náhlé změny spojily),
   - než se odešle, zkontroluje se, že nás nikdo „nepředběhl“ –
     v takovém případě se stáhne novější verze z cloudu.

   REŽIM JE URČENÝ PRO TEST/ROZBĚH: přístup chrání jen publishable
   klíč (veřejný) + pravidla RLS. Před ostrými daty skutečných žáků
   je nutné přepnout na přihlašování uživatelů (Supabase Auth) –
   viz DATABAZE.md.
   ============================================================ */
'use strict';

(function () {
  /* bez konfigurace (nebo vypnuto) se nic neděje – aplikace jede na localStorage */
  if (typeof SUPA_URL === 'undefined' || typeof SUPA_PUBLISHABLE_KEY === 'undefined' || !SUPA_ENABLED || !window.fetch) return;

  const TABLE = 'school_state';
  const ROW_ID = 'main';
  const TS_KEY = 'lukySchool.cloud.ts';   /* shoduje se s DB_TS_KEY v data.js */

  let pendingTimer = null;
  let suppressPush = false;   /* potlačení zpětného odeslání při stahování */
  let warnedMissing = false;  /* hláška o chybějící tabulce jen jednou */

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* noop */ } }

  function hdrs(json) {
    const h = {
      apikey: SUPA_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + SUPA_PUBLISHABLE_KEY
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async function errInfo(res) {
    const e = new Error('HTTP ' + res.status);
    try {
      const b = await res.json();
      if (b && b.code) e.code = b.code;
      if (b && b.message) e.message = b.message;
      if (res.status === 404 || /does not exist|PGRST301/i.test(e.message)) e.missing = true;
    } catch (err) { /* nejsonová odpověď */ }
    return e;
  }

  async function fetchRow() {
    const url = SUPA_URL + '/rest/v1/' + TABLE + '?select=payload,updated_at&id=eq.' + ROW_ID;
    const res = await fetch(url, { headers: hdrs(false) });
    if (!res.ok) throw await errInfo(res);
    const rows = await res.json();
    return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
  }

  async function pushRow() {
    const body = { id: ROW_ID, payload: db, updated_at: new Date().toISOString() };
    const res = await fetch(SUPA_URL + '/rest/v1/' + TABLE, {
      method: 'POST',
      headers: Object.assign(hdrs(true), { Prefer: 'return=minimal,resolution=merge-duplicates' }),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await errInfo(res);
  }

  /* „prázdná škola“ = čerstvý seed (jen ředitel admin, žádná data) */
  function isPristine() {
    try {
      if (!db) return true;
      if ((db.classes || []).length) return false;
      if ((db.students || []).length) return false;
      if ((db.tasks || []).length) return false;
      if ((db.columns || []).length) return false;
      if ((db.classbook || []).length) return false;
      if ((db.excuses || []).length) return false;
      if (Object.keys(db.schedule || {}).length) return false;
      if (Object.keys(db.threads || {}).length) return false;
      const users = db.users || [];
      return users.length === 1 && users[0] && users[0].username === 'admin' && users[0].isAdmin === true;
    } catch (e) { return false; }
  }

  /* stáhnout verzi z cloudu a nahradit lokální (pokud se liší) */
  function adopt(row) {
    let parsed = null;
    try { parsed = migrateDB(JSON.parse(JSON.stringify(row.payload))); } catch (e) { parsed = null; }
    if (!parsed || parsed.v !== DB_VERSION || !parsed.classes) return;
    const cloudTs = Date.parse(row.updated_at) || 0;
    try {
      if (JSON.stringify(parsed) === JSON.stringify(db)) {
        lsSet(TS_KEY, String(cloudTs));
        return;
      }
    } catch (e) { /* porovnání selhalo → stáhneme */ }
    suppressPush = true;
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
    db = parsed;
    if (typeof roomsEnsure === 'function') roomsEnsure();
    if (typeof reportsEnsure === 'function') reportsEnsure();
    if (typeof recordsEnsure === 'function') recordsEnsure();
    if (typeof notesEnsure === 'function') notesEnsure();
    if (typeof actionsEnsure === 'function') actionsEnsure();
    if (typeof changesEnsure === 'function') changesEnsure();
    if (typeof subjDeletedList === 'function') subjDeletedList();
    if (typeof refreshSubjects === 'function') refreshSubjects();
    saveDB();                         /* lokální kopie + timestamp */
    lsSet(TS_KEY, String(cloudTs));   /* baseline = čas z cloudu */
    suppressPush = false;
    if (typeof refreshSubjects === 'function') refreshSubjects();
    if (typeof route === 'function') route();
    if (typeof toast === 'function') toast('Data byla načtena z cloudu (novější verze)', 'ok');
  }

  function warnMissing() {
    if (warnedMissing) return;
    warnedMissing = true;
    console.warn('Cloud: tabulka ' + TABLE + ' v Supabase neexistuje nebo nemá povolený přístup. Spusťte skript supabase.sql v SQL Editoru.');
    if (typeof toast === 'function') {
      toast('Cloud není připojený – v Supabase (SQL Editor) spusť skript <b>supabase.sql</b>', 'bad');
    }
  }

  /* odeslání s kontrolou, že nás nikdo nepředběhl */
  async function pushNow() {
    if (suppressPush || !db) return;
    const localTs = Number(lsGet(TS_KEY) || 0);
    try {
      const row = await fetchRow();
      if (row && row.payload) {
        const payloadV = row.payload.v || 0;
        const cloudTs = Date.parse(row.updated_at) || 0;
        if (payloadV < DB_VERSION) { /* stará verze z cloudu → přepíšeme ji */
          await pushRow();
          return;
        }
        if (cloudTs >= localTs) { adopt(row); return; }   /* jiné zařízení je novější */
      }
    } catch (e) {
      if (e && e.missing) { warnMissing(); return; }
      console.warn('Cloud: kontrola před odesláním selhala', (e && e.message) || e);
      return; /* zkusíme znovu při příštím uložení */
    }
    try {
      await pushRow();
    } catch (e) {
      if (e && e.missing) { warnMissing(); return; }
      console.warn('Cloud: odeslání selhalo', (e && e.message) || e);
    }
  }

  function markDirty() {
    if (suppressPush) return;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(function () { pendingTimer = null; pushNow(); }, 1000);
  }
  window.cloudDirty = markDirty;

  /* start: zkontrolovat cloud (novější stáhnout, jinak počkat na změny) */
  async function bootSync() {
    if (!db) return;
    let row = null;
    try {
      row = await fetchRow();
    } catch (e) {
      if (e && e.missing) { warnMissing(); return; }
      console.warn('Cloud: nelze se připojit (' + SUPA_URL + ')', (e && e.message) || e);
      return;
    }
    const localTs = Number(lsGet(TS_KEY) || 0);
    if (!row || !row.payload) {
      /* cloud je prázdný → pošleme tam data, jen pokud už škola něco má */
      if (!isPristine()) { pendingTimer = setTimeout(function () { pendingTimer = null; pushNow(); }, 0); }
      return;
    }
    const payloadV = row.payload.v || 0;
    const cloudTs = Date.parse(row.updated_at) || 0;
    if (payloadV < DB_VERSION) {
      /* v cloudu je stará verze → přepíšeme ji lokálními daty */
      pendingTimer = setTimeout(function () { pendingTimer = null; pushNow(); }, 0);
      return;
    }
    if (cloudTs >= localTs || isPristine()) {
      adopt(row);
    } else {
      /* lokální zařízení má novější data (např. práce offline) → odešleme je */
      pendingTimer = setTimeout(function () { pendingTimer = null; pushNow(); }, 0);
    }
  }

  /* při návratu do okna zkontrolujeme cloud; při odchodu dorazíme rozpracované změny */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { bootSync(); return; }
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; pushNow(); }
  });
  window.addEventListener('pagehide', function () {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; if (db && !suppressPush) pushNow(); }
  });

  function start() {
    console.log('Cloud sync: zapnuto → ' + SUPA_URL);
    bootSync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
