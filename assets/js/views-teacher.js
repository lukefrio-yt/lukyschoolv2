/* ============================================================
   SchoolSys — učitelský modul
   Rozsah = třídy přiřazené učiteli. Známkování = TABULKA:
   sloupce (testy) s vahou a datem, buňky = známky.
   ============================================================ */
'use strict';

/* Docházka: učitel zapisuje ÚČAST ✓ přítomen / ✗ nepřítomen / D dočasně.
   Štítek omluvení A/Č/N se odvozuje v data.js (absenceMark) z omluvenek
   rodičů a je jen pro učitele, vpravo – nelze ho ručně nastavit. */
/* mobile/tablet zámek: tyto moduly jsou jen pro počítač */
function pcOnlyView(title) {
  return '<div class="teacher-block"><div class="teacher-block-in">' +
    '<div class="tb-ring">' + ic('home', 30) + '</div>' +
    '<h1>' + escapeHtml(title) + ' – jen na počítači 🖥️</h1>' +
    '<p>Tato funkce je dostupná <b>pouze na počítačích</b>. Otevřete SchoolSys na PC a proveďte zápis tam.</p>' +
    '<button class="btn btn-ghost tb-btn" data-act="goto:#/' + (currentUser() && currentUser().isAdmin ? 'admin' : 'ucitel') + '/prehled">' + ic('back', 16) + ' Zpět na přehled</button>' +
  '</div></div>';
}
function clsScopePills() {
  const list = myClasses();
  const act = activeClsId();
  if (!list.length) return '';
  return '<div class="rcpt-row">' + list.map(c =>
    '<button class="rcpt-pill' + (c.id === act ? ' active' : '') + '" data-act="t-cls:' + c.id + '">' + escapeHtml(c.name) + '</button>').join('') + '</div>';
}
onAct('t-cls:', el => { localStorage.setItem('t_cls', el.getAttribute('data-act').slice(6)); route(); });
function noClassPrompt() {
  const u = currentUser();
  /* třídy i žáky si nyní zakládá učitel sám – ale jen na počítači */
  if (u && !u.isAdmin && !isContactUser(u) && isAppMode()) {
    return '<div class="card"><div class="empty"><b>Nemáte přiřazenou žádnou třídu</b>' +
      'Třídu a žáky si vytvoříte na <b>počítači</b> v záložce Známkování („Přidat žáka“) – na mobilu to není dostupné. 🖥️' +
      '</div></div>';
  }
  if (u && !u.isAdmin && !isContactUser(u)) {
    return '<div class="card"><div class="empty"><b>Nemáte přiřazenou žádnou třídu</b>' +
      'Vytvořte si ji: v záložce <b>Známkování</b> klikněte na „Přidat žáka“ a třídu založíte rovnou v dialogu, nebo ji zřiďte ve Správě školy.' +
      '<div style="margin-top:12px"><button class="btn btn-primary btn-sm" data-act="t-cls-create-prompt">' + ic('plus', 15) + ' Vytvořit první třídu</button></div>' +
      '</div></div>';
  }
  return '<div class="card"><div class="empty"><b>Nemáte přiřazenou žádnou třídu</b>' +
    (u && u.isAdmin
      ? 'Třídu si přiřaďte ve Správě školy (Třídy → Třídní učitel).'
      : 'Kontaktujte správce školy, aby vám třídu přiřadil.') +
    '</div></div>';
}
/* vytvoření třídy přímo z učitelského rozhraní (jen PC) */
onAct('t-cls-create-prompt', () => {
  if (isAppMode()) { toast('Třídy se zakládají jen na počítači 🖥️', 'bad'); return; }
  openModal(
    '<h3>Nová třída</h3>' +
    '<form data-form="t-cls-create">' +
      '<div class="field"><label>Název třídy</label><input name="name" placeholder="Např. 1. A" required autofocus></div>' +
      '<button class="btn btn-primary">Vytvořit třídu</button>' +
    '</form>');
});
onAct('form:t-cls-create', f => {
  const name = String(new FormData(f).get('name')).trim();
  if (!name) { toast('Zadejte název třídy', 'bad'); return; }
  const id = db.classes.some(c => c.id === name) ? uid() : name;
  const me = currentUser();
  const c = { id, name, orgId: me.orgId || null, teacherIds: [me.id], mainTeacher: me.id };
  db.classes.push(c);
  localStorage.setItem('t_cls', id);
  saveDB();
  closeModal();
  toast('Třída „' + escapeHtml(name) + '“ vytvořena ✓ – teď do ní přidejte žáky', 'ok');
  route();
});
function flushScheduled() {
  if (!db.scheduledMsgs) db.scheduledMsgs = [];
  const due = db.scheduledMsgs.filter(m => new Date(m.sendAt).getTime() <= Date.now());
  if (!due.length) return;
  db.scheduledMsgs = db.scheduledMsgs.filter(m => new Date(m.sendAt).getTime() > Date.now());
  due.forEach(m => { sendTeacherMsg(m.text, m.who || 'rodic', m.mode, m.subj || ''); toast('Naplánovaná zpráva byla odeslána ✓', 'ok'); });
  saveDB();
}

/* ================= PŘEHLED ================= */
function tPrehled() {
  clearTick();
  flushScheduled();
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const cls = classOf(cid);
  const sts = studentsOfClass(cid);
  const risk = sts.filter(s => isAtRisk(s.id));
  const today = todayISO();
  const plan = teacherDayPlan(cid, today);
  const lessons = plan.filter(p => p.type !== 'volno');
  const pending = pendingExcusesFor(currentUser());
  const unread = userUnreadMsgs(currentUser().id);
  const upcoming = changesOfClass(cid).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const chgToday = upcoming.filter(c => c.date === today).length;
  const wdT = weekdayOf(today);
  const dayLabel = wdT >= 1 && wdT <= 5 ? WD_CS[wdT - 1] : 'víkend';

  return '' +
  '<div class="page-head"><div><h1>Dobrý den, ' + escapeHtml(currentUser().name) + '</h1>' +
    '<div class="sub">' + todayLabel() + ' · ' + (cls ? escapeHtml(cls.name) : '') + '</div></div>' +
    '<div class="page-acts"><button class="btn btn-ghost btn-sm" data-act="goto:#/ucitel/kniha">' + ic('clipboard', 15) + ' Zapsat hodinu</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="goto:#/ucitel/dochazka">' + ic('calendar', 15) + ' Docházka</button></div></div>' +
  clsScopePills() +
  '<div class="grid grid-4">' +
    '<div class="stat"><span class="s-ic" style="background:rgba(59,130,246,.14);color:var(--accent)">' + ic('calendar', 20) + '</span><div><b>' + lessons.length + '</b><span>hodin dnes</span></div></div>' +
    '<div class="stat"><span class="s-ic" style="background:rgba(245,158,11,.14);color:var(--warn)">' + ic('shield', 20) + '</span><div><b>' + pending.length + '</b><span>omluvenek ke schválení</span></div></div>' +
    '<div class="stat"><span class="s-ic" style="background:rgba(16,185,129,.14);color:var(--ok)">' + ic('chat', 20) + '</span><div><b>' + unread + '</b><span>nepřečtených zpráv</span></div></div>' +
    '<div class="stat"><span class="s-ic" style="background:rgba(239,68,68,.14);color:var(--bad)">' + ic('alert', 20) + '</span><div><b>' + risk.length + '</b><span>ohrožených žáků</span></div></div>' +
  '</div>' +
  (chgToday ? '<div class="warn-line" style="margin-top:14px">' + ic('bell', 15) + ' <span>Dnes má třída ' + chgToday + ' ' + csPlural(chgToday, 'změnu', 'změny', 'změn') + ' v rozvrhu – detail v kategorii Změny v rozvrhu.</span></div>' : '') +
  '<div class="grid grid-2" style="margin-top:16px">' +
    '<div class="card"><div class="card-title">' + ic('clock', 16) + ' Dnes (' + dayLabel + ')</div>' +
      '<div class="day-grid">' + (lessons.length ? lessons.map(p => {
        const who = p.teacherId ? teacherLabel(p.teacherId) : '';
        const rmChip = p.room ? roomChip(p.room, 22) : '';
        return '<div class="lesson"><span class="time">' + p.t.s + '<br>' + p.t.e + '</span>' +
          subjBadge(p.subj, 40) + '<div class="grow"><div class="row-title">' + escapeHtml(SUBJECTS[p.subj].name) + '</div>' +
          '<div class="row-sub">' + escapeHtml([who, p.cls].filter(Boolean).join(' · ')) + (rmChip ? '<span style="margin:0 0 0 7px">' + rmChip + '</span>' : '') + '</div></div>' +
          (!isAppMode() ? '<button class="btn btn-soft btn-sm" data-act="goto:#/ucitel/kniha">' + ic('edit', 14) + ' Zápis</button>' : '') + '</div>';
      }).join('') : '<div class="empty">Dnes nemáte výuku</div>') + '</div>' +
    '</div>' +
    '<div>' +
      '<div class="card"><div class="card-title" style="color:var(--bad)">' + ic('alert', 17) + ' Ohrožení žáci (průměr &gt; 3,5 nebo neomluvená absence &gt; 25 %)</div>' +
        (risk.length
          ? '<div class="list">' + risk.map(s => {
              const w = worstSubjectOf(s.id);
              return '<div class="list-row">' + teacherAva(s, 34) +
                '<div class="grow"><div class="row-title">' + escapeHtml(s.first + ' ' + s.last) + '</div>' +
                '<div class="row-sub" style="color:var(--bad)">' + escapeHtml(riskReason(s.id).join(' · ')) + '</div></div>' +
                (w ? '<b style="color:' + avgColor(w.avg) + '">' + w.avg.toFixed(2) + '</b>' : '') +
                '<button class="btn btn-soft btn-sm" data-act="goto:#/ucitel/klasifikace">' + ic('book', 14) + ' Známky</button></div>';
            }).join('') + '</div>'
          : '<div class="empty"><b>Vše v pořádku</b>Žádný žák není ohrožen.</div>') +
      '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card-title">' + ic('bell', 16) + ' Změny v rozvrhu (' + escapeHtml(cls.name) + ')</div>' +
        (upcoming.length
          ? '<div class="list">' + upcoming.slice(0, 4).map(c =>
              '<div class="list-row"><span class="chip chip-bad">' + changeShortLabel(c) + '</span>' +
              '<div class="grow"><div class="row-sub"><b>' + fmtDate(c.date) + '</b> · ' + (c.period + 1) + '. hodina</div>' +
              '<div style="font-size:12px;color:var(--muted)">' + escapeHtml(c.reason || '') + '</div></div>' +
              '<button class="btn btn-ghost btn-sm" data-act="goto:#/ucitel/zmenyrozvrh">Detail</button></div>'
            ).join('') + '</div>'
          : '<div class="empty">Žádné změny</div>') +
      '</div>' +
    '</div>' +
  '</div>';
}
function teacherAva(s, size) {
  const sz = size || 34;
  return '<span class="ava" style="width:' + sz + 'px;height:' + sz + 'px;font-size:' + Math.round(sz * 0.42) + 'px;background:linear-gradient(135deg,#3B82F6,' + (s.ivp ? '#10B981' : '#8B5CF6') + ')">' + escapeHtml(s.first.charAt(0) + s.last.charAt(0)) + '</span>';
}
function teacherDayPlan(clsId, iso) {
  const sc = scheduleOf(clsId);
  const lessons = lessonsOfDay(clsId, iso);
  const plan = [];
  for (let i = 0; i < sc.slots.length; i++) {
    const t = slotOf(clsId, i);
    const l = lessons.find(x => x.period === i);
    if (l) plan.push({ period: i, type: 'hodina', subj: l.subj, room: l.room, teacherId: l.teacherId, cls: classOf(clsId) ? classOf(clsId).name : clsId, t });
    else plan.push({ period: i, type: 'volno', t });
  }
  return plan;
}

/* ================= DOCHÁZKA (přehled třídy) =================
   Účast se NEzapisuje tady, ale v třídní knize u každé hodiny:
   ✓ přítomen · ✗ nepřítomen · D dočasně. Štítek omluvení A/Č/N (vpravo)
   se doplňuje automaticky z omluvenek rodičů a nelze ho nastavit.
*/
function atLegend() {
  return '<div class="at-leg">' +
    '<b><i class="leg-ic lp">✓</i> přítomen</b>' +
    '<b><i class="leg-ic lx">✗</i> nepřítomen</b>' +
    '<b><i class="leg-ic ld">D</i> dočasně – byl jen chvíli</b>' +
  '</div>' +
  '<div class="small-note" style="margin:-4px 0 12px">' +
    'Štítek omluvení vpravo doplňuje systém sám z omluvenek rodičů – <b style="color:var(--ok)">✓</b> rodič dítě omluvil, ' +
    '<b style="color:var(--bad)">✗</b> chybí omluvenka, přestože má být ve škole. Nelze ho přepsat. ' +
    '<b style="color:var(--warn)">D</b> se do zameškaných hodin nepočítá, omluvenka se u něj ale očekává.</div>';
}
function tDochazka() {
  clearTick();
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const cls = classOf(cid);
  const sts = studentsOfClass(cid);
  const lessons = classbookLessonsOf(cid);
  const subs = subjectsOfClass(cid);
  const perSub = classSubjectLessonCounts(cid);
  const rows = sts.map(s => ({ s, ov: absenceOverview(s.id) }));
  const sumN = rows.reduce((acc, r) => acc + r.ov.total.N, 0);
  const sumMiss = rows.reduce((acc, r) => acc + r.ov.total.missing, 0);
  const withMiss = rows.filter(r => r.ov.total.missing > 0).length;
  const subCell = b => {
    if (!b || !b.lessons) return '<td class="abs-cell" style="color:var(--muted)">—</td>';
    const c = b.N ? 'var(--bad)' : b.missing ? 'var(--warn)' : 'var(--muted)';
    return '<td class="abs-cell" title="omluveno ' + b.A + ' · čeká ' + b.C + ' · neomluveno ' + b.N + '" style="color:' + c + '">' + b.missing + '/' + b.lessons + '</td>';
  };
  return '' +
  '<div class="page-head"><div><h1>Docházka – přehled třídy</h1>' +
    '<div class="sub">' + escapeHtml(cls.name) + ' · docházka se zapisuje v třídní knize u každé hodiny</div></div>' +
    '<div class="page-acts"><button class="btn btn-ghost btn-sm" data-act="goto:#/ucitel/kniha">' + ic('clipboard', 15) + ' Zapsat docházku</button></div></div>' +
  clsScopePills() +
  '<div class="grid grid-4">' +
    '<div class="stat"><span class="s-ic" style="background:rgba(59,130,246,.14);color:var(--accent)">' + ic('clipboard', 20) + '</span><div><b>' + lessons.length + '</b><span>zapsaných hodin</span></div></div>' +
    '<div class="stat"><span class="s-ic" style="background:rgba(245,158,11,.14);color:var(--warn)">' + ic('alert', 20) + '</span><div><b>' + withMiss + '</b><span>žáků s absencí</span></div></div>' +
    '<div class="stat"><span class="s-ic" style="background:rgba(16,185,129,.14);color:var(--ok)">' + ic('calendar', 20) + '</span><div><b>' + sumMiss + '</b><span>zameškaných hodin</span></div></div>' +
    '<div class="stat"><span class="s-ic" style="background:rgba(239,68,68,.14);color:var(--bad)">' + ic('shield', 20) + '</span><div><b>' + sumN + '</b><span>neomluvených hodin</span></div></div>' +
  '</div>' +
  (sts.length
    ? '<div class="card" style="margin-top:16px"><div class="card-title">' + ic('calendar', 16) + ' Zameškané hodiny po předmětech' +
        '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">x / y = zameškáno z hodin zapsaných v třídní knize</span></div>' +
      '<div class="tbl-wrap" style="max-height:560px;overflow:auto"><table class="tbl" style="min-width:640px"><thead><tr>' +
        '<th style="position:sticky;left:0;background:var(--surface);min-width:190px">Žák</th>' +
        subs.map(sub => '<th class="num" style="min-width:64px" title="' + escapeHtml(SUBJECTS[sub].name) + '">' + subjBadge(sub, 22) + '<div style="font-size:10.5px;color:var(--muted);font-weight:600">' + (perSub[sub] || 0) + ' hod</div></th>').join('') +
        '<th class="num" style="min-width:84px">Σ zameškáno</th>' +
        '<th style="min-width:170px">Rozpad</th>' +
      '</tr></thead><tbody>' +
      rows.map(({ s, ov }) => {
        const t = ov.total;
        return '<tr class="' + (isAtRisk(s.id) ? 'risk' : '') + '">' +
          '<td style="position:sticky;left:0;background:var(--surface)"><div style="display:flex;align-items:center;gap:10px">' + teacherAva(s, 32) +
            '<b>' + escapeHtml(s.first + ' ' + s.last) + '</b>' + (s.ivp ? ' <span class="chip chip-info" style="padding:0 6px;font-size:10px">IVP</span>' : '') + '</div></td>' +
          subs.map(sub => subCell(ov.bySubj[sub])).join('') +
          '<td class="abs-cell" title="omluveno ' + t.A + ' · čeká ' + t.C + ' · neomluveno ' + t.N + '" style="color:' + (t.N ? 'var(--bad)' : t.missing ? 'var(--warn)' : 'var(--muted)') + '">' + (t.lessons ? t.missing + '/' + t.lessons : '—') + '</td>' +
          '<td>' + (t.missing
            ? '<span style="font-size:11.5px;color:var(--muted)">omluveno <b style="color:var(--ok)">' + t.A + '</b> · čeká <b style="color:var(--warn)">' + t.C + '</b> · neomluveno <b style="color:var(--bad)">' + t.N + '</b>' + (t.unexPct > 25 ? ' <span class="chip chip-bad" style="font-size:10px">' + t.unexPct + ' % N</span>' : '') + '</span>'
            : '<span class="chip chip-ok" style="font-size:10.5px">bez absence</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      atLegend() +
    '</div>'
    : '<div class="card"><div class="empty"><b>Ve třídě zatím nejsou žáci</b>Přidejte je v Známkování („Přidat žáka“) nebo v Údaje.</div></div>') + '';
}

/* ================= ZNÁMKOVÁNÍ (tabulka) ================= */
let GB = { subj: 'M' };
function tKlasifikace() {
  clearTick();
  if (isAppMode()) return pcOnlyView('Známkování');
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const cls = classOf(cid);
  const sts = studentsOfClass(cid);
  const subjParam = (location.hash.split('|')[1] || '').toUpperCase();
  if (SUBJ_KEYS.includes(subjParam)) GB.subj = subjParam;
  if (!SUBJ_KEYS.includes(GB.subj)) GB.subj = 'M';
  const subj = GB.subj;
  const cols = (db.columns || []).filter(c => c.cls === cid && c.subj === subj)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));

  return '' +
  '<div class="page-head"><div><h1>Známkování – tabulka</h1><div class="sub">Sloupec = test s vahou a datem · do buňky pište 1–5, 1-…4-, N, A nebo ?</div></div>' +
    '<div class="page-acts">' +
      '<button class="btn btn-primary btn-sm" data-act="t-col-add">' + ic('plus', 15) + ' Nový sloupec</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="t-stud-add">' + ic('book', 15) + ' Přidat žáka</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="t-export">' + ic('download', 15) + ' CSV</button>' +
    '</div></div>' +
  clsScopePills() +
  '<div class="rcpt-row">' + SUBJ_KEYS.map(s =>
    '<button class="rcpt-pill' + (s === subj ? ' active' : '') + '" data-act="t-subj:' + s + '">' + SUBJECTS[s].name + '</button>').join('') + '</div>' +
  (sts.length
    ? '<div class="card"><div class="tbl-wrap" style="max-height:520px;overflow:auto">' +
        '<table class="tbl" style="min-width:900px"><thead><tr>' +
          '<th style="position:sticky;left:0;background:var(--surface);z-index:2;min-width:170px">Žák</th>' +
          cols.map(c => '<th style="min-width:120px;text-align:center">' +
            '<div style="font-weight:800;color:var(--text)">' + escapeHtml(c.title) + '</div>' +
            '<div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:none;letter-spacing:0">' + fmtDate(c.date) + ' · váha ' + c.weight + '×</div>' +
            '<div style="display:flex;gap:4px;justify-content:center;margin-top:4px">' +
              '<button class="icon-btn sm" data-act="t-col-edit:' + c.id + '" title="Upravit sloupec">' + ic('edit', 12) + '</button>' +
              '<button class="icon-btn sm" data-act="t-col-del:' + c.id + '" title="Smazat sloupec" style="color:var(--bad)">' + ic('trash', 12) + '</button>' +
            '</div></th>').join('') +
          '<th class="num" style="min-width:70px">Ø</th><th style="min-width:130px">Stav</th></tr></thead><tbody>' +
          sts.map(s => {
            const risk = isAtRisk(s.id);
            return '<tr class="' + (risk ? 'risk' : '') + '">' +
              '<td style="position:sticky;left:0;background:var(--surface);z-index:1"><div style="display:flex;align-items:center;gap:8px">' + teacherAva(s, 28) +
                '<b>' + escapeHtml(s.last + ' ' + s.first) + '</b>' + (s.ivp ? ' <span class="chip chip-info" style="padding:0 5px;font-size:9px">IVP</span>' : '') + '</div></td>' +
              cols.map(c => {
                const v = (c.cells && c.cells[s.id]) || '';
                return '<td style="text-align:center"><select class="sel g-sel" data-col="' + c.id + '" data-sid="' + s.id + '" style="width:64px;text-align:center;font-weight:800;padding:6px 4px">' +
                  '<option value=""' + (!v ? ' selected' : '') + '>—</option>' +
                  GRADE_TOKENS.map(t => '<option value="' + t + '"' + (v === t ? ' selected' : '') + '>' + t + '</option>').join('') +
                '</select></td>';
              }).join('') +
              '<td class="num" id="avg-' + s.id + '" style="color:' + avgColor(weightedAvgOf(s.id, subj).avg) + ';font-weight:900">' + avgTxt(weightedAvgOf(s.id, subj).avg) + '</td>' +
              '<td>' + (risk ? '<span class="chip chip-bad" style="font-size:10px">' + escapeHtml(riskReason(s.id).join(' · ')) + '</span>' : '') + '</td></tr>';
          }).join('') +
          (cols.length ? '<tr><td style="position:sticky;left:0;background:var(--surface-2)"><b>Ø třídy</b></td>' +
            cols.map(c => {
              const vals = Object.keys(c.cells || {}).map(sid => tokenVal(c.cells[sid])).filter(v => v !== null);
              const m = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
              return '<td class="num" style="color:' + avgColor(m) + ';font-weight:900">' + avgTxt(m) + '</td>';
            }).join('') +
            '<td></td><td></td></tr>' : '') +
        '</tbody></table></div>' +
        '<div class="small-note" style="margin-top:10px">N = nepsal(a) test (doplní) · A = absence (test už nepsát) · ? = budoucí / plánovaný test. N, A a ? se do průměru nepočítají. Mínusy: 1- = 1,5 · 2- = 2,5 · 3- = 3,5 · 4- = 4,5.</div>' +
      '</div>'
    : '<div class="card"><div class="empty"><b>Ve třídě zatím nejsou žáci</b>' +
        '<button class="btn btn-primary btn-sm" style="margin-top:12px" data-act="t-stud-add">' + ic('book', 15) + ' Přidat prvního žáka</button></div></div>') +
  (cols.length === 0 && sts.length
    ? '<div class="card" style="margin-top:16px"><div class="empty"><b>Zatím žádné sloupce</b>Klikněte na „Nový sloupec“ a pojmenujte ho třeba „Diktát č. 1“.</div></div>'
    : '');
}
onAct('t-subj:', el => { GB.subj = el.getAttribute('data-act').slice(7); route(); });
onAct('t-stud-add', () => {
  if (isAppMode()) { toast('Přidávání žáků je dostupné jen na počítači 🖥️', 'bad'); return; }
  openAddStudentModal(activeClsId());
});
onAct('t-col-add', () => {
  const cid = activeClsId();
  const n = (db.columns || []).filter(c => c.cls === cid && c.subj === GB.subj).length + 1;
  openModal(
    '<h3>Nový sloupec – ' + SUBJECTS[GB.subj].name + '</h3>' +
    '<form data-form="t-col-create">' +
      '<div class="field"><label>Název testu / sloupce</label><input name="title" value="Test č. ' + n + '" placeholder="Např. Diktát č. 1" required></div>' +
      '<div class="field-row-3">' +
        '<div class="field"><label>Datum</label><input type="date" name="date" value="' + todayISO() + '" required></div>' +
        '<div class="field"><label>Váha</label><select name="weight">' + [1, 2, 3, 5, 10].map(w => '<option value="' + w + '"' + (w === 1 ? ' selected' : '') + '>' + w + '×</option>').join('') + '</select></div>' +
        '<div class="field"><label>&nbsp;</label><select name="prefill"><option value="">bez předvyplnění</option><option value="?">? pro všechny (budoucí test)</option></select></div>' +
      '</div>' +
      '<div class="field"><label>Poznámka (volitelné)</label><input name="note" placeholder="Např. opravný termín, podmínky IVP…"></div>' +
      '<button class="btn btn-primary">Vytvořit sloupec</button>' +
    '</form>');
});
onAct('form:t-col-create', f => {
  const fd = new FormData(f);
  const cid = activeClsId();
  const title = String(fd.get('title')).trim();
  if (!title) { toast('Zadejte název', 'bad'); return; }
  const col = {
    id: uid(), cls: cid, subj: GB.subj, title,
    date: String(fd.get('date')), weight: Number(fd.get('weight')), note: String(fd.get('note')).trim(), cells: {}
  };
  if (String(fd.get('prefill')) === '?') {
    studentsOfClass(cid).forEach(s => { col.cells[s.id] = '?'; });
  }
  db.columns.push(col);
  saveDB();
  closeModal();
  toast('Sloupec „' + escapeHtml(title) + '“ vytvořen ✓', 'ok');
  route();
});
onAct('t-col-edit:', el => {
  const col = (db.columns || []).find(c => c.id === el.getAttribute('data-act').slice(11));
  if (!col) return;
  openModal(
    '<h3>Upravit sloupec</h3>' +
    '<form data-form="t-col-save">' +
      '<input type="hidden" name="col" value="' + col.id + '">' +
      '<div class="field"><label>Název</label><input name="title" value="' + escapeHtml(col.title) + '" required></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="field"><label>Datum</label><input type="date" name="date" value="' + col.date + '" required></div>' +
        '<div class="field"><label>Váha</label><select name="weight">' + [1, 2, 3, 5, 10].map(w => '<option value="' + w + '"' + (col.weight === w ? ' selected' : '') + '>' + w + '×</option>').join('') + '</select></div>' +
      '</div>' +
      '<div class="field"><label>Poznámka</label><input name="note" value="' + escapeHtml(col.note || '') + '"></div>' +
      '<button class="btn btn-primary">Uložit</button>' +
    '</form>');
});
onAct('form:t-col-save', f => {
  const col = (db.columns || []).find(c => c.id === String(new FormData(f).get('col')));
  if (!col) return;
  const fd = new FormData(f);
  col.title = String(fd.get('title')).trim();
  col.date = String(fd.get('date'));
  col.weight = Number(fd.get('weight'));
  col.note = String(fd.get('note')).trim();
  saveDB();
  closeModal();
  toast('Sloupec uložen ✓', 'ok');
  route();
});
onAct('t-col-del:', el => {
  const col = (db.columns || []).find(c => c.id === el.getAttribute('data-act').slice(10));
  if (!col) return;
  openModal('<h3>Smazat sloupec „' + escapeHtml(col.title) + '“?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Smazou se všechny známky v tomto sloupci.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="t-col-del-ok:' + col.id + '">Smazat</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('t-col-del-ok:', el => {
  deleteColumnById(el.getAttribute('data-act').slice(13));
  closeModal();
  toast('Sloupec smazán', 'bad');
  route();
});
document.addEventListener('change', e => {
  const sel = e.target.closest('.g-sel');
  if (!sel) return;
  setCell(sel.dataset.col, sel.dataset.sid, sel.value);
  const a = weightedAvgOf(sel.dataset.sid, GB.subj);
  const cell = document.getElementById('avg-' + sel.dataset.sid);
  if (cell) { cell.textContent = avgTxt(a.avg); cell.style.color = avgColor(a.avg); }
  const st = studentOf(sel.dataset.sid);
  if (sel.value) {
    toast(st.first + ' ' + st.last + ': ' + escapeHtml(sel.value) + (tokenCounted(sel.value) ? '' : ' (nezapočítává se)'), 'ok');
    try { navigator.vibrate && navigator.vibrate(30); } catch (err) { /* noop */ }
  }
  notifyGrade({ sid: sel.dataset.sid, subj: GB.subj, v: sel.value, w: null, title: '', date: '', note: '' }, st);
  saveDB();
});
onAct('t-export', () => {
  const cid = activeClsId();
  const sts = studentsOfClass(cid);
  const subs = SUBJ_KEYS;
  const rows = [['Příjmení', 'Jméno', 'Třída'].concat(subs.map(s => SUBJECTS[s].name))];
  sts.forEach(s => {
    rows.push([s.last, s.first, s.cls].concat(subs.map(sub => {
      const a = weightedAvgOf(s.id, sub);
      return a.avg === null ? '' : a.avg.toFixed(2);
    })));
  });
  const csv = rows.map(r => r.join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'klasifikace-' + cid.replace(/\W/g, '') + '.csv';
  a.click();
  toast('CSV export stažen ✓', 'ok');
});

/* ================= POLOLETNÍ KLASIFIKACE (vysvědčení) =================
   Učitel třídy spravuje vysvědčení: navrhované známky z průměrů, hraniční
   pásma („Rozhoduje učitel“) doplní ručně, pak pololetí uzavře a žáci i
   rodiče výsledek vidí. Znovuotevření = oprava. */
let KLS = { sem: 1 };
function tPololetka() {
  clearTick();
  if (isAppMode()) return pcOnlyView('Pololetní klasifikace');
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const cls = classOf(cid);
  const sem = KLS.sem;
  const sts = studentsOfClass(cid);
  const subs = classSubjects(cid);
  const rep = classReport(cid, sem);
  const closed = !!rep.closed;
  const subjTitle = (sub, sid) => {
    const a = semesterAvgOf(sid, sub, sem);
    if (!a.avg) return { avg: null, count: 0 };
    const g = gradeFromAvg(a.avg);
    return { avg: a.avg, count: a.count, g, decide: g.decide };
  };
  const gradeOpts = (sid, sub, cur) => {
    const t = subjTitle(sub, sid);
    const isDecide = !!(t.avg !== null && t.decide);
    const opt = g => '<option value="' + g + '"' + (String(cur) === String(g) ? ' selected' : '') + '>' + g + '</option>';
    const decided = String(cur || '') !== '';
    const noClass = !t.avg ? ' style="border-color:rgba(148,163,184,.35)"' : (isDecide && !decided ? ' style="border-color:var(--warn);background:rgba(245,158,11,.08)"' : '');
    return '<select class="sel g-sel kls-g" data-sid="' + sid + '" data-sub="' + sub + '"' + noClass + ' title="' + (isDecide && !decided ? 'Hraniční průměr – rozhodnete vy' : '') + '">' +
      '<option value=""' + (!cur ? ' selected' : '') + '>—</option>' +
      [1, 2, 3, 4, 5].map(opt).join('') + '</select>';
  };
  const sumFor = sid => {
    let sum = 0, n = 0;
    subs.forEach(sub => {
      const v = (rep.checked[sid] || {})[sub];
      const t = subjTitle(sub, sid);
      if (!t.avg) return;
      sum += t.avg; n++;
    });
    return n ? { avg: sum / n, n } : { avg: null, n: 0 };
  };
  const cellVal = (sid, sub) => (rep.checked[sid] || {})[sub] || '';
  const pending = reportPendingCount(cid, sem);
  const autoFilled = () => { reportAutoFill(cid, sem); route(); toast('Navržené známky doplněny – hraniční pásma zůstala k vašemu rozhodnutí', 'ok'); };
  const semTabs = '<div class="tabs"><button class="tab' + (sem === 1 ? ' active' : '') + '" data-act="kls-sem:1">1. pololetí</button>' +
    '<button class="tab' + (sem === 2 ? ' active' : '') + '" data-act="kls-sem:2">2. pololetí</button></div>';
  return '' +
  '<div class="page-head"><div><h1>Pololetní klasifikace</h1>' +
    '<div class="sub">' + escapeHtml(cls.name) + ' · vysvědčení za ' + semLabel(sem) + (closed ? ' – uzavřeno ' + fmtDate(rep.closedAt) : ' – návrh (žáci a rodiče ho zatím nevidí)') + '</div></div>' +
    '<div class="page-acts">' +
      (closed
        ? '<button class="btn btn-soft btn-sm" data-act="kls-open">' + ic('edit', 15) + ' Znovu otevřít k opravě</button>'
        : '<button class="btn btn-primary btn-sm" data-act="kls-close">' + ic('check', 15) + ' Konec pololetí – uzavřít</button>') +
      (!closed ? '<button class="btn btn-ghost btn-sm" data-act="kls-auto">' + ic('zap', 15) + ' Doplnit navržené známky</button>' : '') +
    '</div></div>' +
  clsScopePills() + semTabs +
  (!closed && pending
    ? '<div class="warn-line" data-cd><span>Zbývá <b>' + pending + '</b> hraničních případů („Rozhoduje učitel“) – označené žlutě doplňte ručně.</span></div>'
    : '') +
  (!closed ? '<div class="small-note" style="margin:2px 0 12px">Známky se navrhují z průměru známek daného pololetí. Kde je průměr v hraničním pásmu (1,45–1,55 apod.), vybere finální známku učitel – takové políčko je zvýrazněné žlutě.</div>' : '') +
  (sts.length && subs.length
    ? '<div class="card"><div class="tbl-wrap" style="max-height:620px;overflow:auto">' +
        '<table class="tbl" style="min-width:900px"><thead><tr>' +
          '<th style="position:sticky;left:0;background:var(--surface);z-index:2;min-width:180px">Žák</th>' +
          subs.map(s => '<th style="min-width:88px;text-align:center" title="' + escapeHtml(SUBJECTS[s].name) + '">' + subjBadge(s, 24) +
            '<div style="font-size:10px;color:var(--muted);font-weight:600;margin-top:3px">' + escapeHtml(SUBJECTS[s].name) + '</div></th>').join('') +
          '<th style="min-width:90px">Průměr</th><th style="min-width:120px">Stav</th></tr></thead><tbody>' +
          sts.map(st => {
            const chk = rep.checked[st.id] || {};
            const sum = sumFor(st.id);
            const cnt = Object.values(chk).filter(v => v !== '' && v !== null && v !== undefined).length;
            const subCnt = subs.length;
            const dec = pending ? 0 : 0;
            const stSubjCnt = subs.filter(s => semesterAvgOf(st.id, s, sem).avg !== null).length;
            return '<tr>' +
              '<td style="position:sticky;left:0;background:var(--surface);z-index:1"><div style="display:flex;align-items:center;gap:8px">' + teacherAva(st, 28) + '<b>' + escapeHtml(st.last + ' ' + st.first) + '</b></div></td>' +
              subs.map(s => '<td style="text-align:center;vertical-align:middle"><div style="display:inline-flex;flex-direction:column;gap:3px;align-items:center">' +
                gradeOpts(st.id, s, cellVal(st.id, s)) +
                '<span style="font-size:10.5px;color:var(--muted)">' + (subjTitle(s, st.id).avg !== null ? 'Ø ' + subjTitle(s, st.id).avg.toFixed(2) : 'bez známek') + '</span></div></td>').join('') +
              '<td class="num" style="color:' + avgColor(sum.avg) + ';font-weight:900">' + avgTxt(sum.avg) + (sum.n ? '' : '') + '</td>' +
              '<td>' + (stSubjCnt === 0 ? '<span class="chip">bez známek</span>' : cnt >= stSubjCnt ? '<span class="chip chip-ok">hotovo</span>' : '<span class="chip chip-warn">' + cnt + '/' + stSubjCnt + '</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
        (closed
          ? '<div class="small-note" style="margin-top:10px">Vysvědčení je uzavřené – žáci a rodiče vidí výsledek. Znovuotevřením se vrátí do návrhu a změny se projeví po novém uzavření.</div>'
          : '<div class="small-note" style="margin-top:10px">„Ø“ = průměr známek daného pololetí (vážený). Po uzavření uvidí výsledek žák i rodič.</div>') +
      '</div>'
    : '<div class="card"><div class="empty">' + (!sts.length ? '<b>Ve třídě zatím nejsou žáci</b>' : '<b>Třída zatím nemá předměty se známkami</b>Zapište nejdřív známky v Známkování (nebo nastavte rozvrh).') + '</div></div>') +
  '<div class="small-note" style="margin-top:10px">Návrh z průměru: 1,00–1,45 → 1 · 1,45–1,55 rozhoduje učitel · 1,55–2,45 → 2 · 2,45–2,55 rozhoduje učitel · 2,55–3,45 → 3 · 3,45–3,55 rozhoduje učitel · 3,55–4,45 → 4 · 4,45–4,55 rozhoduje učitel · 4,55–5,00 → 5.</div>';
}
onAct('kls-sem:', el => { KLS.sem = Number(el.getAttribute('data-act').slice(8)); route(); });
onAct('kls-auto', () => { reportAutoFill(activeClsId(), KLS.sem); toast('Navržené známky doplněny – hraniční pásma zůstala k vašemu rozhodnutí', 'ok'); route(); });
/* změna známky v tabulce: uložit a překreslit */
document.addEventListener('change', e => {
  const sel = e.target.closest('.kls-g');
  if (!sel) return;
  const r = classReport(activeClsId(), KLS.sem);
  const m = r.checked[sel.dataset.sid] || (r.checked[sel.dataset.sid] = {});
  m[sel.dataset.sub] = sel.value;
  saveDB();
  route();
});
onAct('kls-close', () => {
  const cid = activeClsId();
  const sem = KLS.sem;
  const r = classReport(cid, sem);
  const pending = reportPendingCount(cid, sem);
  if (pending) {
    toast('Nejdřív rozhodněte ' + pending + ' hraničních případů (žlutá políčka)', 'bad');
    return;
  }
  r.closed = true;
  r.closedAt = todayISO();
  saveDB();
  (db.users || []).forEach(u => {
    if (u.role !== 'student' && u.role !== 'rodic') return;
    const s = u.role === 'student' ? studentOf(u.studentId) : null;
    const rel = u.role === 'student' ? !!(s && s.cls === cid) : (u.children || []).some(id => { const k = studentOf(id); return k && k.cls === cid; });
    if (!rel) return;
    db.notifs.push({ userId: u.id, type: 'grade', text: 'Vysvědčení za ' + semLabel(sem) + ' je připravené k nahlédnutí', ts: nowISO(), route: 'pololetka' });
  });
  saveDB();
  toast('Pololetí uzavřeno – žáci a rodiče vidí vysvědčení ✓', 'ok');
  route();
});
onAct('kls-open', () => {
  const r = classReport(activeClsId(), KLS.sem);
  r.closed = false;
  r.closedAt = null;
  saveDB();
  toast('Vysvědčení otevřeno k opravě – žáci ho zase nevidí', 'warn');
  route();
});

/* ================= TŘÍDNÍ KNIHA ================= */
function tKniha() {
  clearTick();
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const cls = classOf(cid);
  const date = localStorage.getItem('t_cb_date') || todayOrLastSchoolDay();
  const period = Number(localStorage.getItem('t_cb_period') || '0');
  const subjAuto = subjOf(cid, date, period);
  const existing = (db.classbook || []).find(c => c.date === date && c.period === period && c.cls === cid);
  const recs = (db.classbook || []).filter(r => r.cls === cid).slice().sort((a, b) => (a.date + a.period < b.date + b.period ? 1 : -1)).slice(0, 10);

  const secZapsat =
    '<div class="card">' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
        '<input type="date" class="txt" value="' + date + '" data-chg="t-cb-date" style="width:160px">' +
        '<select class="sel" data-chg="t-cb-period" style="min-width:160px">' +
          scheduleSlots(cid).map((sl, i) => '<option value="' + i + '"' + (i === period ? ' selected' : '') + '>' + (i + 1) + '. hod. (' + sl.s + '–' + sl.e + ')' + (subjOf(cid, date, i) ? '' : ' · volno') + '</option>').join('') +
        '</select>' +
      '</div>' +
      (existing ? '<div class="ok-line">' + ic('check', 15) + ' <span>Tento zápis už existuje – upravujete ho.</span></div>' : '') +
      '<div class="field"><label>Téma hodiny</label><input class="txt" id="cb-tema" value="' + escapeHtml((existing && existing.tema) || (SVP_TOPICS[subjAuto] || DEFAULT_TOPICS)[0]) + '"></div>' +
      '<div class="field"><label>Probrané učivo</label><textarea class="ta" id="cb-ucivo" rows="2">' + escapeHtml((existing && existing.ucivo) || '') + '</textarea></div>' +
      '<div class="field"><label>Domácí úkol (propíše se do účtů žáků)</label><input class="txt" id="cb-ukol" value="' + escapeHtml((existing && existing.ukol) || '') + '" placeholder="Např. PS str. 42, cvičení 3"></div>' +
      '<button class="btn btn-primary" style="margin-top:8px" data-act="t-cb-save">' + ic('check', 16) + ' Uložit zápis</button>' +
    '</div>';
  const secZapisy =
    '<div class="card"><div class="card-title">' + ic('clipboard', 16) + ' Poslední zápisy (' + escapeHtml(cls.name) + ')</div>' +
      (recs.length ? '<div class="list">' + recs.map(r =>
        '<div class="list-row" style="cursor:pointer" data-act="t-cb-load:' + r.date + ':' + r.period + '">' +
        '<div class="grow"><div class="row-title">' + fmtDate(r.date) + ' · ' + (r.period + 1) + '. hod. · ' + escapeHtml(r.tema) + '</div>' +
        '<div class="row-sub">' + escapeHtml(r.ucivo || '') + (r.ukol ? ' · úkol: ' + escapeHtml(r.ukol) : '') + '</div></div></div>'
      ).join('') + '</div>' : '<div class="empty">Zatím žádné zápisy</div>') +
    '</div>';
  const head = '' +
    '<div class="page-head"><div><h1>Třídní kniha</h1><div class="sub">Téma z ŠVP · úkol se propíše žákům do „Moje úkoly“</div></div></div>' +
    clsScopePills();
  if (isAppMode()) {
    const tabs = [{ k: 'zap', label: 'Zapsat hodinu' }, { k: 'zapisy', label: 'Poslední zápisy' }, { k: 'doch', label: 'Docházka hodiny' }];
    const t = viewTab('kniha', tabs);
    const secs = { zap: secZapsat, zapisy: secZapisy, doch: cbAttendanceCard(cid, date, period, subjAuto) };
    return head + tabbarHtml('kniha', tabs, t) + secs[t];
  }
  return head + '<div class="grid grid-2">' + secZapsat + secZapisy + '</div>' + cbAttendanceCard(cid, date, period, subjAuto);
}
onAct('t-cb-date', el => { cbDropPend(); localStorage.setItem('t_cb_date', el.value); route(); });
onAct('t-cb-period', el => { cbDropPend(); localStorage.setItem('t_cb_period', el.value); route(); });
onAct('t-cb-load:', el => {
  const [, date, period] = el.getAttribute('data-act').split(':');
  cbDropPend();
  localStorage.setItem('t_cb_date', date);
  localStorage.setItem('t_cb_period', period);
  route();
});
onAct('t-cb-save', () => {
  const cid = activeClsId();
  const date = localStorage.getItem('t_cb_date') || todayOrLastSchoolDay();
  const period = Number(localStorage.getItem('t_cb_period') || '0');
  const subjAuto = subjOf(cid, date, period);
  const tema = document.getElementById('cb-tema').value.trim();
  const ucivo = document.getElementById('cb-ucivo').value.trim();
  const ukol = document.getElementById('cb-ukol').value.trim();
  if (!tema && !ucivo) { toast('Vyplňte alespoň téma hodiny', 'warn'); return; }
  let rec = (db.classbook || []).find(c => c.date === date && c.period === period && c.cls === cid);
  if (rec) { rec.tema = tema; rec.ucivo = ucivo; rec.ukol = ukol; }
  else {
    rec = { id: uid(), date, cls: cid, period, subj: subjAuto, tema, ucivo, ukol, savedAt: nowISO() };
    db.classbook.push(rec);
  }
  if (ukol && subjAuto) { // úkol jen pro hodinu, která v rozvrhu opravdu je
    const tk = addTask(cid, subjAuto, ukol, nextSchoolDayISO(todayISO(), 0), 'z třídní knihy', null, currentUser().id);
    notifyTask(tk);
  }
  /* docházka: stavy z ikonek u žáků se uloží spolu se zápisem */
  const pend = cbPendFor(date, period);
  const pKeys = Object.keys(pend);
  if (pKeys.length) {
    pKeys.forEach(sid => {
      const tok = pend[sid];
      if (tok === '/') { if (rec.statuses) delete rec.statuses[sid]; }
      else { rec.statuses = rec.statuses || {}; rec.statuses[sid] = tok; }
    });
    delete CB_PEND[date + '|' + period];
  }
  saveDB();
  toast('Zápis uložen ✓', 'ok');
  route();
});

/* ---------- docházka v třídní knize: ikonky ✓ / ✗ / D + auto štítek omluvení ---------- */
const CB_PEND = {}; // 'datum|hodina' -> {sid: token} – ještě neuložené stavy
function cbPendFor(date, period) {
  const k = date + '|' + period;
  return CB_PEND[k] || (CB_PEND[k] = {});
}
function cbDropPend() { Object.keys(CB_PEND).forEach(k => delete CB_PEND[k]); }
const ATT_TXT = {
  '/': ['nezadáno', 'var(--muted)'],
  P: ['přítomen', 'var(--ok)'],
  X: ['nepřítomen', 'var(--bad)'],
  D: ['dočasně – byl jen chvíli', 'var(--warn)']
};
/* zapsaný token účasti (✓/✗/D nebo „/“) – ne odvozený štítek omluvení */
function cbEffStatus(sid, date, period) {
  const pend = CB_PEND[date + '|' + period];
  if (pend && pend.hasOwnProperty(sid)) return pend[sid];
  const st = studentOf(sid);
  const rec = st ? cbRecOf(st.cls, date, period) : null;
  return (rec && rec.statuses && rec.statuses[sid]) || '/';
}
function cbAttendanceCard(cid, date, period, subjAuto) {
  const sts = studentsOfClass(cid);
  if (!sts.length) return '';
  return '<div class="card" style="margin-top:16px">' +
    '<div class="card-title">' + ic('calendar', 16) + ' Docházka této hodiny' +
      '<span style="margin-left:auto;display:flex;gap:8px;align-items:center">' +
        '<span class="small-note" style="margin:0;font-weight:600">' + fmtDateLong(date) + ' · ' + (period + 1) + '. hod.' + (subjAuto ? ' · ' + SUBJECTS[subjAuto].name : '') + '</span>' +
        '<button class="btn btn-soft btn-sm" data-act="cb-all-pres">' + ic('check', 14) + ' Všichni přítomni</button>' +
      '</span></div>' +
    atLegend() +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th style="min-width:170px">Žák</th>' +
      '<th style="min-width:190px">Účast – klepnutím nastavíte</th>' +
      '<th>Význam</th>' +
      '<th style="text-align:right;min-width:150px">Omluveno? <span class="small-note" style="margin:0;font-weight:500">(auto · jen učitel)</span></th>' +
    '</tr></thead><tbody>' +
    sts.map(s => {
      const e = cbEffStatus(s.id, date, period);
      const [txt, col] = ATT_TXT[e] || ATT_TXT['/'];
      const mark = absenceMark(s.id, date, period);
      const [mTxt, mCls] = (mark && ATT_MARK[mark]) || [null, null];
      return '<tr>' +
        '<td><div style="display:flex;align-items:center;gap:10px">' + teacherAva(s, 30) +
          '<b>' + escapeHtml(s.first + ' ' + s.last) + '</b>' + (s.ivp ? ' <span class="chip chip-info" style="padding:0 6px;font-size:10px">IVP</span>' : '') + '</div></td>' +
        '<td><div class="at-set">' + ATT_ICONS.map(([tok, tip]) => {
          const clsTok = { P: 'p', X: 'x', D: 'd' }[tok] || 'p';
          return '<button type="button" class="at-btn ' + clsTok + (e === tok ? ' on' : '') + '" data-act="cb-att:' + s.id + ':' + tok + '" title="' + tip + '">' + ATT_GLYPH[tok] + '</button>';
        }).join('') + '</div></td>' +
        '<td><span class="att-txt" style="color:' + col + '">' + txt + '</span></td>' +
        '<td style="text-align:right">' + (mark
          ? (mark === 'N'
              ? '<span class="chip chip-bad" style="font-size:11px" title="Nemá omluvenku, přesto má být ve škole">✗ neomluveno</span>'
              : '<span class="chip chip-ok" style="font-size:11px" title="' + (mark === 'A' ? 'Rodic dítě omluvil (schválená omluvenka)' : 'Omluvenka od rodiče čeká na schválení') + '">✓ omluveno</span>')
          : '<span style="color:var(--muted);font-size:12px">—</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="small-note" style="margin-top:10px">Fajfka <b style="color:var(--ok)">✓</b> = rodič dítě omluvil (podle omluvenky, i když ještě čeká na schválení), křížek <b style="color:var(--bad)">✗</b> = omluvenka chybí, přestože má být ve škole. Klepnutím na aktivní ikonku (✓ / ✗ / D) zápis zrušíte.</div>' +
  '</div>';
}
onAct('cb-att:', el => {
  const cid = activeClsId();
  if (!cid) return;
  const date = localStorage.getItem('t_cb_date') || todayOrLastSchoolDay();
  const period = Number(localStorage.getItem('t_cb_period') || '0');
  const parts = el.getAttribute('data-act').split(':');
  const sid = parts[1];
  const tok = parts[2];
  const pend = cbPendFor(date, period);
  const cur = cbEffStatus(sid, date, period);
  const want = cur === tok ? '/' : tok;
  const rec = cbRecOf(cid, date, period);
  const label = ATT_CS[want] || 'Nezadáno';
  if (rec) {
    /* záznam už existuje → uložíme rovnou */
    if (want === '/') { if (rec.statuses) delete rec.statuses[sid]; }
    else { rec.statuses = rec.statuses || {}; rec.statuses[sid] = want; }
    delete pend[sid];
    saveDB();
    toast(label + ' – uloženo ✓', want === 'X' ? 'bad' : want === 'D' ? 'warn' : 'ok');
  } else {
    /* nový zápis → stav se uloží tlačítkem „Uložit zápis“ */
    pend[sid] = want;
    toast('Označeno „' + label + '“ – potvrďte tlačítkem Uložit zápis', want === 'X' ? 'bad' : want === 'D' ? 'warn' : 'ok');
  }
  route();
});
onAct('cb-all-pres', () => {
  const cid = activeClsId();
  if (!cid) return;
  const date = localStorage.getItem('t_cb_date') || todayOrLastSchoolDay();
  const period = Number(localStorage.getItem('t_cb_period') || '0');
  const pend = cbPendFor(date, period);
  const rec = cbRecOf(cid, date, period);
  let changed = false;
  studentsOfClass(cid).forEach(s => {
    const cur = cbEffStatus(s.id, date, period);
    if (cur === 'P') return;
    changed = true;
    if (rec) { rec.statuses = rec.statuses || {}; rec.statuses[s.id] = 'P'; delete pend[s.id]; }
    else pend[s.id] = 'P';
  });
  if (rec) saveDB();
  if (changed) { toast('Všichni žáci označeni jako přítomní ✓', 'ok'); route(); }
  else toast('Všichni už jsou přítomní', 'warn');
});

/* ================= ZPRÁVY (rodiče i žáci) =================
   Výběr příjemců ve 2 krocích:
   1) Komu: Rodiče | Žáci | Všichni (rodiče i žáci)
   2) Rozsah: celé třídě | konkrétnímu (rodiči / žákovi)
   Vlákna: thread.recipientType = 'rodic' | 'student';
   thread.parent = id uživatele-rodiče (jen u rodičů).
*/
let TMSG = { who: 'rodic', mode: 'class', thread: null };
/* možní příjemci ve třídě: rodiče (každé dítě zvlášť) a žáci (účty žáků) */
function msgRecipients(cid, who) {
  const kids = studentsOfClass(cid);
  const out = [];
  if (who === 'rodic' || who === 'vse') {
    kids.forEach(s => {
      (db.users || []).forEach(pu => {
        if (pu.role === 'rodic' && (pu.children || []).includes(s.id)) out.push({ type: 'rodic', userId: pu.id, childId: s.id, label: pu.name + ' · ' + studentFull(s.id) });
      });
    });
  }
  if (who === 'student' || who === 'vse') {
    kids.forEach(s => {
      const acc = (db.users || []).find(u2 => u2.role === 'student' && u2.studentId === s.id);
      if (acc) out.push({ type: 'student', userId: acc.id, childId: s.id, label: studentFull(s.id) + ' (žák)' });
    });
  }
  return out;
}
function threadOpen(t) { return (t.status || 'open') === 'open'; }
function threadFor(childId, type, parentId) {
  const pool = Object.values(db.threads || {});
  /* najdeme jen OTEVŘENÉ vlákno – do uzavřeného se nepíše, nová zpráva zakládá nové */
  let th = pool.find(t => t.childId === childId && (t.recipientType || 'rodic') === type && threadOpen(t) && (type === 'rodic' ? t.parent === parentId : true));
  if (!th) {
    th = { id: uid(), childId, recipientType: type, parent: type === 'rodic' ? parentId : null, teacherId: null, subject: '', taskId: null, taskTitle: null, status: 'open', createdAt: nowISO(), msgs: [] };
    db.threads[th.id] = th;
  }
  return th;
}
/* vlákno podle předmětu (tematická konverzace) – najde otevřené, jinak založí nové */
function threadForSubject(childId, type, parentId, subject) {
  const subj = String(subject || '').trim();
  const pool = Object.values(db.threads || {});
  let th = pool.find(t => t.childId === childId && (t.recipientType || 'rodic') === type && threadOpen(t)
    && (type === 'rodic' ? t.parent === parentId : true)
    && String(t.subject || '').trim().toLowerCase() === subj.toLowerCase());
  if (!th) {
    th = { id: uid(), childId, recipientType: type, parent: type === 'rodic' ? parentId : null, teacherId: null, subject: subj, taskId: null, taskTitle: null, status: 'open', createdAt: nowISO(), msgs: [] };
    db.threads[th.id] = th;
  }
  return th;
}
function tZpravy() {
  clearTick();
  flushScheduled();
  if (!myClasses().length) return noClassPrompt();
  const u = currentUser();
  const cid = activeClsId();
  const kidsInClass = studentsOfClass(cid).map(s => s.id);
  /* pokud se vybraná konverzace netýká aktuální třídy, zahoď výběr */
  const selTh = TMSG.thread ? Object.values(db.threads || {}).find(t => t.id === TMSG.thread) : null;
  if (!selTh || !kidsInClass.includes(selTh.childId)) TMSG.thread = null;
  /* konverzace třídy (rodičovské i žákovské vlákna), seřazené podle poslední zprávy */
  const convs = Object.values(db.threads || {})
    .filter(t => kidsInClass.includes(t.childId))
    .sort((a, b) => {
      const la = a.msgs.length ? a.msgs[a.msgs.length - 1].ts : '';
      const lb = b.msgs.length ? b.msgs[b.msgs.length - 1].ts : '';
      return la < lb ? 1 : -1;
    });
  if (convs.length && !convs.some(t => t.id === TMSG.thread)) TMSG.thread = convs[0].id;
  const curThread = convs.find(t => t.id === TMSG.thread) || null;
  if (curThread) {
    let ch = false;
    curThread.msgs.forEach(m => { if (m.from !== u.id && !m.readAt) { m.readAt = nowISO(); ch = true; } });
    if (ch) saveDB();
  }
  const whoBtns = [
    { k: 'rodic', label: 'Rodiče' },
    { k: 'student', label: 'Žáci' },
    { k: 'vse', label: 'Všichni' }
  ];
  const scopeBtns = [
    { k: 'class', label: TMSG.who === 'vse' ? 'Všem ze třídy' : (TMSG.who === 'rodic' ? 'Rodičům třídy' : 'Žákům třídy') },
    { k: 'one', label: TMSG.who === 'rodic' ? 'Konkrétnímu rodiči' : (TMSG.who === 'student' ? 'Konkrétnímu žákovi' : 'Konkrétnímu příjemci') }
  ];
  const rcps = msgRecipients(cid, TMSG.who);
  const head = '' +
  '<div class="page-head"><div><h1>Zprávy</h1><div class="sub">Napište rodičům i žákům – hromadně nebo jednotlivě, s potvrzením o přečtení</div></div></div>' +
  clsScopePills();
  const secNova =
    '<div class="card">' +
      '<div class="card-title">' + ic('send', 16) + ' Nová zpráva</div>' +
      '<div class="field"><label>Komu chcete psát?</label>' +
        '<div class="rcpt-row" style="margin-top:2px">' + whoBtns.map(b =>
          '<button class="rcpt-pill' + (TMSG.who === b.k ? ' active' : '') + '" data-act="t-msg-who:' + b.k + '">' +
          ic(b.k === 'rodic' ? 'users' : b.k === 'student' ? 'book' : 'zap', 14) + ' ' + b.label + '</button>').join('') + '</div></div>' +
      '<div class="field"><label>Rozsah</label>' +
        '<div class="rcpt-row" style="margin-top:2px">' + scopeBtns.map(b =>
          '<button class="rcpt-pill' + (TMSG.mode === b.k ? ' active' : '') + '" data-act="t-msg-scope:' + b.k + '">' + b.label + '</button>').join('') + '</div></div>' +
      (TMSG.mode === 'one'
        ? '<div class="field"><label>' + (TMSG.who === 'rodic' ? 'Rodič' : TMSG.who === 'student' ? 'Žák' : 'Příjemce') + '</label><select class="sel" data-chg="t-msg-one">' +
            rcps.map(r => {
              const th = threadFor(r.childId, r.type, r.type === 'rodic' ? r.userId : null);
              return '<option value="' + th.id + '"' + (curThread && th.id === curThread.id ? ' selected' : '') + '>' + escapeHtml(r.label) + '</option>';
            }).join('') +
          '</select></div>'
        : '') +
      '<div class="field"><label>Předmět konverzace <span class="small-note" style="margin:0 0 0 4px">(volitelné – vytvoří samostatnou konverzaci s tímto předmětem)</span></label><input id="tmsg-subj" placeholder="Např. Konzultace, dotaz k písemce…"></div>' +
      '<div class="field"><label>Text zprávy</label><textarea class="ta" id="tmsg-text" rows="4" placeholder="' + (TMSG.who === 'student' ? 'Ahoj, … (žákovi)' : 'Dobrý den, …') + '"></textarea></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" data-act="t-msg-send">' + ic('send', 15) + ' Odeslat nyní' +
          (TMSG.mode === 'class' ? ' (' + rcps.length + (rcps.length === 1 ? ' příjemce' : ' příjemců') + ')' : '') + '</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="t-msg-later">' + ic('clock', 14) + ' Naplánovat na 8:00</button>' +
      '</div>' +
    '</div>';
  const secKonv =
    '<div class="card"><div class="card-title">' + ic('chat', 16) + ' Konverzace (' + escapeHtml(classOf(cid).name) + ')' +
      '<span style="margin-left:auto;font-size:11.5px;color:var(--muted);font-weight:700">' + convs.length + '</span></div>' +
      (convs.length
        ? '<div style="display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto;margin-bottom:12px">' + convs.map(t => {
            const last = t.msgs.length ? t.msgs[t.msgs.length - 1] : null;
            const isParent = (t.recipientType || 'rodic') === 'rodic';
            const closed = !threadOpen(t);
            const un = threadUnreadFor(t, u.id);
            const whoName = isParent
              ? (db.users.find(x => x.id === t.parent) || {}).name
              : (db.users.find(x2 => x2.role === 'student' && x2.studentId === t.childId) || {}).name;
            const kidName = studentFull(t.childId);
            const title = t.subject || (t.taskTitle ? 'Úkol: ' + t.taskTitle : kidName);
            /* jméno rodičovského účtu už někdy obsahuje jméno dítěte – neopakovat */
            const hasKid = !!(whoName && kidName && whoName.toLowerCase().indexOf(kidName.toLowerCase()) >= 0);
            const subTxt = isParent
              ? ((whoName ? whoName : 'Rodič') + (t.subject && !hasKid ? ' · ' + kidName : ''))
              : ((whoName || kidName) + ' (žák)');
            const openBtn = '<button class="list-row" style="flex:1;min-width:0;text-align:left;cursor:pointer;opacity:' + (closed ? 0.62 : 1) + ';border-color:' + (curThread && t.id === curThread.id ? 'var(--accent)' : '') + '" data-act="t-msg-open:' + t.id + '">' +
              '<span class="ava" style="width:34px;height:34px;font-size:13px;flex:0 0 auto">' + escapeHtml(((whoName || kidName || '?').charAt(0))) + '</span>' +
              '<div class="grow" style="min-width:0">' +
                '<div class="row-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(title) +
                  (closed ? ' <span class="chip chip-bad" style="padding:0 6px;font-size:9.5px">uzavřeno</span>' : '') + '</div>' +
                '<div class="row-sub" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(subTxt) + (t.taskId ? ' · <span style="color:var(--warn)">úkol</span>' : '') + '</div>' +
              '</div>' +
              '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex:0 0 auto">' + unreadDot(un) +
                '<div style="font-size:10.5px;color:var(--muted);white-space:nowrap">' + (last ? tsLabel(last.ts) : '') + '</div></div></button>';
            return '<div style="display:flex;gap:6px;align-items:center">' + openBtn +
              '<button class="icon-btn sm" data-act="t-msg-close:' + t.id + '" title="' + (closed ? 'Znovu otevřít konverzaci' : 'Uzavřít konverzaci (křížek)') + '" style="color:' + (closed ? 'var(--ok)' : 'var(--bad)') + ';flex:0 0 auto">' + ic('x', 15) + '</button>' +
              (closed ? '<button class="icon-btn sm" data-act="t-msg-del:' + t.id + '" title="Trvale odstranit konverzaci ze seznamu" style="color:var(--bad);flex:0 0 auto">' + ic('trash', 15) + '</button>' : '') +
            '</div>';
          }).join('') + '</div>'
        : '<div class="empty"><b>Zatím žádné konverzace</b>Pošlete první zprávu rodiči nebo žákovi – žák si může konverzaci založit i sám (třeba u úkolu).</div>') +
      (curThread
        ? (function () {
            const isStudent = (curThread.recipientType || 'rodic') === 'student';
            const ctWho = isStudent
              ? ((db.users.find(x => x.role === 'student' && x.studentId === curThread.childId) || {}).name || '') + ' (žák)'
              : ((db.users.find(x => x.id === curThread.parent) || {}).name || 'Rodič') + ' · ' + studentFull(curThread.childId);
            const ctTitle = curThread.subject || (curThread.taskTitle ? 'Úkol: ' + curThread.taskTitle : ctWho);
            const ctClosed = !threadOpen(curThread);
            const ctTeach = curThread.teacherId ? ((db.users.find(x => x.id === curThread.teacherId) || {}).name || '') : '';
            return '<div class="card-title" style="margin-bottom:8px">' + ic('chat', 16) + ' Rozhovor: ' + escapeHtml(ctTitle) +
              (curThread.taskId ? ' <span class="chip chip-warn" style="padding:0 7px;font-size:10px">úkol</span>' : '') +
              (ctClosed ? ' <span class="chip chip-bad" style="padding:0 7px;font-size:10px">uzavřeno</span>' : '') +
              (ctTeach ? '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">pro: ' + escapeHtml(ctTeach) + '</span>' : '') + '</div>';
          })() +
          '<div class="thread" style="max-height:220px;overflow:auto">' + curThread.msgs.map(m => {
            const me = m.from === u.id;
            const fromName = me ? 'vy' : ((db.users.find(x => x.id === m.from) || {}).name || '—');
            return '<div class="msg ' + (me ? 'me' : 'them') + '">' + escapeHtml(m.text) +
              '<div class="meta">' + escapeHtml(fromName) + ' · ' + fmtTime(m.ts) + (me ? ' <span class="read-tick">' + (m.readAt ? '✓✓ přečteno ' + fmtTime(m.readAt) : '✓ doručeno') + '</span>' : '') + '</div></div>';
          }).join('') + '</div>' +
          (threadOpen(curThread)
            ? '<form data-form="t-reply" style="margin-top:10px"><div class="compose">' +
              '<textarea name="text" rows="1" placeholder="Odpovědět…" required style="min-height:44px"></textarea>' +
              '<button class="btn btn-primary">' + ic('send', 16) + '</button></div></form>'
            : '<div class="warn-line" style="margin-top:12px">' + ic('lock', 15) + ' <span>Konverzaci jste uzavřeli – křížkem (✗) ji můžete znovu otevřít.</span></div>')
        : '') +
    '</div>';
  if (isAppMode()) {
    const tabs = [{ k: 'konv', label: 'Konverzace (' + convs.length + ')' }, { k: 'nova', label: 'Nová zpráva' }];
    const t = viewTab('zpravy', tabs);
    return head + tabbarHtml('zpravy', tabs, t) + (t === 'nova' ? secNova : secKonv);
  }
  return head + '<div class="grid grid-2">' + secNova + secKonv + '</div>';
}
onAct('t-msg-who:', el => { TMSG.who = el.getAttribute('data-act').slice(10); TMSG.thread = null; route(); });
onAct('t-msg-scope:', el => { TMSG.mode = el.getAttribute('data-act').slice(12); route(); });
onAct('t-msg-one', el => { TMSG.thread = el.value; route(); });
onAct('t-msg-open:', el => {
  const th = Object.values(db.threads || {}).find(t => t.id === el.getAttribute('data-act').slice(11));
  if (!th) return;
  /* rozhovor se otevře i v kompozéru (Rodiče/Žáci + konkrétní příjemce) */
  TMSG.thread = th.id;
  TMSG.who = (th.recipientType || 'rodic') === 'student' ? 'student' : 'rodic';
  TMSG.mode = 'one';
  route();
});
onAct('t-msg-close:', el => {
  const th = Object.values(db.threads || {}).find(t => t.id === el.getAttribute('data-act').slice(12));
  if (!th) return;
  if (threadOpen(th)) {
    th.status = 'closed';
    th.closedAt = nowISO();
    saveDB();
    toast('Konverzace uzavřena – košem ji můžete trvale odstranit ze seznamu', 'warn');
  } else {
    th.status = 'open';
    saveDB();
    toast('Konverzace znovu otevřena ✓', 'ok');
  }
  route();
});
onAct('t-msg-del:', el => {
  const id = el.getAttribute('data-act').slice(10);
  const th = Object.values(db.threads || {}).find(t => t.id === id);
  if (!th) return;
  const title = th.subject || (th.taskTitle ? 'Úkol: ' + th.taskTitle : studentFull(th.childId));
  openModal('<h3>Trvale odstranit konverzaci?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Konverzace <b>„' + escapeHtml(title) + '“</b> i se všemi zprávami se nenávratně smaže – zmizí vám i protistraně ze seznamu.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="t-msg-del-ok:' + id + '">' + ic('trash', 14) + ' Ano, odstranit</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('t-msg-del-ok:', el => {
  const id = el.getAttribute('data-act').slice(13);
  delete db.threads[id];
  if (TMSG.thread === id) TMSG.thread = null;
  saveDB();
  closeModal();
  toast('Konverzace trvale odstraněna', 'bad');
  route();
});
function sendTeacherMsg(text, who, mode, subject) {
  const u = currentUser();
  const cid = activeClsId();
  let targets = [];
  const whoAll = who === 'vse' ? ['rodic', 'student'] : [who];
  if (mode === 'one') {
    let th = Object.values(db.threads || {}).find(t => t.id === TMSG.thread);
    if (!th) { toast('Nejdřív vyberte příjemce', 'warn'); return; }
    const subj = String(subject || '').trim();
    if (subj) th = threadForSubject(th.childId, th.recipientType || 'rodic', th.recipientType === 'rodic' ? th.parent : null, subj);
    if (!threadOpen(th)) { toast('Tato konverzace je uzavřená – napište jiný předmět nebo ji otevřete křížkem', 'warn'); return; }
    const st = studentOf(th.childId);
    const recipUser = th.recipientType === 'student'
      ? (db.users || []).find(x2 => x2.role === 'student' && x2.studentId === th.childId)
      : (db.users || []).find(x2 => x2.id === th.parent);
    targets.push({ th, recipUser, st });
  } else {
    whoAll.forEach(type => {
      msgRecipients(cid, type).forEach(r => {
        const subj = String(subject || '').trim();
        const th = subj ? threadForSubject(r.childId, r.type, r.type === 'rodic' ? r.userId : null, subj) : threadFor(r.childId, r.type, r.type === 'rodic' ? r.userId : null);
        targets.push({ th, recipUser: db.users.find(x => x.id === r.userId), st: studentOf(r.childId) });
      });
    });
  }
  const seen = new Set();
  targets = targets.filter(t => { if (seen.has(t.th.id)) return false; seen.add(t.th.id); return true; });
  if (!targets.length) { toast('Nenašel se žádný příjemce – propojte rodiče se žákem ve Správě', 'warn'); return; }
  targets.forEach(({ th, recipUser, st }) => {
    th.msgs.push({ id: uid(), from: u.id, text, ts: nowISO(), readAt: null });
    if (recipUser) db.notifs.push({ userId: recipUser.id, type: 'msg', text: 'Nová zpráva od učitele' + (st ? ' (' + st.first + ')' : ''), ts: nowISO(), route: 'zpravy' });
  });
  saveDB();
  toast('Zpráva odeslána ' + targets.length + ' ' + csPlural(targets.length, 'příjemci', 'příjemcům', 'příjemcům') + ' ✓', 'ok');
}
onAct('t-msg-send', () => {
  const ta = document.getElementById('tmsg-text');
  if (!ta || !ta.value.trim()) { toast('Napište text zprávy', 'warn'); return; }
  const sub = document.getElementById('tmsg-subj');
  sendTeacherMsg(ta.value.trim(), TMSG.who, TMSG.mode, sub ? sub.value : '');
  route();
});
onAct('t-msg-later', () => {
  const ta = document.getElementById('tmsg-text');
  if (!ta || !ta.value.trim()) { toast('Napište text zprávy', 'warn'); return; }
  const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(8, 0, 0, 0);
  db.scheduledMsgs = db.scheduledMsgs || [];
  const sub = document.getElementById('tmsg-subj');
  db.scheduledMsgs.push({ id: uid(), text: ta.value.trim(), who: TMSG.who, mode: TMSG.mode, subj: sub ? sub.value : '', sendAt: t.toISOString() });
  saveDB();
  ta.value = '';
  toast('Naplánováno na zítra 8:00 ✓', 'ok');
});
onAct('form:t-reply', f => {
  const text = String(new FormData(f).get('text')).trim();
  if (!text) return;
  const th = Object.values(db.threads || {}).find(t => t.id === TMSG.thread);
  if (!th) return;
  if (!threadOpen(th)) { toast('Konverzace je uzavřená – nejdřív ji otevřete křížkem', 'warn'); return; }
  const u = currentUser();
  th.msgs.push({ id: uid(), from: u.id, text, ts: nowISO(), readAt: null });
  const recipUser = (th.recipientType || 'rodic') === 'student'
    ? (db.users || []).find(x => x.role === 'student' && x.studentId === th.childId)
    : (db.users || []).find(x => x.id === th.parent);
  if (recipUser) db.notifs.push({ userId: recipUser.id, type: 'msg', text: 'Nová zpráva od učitele', ts: nowISO(), route: 'zpravy' });
  saveDB();
  toast('Odpověď odeslána ✓', 'ok');
  route();
});

/* ================= OMLUVENKY ================= */
function tOmluvenky() {
  clearTick();
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const kids = studentsOfClass(cid).map(s => s.id);
  const pending = (db.excuses || []).filter(x => kids.includes(x.childId) && (x.status === 'ceka' || x.status === 'doplnit'));
  const history = (db.excuses || []).filter(x => kids.includes(x.childId) && x.status !== 'ceka' && x.status !== 'doplnit')
    .sort((a, b) => a.submitted < b.submitted ? 1 : -1);
  const absRows = studentsOfClass(cid)
    .map(s => ({ s, ov: absenceOverview(s.id) }))
    .filter(r => r.ov.total.missing > 0);
  return '' +
  '<div class="page-head"><div><h1>Schvalování omluvenek</h1><div class="sub">Schválit / zamítnout jedním kliknutím · zamítnutí počítá neomluvenou hodinu</div></div></div>' +
  clsScopePills() +
  '<div class="grid grid-2">' +
    '<div class="card"><div class="card-title" style="color:var(--warn)">' + ic('shield', 17) + ' Čekají na rozhodnutí (' + pending.length + ')</div>' +
      (pending.length ? '<div class="list">' + pending.map(x => {
        const st = studentOf(x.childId);
        return '<div class="list-row">' + teacherAva(st, 36) +
          '<div class="grow"><div class="row-title">' + escapeHtml(st.first + ' ' + st.last) + '</div>' +
          '<div class="row-sub"><b>' + fmtDate(x.date) + '</b> · ' + escapeHtml(excuseHoursLabel(st.cls, x.date, x.periods) || 'celý den') + (x.reason ? ' · ' + escapeHtml(x.reason) : '') + (x.note ? ' · „' + escapeHtml(x.note) + '“' : '') +
          '<div style="font-size:11px;color:var(--muted)">odesláno ' + tsLabel(x.submitted) + (x.status === 'doplnit' ? ' · <span style="color:var(--warn)">vyžádáno doplnění</span>' : '') + '</div></div></div>' +
          '<div style="display:flex;flex-direction:column;gap:6px">' +
            '<button class="btn btn-ok btn-sm" data-act="t-ok:' + x.id + '">' + ic('check', 14) + ' Schválit</button>' +
            '<button class="btn btn-bad btn-sm" data-act="t-no:' + x.id + '">' + ic('x', 14) + ' Zamítnout</button>' +
            '<button class="btn btn-soft btn-sm" data-act="t-more:' + x.id + '">Vyžádat doplnění</button>' +
          '</div></div>';
      }).join('') + '</div>' : '<div class="empty"><b>Nic nečeká</b>Všechny omluvenky jsou vyřešené ✓</div>') +
    '</div>' +
    '<div>' +
      '<div class="card"><div class="card-title">' + ic('list', 16) + ' Historie</div>' +
        (history.length ? '<div class="list">' + history.map(x => {
          const st = studentOf(x.childId);
          return '<div class="list-row"><span class="chip ' + (x.status === 'schvaleno' ? 'chip-ok' : 'chip-bad') + '">' + (x.status === 'schvaleno' ? 'schváleno' : 'zamítnuto') + '</span>' +
            '<div class="grow"><div class="row-title">' + escapeHtml(st.first + ' ' + st.last) + '</div><div class="row-sub">' + fmtDate(x.date) + ' · ' + escapeHtml(excuseHoursLabel(st.cls, x.date, x.periods) || 'celý den') + ' · ' + escapeHtml(x.reason) + '</div></div></div>';
        }).join('') + '</div>' : '<div class="empty">Zatím žádné vyřízené omluvenky</div>') +
      '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card-title">' + ic('alert', 16) + ' Absence (' + escapeHtml(classOf(cid).name) + ')' +
        '<span style="margin-left:auto;font-size:11.5px;color:var(--muted);font-weight:600">limit: 25 % neomluvených hodin</span></div>' +
        (absRows.length
          ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Žák</th><th class="num">Omluveno</th><th class="num">Čeká</th><th class="num">Neomluveno</th><th class="num">Zameškáno</th></tr></thead><tbody>' +
            absRows.map(({ s, ov }) => {
              const t = ov.total;
              return '<tr class="' + (t.unexPct > 25 ? 'risk' : '') + '"><td>' + escapeHtml(s.first + ' ' + s.last) + '</td>' +
                '<td class="num" style="color:var(--ok)">' + t.A + '</td>' +
                '<td class="num" style="color:var(--warn)">' + t.C + '</td>' +
                '<td class="num" style="color:var(--bad)">' + t.N + '</td>' +
                '<td class="num"><b>' + (t.lessons ? t.missing + '/' + t.lessons : '—') + '</b></td></tr>';
            }).join('') + '</tbody></table></div>'
          : '<div class="empty">Žádné zameškané hodiny ✓</div>') +
      '</div>' +
    '</div>' +
  '</div>';
}
onAct('t-ok:', el => decideExcuse(el.getAttribute('data-act').slice(5), 'schvaleno'));
onAct('t-no:', el => decideExcuse(el.getAttribute('data-act').slice(5), 'zamitnuto'));
onAct('t-more:', el => decideExcuse(el.getAttribute('data-act').slice(7), 'doplnit'));
function decideExcuse(id, status) {
  const x = (db.excuses || []).find(e => e.id === id);
  if (!x) return;
  x.status = status;
  x.decidedAt = nowISO();
  const st = studentOf(x.childId);
  const pu = db.users.find(u2 => (u2.children || []).includes(x.childId) && u2.role === 'rodic');
  if (status === 'schvaleno') {
    if (pu) db.notifs.push({ userId: pu.id, type: 'excuse', text: 'Omluvenka pro ' + st.first + ' (' + fmtDate(x.date) + ') byla schválena', ts: nowISO(), route: 'omluvenky' });
    toast('Omluvenka schválena ✓ – hodiny se v třídní knize počítají jako omluvené', 'ok');
  } else if (status === 'zamitnuto') {
    if (pu) db.notifs.push({ userId: pu.id, type: 'excuse', text: 'Omluvenka pro ' + st.first + ' (' + fmtDate(x.date) + ') byla zamítnuta', ts: nowISO(), route: 'omluvenky' });
    toast('Omluvenka zamítnuta – hodiny zůstávají neomluvené', 'bad');
  } else {
    if (pu) db.notifs.push({ userId: pu.id, type: 'excuse', text: 'Učitel žádá doplnění omluvenky pro ' + st.first, ts: nowISO(), route: 'omluvenky' });
    toast('Vyžádáno doplnění ✓', 'warn');
  }
  saveDB();
  route();
}

/* ================= ROZVRH (den / editor tabulky / rezervace) ================= */
function rzCanEdit(cid) {
  const u = currentUser();
  const cls = classOf(cid);
  return !!u && (!!u.isAdmin || (cls && (cls.teacherIds || []).includes(u.id)));
}
function tIn(v) { return /^\d:/.test(String(v)) ? '0' + v : String(v); }
function teacherLabel(tid) {
  const u = db.users.find(x => x.id === tid);
  return u ? u.name : '';
}
function rzModeTabs(cid) {
  const mode = localStorage.getItem('t_roz_mode') || 'den';
  const canEdit = rzCanEdit(cid);
  const tabs = [
    { k: 'den', label: 'Můj den' },
    { k: 'editor', label: canEdit ? 'Nastavit rozvrh' : 'Rozvrh třídy' }
  ];
  return '<div class="tabs">' + tabs.map(t =>
    '<button class="tab' + (mode === t.k ? ' active' : '') + '" data-act="t-roz-mode:' + t.k + '">' + t.label + '</button>').join('') + '</div>';
}
function rzDenHtml(cid) {
  const cls = classOf(cid);
  const sel = localStorage.getItem('t_plan_date') || (isSchoolDay(todayISO()) ? todayISO() : nextSchoolDayISO(todayISO(), 0));
  const plan = teacherDayPlan(cid, sel);
  const wd = weekdayOf(sel);
  const weekDates = [0, 1, 2, 3, 4].map(i => addDaysISO(addDaysISO(sel, -(wd === 0 ? 6 : wd - 1)), i));
  const lessons = plan.filter(p => p.type !== 'volno');
  const today = todayISO();
  const isToday = sel === today;
  return '<div class="rcpt-row day-pills">' + weekDates.map(d =>
    '<button class="rcpt-pill' + (d === sel ? ' active' : '') + '" data-act="t-plan:' + d + '">' + WD_CS[weekdayOf(d) - 1] + ' ' + d.slice(8) + (d === today ? ' · dnes' : '') + '</button>').join('') + '</div>' +
  '<div class="card"><div class="card-title">' + ic('clock', 16) + ' ' + (isToday ? 'Dnes' : fmtDateLong(sel)) + ' – ' + escapeHtml(cls.name) + '</div>' +
    '<div class="day-grid">' + (lessons.length ? lessons.map(p => {
      const who = p.teacherId ? teacherLabel(p.teacherId) : '';
      const rmChip = p.room ? roomChip(p.room, 22) : '';
      const meta = [who, p.cls].filter(Boolean).join(' · ');
      return '<div class="lesson"><span class="time">' + p.t.s + '<br>' + p.t.e + '</span>' + subjBadge(p.subj, 40) +
        '<div class="grow"><div class="row-title">' + escapeHtml(SUBJECTS[p.subj].name) + '</div>' +
        '<div class="row-sub">' + escapeHtml(meta || p.cls) + (rmChip ? '<span style="margin:0 0 0 7px">' + rmChip + '</span>' : '') + '</div></div>' +
        (!isAppMode() ? '<button class="btn btn-soft btn-sm" data-act="goto:#/ucitel/kniha">' + ic('edit', 14) + ' Zápis</button>' : '') + '</div>';
    }).join('') : '<div class="empty"><b>Rozvrh zatím není nastaven</b>Vyplňte ho v záložce „Nastavit rozvrh“.</div>') + '</div>' +
  '</div>';
}
function rzEditorHtml(cid) {
  const cls = classOf(cid);
  const sc = scheduleOf(cid);
  const rooms = roomsList();
  const teachers = db.users.filter(u => u.role === 'ucitel');
  const subjectOpts = ['<option value="">— předmět —</option>'].concat(SUBJ_KEYS.map(s => '<option value="' + s + '">' + SUBJECTS[s].name + '</option>')).join('');
  const teacherOpts = ['<option value="">— kdo učí —</option>'].concat(teachers.map(u => '<option value="' + u.id + '">' + escapeHtml(u.name) + '</option>')).join('');
  const roomOpts = ['<option value="">— učebna —</option>'].concat(rooms.map(r => '<option value="' + r.id + '">' + escapeHtml((r.short || genRoomShort(r.name, rooms) || r.name)) + ' · ' + escapeHtml(r.name) + '</option>')).join('');
  const cells = [1, 2, 3, 4, 5].map(d => sc.days[d]);
  return '<div class="card">' +
    '<div class="card-title">' + ic('calendar', 16) + ' Týdenní rozvrh – ' + escapeHtml(cls.name) + '</div>' +
    '<p class="small-note" style="margin:0 0 12px">Sloupce = dny, řádky = hodiny. V každé buňce vyberte <b>předmět</b>, <b>kdo učí</b> a <b>učebnu</b>. Časy „od–do“ upravíte v prvním sloupci. Změny se ukládají okamžitě.</p>' +
    '<div class="tbl-wrap" style="max-height:640px;overflow:auto">' +
      '<table class="tbl" style="min-width:1050px"><thead><tr>' +
        '<th style="min-width:180px">Hodina / čas</th>' +
        WD_CS.map((d, i) => '<th style="min-width:150px;text-align:center">' + d + '</th>').join('') +
        '<th style="min-width:40px"></th></tr></thead><tbody>' +
        sc.slots.map((slot, i) => {
          return '<tr>' +
            '<td style="vertical-align:top"><div style="font-weight:800;font-size:13px;color:var(--accent)">' + (i + 1) + '. hodina</div>' +
              '<div style="display:flex;gap:4px;align-items:center;margin-top:6px;font-size:12px">' +
                '<input type="time" class="txt rt-time" data-idx="' + i + '" data-kind="s" value="' + tIn(slot.s) + '" style="width:74px;padding:5px 4px"> – ' +
                '<input type="time" class="txt rt-time" data-idx="' + i + '" data-kind="e" value="' + tIn(slot.e) + '" style="width:74px;padding:5px 4px">' +
              '</div></td>' +
            [0, 1, 2, 3, 4].map(colIdx => {
              const en = cells[colIdx][i] || null;
              const d = colIdx + 1;
              return '<td style="text-align:center;vertical-align:top;padding:6px">' +
                '<div style="display:grid;gap:5px">' +
                  '<select class="sel rt-cell" data-day="' + d + '" data-idx="' + i + '" data-kind="subj" style="font-weight:800;padding:6px 4px;' + (en && en.subj ? 'border-color:' + SUBJECTS[en.subj].color + ';color:' + SUBJECTS[en.subj].color : '') + '">' +
                    subjectOpts.replace('value="' + (en ? en.subj : '') + '"', 'value="' + (en ? en.subj : '') + '" selected') + '</select>' +
                  '<select class="sel rt-cell" data-day="' + d + '" data-idx="' + i + '" data-kind="teacher" style="padding:5px 4px;font-size:12.5px">' +
                    teacherOpts.replace('value="' + (en ? en.teacherId || '' : '') + '"', 'value="' + (en ? en.teacherId || '' : '') + '" selected') + '</select>' +
                  '<select class="sel rt-cell" data-day="' + d + '" data-idx="' + i + '" data-kind="room" style="padding:5px 4px;font-size:12.5px">' +
                    roomOpts.replace('value="' + (en ? en.room || '' : '') + '"', 'value="' + (en ? en.room || '' : '') + '" selected') + '</select>' +
                '</div></td>';
            }).join('') +
            '<td style="vertical-align:top"></td></tr>';
        }).join('') +
      '</tbody></table></div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">' +
      '<button class="btn btn-soft btn-sm" data-act="rt-slot-add">' + ic('plus', 14) + ' Přidat hodinu</button>' +
      '<button class="btn btn-soft btn-sm" data-act="rt-slot-rm">' + ic('x', 14) + ' Odebrat poslední hodinu</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="t-stud-add">' + ic('users', 14) + ' Žáci třídy…</button>' +
    '</div>' +
    '<div class="small-note" style="margin-top:10px">Předmět „—“ = v tuto hodinu se nic nevyučuje (bude se zobrazovat jako volno).</div>' +
  '</div>' +
  '<div class="small-note" style="margin-top:14px">' + ic('home', 13) + ' Učebny (názvy, zkratky a barvy) se spravují v sekci <b data-act="goto:#/ucitel/ucebny" style="cursor:pointer;color:var(--accent)">Učebny</b>.</div>'
  '</div>';
}
function tRozvrh() {
  clearTick();
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const cls = classOf(cid);
  const mode = localStorage.getItem('t_roz_mode') || 'den';
  return '' +
  '<div class="page-head"><div><h1>Rozvrh</h1><div class="sub">' + escapeHtml(cls.name) + ' · denní přehled a nastavení tabulky rozvrhu</div></div></div>' +
  clsScopePills() + rzModeTabs(cid) +
  (mode === 'editor' ? rzEditorHtml(cid) : rzDenHtml(cid));
}
onAct('t-roz-mode:', el => { localStorage.setItem('t_roz_mode', el.getAttribute('data-act').slice(11)); route(); });
onAct('t-plan:', el => { localStorage.setItem('t_plan_date', el.getAttribute('data-act').slice(7)); route(); });
/* okamžité ukládání buněk a časů rozvrhu */
document.addEventListener('change', e => {
  const cid = activeClsId();
  if (!cid) return;
  const time = e.target.closest('.rt-time');
  if (time) {
    const idx = Number(time.dataset.idx);
    scheduleSetSlotTime(cid, idx, time.dataset.kind === 's' ? time.value : slotOf(cid, idx).s, time.dataset.kind === 'e' ? time.value : slotOf(cid, idx).e);
    saveDB();
    toast((time.dataset.kind === 's' ? 'Začátek' : 'Konec') + ' hodiny uložen ✓', 'ok');
    return;
  }
  const cell = e.target.closest('.rt-cell');
  if (cell) {
    const d = Number(cell.dataset.day), i = Number(cell.dataset.idx), kind = cell.dataset.kind;
    const sc = scheduleOf(cid);
    const cur = sc.days[d][i] || { room: null, teacherId: null };
    const val = cell.value;
    if (kind === 'subj') {
      if (!val) sc.days[d][i] = null;
      else sc.days[d][i] = Object.assign({}, cur, { subj: val });
    } else if (kind === 'teacher') { if (cur.subj) { sc.days[d][i] = Object.assign({}, cur, { teacherId: val || null }); } }
    else if (kind === 'room') { if (cur.subj) { sc.days[d][i] = Object.assign({}, cur, { room: val || null }); } }
    saveDB();
    return;
  }
});
onAct('rt-slot-add', () => { scheduleAddSlot(activeClsId()); saveDB(); toast('Hodina přidána – doplňte předměty', 'ok'); route(); });
onAct('rt-slot-rm', () => {
  const cid = activeClsId();
  const sc = scheduleOf(cid);
  if (sc.slots.length <= 1) { toast('Nelze odebrat jedinou hodinu', 'warn'); return; }
  scheduleRemoveSlot(cid); saveDB(); toast('Poslední hodina odebrána'); route();
});


/* ================= PŘEDMĚTY (vlastní + upravitelné základní předměty) ================= */
function tPredmety() {
  clearTick();
  const list = subjectsList();
  const built = list.filter(s => s.builtin);
  const custom = list.filter(s => !s.builtin);
  const row = (s) =>
    '<div class="list-row">' + subjBadge(s.code, 36) +
    '<div class="grow"><div class="row-title">' + escapeHtml(s.name) +
      (s.builtin
        ? ' <span class="chip" style="padding:0 7px;font-size:10px">základní</span>'
        : ' <span class="chip chip-accent" style="padding:0 7px;font-size:10px">vlastní</span>') + '</div>' +
    '<div class="row-sub">kód: <code class="mono">' + escapeHtml(s.code) + '</code> · ' + escapeHtml(s.color) +
      (subjectUsageCount(s.code) ? ' · použito na ' + subjectUsageCount(s.code) + ' ' + csPlural(subjectUsageCount(s.code), 'místě', 'místech', 'místech') : '') + '</div></div>' +
    '<div style="display:flex;gap:6px">' +
      '<button class="icon-btn sm" data-act="sub-edit:' + s.code + '" title="Upravit předmět">' + ic('edit', 15) + '</button>' +
      '<button class="icon-btn sm" data-act="sub-del:' + s.code + '" title="Smazat předmět" style="color:var(--bad)">' + ic('trash', 15) + '</button>' +
    '</div>' +
    '</div>';
  return '' +
  '<div class="page-head"><div><h1>Předměty</h1>' +
    '<div class="sub">Základní i vlastní předměty – všechny jdou upravovat (název, zkratka, barva) i mazat</div></div></div>' +
  '<div class="grid grid-2">' +
    '<div class="card"><div class="card-title">' + ic('book', 16) + ' Vlastní předmět (' + custom.length + ')' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">objeví se v rozvrhu i u známkování</span></div>' +
      '<form data-form="sub-add" style="margin-bottom:14px">' +
        '<div class="field-row">' +
          '<div class="field"><label>Název předmětu</label><input name="name" placeholder="Např. Programování, Španělština…" required></div>' +
          '<div class="field"><label>Zkratka <span class="small-note" style="margin:0">(prázdné = vygeneruje se)</span></label><input name="code" placeholder="Např. TV, PRO, ŠJ…" maxlength="4" style="font-family:monospace;text-transform:uppercase"></div>' +
        '</div>' +
        '<div class="field"><label>Barva – vyberte z ' + SUBJECT_PALETTE.length + '</label>' +
          '<div style="display:flex;flex-wrap:wrap;gap:7px">' +
            SUBJECT_PALETTE.map(c => '<button type="button" class="subj-col' + (c === '#3B82F6' ? ' sel' : '') + '" data-color="' + c + '" title="' + c + '" style="background:' + c + '" aria-pressed="false"></button>').join('') +
          '</div>' +
          '<input type="hidden" name="color" value="#3B82F6"></div>' +
        '<button class="btn btn-primary">' + ic('plus', 14) + ' Vytvořit předmět</button>' +
      '</form>' +
      (custom.length
        ? '<div class="list">' + custom.map(row).join('') + '</div>'
        : '<div class="empty"><b>Zatím žádné vlastní předměty</b>Když škola potřebuje něco navíc (kroužek, cizí jazyk…), založte ho tady.</div>') +
    '</div>' +
    '<div class="card"><div class="card-title">' + ic('check', 16) + ' Základní předměty (' + built.length + ')' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">jde upravit i smazat</span></div>' +
      (built.length ? '<div class="list">' + built.map(row).join('') + '</div>' : '') +
    '</div>' +
  '</div>';
}
/* výběr barvy v seznamu kroužků (radio-like) */
document.addEventListener('click', e => {
  const sw = e.target.closest('.subj-col');
  if (!sw) return;
  const wrap = sw.parentElement;
  if (!wrap) return;
  wrap.querySelectorAll('.subj-col').forEach(b => { b.classList.remove('sel'); b.setAttribute('aria-pressed', 'false'); });
  sw.classList.add('sel');
  sw.setAttribute('aria-pressed', 'true');
  const hid = wrap.parentElement.querySelector('input[name="color"]');
  if (hid) hid.value = sw.dataset.color;
});
onAct('form:sub-add', f => {
  const fd = new FormData(f);
  const name = String(fd.get('name')).trim();
  if (!name) { toast('Zadejte název předmětu', 'bad'); return; }
  const codeRaw = String(fd.get('code') || '').trim();
  const check = codeRaw ? subjectCodeAvailable(codeRaw) : { valid: true, clean: '', taken: false };
  if (codeRaw && !check.valid) { toast('Zkratka může mít 1–4 znaky (písmena a číslice)', 'bad'); return; }
  if (check.taken) { toast('Zkratka „' + escapeHtml(check.clean) + '“ už se používá', 'bad'); return; }
  const code = addSubject(name, check.clean, String(fd.get('color')) || '');
  if (!code) { toast('Zkratka už se používá – zvolte jinou', 'bad'); return; }
  toast('Předmět „' + escapeHtml(name) + '“ vytvořen (zkratka ' + code + ') ✓', 'ok');
  route();
});
/* mřížka barev (použito ve formuláři vytvoření i v modalu úprav) */
function subjectColorGrid(selColor, nameAttr) {
  return '<div style="display:flex;flex-wrap:wrap;gap:7px">' +
    SUBJECT_PALETTE.map(c => '<button type="button" class="subj-col' + (c === (selColor || '#3B82F6') ? ' sel' : '') + '" data-color="' + c + '" title="' + c + '" style="background:' + c + '" aria-pressed="' + (c === (selColor || '#3B82F6') ? 'true' : 'false') + '"></button>').join('') +
    '</div>' +
    '<input type="hidden" name="' + (nameAttr || 'color') + '" value="' + (selColor || '#3B82F6') + '">';
}
onAct('sub-edit:', el => {
  const code = el.getAttribute('data-act').slice(9);
  const s = SUBJECTS[code];
  if (!s) return;
  openModal('<h3>Upravit předmět „' + escapeHtml(s.name) + '“</h3>' +
    '<form data-form="sub-edit">' +
      '<input type="hidden" name="code" value="' + escapeHtml(code) + '">' +
      '<div class="field"><label>Název</label><input name="name" value="' + escapeHtml(s.name) + '" required></div>' +
      '<div class="field"><label>Zkratka</label><input name="code2" value="' + escapeHtml(code) + '" maxlength="4" required style="font-family:monospace;text-transform:uppercase">' +
      '<span class="small-note" style="margin:4px 0 0">Zkratka se používá v rozvrhu i známkování. Přejmenování zkratky nezahodí známky.</span></div>' +
      '<div class="field"><label>Barva</label>' + subjectColorGrid(s.color, 'color') + '</div>' +
      '<button class="btn btn-primary">Uložit změny</button>' +
    '</form>');
});
onAct('form:sub-edit', f => {
  const fd = new FormData(f);
  const code = String(fd.get('code'));
  const s = SUBJECTS[code];
  if (!s) return;
  const name = String(fd.get('name')).trim();
  const newCode = String(fd.get('code2') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const color = String(fd.get('color'));
  if (!name || !newCode) { toast('Vyplňte název i zkratku', 'bad'); return; }
  if (newCode !== code && Object.prototype.hasOwnProperty.call(SUBJECTS, newCode)) { toast('Zkratka „' + escapeHtml(newCode) + '“ už se používá', 'bad'); return; }
  if (name !== s.name) renameSubject(code, name);
  if (color && color !== s.color) setSubjectColor(code, color);
  if (newCode !== code) {
    if (renameSubjectCode(code, newCode)) { closeModal(); toast('Předmět upraven – zkratka změněna na „' + escapeHtml(newCode) + '“ (známky zachovány) ✓', 'ok'); route(); return; }
    toast('Zkratku se nepodařilo změnit', 'bad'); return;
  }
  closeModal();
  toast('Předmět upraven ✓', 'ok');
  route();
});
onAct('sub-del:', el => {
  const code = el.getAttribute('data-act').slice(8);
  const s = SUBJECTS[code];
  if (!s) return;
  const n = subjectUsageCount(code);
  openModal('<h3>Smazat předmět „' + escapeHtml(s.name) + '“?</h3>' +
    '<p class="small-note" style="margin:0 0 14px">' + (n
      ? 'Předmět se odebere z rozvrhu, třídní knihy i známkování na <b>' + n + ' místech</b>. Tuto akci nelze vrátit.'
      : 'Předmět se zatím nikde nepoužívá.') + '</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="sub-del-ok:' + code + '">Smazat</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('sub-del-ok:', el => {
  const code = el.getAttribute('data-act').slice(11);
  deleteSubjectCascade(code);
  closeModal();
  toast('Předmět smazán ✓', 'ok');
  route();
});

/* ================= UČEBNY (názvy, zkratky pro rozvrh, barvy) ================= */
function tUcebny() {
  clearTick();
  const rooms = roomsList();
  roomsEnsure();
  const row = r => {
    const short = r.short || genRoomShort(r.name, roomsList());
    const n = roomUsageCount(r.id);
    return '<div class="list-row">' +
      '<span class="room-chip" style="background:' + (r.color || ROOM_DEF_COLOR) + ';font-size:13px;height:34px;min-width:34px;padding:0 9px" title="' + escapeHtml(r.name) + '">' + escapeHtml(short) + '</span>' +
      '<div class="grow"><div class="row-title">' + escapeHtml(r.name) + '</div>' +
      '<div class="row-sub">zkratka v rozvrhu: <code class="mono">' + escapeHtml(short) + '</code> · ' + escapeHtml(r.color || ROOM_DEF_COLOR) + (n ? ' · použita v rozvrhu na ' + n + ' místech' : '') + '</div></div>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="icon-btn sm" data-act="rm-edit:' + r.id + '" title="Upravit učebnu">' + ic('edit', 15) + '</button>' +
        '<button class="icon-btn sm" data-act="rm-del:' + r.id + '" title="Smazat učebnu" style="color:var(--bad)">' + ic('trash', 15) + '</button>' +
      '</div>' +
    '</div>';
  };
  return '<div class="page-head"><div><h1>Učebny</h1>' +
    '<div class="sub">Učebny školy s krátkou zkratkou – ta se zobrazí v rozvrhu místo celého názvu</div></div></div>' +
    '<div class="grid grid-2">' +
      '<div class="card"><div class="card-title">' + ic('plus', 16) + ' Nová učebna (' + rooms.length + ')' +
        '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">zkratka se ukáže v rozvrhu</span></div>' +
        '<form data-form="rm-add" style="margin-bottom:14px">' +
          '<div class="field-row">' +
            '<div class="field"><label>Název učebny</label><input name="name" placeholder="Např. Tělocvična, Chemická laboratoř…" required></div>' +
            '<div class="field"><label>Zkratka <span class="small-note" style="margin:0">(prázdné = vygeneruje se)</span></label><input name="short" placeholder="Např. A607, TV…" maxlength="6" style="font-family:monospace;text-transform:uppercase"></div>' +
          '</div>' +
          '<div class="field"><label>Barva – vyberte z ' + ROOM_PALETTE.length + '</label>' +
            '<div style="display:flex;flex-wrap:wrap;gap:7px">' +
              ROOM_PALETTE.map(c => '<button type="button" class="subj-col' + (c === ROOM_DEF_COLOR ? ' sel' : '') + '" data-color="' + c + '" title="' + c + '" style="background:' + c + '" aria-pressed="' + (c === ROOM_DEF_COLOR ? 'true' : 'false') + '"></button>').join('') +
            '</div>' +
            '<input type="hidden" name="color" value="' + ROOM_DEF_COLOR + '"></div>' +
          '<button class="btn btn-primary">' + ic('plus', 14) + ' Vytvořit učebnu</button>' +
        '</form>' +
        (rooms.length
          ? '<div class="list">' + rooms.map(row).join('') + '</div>'
          : '<div class="empty"><b>Zatím žádné učebny</b>Přidejte první učebnu – pak ji přiřadíte hodinám v rozvrhu.</div>') +
      '</div>' +
      '<div class="card"><div class="card-title">' + ic('clock', 16) + ' Jak to vypadá v rozvrhu' +
        '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">ukázka</span></div>' +
        '<div class="small-note" style="margin:0 0 12px">U každé hodiny se zobrazí jen barevná zkratka učebny, kterou tu nastavíte – prázdné políčko znamená hodinu bez učebny.</div>' +
        '<div class="empty"><b>V rozvrhu se píše zkratka</b>Žák i učitel uvidí u hodiny místo celého názvu barevnou zkratku – celé jméno se ukáže po najetí myší.</div>' +
      '</div>' +
    '</div>';
}
onAct('form:rm-add', f => {
  const fd = new FormData(f);
  const name = String(fd.get('name')).trim();
  if (!name) { toast('Zadejte název učebny', 'bad'); return; }
  const shortRaw = String(fd.get('short') || '').trim();
  const short = shortRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (shortRaw && !short) { toast('Zkratka může obsahovat jen písmena a číslice', 'bad'); return; }
  if (short && roomCodeTaken(short)) { toast('Zkratka „' + escapeHtml(short) + '“ už se používá', 'bad'); return; }
  addRoom(name, short, String(fd.get('color')) || ROOM_DEF_COLOR);
  toast('Učebna „' + escapeHtml(name) + '“ vytvořena ✓', 'ok');
  route();
});
/* mřížka barev pro učebny (modál úprav) */
function roomColorGrid(selColor) {
  return '<div style="display:flex;flex-wrap:wrap;gap:7px">' +
    ROOM_PALETTE.map(c => '<button type="button" class="subj-col' + (c === (selColor || ROOM_DEF_COLOR) ? ' sel' : '') + '" data-color="' + c + '" title="' + c + '" style="background:' + c + '" aria-pressed="' + (c === (selColor || ROOM_DEF_COLOR) ? 'true' : 'false') + '"></button>').join('') +
    '</div>' +
    '<input type="hidden" name="color" value="' + (selColor || ROOM_DEF_COLOR) + '">';
}
onAct('rm-edit:', el => {
  const rid = el.getAttribute('data-act').slice(8);
  const r = roomsList().find(x => x.id === rid);
  if (!r) return;
  openModal('<h3>Upravit učebnu „' + escapeHtml(r.name) + '“</h3>' +
    '<form data-form="rm-edit">' +
      '<input type="hidden" name="id" value="' + escapeHtml(rid) + '">' +
      '<div class="field"><label>Název</label><input name="name" value="' + escapeHtml(r.name) + '" required></div>' +
      '<div class="field"><label>Zkratka</label><input name="short" value="' + escapeHtml(r.short || '') + '" maxlength="6" required style="font-family:monospace;text-transform:uppercase">' +
      '<span class="small-note" style="margin:4px 0 0">Zkratka se zobrazuje v rozvrhu místo celého názvu (např. A607).</span></div>' +
      '<div class="field"><label>Barva</label>' + roomColorGrid(r.color) + '</div>' +
      '<button class="btn btn-primary">Uložit změny</button>' +
    '</form>');
});
onAct('form:rm-edit', f => {
  const fd = new FormData(f);
  const rid = String(fd.get('id'));
  const r = roomsList().find(x => x.id === rid);
  if (!r) return;
  const name = String(fd.get('name')).trim();
  const short = String(fd.get('short') || '').trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const color = String(fd.get('color'));
  if (!name || !short) { toast('Vyplňte název i zkratku', 'bad'); return; }
  if (roomsList().some(x => x.id !== rid && (x.short || '').toUpperCase() === short)) { toast('Zkratka „' + escapeHtml(short) + '“ už se používá', 'bad'); return; }
  r.name = name;
  r.short = short;
  if (color) r.color = color;
  saveDB();
  closeModal();
  toast('Učebna upravena ✓', 'ok');
  route();
});
onAct('rm-del:', el => {
  const rid = el.getAttribute('data-act').slice(7);
  const r = roomsList().find(x => x.id === rid);
  if (!r) return;
  const n = roomUsageCount(rid);
  openModal('<h3>Smazat učebnu „' + escapeHtml(r.name) + '“?</h3>' +
    '<p class="small-note" style="margin:0 0 14px">' + (n
      ? 'Učebna se odebere z rozvrhu na <b>' + n + ' místech</b>. Tuto akci nelze vrátit.'
      : 'Učebna se zatím nikde nepoužívá.') + '</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="rm-del-ok:' + rid + '">Smazat</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('rm-del-ok:', el => {
  const rid = el.getAttribute('data-act').slice(10);
  removeRoom(rid);
  closeModal();
  toast('Učebna smazána', 'bad');
  route();
});

/* ================= ÚKOLY (domácí úkoly pro žáky) ================= */
function tUkoly() {
  clearTick();
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const cls = classOf(cid);
  const sts = studentsOfClass(cid);
  const tasks = tasksOfClass(cid);
  const subjectOpts = SUBJ_KEYS.map(s => '<option value="' + s + '">' + SUBJECTS[s].name + '</option>').join('');
  const stuOpts = sts.map(s => '<option value="' + s.id + '">' + escapeHtml(s.last + ' ' + s.first) + '</option>').join('');
  const today = todayISO();
  const overdue = tasks.filter(t => addDaysISO(today, 0) > t.due && taskDoneCount(t) < taskStudents(t).length);
  const open = tasks.filter(t => !overdue.includes(t) && taskDoneCount(t) < taskStudents(t).length);
  const allDone = tasks.filter(t => taskDoneCount(t) > 0 && taskDoneCount(t) === taskStudents(t).length);
  const card = t => {
    const cnt = taskStudents(t).length;
    const doneN = taskDoneCount(t);
    const late = addDaysISO(today, 0) > t.due && doneN < cnt;
    return '<div class="card"><div class="list-row" style="border:none;padding:0;background:none">' +
      subjBadge(t.subj || 'CJ', 36) +
      '<div class="grow"><div class="row-title">' + escapeHtml(t.title) +
        (t.sid ? ' <span class="chip chip-info" style="padding:0 7px;font-size:10px">pro ' + escapeHtml(studentFull(t.sid)) + '</span>' : ' <span class="chip chip-accent" style="padding:0 7px;font-size:10px">celá třída</span>') + '</div>' +
        '<div class="row-sub">' + escapeHtml(SUBJECTS[t.subj] ? SUBJECTS[t.subj].name : '') +
          (t.note ? ' · ' + escapeHtml(t.note) : '') + '</div></div>' +
      '<div style="text-align:right"><span class="chip ' + (doneN === cnt ? 'chip-ok' : late ? 'chip-bad' : 'chip-warn') + '">' + (doneN === cnt ? 'splněno' : late ? 'po termínu' : 'do ' + fmtDate(t.due)) + '</span>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:4px">' + doneN + '/' + cnt + ' ' + csPlural(cnt, 'žák', 'žáci', 'žáků') + '</div></div>' +
      '<button class="icon-btn sm" data-act="tk-del:' + t.id + '" style="color:var(--bad)" title="Smazat úkol">' + ic('trash', 15) + '</button></div>' +
      '<div class="tbl-wrap"><table class="tbl" style="min-width:420px"><thead><tr><th>Žák</th><th>Stav – klepnutím přepnete</th></tr></thead><tbody>' +
        taskStudents(t).map(s => {
          const d = !!(t.done && t.done[s.id]);
          return '<tr style="cursor:pointer" data-act="tk-toggle:' + t.id + ':' + s.id + '"><td><div style="display:flex;align-items:center;gap:8px">' + teacherAva(s, 26) + '<b>' + escapeHtml(s.last + ' ' + s.first) + '</b></div></td>' +
            '<td><span class="chip ' + (d ? 'chip-ok' : '') + '">' + (d ? ic('check', 12) + ' splněno' : 'čeká') + '</span></td></tr>';
        }).join('') + '</tbody></table></div>' +
      '</div>';
  };
  const head = '' +
    '<div class="page-head"><div><h1>Úkoly</h1><div class="sub">Domácí úkoly pro ' + escapeHtml(cls.name) + ' – žák je uvidí v „Moje úkoly“ a odškrtne splnění</div></div></div>' +
    clsScopePills();
  const colNovy =
    '<div class="card"><div class="card-title">' + ic('plus', 16) + ' Nový úkol</div>' +
        '<form data-form="tk-add">' +
          '<div class="field"><label>Předmět</label><select name="subj">' + subjectOpts + '</select></div>' +
          '<div class="field"><label>Pro koho</label><select name="who"><option value="">Celou třídu (' + escapeHtml(cls.name) + ')</option>' + stuOpts + '</select></div>' +
          '<div class="field"><label>Zadání</label><input name="title" placeholder="Např. PS str. 42, cvičení 3" required></div>' +
          '<div class="field-row">' +
            '<div class="field"><label>Termín</label><input type="date" name="due" value="' + nextSchoolDayISO(today, 1) + '"></div>' +
            '<div class="field"><label>Váha / poznámka (volitelné)</label><input name="note" placeholder="Např. za známku, dobrovolné…"></div>' +
          '</div>' +
          '<button class="btn btn-primary">' + ic('check', 15) + ' Zadat úkol</button>' +
        '</form>' +
        '<div class="small-note">Úkol zadaný v třídní knize (pole „Domácí úkol“) se sem zapíše sám.</div>' +
      '</div>' +
    '<div class="card"><div class="card-title" style="color:var(--bad)">' + ic('alert', 16) + ' Po termínu (' + overdue.length + ')</div>' +
      (overdue.length
        ? '<div style="display:grid;gap:10px">' + overdue.map(card).join('') + '</div>'
        : '<div class="empty">Žádný úkol po termínu</div>') +
    '</div>';
  const colSeznam =
    '<div class="card"><div class="card-title">' + ic('list', 16) + ' Aktivní úkoly (' + open.length + ')</div>' +
      (open.length ? '<div style="display:grid;gap:10px">' + open.map(card).join('') + '</div>' : '<div class="empty"><b>Žádné aktivní úkoly</b>Zadejte první úkol – žáci ho hned uvidí.</div>') +
    '</div>' +
    (allDone.length
      ? '<div class="card"><div class="card-title">' + ic('check', 16) + ' Splněno všemi (' + allDone.length + ')</div><div style="display:grid;gap:10px">' + allDone.map(card).join('') + '</div></div>'
      : '');
  if (isAppMode()) {
    const tabs = [{ k: 'nove', label: 'Nový úkol' }, { k: 'seznam', label: 'Úkoly třídy' }];
    const t = viewTab('ukoly', tabs);
    return head + tabbarHtml('ukoly', tabs, t) + (t === 'nove' ? colNovy : colSeznam);
  }
  return head + '<div class="grid grid-2"><div>' + colNovy + '</div><div>' + colSeznam + '</div></div>';
}
onAct('form:tk-add', f => {
  const fd = new FormData(f);
  const title = String(fd.get('title')).trim();
  if (!title) { toast('Napište zadání úkolu', 'bad'); return; }
  const subj = String(fd.get('subj')) || null;
  const who = String(fd.get('who')) || null;
  const tk = addTask(activeClsId(), subj, title, String(fd.get('due')) || nextSchoolDayISO(todayISO(), 1), String(fd.get('note')).trim(), who, currentUser().id);
  notifyTask(tk);
  saveDB();
  toast('Úkol zadán ✓ – žáci ho vidí v „Moje úkoly“', 'ok');
  route();
});
onAct('tk-toggle:', el => {
  const p = el.getAttribute('data-act').split(':');
  const t = (db.tasks || []).find(x => x.id === p[1]);
  if (!t) return;
  const sid = p[2];
  t.done = t.done || {};
  t.done[sid] = !t.done[sid];
  saveDB();
  toast(t.done[sid] ? 'Označeno jako splněné ✓' : 'Vráceno k plnění', t.done[sid] ? 'ok' : 'warn');
  route();
});
onAct('tk-del:', el => {
  const t = (db.tasks || []).find(x => x.id === el.getAttribute('data-act').slice(7));
  if (!t) return;
  openModal('<h3>Smazat úkol „' + escapeHtml(t.title) + '“?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Úkol zmizí žákům z „Moje úkoly“ i historie plnění.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="tk-del-ok:' + t.id + '">Smazat</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('tk-del-ok:', el => {
  db.tasks = (db.tasks || []).filter(x => x.id !== el.getAttribute('data-act').slice(10));
  saveDB();
  closeModal();
  toast('Úkol smazán', 'bad');
  route();
});

registerView('ucitel', 'prehled', tPrehled);
registerView('ucitel', 'dochazka', tDochazka);
registerView('ucitel', 'klasifikace', tKlasifikace);
registerView('ucitel', 'kniha', tKniha);
registerView('ucitel', 'zpravy', tZpravy);
registerView('ucitel', 'omluvenky', tOmluvenky);
registerView('ucitel', 'rozvrh', tRozvrh);
/* ---------- RESETOVÁNÍ HESEL (nová hesla k předání žákovi/rodiči) ---------- */
/* ---------- ÚDAJE: loginy žáků a rodičů mých tříd ---------- */
function tUdaje() {
  const u = currentUser();
  const myClsIds = myClasses().map(c => c.id);
  const myClsNames = myClasses();
  const myStudents = (db.students || []).filter(s => myClsIds.includes(s.cls));
  const rows = myStudents.map(s => {
    const acc = (db.users || []).find(x => x.role === 'student' && x.studentId === s.id);
    const par = parentOfStudent(s.id);
    return { s, acc, par };
  });
  const rowHtml = (r) => {
    const genSt = r.acc && visibleGenPass(r.acc);
    const genPar = r.par && visibleGenPass(r.par);
    return '<div class="list-row">' +
      '<span class="ava">' + escapeHtml(r.s.first.charAt(0)) + '</span>' +
      '<div class="grow"><div class="row-title">' + escapeHtml(r.s.first + ' ' + r.s.last) +
        ' <span style="font-size:11px;color:var(--muted);font-weight:700">' + escapeHtml((myClsNames.find(c => c.id === r.s.cls) || {}).name || '') + '</span></div>' +
        '<div class="row-sub">' +
          (r.acc
            ? 'žák: <code class="mono">' + escapeHtml(r.acc.username) + '</code> · heslo: ' +
              (genSt ? '<code class="mono">' + escapeHtml(genSt) + '</code>' : '<span style="color:var(--muted)">' + (r.acc.passChanged ? 'změněno žákem' : 'nezobrazuje se') + '</span>')
            : '<span style="color:var(--warn)">žák bez účtu</span>') +
          (r.par
            ? '<br>rodič: <code class="mono">' + escapeHtml(r.par.username) + '</code> · heslo: ' +
              (genPar ? '<code class="mono">' + escapeHtml(genPar) + '</code>' : '<span style="color:var(--muted)">' + (r.par.passChanged ? 'změněno rodičem' : 'nezobrazuje se') + '</span>')
            : '') +
        '</div></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' +
        (r.acc ? '<button class="btn btn-soft btn-sm" data-act="t-creds:' + r.acc.id + '">' + ic('eye', 13) + ' Údaje</button>' : '') +
        (r.acc ? '<button class="btn btn-soft btn-sm" data-act="t-print:' + r.acc.id + '" title="Vytisknout údaje žáka a rodiče">' + ic('print', 13) + ' Tisk</button>' : '') +
        (!r.par ? '<button class="btn btn-soft btn-sm" data-act="t-par-new:' + r.s.id + '">' + ic('users', 13) + ' Rodič</button>' : '') +
      '</div></div>';
  };
  return '<div class="page-head"><div><h1>Údaje – loginy žáků a rodičů</h1>' +
    '<div class="sub">Zakládáte tady přihlášky žáků a rodičů svých tříd. Vygenerované heslo vidíte, dokud si ho žák/rodič poprvé nezmění sám – pak se u účtu zobrazí „změněno“.</div></div>' +
    '<div class="page-acts">' + (isAppMode()
      ? '<span class="chip chip-info">Přidávání žáků jen na PC 🖥️</span>'
      : '<button class="btn btn-primary btn-sm" data-act="t-udaje-add">' + ic('plus', 15) + ' Přidat žáka + login</button>') + '</div></div>' +
    clsScopePills() +
    (rows.length
      ? '<div class="list">' + rows.map(rowHtml).join('') + '</div>'
      : '<div class="empty"><b>Žádní žáci</b>' + (isAppMode()
          ? 'Žáky přidáte na počítači tlačítkem „Přidat žáka + login“.'
          : 'Klikněte na „Přidat žáka + login“ – vytvoříte žáka i rodičovský účet.') + '</div>');
}
onAct('t-udaje-add', () => {
  if (isAppMode()) { toast('Přidávání žáků je dostupné jen na počítači 🖥️', 'bad'); return; }
  openAddStudentModal(activeClsId());
});
/* ---------- TISK údajů: dvě karty (žák + rodič), tisk/Uložit jako PDF ---------- */
function printStudentCreds(studentAccId) {
  const stAcc = (db.users || []).find(x => x.id === studentAccId && x.role === 'student');
  if (!stAcc) return;
  const st = studentOf(stAcc.studentId);
  if (!st || !myClasses().some(c => c.id === st.cls)) { toast('Žák není z vaší třídy', 'bad'); return; }
  const parAcc = parentOfStudent(st.id);
  const cls = classOf(st.cls);
  const school = schoolName();
  const card = (title, subtitle, acc, pass) => {
    const passHtml = pass
      ? '<div class="pc-row"><span>Heslo</span><code>' + escapeHtml(pass) + '</code></div>'
      : '<div class="pc-row"><span>Heslo</span><i>' + (acc && acc.passChanged ? 'změněno uživatelem' : 'nezobrazuje se') + '</i></div>';
    return '<div class="print-card">' +
      '<div class="pc-head">' +
        '<div class="pc-logo">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>' +
        '</div>' +
        '<div><div class="pc-brand">School<b>Sys</b></div><div class="pc-school">' + escapeHtml(school) + (cls && cls.name ? ' · třída ' + escapeHtml(cls.name) : '') + '</div></div>' +
      '</div>' +
      '<h2>' + escapeHtml(title) + '</h2>' +
      (subtitle ? '<div class="pc-sub">' + escapeHtml(subtitle) + '</div>' : '') +
      '<div class="pc-row"><span>Přihlašovací jméno</span><code>' + escapeHtml(acc ? acc.username : '—') + '</code></div>' +
      passHtml +
      '<div class="pc-note">Website: přihlaste se na stránce aplikace SchoolSys. Heslo si po prvním přihlášení změňte (ikona 🔒 vpravo nahoře) – po změně už ho nikdo jiný neuvidí. Tento papier s údaji uchovejte v bezpečí.</div>' +
    '</div>';
  };
  const stPass = visibleGenPass(stAcc);
  const parPass = parAcc ? visibleGenPass(parAcc) : null;
  const w = window.open('', '_blank', 'width=860,height=900');
  if (!w) { toast('Povolte prosím vyskakovací okna pro tisk', 'bad'); return; }
  w.document.write('<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"><title>Údaje – ' + escapeHtml(st.first + ' ' + st.last) + '</title>' +
    '<style>' +
      '* { box-sizing: border-box; margin: 0; padding: 0; }' +
      'body { font-family: "Segoe UI", Arial, sans-serif; background: #EEF2F7; padding: 24px; color: #0F172A; }' +
      '.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; max-width: 900px; margin: 0 auto; }' +
      '.print-card { background: #fff; border: 1.5px solid #CBD5E1; border-radius: 14px; padding: 18px 20px; page-break-inside: avoid; }' +
      '.pc-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }' +
      '.pc-logo { width: 40px; height: 40px; border-radius: 11px; background: linear-gradient(135deg,#3B82F6,#8B5CF6); display: grid; place-items: center; }' +
      '.pc-brand { font-size: 17px; font-weight: 900; letter-spacing: -0.02em; } .pc-brand b { color: #3B82F6; }' +
      '.pc-school { font-size: 11.5px; color: #64748B; font-weight: 600; }' +
      'h2 { font-size: 18px; margin: 6px 0 2px; }' +
      '.pc-sub { font-size: 12.5px; color: #64748B; margin-bottom: 10px; }' +
      '.pc-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid #E2E8F0; background: #F8FAFC; border-radius: 9px; padding: 9px 12px; margin: 7px 0; }' +
      '.pc-row span { font-size: 12px; font-weight: 700; color: #64748B; }' +
      '.pc-row code { font-family: Consolas, monospace; font-size: 14.5px; font-weight: 700; letter-spacing: 0.02em; }' +
      '.pc-row i { color: #94A3B8; font-size: 13px; }' +
      '.pc-note { font-size: 11px; color: #64748B; margin-top: 10px; line-height: 1.5; border-top: 1px dashed #E2E8F0; padding-top: 8px; }' +
      '.print-actions { max-width: 900px; margin: 0 auto 16px; display: flex; gap: 10px; justify-content: flex-end; }' +
      '.print-actions button { padding: 10px 18px; border-radius: 9px; border: 0; font-weight: 800; font-size: 14px; cursor: pointer; background: #2563EB; color: #fff; }' +
      '.print-actions button.ghost { background: #E2E8F0; color: #0F172A; }' +
      '@media print {' +
        'body { background: #fff; padding: 0; }' +
        '.print-actions { display: none; }' +
        '.cards { grid-template-columns: 1fr 1fr; gap: 12px; max-width: none; }' +
        '.print-card { border-color: #94A3B8; }' +
        '@page { margin: 12mm; }' +
      '}' +
    '</style></head><body>' +
    '<div class="print-actions"><button class="ghost" onclick="window.close()">Zavřít</button><button onclick="window.print()">🖨️ Tisknout / Uložit jako PDF</button></div>' +
    '<div class="cards">' +
      card('Žák · ' + st.first + ' ' + st.last, 'Přihlašovací údaje do aplikace SchoolSys', stAcc, stPass) +
      (parAcc ? card('Rodič · ' + st.first + ' ' + st.last, 'Přihlašovací údaje do aplikace SchoolSys', parAcc, parPass) : '') +
    '</div>' +
    '<scr' + 'ipt>setTimeout(function(){ window.focus(); }, 300);</scr' + 'ipt>' +
    '</body></html>');
  w.document.close();
}
onAct('t-print:', el => {
  printStudentCreds(el.getAttribute('data-act').slice(8));
});
/* údaje žáka/rodiče – login + heslo (viditelné do vlastní změny) */
onAct('t-creds:', el => {
  const id = el.getAttribute('data-act').slice(8);
  const target = (db.users || []).find(x => x.id === id);
  if (!target) return;
  const sid = target.role === 'student' ? target.studentId : (target.children || [])[0];
  const st = sid ? studentOf(sid) : null;
  if (!st || !myClasses().some(c => c.id === st.cls)) { toast('Účet není z vaší třídy', 'bad'); return; }
  showCreds(target);
});
/* vytvoření rodičovského účtu přímo z Údajů */
onAct('t-par-new:', el => {
  const sid = el.getAttribute('data-act').slice(10);
  const st = studentOf(sid);
  if (!st || !myClasses().some(c => c.id === st.cls)) { toast('Žák není z vaší třídy', 'bad'); return; }
  const acc = (db.users || []).find(x => x.role === 'student' && x.studentId === sid);
  const parPlain = genPassword();
  const par = addUserAccount((acc ? acc.username : genUsername(st.first, st.last)) + '.rodic', parPlain, 'rodic', {
    name: 'Rodič · ' + st.first + ' ' + st.last, note: st.cls, isAdmin: false, children: [sid], orgId: st.orgId || null
  });
  rememberGenPass(par, parPlain);
  setPendingPass(par.id, parPlain);
  saveDB();
  showCreds(par);
  toast('Rodičovský účet vytvořen ✓', 'ok');
  route();
});
function tHesla() {
  const u = currentUser();
  let dirty = false;
  const list = (db.resetPass || []).filter(r => r.teacherId === u.id).sort((a, b) => (a.ts < b.ts ? 1 : -1));
  list.forEach(r => { if (!r.read) { r.read = true; dirty = true; } });
  if (dirty) saveDB();
  /* žáci a rodiče mých tříd – třídní je spravuje sám, bez admina */
  const myClsIds = myClasses().map(c => c.id);
  const myStudents = (db.students || []).filter(s => myClsIds.includes(s.cls));
  const rows = myStudents.map(s => {
    const acc = (db.users || []).find(x => x.role === 'student' && x.studentId === s.id);
    const par = parentOfStudent(s.id);
    return { s, acc, par };
  }).filter(r => r.acc || r.par);
  /* čekající žádosti z „Zapomněl jsem heslo“, které má vyřídit třídní */
  const reqs = (db.resetReq || []).filter(r => {
    if (r.status !== 'ceka') return false;
    const acc = accByLogin(r.login);
    return acc && resetResolverOf(acc).kind === 'teacher' && resetResolverOf(acc).teacherId === u.id;
  });
  return '<div class="page-head"><div><h1>Resetování hesel</h1>' +
    '<div class="sub">Čekající žádosti o reset a upozornění. Loginy a hesla žáků/rodičů spravujte v záložce <b>Údaje</b> – tam je vidíte i později (dokud si je uživatel nezmění).</div></div></div>' +
    (reqs.length
      ? '<div class="card" style="margin-bottom:16px;border-color:var(--warn)"><div class="card-title">' + ic('zap', 16) + ' Čekající žádosti o reset</div>' +
        '<div class="list">' + reqs.map(r => {
          const acc = accByLogin(r.login);
          return '<div class="list-row">' +
            '<span class="ava" style="background:linear-gradient(135deg,#3B82F6,#8B5CF6)">' + ic('zap', 16) + '</span>' +
            '<div class="grow"><div class="row-title"><code class="mono">' + escapeHtml(r.login) + '</code>' + (acc ? ' · ' + escapeHtml(acc.name) : '') + '</div>' +
            '<div class="row-sub">' + (acc ? escapeHtml(resetWhoText(acc)) : '') + ' · ' + tsLabel(r.ts) + '</div></div>' +
            '<button class="btn btn-primary btn-sm" data-act="t-req-reset:' + r.id + '">' + ic('zap', 13) + ' Resetovat</button>' +
          '</div>';
        }).join('') + '</div></div>'
      : '') +
    (list.length
      ? '<div class="card" style="margin-bottom:16px"><div class="card-title">' + ic('bell', 16) + ' Upozornění na reset od správce</div>' +
        '<div class="list">' + list.map(r =>
          '<div class="list-row">' +
            '<span class="ava" style="background:linear-gradient(135deg,#F59E0B,#EF4444)">' + ic('zap', 16) + '</span>' +
            '<div class="grow"><div class="row-title">' + escapeHtml(r.who) + '</div>' +
              '<div class="row-sub">přihlášení: <code class="mono">' + escapeHtml(r.login) + '</code> · heslo z bezpečnostních důvodů nezobrazujeme</div>' +
              '<div style="font-size:11px;color:var(--muted)">' + tsLabel(r.ts) + '</div></div>' +
            '<button class="icon-btn sm" style="color:var(--bad)" data-act="t-res-hide:' + r.id + '" title="Smazat upozornění">' + ic('trash', 15) + '</button>' +
          '</div>'
        ).join('') + '</div></div>'
      : '') +
    '<div class="card"><div class="card-title">' + ic('users', 16) + ' Žáci a rodiče mých tříd</div>' +
    (rows.length
      ? '<div class="list">' + rows.map(r =>
          '<div class="list-row">' +
            '<span class="ava">' + escapeHtml(r.s.first.charAt(0)) + '</span>' +
            '<div class="grow"><div class="row-title">' + escapeHtml(r.s.first + ' ' + r.s.last) + '</div>' +
              '<div class="row-sub">' +
                (r.acc ? 'žák: <code class="mono">' + escapeHtml(r.acc.username) + '</code>' : '<span style="color:var(--warn)">žák bez účtu</span>') +
                (r.par ? ' · rodič: <code class="mono">' + escapeHtml(r.par.username) + '</code>' : '') +
              '</div></div>' +
            '<div style="display:flex;gap:6px">' +
              (r.acc ? '<button class="btn btn-soft btn-sm" data-act="t-pass-reset:' + r.acc.id + '">' + ic('zap', 13) + ' Reset žák</button>' : '') +
              (r.par ? '<button class="btn btn-soft btn-sm" data-act="t-pass-reset:' + r.par.id + '">' + ic('zap', 13) + ' Reset rodič</button>' : '') +
            '</div>' +
          '</div>'
        ).join('') + '</div>'
      : '<div class="empty"><b>Žádní žáci</b>Žáky zakládáte v Známkování („Přidat žáka“) – tady pak resetujete jejich hesla a hesla rodičů.</div>') +
    '</div>';
}
/* vyřízení žádosti z „Zapomněl jsem heslo“ – smí jen ten, komu patří */
onAct('t-req-reset:', el => {
  const id = el.getAttribute('data-act').slice(12);
  const r = (db.resetReq || []).find(x => x.id === id);
  if (!r || r.status !== 'ceka') return;
  const acc = accByLogin(r.login);
  if (!acc) return;
  if (typeof viewerCanResolve === 'function' ? !viewerCanResolve(acc) : true) { toast('Tuto žádost nemůžete vyřídit', 'bad'); return; }
  const np = genPassword();
  acc.pass = hashPassword(np);
  acc.passChanged = false;
  rememberGenPass(acc, np);
  setPendingPass(acc.id, np);
  r.status = 'vyrizeno';
  r.doneTs = nowISO();
  saveDB();
  showCreds(acc);
  toast('Heslo resetováno ✓ – předajte ho uživateli osobně', 'ok');
  route();
});
/* třídní resetuje heslo žákovi/rodiči své třídy – nové heslo vidí jednorázově */
onAct('t-pass-reset:', el => {
  const id = el.getAttribute('data-act').slice(13);
  const target = (db.users || []).find(x => x.id === id);
  if (!target) return;
  if (target.isAdmin || target.isOrgContact || target.role === 'ucitel') { toast('Tohle nejde – učitele řeší zakladatel organizace, admina nikdo', 'bad'); return; }
  const u = currentUser();
  /* žák/rodič musí patřit do jedné z mých tříd */
  const sid = target.role === 'student' ? target.studentId : (target.children || [])[0];
  const st = sid ? studentOf(sid) : null;
  if (!st || !myClasses().some(c => c.id === st.cls)) { toast('Tento účet není z vaší třídy', 'bad'); return; }
  const np = genPassword();
  target.pass = hashPassword(np);
  target.passChanged = false;
  rememberGenPass(target, np);   /* heslo zůstane viditelné, dokud si ho uživatel nezmění */
  setPendingPass(target.id, np);
  saveDB();
  showCreds(target);
  toast('Heslo resetováno ✓ – nové heslo předajte žákovi/rodiči osobně', 'ok');
});
onAct('t-res-hide:', el => {
  const id = el.getAttribute('data-act').slice(11);
  db.resetPass = (db.resetPass || []).filter(r => r.id !== id);
  saveDB();
  toast('Upozornění smazáno', 'bad');
  route();
});
registerView('ucitel', 'prehled', tPrehled);
registerView('ucitel', 'dochazka', tDochazka);
registerView('ucitel', 'klasifikace', tKlasifikace);
registerView('ucitel', 'kniha', tKniha);
registerView('ucitel', 'zpravy', tZpravy);
registerView('ucitel', 'omluvenky', tOmluvenky);
registerView('ucitel', 'rozvrh', tRozvrh);
registerView('ucitel', 'predmety', tPredmety);
registerView('ucitel', 'ucebny', tUcebny);
registerView('ucitel', 'pololetka', tPololetka);
registerView('ucitel', 'ukoly', tUkoly);
registerView('ucitel', 'udaje', tUdaje);
registerView('ucitel', 'hesla', tHesla);

/* ---------- OZNÁMENÍ (zpráva pro třídu: rodiče / žáci / obojí) ---------- */
function tOznameni() {
  const u = currentUser();
  if (!u) return '';
  const clsList = myClasses();
  annMarkRead(u);
  const list = annVisibleFor(u).slice().sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const whoOpts = [['both', 'Rodiče i žáci'], ['rodice', 'Pouze rodiče'], ['zaci', 'Pouze žáci']];
  const compose = clsList.length
    ? '<div class="card" style="margin-bottom:16px"><div class="card-title">' + ic('send', 15) + ' Nové oznámení</div>' +
      '<form data-form="ann-new">' +
        '<div class="field-row">' +
          '<div class="field"><label>Třída</label><select name="cls">' +
            clsList.map(c => '<option value="' + c.id + '"' + (c.id === activeClsId() ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>').join('') +
          '</select></div>' +
          '<div class="field"><label>Odeslat</label><select name="who">' +
            whoOpts.map(o => '<option value="' + o[0] + '"' + (o[0] === 'both' ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
          '</select></div>' +
        '</div>' +
        '<div class="field"><label>Text oznámení</label><textarea name="text" rows="3" required placeholder="např. Ve středu píšeme čtvrtletní písemku z matematiky. Připravte si…"></textarea></div>' +
        '<button class="btn btn-primary">' + ic('send', 15) + ' Odeslat oznámení</button>' +
      '</form></div>'
    : '<div class="card" style="margin-bottom:16px"><div class="empty"><b>Nejste třídním učitelem žádné třídy</b>Oznámení se posílají třídě – nejdřív vám správce přiřadí třídu.</div></div>';
  const secList =
    '<div class="card"><div class="card-title">' + ic('bell', 15) + ' Odeslaná oznámení (' + list.length + ')</div>' +
    (list.length
      ? '<div class="list">' + list.map(a => {
          const teacher = (db.users || []).find(x => x.id === a.teacherId);
          return '<div class="list-row" style="align-items:flex-start">' +
            '<span class="chip chip-accent">' + escapeHtml((classOf(a.cls) || {}).name || a.cls) + '</span>' +
            '<div class="grow">' +
              '<div class="row-sub">' + escapeHtml((teacher ? teacher.name : 'Učitel') + ' · ' + annWhoLabel(a.who) + ' · ' + tsLabel(a.ts)) + '</div>' +
              '<div style="white-space:pre-wrap;margin-top:4px">' + escapeHtml(a.text) + '</div>' +
            '</div>' +
            '<button class="icon-btn sm" style="color:var(--bad)" data-act="ann-del:' + a.id + '" title="Smazat oznámení">' + ic('trash', 15) + '</button>' +
            '</div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Zatím žádná oznámení</b>První oznámení pošlete formulářem nahoře.</div>') +
    '</div>';
  const head = '<div class="page-head"><div><h1>Oznámení</h1>' +
    '<div class="sub">Pošlete žákům / rodičům třídy zprávu – třeba o písemce nebo třídní schůzce.</div></div></div>';
  if (isAppMode()) {
    const tabs = [{ k: 'seznam', label: 'Odeslaná (' + list.length + ')' }, { k: 'nove', label: 'Nové oznámení' }];
    const t = viewTab('oznameni', tabs);
    return head + tabbarHtml('oznameni', tabs, t) + (t === 'nove' ? compose : secList);
  }
  return head + compose + secList;
}
onAct('form:ann-new', f => {
  const fd = new FormData(f);
  const u = currentUser();
  if (!u || u.role !== 'ucitel') return;
  const cls = String(fd.get('cls'));
  const who = String(fd.get('who'));
  const text = String(fd.get('text') || '').trim();
  if (!cls || !['both', 'rodice', 'zaci'].includes(who)) { toast('Vyberte třídu a příjemce', 'bad'); return; }
  if (!text) { toast('Napište text oznámení', 'bad'); return; }
  db.ann = db.ann || [];
  db.ann.push({ id: uid(), teacherId: u.id, cls, who, text, ts: nowISO() });
  saveDB();
  toast('Oznámení odesláno ✓', 'ok');
  route();
});
onAct('ann-del:', el => {
  const id = el.getAttribute('data-act').slice(8);
  const a = (db.ann || []).find(x => x.id === id);
  const u = currentUser();
  if (!a || !u) return;
  /* učitel smaže oznámení své třídy (i od kolegů, kteří ve třídě učí) */
  const myClsIds = myClasses().map(c => c.id);
  if (!myClsIds.includes(a.cls) && a.teacherId !== u.id) return;
  const who = (db.users || []).find(x => x.id === a.teacherId);
  openModal('<h3>Smazat oznámení?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Oznámení od ' + escapeHtml(who ? who.name : 'učitele') + ' (' + fmtDate((a.ts || '').slice(0, 10)) + ') se trvale odstraní pro celou třídu.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="ann-del-ok:' + id + '">' + ic('trash', 14) + ' Ano, smazat</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('ann-del-ok:', el => {
  const id = el.getAttribute('data-act').slice(11);
  const a = (db.ann || []).find(x => x.id === id);
  const u = currentUser();
  if (!a || !u) return;
  const myClsIds = myClasses().map(c => c.id);
  if (!myClsIds.includes(a.cls) && a.teacherId !== u.id) return;
  db.ann = (db.ann || []).filter(x => x.id !== id);
  saveDB();
  closeModal();
  toast('Oznámení smazáno', 'bad');
  route();
});
/* ================= VÝCHOVNÁ OPATŘENÍ (poznámky, pochvaly, napomenutí, dutky – vše pohromadě) ================= */
function recChip(type) {
  const t = REC_BY_ID[type];
  const tone = (t || {}).tone || '';
  return '<span class="chip chip-' + tone + '">' + escapeHtml((t || { label: type }).label) + '</span>';
}
onAct('rec-del:', el => {
  const id = el.getAttribute('data-act').slice(8);
  const rec = (db.records || []).find(x => x.id === id);
  if (!rec) return;
  db.records = (db.records || []).filter(x => x.id !== id);
  saveDB();
  toast('Záznam smazán', 'bad');
  route();
});
registerView('ucitel', 'oznameni', tOznameni);


/* ================= VÝCHOVNÁ OPATŘENÍ (poznámky, pochvaly, napomenutí, dutky – vše) ================= */
function tPoznamky() {
  clearTick();
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const cls = classOf(cid);
  const sts = studentsOfClass(cid);
  const items = []
    .concat((db.notes || []).filter(n => sts.some(s => s.id === n.sid)).map(n => ({ k: 'note', date: n.date, n })))
    .concat((db.records || []).filter(r => sts.some(s => s.id === r.sid)).map(r => ({ k: 'rec', date: r.date, r })))
    .sort((a, z) => (a.date === z.date ? 0 : a.date < z.date ? 1 : -1));
  const cnt = items.length;
  return '' +
  '<div class="page-head"><div><h1>Výchovná opatření</h1>' +
    '<div class="sub">' + escapeHtml(cls.name) + ' · poznámky, pochvaly, napomenutí i dutky – vše na jednom místě; rodiče i žáci to vidí hned</div></div>' +
    '<div class="page-acts">' + (sts.length ? '<button class="btn btn-primary btn-sm" data-act="t-note-add">' + ic('plus', 15) + ' Nový záznam</button>' : '') + '</div></div>' +
  clsScopePills() +
  (sts.length
    ? '<div class="card"><div class="card-title">' + ic('edit', 16) + ' Záznamy o žácích třídy' +
        '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">' + cnt + ' ' + csPlural(cnt, 'záznam', 'záznamy', 'záznamů') + '</span></div>' +
      (items.length
        ? '<div class="list">' + items.map(it => {
            if (it.k === 'rec') {
              const r = it.r;
              const st = studentOf(r.sid);
              const by = (db.users || []).find(x => x.id === r.by);
              return '<div class="list-row" style="align-items:flex-start"><span class="ava" style="background:linear-gradient(135deg,#F59E0B,#D97706)">' + ic({ ok: 'check', accent: 'check', warn: 'alert', bad: 'x' }[(REC_BY_ID[r.type] || {}).tone] || 'flag', 15) + '</span>' +
                '<div class="grow"><div class="row-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + recChip(r.type) + '</div>' +
                (r.reason ? '<div style="margin-top:3px;white-space:pre-wrap">' + escapeHtml(r.reason) + '</div>' : '') +
                '<div class="row-sub">' + escapeHtml(st ? st.first + ' ' + st.last : '—') + ' · ' + semLabel(r.sem || semOfDate(r.date)) + ' · ' + fmtDate(r.date) + (by ? ' · ' + escapeHtml(by.name) : '') + '</div></div>' +
                '<button class="icon-btn sm" style="color:var(--bad)" data-act="rec-del:' + r.id + '" title="Smazat">' + ic('trash', 13) + '</button></div>';
            }
            const n = it.n;
            const st = studentOf(n.sid);
            const by = (db.users || []).find(x => x.id === n.by);
            return '<div class="list-row" style="align-items:flex-start"><span class="ava" style="background:linear-gradient(135deg,#8B5CF6,#6D28D9)">' + ic('edit', 15) + '</span>' +
              '<div class="grow"><div class="row-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + escapeHtml(n.title || 'Poznámka') + noteSevChip(n.sev) + (Number(n.sev) === 3 ? ' <span class="chip chip-accent" style="padding:2px 9px;font-size:11px">do pololetní klasifikace</span>' : '') + '</div>' +
              (n.reason ? '<div style="margin-top:3px;white-space:pre-wrap">' + escapeHtml(n.reason) + '</div>' : '') +
              '<div class="row-sub">' + escapeHtml(st ? st.first + ' ' + st.last : '—') + ' · ' + fmtDate(n.date) + (by ? ' · ' + escapeHtml(by.name) : '') + '</div></div>' +
              '<button class="icon-btn sm" data-act="t-note-edit:' + n.id + '" title="Upravit">' + ic('edit', 13) + '</button>' +
              '<button class="icon-btn sm" style="color:var(--bad)" data-act="t-note-del:' + n.id + '" title="Smazat">' + ic('trash', 13) + '</button></div>';
          }).join('') + '</div>'
        : '<div class="empty"><b>Zatím žádné záznamy</b>Přidejte první poznámku, pochvalu nebo důtku k žákovi – rodiče dostanou oznámení.</div>') +
      '</div>'
    : '<div class="card"><div class="empty"><b>Ve třídě zatím nejsou žáci</b>Přidejte je v Známkování („Přidat žáka“) nebo v Údaje.</div></div>');
}
function tNoteModalFor(noteId) {
  const cid = activeClsId();
  const sts = studentsOfClass(cid);
  if (!sts.length) { toast('Ve třídě zatím nejsou žáci', 'bad'); return; }
  const n = noteId ? (db.notes || []).find(x => x.id === noteId) : null;
  if (noteId && !n) return;
  openModal('<h3>' + (n ? 'Upravit záznam' : 'Nový záznam k žákovi') + '</h3>' +
    '<form data-form="' + (n ? 't-note-edit' : 't-note-add') + '"' + (n ? ' data-id="' + n.id + '"' : '') + '>' +
      '<div class="field"><label>Žák</label><select name="sid">' + sts.map(s =>
        '<option value="' + s.id + '"' + (n && n.sid === s.id ? ' selected' : '') + '>' + escapeHtml(s.first + ' ' + s.last) + '</option>').join('') + '</select></div>' +
      (n ? '' : '<div class="field"><label>Typ záznamu</label><select name="rtype" id="note-rtype">' +
        '<option value="pozn" selected>Poznámka</option>' +
        REC_TYPES.map(t => '<option value="' + t.id + '">' + escapeHtml(t.label) + '</option>').join('') +
      '</select></div>') +
      '<div class="field"><label>Název</label><input name="title" required maxlength="120" placeholder="např. Pozdní příchody, Pomoc spolužákovi…" value="' + (n ? escapeHtml(n.title || '') : '') + '"></div>' +
      '<div class="field"><label>Důvod / popis</label><textarea name="reason" class="ta" rows="3" required placeholder="Co se stalo nebo za co záznam je…">' + (n ? escapeHtml(n.reason || '') : '') + '</textarea></div>' +
      '<div class="field"><label>Závažnost</label><select name="sev">' + NOTE_SEVS.map(s =>
        '<option value="' + s.id + '"' + (n && Number(n.sev) === s.id ? ' selected' : '') + '>' + s.label + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Datum</label><input name="date" type="date" value="' + (n ? n.date : todayISO()) + '"></div>' +
      '<div class="small-note" style="margin:0 0 12px">Závažnost <b>3 · závažná</b> se objeví rodičům a v pololetní klasifikaci (výchovná opatření).</div>' +
      '<div class="form-row-btns"><button class="btn btn-primary">' + ic('check', 15) + (n ? ' Uložit změny' : ' Přidat záznam') + '</button>' +
      '<button type="button" class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>' +
    '</form>');
}
/* přepínač typu záznamu: pochvaly/dutky nemají závažnost */
document.addEventListener('change', e => {
  const sel = e.target.closest('#note-rtype');
  if (!sel) return;
  const isRec = sel.value !== 'pozn';
  const fields = document.querySelectorAll('#note-rtype').length ? document.querySelector('form[data-form="t-note-add"]') : null;
  if (!fields) return;
  fields.querySelectorAll('.field').forEach(f => {
    const lbl = f.querySelector('label');
    if (!lbl) return;
    if (lbl.textContent.indexOf('Závažnost') === 0) f.style.display = isRec ? 'none' : 'flex';
  });
});
onAct('t-note-add', () => tNoteModalFor(null));
onAct('t-note-edit:', el => tNoteModalFor(el.getAttribute('data-act').slice(12)));
onAct('form:t-note-add', f => {
  const fd = new FormData(f);
  const sid = String(fd.get('sid'));
  const rtype = String(fd.get('rtype') || 'pozn');
  const title = String(fd.get('title') || '').trim();
  const reason = String(fd.get('reason') || '').trim();
  const sev = Math.min(3, Math.max(1, Number(fd.get('sev')) || 1));
  const date = String(fd.get('date')) || todayISO();
  if (!sid || !reason) { toast('Vyplňte název i důvod záznamu', 'bad'); return; }
  const st = studentOf(sid);
  /* pochvala / napomenutí / důtka → výchovná opatření (db.records) */
  if (rtype !== 'pozn' && REC_BY_ID[rtype]) {
    if (!title) { toast('Vyplňte i název záznamu', 'bad'); return; }
    recordsEnsure();
    db.records.push({ id: uid(), sid, type: rtype, reason: (title ? title + '\n' : '') + reason, date, sem: semOfDate(date), by: currentUser().id, ts: nowISO() });
    saveDB();
    if (st) {
      (db.users || []).forEach(uu => {
        if ((uu.role === 'student' && uu.studentId === sid) || (uu.role === 'rodic' && (uu.children || []).includes(sid))) {
          db.notifs.push({ userId: uu.id, type: 'grade', text: 'Nový zápis – ' + st.first + ': ' + REC_BY_ID[rtype].label, ts: nowISO(), route: 'poznamky' });
        }
      });
      saveDB();
    }
    closeModal();
    toast(REC_BY_ID[rtype].label + ' – žák i rodiče dostali oznámení ✓', 'ok');
    route();
    return;
  }
  if (!title) { toast('Vyplňte název poznámky', 'bad'); return; }
  notesEnsure();
  const id = uid();
  db.notes.push({ id, sid, title, reason, sev, date, by: currentUser().id, ts: nowISO() });
  saveDB();
  if (st) {
    (db.users || []).forEach(uu => {
      if ((uu.role === 'student' && uu.studentId === sid) || (uu.role === 'rodic' && (uu.children || []).includes(sid))) {
        db.notifs.push({ userId: uu.id, type: 'grade', text: 'Nová poznámka k žákovi ' + st.first + ': „' + title + '“ (závažnost ' + sev + ')', ts: nowISO(), route: 'poznamky' });
      }
    });
    saveDB();
  }
  closeModal();
  toast('Záznam přidán – žák i rodiče dostali oznámení ✓', 'ok');
  route();
});
onAct('form:t-note-edit', f => {
  const id = f.getAttribute('data-id');
  const n = (db.notes || []).find(x => x.id === id);
  if (!n) return;
  const fd = new FormData(f);
  n.sid = String(fd.get('sid'));
  n.title = String(fd.get('title') || '').trim();
  n.reason = String(fd.get('reason') || '').trim();
  n.sev = Math.min(3, Math.max(1, Number(fd.get('sev')) || 1));
  n.date = String(fd.get('date')) || n.date;
  saveDB();
  closeModal();
  toast('Poznámka upravena ✓', 'ok');
  route();
});
onAct('t-note-del:', el => {
  const id = el.getAttribute('data-act').slice(11);
  const n = (db.notes || []).find(x => x.id === id);
  if (!n) return;
  openModal('<h3>Smazat poznámku?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Poznámka <b>' + escapeHtml(n.title || '') + '</b> (žák ' + escapeHtml(studentFull(n.sid)) + ') se trvale odstraní.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="t-note-del-ok:' + id + '">' + ic('trash', 14) + ' Ano, smazat</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('t-note-del-ok:', el => {
  const id = el.getAttribute('data-act').slice(14);
  db.notes = (db.notes || []).filter(x => x.id !== id);
  saveDB();
  closeModal();
  toast('Poznámka smazána', 'bad');
  route();
});

/* ================= PLÁN AKCÍ (budoucí akce třídy / žáka) ================= */
function tPlanAkci() {
  clearTick();
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const cls = classOf(cid);
  const sts = studentsOfClass(cid);
  const acts = actionsOfClass(cid).slice().sort((a, z) => (a.date === z.date ? 0 : a.date < z.date ? -1 : 1));
  const future = acts.filter(a => daysUntilAction(a.date) >= 0);
  const past = acts.filter(a => daysUntilAction(a.date) < 0);
  const row = (a, isPast) => {
    const days = daysUntilAction(a.date);
    const target = a.sid ? 'jen: ' + studentFull(a.sid) : 'celá třída';
    return '<div class="list-row" style="align-items:flex-start"><span class="ava" style="background:linear-gradient(135deg,#F59E0B,#D97706)">' + ic('flag', 15) + '</span>' +
      '<div class="grow"><div class="row-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + escapeHtml(a.title) +
        (isPast ? '' : actionCountdownChip(days)) + '</div>' +
      (a.desc ? '<div style="margin-top:3px;white-space:pre-wrap">' + escapeHtml(a.desc) + '</div>' : '') +
      '<div class="row-sub">' + fmtDate(a.date) + (isPast ? ' · proběhlo' : '') + ' · ' + escapeHtml(target) + '</div></div>' +
      '<button class="icon-btn sm" data-act="t-act-edit:' + a.id + '" title="Upravit">' + ic('edit', 13) + '</button>' +
      '<button class="icon-btn sm" style="color:var(--bad)" data-act="t-act-del:' + a.id + '" title="Smazat">' + ic('trash', 13) + '</button></div>';
  };
  return '' +
  '<div class="page-head"><div><h1>Plán akcí</h1>' +
    '<div class="sub">' + escapeHtml(cls.name) + ' · budoucí akce třídy – žáci i rodiče vidí, co je čeká a co si mají připravit</div></div>' +
    '<div class="page-acts"><button class="btn btn-primary btn-sm" data-act="t-act-add">' + ic('plus', 15) + ' Nová akce</button></div></div>' +
  clsScopePills() +
  (sts.length || actionsOfClass(cid).length
    ? '<div class="card"><div class="card-title">' + ic('flag', 16) + ' Připravované akce' +
        '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">' + future.length + ' ' + csPlural(future.length, 'akce', 'akce', 'akcí') + '</span></div>' +
      (future.length ? '<div class="list">' + future.map(a => row(a, false)).join('') + '</div>' : '<div class="empty"><b>Zatím žádné naplánované akce</b>Výlet, soutěž, třídní schůzka… co přidáte, uvidí žáci i rodiče s odpočtem do začátku.</div>') +
      '</div>'
      + (past.length ? '<div class="card"><div class="card-title">' + ic('clock', 15) + ' Proběhlé akce' +
        '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:600">' + past.length + '</span></div>' +
        '<div class="list">' + past.map(a => row(a, true)).join('') + '</div></div>' : '')
    : '<div class="card"><div class="empty"><b>Ve třídě zatím nejsou žáci</b>Akce lze plánovat, jakmile třída existuje.</div></div>');
}
function tActModalFor(actionId) {
  const cid = activeClsId();
  const sts = studentsOfClass(cid);
  const a = actionId ? (db.actions || []).find(x => x.id === actionId) : null;
  if (actionId && !a) return;
  const minD = todayISO();
  openModal('<h3>' + (a ? 'Upravit akci' : 'Nová akce') + '</h3>' +
    '<form data-form="' + (a ? 't-act-edit' : 't-act-add') + '"' + (a ? ' data-id="' + a.id + '"' : '') + '>' +
      '<div class="field"><label>Název akce</label><input name="title" required maxlength="120" placeholder="např. Exkurze do Prahy, Vánoční besídka…" value="' + (a ? escapeHtml(a.title || '') : '') + '"></div>' +
      '<div class="field-row"><div class="field"><label>Datum</label><input name="date" type="date" min="' + minD + '" value="' + (a ? a.date : minD) + '" required></div>' +
      '<div class="field"><label>Pro koho</label><select name="sid"><option value=""' + (!a || !a.sid ? ' selected' : '') + '>Celá třída</option>' +
        sts.map(s => '<option value="' + s.id + '"' + (a && a.sid === s.id ? ' selected' : '') + '>' + escapeHtml(s.first + ' ' + s.last) + '</option>').join('') + '</select></div></div>' +
      '<div class="field"><label>Popis – co si připravit</label><textarea name="desc" class="ta" rows="3" placeholder="Sraz, co si vzít, pomůcky, vstupné…">' + (a ? escapeHtml(a.desc || '') : '') + '</textarea></div>' +
      '<div class="form-row-btns"><button class="btn btn-primary">' + ic('check', 15) + (a ? ' Uložit změny' : ' Přidat akci') + '</button>' +
      '<button type="button" class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>' +
    '</form>');
}
onAct('t-act-add', () => tActModalFor(null));
onAct('t-act-edit:', el => tActModalFor(el.getAttribute('data-act').slice(11)));
onAct('form:t-act-add', f => {
  const fd = new FormData(f);
  const title = String(fd.get('title') || '').trim();
  const date = String(fd.get('date'));
  const sid = String(fd.get('sid') || '');
  const desc = String(fd.get('desc') || '').trim();
  if (!title || !date) { toast('Zadejte název a datum akce', 'bad'); return; }
  actionsEnsure();
  db.actions.push({ id: uid(), cls: activeClsId(), sid: sid || null, title, desc, date, by: currentUser().id, ts: nowISO() });
  saveDB();
  closeModal();
  toast('Akce přidána – žáci a rodiče ji vidí v Plánu akcí ✓', 'ok');
  route();
});
onAct('form:t-act-edit', f => {
  const id = f.getAttribute('data-id');
  const a = (db.actions || []).find(x => x.id === id);
  if (!a) return;
  const fd = new FormData(f);
  a.title = String(fd.get('title') || '').trim();
  a.date = String(fd.get('date'));
  a.sid = String(fd.get('sid') || '') || null;
  a.desc = String(fd.get('desc') || '').trim();
  saveDB();
  closeModal();
  toast('Akce upravena ✓', 'ok');
  route();
});
onAct('t-act-del:', el => {
  const id = el.getAttribute('data-act').slice(10);
  const a = (db.actions || []).find(x => x.id === id);
  if (!a) return;
  openModal('<h3>Smazat akci?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Akce <b>' + escapeHtml(a.title || '') + '</b> (' + fmtDate(a.date) + ') se trvale odstraní z plánu.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="t-act-del-ok:' + id + '">' + ic('trash', 14) + ' Ano, smazat</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('t-act-del-ok:', el => {
  const id = el.getAttribute('data-act').slice(13);
  db.actions = (db.actions || []).filter(x => x.id !== id);
  saveDB();
  closeModal();
  toast('Akce smazána', 'bad');
  route();
});
registerView('ucitel', 'poznamky', tPoznamky);
registerView('ucitel', 'planakci', tPlanAkci);

/* ================= ZMĚNY V ROZVRHU (odpadlá hodina, změna místnosti / učitele / předmětu) ================= */
function tZmenyRozvrh() {
  clearTick();
  if (!myClasses().length) return noClassPrompt();
  const cid = activeClsId();
  const cls = classOf(cid);
  const date = localStorage.getItem('t_zr_date') || (isSchoolDay(todayISO()) ? todayISO() : nextSchoolDayISO(todayISO(), 0));
  const period = Number(localStorage.getItem('t_zr_period') || '0');
  const list = changesOfClass(cid).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const row = c => {
    let detail = '';
    if (c.kind === 'mistnost' && c.newRoom) {
      const r = roomsList().find(x => x.id === c.newRoom);
      detail = 'nová místnost: ' + (r ? r.name : '?');
    } else if (c.kind === 'ucitel' && c.newTeacher) detail = 'nový učitel: ' + c.newTeacher;
    else if (c.kind === 'predmet' && c.newSubj) detail = 'náhrada: ' + subjectName(c.newSubj);
    return '<div class="list-row"><span class="chip chip-bad">' + changeShortLabel(c) + '</span>' +
      '<div class="grow"><div class="row-title">' + fmtDate(c.date) + ' · ' + (c.period + 1) + '. hodina</div>' +
      '<div class="row-sub">' + escapeHtml([detail, c.reason].filter(Boolean).join(' · ')) + '</div></div>' +
      '<button class="icon-btn sm" style="color:var(--bad)" data-act="t-chg-del:' + c.id + '" title="Smazat změnu">' + ic('trash', 13) + '</button></div>';
  };
  return '' +
  '<div class="page-head"><div><h1>Změny v rozvrhu</h1>' +
    '<div class="sub">' + escapeHtml(cls.name) + ' · odpadlá hodina, změna místnosti, učitele nebo předmětu – žáci i rodiče změnu hned uvidí v rozvrhu</div></div></div>' +
  clsScopePills() +
  '<div class="grid grid-2">' +
    '<div class="card"><div class="card-title">' + ic('plus', 16) + ' Nová změna</div>' +
      '<div class="field-row"><div class="field"><label>Datum</label><input type="date" class="txt" value="' + date + '" data-chg="t-zr-date"></div>' +
      '<div class="field"><label>Číslo hodiny</label><select class="sel" data-chg="t-zr-period">' +
        scheduleSlots(cid).map((sl, i) => '<option value="' + i + '"' + (i === period ? ' selected' : '') + '>' + (i + 1) + '. hod. (' + sl.s + '–' + sl.e + ')</option>').join('') + '</select></div></div>' +
      '<div class="field"><label>Typ změny</label><select class="sel" id="zr-kind">' +
        CHANGE_KINDS.map(k => '<option value="' + k.id + '">' + k.label + '</option>').join('') + '</select></div>' +
      '<div class="field" id="zr-room-wrap" style="display:none"><label>Nová místnost</label><select class="sel" id="zr-room">' +
        roomsList().map(r => '<option value="' + r.id + '">' + escapeHtml(r.name + (r.short ? ' (' + r.short + ')' : '')) + '</option>').join('') + '</select></div>' +
      '<div class="field" id="zr-teacher-wrap" style="display:none"><label>Jméno nového učitele</label><input class="txt" id="zr-teacher" placeholder="Např. Mgr. Nováková"></div>' +
      '<div class="field" id="zr-subj-wrap" style="display:none"><label>Nový předmět (náhrada)</label><select class="sel" id="zr-subj">' +
        SUBJ_KEYS.map(s => '<option value="' + s + '">' + escapeHtml(SUBJECTS[s].name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Důvod</label><input class="txt" id="zr-reason" placeholder="Např. nemoc učitele, školení…"></div>' +
      '<button class="btn btn-primary" data-act="t-zr-save">' + ic('check', 15) + ' Uložit změnu</button>' +
      '<div class="small-note" style="margin-top:10px">Změna se týká jen hodin, které má třída v rozvrhu. Žáci a rodiče uvidí změnu červeně v Rozvrhu a dostanou oznámení.</div>' +
    '</div>' +
    '<div class="card"><div class="card-title">' + ic('bell', 16) + ' Změny třídy (' + list.length + ')</div>' +
      (list.length ? '<div class="list">' + list.map(row).join('') + '</div>'
        : '<div class="empty"><b>Žádné změny</b>Když hodina odpadne nebo se něco změní, přidejte to tady – žáci a rodiče to uvidí červeně v rozvrhu.</div>') +
    '</div>' +
  '</div>';
}
onAct('t-zr-date', el => { localStorage.setItem('t_zr_date', el.value); route(); });
onAct('t-zr-period', el => { localStorage.setItem('t_zr_period', el.value); route(); });
document.addEventListener('change', e => {
  const kind = e.target.closest('#zr-kind');
  if (!kind) return;
  const v = kind.value;
  const show = { 'zr-room-wrap': v === 'mistnost', 'zr-teacher-wrap': v === 'ucitel', 'zr-subj-wrap': v === 'predmet' };
  Object.keys(show).forEach(id => { const el = document.getElementById(id); if (el) el.style.display = show[id] ? 'flex' : 'none'; });
});
onAct('t-zr-save', () => {
  const cid = activeClsId();
  const date = localStorage.getItem('t_zr_date') || (isSchoolDay(todayISO()) ? todayISO() : nextSchoolDayISO(todayISO(), 0));
  const period = Number(localStorage.getItem('t_zr_period') || '0');
  const kind = ((document.getElementById('zr-kind') || {}).value) || 'odpadla';
  const reason = (((document.getElementById('zr-reason') || {}).value) || '').trim();
  const en = scheduleEntry(cid, date, period);
  if (!en || !en.subj) { toast('V tento den a hodinu má třída volno – změna se týká jen naplánovaných hodin', 'warn'); return; }
  if (!reason) { toast('Napište důvod změny', 'warn'); return; }
  let newRoom = null, newTeacher = null, newSubj = null;
  if (kind === 'mistnost') { newRoom = (document.getElementById('zr-room') || {}).value || null; if (!newRoom) { toast('Vyberte novou místnost', 'warn'); return; } }
  if (kind === 'ucitel') { newTeacher = (((document.getElementById('zr-teacher') || {}).value) || '').trim(); if (!newTeacher) { toast('Napište jméno nového učitele', 'warn'); return; } }
  if (kind === 'predmet') { newSubj = (document.getElementById('zr-subj') || {}).value || null; if (!newSubj) { toast('Vyberte nový předmět', 'warn'); return; } }
  changesEnsure();
  db.changes.push({ id: uid(), cls: cid, date, period, kind, reason, newRoom, newTeacher, newSubj, by: currentUser().id, ts: nowISO() });
  /* oznámení žákům i rodičům třídy */
  const kids = studentsOfClass(cid);
  (db.users || []).forEach(uu => {
    const hit = (uu.role === 'student' && kids.some(s => s.id === uu.studentId)) ||
      (uu.role === 'rodic' && (uu.children || []).some(sid2 => kids.some(s => s.id === sid2)));
    if (hit) db.notifs.push({ userId: uu.id, type: 'msg', text: 'Změna v rozvrhu – ' + fmtDate(date) + ', ' + (period + 1) + '. hodina (' + changeShortLabel({ kind }) + ')', ts: nowISO(), route: 'rozvrh' });
  });
  saveDB();
  toast('Změna v rozvrhu uložena – žáci i rodiče ji uvidí ✓', 'ok');
  route();
});
onAct('t-chg-del:', el => {
  const id = el.getAttribute('data-act').slice(10);
  db.changes = (db.changes || []).filter(x => x.id !== id);
  saveDB();
  toast('Změna smazána', 'bad');
  route();
});
registerView('ucitel', 'zmenyrozvrh', tZmenyRozvrh);
