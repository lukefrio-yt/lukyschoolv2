/* ============================================================
   SchoolSys — pohledy ŽÁKA a RODIČE (sloupcový známkovač)
   ============================================================ */
'use strict';

let TICKER = null;
function clearTick() { if (TICKER) { clearInterval(TICKER); TICKER = null; } }
function setTick(fn, ms) { clearTick(); TICKER = setInterval(fn, ms); }

function mySid() { return currentStudentId(); }
function myCls() { const s = studentOf(mySid()); return s ? s.cls : null; }
function mySubjKeys() { const sid = mySid(); return sid ? subjectKeysOf(sid) : []; }
/* třída aktuálně prohlíženého dítěte – žák i rodič (pro Rozvrh, Výuku…) */
function myClassId() {
  const u = currentUser();
  if (!u) return null;
  if (u.role === 'student') { const s = studentOf(u.studentId); return s ? s.cls : null; }
  if (u.role === 'rodic') { const s = studentOf(parentCurChild()); return s ? s.cls : null; }
  return null;
}

/* ================= ŽÁK ================= */
function sPrehled() {
  clearTick();
  const sid = mySid();
  const st = studentOf(sid);
  const avg = overallAvgOf(sid);
  const worst = worstSubjectOf(sid);
  const tasks = tasksFor(sid);
  const undone = tasks.filter(t => !t.done[sid]);
  const myTasks = undone.filter(t => dueWithin(t.due, 4));
  const recent = db.columns
    .filter(c => c.cls === st.cls && c.cells && c.cells[sid] !== undefined && c.cells[sid] !== '')
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
    .slice(0, 6);
  const state = dayStateHtml(st.cls);
  const cnt = db.columns.filter(c => c.cls === st.cls && c.cells && c.cells[sid] !== undefined && c.cells[sid] !== '' && tokenCounted(c.cells[sid])).length;

  return '' +
  '<div class="page-head"><div><h1>Ahoj, ' + escapeHtml(st.first) + '! 👋</h1>' +
    '<div class="sub">' + todayLabel() + ' · ' + escapeHtml(st.cls) + '</div></div>' +
    '<div class="page-acts"><button class="btn btn-ghost btn-sm" data-act="goto:#/student/znamky">' + ic('calc', 15) + ' Předvídač průměru</button></div></div>' +
  (state.txt && state.txt.indexOf('skončilo') === -1 && state.txt.indexOf('není škola') === -1 ? '<div class="warn-line" data-cd>' + state.icon + ' <span data-cd-txt>' + state.txt + '</span></div>' : '') +
  chgAlertHtml(st.cls) +
  '<div class="grid grid-3">' +
    '<div class="card" style="grid-column:span 2">' +
      '<div class="card-title">' + ic('zap', 17) + ' Tvůj průměr</div>' +
      '<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap">' +
        '<span class="avg-big" style="color:' + avgColor(avg) + '">' + avgTxt(avg) + '</span>' +
        (worst && worst.avg > 3
          ? '<span class="chip chip-bad">Pozor na ' + escapeHtml(SUBJECTS[worst.subj].name) + ' (' + worst.avg.toFixed(2) + ')</span>'
          : '<span class="chip chip-ok">' + (avg === null ? 'Zatím žádné známky' : 'Držíš to pěkně') + '</span>') +
        '<span class="small-note" style="margin-left:auto">' + cnt + ' ' + csPlural(cnt, 'Započítaná známka', 'Započítané známky', 'Započítaných známek') + '</span>' +
      '</div>' +
      '<div style="margin-top:14px;display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">' +
        mySubjKeys().map(sub => {
          const a = weightedAvgOf(sid, sub);
          return '<div class="list-row" style="padding:9px 11px;cursor:pointer" data-act="goto:#/student/znamky|' + sub + '">' +
            subjBadge(sub, 30) + '<div class="grow"><div class="row-title" style="font-size:13px">' + SUBJECTS[sub].name + '</div></div>' +
            '<b style="color:' + avgColor(a.avg) + '">' + avgTxt(a.avg) + '</b></div>';
        }).join('') +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<div class="card-title">' + ic('list', 17) + ' Na dnešek/týden</div>' +
      (myTasks.length
        ? '<div class="list">' + myTasks.map(t => taskRow(t, sid, false)).join('') + '</div>'
        : '<div class="empty"><b>Úkoly splněny</b></div>') +
      '<button class="btn btn-soft btn-sm" style="width:100%;margin-top:12px" data-act="goto:#/student/ukoly">Všechny úkoly</button>' +
    '</div>' +
  '</div>' +
  '<div class="card" style="margin-top:16px"><div class="card-title">' + ic('book', 17) + ' Poslední záznamy</div>' +
    (recent.length
      ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Datum</th><th>Předmět</th><th>Test / sloupec</th><th class="num">Známka</th><th class="num">Váha</th></tr></thead><tbody>' +
        recent.map(g => '<tr><td style="white-space:nowrap">' + fmtDate(g.date) + '</td><td>' + escapeHtml(SUBJECTS[g.subj].name) + '</td><td>' +
          escapeHtml(g.title) + (g.cells[sid] === '?' ? ' <span class="chip chip-info" style="padding:0 6px;font-size:10px">Plánováno</span>' : '') + '</td>' +
          '<td class="num">' + gradeCellHtml(g.cells[sid], g.title) + '</td><td class="num">' + (g.weight || 1) + '×</td></tr>').join('') +
        '</tbody></table></div>'
      : '<div class="empty"><b>Zatím žádné známky</b></div>') +
  '</div>';
}
function dueWithin(due, days) { return addDaysISO(todayISO(), days) >= due; }

function dayStateHtml(cls) {
  const info = currentLessonInfo(cls, todayISO());
  const today = todayISO();
  const chgToday = (db.changes || []).filter(x => x.date === today && x.cls === cls);
  let icon = ic('calendar', 16), txt = '';
  if (info.state === 'now') {
    txt = 'Právě probíhá <b>' + escapeHtml(SUBJECTS[info.lesson.subj].name) + '</b> · do konce <b data-cd-remain style="color:var(--accent)">—</b>';
  } else if (info.state === 'next') {
    txt = 'Další hodina: <b>' + escapeHtml(SUBJECTS[info.lesson.subj].name) + '</b> za ' + info.inMin + ' min';
  } else if (info.state === 'done') {
    txt = 'Dnešní vyučování skončilo. Užívej zbytek dne! 🎉';
  } else {
    const nx = nextSchoolDayISO(todayISO(), 0);
    const subj = subjOf(cls, nx, 0);
    txt = 'Dnes není škola · příští hodina ' + WD_CS[weekdayOf(nx) - 1] + ' „' + escapeHtml(subj ? SUBJECTS[subj].name : '—') + '“';
  }
  if (chgToday.length) txt += ' &nbsp;·&nbsp; <span class="chip chip-bad" style="padding:1px 8px">' + chgToday.length + ' ' + csPlural(chgToday.length, 'Změna', 'Změny', 'Změn') + ' v rozvrhu</span>';
  return { icon, txt };
}
/* Upozornění v Přehledu: změny rozvrhu na dnešek a zítřek (S/O/M/P/Z) */
function chgAlertHtml(cls) {
  const days = [['Dnes', todayISO()], ['Zítra', addDaysISO(todayISO(), 1)]];
  const CHG_MARK = { odpadla: ['O', 'Odpadá'], mistnost: ['M', 'Změna místnosti'], ucitel: ['S', 'Suplování'], predmet: ['Z', 'Změna předmětu'], pridana: ['P', 'Přidaná hodina'] };
  const rows = [];
  days.forEach(([label, iso]) => {
    changesOfClsInRange(cls, iso, iso).forEach(c => {
      const m = CHG_MARK[c.kind] || ['', 'Změna'];
      const en0 = ((db.schedule || {})[cls] || { days: {} }).days[weekdayOf(c.date)] || [];
      const orig = (en0 || [])[c.period] || null;
      const origName = orig && orig.subj && SUBJECTS[orig.subj] ? SUBJECTS[orig.subj].name : null;
      let detail = '';
      if (c.kind === 'odpadla') detail = origName ? origName + ' odpadá' : 'Hodina odpadá';
      else if (c.kind === 'mistnost') { const r = roomsList().find(x => x.id === c.newRoom); detail = (origName ? origName + ' – j' : 'J') + 'iná učebna: ' + (r ? r.name : (c.newRoom || '?')); }
      else if (c.kind === 'ucitel') { const nu = c.newTeacherId ? (db.users || []).find(x => x.id === c.newTeacherId) : null; detail = (origName ? origName + ' – supluje ' : 'Supluje ') + (nu ? nu.name : (c.newTeacher || '?')); }
      else if (c.kind === 'predmet') detail = origName ? origName + ' → ' + (c.newSubj && SUBJECTS[c.newSubj] ? SUBJECTS[c.newSubj].name : '?') : 'Změna předmětu';
      else detail = (c.newSubj && SUBJECTS[c.newSubj] ? SUBJECTS[c.newSubj].name : 'Hodina') + ' – přidaná hodina';
      rows.push('<div class="chg-item' + (c.kind === 'odpadla' ? ' chg-bad' : c.kind === 'pridana' ? ' chg-good' : '') + '" style="padding:10px 12px">' +
        '<div class="chg-head"><span class="l-ic chg-mark" title="' + m[1] + '">' + m[0] + '</span>' +
          '<span class="chg-date" style="flex:1">' + label + ' · ' + (c.period + 1) + '. hodina' + (origName && c.kind !== 'odpadla' && c.kind !== 'pridana' ? ' · ' + escapeHtml(origName) : '') + '</span>' +
          changeKindChip(c.kind) + '</div>' +
        '<div class="chg-detail">' + escapeHtml(detail) +
        (c.reason ? '<span class="chg-reason">Důvod: ' + escapeHtml(c.reason) + '</span>' : '') + '</div>' +
      '</div>');
    });
  });
  if (!rows.length) return '';
  return '<div class="card" style="margin-bottom:16px;border-color:rgba(239,68,68,.5)">' +
    '<div class="card-title">' + ic('bell', 17) + ' Změny v rozvrhu</div>' +
    '<div class="chg-list" style="margin-top:8px">' + rows.join('') + '</div>' +
    '<button class="btn btn-soft btn-sm" style="width:100%;margin-top:12px" data-act="goto:#/student/zmenyrozvrh">Zobrazit všechny změny</button>' +
  '</div>';
}

/* --- známky + předvídač --- */
/* ================= ŽÁK · ZNÁMKY (3 záložky: Nedávné / Podle předmětu / Předvídač) ================= */
let ZK_TAB = localStorage.getItem('zk_tab') || 'recent';
let ZKP = { sel: null, g: '1', w: 1 };          /* stav Předvídače */
let ZK_PRED = {};                                /* subj -> [{g, w}] přidané predikce */
onAct('zk-tab:', el => { ZK_TAB = el.getAttribute('data-act').slice(7); localStorage.setItem('zk_tab', ZK_TAB); route(); });
onAct('zk-acc:', el => { const acc = el.closest('.zk-acc'); if (acc) acc.classList.toggle('open'); });
function zkAllGrades(sid) {
  return mySubjKeys().flatMap(sub => gradesOf(sid, sub).map(g => ({ subj: sub, v: g.v, w: g.w, title: g.title, date: g.date, note: g.note, planned: g.planned })))
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}
function zkCardHtml(g) {
  return '<div class="zk-card' + (g.planned ? ' zk-plan' : '') + '">' +
    '<span class="zk-grade ' + (g.planned ? '' : gradeColor(g.v)) + '">' + (g.planned ? '?' : escapeHtml(tokenShort(g.v))) + '</span>' +
    '<div class="zk-mid"><div class="zk-subj">' + escapeHtml(SUBJECTS[g.subj].name) + '</div>' +
      '<div class="zk-title">' + escapeHtml(g.title) + (g.planned ? ' <span class="chip chip-info" style="padding:0 7px;font-size:10px">Plánováno</span>' : '') + '</div></div>' +
    '<div class="zk-meta"><div class="zk-date">' + fmtDate(g.date) + '</div><div class="zk-w">Váha: ' + (g.planned ? '—' : g.w) + '</div></div>' +
  '</div>';
}
function zkRecentHtml(sid) {
  const all = zkAllGrades(sid);
  if (!all.length) return '<div class="empty"><b>Zatím žádné známky</b>Známky uvidíte, jakmile je učitel zapíše.</div>';
  return '<div class="zk-list">' + all.map(zkCardHtml).join('') + '</div>';
}
function zkBySubjHtml(sid, openSubj) {
  const keys = mySubjKeys();
  if (!keys.length) return '<div class="empty"><b>Zatím žádné známky</b>Známky uvidíte, jakmile je učitel zapíše.</div>';
  return keys.map(sub => {
    const gs = gradesOf(sid, sub);
    const a = weightedAvgOf(sid, sub);
    return '<div class="zk-acc' + (sub === openSubj ? ' open' : '') + '">' +
      '<button class="zk-acc-head" data-act="zk-acc:">' +
        '<span class="zk-acc-subj" style="color:' + SUBJECTS[sub].color + '">' + escapeHtml(SUBJECTS[sub].name) + '</span>' +
        '<span class="zk-acc-meta">Průměr: <b>' + avgTxt(a.avg) + '</b> · Známky: <b>' + gs.length + '</b></span>' +
        '<span class="zk-chev">' + ic('arrowR', 15) + '</span></button>' +
      '<div class="zk-acc-body">' +
        (gs.length
          ? gs.slice().reverse().map(g =>
              '<div class="zk-row">' +
                '<span class="zk-grade sm ' + (g.planned ? '' : gradeColor(g.v)) + '">' + (g.planned ? '?' : escapeHtml(tokenShort(g.v))) + '</span>' +
                '<div class="zk-mid"><div class="zk-title">' + escapeHtml(g.title) + '</div>' + (g.note ? '<div class="zk-note">' + escapeHtml(g.note) + '</div>' : '') + '</div>' +
                '<div class="zk-meta"><div class="zk-date">' + fmtDate(g.date) + '</div><div class="zk-w">Váha: ' + (g.planned ? '—' : g.w) + '</div></div>' +
              '</div>').join('')
          : '<div class="small-note" style="padding:10px 4px">V tomto předmětu zatím žádné známky</div>') +
      '</div></div>';
  }).join('');
}
function zkPredAvg(sid, sel) {
  const num = numericGradesOf(sid, sel);
  let sw = num.reduce((s, g) => s + (g.w || 1), 0);
  let sv = num.reduce((s, g) => s + g.v * (g.w || 1), 0);
  let cnt = num.length;
  (ZK_PRED[sel] || []).forEach(p => { if (tokenCounted(p.g)) { sw += p.w; sv += tokenVal(p.g) * p.w; cnt++; } });
  return sw ? { avg: sv / sw, count: cnt } : { avg: null, count: 0 };
}
function zkPredHtml(sid) {
  const keys = mySubjKeys();
  if (!keys.length) return '<div class="empty"><b>Zatím žádné známky</b>Předvídač se zpřístupní, jakmile budou známky.</div>';
  const sel = keys.includes(ZKP.sel) ? ZKP.sel : keys[0];
  const cur = weightedAvgOf(sid, sel);
  const preds = ZK_PRED[sel] || [];
  const preview = zkPredAvg(sid, sel);
  const tokens = ['1', '1-', '2', '2-', '3', '3-', '4', '4-', '5', 'N', 'A'];
  return '' +
    '<div class="zk-acc open"><button class="zk-acc-head" data-act="zk-acc:">' +
      '<span class="zk-acc-subj" style="color:' + SUBJECTS[sel].color + '">' + escapeHtml(SUBJECTS[sel].name) + '</span>' +
      '<span class="zk-acc-meta">Průměr: <b>' + avgTxt(cur.avg) + '</b></span><span class="zk-chev">' + ic('arrowR', 15) + '</span></button>' +
      '<div class="zk-acc-body"><div class="zk-subpick">' + keys.map(k =>
        '<button class="rcpt-pill' + (k === sel ? ' active' : '') + '" data-act="zk-pred-subj:' + k + '">' + SUBJECTS[k].name + '</button>').join('') + '</div></div></div>' +
    '<div class="zk-pred-box">' +
      '<div class="zk-lbl">Známka</div>' +
      '<div class="zk-seg">' + tokens.map(v => '<button class="zk-seg-b' + (v === ZKP.g ? ' on' : '') + '" data-act="zk-pred-g:' + v + '">' + v + '</button>').join('') + '</div>' +
      '<div class="zk-lbl">Váha</div>' +
      '<div class="zk-seg zk-seg-scroll">' + Array.from({ length: 10 }, (_, i) => i + 1).map(w => '<button class="zk-seg-b wb' + (w === ZKP.w ? ' on' : '') + '" data-act="zk-pred-w:' + w + '">' + w + '</button>').join('') + '</div>' +
    '</div>' +
    '<div class="zk-avgbar"><span>Průměr: <b>' + avgTxt(cur.avg) + '</b></span><span>Nový průměr: <b>' + avgTxt(preview.avg) + '</b></span></div>' +
    '<button class="btn btn-primary" style="width:100%;margin:12px 0" data-act="zk-pred-add">' + ic('plus', 15) + ' Přidat známku</button>' +
    ((preds.length || numericGradesOf(sid, sel).length)
      ? '<div class="zk-list">' +
          preds.map((p, i) =>
            '<div class="zk-row"><span class="zk-grade sm ' + (tokenCounted(p.g) ? gradeColor(p.g) : '') + '">' + p.g + '</span>' +
              '<div class="zk-mid"><div class="zk-title">Předvídač</div><div class="zk-note">Váha: ' + p.w + ' · klepnutím odeberete</div></div>' +
              '<div class="zk-meta"><button class="btn btn-soft btn-sm" data-act="zk-pred-del:' + i + '">' + ic('x', 13) + ' Odebrat</button></div></div>').join('') +
          numericGradesOf(sid, sel).map(g =>
            '<div class="zk-row"><span class="zk-grade sm ' + gradeColor(g.v) + '">' + escapeHtml(tokenShort(g.v)) + '</span>' +
              '<div class="zk-mid"><div class="zk-title">' + escapeHtml(g.title) + '</div></div>' +
              '<div class="zk-meta"><div class="zk-w">Váha: ' + (g.w || 1) + '</div></div></div>').join('') +
        '</div>'
      : '<div class="small-note">Přidejte predikované známky a sledujte, jak se změní průměr</div>');
}
['1', '1-', '2', '2-', '3', '3-', '4', '4-', '5', 'N', 'A'].forEach(v => onAct('zk-pred-g:' + v, el => { ZKP.g = v; route(); }));
Array.from({ length: 10 }, (_, i) => i + 1).forEach(w => onAct('zk-pred-w:' + w, () => { ZKP.w = w; route(); }));
mySubjKeysSafe();
function mySubjKeysSafe() { /* no-op: předměty se dispatchují dynamicky níže */ }
function zkBindSubjHandlers() {
  mySubjKeys().forEach(k => { if (!ACT['zk-pred-subj:' + k]) onAct('zk-pred-subj:' + k, () => { ZKP.sel = k; route(); }); });
}
onAct('zk-pred-add', () => {
  const sid = mySid();
  const keys = mySubjKeys();
  const sel = keys.includes(ZKP.sel) ? ZKP.sel : keys[0];
  ZK_PRED[sel] = ZK_PRED[sel] || [];
  ZK_PRED[sel].push({ g: ZKP.g, w: ZKP.w });
  route();
});
onAct('zk-pred-del:', el => {
  const sid = mySid();
  const keys = mySubjKeys();
  const sel = keys.includes(ZKP.sel) ? ZKP.sel : keys[0];
  const i = Number(el.getAttribute('data-act').slice(12));
  (ZK_PRED[sel] || []).splice(i, 1);
  route();
});
function sZnamky() {
  clearTick();
  zkBindSubjHandlers();
  const sid = mySid();
  const q = location.hash.split('|')[1];
  const deepSubj = mySubjKeys().includes(q) ? q : null;
  if (deepSubj) { ZK_TAB = 'bysub'; localStorage.setItem('zk_tab', 'bysub'); ZKP.sel = deepSubj; }
  const isPc = !isAppMode();
  const tabs = [['recent', 'Nedávné'], ['bysub', 'Podle předmětu'], ['pred', 'Předvídač']];
  const panels = { recent: zkRecentHtml(sid), bysub: zkBySubjHtml(sid, deepSubj), pred: zkPredHtml(sid) };
  return '' +
  '<div class="page-head"><div><h1>Známky</h1><div class="sub">Přehled známek a průměrů</div></div>' +
    '<button class="btn btn-soft btn-sm" data-act="theme-toggle">' + ic('moon', 15) + ' Tmavý / světlý režim</button></div>' +
  (isPc
    ? '<div class="zk-grid3">' + tabs.map(([k, l]) => '<div class="zk-panel"><div class="zk-panel-title">' + l + '</div>' + panels[k] + '</div>').join('') + '</div>'
    : '<div class="tabs">' + tabs.map(([k, l]) => '<button class="tab' + (ZK_TAB === k ? ' active' : '') + '" data-act="zk-tab:' + k + '">' + l + '</button>').join('') + '</div>' + panels[ZK_TAB]);
}
onAct('theme-toggle', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
  localStorage.setItem(THEME_KEY, cur === 'dark' ? 'light' : 'dark');
  route();
});

/* --- rozvrh žáka --- */
function sRozvrh() {
  clearTick();
  const cls = myClassId();
  const base = isSchoolDay(todayISO()) ? todayISO() : nextSchoolDayISO(todayISO(), 0);
  const cur = localStorage.getItem('ls_rozvrh_den') || base;
  const wd = weekdayOf(cur);
  const isToday = cur === todayISO();
  const info = currentLessonInfo(cls, todayISO());

  function lessonRows(dayISO) {
    const sc = scheduleOf(cls);
    const nowInfo = currentLessonInfo(cls, dayISO);
    return sc.slots.map((slot, i) => {
      const en = sc.days[weekdayOf(dayISO)] ? sc.days[weekdayOf(dayISO)][i] : null;
      const isNow = nowInfo.state === 'now' && nowInfo.lesson && nowInfo.lesson.period === i;
      const subj = en ? en.subj : null;
      const addedChg = !subj ? (db.changes || []).find(c => c.cls === cls && c.date === dayISO && c.period === i && c.kind === 'pridana') : null;
      if (!subj && !addedChg) return '';
      const chg = changeFor(cls, dayISO, i);
      /* písmenná značka změny přímo u badge předmětu: S/O/M/P/Z */
      const CHG_MARK = { odpadla: ['O', 'Odpadá'], mistnost: ['M', 'Změna místnosti'], ucitel: ['S', 'Suplování'], predmet: ['Z', 'Změna předmětu'], pridana: ['P', 'Přidaná hodina'] };
      const mark = addedChg ? CHG_MARK.pridana : (chg && CHG_MARK[chg.kind] ? CHG_MARK[chg.kind] : null);
      const markHtml = mark
        ? '<span class="l-ic chg-mark" title="' + mark[1] + '">' + mark[0] + '</span>'
        : '';
      const ics = [];
      const cb = (db.classbook || []).find(r => r.cls === cls && r.date === dayISO && r.period === i);
      if (cb) ics.push('<span class="l-ic g-ok" title="Hodina je už zapsaná v třídní knize">' + ic('check', 12) + '</span>');
      const hw = (db.tasks || []).find(t => t.due === dayISO && t.subj === subj && (t.sid === mySid() || t.cls === cls));
      if (hw) ics.push('<span class="l-ic g-book" title="Odevzdává se úkol: ' + escapeHtml(hw.title) + '">' + ic('book', 12) + '</span>');
      const test = (db.columns || []).find(c => c.cls === cls && c.subj === subj && c.date === dayISO && Object.keys(c.cells || {}).some(sid2 => String(c.cells[sid2]).trim() === '?'));
      if (test) ics.push('<span class="l-ic g-bad" title="Plánovaná písemka: ' + escapeHtml(test.title) + '">' + ic('alert', 12) + '</span>');
      /* červené ikonky změn rozvrhu už nemají vlastní ikonky – značka je přímo u badge */
      const icsHtml = (ics.length ? '<span class="l-ics">' + ics.join('') + '</span>' : '');
      let rowCls = 'lesson' + (isNow ? ' now' : '') + (chg ? ' chg' : '');
      let badge, title, subTxt;
      if (chg && chg.kind === 'odpadla') {
        badge = markHtml + '<span class="subj-badge" style="width:42px;height:42px;background:var(--bad)" title="Odpadlá hodina">' + escapeHtml(subjShort(subj)) + '</span>' + icsHtml;
        title = '<span style="text-decoration:line-through">' + escapeHtml(SUBJECTS[subj].name) + '</span>';
        subTxt = '<span class="chip chip-bad">odpadlá hodina</span>' + (chg.reason ? ' ' + escapeHtml(chg.reason) : '');
      } else if (chg && chg.kind === 'mistnost') {
        badge = markHtml + subjBadge(subj, 42) + icsHtml;
        title = escapeHtml(SUBJECTS[subj].name);
        const nr = roomsList().find(x => x.id === chg.newRoom);
        subTxt = '<span class="chip chip-bad">jiná místnost: ' + escapeHtml(nr ? nr.name : '?') + '</span>' + (chg.reason ? ' ' + escapeHtml(chg.reason) : '');
      } else if (chg && chg.kind === 'ucitel') {
        badge = markHtml + subjBadge(subj, 42) + icsHtml;
        title = escapeHtml(SUBJECTS[subj].name);
        const stu = chg.newTeacherId ? (db.users || []).find(x => x.id === chg.newTeacherId) : null;
        subTxt = '<span class="chip chip-bad">Supluje: ' + escapeHtml(stu ? stu.name : (chg.newTeacher || '?')) + '</span>' + (chg.reason ? ' ' + escapeHtml(chg.reason) : '');
      } else if (chg && chg.kind === 'predmet') {
        const ns = chg.newSubj;
        badge = markHtml + '<span class="subj-badge" style="width:42px;height:42px;background:var(--bad)" title="Změna předmětu">' + (ns ? escapeHtml(subjShort(ns)) : '?') + '</span>';
        title = escapeHtml(ns && SUBJECTS[ns] ? SUBJECTS[ns].name : '?');
        subTxt = '<span class="chip chip-bad">' + escapeHtml(subjShort(subj)) + ' → ' + escapeHtml(ns ? subjShort(ns) : '?') + '</span>' + (chg.reason ? ' ' + escapeHtml(chg.reason) : '');
      } else if (addedChg) {
        /* přidaná hodina do volné hodiny */
        const ns = addedChg.newSubj;
        const tu = addedChg.newTeacherId ? (db.users || []).find(x => x.id === addedChg.newTeacherId) : null;
        rowCls += ' chg';
        badge = markHtml + '<span class="subj-badge" style="width:42px;height:42px;background:var(--ok)" title="Přidaná hodina">' + (ns ? escapeHtml(subjShort(ns)) : '?') + '</span>';
        title = escapeHtml(ns && SUBJECTS[ns] ? SUBJECTS[ns].name : '?');
        subTxt = '<span class="chip chip-ok">Přidaná hodina</span>' + (tu ? ' · ' + escapeHtml(tu.name) : '') + (addedChg.reason ? ' · ' + escapeHtml(addedChg.reason) : '');
      } else {
        badge = subjBadge(subj, 42) + icsHtml;
        title = escapeHtml(SUBJECTS[subj].name);
        const rmChip = en && en.room ? '<span style="margin:0 0 0 7px">' + roomChip(en.room, 22) + '</span>' : '';
        subTxt = escapeHtml(cls + ' · ' + (i + 1) + '. hodina') + rmChip;
      }
      /* ikonky i zkratka předmětu jsou v JEDNÉ buňce mřížky, aby nerozbíjely layout */
      const badgeCell = '<span class="l-badge-cell">' + badge + '</span>';
      return '<div class="' + rowCls + '">' +
        '<span class="time">' + slot.s + '<br>' + slot.e + '</span>' + badgeCell +
        '<div class="grow"><div class="row-title">' + title + '</div>' +
        '<div class="row-sub">' + subTxt + '</div></div>' +
        (isNow ? '<div class="prog" style="width:' + nowInfo.prog + '%"></div>' : '') + '</div>';
    }).join('');
  }

  const monday = addDaysISO(cur, -(wd === 0 ? 6 : wd - 1));
  const weekDates = [0, 1, 2, 3, 4].map(i => addDaysISO(monday, i));
  const sc = scheduleOf(cls);
  const dayEntries = weekdayOf(cur) >= 1 && weekdayOf(cur) <= 5 ? (sc.days[weekdayOf(cur)] || []) : [];
  const hasAnyLesson = dayEntries.some(x => x && x.subj);
  const lessonsToday = lessonsOfDay(cls, cur);

  const noSchedule = !sc.days || Object.keys(sc.days).length === 0 || [1, 2, 3, 4, 5].every(d => !(sc.days[d] || []).some(en => en && en.subj));
  if (noSchedule) {
    return '' +
      '<div class="page-head"><div><h1>Rozvrh</h1><div class="sub">' + escapeHtml(cls) + ' · Změny červeně, odpočet naživo</div></div></div>' +
      '<div class="empty" style="padding:60px 16px"><b>Rozvrh ještě není nastavený</b>Učitel ho teprve vyplní v záložce „Nastavit rozvrh“. Až bude hotový, uvidíš tady každý den i učebnu.</div>';
  }

  const inWeek = weekDates.indexOf(cur) > -1;
  return '' +
  '<div class="page-head"><div><h1>Rozvrh</h1><div class="sub">' + escapeHtml(cls) + ' · Změny červeně, odpočet naživo</div></div></div>' +
  '<div class="rcpt-row day-pills">' + weekDates.map(d =>
    '<button class="rcpt-pill' + (d === cur ? ' active' : '') + '" data-act="roz-den:' + d + '">' + WD_CS[weekdayOf(d) - 1] + ' ' + d.slice(8) + (d === todayISO() ? ' · dnes' : '') + '</button>'
  ).join('') +
    '<button class="rcpt-pill' + (!inWeek ? ' active' : '') + '" data-act="roz-custom" title="Vybrat vlastní datum v kalendáři">' + ic('calendar', 13) + ' Vlastní' + (!inWeek ? ' · ' + fmtDate(cur) : '') + '</button>' +
    '<input type="date" id="roz-date" class="txt" data-chg="roz-date-set" value="' + cur + '" style="display:none;width:auto;padding:7px 10px;font-size:13px">' +
  '</div>' +
  (isToday && info.state === 'now'
    ? '<div class="card" style="margin-bottom:16px"><div class="card-title">' + ic('zap', 16) + ' Právě probíhá: ' + escapeHtml(SUBJECTS[info.lesson.subj].name) + '</div>' +
      '<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">' +
        '<span class="avg-big" style="color:var(--accent)" id="cd-now">—</span><span class="small-note">do konce hodiny</span>' +
        '<div style="flex:1;min-width:180px;height:10px;border-radius:99px;background:var(--surface-2);overflow:hidden"><div id="cd-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#3B82F6,#8B5CF6)"></div></div>' +
      '</div></div>'
    : '') +
  '<div class="day-grid">' + lessonRows(cur) + '</div>' +
  (weekdayOf(cur) >= 1 && weekdayOf(cur) <= 5 && !hasAnyLesson && lessonsToday.length === 0
    ? '<div class="empty"><b>Volný den</b>V tento den podle rozvrhu není žádné vyučování 🎈</div>'
    : (weekdayOf(cur) < 1 || weekdayOf(cur) > 5 ? '<div class="empty"><b>Víkend</b>Žádné vyučování 🎈</div>' : '')) +
  rozLegendHtml();
}
/* Rozklikávací legenda značek změn (S/O/M/P/Z) pod rozvrhem */
function rozLegendHtml() {
  const items = [
    ['S', 'Suplování', 'Hodinu místo obvyklého učitele povede jiný učitel. Jméno suplujícího je napsané přímo u hodiny.'],
    ['O', 'Odpadá', 'Hodina se nekoná – předmět je přeškrtnutý. Do zaměškaných hodin se nezapočítává.'],
    ['M', 'Změna místnosti', 'Hodina se bude konat v jiné učebně – název učebny najdete přímo u hodiny.'],
    ['P', 'Přidaná hodina', 'Nová hodina, která v rozvrhu běžně není – učitel ji přidal do volné hodiny.'],
    ['Z', 'Změna předmětu', 'Místo obvyklého předmětu bude probíhat jiný – u hodiny je uveden nový předmět.']
  ];
  return '<div class="zk-acc leg-acc">' +
    '<button class="zk-acc-head" data-act="roz-leg">' +
      '<span class="zk-acc-subj">' + ic('info', 16) + ' Legenda značek změn</span>' +
      '<span class="zk-acc-meta">S · O · M · P · Z</span>' +
      '<span class="zk-chev">' + ic('arrowR', 15) + '</span></button>' +
    '<div class="zk-acc-body"><div class="leg-list">' +
      items.map(it =>
        '<div class="leg-row"><span class="l-ic chg-mark">' + it[0] + '</span>' +
          '<div class="leg-txt"><b>' + it[1] + '</b><span>' + it[2] + '</span></div></div>').join('') +
      '<div class="leg-note">Změny zadává třídní učitel. Kompletní přehled všech změn najdete v kategorii <b>Změny</b>.</div>' +
    '</div></div></div>';
}
onAct('roz-leg', el => { const acc = el.closest('.zk-acc'); if (acc) acc.classList.toggle('open'); });
onAct('roz-den:', el => { localStorage.setItem('ls_rozvrh_den', el.getAttribute('data-act').slice(8)); route(); });
/* „Vlastní“ datum: vyjede kalendář (native date picker) – funguje v mobilu i na PC */
onAct('roz-custom', () => {
  const inp = document.getElementById('roz-date');
  if (!inp) return;
  inp.style.display = 'inline-block';
  inp.focus();
  try { if (inp.showPicker) inp.showPicker(); } catch (e) { /* Safari: otevře se při tapu */ }
});
onAct('roz-date-set', el => {
  const v = el.value;
  if (!v) return;
  localStorage.setItem('ls_rozvrh_den', v);
  route();
});

function cdTick() {
  const cls = myClassId();
  const info = currentLessonInfo(cls, todayISO());
  if (info.state === 'now') {
    const min = Math.floor(info.remainSec / 60), sec = info.remainSec % 60;
    const txt = String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    const n1 = document.querySelector('[data-cd-remain]');
    const n2 = document.getElementById('cd-now');
    const bar = document.getElementById('cd-bar');
    if (n1) n1.textContent = txt;
    if (n2) n2.textContent = txt;
    if (bar) bar.style.width = info.prog + '%';
  } else if (info.state === 'next') {
    const n1 = document.querySelector('[data-cd-remain]');
    if (n1) n1.textContent = 'za ' + info.inMin + ' min';
  }
}

/* --- úkoly --- */
function tasksFor(sid) {
  const st = studentOf(sid);
  return (db.tasks || []).filter(t => (t.sid === sid) || (t.sid === null && t.cls === st.cls))
    .sort((a, b) => (a.due < b.due ? -1 : 1));
}
function taskRow(t, sid) {
  const d = !!t.done[sid];
  const late = !d && addDaysISO(todayISO(), 0) > t.due;
  const subjName = (t.subj && SUBJECTS[t.subj] ? SUBJECTS[t.subj].name : 'úkol');
  return '<div class="list-row" style="cursor:pointer;opacity:' + (d ? 0.55 : 1) + '" data-act="s-task:' + t.id + '">' +
    '<span class="g-cell" style="border-color:' + (d ? 'var(--ok)' : 'var(--border)') + ';color:' + (d ? 'var(--ok)' : 'var(--muted)') + '">' + (d ? ic('check', 15) : '') + '</span>' +
    subjBadge(t.subj || 'CJ', 34) +
    '<div class="grow"><div class="row-title" style="' + (d ? 'text-decoration:line-through' : '') + '">' + escapeHtml(t.title) + '</div>' +
    '<div class="row-sub">' + escapeHtml(subjName) + (t.note ? ' · ' + escapeHtml(t.note) : '') + '</div></div>' +
    '<span class="chip ' + (d ? 'chip-ok' : late ? 'chip-bad' : 'chip-accent') + '">' + (d ? 'Hotovo' : late ? 'Po termínu' : (t.due === todayISO() ? 'Na dnes' : 'Do ' + fmtDate(t.due))) + '</span>' +
    '<button type="button" class="btn btn-ghost btn-sm" style="flex:0 0 auto" data-act="s-task-msg:' + t.id + '" title="Napsat učiteli ohledně tohoto úkolu">' + ic('chat', 13) + ' Napsat učiteli</button>' +
  '</div>';
}
function sUkoly() {
  const sid = mySid();
  const tasks = tasksFor(sid);
  const undone = tasks.filter(t => !t.done[sid]);
  const done = tasks.filter(t => t.done[sid]);
  return '' +
  '<div class="page-head"><div><h1>Moje úkoly</h1><div class="sub">Odškrtni, co je hotové – učitel uvidí splněno</div></div>' +
    '<div style="display:flex;gap:8px;align-items:center">' + ic('zap', 16) +
    '<div style="width:130px;height:9px;border-radius:99px;background:var(--surface-2);overflow:hidden"><div style="height:100%;width:' + (tasks.length ? Math.round(done.length / tasks.length * 100) : 0) + '%;background:var(--ok)"></div></div>' +
    '<b style="color:var(--ok)">' + done.length + '/' + tasks.length + '</b></div></div>' +
  '<div class="card"><div class="card-title">' + ic('list', 16) + ' K vyřešení (' + undone.length + ')</div>' +
    (undone.length ? '<div class="list">' + undone.map(t => taskRow(t, sid)).join('') + '</div>'
      : '<div class="empty"><b>Vše hotovo! 🎉</b>Žádné úkoly na obzoru.</div>') +
  '</div>' +
  (done.length ? '<div class="card" style="margin-top:16px"><div class="card-title">' + ic('check', 16) + ' Splněno</div><div class="list">' + done.map(t => taskRow(t, sid)).join('') + '</div></div>' : '');
}
onAct('s-task:', el => {
  const sid = mySid();
  const t = (db.tasks || []).find(x => x.id === el.getAttribute('data-act').slice(7));
  if (!t) return;
  if (!t.done) t.done = {};
  t.done[sid] = !t.done[sid];
  saveDB();
  if (t.done[sid]) { toast('Úkol splněn! ✓', 'ok'); navigator.vibrate && navigator.vibrate(60); }
  route();
});
onAct('s-task-msg:', el => {
  const u = currentUser();
  const sid = mySid();
  if (!sid) return;
  const t = (db.tasks || []).find(x => x.id === el.getAttribute('data-act').slice(11));
  if (!t) return;
  const st = studentOf(sid);
  let teachU = (db.users || []).find(x => x.id === t.teacherId && x.role === 'ucitel');
  if (!teachU && st) teachU = classTeacherUsers(st.cls)[0] || null;
  if (!teachU) { toast('K tomuto úkolu není přiřazený žádný učitel', 'warn'); return; }
  /* najdi otevřené vlákno k tomuto úkolu, jinak založ nové */
  let th = Object.values(db.threads || {}).find(x => x.childId === sid && (x.recipientType || 'rodic') === 'student'
    && x.taskId === t.id && threadOpen(x));
  if (!th) {
    th = { id: uid(), childId: sid, recipientType: 'student', parent: null, teacherId: teachU.id,
      subject: 'Úkol: ' + t.title, taskId: t.id, taskTitle: t.title, status: 'open', createdAt: nowISO(), msgs: [] };
    db.threads[th.id] = th;
  }
  if (!th.msgs.length) {
    th.msgs.push({ id: uid(), from: u.id,
      text: (st ? st.first + ' ' + st.last : 'Žák') + ' otevřel(a) konverzaci ohledně úkolu „' + t.title + '“ (termín ' + fmtDate(t.due) + ').',
      ts: nowISO(), readAt: null });
    db.notifs.push({ userId: teachU.id, type: 'msg', text: (st ? st.first : 'Žák') + ' se ptá na úkol „' + t.title + '“', ts: nowISO(), route: 'zpravy' });
    saveDB();
  }
  S_MSG.thread = th.id;
  toast('Konverzace otevřena – napište učiteli, na co se chcete zeptat', 'ok');
  gotoHash('#/student/zpravy');
});

/* ================= DOCHÁZKA – detail žáka (žák i rodič) ================= */
function absEventChip(stts) {
  return {
    A: ['Omluveno', 'chip-ok'],
    C: ['Čeká', 'chip-warn'],
    N: ['Neomluveno', 'chip-bad'],
    D: ['Dočasně', 'chip']
  }[stts] || [stts, 'chip'];
}
function dochazkaBodyHtml(sid) {
  const st = studentOf(sid);
  if (!st) return '<div class="card"><div class="empty"><b>Žák nenalezen</b></div></div>';
  const ov = absenceOverview(sid);
  const t = ov.total;
  const subs = subjectsOfClass(st.cls);
  const ev = absenceEvents(sid);
  const over = t.unexPct > 25;
  return '' +
  '<div class="grid grid-4">' +
    statMini('Zameškáno', t.missing + '/' + t.lessons, 'var(--bad)') +
    statMini('Omluveno', t.A, 'var(--ok)') +
    statMini('Čeká', t.C, 'var(--warn)') +
    statMini('Neomluveno', t.N, 'var(--bad)') +
  '</div>' +
  (over
    ? '<div class="warn-line" style="margin-top:14px">' + ic('alert', 15) + ' <span>Neomluvená absence přesáhla <b>25 %</b> zapsaných hodin (' + t.unexPct + ' %).</span></div>'
    : '') +
  '<div class="card" style="margin-top:16px">' +
    '<div class="card-title">' + ic('calendar', 16) + ' Zameškané hodiny po předmětech' +
    '</div>' +
    '<div class="pol-pc"><div class="tbl-wrap"><table class="tbl"><thead><tr><th style="text-align:left">Předmět</th><th class="num">Zameškáno</th><th class="num">Z hodin</th><th>Detail</th></tr></thead><tbody>' +
    subs.map(sub => {
      const b = ov.bySubj[sub];
      if (!b || !b.lessons) {
        return '<tr><td>' + subjBadge(sub, 26) + ' <b>' + escapeHtml(SUBJECTS[sub].name) + '</b></td>' +
          '<td class="num abs-cell" style="color:var(--muted)">—</td><td class="num abs-cell" style="color:var(--muted)">—</td><td></td></tr>';
      }
      const col = b.N ? 'var(--bad)' : b.missing ? 'var(--warn)' : 'var(--muted)';
      const detail = (b.missing
        ? 'Omluveno <b style="color:var(--ok)">' + b.A + '</b> · Čeká <b style="color:var(--warn)">' + b.C + '</b> · Neomluveno <b style="color:var(--bad)">' + b.N + '</b>'
        : 'Bez absence');
      return '<tr><td>' + subjBadge(sub, 26) + ' <b>' + escapeHtml(SUBJECTS[sub].name) + '</b></td>' +
        '<td class="num abs-cell" style="color:' + col + '">' + b.missing + '</td>' +
        '<td class="num abs-cell">' + b.lessons + '</td>' +
        '<td style="font-size:11.5px;color:var(--muted)">' + detail + '</td></tr>';
    }).join('') + '</tbody></table></div></div>' +
    '<div class="pol-mob">' + subs.map(sub => {
      const b = ov.bySubj[sub];
      const lessons = (b && b.lessons) || 0;
      const missing = (b && b.missing) || 0;
      const col = (b && b.N) ? 'var(--bad)' : missing ? 'var(--warn)' : 'var(--muted)';
      const detail = (b && b.missing
        ? 'Omluveno <b style="color:var(--ok)">' + b.A + '</b> · Čeká <b style="color:var(--warn)">' + b.C + '</b> · Neomluveno <b style="color:var(--bad)">' + b.N + '</b>'
        : 'Bez absence');
      return '<div class="pol-row"><div class="pol-subj">' + subjBadge(sub, 30) + '<b>' + escapeHtml(SUBJECTS[sub].name) + '</b></div>' +
        '<div class="pol-sems" style="justify-content:flex-end"><div class="pol-sem"><div class="pol-sem-tag">Zameškáno</div><b style="font-size:17px;color:' + col + '">' + (lessons ? missing : '—') + '</b><div class="small-note" style="margin-top:2px">z ' + lessons + ' hod.</div></div>' +
        '<div class="pol-sem" style="flex:1;min-width:150px"><div class="pol-sem-tag">Detail</div><div class="small-note" style="margin-top:4px">' + detail + '</div></div></div></div>';
    }).join('') + '</div>' +
    (t.lessons === 0 ? '<div class="small-note" style="margin:10px 2px 0">Učitel zatím nic nezapsal</div>' : '') +
  '</div>' +
  '<div class="card" style="margin-top:16px">' +
    '<div class="card-title">' + ic('list', 16) + ' Záznamy docházky (události)</div>' +
    (ev.length
      ? '<div class="list">' + ev.slice().reverse().slice(0, 10).map(e => {
          const [txt, chipCls] = absEventChip(e.stts);
          return '<div class="list-row">' + subjBadge(e.subj, 34) +
            '<div class="grow"><div class="row-title">' + fmtDate(e.date) + ' · ' + (e.period + 1) + '. hod. · ' + escapeHtml(SUBJECTS[e.subj].name) + '</div>' +
            (e.note ? '<div class="row-sub">' + escapeHtml(e.note) + '</div>' : '<div class="row-sub">Dle třídní knihy</div>') + '</div>' +
            '<span class="chip ' + chipCls + '">' + txt + '</span></div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Žádná zameškaná hodina</b></div>') +
  '</div>';
}
function sDochazka() {
  clearTick();
  const sid = mySid();
  if (!sid) return '<div class="card"><div class="empty"><b>Nemáte přiřazený žákovský účet</b></div></div>';
  return '' +
  '<div class="page-head"><div><h1>Docházka</h1><div class="sub">Zameškané hodiny podle třídní knihy</div></div>' +
    '<button class="btn btn-soft btn-sm" data-act="theme-toggle">' + ic('moon', 15) + ' Tmavý / světlý režim</button></div>' +
  dochazkaBodyHtml(sid);
}

/* ================= RODIČ ================= */
function parentChildren() {
  const u = currentUser();
  return (u.children || []).map(id => studentOf(id)).filter(Boolean);
}
function parentCurChild() {
  const list = parentChildren();
  const saved = localStorage.getItem('ls_child');
  return list.some(k => k.id === saved) ? saved : (list[0] ? list[0].id : null);
}
function statMini(label, val, color) {
  return '<div style="background:var(--surface-2);border-radius:12px;padding:10px 12px;text-align:center"><b style="color:' + color + ';font-size:22px;display:block">' + val + '</b><span style="font-size:11px;color:var(--muted);font-weight:700">' + label + '</span></div>';
}
/* Souhrn nadcházejících akcí a úkolů dítěte – karta v Přehledu rodiče */
function pUpcomingHtml(sid) {
  const st = studentOf(sid);
  const today = todayISO();
  const acts = actionsFor(sid)
    .filter(a => daysUntilAction(a.date) >= 0)
    .sort((a, z) => (a.date < z.date ? -1 : 1))
    .slice(0, 4);
  const tasks = tasksFor(sid)
    .filter(t => !t.done[sid])
    .sort((a, z) => (a.due < z.due ? -1 : 1))
    .slice(0, 4);
  if (!acts.length && !tasks.length) return '';
  const actRow = a =>
    '<div class="list-row" style="padding:8px 10px;cursor:pointer" data-act="goto:#/rodic/planakci">' +
      '<span class="ava" style="width:30px;height:30px;background:linear-gradient(135deg,#F59E0B,#D97706)">' + ic('flag', 14) + '</span>' +
      '<div class="grow"><div class="row-title" style="font-size:13px">' + escapeHtml(a.title) + '</div>' +
      '<div class="row-sub">' + fmtDate(a.date) + (a.sid ? ' · Jen pro ' + escapeHtml(st.first) : ' · Celá třída') + '</div></div>' +
      actionCountdownChip(daysUntilAction(a.date)) + '</div>';
  const tskRow = t => {
    const late = t.due < today;
    const subjName = t.subj && SUBJECTS[t.subj] ? SUBJECTS[t.subj].name : 'Úkol';
    return '<div class="list-row" style="padding:8px 10px">' +
      subjBadge(t.subj || 'CJ', 30) +
      '<div class="grow"><div class="row-title" style="font-size:13px">' + escapeHtml(t.title) + '</div>' +
      '<div class="row-sub">' + escapeHtml(subjName) + '</div></div>' +
      '<span class="chip ' + (late ? 'chip-bad' : t.due === today ? 'chip-warn' : 'chip-accent') + '">' + (late ? 'Po termínu' : t.due === today ? 'Na dnes' : 'Do ' + fmtDate(t.due)) + '</span></div>';
  };
  return '<div class="card" style="margin-top:16px"><div class="card-title">' + ic('calendar', 16) + ' Nadcházející – ' + escapeHtml(st.first) +
      '<button class="btn btn-ghost btn-sm" style="margin-left:auto" data-act="goto:#/rodic/planakci">Plán akcí</button></div>' +
    '<div class="p-up-grid">' +
      '<div><div class="small-note" style="margin:0 0 6px;font-weight:800">Akce</div>' +
        (acts.length ? '<div class="list">' + acts.map(actRow).join('') + '</div>' : '<div class="empty" style="padding:12px">Žádné plánované akce</div>') + '</div>' +
      '<div><div class="small-note" style="margin:0 0 6px;font-weight:800">Úkoly</div>' +
        (tasks.length ? '<div class="list">' + tasks.map(tskRow).join('') + '</div>' : '<div class="empty" style="padding:12px">Všechny úkoly hotové 🎉</div>') + '</div>' +
    '</div></div>';
}
function pPrehled() {
  clearTick();
  const u = currentUser();
  const kids = parentChildren();
  if (!kids.length) {
    return '<div class="card"><div class="empty"><b>Nemáte propojené žádné dítě</b>Kontaktujte správce školy.</div></div>';
  }
  const cid = parentCurChild();
  const st = studentOf(cid);
  const avg = overallAvgOf(cid);
  const abs = absenceStats(cid);
  const unread = userUnreadMsgs(u.id);
  const sks = subjectKeysOf(cid);
  const recent = columnsFor(cid)
    .filter(c => c.cells && c.cells[cid] !== undefined && c.cells[cid] !== '')
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)).slice(0, 8);
  return '' +
  '<div class="page-head"><div><h1>Vítejte zpět, ' + escapeHtml(u.name) + '</h1><div class="sub">' + todayLabel() + ' · Přehled vašich dětí</div></div>' +
    (unread ? '<div class="page-acts"><button class="btn btn-ghost btn-sm" data-act="goto:#/rodic/zpravy">' + ic('chat', 15) + ' Nepřečtené zprávy (' + unread + ')</button></div>' : '') + '</div>' +
  (kids.length > 1
    ? '<div class="rcpt-row">' + kids.map(k =>
        '<button class="rcpt-pill' + (k.id === cid ? ' active' : '') + '" data-act="p-child:' + k.id + '">' +
        '<span class="ava" style="width:24px;height:24px;font-size:11px">' + escapeHtml(k.first.charAt(0)) + '</span>' +
        k.first + ' ' + k.last + '</button>').join('') + '</div>'
    : '') +
  '<div class="grid grid-3">' +
    '<div class="card"><div class="card-title" style="display:flex;align-items:center;gap:8px">' + ic('book', 16) + ' ' + escapeHtml(st.first) + ' – celkový průměr' +
      '<button class="btn btn-ghost btn-sm" style="margin-left:auto" data-act="ch-child-pass:' + cid + '" title="Změnit heslo žáka">' + ic('lock', 14) + ' Změnit heslo</button></div>' +
      '<span class="avg-big" style="color:' + avgColor(avg) + '">' + avgTxt(avg) + '</span>' +
      '<div style="margin-top:10px"><span class="chip ' + (avg === null ? '' : (avg > 3 ? 'chip-bad' : 'chip-ok')) + '">' + (avg === null ? 'Zatím bez známek' : (avg > 3 ? 'Potřeba podpořit' : 'Vše v pořádku')) + '</span></div>' +
      '<div style="margin-top:16px" class="tbl-wrap"><table class="tbl" style="min-width:0"><tbody>' +
        sks.map(sub => {
          const a = weightedAvgOf(cid, sub);
          return '<tr><td>' + subjBadge(sub, 26) + '&nbsp; ' + escapeHtml(SUBJECTS[sub].name) + '</td><td style="text-align:right"><b style="color:' + avgColor(a.avg) + '">' + avgTxt(a.avg) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
    '</div>' +
    '<div class="card">' +
      '<div class="card-title">' + ic('calendar', 16) + ' Docházka – ' + escapeHtml(st.first) +
        '<button class="btn btn-ghost btn-sm" style="margin-left:auto" data-act="goto:#/rodic/dochazka">Detail</button></div>' +
      '<div class="grid grid-4" style="gap:8px">' +
        statMini('Zameškáno', abs.missing, 'var(--bad)') + statMini('Omluveno', abs.A, 'var(--ok)') +
        statMini('Čeká', abs.C, 'var(--warn)') + statMini('Neomluveno', abs.N, 'var(--bad)') +
        (abs.D ? statMini('Dočasně', abs.D, 'var(--accent)') : '') + '</div>' +
      (abs.lessons
        ? '<div class="small-note" style="margin-top:10px">Z ' + abs.lessons + ' hodin zapsaných v třídní knize' + (abs.N ? ' · <b style="color:var(--bad)">' + abs.pct + ' % neomluvených (limit 25 %)</b>' : '') + '</div>'
        : '<div class="small-note" style="margin-top:10px">Učitel zatím nic nezapsal</div>') +
      '<div class="card-title" style="margin-top:18px">' + ic('book', 16) + ' Poslední záznamy</div>' +
      (recent.length
        ? '<div class="list">' + recent.map(g =>
            '<div class="list-row" style="padding:9px 11px">' + gradeCellHtml(g.cells[cid], g.title) +
            '<div class="grow"><div class="row-sub">' + escapeHtml(SUBJECTS[g.subj].name) + ' · ' + escapeHtml(g.title) + '</div>' +
            '<div style="font-size:11px;color:var(--muted)">' + fmtDate(g.date) + (g.cells[cid] === '?' ? ' · Plánováno' : '') + '</div></div></div>'
          ).join('') + '</div>'          : '<div class="empty">Zatím žádné známky</div>') +
    '</div>' +
    '<div class="card">' +
      '<div class="card-title">' + ic('chat', 16) + ' Zprávy od učitele</div>' +
      '<div class="list">' +
        (Object.values(db.threads || {}).filter(t => t.childId === cid).length
          ? Object.values(db.threads).filter(t => t.childId === cid).flatMap(t =>
              t.msgs.filter(m => m.from !== u.id).slice(-2).map(m =>
                '<div class="list-row" style="padding:9px 11px;cursor:pointer" data-act="goto:#/rodic/zpravy"><span class="chip ' + (m.readAt ? '' : 'chip-accent') + '">' + (m.readAt ? 'Přečteno' : 'Nové') + '</span>' +
                '<div class="grow"><div class="row-sub">' + escapeHtml(m.text.length > 90 ? m.text.slice(0, 90) + '…' : m.text) + '</div>' +
                '<div style="font-size:11px;color:var(--muted)">' + tsLabel(m.ts) + '</div></div></div>'
              )
            ).join('')
          : '<div class="empty">Zatím žádné zprávy</div>') +
      '</div>' +
      '<div class="card-title" style="margin-top:16px">' + ic('shield', 16) + ' Omluvenky</div>' +
      '<button class="btn btn-soft btn-sm" style="width:100%;margin-top:10px" data-act="goto:#/rodic/omluvenky">Nová omluvenka / historie</button>' +
      '' +
    '</div>' +
  '</div>' +
  pUpcomingHtml(cid);
}
onAct('p-child:', el => { localStorage.setItem('ls_child', el.getAttribute('data-act').slice(8)); route(); });
/* rodič potvrzuje, že o akci ví (učitel vidí kdo potvrdil) */
onAct('ack-act:', el => {
  const u = currentUser();
  if (!u || u.role !== 'rodic') return;
  ackAction(el.getAttribute('data-act').slice(8), u.id);
  toast('Potvrzeno – učitel vidí, že o akci víte ✓', 'ok');
  route();
});
onAct('ch-child-pass:', el => {
  const sid = el.getAttribute('data-act').slice(14);
  const st = studentOf(sid);
  if (!st) return;
  openModal(
    '<h3>Změnit heslo žáka · ' + escapeHtml(st.first + ' ' + st.last) + '</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Alespoň 8 znaků a 1 číslice</p>' +
    '<form data-form="pass-child">' +
      '<input type="hidden" name="sid" value="' + sid + '">' +
      passFieldsHtml('') +
      '<button class="btn btn-primary">Uložit nové heslo</button>' +
    '</form>');
});
onAct('form:pass-child', f => {
  const fd = new FormData(f);
  const sid = String(fd.get('sid'));
  const acc = (db.users || []).find(u => u.role === 'student' && u.studentId === sid);
  if (!acc) { toast('Žákovský účet se nenašel', 'bad'); return; }
  if (applyPassError(String(fd.get('new1') || ''), String(fd.get('new2') || ''), 'student')) return;
  acc.pass = hashPassword(String(fd.get('new1')));
  acc.passChanged = true;
  delete acc.genPass;
  saveDB();
  closeModal();
  toast('Heslo žáka změněno ✓', 'ok');
});

/* stav formuláře omluvenky (aby přežil přebarvení při změně data/dítěte) */
const EXC = { child: null, date: null, selKey: '', note: '' };
function pOmluvenky() {
  clearTick();
  const u = currentUser();
  const kids = parentChildren();
  const mine = (db.excuses || []).filter(x => (u.children || []).includes(x.childId))
    .sort((a, b) => (a.submitted < b.submitted ? 1 : -1));
  const head = '<div class="page-head"><div><h1>Omluvenky</h1><div class="sub">Vyberte datum a hodiny – učitel uvidí omluvenku i v třídní knize a schválí ji jedním ťuknutím</div></div></div>';
  if (kids.length === 0) return head + '<div class="card"><div class="empty"><b>Nemáte propojené žádné dítě</b>Kontaktujte správce školy.</div></div>';
  const cid = parentCurChild();
  if (!EXC.child || !kids.some(k => k.id === EXC.child)) EXC.child = cid;
  const st = studentOf(EXC.child);
  const cls = st.cls;
  if (!EXC.date) EXC.date = isSchoolDay(todayISO()) ? todayISO() : nextSchoolDayISO(todayISO(), 0);
  const selKey = EXC.child + '|' + EXC.date;
  if (EXC.selKey !== selKey) {
    EXC.selKey = selKey;
    EXC.sel = excusablePeriods(cls, EXC.date); // předvoleno vše
  }
  const per = excusablePeriods(cls, EXC.date);
  const today = todayISO();
  return head +
  '<div class="grid grid-2">' +
    '<div class="card"><div class="card-title">' + ic('plus', 16) + ' Nová omluvenka – ' + escapeHtml(st.first + ' ' + st.last) + '</div>' +
      '<form data-form="excuse">' +
        '<div class="field-row">' +
          '<div class="field"><label>Dítě</label><select name="child" data-chg="p-exc-child">' +
            kids.map(k => '<option value="' + k.id + '"' + (k.id === EXC.child ? ' selected' : '') + '>' + escapeHtml(k.first + ' ' + k.last) + '</option>').join('') + '</select></div>' +
          '<div class="field"><label>Datum</label><input type="date" name="date" data-chg="p-exc-date" value="' + EXC.date + '" min="' + addDaysISO(today, -14) + '" max="' + addDaysISO(today, 30) + '" required></div>' +
          '<div class="field"><label>Důvod</label><select name="reason"><option>Nemoc</option><option>Návštěva lékaře</option><option>Rodinná událost</option><option>Sportovní akce</option><option>Jiné</option></select></div>' +
        '</div>' +
        (per.length
          ? '<div class="field"><label>Které hodiny dítě zameškalo?</label>' +
            '<div class="exc-hrs">' + per.map(p => {
              const t = slotOf(cls, p);
              const s = subjOf(cls, EXC.date, p);
              const checked = (EXC.sel || []).includes(p);
              return '<label><input type="checkbox" class="exc-per" name="per" value="' + p + '"' + (checked ? ' checked' : '') + '> ' + (p + 1) + '. hod. (' + t.s + (s ? ' · ' + SUBJECTS[s].name : '') + ')</label>';
            }).join('') + '</div></div>'
          : '<div class="warn-line">' + ic('alert', 15) + ' <span>Ve zvolený den není podle rozvrhu vyučování (víkend / prázdniny?).</span></div>') +
        '<div class="field"><label>Poznámka (volitelné)</label><textarea id="exc-note" name="note" rows="2" maxlength="300" placeholder="Např. teplota od rána, u doktora v 9 hodin…">' + escapeHtml(EXC.note) + '</textarea></div>' +
        '<button class="btn btn-primary">' + ic('send', 15) + ' Odeslat omluvenku</button>' +
      '</form>' +
      '' +
    '</div>' +
    '<div class="card"><div class="card-title">' + ic('shield', 16) + ' Historie omluvenek</div>' +
      (mine.length
        ? '<div class="list">' + mine.map(x => {
            const st2 = studentOf(x.childId);
            return '<div class="list-row"><span class="chip ' + (x.status === 'schvaleno' ? 'chip-ok' : x.status === 'zamitnuto' ? 'chip-bad' : 'chip-warn') + '">' + { schvaleno: 'Schváleno', zamitnuto: 'Zamítnuto', ceka: 'Čeká na schválení' }[x.status] + '</span>' +
            '<div class="grow"><div class="row-title">' + escapeHtml(st2 ? st2.first + ' ' + st2.last : '') + '</div>' +
            '<div class="row-sub">' + fmtDate(x.date) + ' · ' + escapeHtml(excuseHoursLabel(st2 ? st2.cls : '', x.date, x.periods) || 'Celý den') + (x.reason ? ' · ' + escapeHtml(x.reason) : '') + (x.note ? ' · ' + escapeHtml(x.note) : '') + '</div></div>' +
            (x.decidedAt ? '<div style="font-size:11px;color:var(--muted);text-align:right">rozhodnuto<br>' + tsLabel(x.decidedAt) + '</div>' : '') + '</div>';
          }).join('') + '</div>'
        : '<div class="empty"><b>Zatím žádné omluvenky</b>Když bude potřeba, je to na pár kliknutí.</div>') +
    '</div></div>';
}
onAct('p-exc-child', el => { excPersist(); EXC.child = el.value; EXC.selKey = ''; route(); });
onAct('p-exc-date', el => { excPersist(); EXC.date = el.value; EXC.selKey = ''; route(); });
function excPersist() {
  const ta = document.getElementById('exc-note');
  if (ta) EXC.note = ta.value;
}
/* průběžně si pamatuj zaškrtnuté hodiny */
document.addEventListener('change', e => {
  if (e.target && e.target.classList && e.target.classList.contains('exc-per')) {
    EXC.sel = Array.from(document.querySelectorAll('.exc-per:checked')).map(cb => Number(cb.value));
  }
});
onAct('form:excuse', f => {
  const fd = new FormData(f);
  const child = String(fd.get('child'));
  const date = String(fd.get('date'));
  const periods = fd.getAll('per').map(Number).sort((a, b) => a - b);
  const reason = String(fd.get('reason'));
  const note = String(fd.get('note')).trim();
  const st = studentOf(child);
  if (!st) return;
  if (!periods.length) { toast('Vyberte alespoň jednu hodinu', 'bad'); return; }
  const dup = (db.excuses || []).find(x => x.childId === child && x.date === date && (x.status === 'ceka' || x.status === 'doplnit') && (x.periods || []).some(p => periods.includes(p)));
  if (dup) { toast('Pro toto datum a hodiny už omluvenka čeká na schválení', 'warn'); return; }
  db.excuses.push({ id: uid(), childId: child, date, periods, reason, note, status: 'ceka', submitted: nowISO(), decidedAt: null });
  notifyClassTeachers(st.cls, 'Nová omluvenka: ' + st.first + ' ' + st.last + ' (' + fmtDate(date) + ' · ' + (excuseHoursLabel(st.cls, date, periods) || periods.length + ' hodin') + ') – ' + reason, 'omluvenky');
  saveDB();
  EXC.selKey = '';
  EXC.note = '';
  toast('Omluvenka odeslána – učitel ji uvidí mezi omluvenkami i v třídní knize ✓', 'ok');
  route();
});

/* ================= ZPRÁVY S UČITELI =================
   Rodič: jedna obecná konverzace se třídním učitelem.
   Žák: více konverzací – novou založí sám (předmět + výběr učitele)
   nebo ji otevře z úkolu. Učitel může konverzaci uzavřít křížkem
   (status: 'closed'); do uzavřené se psát nedá.
   Vlákno: { id, childId, recipientType, parent?, teacherId?, subject?,
   taskId?, taskTitle?, status, msgs[] } */
let S_MSG = { thread: null };
function threadOpen(th) { return (th.status || 'open') === 'open'; }
function threadLastTs(th) { return th.msgs.length ? th.msgs[th.msgs.length - 1].ts : (th.createdAt || ''); }
/* učitelé, kterým může žák psát: třídní učitelé + učitelé z rozvrhu třídy */
function teachersForStudent(sid) {
  const st = studentOf(sid);
  if (!st) return [];
  const ids = new Set();
  const cls = classOf(st.cls);
  (cls && cls.teacherIds || []).forEach(id => ids.add(id));
  (db.schedule || {})[st.cls] && Object.keys((db.schedule || {})[st.cls].days || {}).forEach(d =>
    ((db.schedule || {})[st.cls].days[d] || []).forEach(en => { if (en && en.teacherId) ids.add(en.teacherId); }));
  let out = (db.users || []).filter(x => x.role === 'ucitel' && !x.isAdmin && ids.has(x.id));
  if (!out.length) out = (db.users || []).filter(x => x.role === 'ucitel' && !x.isAdmin);
  return out;
}
/* ============ RODIČ: konverzace s učiteli (inbox) ============
   Seznam konverzací jako řádky (předmět + s kým), u každé červený
   kroužek s počtem nepřečtených – zmizí po otevření. Rodič může
   založit novou tematickou konverzaci s předmětem (dítě + učitel). */
let P_MSG = { thread: null };
/* vlákna rodiče (jen moje, jen moje děti), seřazená podle poslední zprávy */
function parentThreads(u) {
  const kidIds = (u.children || []).slice();
  return Object.values(db.threads || {})
    .filter(t => (t.recipientType || 'rodic') === 'rodic' && t.parent === u.id && kidIds.includes(t.childId))
    .sort((a, b) => (threadLastTs(a) < threadLastTs(b) ? 1 : -1));
}
/* učitel konverzace rodiče (uložený nebo třídní učitel dítěte) */
function teacherOfThread(t) {
  if (t && t.teacherId) {
    const x = (db.users || []).find(u2 => u2.id === t.teacherId && u2.role === 'ucitel');
    if (x) return x;
  }
  const st = studentOf(t.childId);
  return st ? (classTeacherUsers(st.cls)[0] || null) : null;
}
/* otevřená konverzace = přečteno (zprávy od učitele); volá se PŘED vykreslením seznamu,
   aby červený kroužek zmizel hned při otevření */
function markThreadReadFor(u, th) {
  if (!th) return;
  let ch = false;
  const teacherIds = new Set((db.users || []).filter(x => x.role === 'ucitel').map(x => x.id));
  th.msgs.forEach(m => { if (m.from !== u.id && teacherIds.has(m.from) && !m.readAt) { m.readAt = nowISO(); ch = true; } });
  if (ch) saveDB();
}
/* detail konverzace pro rodiče – otevření zároveň přečte zprávy učitele */
function pConvDetailHtml(u, th) {
  const closed = !threadOpen(th);
  let changed = false;
  const teacherIds = new Set((db.users || []).filter(x => x.role === 'ucitel').map(x => x.id));
  th.msgs.forEach(m => { if (m.from !== u.id && teacherIds.has(m.from) && !m.readAt) { m.readAt = nowISO(); changed = true; } });
  if (changed) saveDB();
  const st = studentOf(th.childId);
  const teach = teacherOfThread(th);
  const kidName = st ? st.first + ' ' + st.last : '';
  const title = th.subject || ('Rozhovor o ' + kidName);
  return '<div class="card">' +
    '<div class="card-title">' + ic('chat', 16) + ' ' + escapeHtml(title) +
      (closed ? ' <span class="chip chip-bad" style="padding:0 8px;font-size:10.5px">uzavřeno učitelem</span>' : '') +
      '<span style="margin-left:auto;font-weight:700">' + escapeHtml((teach ? teach.name : (kidName ? 'třídní učitel' : '—'))) + '</span></div>' +
    (th.msgs.length
      ? '<div class="thread" style="max-height:430px;overflow:auto">' + th.msgs.map(m => {
          const me = m.from === u.id;
          return '<div class="msg ' + (me ? 'me' : 'them') + '">' + escapeHtml(m.text) +
            '<div class="meta">' + fmtTime(m.ts) + ' ' + (me ? (m.readAt ? '<span class="read-tick">✓✓ přečteno ' + fmtTime(m.readAt) + '</span>' : '<span class="read-tick">✓ odesláno</span>') : (m.readAt ? 'přečteno ' + fmtTime(m.readAt) : 'doručeno')) + '</div></div>';
        }).join('') + '</div>'
      : '<div class="empty">' + (closed ? 'Konverzaci uzavřel učitel.' : 'Zatím žádná zpráva – napište první zprávu.') + '</div>') +
    (closed
      ? '<div class="warn-line" style="margin-top:12px">' + ic('lock', 15) + ' <span>Učitel tuto konverzaci uzavřel – novou mu napište v nové konverzaci.</span></div>'
      : '<form data-form="pmsg"><div class="compose">' +
        '<textarea name="text" rows="1" maxlength="1000" placeholder="Napište zprávu…" required style="min-height:44px"></textarea>' +
        '<button class="btn btn-primary" title="Odeslat zprávu">' + ic('send', 17) + '</button></div></form>') +
  '</div>';
}
function pZpravy() {
  const u = currentUser();
  const kids = parentChildren();
  if (!kids.length) return '<div class="card"><div class="empty"><b>Nemáte propojené žádné dítě</b>Kontaktujte správce školy.</div></div>';
  const convs = parentThreads(u);
  const openTh = convs.find(t => t.id === P_MSG.thread) || (convs.length ? convs[0] : null);
  if (openTh && openTh.id !== P_MSG.thread) P_MSG.thread = openTh.id;
  markThreadReadFor(u, openTh);
  const curCid = parentCurChild();
  const curKid = studentOf(curCid);
  const teachOpts = curKid ? (classTeacherUsers(curKid.cls) || []).filter(x => !x.isAdmin) : [];
  return '' +
  '<div class="page-head"><div><h1>Zprávy s učiteli</h1><div class="sub">Konverzace přijaté i odeslané – novou založíte tlačítkem nahoře</div></div></div>' +
  '<div class="grid grid-2">' +
    '<div>' +
      '<div class="card"><div class="card-title">' + ic('plus', 16) + ' Nová konverzace</div>' +
        (kids.length > 1
          ? '<div class="field"><label>Dítě</label><select id="p-new-child" data-chg="p-new-child">' +
            kids.map(k => '<option value="' + k.id + '"' + (k.id === curCid ? ' selected' : '') + '>' + escapeHtml(k.first + ' ' + k.last) + '</option>').join('') + '</select></div>'
          : '<input type="hidden" id="p-new-child" value="' + kids[0].id + '">') +
        '<div class="field"><label>Předmět</label><input id="p-new-subj" maxlength="80" placeholder="Např. Dotaz k písemce, konzultace…"></div>' +
        '<div class="field"><label>Učitel</label><select id="p-new-teach">' +
          (teachOpts.length
            ? teachOpts.map(t2 => '<option value="' + t2.id + '">' + escapeHtml(t2.name) + '</option>').join('')
            : '<option value="">Žádný učitel není přiřazený</option>') + '</select></div>' +
        '<button class="btn btn-primary" data-act="p-new-conv">' + ic('chat', 15) + ' Založit konverzaci</button>' +
      '</div>' +
      '<div class="card"><div class="card-title">' + ic('list', 16) + ' Konverzace (' + convs.length + ')</div>' +
        (convs.length
          ? '<div style="display:flex;flex-direction:column;gap:8px;max-height:430px;overflow:auto">' + convs.map(t => {
              const last = t.msgs.length ? t.msgs[t.msgs.length - 1] : null;
              const un = threadUnreadFor(t, u.id);
              const closed = !threadOpen(t);
              const st = studentOf(t.childId);
              const kidName = st ? st.first + ' ' + st.last : '';
              const teach = teacherOfThread(t);
              const title = t.subject || ('Rozhovor o ' + kidName);
              const subTxt = (teach ? teach.name : 'třídní učitel') + (kids.length > 1 && t.subject ? ' · ' + kidName : '');
              return '<button class="list-row" style="text-align:left;width:100%;cursor:pointer;opacity:' + (closed ? 0.6 : 1) + ';border-color:' + (openTh && t.id === openTh.id ? 'var(--accent)' : '') + '" data-act="p-open:' + t.id + '">' +
                '<span class="ava" style="width:34px;height:34px;font-size:13px;flex:0 0 auto">' + escapeHtml((teach ? teach.name : 'U').charAt(0)) + '</span>' +
                '<div class="grow" style="min-width:0">' +
                  '<div class="row-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(title) +
                    (closed ? ' <span class="chip chip-bad" style="padding:0 6px;font-size:9.5px">uzavřeno</span>' : '') + '</div>' +
                  '<div class="row-sub" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(subTxt) + '</div>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex:0 0 auto">' + unreadDot(un) +
                  '<div style="font-size:10.5px;color:var(--muted);white-space:nowrap">' + (last ? tsLabel(last.ts) : '') + '</div></div></button>';
            }).join('') + '</div>'
          : '<div class="empty"><b>Zatím žádné konverzace</b>Založte první nahoře – nebo vám napíše učitel.</div>') +
      '</div>' +
    '</div>' +
    '<div>' + (openTh ? pConvDetailHtml(u, openTh) : '<div class="card"><div class="empty">Vyberte konverzaci ze seznamu nahoře.</div></div>') + '</div>' +
  '</div>';
}
onAct('p-open:', el => {
  P_MSG.thread = el.getAttribute('data-act').slice(7);
  route();
});
onAct('p-new-child', el => {
  if (el.value) localStorage.setItem('ls_child', el.value);
  route();
});
onAct('p-new-conv', () => {
  const u = currentUser();
  const childId = String(document.getElementById('p-new-child').value || '');
  const subj = String(document.getElementById('p-new-subj').value || '').trim();
  const teachId = String(document.getElementById('p-new-teach').value || '');
  const st = studentOf(childId);
  if (!st) { toast('Vyberte dítě', 'warn'); return; }
  if (!teachId) { toast('K vašemu dítěti není přiřazený žádný učitel', 'warn'); return; }
  let th = Object.values(db.threads || {}).find(t => t.childId === childId && (t.recipientType || 'rodic') === 'rodic'
    && t.parent === u.id && t.teacherId === teachId && threadOpen(t)
    && String(t.subject || '').trim().toLowerCase() === subj.toLowerCase());
  if (!th) {
    th = { id: uid(), childId, recipientType: 'rodic', parent: u.id, teacherId: teachId, subject: subj, taskId: null, taskTitle: null, status: 'open', createdAt: nowISO(), msgs: [] };
    db.threads[th.id] = th;
  }
  const teachU = (db.users || []).find(x => x.id === teachId);
  if (teachU) db.notifs.push({ userId: teachU.id, type: 'msg', text: 'Rodič ' + u.name + ' založil konverzaci: ' + (subj || ('Rozhovor o ' + st.first)), ts: nowISO(), route: 'zpravy' });
  saveDB();
  P_MSG.thread = th.id;
  toast('Konverzace založena – napište první zprávu ✓', 'ok');
  route();
});
onAct('form:pmsg', f => {
  const u = currentUser();
  const text = String(new FormData(f).get('text')).trim();
  if (!text) return;
  const th = Object.values(db.threads || {}).find(t => t.id === P_MSG.thread);
  if (!th) { toast('Vyberte konverzaci', 'warn'); return; }
  if (!threadOpen(th)) { toast('Konverzaci uzavřel učitel – založte novou', 'warn'); return; }
  th.msgs.push({ id: uid(), from: u.id, text, ts: nowISO(), readAt: null });
  const teach = teacherOfThread(th);
  const st = studentOf(th.childId);
  if (teach) db.notifs.push({ userId: teach.id, type: 'msg', text: 'Zpráva od rodiče' + (st ? ' (' + st.first + ')' : ''), ts: nowISO(), route: 'zpravy' });
  saveDB();
  toast('Zpráva odeslána ✓', 'ok');
  route();
});
/* detail jedné žákovské konverzace */
function stuConvDetailHtml(u, th) {
  const st = studentOf(th.childId);
  const teach = (db.users || []).find(x => x.id === th.teacherId) || {};
  const closed = !threadOpen(th);
  /* přečtení zpráv od učitele */
  let changed = false;
  const teacherIds = new Set((db.users || []).filter(x => x.role === 'ucitel').map(x => x.id));
  th.msgs.forEach(m => { if (m.from !== u.id && teacherIds.has(m.from) && !m.readAt) { m.readAt = nowISO(); changed = true; } });
  if (changed) saveDB();
  const title = th.subject || 'Rozhovor se třídním učitelem';
  return '<div class="card">' +
    '<div class="card-title">' + ic('chat', 16) + ' ' + escapeHtml(title) +
      (th.taskId ? ' <span class="chip chip-warn" style="padding:0 8px;font-size:10.5px">k úkolu</span>' : '') +
      (closed ? ' <span class="chip chip-bad" style="padding:0 8px;font-size:10.5px">uzavřeno učitelem</span>' : '') +
      '<span style="margin-left:auto;font-weight:700">' + escapeHtml(teach.name || (st ? 'třídní učitel' : '')) + '</span></div>' +
    (th.msgs.length
      ? '<div class="thread">' + th.msgs.map(m => {
          const me = m.from === u.id;
          return '<div class="msg ' + (me ? 'me' : 'them') + '">' + escapeHtml(m.text) +
            '<div class="meta">' + fmtTime(m.ts) + ' ' + (me ? (m.readAt ? '<span class="read-tick">✓✓ přečteno ' + fmtTime(m.readAt) + '</span>' : '<span class="read-tick">✓ odesláno</span>') : (m.readAt ? 'přečteno ' + fmtTime(m.readAt) : 'doručeno')) + '</div></div>';
        }).join('') + '</div>'
      : '<div class="empty">Konverzace je založená – napište první zprávu.</div>') +
    (closed
      ? '<div class="warn-line" style="margin-top:12px">' + ic('lock', 15) + ' <span>Učitel konverzaci uzavřel. Pokud potřebujete něco vyřešit, založte novou konverzaci.</span></div>'
      : '<form data-form="smsg"><div class="compose">' +
        '<textarea name="text" rows="1" maxlength="1000" placeholder="Napište zprávu…" required style="min-height:44px"></textarea>' +
        '<button class="btn btn-primary">' + ic('send', 16) + '</button></div></form>') +
  '</div>';
}
function sZpravy() {
  const u = currentUser();
  const sid = currentStudentId();
  if (!sid) return '<div class="card"><div class="empty"><b>Nemáte přiřazený žákovský účet</b></div></div>';
  const st = studentOf(sid);
  const convs = Object.values(db.threads || {}).filter(t => t.childId === sid && (t.recipientType || 'rodic') === 'student')
    .sort((a, b) => (threadLastTs(a) < threadLastTs(b) ? 1 : -1));
  const openTh = convs.find(t => t.id === S_MSG.thread) || (convs.length ? convs[0] : null);
  if (openTh && openTh.id !== S_MSG.thread) S_MSG.thread = openTh.id;
  markThreadReadFor(u, openTh);
  const teachers = teachersForStudent(sid);
  return '' +
  '<div class="page-head"><div><h1>Zprávy s učiteli</h1><div class="sub">Konverzaci založíte vy – napište předmět a vyberte učitele</div></div></div>' +
  '<div class="grid grid-2">' +
    '<div>' +
      '<div class="card"><div class="card-title">' + ic('plus', 16) + ' Nová konverzace</div>' +
        (teachers.length
          ? '<div class="field"><label>Předmět zprávy</label><input id="s-new-subj" maxlength="80" placeholder="Např. Otázka k písemce, omluvenka, úkol…"></div>' +
            '<div class="field"><label>Učitel</label><select id="s-new-teach">' +
              teachers.map(t => '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>').join('') + '</select></div>' +
            '<button class="btn btn-primary" data-act="s-new-conv">' + ic('chat', 15) + ' Založit konverzaci</button>'
          : '<div class="empty"><b>Žádní učitelé</b>Nejdřív musí správce vytvořit učitele pro vaši třídu.</div>') +
      '</div>' +
      '<div class="card"><div class="card-title">' + ic('list', 16) + ' Konverzace (' + convs.length + ')</div>' +
        (convs.length
          ? '<div style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow:auto">' + convs.map(t => {
              const last = t.msgs.length ? t.msgs[t.msgs.length - 1] : null;
              const un = threadUnreadFor(t, u.id);
              const closed = !threadOpen(t);
              const teach = (db.users || []).find(x => x.id === t.teacherId);
              const title = t.subject || (t.taskTitle ? 'Úkol: ' + t.taskTitle : 'Rozhovor se třídním učitelem');
              const teachName = teach ? teach.name : 'třídní učitel';
              return '<button class="list-row" style="text-align:left;width:100%;cursor:pointer;opacity:' + (closed ? 0.6 : 1) + ';border-color:' + (openTh && t.id === openTh.id ? 'var(--accent)' : '') + '" data-act="s-open:' + t.id + '">' +
                '<span class="ava" style="width:34px;height:34px;font-size:13px;flex:0 0 auto">' + escapeHtml(teachName.charAt(0)) + '</span>' +
                '<div class="grow" style="min-width:0">' +
                  '<div class="row-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(title) +
                    (t.taskId ? ' <span class="chip chip-warn" style="padding:0 6px;font-size:9.5px">úkol</span>' : '') +
                    (closed ? ' <span class="chip chip-bad" style="padding:0 6px;font-size:9.5px">uzavřeno</span>' : '') + '</div>' +
                  '<div class="row-sub" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(teachName) + ' · učitel</div>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex:0 0 auto">' + unreadDot(un) +
                  '<div style="font-size:10.5px;color:var(--muted);white-space:nowrap">' + (last ? tsLabel(last.ts) : '') + '</div></div></button>';
            }).join('') + '</div>'
          : '<div class="empty"><b>Žádné konverzace</b>Založte první – nebo ji otevřete u některého úkolu v „Moje úkoly“.</div>') +
      '</div>' +
    '</div>' +
    '<div>' + (openTh ? stuConvDetailHtml(u, openTh) : '<div class="card"><div class="empty">Vyberte konverzaci ze seznamu nahoře.</div></div>') + '</div>' +
  '</div>';
}
onAct('s-open:', el => {
  S_MSG.thread = el.getAttribute('data-act').slice(7);
  route();
});
onAct('s-new-conv', () => {
  const sid = currentStudentId();
  if (!sid) { toast('Nemáte žákovský účet', 'bad'); return; }
  const subj = String(document.getElementById('s-new-subj').value || '').trim();
  const teachSel = document.getElementById('s-new-teach');
  const teacherId = teachSel ? teachSel.value : null;
  if (!subj) { toast('Napište předmět zprávy', 'warn'); return; }
  if (!teacherId) { toast('Vyberte učitele', 'warn'); return; }
  let th = Object.values(db.threads || {}).find(t => t.childId === sid && (t.recipientType || 'rodic') === 'student'
    && threadOpen(t) && t.teacherId === teacherId && (t.subject || '').toLowerCase() === subj.toLowerCase());
  if (!th) {
    th = { id: uid(), childId: sid, recipientType: 'student', parent: null, teacherId, subject: subj, taskId: null, taskTitle: null, status: 'open', createdAt: nowISO(), msgs: [] };
    db.threads[th.id] = th;
  }
  const st = studentOf(sid);
  const teachU = (db.users || []).find(x => x.id === teacherId);
  if (teachU) db.notifs.push({ userId: teachU.id, type: 'msg', text: 'Žák ' + (st ? st.first + ' ' + st.last : '') + ' založil konverzaci: ' + subj, ts: nowISO(), route: 'zpravy' });
  saveDB();
  S_MSG.thread = th.id;
  toast('Konverzace založena – napište první zprávu ✓', 'ok');
  route();
});
/* pošle zprávu žáka do vlákna S_MSG.thread (odpověď v detailu) */
function studentNotifyTeachers(th, text) {
  const st = studentOf(th.childId);
  const txt2 = text || '';
  if (th.teacherId) {
    const tu = (db.users || []).find(x => x.id === th.teacherId);
    if (tu) db.notifs.push({ userId: tu.id, type: 'msg', text: txt2, ts: nowISO(), route: 'zpravy' });
    return;
  }
  const teachers = st ? classTeacherUsers(st.cls) : [];
  teachers.forEach(t2 => db.notifs.push({ userId: t2.id, type: 'msg', text: txt2, ts: nowISO(), route: 'zpravy' }));
}
onAct('form:smsg', f => {
  const u = currentUser();
  const txt = String(new FormData(f).get('text')).trim();
  if (!txt) return;
  const th = Object.values(db.threads || {}).find(t => t.id === S_MSG.thread);
  if (!th) { toast('Vyberte konverzaci', 'warn'); return; }
  if (!threadOpen(th)) { toast('Konverzace byla učitelem uzavřena – založte novou', 'warn'); return; }
  th.msgs.push({ id: uid(), from: u.id, text: txt, ts: nowISO(), readAt: null });
  studentNotifyTeachers(th, 'Zpráva od žáka (' + ((studentOf(th.childId) || {}).first || '') + ')');
  saveDB();
  toast('Zpráva odeslána ✓', 'ok');
  route();
});

function pDochazka() {
  clearTick();
  const kids = parentChildren();
  if (!kids.length) return '<div class="card"><div class="empty"><b>Nemáte propojené žádné dítě</b>Kontaktujte správce školy.</div></div>';
  const cid = parentCurChild();
  return '' +
  '<div class="page-head"><div><h1>Docházka</h1><div class="sub">Zameškané hodiny podle třídní knihy – omluvenku pošlete v záložce Omluvenky</div></div></div>' +
  (kids.length > 1
    ? '<div class="rcpt-row">' + kids.map(k =>
        '<button class="rcpt-pill' + (k.id === cid ? ' active' : '') + '" data-act="p-child:' + k.id + '">' +
        '<span class="ava" style="width:24px;height:24px;font-size:11px">' + escapeHtml(k.first.charAt(0)) + '</span>' +
        k.first + ' ' + k.last + '</button>').join('') + '</div>'
    : '') +
  dochazkaBodyHtml(cid);
}

/* ---------- OZNÁMENÍ (zprávy učitelů pro třídu) ---------- */
function sOznameni() {
  const u = currentUser();
  if (!u) return '';
  annMarkRead(u);
  const list = annVisibleFor(u).slice().sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const forWhom = u.role === 'rodic' ? 'vašich dětí' : 'vaši třídu';
  return '<div class="page-head"><div><h1>Oznámení</h1>' +
    '<div class="sub">Zprávy učitelů pro ' + forWhom + ' – písemky, akce, změny</div></div></div>' +
    (list.length
      ? '<div class="list">' + list.map(a => {
          const teacher = (db.users || []).find(x => x.id === a.teacherId);
          return '<div class="list-row" style="align-items:flex-start">' +
            '<span class="ava" style="background:linear-gradient(135deg,#3B82F6,#8B5CF6)">' + ic('bell', 16) + '</span>' +
            '<div class="grow">' +
              '<div class="row-title">' + escapeHtml((teacher ? teacher.name : 'Učitel')) + '</div>' +
              '<div class="row-sub">' + escapeHtml((classOf(a.cls) || {}).name || a.cls) + ' · ' + annWhoLabel(a.who) + ' · ' + tsLabel(a.ts) + '</div>' +
              '<div style="white-space:pre-wrap;margin-top:6px">' + escapeHtml(a.text) + '</div>' +
            '</div>' +
            '</div>';
        }).join('') + '</div>'
      : '<div class="card"><div class="empty"><b>Zatím žádná oznámení</b>Když učitel třídě něco vzkáže (písemka, akce…), objeví se to tady.</div></div>');
}

/* ================= POLOLETNÍ KLASIFIKACE (žák i rodič) ================= */
function prubeznaView() {
  clearTick();
  const u = currentUser();
  if (!u) return '';
  const isRod = u.role === 'rodic';
  let sid = null;
  if (u.role === 'student') sid = u.studentId;
  else {
    const kids = parentChildren();
    if (!kids.length) return '<div class="card"><div class="empty"><b>Nemáte propojené žádné dítě</b>Kontaktujte správce školy.</div></div>';
    sid = parentCurChild();
  }
  const st = studentOf(sid);
  if (!st) return '';
  const subjects = classSubjects(st.cls);
  const cls = classOf(st.cls);
  /* Viditelnost pololetí: učitel ho uzavřel NEBO už žákovi do klasifikačního
     lístku napsal známky. Dokud ne, známky ani průměr se nezobrazí. */
  const repOf = sem => classReport(st.cls, sem);
  const semVisible = sem => {
    const r = repOf(sem);
    if (r.closed) return true;
    const chk = (r.checked || {})[sid] || {};
    return Object.values(chk).some(v => v !== '' && v !== null && v !== undefined);
  };
  const vis = { 1: semVisible(1), 2: semVisible(2) };
  const finalOf = (sem, sub) => ((repOf(sem).checked || {})[sid] || {})[sub] || '';
  const semCellHtml = (sem, sub) => {
    if (!vis[sem]) return '<div class="pol-sem" style="opacity:.45"><div class="pol-sem-tag">' + sem + '. pol · Skryté</div><span style="opacity:.4">—</span></div>';
    const fin = finalOf(sem, sub);
    const cols = semesterColumnGradesOf(sid, sub, sem);
    const a = semesterAvgOf(sid, sub, sem);
    let inner = '';
    if (fin) inner += '<span class="g-cell ' + gradeColor(String(fin)) + '" style="width:30px;height:30px;font-size:15px" title="Známka na vysvědčení">' + escapeHtml(String(fin)) + '</span>';
    if (cols.length) inner += '<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-top:5px">' + cols.map(col => {
      const v = col.cells[sid];
      const counted = tokenCounted(v);
      return '<span class="g-cell' + (counted ? ' ' + gradeColor(v) : '') + '" title="' + escapeHtml(col.title || '') + ' · ' + fmtDate(col.date) + '">' + escapeHtml(v === '?' ? '?' : v) + '</span>';
    }).join('') + '</div>';
    if (a.avg !== null) inner += '<div class="small-note" style="margin:4px 0 0;font-weight:700;color:' + avgColor(a.avg) + '">Ø ' + a.avg.toFixed(2) + '</div>';
    if (!inner) inner = '<span style="opacity:.3">—</span>';
    return '<div class="pol-sem"><div class="pol-sem-tag">' + sem + '. pol' + (repOf(sem).closed ? ' · Uzavřeno ✓' : '') + '</div>' + inner + '</div>';
  };
  const headRow = (isRod ? (parentChildren().length > 1
    ? '<div class="rcpt-row">' + parentChildren().map(k =>
        '<button class="rcpt-pill' + (k.id === sid ? ' active' : '') + '" data-act="p-child:' + k.id + '">' +
        '<span class="ava" style="width:24px;height:24px;font-size:11px">' + escapeHtml(k.first.charAt(0)) + '</span>' +
        k.first + ' ' + k.last + '</button>').join('') + '</div>'
    : '') : '');
  return '<div class="page-head"><div><h1>Pololetní klasifikace</h1>' +
    '<div class="sub">' + (isRod ? 'Hodnocení vašeho dítěte za 1. a 2. pololetí' : 'Tvoje hodnocení za 1. a 2. pololetí') + ' · ' + escapeHtml(cls ? cls.name : st.cls) + '</div></div></div>' +
    headRow +
    '<div class="card"><div class="card-title">' + ic('list', 16) + ' Známky za pololetí' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">' + (vis[1] || vis[2] ? ([1, 2].filter(s => vis[s]).map(s => s + '. pol: ' + (repOf(s).closed ? 'Uzavřeno ✓' : 'Zapsáno')).join(' · ')) : 'Čeká na zápis učitelem') + '</span></div>' +
    (!vis[1] && !vis[2]
      ? '<div class="empty"><b>Klasifikace se zatím nezobrazuje</b>Známky a průměr se ukáží, jakmile je učitel napíše nebo pololetí uzavře.</div>'
      : (subjects.length
        ? '<div class="pol-pc"><div class="tbl-wrap" style="max-height:560px;overflow:auto"><table class="tbl" style="min-width:640px"><thead><tr>' +
          '<th style="position:sticky;left:0;background:var(--surface);z-index:2;min-width:170px;text-align:left">Předmět</th>' +
          '<th style="min-width:160px">1. pololetí</th><th style="min-width:160px">2. pololetí</th></tr></thead><tbody>' +
          subjects.map(sub => '<tr><td style="position:sticky;left:0;background:var(--surface);z-index:1"><div style="display:flex;align-items:center;gap:8px">' + subjBadge(sub, 26) + '<b>' + escapeHtml(SUBJECTS[sub].name) + '</b></div></td>' +
            '<td style="text-align:center">' + semCellHtml(1, sub) + '</td><td style="text-align:center">' + semCellHtml(2, sub) + '</td></tr>').join('') +
          '</tbody></table></div></div>' +
          '<div class="pol-mob">' + subjects.map(sub =>
            '<div class="pol-row"><div class="pol-subj">' + subjBadge(sub, 30) + '<b>' + escapeHtml(SUBJECTS[sub].name) + '</b></div>' +
            '<div class="pol-sems">' + semCellHtml(1, sub) + semCellHtml(2, sub) + '</div></div>').join('') + '</div>'
        : '<div class="empty">Zatím žádné předměty – známky se tu objeví, jakmile učitel začne zapisovat.</div>')) +
    '</div>';
  /* Vysvědčení k tisku nemají žáci ani rodiče – PDF vydává výhradně třídní
     učitel v Pololetní klasifikaci (tlačítko Tisk u každého žáka). */
}

/* ================= VÝUKA (žák: probírané učivo podle předmětů) ================= */
function sVyuka() {
  clearTick();
  const cls = myClassId();
  if (!cls) return '';
  const recs = (db.classbook || []).filter(r => r.cls === cls);
  const bySubj = {};
  recs.forEach(r => { if (!r.subj) return; (bySubj[r.subj] = bySubj[r.subj] || []).push(r); });
  const keys = mySubjKeys().filter(k => bySubj[k] && bySubj[k].length).concat(Object.keys(bySubj).filter(k => !mySubjKeys().includes(k)));
  const subjList = (k, list) =>
    '<div class="card" style="margin-bottom:16px"><div class="card-title">' + subjBadge(k, 30) + ' ' + escapeHtml(SUBJECTS[k] ? SUBJECTS[k].name : k) +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">' + list.length + ' ' + csPlural(list.length, 'zápis', 'zápisy', 'zápisů') + '</span></div>' +
      '<div class="list">' + list.map(r =>
        '<div class="list-row" style="align-items:flex-start"><span class="chip" style="flex:0 0 auto">' + fmtDate(r.date) + ' · ' + (r.period + 1) + '. hod.</span>' +
        '<div class="grow"><div class="row-title">' + escapeHtml(r.tema || '—') + '</div>' +
        (r.ucivo ? '<div class="row-sub">' + escapeHtml(r.ucivo) + '</div>' : '') +
        (r.ukol ? '<div style="margin-top:3px;font-size:13px;color:var(--warn)"><b>Úkol:</b> ' + escapeHtml(r.ukol) + '</div>' : '') +
        '</div></div>').join('') + '</div></div>';
  /* výběr předmětu nahoře na všech zařízeních – bez dlouhého scrollování */
  if (keys.length) {
    let sel = localStorage.getItem('ls_vyuka_subj');
    if (!keys.includes(sel)) sel = keys[0];
    const list = bySubj[sel].slice().sort((a, z) => (a.date === z.date ? (a.period - z.period) : (a.date < z.date ? 1 : -1)));
    return '<div class="page-head"><div><h1>Výuka</h1>' +
      '<div class="sub">Vyberte předmět a uvidíte jeho zápisy od nejnovějších</div></div></div>' +
      '<div class="rcpt-row" style="flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px">' + keys.map(k =>
        '<button class="rcpt-pill' + (k === sel ? ' active' : '') + '" data-act="m-vyuka:' + k + '" style="flex:0 0 auto">' +
        (SUBJECTS[k] ? escapeHtml(SUBJECTS[k].name) : escapeHtml(k)) + '</button>').join('') + '</div>' +
      subjList(sel, list);
  }
  return '<div class="page-head"><div><h1>Výuka</h1>' +
    '<div class="sub">Co se probíralo v jednotlivých předmětech – zápisy z třídní knihy</div></div></div>' +
    (keys.length
      ? keys.map(k => subjList(k, bySubj[k].slice().sort((a, z) => (a.date === z.date ? (a.period - z.period) : (a.date < z.date ? 1 : -1))))).join('')
      : '<div class="card"><div class="empty"><b>Zatím žádné zápisy</b>Jakmile učitel zapíše první hodinu do třídní knihy, uvidíš tady, co se probíralo – rozdělené podle předmětů.</div></div>');
}
onAct('m-vyuka:', el => { localStorage.setItem('ls_vyuka_subj', el.getAttribute('data-act').slice(8)); route(); });

registerView('student', 'prehled', sPrehled);
registerView('student', 'znamky', sZnamky);
registerView('student', 'pololetka', prubeznaView);
registerView('student', 'vyuka', sVyuka);
registerView('student', 'dochazka', sDochazka);
registerView('student', 'rozvrh', sRozvrh);
registerView('student', 'ukoly', sUkoly);
registerView('student', 'zpravy', sZpravy);
registerView('student', 'oznameni', sOznameni);
registerView('student', 'poznamky', studentPoznamkyView);
/* ================= ZMĚNY ROZVRHU (žák + rodič) ================= */
const CHG_WEEK_KEY = 'chg_week';
function chgWeekOffset() { return Number(localStorage.getItem(CHG_WEEK_KEY) || 0) || 0; }
function changeKindChip(kind) {
  const map = {
    odpadla: ['chip-bad', 'Odpadlá hodina'],
    mistnost: ['chip-info', 'Změna místnosti'],
    ucitel: ['chip-warn', 'Suplování'],
    predmet: ['chip-info', 'Změna předmětu'],
    pridana: ['chip-ok', 'Přidaná hodina']
  };
  const m = map[kind] || ['', 'Změna'];
  return '<span class="chip ' + m[0] + '">' + m[1] + '</span>';
}
function changesWeekView() {
  const sid = currentUser().role === 'student' ? currentUser().studentId : parentCurChild();
  const st = studentOf(sid);
  if (!st) return '<div class="empty"><b>Nejprve vyberte dítě</b></div>';
  const off = chgWeekOffset();
  const mon = addDaysISO(mondayOfISO(todayISO()), off * 7);
  const week = [0, 1, 2, 3, 4].map(i => addDaysISO(mon, i));
  const isThis = off === 0;
  const all = week.flatMap(iso => changesOfClsInRange(st.cls, iso, iso).map(c => ({ c, iso })));
  const tabs = [
    ['0', 'Současný týden'],
    ['1', 'Další týden']
  ];
  const rows = all.map(({ c, iso }) => {
    const en = ((db.schedule || {})[st.cls] || { days: {} }).days[weekdayOf(iso)] || [];
    const en0 = (en || [])[c.period] || null;
    const origSubj = en0 && en0.subj ? SUBJECTS[en0.subj] : null;
    const nu = c.newTeacherId ? (db.users || []).find(x => x.id === c.newTeacherId) : null;
    const detail = c.kind === 'odpadla'
      ? (origSubj ? escapeHtml(origSubj.name) + ' – hodina odpadá' : 'Hodina odpadá')
      : c.kind === 'mistnost'
        ? (origSubj ? escapeHtml(origSubj.name) : 'Hodina') + ' – nová učebna: <b>' + escapeHtml(c.newRoom || '—') + '</b>'
        : c.kind === 'ucitel'
          ? (origSubj ? escapeHtml(origSubj.name) : 'Hodina') + ' – supluje: <b>' + (nu ? escapeHtml(nu.name || nu.username) : escapeHtml(c.newTeacher || '—')) + '</b>'
          : c.kind === 'predmet'
            ? 'Nový předmět: <b>' + (c.newSubj && SUBJECTS[c.newSubj] ? SUBJECTS[c.newSubj].name : '—') + '</b>'
            : (c.newSubj && SUBJECTS[c.newSubj] ? SUBJECTS[c.newSubj].name : 'Hodina') + ' – přidaná hodina';
    return '<div class="chg-item' + (c.kind === 'odpadla' ? ' chg-bad' : c.kind === 'pridana' ? ' chg-good' : '') + '">' +
      '<div class="chg-head"><span class="chg-date">' + fmtDateLong(c.date) + '</span>' + changeKindChip(c.kind) + '</div>' +
      '<div class="chg-detail">' + (c.period + 1) + '. hodina · ' + detail +
      (c.reason ? '<span class="chg-reason">Důvod: ' + escapeHtml(c.reason) + '</span>' : '') + '</div>' +
    '</div>';
  });
  return '<div class="page-head"><h2>Změny v rozvrhu</h2>' +
      '<p class="small-note">Suplování, Odpadlé hodiny a další změny pro třídu ' + escapeHtml((classOf(st.cls) || {}).name || '') + '</p>' +
    '</div>' +
    '<div class="tabs">' + tabs.map(([k, l]) =>
      '<button class="tab' + (String(off) === k ? ' active' : '') + '" data-act="chg-week:' + k + '">' + l + '</button>').join('') + '</div>' +
    (rows.length
      ? '<div class="chg-list">' + rows.join('') + '</div>'
      : '<div class="empty"><b>' + (isThis ? 'Tento týden' : 'Příští týden') + ' – žádné změny</b>Rozvrh je bez změn, hodiny probíhají podle plánu.</div>');
}
onAct('chg-week:', el => {
  localStorage.setItem(CHG_WEEK_KEY, el.getAttribute('data-act').slice(9));
  route();
});
registerView('student', 'zmenyrozvrh', changesWeekView);
registerView('rodic', 'zmenyrozvrh', changesWeekView);
registerView('rodic', 'prehled', pPrehled);
registerView('rodic', 'pololetka', prubeznaView);
registerView('rodic', 'dochazka', pDochazka);
registerView('rodic', 'omluvenky', pOmluvenky);
registerView('rodic', 'zpravy', pZpravy);
registerView('rodic', 'oznameni', sOznameni);
registerView('rodic', 'rozvrh', sRozvrh);
registerView('rodic', 'vyuka', sVyuka);
registerView('student', 'planakci', planAkciView);
registerView('rodic', 'planakci', planAkciView);
registerView('rodic', 'poznamky', rodicPoznamkyView);

/* ================= VÝCHOVNÁ OPATŘENÍ (žák) ================= */
function studentPoznamkyView() {
  clearTick();
  const u = currentUser();
  if (!u || u.role !== 'student') return '';
  const sid = mySid();
  const st = studentOf(sid);
  if (!st) return '';
  const items = []
    .concat(notesOf(sid).map(n => ({ k: 'note', date: n.date, n })))
    .concat((db.records || []).filter(r => r.sid === sid).map(r => ({ k: 'rec', date: r.date, r })))
    .sort((a, z) => (a.date === z.date ? 0 : a.date < z.date ? 1 : -1));
  return '<div class="page-head"><div><h1>Výchovná opatření</h1>' +
    '<div class="sub">Poznámky, pochvaly, napomenutí i dutky od učitelů</div></div></div>' +
    '<div class="card"><div class="card-title">' + ic('edit', 16) + ' Záznamy učitelů' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">' + items.length + ' ' + csPlural(items.length, 'záznam', 'záznamy', 'záznamů') + '</span></div>' +
    (items.length
      ? '<div class="list">' + items.map(it => {
          if (it.k === 'rec') {
            const r = it.r;
            return '<div class="list-row" style="align-items:flex-start"><span class="ava" style="background:' + ({ ok: 'linear-gradient(135deg,#10B981,#059669)', accent: 'linear-gradient(135deg,#3B82F6,#2563EB)', warn: 'linear-gradient(135deg,#F59E0B,#D97706)', bad: 'linear-gradient(135deg,#EF4444,#DC2626)' }[REC_BY_ID[r.type] && REC_BY_ID[r.type].tone] || 'linear-gradient(135deg,#64748B,#475569)') + '">' + ic({ ok: 'check', accent: 'check', warn: 'alert', bad: 'x' }[REC_BY_ID[r.type] && REC_BY_ID[r.type].tone] || 'flag', 15) + '</span>' +
              '<div class="grow"><div class="row-title">' + recChip(r.type) + '</div>' +
              (r.reason ? '<div style="margin-top:3px;white-space:pre-wrap">' + escapeHtml(r.reason) + '</div>' : '') +
              '<div class="row-sub">' + semLabel(r.sem || semOfDate(r.date)) + ' · ' + fmtDate(r.date) + '</div></div></div>';
          }
          const n = it.n;
          return '<div class="list-row" style="align-items:flex-start"><span class="ava" style="background:linear-gradient(135deg,#8B5CF6,#6D28D9)">' + ic('edit', 15) + '</span>' +
            '<div class="grow"><div class="row-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + escapeHtml(n.title || 'Poznámka') + noteSevChip(n.sev) + '</div>' +
            (n.reason ? '<div style="margin-top:3px;white-space:pre-wrap">' + escapeHtml(n.reason) + '</div>' : '') +
            '<div class="row-sub">' + fmtDate(n.date) + (Number(n.sev) === 3 ? ' · patří do výchovných opatření v pololetní klasifikaci' : '') + '</div></div></div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Zatím žádné záznamy</b>Když ti učitel něco zapíše (poznámku, pochvalu nebo důtku), objeví se to tady.</div>') +
    '</div>';
}

/* ================= POZNÁMKY UČITELE (pouze rodič) ================= */
function rodicPoznamkyView() {
  clearTick();
  const u = currentUser();
  if (!u || u.role !== 'rodic') return '';
  const kids = parentChildren();
  if (!kids.length) return '<div class="card"><div class="empty"><b>Nemáte propojené žádné dítě</b>Kontaktujte správce školy.</div></div>';
  const sid = parentCurChild();
  const st = studentOf(sid);
  if (!st) return '';
  const items = []
    .concat(notesOf(sid).map(n => ({ k: 'note', date: n.date, n })))
    .concat((db.records || []).filter(r => r.sid === sid).map(r => ({ k: 'rec', date: r.date, r })))
    .sort((a, z) => (a.date === z.date ? 0 : a.date < z.date ? 1 : -1));
  const kidsRow = parentChildren().length > 1
    ? '<div class="rcpt-row">' + parentChildren().map(k =>
        '<button class="rcpt-pill' + (k.id === sid ? ' active' : '') + '" data-act="p-child:' + k.id + '">' +
        '<span class="ava" style="width:24px;height:24px;font-size:11px">' + escapeHtml(k.first.charAt(0)) + '</span>' +
        k.first + ' ' + k.last + '</button>').join('') + '</div>'
    : '';
  return '<div class="page-head"><div><h1>Výchovná opatření</h1>' +
    '<div class="sub">Poznámky, pochvaly, napomenutí i dutky od učitelů · ' + escapeHtml(st.first + ' ' + st.last) + '</div></div></div>' +
    kidsRow +
    '<div class="card"><div class="card-title">' + ic('edit', 16) + ' Záznamy učitelů' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">' + items.length + ' ' + csPlural(items.length, 'záznam', 'záznamy', 'záznamů') + '</span></div>' +
    (items.length
      ? '<div class="list">' + items.map(it => {
          if (it.k === 'rec') {
            const r = it.r;
            return '<div class="list-row" style="align-items:flex-start"><span class="ava" style="background:' + ({ ok: 'linear-gradient(135deg,#10B981,#059669)', accent: 'linear-gradient(135deg,#3B82F6,#2563EB)', warn: 'linear-gradient(135deg,#F59E0B,#D97706)', bad: 'linear-gradient(135deg,#EF4444,#DC2626)' }[REC_BY_ID[r.type] && REC_BY_ID[r.type].tone] || 'linear-gradient(135deg,#64748B,#475569)') + '">' + ic({ ok: 'check', accent: 'check', warn: 'alert', bad: 'x' }[REC_BY_ID[r.type] && REC_BY_ID[r.type].tone] || 'flag', 15) + '</span>' +
              '<div class="grow"><div class="row-title">' + recChip(r.type) + '</div>' +
              (r.reason ? '<div style="margin-top:3px;white-space:pre-wrap">' + escapeHtml(r.reason) + '</div>' : '') +
              '<div class="row-sub">' + semLabel(r.sem || semOfDate(r.date)) + ' · ' + fmtDate(r.date) + '</div></div></div>';
          }
          const n = it.n;
          return '<div class="list-row" style="align-items:flex-start"><span class="ava" style="background:linear-gradient(135deg,#8B5CF6,#6D28D9)">' + ic('edit', 15) + '</span>' +
            '<div class="grow"><div class="row-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + escapeHtml(n.title || 'Poznámka') + noteSevChip(n.sev) + '</div>' +
            (n.reason ? '<div style="margin-top:3px;white-space:pre-wrap">' + escapeHtml(n.reason) + '</div>' : '') +
            '<div class="row-sub">' + fmtDate(n.date) + (Number(n.sev) === 3 ? ' · patří do výchovných opatření v pololetní klasifikaci' : '') + '</div></div></div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Zatím žádné záznamy</b>Když učitel k vašemu dítěti něco zapíše (poznámku, pochvalu nebo důtku), uvidíte to tady.</div>') +
    '</div>';
}

/* ================= PLÁN AKCÍ (žák i rodič) ================= */
function planAkciView() {
  clearTick();
  const u = currentUser();
  if (!u) return '';
  const isRod = u.role === 'rodic';
  let sid = null;
  if (u.role === 'student') sid = u.studentId;
  else {
    const kids = parentChildren();
    if (!kids.length) return '<div class="card"><div class="empty"><b>Nemáte propojené žádné dítě</b>Kontaktujte správce školy.</div></div>';
    sid = parentCurChild();
  }
  const st = studentOf(sid);
  if (!st) return '';
  const cls = classOf(st.cls);
  const acts = actionsFor(sid).slice().sort((a, z) => (a.date === z.date ? 0 : a.date < z.date ? -1 : 1));
  const future = acts.filter(a => daysUntilAction(a.date) >= 0);
  const past = acts.filter(a => daysUntilAction(a.date) < 0);
  const row = (a, isPast) => {
    const days = daysUntilAction(a.date);
    const acked = !!(a.acks || {})[u.id];
    const canAck = isRod && !isPast && days >= 0;
    return '<div class="list-row" style="align-items:flex-start"><span class="ava" style="background:linear-gradient(135deg,#F59E0B,#D97706)">' + ic('flag', 15) + '</span>' +
      '<div class="grow"><div class="row-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + escapeHtml(a.title) + (isPast ? '' : actionCountdownChip(days)) + '</div>' +
      (a.desc ? '<div style="margin-top:3px;white-space:pre-wrap">' + escapeHtml(a.desc) + '</div>' : '') +
      '<div class="row-sub">' + fmtDate(a.date) + (isPast ? ' · Proběhlo' : '') + (a.sid ? ' · Akce jen pro ' + (isRod ? 'vaše dítě' : 'tebe') : ' · Celá třída') + '</div>' +
      (canAck
        ? (acked
          ? '<div class="ack-mine">' + ic('check', 13) + ' Potvrzeno – Učitel Ví, Že O Akci Víte</div>'
          : '<button class="btn btn-soft btn-sm" style="margin-top:8px" data-act="ack-act:' + a.id + '">' + ic('check', 13) + ' Potvrzuji, Že O Akci Vím</button>')
        : '') +
      '</div></div>';
  };
  const kidsRow = isRod && parentChildren().length > 1
    ? '<div class="rcpt-row">' + parentChildren().map(k =>
        '<button class="rcpt-pill' + (k.id === sid ? ' active' : '') + '" data-act="p-child:' + k.id + '">' +
        '<span class="ava" style="width:24px;height:24px;font-size:11px">' + escapeHtml(k.first.charAt(0)) + '</span>' +
        k.first + ' ' + k.last + '</button>').join('') + '</div>'
    : '';
  return '<div class="page-head"><div><h1>Plán akcí</h1>' +
    '<div class="sub">' + (isRod ? 'Plánované akce vašeho dítěte' : 'Tvoje plánované akce') + ' · ' + escapeHtml(cls ? cls.name : st.cls) + '</div></div></div>' +
    kidsRow +
    '<div class="card"><div class="card-title">' + ic('flag', 16) + ' Připravované akce' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">' + future.length + ' ' + csPlural(future.length, 'akce', 'akce', 'akcí') + '</span></div>' +
    (future.length
      ? '<div class="list">' + future.map(a => row(a, false)).join('') + '</div>'
      : '<div class="empty"><b>Zatím žádné plánované akce</b>Výlet, exkurze, soutěž… když učitel akci přidá, objeví se tady s odpočtem do začátku a tím, co si připravit.</div>') +
    '</div>' +
    (past.length ? '<div class="card"><div class="card-title">' + ic('clock', 15) + ' Proběhlé akce' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">' + past.length + '</span></div>' +
      '<div class="list">' + past.map(a => row(a, true)).join('') + '</div></div>' : '');
}

function tickLoop() {
  if (document.getElementById('cd-now') || document.querySelector('[data-cd-remain]')) cdTick();
}
setTick(tickLoop, 1000);
