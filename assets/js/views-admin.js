/* ============================================================
   SchoolSys — SPRÁVA (školy i organizací)
   Zakladatel aplikace (admin, isRoot): hlavní škola LukySchool +
   Organizace (žádosti, rozkliknutí, smazání, přihlašovací údaje).
   Kontaktní účet organizace (isOrgContact): Třídy + Loginy své
   organizace, pouze na počítači, bez vidění hesel po změně uživatelem.
   Učitelé (bez isAdmin) sem přístup nemají – modul se jim nezobrazí.
   ============================================================ */
'use strict';

let SP_TAB = localStorage.getItem('sprava_tab') || 'classes';
/* kontext rozkliknuté organizace (jen pro zakladatele aplikace) */
let SP_ORG = null;
function spScopeOrg() {
  const u = currentUser();
  if (isContactUser(u)) return u.orgId || null;
  return SP_ORG || null;
}

function spravaHome() {
  const u = currentUser();
  if (!u || (!u.isAdmin && !isContactUser(u))) {
    return '<div class="card"><div class="empty"><b>Nemáte oprávnění</b>Správa je přístupná jen zakladateli aplikace a kontaktním účtům organizací. Učitelé mají vlastní modul.</div></div>';
  }
  const contact = isContactUser(u);
  const isRoot = !!u.isAdmin;
  /* učitel/kontakt na mobilu: žádné zakládání tříd ani žáků (jen PC) */
  const canManage = isRoot || (!isAppMode() && contact);
  const scopeOrg = spScopeOrg();
  const cls = classesOfScope(scopeOrg);
  const teachers = teachersOfScope(scopeOrg);
  const clsIds = cls.map(c => c.id);
  const students = (db.students || []).filter(s => clsIds.includes(s.cls));
  const pendingResets = resetRequestsInView().filter(r => r.status === 'ceka').length;
  const pendingOrgReqs = orgRequestsList().filter(r => r.status === 'ceka').length;
  const pendingOrgs = organizationsList().length;
  const tabs = [
    { k: 'classes', label: 'Třídy (' + cls.length + ')' },
    { k: 'teachers', label: 'Učitelé (' + teachers.length + ')' },
    { k: 'students', label: 'Žáci (' + students.length + ')' },
    { k: 'resets', label: 'Žádosti o reset' + (pendingResets ? ' (' + pendingResets + ')' : '') }
  ];
  if (isRoot) {
    tabs.push({ k: 'orgs', label: 'Organizace' + (pendingOrgReqs ? ' (' + pendingOrgReqs + ' nová' + (pendingOrgReqs === 1 ? '' : 'é') + ')' : pendingOrgs ? ' (' + pendingOrgs + ')' : '') });
    tabs.push({ k: 'data', label: 'Data a release' });
  }
  /* pojistka: zastaralá uložená záložka (např. „data" u kontaktu) → zpět na Třídy */
  if (!tabs.some(t => t.k === SP_TAB)) SP_TAB = 'classes';
  const org = scopeOrg ? orgById(scopeOrg) : null;
  const headTitle = contact
    ? 'Správa organizace · ' + escapeHtml(org ? org.name : '?')
    : (org ? 'Organizace · ' + escapeHtml(org.name) : 'Správa školy · ' + escapeHtml(schoolName()));
  const headSub = contact
    ? (canManage
      ? 'Vaše organizace · přihlašovací údaje se generují automaticky'
      : 'Zakládání tříd a loginů je dostupné jen na počítači 🖥️ – na mobilu se rozhraní jen čte')
    : (org
      ? 'Rozkliknutá organizace – vidíte všechna data včetně přihlašovacích údajů'
      : 'Hlavní škola · třídy, učitelé a žáci · přihlašovací údaje se generují automaticky');
  const ctxBanner = (isRoot && org)
    ? '<div class="card" style="border-color:var(--accent);margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><b>' + ic('eye', 16) + ' Režim organizace</b>' +
      '<span class="small-note" style="margin:0">Spravujete cizí organizaci <b>' + escapeHtml(org.name) + '</b> – změny se týkají jen jejích dat.</span>' +
      '<button class="btn btn-ghost btn-sm" style="margin-left:auto" data-act="sp-org-exit">' + ic('back', 14) + ' Zpět na LukySchool</button></div>'
    : '';
  return '' +
    '<div class="page-head"><div><h1>' + headTitle + '</h1>' +
      '<div class="sub">' + headSub + '</div></div></div>' +
    ctxBanner +
    '<div class="grid grid-4" style="margin-bottom:16px">' +
      '<div class="stat"><span class="s-ic" style="background:rgba(59,130,246,.14);color:var(--accent)">' + ic('home', 20) + '</span><div><b>' + cls.length + '</b><span>tříd</span></div></div>' +
      '<div class="stat"><span class="s-ic" style="background:rgba(139,92,246,.14);color:#A78BFA">' + ic('users', 20) + '</span><div><b>' + teachers.length + '</b><span>učitelů</span></div></div>' +
      '<div class="stat"><span class="s-ic" style="background:rgba(245,158,11,.14);color:var(--warn)">' + ic('book', 20) + '</span><div><b>' + students.length + '</b><span>žáků</span></div></div>' +
      '<div class="stat"><span class="s-ic" style="background:rgba(16,185,129,.14);color:var(--ok)">' + ic('user', 20) + '</span><div><b>' + (db.users || []).filter(x => (x.orgId || null) === scopeOrg).length + '</b><span>loginů</span></div></div>' +
    '</div>' +
    '<div class="tabs">' + tabs.map(t =>
      '<button class="tab' + (SP_TAB === t.k ? ' active' : '') + '" data-act="sp-tab:' + t.k + '">' + t.label + '</button>').join('') +
    '</div>' +
    (SP_TAB === 'classes' ? spClasses(canManage)
      : SP_TAB === 'teachers' ? spTeachers()
      : SP_TAB === 'students' ? spStudents(canManage)
      : SP_TAB === 'resets' ? spResets()
      : SP_TAB === 'orgs' ? spOrgs()
      : spData());
}
onAct('sp-tab:', el => { SP_TAB = el.getAttribute('data-act').slice(7); localStorage.setItem('sprava_tab', SP_TAB); route(); });

/* ---------- TŘÍDY ---------- */
function spClasses(canManage) {
  const cls = classesOfScope(spScopeOrg());
  if (canManage === undefined) canManage = true;   /* admin = vždy; volá se i z jinde */
  return (canManage
    ? '<div class="page-acts" style="margin-bottom:14px"><button class="btn btn-primary btn-sm" data-act="sp-cls-add">' + ic('plus', 15) + ' Přidat třídu</button></div>'
    : '<div class="card" style="border-color:var(--warn);margin-bottom:14px"><b>' + ic('lock', 15) + ' Pouze na počítači</b><p class="small-note" style="margin:6px 0 0">Třídy a loginy se zakládají jen na počítači. Učitelům je zakládá kontakt organizace, žáky do třídy pak jejich učitel.</p></div>') +
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
              '<span style="margin-left:auto;color:var(--muted);font-size:13px;font-weight:700">' + sts.length + ' ' + csPlural(sts.length, 'žák', 'žáci', 'žáků') + '</span>' +
            '</div>' +
            '<div class="field"><label>Třídní učitel</label><select class="sel" data-chg="sp-cls-main:' + c.id + '">' +
              '<option value="">— žádný —</option>' +
              selectableTeachers().map(x =>
                '<option value="' + x.id + '"' + (c.mainTeacher === x.id ? ' selected' : '') + '>' + escapeHtml(x.name) + ' (' + escapeHtml(x.username) + ')</option>').join('') +
            '</select></div>' +
            '<div class="small-note">Učí: ' + (t.length ? t.map(x => escapeHtml(x.name)).join(', ') : 'nikdo – přiřaďte učitele') + '</div>' +
            '</div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Zatím žádná třída</b>Přidejte první třídu, např. 1. A.</div>');
}
/* smí aktuální uživatel zakládat třídy/žáky/učitele? (admin ano, kontakt jen na PC) */
function spCanManage() {
  const u = currentUser();
  if (!u) return false;
  if (u.isAdmin) return true;
  if (isContactUser(u)) return !isAppMode();
  return false;
}
onAct('sp-cls-add', () => {
  if (!spCanManage()) { toast('Třídy se zakládají jen na počítači 🖥️', 'bad'); return; }
  openModal(
    '<h3>Nová třída</h3>' +
    '<form data-form="sp-cls-create">' +
      '<div class="field"><label>Název třídy</label><input name="name" placeholder="Např. 1. A" required autofocus></div>' +
      '<div class="field"><label>Třídní učitel (volitelné)</label><select name="main"><option value="">— zatím žádný —</option>' +
        selectableTeachers().map(x => '<option value="' + x.id + '">' + escapeHtml(x.name) + '</option>').join('') + '</select></div>' +
      '<button class="btn btn-primary">Vytvořit třídu</button>' +
    '</form>');
});
onAct('form:sp-cls-create', f => {
  const name = String(new FormData(f).get('name')).trim();
  const main = String(new FormData(f).get('main')) || null;
  if (!name) { toast('Zadejte název třídy', 'bad'); return; }
  /* id třídy = klíč dat; když je název globálně obsazený (např. jiná organizace
     má taky „1. A“), dostane třída generované id a název zůstává volný */
  const id = db.classes.some(c => c.id === name) ? uid() : name;
  const c = { id, name, orgId: spScopeOrg() || null, teacherIds: main ? [main] : [], mainTeacher: main };
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
  const ok = renameClassCascade(cid, name);
  closeModal();
  if (ok) { toast('Třída přejmenována ✓', 'ok'); route(); }
  else { toast('Třída „' + escapeHtml(name) + '“ už v této organizaci existuje', 'bad'); }
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
  const ts = teachersOfScope(spScopeOrg());
  return '<div class="page-acts" style="margin-bottom:14px"><button class="btn btn-primary btn-sm" data-act="sp-teach-add">' + ic('plus', 15) + ' Přidat učitele</button></div>' +
    (ts.length
      ? '<div class="list">' + ts.map(t => {
          const clsTaught = (db.classes || []).filter(c => (c.teacherIds || []).includes(t.id));
          return '<div class="list-row">' +
            '<span class="ava" style="background:linear-gradient(135deg,#8B5CF6,#3B82F6)">' + escapeHtml(t.name.charAt(0)) + '</span>' +
            '<div class="grow"><div class="row-title">' + escapeHtml(t.name) + (t.isAdmin ? ' <span class="chip chip-accent" style="padding:0 7px;font-size:10px">správce</span>' : '') + (t.isOrgContact ? ' <span class="chip chip-info" style="padding:0 7px;font-size:10px">kontakt · jen PC</span>' : '') + '</div>' +
            '<div class="row-sub">přihlášení: <code class="mono">' + escapeHtml(t.username) + '</code> · učí: ' + (clsTaught.length ? clsTaught.map(c => escapeHtml(c.name)).join(', ') : '<span style="color:var(--warn)">zatím žádnou třídu</span>') + '</div></div>' +
            '<button class="btn btn-soft btn-sm" data-act="sp-creds:' + t.username + '">' + ic('eye', 14) + ' Přihlášení</button>' +
            (!t.isRoot && !(t.isAdmin && !t.isOrgContact && !t.orgId) ? '<button class="btn btn-soft btn-sm" data-act="sp-teach-reset:' + t.id + '">' + ic('zap', 13) + ' Reset</button>' : '') +
            (!t.isAdmin && !t.isOrgContact ? '<button class="icon-btn sm" data-act="sp-teach-del:' + t.id + '" style="color:var(--bad)">' + ic('trash', 15) + '</button>' : '') +
            '</div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Žádní učitelé</b>Přidejte učitele a přiřaďte mu třídu – dostane vlastní přihlášení.</div>');
}
onAct('sp-teach-add', () => {
  if (!spCanManage()) { toast('Učitele zakládá kontakt organizace jen na počítači 🖥️', 'bad'); return; }
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
        selectableClasses().map(c => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join('') + '</select></div>' +
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
  const plainPass = String(fd.get('pass')).trim() || genPassword();
  const user = addUserAccount(
    String(fd.get('username')).trim() || genUsername(first, last),
    plainPass,
    'ucitel',
    { name: first + ' ' + last, note: 'učitel', isAdmin: false, orgId: spScopeOrg() || null }
  );
  setPendingPass(user.id, plainPass);
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
/* reset hesla učitele: admin v org / kontakt zakladatel aplikace */
onAct('sp-teach-reset:', el => {
  const id = el.getAttribute('data-act').slice(15);
  const t = (db.users || []).find(x => x.id === id && x.role === 'ucitel');
  if (!t || t.isRoot) return;
  const me = currentUser();
  /* povolené: admin (na org i hl. školu), kontakt jen na učitele své org */
  const allowed = me.isRoot || (me.isOrgContact && t.orgId === me.orgId);
  if (!allowed) { toast('Reset učitele vyřizuje zakladatel organizace (nebo admin)', 'bad'); return; }
  const np = genPassword();
  t.pass = hashPassword(np);
  t.passChanged = false;
  setPendingPass(t.id, np);
  saveDB();
  showCreds(t);
  toast('Heslo učitele resetováno ✓ – předajte mu ho osobně', 'ok');
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
function spStudents(canManage) {
  if (canManage === undefined) canManage = true;
  const groups = {};
  classesOfScope(spScopeOrg()).forEach(c => {
    (studentsOfClass(c.id)).forEach(s => { (groups[c.id] = groups[c.id] || []).push(s); });
  });
  const clsNames = Object.keys(groups).sort((a, b) => {
    const ca = classOf(a), cb = classOf(b);
    return (ca ? ca.name : a).localeCompare(cb ? cb.name : b, 'cs');
  });
  return (canManage
    ? '<div class="page-acts" style="margin-bottom:14px"><button class="btn btn-primary btn-sm" data-act="sp-stud-add">' + ic('plus', 15) + ' Přidat žáka</button></div>'
    : '<div class="card" style="border-color:var(--warn);margin-bottom:14px"><b>' + ic('lock', 15) + ' Pouze na počítači</b><p class="small-note" style="margin:6px 0 0">Žáky a jejich loginy zakládá učitel na počítači ve svém známkování („Přidat žáka“).</p></div>') +
    (clsNames.length
      ? clsNames.map(cl => {
          const c = classOf(cl);
          return '<div class="card"><div class="card-title">' + ic('home', 16) + ' ' + escapeHtml(c ? c.name : cl) +
            '<span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:700">' + groups[cl].length + ' ' + csPlural(groups[cl].length, 'žák', 'žáci', 'žáků') + '</span></div>' +
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
  const clsList = selectableClasses();
  openModal(
    '<h3>Nový žák</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Po uložení se vygeneruje žákovský účet (přihlášení uvidíte jednou).</p>' +
    '<form data-form="sp-stud-create">' +
      '<div class="field-row">' +
        '<div class="field"><label>Jméno</label><input name="first" required placeholder="Jan"></div>' +
        '<div class="field"><label>Příjmení</label><input name="last" required placeholder="Novák"></div>' +
      '</div>' +
      '<div class="field"><label>Třída</label><select name="cls" required>' +
        (clsList.length
          ? clsList.map(c => '<option value="' + c.id + '"' + (c.id === defaultCls ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>').join('')
          : '<option value="">— zatím žádná třída —</option>') +
        '<option value="__new">➕ Vytvořit novou třídu…</option>' +
      '</select></div>' +
      '<div class="field" id="newcls-wrap" style="display:none"><label>Název nové třídy</label><input name="newcls" placeholder="Např. 1. A"></div>' +
      '<div class="field"><label>Uživatelské jméno (volitelné)</label><input name="username" placeholder="prázdné = vygeneruje se (jan.novak)" style="font-family:monospace"></div>' +
      '<div class="field"><label>Heslo (volitelné)</label><div style="display:flex;gap:8px"><input name="pass" placeholder="prázdné = náhodné heslo" style="font-family:monospace;flex:1">' +
      '<button type="button" class="btn btn-soft btn-sm" data-act="gen-pass">' + ic('zap', 14) + ' Náhodné</button></div></div>' +
      '<div class="field"><label>IVP / podpůrná opatření</label><select name="ivp"><option value="">Ne</option><option value="1">Ano – žák s IVP</option></select></div>' +
      '<button class="btn btn-primary">Vytvořit žáka + účet</button>' +
    '</form>');
}
onAct('sp-stud-add', () => {
  if (!spCanManage()) { toast('Žáky zakládá učitel jen na počítači 🖥️', 'bad'); return; }
  openAddStudentModal(null);
});
function createStudent(first, last, clsId, usernameIn, passIn, ivp) {
  const c = classOf(clsId);
  const st = { id: uid(), first, last, cls: clsId, ivp: !!ivp, demo: false, orgId: (c && c.orgId) || null };
  db.students.push(st);
  const plainPass = passIn || genPassword();
  const acc = addUserAccount(usernameIn || genUsername(first, last), plainPass, 'student', {
    name: first + ' ' + last, note: c ? c.name : clsId, studentId: st.id, isAdmin: false, orgId: (c && c.orgId) || null
  });
  setPendingPass(acc.id, plainPass);
  saveDB();
  return { st, acc };
}
onAct('form:sp-stud-create', f => {
  if (isAppMode() && !currentUser().isAdmin) { toast('Žáky zakládejte na počítači 🖥️', 'bad'); return; }
  const fd = new FormData(f);
  const first = String(fd.get('first')).trim();
  const last = String(fd.get('last')).trim();
  let clsId = String(fd.get('cls'));
  if (!first || !last) { toast('Vyplňte jméno a příjmení', 'bad'); return; }
  /* volba „Vytvořit novou třídu“: založí třídu a přiřadí tvůrce jako třídního */
  if (clsId === '__new') {
    const newName = String(fd.get('newcls') || '').trim();
    if (!newName) { toast('Zadejte název nové třídy', 'bad'); return; }
    const me = currentUser();
    const scopeOrg = me.isAdmin ? (typeof SP_ORG !== 'undefined' && SP_ORG) || null : (me.orgId || null);
    clsId = db.classes.some(c => c.id === newName) ? uid() : newName;
    const c = { id: clsId, name: newName, orgId: scopeOrg, teacherIds: me.role === 'ucitel' ? [me.id] : [], mainTeacher: me.role === 'ucitel' ? me.id : null };
    db.classes.push(c);
    localStorage.setItem('t_cls', clsId);
  }
  if (!clsId) { toast('Nejdřív vytvořte třídu', 'bad'); return; }
  /* práva: učitel smí jen do SVÝCH tříd; kontakt do libovolné třídy své organizace; admin kamkoli (v rámci rozkliknuté org) */
  const me2 = currentUser();
  const targetCls = classOf(clsId);
  if (me2 && !me2.isAdmin) {
    const allowed = isContactUser(me2)
      ? targetCls && (targetCls.orgId || null) === (me2.orgId || null)          /* zakladatel org: celá jeho organizace */
      : targetCls && (targetCls.teacherIds || []).includes(me2.id);             /* učitel: jen třídy, kde učí */
    if (!allowed) { toast('Do této třídy nemůžete přidávat žáky', 'bad'); return; }
  }
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
  const parPlain = genPassword();
  par = addUserAccount((acc ? acc.username : genUsername(st.first, st.last)) + '.rodic', parPlain, 'rodic', {
    name: 'Rodič · ' + st.first + ' ' + st.last, note: st.cls, isAdmin: false, children: [sid],
    orgId: st.orgId || null
  });
  setPendingPass(par.id, parPlain);
  saveDB(); closeModal(); showCreds(par);
  toast('Rodičovský účet vytvořen ✓', 'ok'); route();
});

/* ---------- přihlašovací údaje ----------
   Heslo se zobrazí JEDNOU – jen těsně po vytvoření/vygenerování (dočasná
   kopie existuje jen v paměti). V databázi zůstává trvale jen salt + SHA-256. */
function showCreds(user) {
  const plain = takePendingPass(user.id);   /* heslo se zobrazí právě jednou */
  const org = orgOfUser(user);
  const passRow = plain
    ? '<div class="list-row"><span style="min-width:90px;font-weight:800">Heslo</span><code class="mono grow">' + escapeHtml(plain) + '</code>' +
      '<button class="btn btn-soft btn-sm" data-act="copy:' + escapeHtml(plain) + '">' + ic('check', 13) + ' Kopírovat</button></div>'
    : '<div class="list-row"><span style="min-width:90px;font-weight:800">Heslo</span><span class="grow" style="color:var(--muted);font-weight:700">•••••••• ' +
      (user.isOrgContact ? '(zvolil si žadatel sám)' : (user.passChanged ? '(změněno uživatelem)' : '(již předáno)')) + '</span></div>';
  const note = plain
    ? '<b>Zapište si ho hned</b> – z bezpečnostních důvodů se heslo zobrazí jen jednou. V databázi zůstane pouze hash.'
    : (user.isOrgContact
      ? 'Kontaktní účet si heslo zvolil sám při žádosti o organizaci – nikdo jiný ho nezná. Když ho zapomene, vygenerujte mu nové.'
      : 'Z bezpečnostních důvodů heslo znovu nezobrazíme – v databázi je jen hash. Potřebujete-li nové, vygenerujte ho tlačítkem níže.');
  openModal(
    '<h3>Přihlašovací údaje</h3>' +
    (org ? '<p class="small-note" style="margin-bottom:6px">Organizace: <b>' + escapeHtml(org.name) + '</b>' +
      (user.isOrgContact ? ' · kontaktní účet (přihlášení jen na PC)' : '') + '</p>' : '') +
    '<p class="small-note" style="margin-bottom:12px">' + note + '</p>' +
    '<div class="list" style="margin-bottom:14px">' +
      '<div class="list-row"><span style="min-width:90px;font-weight:800">Login</span><code class="mono grow">' + escapeHtml(user.username) + '</code>' +
        '<button class="btn btn-soft btn-sm" data-act="copy:' + escapeHtml(user.username) + '">' + ic('check', 13) + ' Kopírovat</button></div>' +
      passRow +
    '</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn btn-soft" data-act="sp-pass-reset:' + user.id + '">' + ic('zap', 14) + ' Vygenerovat nové heslo</button>' +
      '<button class="btn btn-primary" data-act="close-modal">Hotovo</button>' +
    '</div>');
}
/* vygenerování nového hesla účtu (správcem/kontaktem) */
onAct('sp-pass-reset:', el => {
  const u = (db.users || []).find(x => x.id === el.getAttribute('data-act').slice(14));
  if (!u) return;
  const np = genPassword();
  u.pass = hashPassword(np);
  u.passChanged = false;
  setPendingPass(u.id, np);
  saveDB();
  toast('Nové heslo vygenerováno ✓', 'ok');
  showCreds(u);
});
/* toggle pole „název nové třídy“ v dialogu Nový žák */
document.addEventListener('change', e => {
  const sel = e.target.closest('form[data-form="sp-stud-create"] select[name="cls"]');
  if (!sel) return;
  const wrap = document.getElementById('newcls-wrap');
  if (wrap) wrap.style.display = sel.value === '__new' ? '' : 'none';
});
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
    '<div class="card-title">' + ic('trash', 16) + ' Vyčistit hlavní školu (čistý start)</div>' +
    '<p class="small-note" style="margin:0 0 12px">Smaže všechny třídy, učitele, žáky, známky, rozvrhy i zprávy hlavní školy ' + escapeHtml(schoolName()) + '. Zůstane pouze zakladatelský účet <code class="mono">admin</code> a organizace s jejich daty. Školu pak postavíte přes Správu: třída → učitel → žáci.</p>' +
    '<button class="btn btn-bad" data-act="sp-wipe">' + ic('trash', 15) + ' Vyčistit školu</button>' +
    '<div class="small-note" style="margin-top:12px">Pozor: data se ukládají v prohlížeči (localStorage). Před čistěním si případně udělejte export – viz návod DATABAZE.md.</div>' +
  '</div>';
}
onAct('sp-wipe', () => {
  openModal('<h3>Opravdu vyčistit hlavní školu?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Smaže všechna data hlavní školy ' + escapeHtml(schoolName()) + ' (třídy, žáci, učitelé, známky, zprávy). ' +
    'Organizace a jejich data zůstanou nedotčené. Zůstane jen zakladatelský účet <code class="mono">admin</code>.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="sp-wipe-ok">Ano, smazat vše</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('sp-wipe-ok', () => {
  wipeMainSchool();
  closeModal();
  location.hash = '#/admin/sprava';
  route();
  toast('Hlavní škola vyčištěna – začněte přidáním třídy', 'ok');
});

/* ============================================================
   ORGANIZACE (jen zakladatel aplikace)
   Žádosti (přijmout/odmítnout) · rozkliknutí · smazání
   ============================================================ */
function spOrgs() {
  const reqs = orgRequestsList().slice()
    .sort((a, b) => (a.status === b.status ? (a.ts < b.ts ? 1 : -1) : (a.status === 'ceka' ? -1 : 1)));
  const orgs = organizationsList().slice().sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  return '' +
    '<h2 style="margin:4px 0 10px;font-size:17px">Žádosti o založení organizace</h2>' +
    (reqs.length
      ? '<div class="list" style="margin-bottom:22px">' + reqs.map(r =>
          '<div class="list-row">' +
            '<span class="chip ' + (r.status === 'ceka' ? 'chip-accent' : r.status === 'schvaleno' ? 'chip-ok' : '') + '">' +
              (r.status === 'ceka' ? 'čeká' : r.status === 'schvaleno' ? 'přijato' : 'odmítnuto') + '</span>' +
            '<div class="grow"><div class="row-title">' + escapeHtml(r.orgName) + ' · ' + escapeHtml(r.first + ' ' + r.last) + '</div>' +
            '<div class="row-sub">kontakt: <code class="mono">' + escapeHtml(r.username) + '</code> · ' + escapeHtml(r.email) + ' · ' + escapeHtml(r.phone) + ' · ' + tsLabel(r.ts) + '</div></div>' +
            (r.status === 'ceka'
              ? '<div style="display:flex;gap:8px"><button class="btn btn-primary btn-sm" data-act="sp-org-acc:' + r.id + '">' + ic('check', 14) + ' Přijmout</button>' +
                '<button class="btn btn-bad btn-sm" data-act="sp-org-rej:' + r.id + '">' + ic('x', 14) + ' Odmítnout</button></div>'
              : '<button class="btn btn-ghost btn-sm" data-act="sp-org-req-del:' + r.id + '">Smazat</button>') +
          '</div>').join('') + '</div>'
      : '<div class="empty" style="margin-bottom:22px"><b>Žádné žádosti</b>Nové žádosti z formuláře „Založit organizaci“ se objeví tady.</div>') +
    '<h2 style="margin:4px 0 10px;font-size:17px">Založené organizace (' + orgs.length + ')</h2>' +
    (orgs.length
      ? '<div class="grid grid-2">' + orgs.map(o => {
          const st = orgStats(o.id);
          const contact = (db.users || []).find(u => u.id === o.contactId);
          return '<div class="card">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
              '<span class="chip chip-accent" style="font-size:14px;padding:6px 12px">' + escapeHtml(o.name) + '</span>' +
              '<span style="margin-left:auto;color:var(--muted);font-size:12px;font-weight:700">založeno ' + tsLabel(o.createdAt) + '</span>' +
            '</div>' +
            '<div class="small-note" style="margin-bottom:10px">Zakladatel: <b>' + escapeHtml(o.first + ' ' + o.last) + '</b><br>' +
              'Kontakt: ' + escapeHtml(o.phone) + ' · ' + escapeHtml(o.email) + (contact ? '<br>Login kontaktu: <code class="mono">' + escapeHtml(contact.username) + '</code>' : '') + '</div>' +
            '<div class="small-note" style="margin-bottom:12px">' + st.classes + ' ' + csPlural(st.classes, 'třída', 'třídy', 'tříd') + ' · ' +
              st.teachers + ' ' + csPlural(st.teachers, 'učitel', 'učitelé', 'učitelů') + ' · ' + st.students + ' ' + csPlural(st.students, 'žák', 'žáci', 'žáků') + '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button class="btn btn-primary btn-sm" data-act="sp-org-open:' + o.id + '">' + ic('eye', 14) + ' Rozkliknout</button>' +
              (contact ? '<button class="btn btn-soft btn-sm" data-act="sp-creds:' + escapeHtml(contact.username) + '">' + ic('lock', 14) + ' Účet kontaktu</button>' : '') +
              '<button class="btn btn-bad btn-sm" data-act="sp-org-del:' + o.id + '" style="margin-left:auto">' + ic('trash', 14) + ' Smazat organizaci</button>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Zatím žádné organizace</b>Po schválení žádosti se organizace objeví tady.</div>');
}
onAct('sp-org-acc:', el => {
  const r = orgRequestsList().find(x => x.id === el.getAttribute('data-act').slice(11));
  if (!r || r.status !== 'ceka') return;
  if (usernameTaken(r.username, r.id)) { toast('Login „' + escapeHtml(r.username) + '“ už existuje – odmítněte žádost a žadatel ji pošle znovu', 'bad'); return; }
  openModal(
    '<h3>Přijmout organizaci „' + escapeHtml(r.orgName) + '“?</h3>' +
    '<p class="small-note" style="margin-bottom:12px">Vytvoří se organizace a kontaktní účet <code class="mono">' + escapeHtml(r.username) + '</code> ' +
      '(přihlášení jen na PC). Kontakt bude moct na počítači zakládat třídy, učitele a žáky své organizace.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-primary" data-act="sp-org-acc-ok:' + r.id + '">' + ic('check', 15) + ' Přijmout a vytvořit</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('sp-org-acc-ok:', el => {
  const r = orgRequestsList().find(x => x.id === el.getAttribute('data-act').slice(14));
  if (!r || r.status !== 'ceka') return;
  const { org, contact } = createOrganization(r);
  r.status = 'schvaleno';
  r.doneTs = nowISO();
  saveDB();
  closeModal();
  showCreds(contact);
  toast('Organizace „' + escapeHtml(org.name) + '“ vytvořena ✓', 'ok');
  route();
});
onAct('sp-org-rej:', el => {
  const r = orgRequestsList().find(x => x.id === el.getAttribute('data-act').slice(11));
  if (!r) return;
  openModal(
    '<h3>Odmítnout žádost „' + escapeHtml(r.orgName) + '“?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Login <code class="mono">' + escapeHtml(r.username) + '</code> se uvolní a žadatel může poslat opravenou žádost znovu.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="sp-org-rej-ok:' + r.id + '">' + ic('x', 15) + ' Odmítnout</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('sp-org-rej-ok:', el => {
  const r = orgRequestsList().find(x => x.id === el.getAttribute('data-act').slice(14));
  if (!r) return;
  r.status = 'odmitnuto';
  r.doneTs = nowISO();
  saveDB();
  closeModal();
  toast('Žádost odmítnuta', 'bad');
  route();
});
onAct('sp-org-req-del:', el => {
  const id = el.getAttribute('data-act').slice(15);
  db.orgRequests = orgRequestsList().filter(x => x.id !== id);
  saveDB();
  toast('Žádost smazána', 'bad');
  route();
});
onAct('sp-org-open:', el => {
  const o = orgById(el.getAttribute('data-act').slice(12));
  if (!o) return;
  SP_ORG = o.id;
  SP_TAB = 'classes';
  toast('Rozkliknuta organizace „' + escapeHtml(o.name) + '“ – vidíte všechna její data', 'ok');
  route();
});
onAct('sp-org-exit', () => { SP_ORG = null; route(); });
onAct('sp-org-del:', el => {
  const o = orgById(el.getAttribute('data-act').slice(11));
  if (!o) return;
  const st = orgStats(o.id);
  openModal(
    '<h3>Smazat organizaci „' + escapeHtml(o.name) + '“?</h3>' +
    '<p class="small-note" style="margin-bottom:14px">Nenávratně smaže <b>všechny</b> třídy (' + st.classes + '), učitele (' + st.teachers + '), žáky (' + st.students + '), loginy, známky i třídní knihy organizace.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn btn-bad" data-act="sp-org-del-ok:' + o.id + '">' + ic('trash', 15) + ' Smazat organizaci</button>' +
    '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>');
});
onAct('sp-org-del-ok:', el => {
  const id = el.getAttribute('data-act').slice(14);
  const o = orgById(id);
  if (SP_ORG === id) SP_ORG = null;
  deleteOrganizationCascade(id);
  closeModal();
  toast('Organizace „' + escapeHtml(o ? o.name : '') + '“ smazána', 'bad');
  route();
});

/* ---------- ŽÁDOSTI O RESET HESLA ---------- */
function spResets() {
  const reqs = resetRequestsInView();
  return '<div class="page-head"><div><h1>Žádosti o reset hesla</h1>' +
    '<div class="sub">Klikněte na žádost – ověřte, že účet existuje, a resetujte heslo. Nové heslo pak předá třídní učitel.</div></div></div>' +
    (reqs.length
      ? '<div class="list">' + reqs.map(r => {
          const acc = accByLogin(r.login);
          return '<div class="list-row">' +
            '<span class="chip ' + (r.status === 'ceka' ? 'chip-accent' : '') + '">' + (r.status === 'ceka' ? 'čeká' : 'vyřízeno') + '</span>' +
            '<div class="grow"><div class="row-title"><code class="mono">' + escapeHtml(r.login) + '</code>' + (acc ? ' · ' + escapeHtml(acc.name) : '') + '</div>' +
            '<div class="row-sub">' + tsLabel(r.ts) + (r.status === 'vyrizeno' ? ' · nové heslo bylo předáno třídnímu učiteli' : '') + '</div></div>' +
            '<button class="btn btn-soft btn-sm" data-act="sp-req-open:' + r.id + '">' + ic(r.status === 'ceka' ? 'zap' : 'eye', 14) + ' ' + (r.status === 'ceka' ? 'Vyřídit' : 'Detail') + '</button>' +
            '</div>';
        }).join('') + '</div>'
      : '<div class="empty"><b>Žádné žádosti</b>Když někdo na přihlašování klikne na „Zapomněl jsem heslo“, objeví se žádost tady.</div>');
}
function accByLogin(login) {
  const l = String(login || '').trim().toLowerCase();
  return (db.users || []).find(u => u.username.toLowerCase() === l) || null;
}
/* ---------- hierarchie resetů hesel ----------
   žák/rodič → třídní učitel (bez něj: v org zakladatel organizace, ve hl. škole admin)
   učitel → zakladatel organizace (kontakt); učitel hlavní školy → admin
   zakladatel organizace (kontakt) → vždy jen zakladatel aplikace (admin)
   admin (zakladatel aplikace) → nikdo; heslo si mění jen sám v aplikaci (🔒) */
function resetResolverOf(acc) {
  if (!acc) return { kind: 'none' };
  if (acc.isRoot) return { kind: 'none' };
  if (acc.isOrgContact) return { kind: 'root' };
  if (acc.role === 'ucitel') return acc.orgId ? { kind: 'contact', orgId: acc.orgId } : { kind: 'root' };
  const sid = acc.role === 'student' ? acc.studentId : (acc.children || [])[0];
  const t = sid ? classTeacherOf(sid) : null;
  if (t) return { kind: 'teacher', teacherId: t.id };
  if (acc.orgId) return { kind: 'contact', orgId: acc.orgId };
  return { kind: 'root' };
}
function resetResolverText(acc) {
  const r = resetResolverOf(acc);
  if (r.kind === 'none') return 'heslo správce aplikace se žádostí resetovat nedá – mění si ho jen sám v aplikaci';
  if (r.kind === 'root') return 'vyřizuje zakladatel aplikace (admin)';
  if (r.kind === 'contact') { const o = orgById(r.orgId); return 'vyřizuje zakladatel organizace' + (o ? ' · ' + o.name : ''); }
  const t = (db.users || []).find(u => u.id === r.teacherId);
  return 'vyřizuje třídní učitel' + (t ? ' · ' + t.name : '');
}
function viewerCanResolve(acc) {
  const u = currentUser();
  if (!u || !acc) return false;
  const r = resetResolverOf(acc);
  if (r.kind === 'none') return false;
  if (r.kind === 'root') return !!u.isRoot;
  if (r.kind === 'contact') return !!u.isOrgContact && u.orgId === r.orgId;
  return r.teacherId === u.id;
}
/* žádosti viditelné v aktuálním kontextu (admin v rozkliknuté org vidí všechny její) */
function resetRequestsInView() {
  const u = currentUser();
  const scope = spScopeOrg();
  return (db.resetReq || []).filter(r => {
    const acc = accByLogin(r.login);
    if (!acc) return !!u.isRoot;
    if (u.isRoot) return scope ? (acc.orgId || null) === scope : resetResolverOf(acc).kind === 'root';
    if (u.isOrgContact) {
      return resetResolverOf(acc).kind === 'contact';   /* jen co sám vyřizuje (učitelé org, žáci bez třídního) */
    }
    return false;
  }).slice().sort((a, b) => (a.status === b.status ? (a.ts < b.ts ? 1 : -1) : (a.status === 'ceka' ? -1 : 1)));
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
    body += '<p class="small-note" style="margin-bottom:8px">Účet <b>' + escapeHtml(acc.username) + '</b> existuje – ' + escapeHtml(resetWhoText(acc)) + '.</p>';
    body += '<p class="small-note" style="margin-bottom:14px">' + ic('shield', 14) + ' ' + escapeHtml(resetResolverText(acc)) + '.</p>';
    if (r.status === 'ceka') {
      if (viewerCanResolve(acc)) {
        body += '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn btn-primary" data-act="sp-req-reset:' + r.id + '">' + ic('zap', 15) + ' Resetovat heslo (nové vygenerované)</button>' +
          '<button class="btn btn-ghost" data-act="close-modal">Zrušit</button></div>';
      } else {
        body += '<div class="card" style="border-color:var(--warn);margin-bottom:12px"><b>' + ic('lock', 14) + ' Vyřídit to musí ten správný</b><p class="small-note" style="margin:6px 0 0">Tuto žádost může vyřídit jen: ' + escapeHtml(resetResolverText(acc)) + '.</p></div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" data-act="close-modal">Zavřít</button>' +
          (!currentUser().isRoot ? '<button class="btn btn-ghost" data-act="sp-req-del:' + r.id + '">Smazat žádost</button>' : '') + '</div>';
      }
    } else {
      body += '<div class="ok-line" style="margin-bottom:14px">' + ic('check', 15) + ' <span>Heslo bylo resetováno' + (r.teacherId ? ' – zpráva byla odeslána třídnímu učiteli.' : ' – žádný třídní učitel není přiřazen.') + '</span></div>' +
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
  /* hierarchie: vyřídit smí jen ten, komu žádost náleží (učitel/contact/root) */
  if (!viewerCanResolve(acc)) { toast('Tuto žádost nemůžete vyřídit – ' + resetResolverText(acc), 'bad'); return; }
  const np = genPassword();
  acc.pass = hashPassword(np);
  acc.passChanged = false; /* nové generované heslo půjde opět jednorázově zobrazit */
  setPendingPass(acc.id, np);
  r.status = 'vyrizeno';
  r.doneTs = nowISO();
  r.teacherId = null;
  saveDB();
  closeModal();
  showCreds(acc);
  toast('Heslo resetováno ✓ – nové heslo předajte uživateli osobně', 'ok');
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
