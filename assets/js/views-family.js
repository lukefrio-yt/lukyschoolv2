/* ============================================================
   LukySchool — pohledy ŽÁKA a RODIČE (v5, sloupcový známkovač)
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
  '<div class="warn-line" data-cd>' + state.icon + ' <span data-cd-txt>' + state.txt + '</span></div>' +
  '<div class="grid grid-3">' +
    '<div class="card" style="grid-column:span 2">' +
      '<div class="card-title">' + ic('zap', 17) + ' Tvůj průměr</div>' +
      '<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap">' +
        '<span class="avg-big" style="color:' + avgColor(avg) + '">' + avgTxt(avg) + '</span>' +
        (worst && worst.avg > 3
          ? '<span class="chip chip-bad">pozor na ' + escapeHtml(SUBJECTS[worst.subj].name) + ' (' + worst.avg.toFixed(2) + ')</span>'
          : '<span class="chip chip-ok">' + (avg === null ? 'zatím žádné známky' : 'držíš to pěkně') + '</span>') +
        '<span class="small-note" style="margin-left:auto">' + cnt + ' ' + csPlural(cnt, 'započítaná známka', 'započítané známky', 'započítaných známek') + '</span>' +
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
        : '<div class="empty"><b>Úkoly splněny</b>Máš klid 🙂</div>') +
      '<button class="btn btn-soft btn-sm" style="width:100%;margin-top:12px" data-act="goto:#/student/ukoly">Všechny úkoly</button>' +
    '</div>' +
  '</div>' +
  '<div class="card" style="margin-top:16px"><div class="card-title">' + ic('book', 17) + ' Poslední záznamy</div>' +
    (recent.length
      ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Datum</th><th>Předmět</th><th>Test / sloupec</th><th class="num">Známka</th><th class="num">Váha</th></tr></thead><tbody>' +
        recent.map(g => '<tr><td style="white-space:nowrap">' + fmtDate(g.date) + '</td><td>' + escapeHtml(SUBJECTS[g.subj].name) + '</td><td>' +
          escapeHtml(g.title) + (g.cells[sid] === '?' ? ' <span class="chip chip-info" style="padding:0 6px;font-size:10px">plánováno</span>' : '') + '</td>' +
          '<td class="num">' + gradeCellHtml(g.cells[sid], g.title) + '</td><td class="num">' + (g.weight || 1) + '×</td></tr>').join('') +
        '</tbody></table></div>'
      : '<div class="empty"><b>Zatím žádné známky</b>Učitel teprve zakládá první sloupce 🙂</div>') +
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
  if (chgToday.length) txt += ' &nbsp;·&nbsp; <span class="chip chip-bad" style="padding:1px 8px">' + chgToday.length + ' ' + csPlural(chgToday.length, 'změna', 'změny', 'změn') + ' v rozvrhu</span>';
  return { icon, txt };
}

/* --- známky + předvídač --- */
function sZnamky() {
  clearTick();
  const sid = mySid();
  const q = location.hash.split('|')[1];
  const sel = mySubjKeys().includes(q) ? q : (mySubjKeys()[0] || 'M');
  const list = gradesOf(sid, sel).filter(g => !g.planned);
  const planned = gradesOf(sid, sel).filter(g => g.planned);
  const a = weightedAvgOf(sid, sel);
  const hasData = hasGradeData(sid);  return '' +
  '<div class="page-head"><div><h1>Známky</h1><div class="sub">Přehled známek, průměr a co udělá nová známka s průměrem</div></div>' +
    '<button class="btn btn-soft btn-sm" data-act="theme-toggle">' + ic('moon', 15) + ' Tmavý / světlý režim</button></div>' +
  (mySubjKeys().length
    ? '<div class="rcpt-row">' + mySubjKeys().map(sub =>
        '<button class="rcpt-pill' + (sub === sel ? ' active' : '') + '" data-act="goto:#/student/znamky|' + sub + '">' + SUBJECTS[sub].name + '</button>').join('') + '</div>'
    : '') +
  '<div class="card">' +
    '<div class="card-title">' + ic('book', 16) + ' ' + escapeHtml(SUBJECTS[sel].name) + '</div>' +
      '<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap">' +
        '<span class="avg-big" style="color:' + avgColor(a.avg) + '">' + avgTxt(a.avg) + '</span>' +
        '<span class="chip chip-accent">' + a.count + ' ' + csPlural(a.count, 'známka v průměru', 'známky v průměru', 'známek v průměru') + ' · vážený průměr</span>' +
      '</div>' +
      '<div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">' +
        (list.length ? list.slice(0, 12).map(g => gradeCellHtml(g.v, g.title)).join('') : '<span class="small-note">zatím žádné známky</span>') +
        (planned.length ? '<span class="chip chip-info">' + planned.length + '× plánováno (?)</span>' : '') +
      '</div>' +
  '</div>' +
  '<div class="card" style="margin-top:16px">' +
    '<div class="card-title">' + ic('list', 16) + ' Seznam známek – ' + escapeHtml(SUBJECTS[sel].name) + '</div>' +
    (list.length || planned.length
      ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Datum</th><th>Test / sloupec</th><th class="num">Známka</th><th class="num">Váha</th><th>Poznámka učitele</th></tr></thead><tbody>' +
        gradesOf(sid, sel).slice().reverse().map(g =>
          '<tr><td style="white-space:nowrap">' + fmtDate(g.date) + '</td><td>' + escapeHtml(g.title) + '</td>' +
          '<td class="num">' + (g.planned
            ? '<span class="chip chip-info">? plánováno</span>'
            : '<span class="g-cell ' + gradeColor(g.v) + '">' + escapeHtml(g.v) + '</span>') + '</td>' +
          '<td class="num">' + (g.planned ? '—' : g.w + '×') + '</td>' +
          '<td style="color:var(--muted)">' + (g.note ? escapeHtml(g.note) : '') + '</td></tr>').join('') +
        '</tbody></table></div>'
      : '<div class="empty"><b>' + (hasData ? 'V tomto předmětu zatím nic' : 'Škola je zatím prázdná') + '</b>' + (hasData ? 'Až učitel založí první sloupec, objeví se tady.' : 'Zeptej se učitele, kdy začnete.') + '</div>') +
  '</div>' +
  '<div class="card" style="margin-top:16px">' +
    '<div class="card-title" style="color:var(--accent)">' + ic('zap', 17) + ' Předvídač průměru</div>' +
      '<div style="display:grid;grid-template-columns:auto 1fr;gap:6px 16px;align-items:center;font-size:14.5px">' +
        '<b>Co kdybych dostal</b><div class="seg" id="pred-grade">' +
          GRADE_TOKENS.slice(0, 9).map(v => '<button data-act="pred-g:' + v + '" class="' + (v === '2' ? 'on' : '') + '">' + v + '</button>').join('') +
          '<button data-act="pred-g:N">N</button><button data-act="pred-g:A">A</button></div>' +
        '<b>Váha známky</b><div style="display:flex;gap:10px;align-items:center">' +
          '<input type="range" min="1" max="10" value="1" style="flex:1" data-chg="pred-w" id="pred-w"><b id="pred-wv" style="color:var(--accent);min-width:2em">1</b></div>' +
      '</div>' +
      '<div id="pred-out" style="margin-top:16px">' + predOutputHtml(sid, sel) + '</div>' +
      '<div class="small-note">N = nepsal(a) – dopíšeš · A = absence u testu · obojí (a „?“, plánované testy) se do průměru nepočítá. Mínusy: 1- = 1,5 … 4- = 4,5.</div>' +
  '</div>';
}
let PRED = { g: '2', w: 1 };
function predOutputHtml(sid, sel) {
  const a = weightedAvgOf(sid, sel);
  const num = numericGradesOf(sid, sel);
  const sw = num.reduce((s, g) => s + (g.w || 1), 0);
  const sv = num.reduce((s, g) => s + g.v * (g.w || 1), 0);
  if (tokenCounted(PRED.g)) {
    const hv = tokenVal(PRED.g);
    const newAvg = (sv + hv * PRED.w) / (sw + PRED.w);
    const diff = newAvg - a.avg;
    return '<div class="list-row" style="background:var(--surface-2)">' +
      '<span class="avg-big" style="color:' + avgColor(a.avg) + '">' + avgTxt(a.avg) + '</span>' + ic('arrowR', 18) +
      '<span class="avg-big" style="color:' + avgColor(newAvg) + '">' + newAvg.toFixed(2) + '</span>' +
      '<span class="chip ' + (diff <= 0 ? 'chip-ok' : 'chip-bad') + '">' + (diff <= 0 ? '▲ lepší o ' : '▼ horší o ') + Math.abs(diff).toFixed(2) + '</span>' +
      '<div class="small-note" style="margin-left:auto">průměr z ' + num.length + ' ' + csPlural(num.length, 'známky', 'známek', 'známek') + ' → ' + (num.length + 1) + '</div></div>';
  }
  return '<div class="warn-line">' + ic('eye', 15) + ' <span>Známka <b>' + PRED.g + '</b> se do průměru nepočítá – průměr zůstává <b style="color:' + avgColor(a.avg) + '">' + avgTxt(a.avg) + '</b>.</span></div>';
}
function predRender() {
  const sid = mySid();
  const sel = mySubjKeys().includes(location.hash.split('|')[1]) ? location.hash.split('|')[1] : (mySubjKeys()[0] || 'M');
  const out = document.getElementById('pred-out');
  if (out) out.innerHTML = predOutputHtml(sid, sel);
}
GRADE_TOKENS.slice(0, 9).forEach(v => onAct('pred-g:' + v, () => { PRED.g = v; rebuildPred(); }));
['N', 'A'].forEach(v => onAct('pred-g:' + v, () => { PRED.g = v; rebuildPred(); }));
onAct('pred-w', el => {
  PRED.w = Number(el.value);
  const wv = document.getElementById('pred-wv');
  if (wv) wv.textContent = el.value;
  predRender();
});
function rebuildPred() {
  document.querySelectorAll('#pred-grade button').forEach(b => {
    b.classList.toggle('on', b.getAttribute('data-act') === 'pred-g:' + PRED.g);
  });
  predRender();
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
      if (!subj) return '';
      const chg = changeFor(cls, dayISO, i);
      /* drobné ikonky před zkratkou předmětu: ✓ zapsáno v třídní knize · 📖 úkol · ! písemka */
      const ics = [];
      const cb = (db.classbook || []).find(r => r.cls === cls && r.date === dayISO && r.period === i);
      if (cb) ics.push('<span class="l-ic g-ok" title="Hodina je už zapsaná v třídní knize">' + ic('check', 12) + '</span>');
      const hw = (db.tasks || []).find(t => t.due === dayISO && t.subj === subj && (t.sid === mySid() || t.cls === cls));
      if (hw) ics.push('<span class="l-ic g-book" title="Odevzdává se úkol: ' + escapeHtml(hw.title) + '">' + ic('book', 12) + '</span>');
      const test = (db.columns || []).find(c => c.cls === cls && c.subj === subj && c.date === dayISO && Object.keys(c.cells || {}).some(sid2 => String(c.cells[sid2]).trim() === '?'));
      if (test) ics.push('<span class="l-ic g-bad" title="Plánovaná písemka: ' + escapeHtml(test.title) + '">' + ic('alert', 12) + '</span>');
      /* červené ikonky změn rozvrhu */
      if (chg && chg.kind === 'mistnost') ics.push('<span class="l-ic g-bad" title="Změna místnosti">' + ic('swap', 12) + '</span>');
      if (chg && chg.kind === 'ucitel') ics.push('<span class="l-ic g-bad" title="Změna učitele">' + ic('user', 12) + '</span>');
      const icsHtml = (ics.length ? '<span class="l-ics">' + ics.join('') + '</span>' : '');
      let rowCls = 'lesson' + (isNow ? ' now' : '') + (chg ? ' chg' : '');
      let badge, title, subTxt;
      if (chg && chg.kind === 'odpadla') {
        badge = '<span class="subj-badge" style="width:42px;height:42px;background:var(--bad)" title="Odpadlá hodina">' + escapeHtml(subjShort(subj)) + '</span>';
        title = '<span style="text-decoration:line-through">' + escapeHtml(SUBJECTS[subj].name) + '</span>';
        subTxt = '<span class="chip chip-bad">odpadlá hodina</span>' + (chg.reason ? ' ' + escapeHtml(chg.reason) : '');
      } else if (chg && chg.kind === 'mistnost') {
        badge = subjBadge(subj, 42) + icsHtml;
        title = escapeHtml(SUBJECTS[subj].name);
        const nr = roomsList().find(x => x.id === chg.newRoom);
        subTxt = '<span class="chip chip-bad">jiná místnost: ' + escapeHtml(nr ? nr.name : '?') + '</span>' + (chg.reason ? ' ' + escapeHtml(chg.reason) : '');
      } else if (chg && chg.kind === 'ucitel') {
        badge = subjBadge(subj, 42) + icsHtml;
        title = escapeHtml(SUBJECTS[subj].name);
        subTxt = '<span class="chip chip-bad">učitel: ' + escapeHtml(chg.newTeacher || '') + '</span>' + (chg.reason ? ' ' + escapeHtml(chg.reason) : '');
      } else if (chg && chg.kind === 'predmet') {
        const ns = chg.newSubj;
        badge = '<span class="subj-badge" style="width:42px;height:42px;background:var(--bad)" title="Změna předmětu">' + (ns ? escapeHtml(subjShort(ns)) : '?') + '</span>';
        title = escapeHtml(ns && SUBJECTS[ns] ? SUBJECTS[ns].name : '?');
        subTxt = '<span class="chip chip-bad">' + escapeHtml(subjShort(subj)) + ' → ' + escapeHtml(ns ? subjShort(ns) : '?') + '</span>' + (chg.reason ? ' ' + escapeHtml(chg.reason) : '');
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
      '<div class="page-head"><div><h1>Rozvrh</h1><div class="sub">' + escapeHtml(cls) + ' · změny červeně, odpočet naživo</div></div></div>' +
      '<div class="empty" style="padding:60px 16px"><b>Rozvrh ještě není nastavený</b>Učitel ho teprve vyplní v záložce „Nastavit rozvrh“. Až bude hotový, uvidíš tady každý den i učebnu.</div>';
  }

  return '' +
  '<div class="page-head"><div><h1>Rozvrh</h1><div class="sub">' + escapeHtml(cls) + ' · změny červeně, odpočet naživo · ✓ zapsáno · 📖 úkol · ! písemka</div></div></div>' +
  '<div class="rcpt-row">' + weekDates.map(d =>
    '<button class="rcpt-pill' + (d === cur ? ' active' : '') + '" data-act="roz-den:' + d + '">' + WD_CS[weekdayOf(d) - 1] + ' ' + d.slice(8) + (d === todayISO() ? ' · dnes' : '') + '</button>'
  ).join('') + '</div>' +
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
  '<div class="card" style="margin-top:18px"><div class="card-title">' + ic('bell', 16) + ' Změny rozvrhu</div>' +
    (changesOfClass(cls).length
      ? '<div class="list">' + changesOfClass(cls).slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map(c => {
          let detail = '';
          if (c.kind === 'mistnost' && c.newRoom) { const r = roomsList().find(x => x.id === c.newRoom); detail = 'nová místnost: ' + (r ? r.name : '?'); }
          else if (c.kind === 'ucitel' && c.newTeacher) detail = 'nový učitel: ' + c.newTeacher;
          else if (c.kind === 'predmet' && c.newSubj) detail = 'náhrada: ' + subjectName(c.newSubj);
          return '<div class="list-row"><span class="chip chip-bad">' + changeShortLabel(c) + '</span>' +
            '<div class="grow"><div class="row-title">' + fmtDate(c.date) + ' · ' + (c.period + 1) + '. hodina</div>' +
            '<div class="row-sub">' + escapeHtml([detail, c.reason].filter(Boolean).join(' · ')) + '</div></div></div>';
        }).join('') + '</div>'
      : '<div class="empty">Žádné změny</div>') +
  '</div>';
}
onAct('roz-den:', el => { localStorage.setItem('ls_rozvrh_den', el.getAttribute('data-act').slice(8)); route(); });

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
    '<span class="chip ' + (d ? 'chip-ok' : late ? 'chip-bad' : 'chip-accent') + '">' + (d ? 'hotovo' : late ? 'po termínu' : (t.due === todayISO() ? 'na dnes' : 'do ' + fmtDate(t.due))) + '</span>' +
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
    A: ['omluveno', 'chip-ok'],
    C: ['čeká', 'chip-warn'],
    N: ['neomluveno', 'chip-bad'],
    D: ['dočasně', 'chip']
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
    (t.D ? statMini('Dočasně (byl jen chvíli)', t.D, 'var(--accent)') : '') +
  '</div>' +
  (over
    ? '<div class="warn-line" style="margin-top:14px">' + ic('alert', 15) + ' <span>Neomluvená absence přesáhla <b>25 %</b> zapsaných hodin (' + t.unexPct + ' %). Učitel to vidí mezi ohroženými žáky.</span></div>'
    : '') +
  '<div class="card" style="margin-top:16px">' +
    '<div class="card-title">' + ic('calendar', 16) + ' Zameškané hodiny po předmětech' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">x / y = zameškáno z hodin zapsaných učitelem do třídní knihy</span></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Předmět</th><th class="num">Zameškáno</th><th class="num">Z hodin</th><th>Detail</th></tr></thead><tbody>' +
    subs.map(sub => {
      const b = ov.bySubj[sub];
      if (!b || !b.lessons) {
        return '<tr><td>' + subjBadge(sub, 26) + ' <b>' + escapeHtml(SUBJECTS[sub].name) + '</b></td>' +
          '<td class="num abs-cell" style="color:var(--muted)">—</td><td class="num abs-cell" style="color:var(--muted)">—</td><td></td></tr>';
      }
      const col = b.N ? 'var(--bad)' : b.missing ? 'var(--warn)' : 'var(--muted)';
      const detail = (b.missing
        ? 'omluveno <b style="color:var(--ok)">' + b.A + '</b> · čeká <b style="color:var(--warn)">' + b.C + '</b> · neomluveno <b style="color:var(--bad)">' + b.N + '</b>'
        : 'bez absence') + (b.D ? ' · dočasně <b style="color:var(--accent)">' + b.D + '</b>' : '');
      return '<tr><td>' + subjBadge(sub, 26) + ' <b>' + escapeHtml(SUBJECTS[sub].name) + '</b></td>' +
        '<td class="num abs-cell" style="color:' + col + '">' + b.missing + '</td>' +
        '<td class="num abs-cell">' + b.lessons + '</td>' +
        '<td style="font-size:11.5px;color:var(--muted)">' + detail + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    (t.lessons === 0 ? '<div class="small-note" style="margin:10px 2px 0">Učitel ještě nezapsal žádnou hodinu – čísla se začnou počítat, jakmile začne zapisovat docházku do třídní knihy (✓ přítomen, ✗ nepřítomen, D dočasně – dočasné hodiny se do zameškaných nepočítají).</div>' : '') +
  '</div>' +
  '<div class="card" style="margin-top:16px">' +
    '<div class="card-title">' + ic('list', 16) + ' Záznamy docházky (události)</div>' +
    (ev.length
      ? '<div class="list">' + ev.slice().reverse().slice(0, 10).map(e => {
          const [txt, chipCls] = absEventChip(e.stts);
          return '<div class="list-row">' + subjBadge(e.subj, 34) +
            '<div class="grow"><div class="row-title">' + fmtDate(e.date) + ' · ' + (e.period + 1) + '. hod. · ' + escapeHtml(SUBJECTS[e.subj].name) + '</div>' +
            (e.note ? '<div class="row-sub">' + escapeHtml(e.note) + '</div>' : '<div class="row-sub">dle třídní knihy</div>') + '</div>' +
            '<span class="chip ' + chipCls + '">' + txt + '</span></div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Žádná zameškaná hodina</b>Skvělá docházka! 🎉</div>') +
  '</div>';
}
function sDochazka() {
  clearTick();
  const sid = mySid();
  if (!sid) return '<div class="card"><div class="empty"><b>Nemáte přiřazený žákovský účet</b></div></div>';
  return '' +
  '<div class="page-head"><div><h1>Docházka</h1><div class="sub">Zameškané hodiny podle třídní knihy – učitel zapisuje stav u každé hodiny</div></div>' +
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
  '<div class="page-head"><div><h1>Vítejte zpět, ' + escapeHtml(u.name) + '</h1><div class="sub">' + todayLabel() + ' · přehled vašich dětí</div></div>' +
    (unread ? '<div class="page-acts"><button class="btn btn-ghost btn-sm" data-act="goto:#/rodic/zpravy">' + ic('chat', 15) + ' Nepřečtené zprávy (' + unread + ')</button></div>' : '') + '</div>' +
  (kids.length > 1
    ? '<div class="rcpt-row">' + kids.map(k =>
        '<button class="rcpt-pill' + (k.id === cid ? ' active' : '') + '" data-act="p-child:' + k.id + '">' +
        '<span class="ava" style="width:24px;height:24px;font-size:11px">' + escapeHtml(k.first.charAt(0)) + '</span>' +
        k.first + ' ' + k.last + '</button>').join('') + '</div>'
    : '') +
  '<div class="grid grid-3">' +
    '<div class="card"><div class="card-title" style="display:flex;align-items:center;gap:8px">' + ic('book', 16) + ' ' + escapeHtml(st.first) + ' – celkový průměr' +
      '<button class="btn btn-ghost btn-sm" style="margin-left:auto" data-act="ch-child-pass:' + cid + '" title="Změnit heslo žáka">' + ic('lock', 14) + ' heslo</button></div>' +
      '<span class="avg-big" style="color:' + avgColor(avg) + '">' + avgTxt(avg) + '</span>' +
      '<div style="margin-top:10px"><span class="chip ' + (avg === null ? '' : (avg > 3 ? 'chip-bad' : 'chip-ok')) + '">' + (avg === null ? 'zatím bez známek' : (avg > 3 ? 'potřeba podpořit' : 'vše v pořádku')) + '</span></div>' +
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
        ? '<div class="small-note" style="margin-top:10px">z ' + abs.lessons + ' hodin zapsaných v třídní knize' + (abs.N ? ' · <b style="color:var(--bad)">' + abs.pct + ' % neomluvených (limit 25 %)</b>' : '') + '</div>'
        : '<div class="small-note" style="margin-top:10px">učitel zatím nezapsal žádnou hodinu do třídní knihy</div>') +
      '<div class="card-title" style="margin-top:18px">' + ic('book', 16) + ' Poslední záznamy</div>' +
      (recent.length
        ? '<div class="list">' + recent.map(g =>
            '<div class="list-row" style="padding:9px 11px">' + gradeCellHtml(g.cells[cid], g.title) +
            '<div class="grow"><div class="row-sub">' + escapeHtml(SUBJECTS[g.subj].name) + ' · ' + escapeHtml(g.title) + '</div>' +
            '<div style="font-size:11px;color:var(--muted)">' + fmtDate(g.date) + (g.cells[cid] === '?' ? ' · plánováno' : '') + '</div></div></div>'
          ).join('') + '</div>'
        : '<div class="empty">Zatím žádné známky</div>') +
    '</div>' +
    '<div class="card">' +
      '<div class="card-title">' + ic('chat', 16) + ' Zprávy od učitele</div>' +
      '<div class="list">' +
        (Object.values(db.threads || {}).filter(t => t.childId === cid).length
          ? Object.values(db.threads).filter(t => t.childId === cid).flatMap(t =>
              t.msgs.filter(m => m.from !== u.id).slice(-2).map(m =>
                '<div class="list-row" style="padding:9px 11px;cursor:pointer" data-act="goto:#/rodic/zpravy"><span class="chip ' + (m.readAt ? '' : 'chip-accent') + '">' + (m.readAt ? 'přečteno' : 'nové') + '</span>' +
                '<div class="grow"><div class="row-sub">' + escapeHtml(m.text.length > 90 ? m.text.slice(0, 90) + '…' : m.text) + '</div>' +
                '<div style="font-size:11px;color:var(--muted)">' + tsLabel(m.ts) + '</div></div></div>'
              )
            ).join('')
          : '<div class="empty">Zatím žádné zprávy</div>') +
      '</div>' +
      '<div class="card-title" style="margin-top:16px">' + ic('shield', 16) + ' Omluvenky</div>' +
      '<button class="btn btn-soft btn-sm" style="width:100%;margin-top:10px" data-act="goto:#/rodic/omluvenky">Nová omluvenka / historie</button>' +
      '<div class="ok-line" style="margin-top:14px">' + ic('lock', 15) + ' <span>Data jsou zabezpečená – vy vidíte jen údaje svých dětí.</span></div>' +
    '</div>' +
  '</div>';
}
onAct('p-child:', el => { localStorage.setItem('ls_child', el.getAttribute('data-act').slice(8)); route(); });
onAct('ch-child-pass:', el => {
  const sid = el.getAttribute('data-act').slice(14);
  const st = studentOf(sid);
  if (!st) return;
  openModal(
    '<h3>Změnit heslo žáka · ' + escapeHtml(st.first + ' ' + st.last) + '</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Podmínky: alespoň 8 znaků a minimálně 1 číslice. Přihlašovací jméno se měnit nedá.</p>' +
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
  if (applyPassError(String(fd.get('new1') || ''), String(fd.get('new2') || ''))) return;
  acc.pass = String(fd.get('new1'));
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
          ? '<div class="field"><label>Které hodiny dítě zameškalo? <span class="small-note" style="margin:0 0 0 4px">(dle rozvrhu – škrtněte ty, kdy přišel/šla)</span></label>' +
            '<div class="exc-hrs">' + per.map(p => {
              const t = slotOf(cls, p);
              const s = subjOf(cls, EXC.date, p);
              const checked = (EXC.sel || []).includes(p);
              return '<label><input type="checkbox" class="exc-per" name="per" value="' + p + '"' + (checked ? ' checked' : '') + '> ' + (p + 1) + '. hod. (' + t.s + (s ? ' · ' + SUBJECTS[s].name : '') + ')</label>';
            }).join('') + '</div></div>'
          : '<div class="warn-line">' + ic('alert', 15) + ' <span>Ve zvolený den není podle rozvrhu vyučování (víkend / prázdniny?).</span></div>') +
        '<div class="field"><label>Poznámka (volitelné)</label><textarea id="exc-note" name="note" rows="2" placeholder="Např. teplota od rána, u doktora v 9 hodin…">' + escapeHtml(EXC.note) + '</textarea></div>' +
        '<button class="btn btn-primary">' + ic('send', 15) + ' Odeslat omluvenku</button>' +
      '</form>' +
      '<div class="small-note">Učitel u hodiny hned vidí, jestli je omluvená: do schválení <b>Č</b> (čeká), po schválení <b>A</b> (omluveno). Nedorazí-li omluvenka do 3 dnů, hodina se počítá jako neomluvená (<b>N</b>) – pozdější omluvenka ji ale stále změní na omluvenou.</div>' +
    '</div>' +
    '<div class="card"><div class="card-title">' + ic('shield', 16) + ' Historie omluvenek</div>' +
      (mine.length
        ? '<div class="list">' + mine.map(x => {
            const st2 = studentOf(x.childId);
            return '<div class="list-row"><span class="chip ' + (x.status === 'schvaleno' ? 'chip-ok' : x.status === 'zamitnuto' ? 'chip-bad' : 'chip-warn') + '">' + { schvaleno: 'schváleno', zamitnuto: 'zamítnuto', ceka: 'čeká na schválení' }[x.status] + '</span>' +
            '<div class="grow"><div class="row-title">' + escapeHtml(st2 ? st2.first + ' ' + st2.last : '') + '</div>' +
            '<div class="row-sub">' + fmtDate(x.date) + ' · ' + escapeHtml(excuseHoursLabel(st2 ? st2.cls : '', x.date, x.periods) || 'celý den') + (x.reason ? ' · ' + escapeHtml(x.reason) : '') + (x.note ? ' · ' + escapeHtml(x.note) : '') + '</div></div>' +
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
        '<textarea name="text" rows="1" placeholder="Napište zprávu…" required style="min-height:44px"></textarea>' +
        '<button class="btn btn-primary">' + ic('send', 16) + '</button></div></form>' +
        '<div class="rcpt-row" style="margin:12px 0 0">' +
          ['Omlouvám, dnes nepřijde…', 'Můžete mi prosím zavolat?', 'Děkujeme za zprávu!'].map(t2 =>
            '<button class="rcpt-pill" data-act="p-tpl:' + escapeHtml(t2) + '" style="font-size:12px">' + escapeHtml(t2) + '</button>').join('') + '</div>') +
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
  '<div class="page-head"><div><h1>Zprávy s učiteli</h1><div class="sub">Konverzace přijaté i odeslané – novou s předmětem založíte vlevo</div></div></div>' +
  '<div class="grid grid-2">' +
    '<div>' +
      '<div class="card"><div class="card-title">' + ic('plus', 16) + ' Nová konverzace</div>' +
        (kids.length > 1
          ? '<div class="field"><label>Dítě</label><select id="p-new-child" data-chg="p-new-child">' +
            kids.map(k => '<option value="' + k.id + '"' + (k.id === curCid ? ' selected' : '') + '>' + escapeHtml(k.first + ' ' + k.last) + '</option>').join('') + '</select></div>'
          : '<input type="hidden" id="p-new-child" value="' + kids[0].id + '">') +
        '<div class="field"><label>Předmět</label><input id="p-new-subj" placeholder="Např. Dotaz k písemce, konzultace…"></div>' +
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
          : '<div class="empty"><b>Zatím žádné konverzace</b>Založte první vlevo – nebo vám napíše učitel.</div>') +
      '</div>' +
    '</div>' +
    '<div>' + (openTh ? pConvDetailHtml(u, openTh) : '<div class="card"><div class="empty">Založte konverzaci vlevo.</div></div>') + '</div>' +
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
        '<textarea name="text" rows="1" placeholder="Napište zprávu…" required style="min-height:44px"></textarea>' +
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
          ? '<div class="field"><label>Předmět zprávy</label><input id="s-new-subj" placeholder="Např. Otázka k písemce, omluvenka, úkol…"></div>' +
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
    '<div>' + (openTh ? stuConvDetailHtml(u, openTh) : '<div class="card"><div class="empty">Vyberte konverzaci vlevo.</div></div>') + '</div>' +
  '</div>';
}
onAct('p-tpl:', el => {
  const ta = document.querySelector('.compose textarea');
  if (ta) { ta.value = el.getAttribute('data-act').slice(6); ta.focus(); }
});
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
  const myRecs = (db.records || []).filter(r => r.sid === sid)
    .concat(notesOf(sid).filter(n => Number(n.sev) === 3).map(n => ({ type: 'sev3', reason: (n.title ? n.title + '\n' : '') + (n.reason || ''), date: n.date, sem: semOfDate(n.date) })))
    .sort((a, z) => (a.date === z.date ? 0 : a.date < z.date ? 1 : -1));
  const cell = sub => {
    let out = '';
    [1, 2].forEach(sem => {
      const cols = semesterColumnGradesOf(sid, sub, sem);
      const a = semesterAvgOf(sid, sub, sem);
      out += '<td style="border-left:2px solid ' + (sem === 1 ? 'rgba(59,130,246,.5)' : 'rgba(16,185,129,.5)') + ';text-align:center">' +
        (cols.length
          ? '<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center">' + cols.map(col => {
              const v = col.cells[sid];
              const counted = tokenCounted(v);
              return '<span class="g-cell' + (counted ? ' ' + gradeColor(v) : '') + '" title="' + escapeHtml(col.title || '') + ' · ' + fmtDate(col.date) + '">' + escapeHtml(v === '?' ? '?' : v) + '</span>';
            }).join('') + '</div>'
          : '<span style="opacity:.3">—</span>') +
        (a.avg !== null ? '<div class="small-note" style="margin:4px 0 0;font-weight:700;color:' + avgColor(a.avg) + '">Ø ' + a.avg.toFixed(2) + '</div>' : '') +
        '</td>';
    });
    return out;
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
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">1. pol do 31. 1. · 2. pol od 1. 2.</span></div>' +
    (subjects.length
      ? '<div class="tbl-wrap" style="max-height:560px;overflow:auto"><table class="tbl" style="min-width:640px"><thead><tr>' +
        '<th style="position:sticky;left:0;background:var(--surface);z-index:2;min-width:170px;text-align:left">Předmět</th>' +
        '<th style="min-width:160px">1. pololetí</th><th style="min-width:160px">2. pololetí</th></tr></thead><tbody>' +
        subjects.map(sub => '<tr><td style="position:sticky;left:0;background:var(--surface);z-index:1"><div style="display:flex;align-items:center;gap:8px">' + subjBadge(sub, 26) + '<b>' + escapeHtml(SUBJECTS[sub].name) + '</b></div></td>' + cell(sub) + '</tr>').join('') +
        '</tbody></table></div>'
      : '<div class="empty">Zatím žádné předměty – známky se tu objeví, jakmile učitel začne zapisovat.</div>') +
    '</div>' +
    '<div class="card" style="margin-top:16px"><div class="card-title">' + ic('check', 16) + ' Pochvaly a výchovná opatření' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">' + myRecs.length + ' ' + csPlural(myRecs.length, 'záznam', 'záznamy', 'záznamů') + '</span></div>' +
    (myRecs.length
      ? '<div class="list">' + myRecs.map(r => {
          if (r.type === 'sev3') {
            return '<div class="list-row"><span class="ava" style="background:linear-gradient(135deg,#EF4444,#DC2626)">' + ic('edit', 16) + '</span>' +
              '<div class="grow"><div class="row-title">' + recChip('du-tu') + '</div>' +
              '<div style="margin-top:3px">' + escapeHtml(r.reason || '') + '</div>' +
              '<div class="row-sub">' + semLabel(r.sem || semOfDate(r.date)) + ' · ' + fmtDate(r.date) + '</div></div></div>';
          }
          return '<div class="list-row"><span class="ava" style="background:' + ({ ok: 'linear-gradient(135deg,#10B981,#059669)', accent: 'linear-gradient(135deg,#3B82F6,#2563EB)', warn: 'linear-gradient(135deg,#F59E0B,#D97706)', bad: 'linear-gradient(135deg,#EF4444,#DC2626)' }[REC_BY_ID[r.type] && REC_BY_ID[r.type].tone] || 'linear-gradient(135deg,#64748B,#475569)') + '">' + ic({ ok: 'check', accent: 'check', warn: 'alert', bad: 'x' }[REC_BY_ID[r.type] && REC_BY_ID[r.type].tone] || 'flag', 16) + '</span>' +
            '<div class="grow"><div class="row-title">' + recChip(r.type) + '</div>' +
            '<div style="margin-top:3px">' + escapeHtml(r.reason || '') + '</div>' +
            '<div class="row-sub">' + semLabel(r.sem || semOfDate(r.date)) + ' · ' + fmtDate(r.date) + '</div></div></div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Zatím žádné záznamy</b>Pochvaly a výchovná opatření tu zapisuje třídní učitel.</div>') +
    '</div>';
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
  /* na telefonu/tabletu: výběr předmětu nahoře, bez dlouhého scrollování */
  if (isAppMode() && isFamilyRole(currentUser().role) && keys.length) {
    let sel = localStorage.getItem('ls_vyuka_subj');
    if (!keys.includes(sel)) sel = keys[0];
    const list = bySubj[sel].slice().sort((a, z) => (a.date === z.date ? (a.period - z.period) : (a.date < z.date ? 1 : -1)));
    return '<div class="page-head"><div><h1>Výuka</h1>' +
      '<div class="sub">Vyber předmět a uvidíš, co se probíralo</div></div></div>' +
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
    return '<div class="list-row" style="align-items:flex-start"><span class="ava" style="background:linear-gradient(135deg,#F59E0B,#D97706)">' + ic('flag', 15) + '</span>' +
      '<div class="grow"><div class="row-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + escapeHtml(a.title) + (isPast ? '' : actionCountdownChip(days)) + '</div>' +
      (a.desc ? '<div style="margin-top:3px;white-space:pre-wrap">' + escapeHtml(a.desc) + '</div>' : '') +
      '<div class="row-sub">' + fmtDate(a.date) + (isPast ? ' · proběhlo' : '') + (a.sid ? ' · akce jen pro ' + (isRod ? 'vaše dítě' : 'tebe') : ' · celá třída') + '</div></div></div>';
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
