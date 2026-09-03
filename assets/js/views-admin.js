/* ============================================================
   LukySchool — SPRÁVA ŠKOLY (ředitelský účet admin)
   Třídy · Učitelé · Žáci (generované přihlašovací údaje) · data
   Učitelé (bez isAdmin) sem přístup nemají – modul se jim nezobrazí.
   ============================================================ */
'use strict';

let SP_TAB = localStorage.getItem('sprava_tab') || 'classes';

function spravaHome() {
  const u = currentUser();
  if (!u || !u.isAdmin) {
    return '<div class="card"><div class="empty"><b>Nemáte oprávnění</b>Správa školy je přístupná jen ředitelskému účtu (admin). Učitelé mají vlastní modul.</div></div>';
  }
  const cls = db.classes || [];
  const teachers = db.users.filter(x => x.role === 'ucitel');
  const students = db.students || [];
  const pendingResets = (db.resetReq || []).filter(r => r.status === 'ceka').length;
  const tabs = [
    { k: 'classes', label: 'Třídy (' + cls.length + ')' },
    { k: 'teachers', label: 'Učitelé (' + teachers.length + ')' },
    { k: 'students', label: 'Žáci (' + students.length + ')' },
    { k: 'resets', label: 'Žádosti o reset' + (pendingResets ? ' (' + pendingResets + ')' : '') },
    { k: 'data', label: 'Data a release' }
  ];
  return '' +
    '<div class="page-head"><div><h1>Správa školy</h1>' +
      '<div class="sub">Třídy, učitelé a žáci · přihlašovací údaje se generují automaticky</div></div></div>' +
    '<div class="grid grid-4" style="margin-bottom:16px">' +
      '<div class="stat"><span class="s-ic" style="background:rgba(59,130,246,.14);color:var(--accent)">' + ic('home', 20) + '</span><div><b>' + cls.length + '</b><span>tříd</span></div></div>' +
      '<div class="stat"><span class="s-ic" style="background:rgba(139,92,246,.14);color:#A78BFA">' + ic('users', 20) + '</span><div><b>' + teachers.length + '</b><span>učitelů</span></div></div>' +
      '<div class="stat"><span class="s-ic" style="background:rgba(245,158,11,.14);color:var(--warn)">' + ic('book', 20) + '</span><div><b>' + students.length + '</b><span>žáků</span></div></div>' +
      '<div class="stat"><span class="s-ic" style="background:rgba(16,185,129,.14);color:var(--ok)">' + ic('zap', 20) + '</span><div><b>' + db.columns.length + '</b><span>sloupců známek</span></div></div>' +
    '</div>' +
    '<div class="tabs">' + tabs.map(t =>
      '<button class="tab' + (SP_TAB === t.k ? ' active' : '') + '" data-act="sp-tab:' + t.k + '">' + t.label + '</button>').join('') +
    '</div>' +
    (SP_TAB === 'classes' ? spClasses() : SP_TAB === 'teachers' ? spTeachers() : SP_TAB === 'students' ? spStudents() : SP_TAB === 'resets' ? spResets() : spData());
}
onAct('sp-tab:', el => { SP_TAB = el.getAttribute('data-act').slice(7); localStorage.setItem('sprava_tab', SP_TAB); route(); });

/* ---------- TŘÍDY ---------- */
function spClasses() {
  const cls = db.classes || [];
  return '<div class="page-acts" style="margin-bottom:14px"><button class="btn btn-primary btn-sm" data-act="sp-cls-add">' + ic('plus', 15) + ' Přidat třídu</button></div>' +
    (cls.length
      ? '<div class="grid grid-2">' + cls.map(c => {
          const t = teachersOfClass(c.id);
          const main = (db.users || []).find(x => x.id === c.mainTeacher);
          const sts = studentsOfClass(c.id);
          return '<div class="card">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
              '<span class="chip chip-accent" style="font-size:15px;padding:7px 14px">' + escapeHtml(c.name) + '</span>' +
              '<button class="icon-btn sm" data-act="sp-cls-edit:' + c.id + '" title="Upravit">' + ic('edit', 15) + '</button>' +
              '<button class="icon-btn sm" data-act="sp-cls-del:' + c.id + '" title="Smazat třídu" style="color:var(--bad)">' + ic('trash', 15) + '</button>' +
              '<span style="margin-left:auto;color:var(--muted);font-size:13px;font-weight:700">' + sts.length + ' žáků</span>' +
            '</div>' +
            '<div class="field"><label>Třídní učitel</label><select class="sel" data-chg="sp-cls-main:' + c.id + '">' +
              '<option value="">— žádný —</option>' +
              (db.users || []).filter(x => x.role === 'ucitel').map(x =>
                '<option value="' + x.id + '"' + (c.mainTeacher === x.id ? ' selected' : '') + '>' + escapeHtml(x.name) + ' (' + escapeHtml(x.username) + ')</option>').join('') +
            '</select></div>' +
            '<div class="small-note">Učí: ' + (t.length ? t.map(x => escapeHtml(x.name)).join(', ') : 'nikdo – přiřaďte učitele') + '</div>' +
            '</div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Zatím žádná třída</b>Přidejte první třídu, např. 1. A.</div>');
}
onAct('sp-cls-add', () => {
  openModal(
    '<h3>Nová třída</h3>' +
    '<form data-form="sp-cls-create">' +
      '<div class="field"><label>Název třídy</label><input name="name" placeholder="Např. 1. A" required autofocus></div>' +
      '<div class="field"><label>Třídní učitel (volitelné)</label><select name="main"><option value="">— zatím žádný —</option>' +
        db.users.filter(x => x.role === 'ucitel').map(x => '<option value="' + x.id + '">' + escapeHtml(x.name) + '</option>').join('') + '</select></div>' +
      '<button class="btn btn-primary">Vytvořit třídu</button>' +
    '</form>');
});
onAct('form:sp-cls-create', f => {
  const name = String(new FormData(f).get('name')).trim();
  const main = String(new FormData(f).get('main')) || null;
  if (!name) { toast('Zadejte název třídy', 'bad'); return; }
  if (db.classes.some(c => c.id === name)) { toast('Třída „' + escapeHtml(name) + '“ už existuje', 'bad'); return; }
  const c = { id: name, name, teacherIds: main ? [main] : [], mainTeacher: main };
  db.classes.push(c);
  saveDB();
  closeModal();
  toast('Třída „' + escapeHtml(name) + '“ vytvořena ✓', 'ok');
  route();
});
onAct('sp-cls-main:', el => {
  const cid = el.getAttribute('data-act').slice(12);
  const uid2 = el.value;
  const c = classOf(cid);
  if (!c) return;
  if (uid2) {
    if (!(c.teacherIds || []).includes(uid2)) c.teacherIds.push(uid2);
    c.mainTeacher = uid2;
  } else {
    c.mainTeacher = null;
  }
  saveDB();
  toast('Třídní učitel uložen');
});
onAct('sp-cls-edit:', el => {
  const c = classOf(el.getAttribute('data-act').slice(12));
  if (!c) return;
  openModal(
    '<h3>Upravit třídu</h3>' +
    '<form data-form="sp-cls-rename">' +
      '<input type="hidden" name="id" value="' + c.id + '">' +
      '<div class="field"><label>Název třídy</label><input name="name" value="' + escapeHtml(c.name) + '" required></div>' +
      '<button class="btn btn-primary">Uložit</button>' +
    '</form>');
});
onAct('form:sp-cls-rename', f => {
  const cid = String(new FormData(f).get('id'));
  const name = String(new FormData(f).get('name')).trim();
  if (!cid || !name) return;
  if (db.classes.some(x => x.id === name && x.id !== cid)) { toast('Třída „' + escapeHtml(name) + '“ už existuje', 'bad'); return; }
  const ok = renameClassCascade(cid, name);
  closeModal();
  if (ok) { toast('Třída přejmenována ✓ – rozvrh, známky i kniha se přesunuly', 'ok'); route(); }
});
function confirmDeleteClass(id) {
  const c = classOf(id);
  if (!c) return;
  openModal(
    '<h3>Smazat třídu „' + escapeHtml(c.name) + '“?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Smažou se i všichni žáci třídy, jejich účty, známky i docházka. Tuto akci nelze vrátit.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="sp-cls-del-ok:' + id + '">' + ic('trash', 15) + ' Smazat</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
}
onAct('sp-cls-del:', el => confirmDeleteClass(el.getAttribute('data-act').slice(11)));
onAct('sp-cls-del-ok:', el => {
  const id = el.getAttribute('data-act').slice(14);
  studentsOfClass(id).forEach(s => removeStudentCascade(s.id));
  db.classes = (db.classes || []).filter(c => c.id !== id);
  delete db.schedule[id];
  db.columns = (db.columns || []).filter(c => c.cls !== id);
  saveDB();
  closeModal();
  toast('Třída smazána', 'bad');
  route();
});

/* ---------- UČITELÉ ---------- */
function spTeachers() {
  const ts = db.users.filter(x => x.role === 'ucitel');
  return '<div class="page-acts" style="margin-bottom:14px"><button class="btn btn-primary btn-sm" data-act="sp-teach-add">' + ic('plus', 15) + ' Přidat učitele</button></div>' +
    (ts.length
      ? '<div class="list">' + ts.map(t => {
          const clsTaught = (db.classes || []).filter(c => (c.teacherIds || []).includes(t.id));
          return '<div class="list-row">' +
            '<span class="ava" style="background:linear-gradient(135deg,#8B5CF6,#3B82F6)">' + escapeHtml(t.name.charAt(0)) + '</span>' +
            '<div class="grow"><div class="row-title">' + escapeHtml(t.name) + (t.isAdmin ? ' <span class="chip chip-accent" style="padding:0 7px;font-size:10px">správce</span>' : '') + '</div>' +
            '<div class="row-sub">přihlášení: <code class="mono">' + escapeHtml(t.username) + '</code> · učí: ' + (clsTaught.length ? clsTaught.map(c => escapeHtml(c.name)).join(', ') : '<span style="color:var(--warn)">zatím žádnou třídu</span>') + '</div></div>' +
            '<button class="btn btn-soft btn-sm" data-act="sp-creds:' + t.username + '">' + ic('eye', 14) + ' Přihlášení</button>' +
            (!t.isAdmin ? '<button class="icon-btn sm" data-act="sp-teach-del:' + t.id + '" style="color:var(--bad)">' + ic('trash', 15) + '</button>' : '') +
            '</div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Žádní učitelé</b>Přidejte učitele a přiřaďte mu třídu – dostane vlastní přihlášení.</div>');
}
onAct('sp-teach-add', () => {
  openModal(
    '<h3>Nový učitel</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Učitel dostane vlastní přihlášení a učitelský modul pro svoje třídy.</p>' +
    '<form data-form="sp-teach-create">' +
      '<div class="field-row">' +
        '<div class="field"><label>Jméno</label><input name="first" placeholder="Petr" required></div>' +
        '<div class="field"><label>Příjmení</label><input name="last" placeholder="Dostál" required></div>' +
      '</div>' +
      '<div class="field"><label>Třída (třídní učitelství)</label><select name="cls">' +
        '<option value="">— zatím bez třídy —</option>' +
        db.classes.map(c => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Uživatelské jméno</label><input name="username" placeholder="nech prázdné = vygeneruje se (petr.dostal)" style="font-family:monospace"></div>' +
      '<div class="field"><label>Heslo</label><div style="display:flex;gap:8px"><input name="pass" placeholder="nech prázdné = náhodné heslo" style="font-family:monospace;flex:1">' +
      '<button type="button" class="btn btn-soft btn-sm" data-act="gen-pass">' + ic('zap', 14) + ' Náhodné</button></div></div>' +
      '<button class="btn btn-primary">Vytvořit účet učitele</button>' +
    '</form>');
});
onAct('form:sp-teach-create', f => {
  const fd = new FormData(f);
  const first = String(fd.get('first')).trim();
  const last = String(fd.get('last')).trim();
  if (!first || !last) { toast('Vyplňte jméno a příjmení', 'bad'); return; }
  const clsId = String(fd.get('cls')) || null;
  const passIn = String(fd.get('pass')).trim();
  const user = addUserAccount(
    String(fd.get('username')).trim() || genUsername(first, last),
    passIn || genPassword(),
    'ucitel',
    { name: first + ' ' + last, note: clsId ? 'třídní učitel ' + clsId : 'učitel', isAdmin: false }
  );
  if (clsId) {
    const c = classOf(clsId);
    if (c) {
      if (!(c.teacherIds || []).includes(user.id)) c.teacherIds.push(user.id);
      if (!c.mainTeacher) c.mainTeacher = user.id;
    }
  }
  saveDB();
  closeModal();
  showCreds(user);
  toast('Účet učitele vytvořen ✓', 'ok');
  route();
});
onAct('sp-teach-del:', el => {
  const t = db.users.find(x => x.id === el.getAttribute('data-act').slice(13));
  if (!t) return;
  openModal('<h3>Smazat učitele „' + escapeHtml(t.name) + '“?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Učitel ztratí přístup do aplikace a odebere se ze tříd.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="sp-teach-del-ok:' + t.id + '">Smazat</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('sp-teach-del-ok:', el => {
  const t = db.users.find(x => x.id === el.getAttribute('data-act').slice(16));
  if (!t) return;
  removeTeacherCascade(t.id);
  closeModal();
  toast('Učitel smazán', 'bad');
  route();
});

/* ---------- ŽÁCI ---------- */
function spStudents() {
  const groups = {};
  (db.students || []).forEach(s => { (groups[s.cls] = groups[s.cls] || []).push(s); });
  const clsNames = Object.keys(groups).sort();
  return '<div class="page-acts" style="margin-bottom:14px"><button class="btn btn-primary btn-sm" data-act="sp-stud-add">' + ic('plus', 15) + ' Přidat žáka</button></div>' +
    (clsNames.length
      ? clsNames.map(cl => {
          const c = classOf(cl);
          return '<div class="card"><div class="card-title">' + ic('home', 16) + ' ' + escapeHtml(c ? c.name : cl) +
            '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:700">' + groups[cl].length + ' žáků</span></div>' +
            '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Žák</th><th>Přihlašovací jméno</th><th>IVP</th><th style="width:180px"></th></tr></thead><tbody>' +
            groups[cl].map(s => {
              const acc = (db.users || []).find(u => u.role === 'student' && u.studentId === s.id);
              const par = parentOfStudent(s.id);
              return '<tr><td>' + escapeHtml(s.first + ' ' + s.last) + '</td>' +
                '<td><code class="mono">' + escapeHtml(acc ? acc.username : '—') + '</code>' + (acc ? ' <button class="btn btn-soft btn-sm" data-act="sp-creds:' + acc.username + '" title="Přihlášení žáka">' + ic('eye', 13) + '</button>' : '') + '</td>' +
                '<td>' + (s.ivp ? '<span class="chip chip-info">IVP</span>' : '') + '</td>' +
                '<td style="text-align:right;white-space:nowrap">' +
                  '<button class="btn btn-soft btn-sm" data-act="sp-par:' + s.id + '" title="' + (par ? 'Přihlášení rodiče (' + escapeHtml(par.username) + ')' : 'Vytvořit rodičovský účet') + '">' + ic(par ? 'eye' : 'users', 13) + ' <span style="font-size:12px">' + (par ? 'Rodič ✓' : 'Rodič') + '</span></button>' +
                  ' <button class="icon-btn sm" data-act="sp-stud-del:' + s.id + '" style="color:var(--bad)" title="Smazat žáka">' + ic('trash', 15) + '</button>' +
                '</td></tr>';
            }).join('') + '</tbody></table></div></div>';
        }).join('')
      : '<div class="empty"><b>Zatím žádní žáci</b>Přidejte žáka – aplikace mu vygeneruje přihlašovací údaje.</div>');
}
function openAddStudentModal(defaultCls) {
  const clsList = db.classes;
  openModal(
    '<h3>Nový žák</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Po uložení se vygeneruje žákovský účet (přihlášení uvidíte jednou).</p>' +
    '<form data-form="sp-stud-create">' +
      '<div class="field-row">' +
        '<div class="field"><label>Jméno</label><input name="first" required placeholder="Jan"></div>' +
        '<div class="field"><label>Příjmení</label><input name="last" required placeholder="Novák"></div>' +
      '</div>' +
      '<div class="field"><label>Třída</label><select name="cls" required>' +
        (clsList.length ? clsList.map(c => '<option value="' + c.id + '"' + (c.id === defaultCls ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>').join('') : '<option value="">— nejdřív vytvořte třídu —</option>') +
      '</select></div>' +
      '<div class="field"><label>Uživatelské jméno (volitelné)</label><input name="username" placeholder="prázdné = vygeneruje se (jan.novak)" style="font-family:monospace"></div>' +
      '<div class="field"><label>Heslo (volitelné)</label><div style="display:flex;gap:8px"><input name="pass" placeholder="prázdné = náhodné heslo" style="font-family:monospace;flex:1">' +
      '<button type="button" class="btn btn-soft btn-sm" data-act="gen-pass">' + ic('zap', 14) + ' Náhodné</button></div></div>' +
      '<div class="field"><label>IVP / podpůrná opatření</label><select name="ivp"><option value="">Ne</option><option value="1">Ano – žák s IVP</option></select></div>' +
      '<button class="btn btn-primary">Vytvořit žáka + účet</button>' +
    '</form>');
}
onAct('sp-stud-add', () => openAddStudentModal(null));
function createStudent(first, last, clsId, usernameIn, passIn, ivp) {
  const st = { id: uid(), first, last, cls: clsId, ivp: !!ivp, demo: false };
  db.students.push(st);
  const acc = addUserAccount(usernameIn || genUsername(first, last), passIn || genPassword(), 'student', {
    name: first + ' ' + last, note: clsId, studentId: st.id, isAdmin: false
  });
  saveDB();
  return { st, acc };
}
onAct('form:sp-stud-create', f => {
  const fd = new FormData(f);
  const first = String(fd.get('first')).trim();
  const last = String(fd.get('last')).trim();
  const clsId = String(fd.get('cls'));
  if (!first || !last) { toast('Vyplňte jméno a příjmení', 'bad'); return; }
  if (!clsId) { toast('Nejdřív vytvořte třídu', 'bad'); return; }
  const { acc } = createStudent(first, last, clsId, String(fd.get('username')).trim(), String(fd.get('pass')).trim(), String(fd.get('ivp')) === '1');
  closeModal();
  showCreds(acc);
  toast('Žák vytvořen ✓', 'ok');
  route();
});
onAct('sp-stud-del:', el => {
  const s = studentOf(el.getAttribute('data-act').slice(12));
  if (!s) return;
  openModal('<h3>Smazat žáka „' + escapeHtml(s.first + ' ' + s.last) + '“?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Smaže se i žákovský účet, známky a docházka.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="sp-stud-del-ok:' + s.id + '">Smazat</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('sp-stud-del-ok:', el => {
  const sid = el.getAttribute('data-act').slice(15);
  removeStudentCascade(sid);
  closeModal();
  toast('Žák smazán', 'bad');
  route();
});

/* ---------- RODIČOVSKÉ ÚČTY ---------- */
function parentOfStudent(sid) {
  return (db.users || []).find(u => u.role === 'rodic' && (u.children || []).includes(sid));
}
function parentKidsLabel(u) {
  return (u.children || []).map(id => {
    const s = studentOf(id);
    return s ? escapeHtml(s.first + ' ' + s.last) : '?';
  }).join(', ');
}
onAct('sp-par:', el => {
  const sid = el.getAttribute('data-act').slice(7);
  const st = studentOf(sid);
  if (!st) return;
  const par = parentOfStudent(sid);
  if (par) { showCreds(par); return; }
  const existing = (db.users || []).filter(u => u.role === 'rodic');
  openModal(
    '<h3>Rodičovský účet · ' + escapeHtml(st.first + ' ' + st.last) + '</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Vytvoří se rodičovský účet (přehled známek, omluvenky, zprávy učitelů) – nebo k tomuto žákovi připojte už existující účet rodiče (více dětí = jeden účet).</p>' +
    '<form data-form="sp-par-create">' +
      '<input type="hidden" name="sid" value="' + sid + '">' +
      '<div class="field"><label>Rodičovský účet</label><select name="parent">' +
        '<option value="">— vytvořit nový účet (přihlášení se vygeneruje) —</option>' +
        existing.map(u => '<option value="' + u.id + '">' + escapeHtml(u.name) + (u.children && u.children.length ? ' · ' + parentKidsLabel(u) : '') + '</option>').join('') +
      '</select></div>' +
      '<button class="btn btn-primary">' + ic('arrowR', 15) + ' Pokračovat</button>' +
    '</form>');
});
onAct('form:sp-par-create', f => {
  const fd = new FormData(f);
  const sid = String(fd.get('sid'));
  const st = studentOf(sid);
  if (!st) return;
  const selId = String(fd.get('parent'));
  let par = null;
  if (selId) {
    par = (db.users || []).find(u => u.id === selId && u.role === 'rodic');
    if (!par) return;
    if (!(par.children || []).includes(sid)) { (par.children = par.children || []).push(sid); }
    saveDB(); closeModal(); showCreds(par);
    toast('Žák připojen k účtu rodiče ✓', 'ok'); route(); return;
  }
  const acc = (db.users || []).find(u => u.role === 'student' && u.studentId === sid);
  par = addUserAccount((acc ? acc.username : genUsername(st.first, st.last)) + '.rodic', genPassword(), 'rodic', {
    name: 'Rodič · ' + st.first + ' ' + st.last, note: st.cls, isAdmin: false, children: [sid]
  });
  saveDB(); closeModal(); showCreds(par);
  toast('Rodičovský účet vytvořen ✓', 'ok'); route();
});

/* ---------- přihlašovací údaje ---------- */
function showCreds(user) {
  openModal(
    '<h3>Přihlašovací údaje</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Ukažte je uživateli – z bezpečnostních důvodů se heslo zobrazí jen tady.</p>' +
    '<div class="list" style="margin-bottom:14px">' +
      '<div class="list-row"><span style="min-width:90px;font-weight:800">Uživatel</span><code class="mono grow">' + escapeHtml(user.username) + '</code>' +
        '<button class="btn btn-soft btn-sm" data-act="copy:' + escapeHtml(user.username) + '">' + ic('check', 13) + ' Kopírovat</button></div>' +
      '<div class="list-row"><span style="min-width:90px;font-weight:800">Heslo</span><code class="mono grow">' + escapeHtml(user.pass) + '</code>' +
        '<button class="btn btn-soft btn-sm" data-act="copy:' + escapeHtml(user.pass) + '">' + ic('check', 13) + ' Kopírovat</button></div>' +
    '</div>' +
    '<button class="btn btn-primary" data-act="close-modal">Hotovo</button>');
}
onAct('copy:', el => {
  const text = el.getAttribute('data-act').slice(5);
  navigator.clipboard.writeText(text).then(() => toast('Zkopírováno do schránky ✓', 'ok')).catch(() => toast('Kopírování se nezdařilo', 'bad'));
});
onAct('sp-creds:', el => {
  const u = db.users.find(x => x.username === el.getAttribute('data-act').slice(9));
  if (u) showCreds(u);
});
onAct('gen-pass', () => {
  const inp = document.querySelector('form[data-form] input[name="pass"]');
  if (inp) inp.value = genPassword();
});

/* ---------- data a release ---------- */
function spData() {
  return '<div class="card" style="max-width:640px">' +
    '<div class="card-title">' + ic('trash', 16) + ' Vyčistit celou školu (čistý start)</div>' +
    '<p class="small-note" style="margin:0 0 12px">Smaže všechny třídy, učitele, žáky, známky, rozvrhy i zprávy. Zůstane pouze ředitelský účet <code class="mono">admin</code>. Školu pak postavíte přes Správu: třída → učitel → žáci.</p>' +
    '<button class="btn btn-bad" data-act="sp-wipe">' + ic('trash', 15) + ' Vyčistit školu</button>' +
    '<div class="small-note" style="margin-top:12px">Pozor: data se ukládají v prohlížeči (localStorage). Před čistěním si případně udělejte export – viz návod DATABAZE.md.</div>' +
  '</div>';
}
onAct('sp-wipe', () => {
  openModal('<h3>Opravdu vyčistit celou školu?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Všechna data (třídy, žáci, učitelé, známky, zprávy) budou nenávratně smazána. Doporučeno až před skutečným spuštěním.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="sp-wipe-ok">Ano, smazat vše</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('sp-wipe-ok', () => {
  wipeSchool();
  closeModal();
  location.hash = '#/ucitel/sprava';
  route();
  toast('Škola vyčištěna – začněte přidáním třídy', 'ok');
});

/* ---------- ŽÁDOSTI O RESET HESLA ---------- */
function spResets() {
  const reqs = (db.resetReq || []).slice()
    .sort((a, b) => (a.status === b.status ? (a.ts < b.ts ? 1 : -1) : (a.status === 'ceka' ? -1 : 1)));
  return '<div class="page-head"><div><h1>Žádosti o reset hesla</h1>' +
    '<div class="sub">Klikněte na žádost – ověřte, že účet existuje, a resetujte heslo. Nové heslo pak předá třídní učitel.</div></div></div>' +
    (reqs.length
      ? '<div class="list">' + reqs.map(r => {
          const acc = accByLogin(r.login);
          return '<div class="list-row">' +
            '<span class="chip ' + (r.status === 'ceka' ? 'chip-accent' : '') + '">' + (r.status === 'ceka' ? 'čeká' : 'vyřízeno') + '</span>' +
            '<div class="grow"><div class="row-title"><code class="mono">' + escapeHtml(r.login) + '</code>' + (acc ? ' · ' + escapeHtml(acc.name) : '') + '</div>' +
            '<div class="row-sub">' + tsLabel(r.ts) + (r.status === 'vyrizeno' && r.newPass ? ' · nové heslo: <code class="mono">' + escapeHtml(r.newPass) + '</code>' : '') + '</div></div>' +
            '<button class="btn btn-soft btn-sm" data-act="sp-req-open:' + r.id + '">' + ic(r.status === 'ceka' ? 'zap' : 'eye', 14) + ' ' + (r.status === 'ceka' ? 'Vyřídit' : 'Detail') + '</button>' +
            '</div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Žádné žádosti</b>Když někdo na přihlašování klikne na „Zapomněl jsem heslo“, objeví se žádost tady.</div>');
}
function accByLogin(login) {
  const l = String(login || '').trim().toLowerCase();
  return (db.users || []).find(u => u.username.toLowerCase() === l) || null;
}
function resetWhoText(acc) {
  if (acc.role === 'student') {
    const st = studentOf(acc.studentId);
    return 'Žák ' + (st ? st.first + ' ' + st.last : acc.name);
  }
  if (acc.role === 'rodic') {
    const sid = (acc.children || [])[0];
    const st = sid ? studentOf(sid) : null;
    return 'Rodič (' + (st ? st.first + ' ' + st.last : 'dítě?') + ')';
  }
  return 'Učitel ' + acc.name;
}
function resetTargetTeacher(acc) {
  if (acc.role === 'student') return classTeacherOf(acc.studentId);
  if (acc.role === 'rodic') {
    const sid = (acc.children || [])[0];
    return sid ? classTeacherOf(sid) : null;
  }
  return null;
}
onAct('sp-req-open:', el => {
  const r = (db.resetReq || []).find(x => x.id === el.getAttribute('data-act').slice(12));
  if (!r) return;
  const acc = accByLogin(r.login);
  let body = '<div class="list" style="margin-bottom:14px"><div class="list-row"><span style="min-width:90px;font-weight:800">Login</span><code class="mono grow">' + escapeHtml(r.login) + '</code></div>' +
    '<div class="list-row"><span style="min-width:90px;font-weight:800">Žádost</span><span class="grow">' + tsLabel(r.ts) + '</span></div></div>';
  if (acc) {
    body += '<p class="small-note" style="margin-bottom:14px">Účet <b>' + escapeHtml(acc.username) + '</b> existuje – ' + escapeHtml(resetWhoText(acc)) + '.</p>';
    if (r.status === 'ceka') {
      body += '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" data-act="sp-req-reset:' + r.id + '">' + ic('zap', 15) + ' Resetovat heslo (nové vygenerované)</button>' +
        '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>';
    } else {
      body += '<div class="ok-line" style="margin-bottom:14px">' + ic('check', 15) + ' <span>Heslo bylo resetováno' + (r.newPass ? ' na <code class="mono">' + escapeHtml(r.newPass) + '</code>' : '') + (r.teacherId ? ' – zpráva byla odeslána třídnímu učiteli.' : ' – žádný třídní učitel není přiřazen.') + '</span></div>' +
        '<button class="btn btn-ghost" data-act="sp-req-del:' + r.id + '">Smazat žádost</button>';
    }
  } else {
    body += '<p class="small-note" style="margin-bottom:14px;color:var(--bad)"><b>Účet s loginem „' + escapeHtml(r.login) + '“ neexistuje.</b> Možná byl smazán, nebo je login zapsaný jinak.</p>' +
      '<button class="btn btn-ghost" data-act="sp-req-del:' + r.id + '">Smazat žádost</button>';
  }
  openModal('<h3>Žádost o reset hesla</h3>' + body);
});
onAct('sp-req-reset:', el => {
  const r = (db.resetReq || []).find(x => x.id === el.getAttribute('data-act').slice(13));
  if (!r) return;
  const acc = accByLogin(r.login);
  if (!acc || r.status !== 'ceka') return;
  const np = genPassword();
  acc.pass = np;
  r.status = 'vyrizeno';
  r.doneTs = nowISO();
  r.newPass = np;
  const teacher = resetTargetTeacher(acc);
  db.resetPass = db.resetPass || [];
  if (teacher) {
    db.resetPass.push({ id: uid(), teacherId: teacher.id, login: acc.username, who: resetWhoText(acc), newPass: np, ts: nowISO(), read: false });
  }
  r.teacherId = teacher ? teacher.id : null;
  saveDB();
  closeModal();
  showCreds(acc);
  toast(teacher
    ? 'Heslo resetováno ✓ – třídní učitel dostal nové heslo k předání'
    : 'Heslo resetováno ✓ – žádný třídní učitel není přiřazen, nové heslo vidíte výše', 'ok');
  route();
});
onAct('sp-req-del:', el => {
  const id = el.getAttribute('data-act').slice(11);
  db.resetReq = (db.resetReq || []).filter(x => x.id !== id);
  saveDB();
  closeModal();
  toast('Žádost smazána', 'bad');
  route();
});

registerView('ucitel', 'sprava', spravaHome);
registerView('admin', 'sprava', spravaHome);
