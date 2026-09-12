# SchoolSys – návod k databázi a publikaci

Tento dokument popisuje, **jak dnes aplikace ukládá data**, co to znamená pro
více zařízení/uživatelů a **co je potřeba udělat**, aby SchoolSys běžel na
opravdové databázi a šla zveřejnit (např. na GitHub Pages).

---

## 0. Stav implementace (aktuální)

Do aplikace je už **připojená cloudová synchronizace** přes Supabase
(„rychlé napojení“, viz níže Varianta A):

| Soubor | Co dělá |
|---|---|
| `supabase.sql` | skript pro Supabase → SQL Editor (tabulka `school_state`, celá škola = 1 řádek) |
| `assets/js/supabase-config.js` | projektová URL + publishable klíč (`SUPA_ENABLED` vypíná sync) |
| `assets/js/cloud.js` | stahuje/posílá celou školu; novější verze vyhrává; při každém uložení se změny odešlou |
| `app.html` | načítá `supabase-config.js` a `cloud.js` |

Jakmile v Supabase spustíte `supabase.sql` a aplikaci otevřete, data se začnou
ukládat i do cloudu a uvidí je každé další zařízení (učitel na PC i žák na
mobilu – po přihlášení stejným účtem).

> ⚠️ Tento režim je **most pro testování/rozjezd**: přístup k datům chrání jen
> publishable klíč (je veřejný). Před vložením skutečných jmen a známek reálných
> žáků je nutné přepnout na **Supabase Auth** (účet pro každého uživatele +
> pravidla RLS) – to je „Varianta B“ rozepsaná v kapitole 3 a dál.

---

## 1. Jak to funguje DNEŠ (a proč to ještě není „databáze")

Aplikace je čistě frontend: tři HTML/JS/CSS soubory, žádný server. Veškerá data
žijí v prohlížeči v **localStorage** pod klíčem:

```
lukySchool.db.v14
```

Klíč končí verzí schématu. Při každém načtení aplikace proběhne `migrateDB()`
v `assets/js/data.js` – starší verze se buď převedou, nebo (u velkého
přechodu v12) smažou. Přechod na v13 (multi-organizace) proběhl bez ztráty
dat hlavní školy, přechod na v14 (hashování hesel) zahashoval všechna
dosavadní hesla. Staré klíče se automaticky uklidí.

### Tvar databáze (jeden velký JSON objekt)

| Klíč objektu | Obsah |
|---|---|
| `v` | verze schématu (teď 14) |
| `meta` | kdy byla založena, školní rok |
| `schoolName` | název hlavní školy (LukySchool) |
| `organizations` | cizí organizace `{ id, name, first, last, phone, email, contactId, createdAt }` |
| `orgRequests` | žádosti o založení `{ id, first, last, orgName, phone, email, username, pass, status }` |
| `classes` | třídy `{ id, name, orgId?, teacherIds[], mainTeacher }` – `orgId` jen u tříd organizací |
| `users` | všechny účty `{ id, username, pass, role, isAdmin, name, … }` |
| `students` | žáci `{ id, first, last, cls, ivp? }` |
| `rooms` | učebny pro rezervace |
| `subjects` | vlastní předměty vytvořené učiteli |
| `schedule` | rozvrh: `{ [třída]: { slots[], days{1–5:[{subj,room,teacherId}]} } }` |
| `columns` | známkování „sloupce": `{ id, cls, subj, title, date, weight, cells{studentId:známka} }` |
| `tasks` | úkoly `{ id, cls, sid?, subj, title, due, note, done{studentId:bool}, teacherId }` |
| `classbook` | třídní kniha `{ id, cls, date, period, subj, tema, ukol, note, statuses{studentId:'P'/'X'/'D'} }` |
| `threads` | konverzace `{ [id]: { childId, recipientType, parent?, teacherId?, subject?, taskId?, status, msgs[] } }` |
| `excuses` | omluvenky `{ childId, date, periods[], reason, status ('ceka'/'schvaleno'/…) }` |
| `subs` | suplování, `reservations` rezervace učeben, `absReq` žádosti o suplování |
| `notifs` / `seen` | notifikace a jejich přečtení |

Relace nejsou žádné – aplikace si je počítá za běhu (žák → `studentOf`,
třída → `studentsOfClass`, učitel → `myClasses()` atd.).

### Přihlašování dnes

Účet = záznam v `db.users`. Heslo se ukládá **hashované** (`ss1$salt$hash`,
SHA-256 s náhodným saltem) – v čitelné podobě existuje jen chvíli v paměti,
zobrazí se jednorázově při vytvoření účtu / vygenerování nového hesla. Relace je
jen `lukySchool.session` s uživatelským jménem. Po přihlášení čte `currentUser()`.

> Hash chrání hesla i v localStorage a v cloudu – z hashování se heslo nedá
> získat zpět. Pro skutečný provoz se ale stejně doporučuje serverové ověření
> (bcrypt/argon2 na serveru, viz kapitola 3).

### Co to znamená v praxi

- Data jsou **vázaná na jeden prohlížeč** – učitel na svém počítači nevidí,
  co žák zapsal na svém mobilu.
- Hesla nejsou šifrovaná, neexistuje server, kterému by se dalo věřit.
- Smazání dat prohlížeče = smazání školy (dokud není export/záloha).

---

## 2. Jak data přenést do opravdové databáze

Nejjednodušší cesta k plné aplikaci (učitel na PC, žák na mobilu, jeden
sdílený stav) je **klient + malé API + databáze**. GitHub Pages umí jen
statiku, takže server musí běžet jinde – ale frontend můžete dál hostovat
na Pages a server volat přes API.

### Varianta A (doporučeno pro rychlost): Supabase

1. Založte projekt na [supabase.com](https://supabase.com) (PostgreSQL zdarma).
2. Vytvořte tabulky podle datového modelu výše (SQL skript viz sekce „SQL“).
3. Frontend místo `db.*` volá REST/klienta Supabase:
   - přihlášení přes Supabase Auth (hesla se hashují sama),
   - data přes `supabase.from('students').select(...)`.
4. Pro živé aktualizace (nová známka hned u rodiče) zapněte **Realtime** na
   relevantních tabulkách.

#### Vaše konkrétní hodnoty (doplněno)

Pro tento projekt už máte projekt založený – použijte tyto hodnoty:

| Co | Hodnota |
|---|---|
| Projekt (base URL pro klienta) | `https://jxbperjpiiuqzvghlfct.supabase.co` |
| REST API (PostgREST) | `https://jxbperjpiiuqzvghlfct.supabase.co/rest/v1/` |
| Publishable klíč (do frontendu) | `sb_publishable_N9Ut9HUNHGb48t1ywj-PhQ_DlzeOisG` |

REST URL je jen projektová URL + `/rest/v1/`. Do JavaScriptového klienta
(`supabase-js`) se **zapisuje jen projektová URL bez** `/rest/v1/` – klient si
cestu doplní sám.

**Publishable klíč je bezpečné dávat do frontendu** (nahrazuje starý „anon“
klíč) – je chráněný pravidly Row Level Security na serveru. **Nikdy** ale do
frontendu ani do repozitáře nedávejte **Secret** klíč (`sb_secret_…`) – ten
patří jen na server / do proměnných prostředí.

#### Jak klienta připojit (kostra, kterou později napojíte na data.js)

Vytvořte si soubor např. `assets/js/supabase-config.js`:

```js
// Veřejné údaje – klidně je nechte v repozitáři (viz bezpečnost výše).
const SUPABASE_URL = 'https://jxbperjpiiuqzvghlfct.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_N9Ut9HUNHGb48t1ywj-PhQ_DlzeOisG';
```

A načtěte klienta v `app.html` před ostatní skripty:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="assets/js/supabase-config.js"></script>
<script>
  // Příklad použití – přihlášení a čtení žáků
  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
  // supabase.auth.signInWithPassword({ email, password });
  // supabase.from('students').select('*');
</script>
```

První kroky v Supabase dashboardu:

1. **SQL Editor** → spusťte skript ze sekce „SQL“ níže (vytvoří tabulky).
2. **Authentication** → povolte přihlašování (e-mail + heslo) – hesla Supabase
   hashuje sama, plaintext z kapitoly 1 tím odpadá.
3. **Table Editor** → na každé tabulce zapněte **Row Level Security** a
   přidejte policy (např. učitel vidí jen své třídy, žák jen sebe).
4. **Realtime** → u `grades`, `classbook`, `messages` a `notifs` zapněte,
   aby se nová známka/zpráva objevila rodiči hned bez obnovení stránky.

> Rychlý test připojení: otevřete v prohlížeči
> `https://jxbperjpiiuqzvghlfct.supabase.co/rest/v1/students?select=id`
> s hlavičkou `apikey: sb_publishable_N9Ut9HUNHGb48t1ywj-PhQ_DlzeOisG`
> (dokud není tabulka prázdná/vytvořená, vrátí prázdné pole – to je OK).

### Varianta B: Vlastní API (Node.js + Express)

```
SchoolSys/
  index.html, app.html, assets/…   ← frontend (hostujete na Pages)
  server/                          ← nově: vlastní backend
    package.json
    index.js        (Express + /api/*)
    schema.sql      (SQLite nebo PostgreSQL)
```

1. Vytvořte tabulky (SQL níže). Pro začátek stačí SQLite (soubor, žádný
   hosting DB) – na produkci pak PostgreSQL.
2. Napíšete ~10 endpointů:
   - `POST /api/login` (vrátí token; hesla hashujte `bcrypt`),
   - `GET /api/me`, `GET /api/classes`, `GET /api/students?...`,
   - `POST /api/grades`, `POST /api/classbook`, `POST /api/excuses`, …
3. Ve frontendu nahradíte `saveDB()` voláním API a `db` budete plnit
   z odpovědí. Všechna místa, která čtou `db.*`, najdete podle funkcí
   v `data.js` (`studentOf`, `studentsOfClass`, `columnsFor`, …).

### Mapování entit na tabulky (SQL skica)

```sql
users      (id serial PK, username unique, pass_hash, role 'ucitel'|'student'|'rodic',
            is_admin bool, name, student_id int?, class_id int?)   -- rodič: tabulka children
classes    (id serial PK, name, main_teacher_id int?)
students   (id serial PK, class_id int FK, first, last, ivp bool)
children   (parent_id int FK users, student_id int FK students)     -- „více dětí"
schedule   (class_id int FK, day int, period int, subj, room, teacher_id int?,
            UNIQUE(class_id, day, period))
subjects   (code text PK, name, color)                              -- + school_id až více škol
grade_cols (id serial PK, class_id int FK, subj, title, date, weight)
grades     (col_id int FK, student_id int FK, value text, UNIQUE(col_id, student_id))
tasks      (id serial PK, class_id int FK, student_id int?, subj, title, due, note, teacher_id)
task_done  (task_id int FK, student_id int FK, done bool)
classbook  (id serial PK, class_id int FK, date, period, subj, tema, note)
attendance (classbook_id int FK, student_id int FK, status 'P'|'X'|'D')
threads    (id uuid PK, child_id int FK, recipient_type, parent_id int?, teacher_id int?,
            subject text?, task_id int?, status text default 'open')
messages   (id serial PK, thread_id uuid FK, from_id int FK, text, read_at timestamptz?)
excuses    (id serial PK, child_id int FK, date, periods int[], reason, status, decided_at?)
notifs     (id serial PK, user_id int FK, type, text, ts, route)
```

### Přenos stávajících dat (pokud nějaká máte)

Než databázi rozjedete, vyexportujte si obsah localStorage:

```js
// spusťte v konzoli prohlížeče na app.html
const data = JSON.parse(localStorage.getItem('lukySchool.db.v14'));
console.log(JSON.stringify(data));   // zkopírujte a uložte jako backup.json
```

Import do SQL je pak mechanický (INSERT po entitách). Id ve tvaru `s-demo`,
`1. A` nahraďte číselnými klíči; odkaz na třídu v `schedule`/`students` se
převede na `class_id`.

---

## 3. Bezpečnost, kterou nesmíte přeskočit

| Dnes | Před zveřejněním |
|---|---|
| hesla hashovaná (salt + SHA-256) v localStorage | hash (bcrypt/argon2) na serveru, token v session |
| admin `admin / ownerss01*` (zakladatel) | heslo lze změnit přímo v aplikaci (ikona zámku vpravo nahoře) |
| každý si může otevřít konzoli a číst data | server ověřuje práva (učitel = jen své třídy) |
| tlačítko „Ředitel“ na přihlašovací stránce | na veřejném webu schovejte – přihlašování přes formulář |
| sdílení = jeden prohlížeč | databáze + API (kapitola 2) |

---

## 4. Publikace na GitHub Pages

Pages umí hostovat jen statické soubory – proto se k ní hodí frontend
(dnešní celá aplikace). Postup:

1. Nahrajte projekt do repozitáře na GitHubu (soubory `index.html`,
   `app.html`, složka `assets/`).
2. Repozitář → **Settings → Pages**:
   - Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Po chvíli běží aplikace na `https://uživatel.github.io/repozitář/`
   (nebo na vlastní doméně → Pages → Custom domain).
4. Vlastní doména: do DNS přidejte záznamy, které GitHub ukáže, a počkejte
   na HTTPS certifikát.

> Pozor: pokud plánujete **vlastní backend** (varianta B), frontend na Pages
> musí volat API přes absolutní URL (`https://api.vasdomena.cz`), kvůli CORS
> povolte jen svou doménu. U Supabase (varianta A) je CORS vyřešený za vás.

### Tipy

- Všechny cesty v HTML jsou relativní (`assets/…`) – fungují i v podsložce.
- Otestujte si lokálně: `python -m http.server` ve složce projektu
  (nebo `npx serve`) a otevřete `http://localhost:8000`.
- Data pro více škol do jednoho nasazení: přidejte `school_id` do tabulek
  a účty navěste na školu.

---

## 5. Co dnes zůstává čistě frontendové (může zůstat)

Pokud chcete aplikaci jen „vystavit" a vyhovuje vám, že každý uživatel má
vlastní prohlížeč s vlastními daty, stačí krok 4 – aplikace je na release
připravená: prázdná škola, jediný ředitelský účet `admin`, žádná demo data.
V takovém případě ale nikdo nesdílí známky mezi zařízeními – to je důvod,
proč se při skutečném použití bez kapitoly 2 neobejdete.
