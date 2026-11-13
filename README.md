# Faith Hope Love Sunday School – website + staff portal (departments edition)

Folder layout: `public/` (the website: index.html, logo.png, church.jpg, emblem-l.jpg, emblem-r.jpg, icon-192.png, icon-512.png, manifest.webmanifest, sw.js) · `functions/api/[[path]].js` (the Cloudflare backend) · `schema.sql` (database tables) · `wrangler.toml` (Cloudflare settings).

## Portal layout (follows UI.pdf)
White strip on top: logo, **view site**, **Logout** (and your name – tap it for **My account**).
Blue bar: **Dashboard · 7 departments · User · Setting**. The open item has a gold underline.
Second bar: the pages of the open department. Every department starts with **Plan (ዕቅድ)**.
Dashboard: **Welcome** and one gold box per department (each person sees only their own departments). The repeated department statistics were removed from the Dashboard; they now live in Human Resources → Departments data.

| Department | Pages |
|---|---|
| ትምህርት እና ስልጠና ክፍል | Plan · Students · Register · Attendance · Mark · Result and rank · Teacher's book · Promotion · Class lists · Classes & subjects |
| መዝሙር እና ሥነ ጥበባት ክፍል | Plan · Hymns · Attendance |
| መርሐ ግብር እና ጉባኤያት ክፍል | Plan · Programs |
| የሰው ሀብት አስተዳደር ክፍል | Plan · Members (አባላት) · Departments data (የክፍሎች መረጃ) |
| ሒሳብና ንብረት ክፍል | Plan · Uniform (ልብሰ ስብሐት) |
| መረጃ እና ግንኙነት ክፍል | Plan |
| ዕቅድና ልማት ክፍል | Plan |

**Plan**: each department keeps its own list of planned work (what, due date, responsible person, status, note). The head and the department's planner role edit it; everyone else in the department can read it.
The last three pages of Education and the Programs/Uniform pages are not in UI.pdf; they were kept so no existing feature is lost.

## Hymn attendance: days chosen per month (new)
On **Hymn attendance**, the box **Days this month** lets you tick any weekdays (ሰኞ … እሁድ). Use **ቅዳሜ + እሁድ**, **ሙሉ ሳምንት** (whole week) or **Class default**.
The choice belongs to the month (and applies to every class that month), so this month can be Saturday + Sunday and next month the whole week. Change it any time; marks already entered on other days stay visible.

## Hymns: browse like a book (new)
**Hymns** opens with a search box and cards for the hymn groups (ዘወትር, መስቀል, የአቡነ ገብረ መንፈስ ቅዱስ, የቅዱስ ዑራኤል, የመድኃኔዓለም, የቅዱስ ገብርኤል, ጥምቀት, የልደታ ለማርያም, የአባ ሳሙኤል, ንስሐ, ሰርግ). Each card shows how many **ምድቦች** (categories, e.g. the 3 yearly feasts) and hymns it has.
Tap a card to see its categories, tap a category to read its hymns. A group with one category opens its hymns directly. Searching shows results from every group.
Groups are defined by `HYMN_GROUPS` in `index.html`; a hymn's category is chosen in the **Add a hymn** form (collapsed under the list).

## Attendance by day (new)
- **Education and Hymn attendance** now both work the same way: pick the **class** and the **month**; each week has **ቅ (Saturday)** and **እ (Sunday)** boxes. Extra days (holiday, make-up) use **Add a day**.
- **Class days**: *Classes & subjects → Class days* sets, for every class, whether it meets Saturday + Sunday, Saturday only or Sunday only – separately for lessons and for hymn study. Use it for 9 ለ or any class with a different arrangement. Marks already entered on another day stay visible.
- Old hymn records that were saved by date are not lost: they appear under **Earlier records by date** on the Hymn attendance page.

## Hymns index (new)
**Hymns** page now opens with **ማውጫ · Index** – every feast with its number of hymns. Tap a feast to see only its hymns (numbered 1, 2, 3…), or **ሁሉም** for all. Feasts follow the Ethiopian calendar order (HYMN_FEASTS in `index.html`).

## Hymn books included
The five hymn books you supplied (ጥቅምት 5, ሚያዝያ 27, ግንቦት 1, ሐምሌ 19, ሐምሌ 22 – 184 hymns) are loaded into **Hymns** the first time it is opened by someone who can edit hymns. The opening prayer «ልዑል እግዚአብሔር» (the same in every book) is kept once under **ዘወትር**. They can be edited or deleted like any other hymn; deleted ones do not come back.

## Who can do what (head and staff roles exist for every department)
- **Super admin** – everything, plus Setting (school year, contact, social links, gallery, backup) and creating **department heads**.
- **Department head (የክፍል ኃላፊ)** – opens every page of their own department and, in **User**, creates / edits / switches off / deletes the users of that department only.
- **Education roles** – Class teacher (assigned classes + subjects; Result and rank only if allowed), Registrar (Student, Register, Class lists), Attendance keeper (Attendance).
- **Hymn roles** – Hymn attendance keeper, Hymn editor.
- **Programs roles** – Program planner.
- **Finance roles** – Uniform keeper (Uniform moved here from Programs). A Uniform keeper created earlier under Programs keeps working; edit the user once to move them to Finance.
- **Human Resources** – *Members*: every student and hymn member with all details (search, class filter, Excel, and a File with results, attendance, hymn attendance and uniform history of every past year). *Departments data*: per-class figures, all-years history and plan status of every department.

Education head also manages **Classes & subjects** (add/rename subjects, edit class list) and **Promotion**.

The hymn index cards now all show the same church photo (church.jpg).

## Add another department later
In `index.html` (search for "departments, pages and roles"): add it to `DEPTS`, its pages to `PAGES`, its roles to `ROLES`, then add a `VIEWS.<page>` for each page. Tell Claude what the new department does and it can be added the same way.

## Put it online on Cloudflare (v35)
The shared database is now **Cloudflare D1** and sign-in is handled by a small **Cloudflare Pages Function** (`functions/api/[[path]].js`). Firebase is no longer used and `firestore.rules` is gone – the same rules are enforced inside that function, so there is nothing to publish.
Without the backend (`api: ''` in `CONFIG`, or opening the file from disk) the portal works on one device only (login `admin` / `1234`, then choose your own password).

**One-time setup** (needs a free Cloudflare account and Node.js on your computer):
1. In this folder run `npm install -g wrangler` (or use `npx wrangler …`) and `wrangler login`.
2. `wrangler d1 create sunday-school` → copy the printed `database_id` into **wrangler.toml**.
3. `wrangler d1 execute sunday-school --remote --file=schema.sql` (creates the tables).
4. `wrangler pages project create sunday-school-portal --production-branch main`
5. `wrangler pages secret put AUTH_SECRET --project-name sunday-school-portal` → paste a long random text (32+ characters; make it up once and keep it). It signs the login tokens. Changing it later logs everybody out.
6. `wrangler pages deploy public --project-name sunday-school-portal` (run this again whenever you change a file).
7. Open `https://<your-project>.pages.dev/api/health` – it must show `"ok":true`. Then open `…/#/portal`: the first screen creates the super admin (username `admin`).
8. Log in → **User** → create one **Department head** per department → give them their username and password. Each head then creates their own staff.

If you connect the folder to GitHub instead of using the command line, Cloudflare Pages reads `wrangler.toml` (output folder `public`, the D1 binding `DB` – keep the `database_id` filled in). Leave the build command empty and add the secret **AUTH_SECRET** under *Settings → Variables and Secrets*.

**Trying it on your computer:** copy `.dev.vars.example` to `.dev.vars`, run `wrangler d1 execute sunday-school --local --file=schema.sql`, then `wrangler pages dev public`.

**Moving the data from the old Firebase site:** on the OLD site open **Setting → Backup** and download the file (super admin). On the NEW site finish the first-time setup, then **Setting → Restore** and choose that file. Staff logins cannot be copied (Firebase never gives out passwords): create the department heads and staff again in **User**. After restoring, open the students who have a student-portal password and use **Publish results** (or just save them once) so their portal records exist in the new database. Self-registration submissions that were still waiting in the old inbox are not copied – review them first.

**Notes**
- Passwords are stored as salted PBKDF2 hashes (100 000 rounds). If sign-in ever fails with a Cloudflare "error 1102 / CPU limit" on the free plan, set a variable `PBKDF2_ITER` (e.g. `50000`) in the Pages project; new passwords then use it.
- Failed sign-ins are limited (10 per account / 40 per address per 15 minutes) and public registration submissions are limited to 10 per 10 minutes per address.
- One record can be at most about 1.9 MB.
- Free-plan D1 limits (5 GB storage, 100 000 writes a day) are far above what a school portal needs.


## Security notes
- Roles are enforced on the server (the Cloudflare function) only for: who may change the staff lists (super admin / own-department head) and settings. Page-level limits (e.g. a teacher seeing only their classes) are enforced inside the app, so a technical staff member could still read other school data directly.
- Department heads can also change `settings` (needed for classes, subjects and school year).
- Staff lists are now split: super admin + heads in `users`, each department's staff in `users_<dept>`. Existing users keep working (their department is taken from their role).

## Student portal, backup, Excel, uniform, zoom
Unchanged: `#/student`, Backup in Setting, Excel buttons, A− / A+ zoom, install app.

## v9.1 changes
- Public site button «Student Registration» is now «Portal».
- Hymn feast ጥቅምት 22 → ጥር 22 (Saint Uriel).
- Education → Classes & subjects: the *Class days* box was removed (lessons stay on Saturday + Sunday).
- Marks → Scoring method: the teacher now edits the parts as rows (name + «out of» number) with + / × buttons and a running total.

## v11 changes
- Class lists replaced with the new attendance workbook (359 students). The first time the **super admin** opens the portal, existing data is updated once: missing names are added, old names that are not in the new list and have no details are removed (students with any details, marks history or portal login are kept). The same list is used by Education and Hymn attendance.
- Human Resources → Members: one list of students (no separate hymn type).
- Finance & Property: Plan first, then Uniform.

## v12
- Dashboard: the big department boxes were removed (the top bar already has them); the per-department member/figure blocks are back.

## v13
- Finance & Property → **Sacred items (ንዋየ ቅዱሳን)**: count register for ከበሮ, ፅናፅል, መቋሚያ and ልብሰ ስብሐት in four kinds (የትልልቆች ወርቃማ, ሰማያዊው, የቀድሞ, የሕፃናት) with total / good / damaged, notes, extra items and Excel. Editable by the Uniform keeper, the Finance head and the super admin.

## v14
- Finance & Property → **Income & expense (ገቢና ወጪ)**: shows the school's current balance (ያለው ብር), opening balance, total income and expense. Income is recorded with its **source (ምንጭ)**; expense with its **reason (ምክንያት)** and an optional **letter / receipt photo**. Ledger with running balance, filter, extra photos later, delete and Excel. Editable by the Finance head, the Finance & property officer and the super admin. The balance also appears on the Dashboard of those users.
- Education and Hymn **Attendance**: **Week 5** is now added or removed with a button (it is hidden by default; a week 5 that already has marks stays visible). Under each table: present count and % per day, plus a **month summary** – students present on every day (count, %, names) and the overall attendance %.

## v16 – Member self-registration link (Human Resources)
**Human Resources → Self-registration (በራስ ምዝገባ)** (also on the HR Dashboard block).
- HR creates a link (`…/index.html#/join/<secret>`) and sends it by Telegram / WhatsApp / copy. Buttons: **Open / Close** the link, **New link** (the old one stops working).
- Anyone with the link fills in their own details on their phone: name, Christian name, sex, age, class (or "I don't know"), guardian, phone, address, confessor father, optional photo, notes. **People who are not in the class lists can register too.**
- Nothing enters the student list by itself. Each submission waits in **Waiting for review**. HR presses **Review**, corrects anything, **chooses the class** and accepts: a new student is added, or – when the name already exists – the existing student is updated (the screen offers both). Reject deletes it. Excel export of the waiting list is included.
- Who controls it: super admin, the HR head and the HR officer (`hr_staff`). Nobody else sees the inbox.
- Protection: secret token in the link, open/closed switch, hidden trap field, 8-second wait between submissions, and **server rules** that limit what may be sent. The public can only create records; only HR can read, change or delete them.

**To turn it on:** needs the shared Cloudflare backend (see "Put it online"). Without it the portal is one-device-only, so a link cannot reach other phones.
Files changed: `index.html`, `sw.js` (cache v16).

## v17
- New classes **9 ሀ** and **አርድእት** are added to the class lists (also to lists saved earlier – added once, when the super admin or a head opens the portal). Add students to them in Education → Class list.
- For **አርድእት** the Parent / guardian box is hidden (Register, self-registration form and its review screen).

## v18
- Self-registration page now also shows a **QR code** of the link (works offline – generated inside index.html). **Download PNG** (with the school name) or **Print**, then post it on the notice board. «New link» changes the QR too.

## v20 – Reports
- Education › Report and the new Hymn › Report (ሪፖርት) list both the **absent** (below the limit %, with reason notes) and the **present** (at or above the limit %).
- Choose the period with **From month → To month** (same month in both = one month). "Show" can display Both / Absent / Present. Excel has three buttons: absent only, present only, or both (Status column).
- Hymn Report is open to the hymn head, the super admin and the Hymn attendance keeper.

## v22 – Attendance edit lock
Education and Hymn attendance are locked until the keeper taps **Edit**; **Done** locks again. Changing class, month, year or page also locks it.

## v24 – Self-registration form
- New required question **አዲስ ወይስ ነባር ተማሪ? (New or existing)**. Accepted new students are marked «new this year»; the count is on the Dashboard (Education table has a *New* column per class, HR block has a tile), in Members and in the Excel exports.
- **Two phone numbers**: student phone (`phone`) and parent phone (`phone2`; hidden for አርድእት). Both are in Review, Student edit/file, Members and Excel.
- The server accepts the `phone2` field (the backend already allows it).

## v25
- **Human Resources can edit students**: Members → **Edit** (HR head, HR officer, super admin). Education keeps its own Students/Register pages.
- **Student form (የተማሪዎች መመዝገቢያ ቅጽ)**: Members → **Form** (or inside File). Follows the paper form: photo, names split into first / father / grandfather, Christian name, confessor, address, both phones, registration date (converted to the Ethiopian calendar), class tick-box 1ኛ–12ኛ. Buttons: **Word (.docx)** and **Print / PDF** (choose "Save as PDF" in the print window).
- **Results ON/OFF** button on that dialog adds or removes the results table (all years: subjects, total, average, rank).
- **Excel with all classes**: Students and Members downloads now have **one sheet per class**.

## Registration form questions (v26)
The student **Register** and **Edit** forms now ask every question of the paper form (የተማሪዎች መመዝገቢያ ቅጽ): diocese, ክ/ከተማ, ወረዳ, የቤ.ቁ, birth day/month/year (age is filled in automatically when left blank), secular education level, contact person's ወረዳ and የቤ.ቁ, previous Sunday-school participation (yes/no + where), who filled the form, the officer, and both dates. The printed form and the Word file use these answers.
**Print / PDF** on a student's form prints only that one student (the PDF is named after the student). After registering a new student the form opens straight away; **Form · Print / Word** is also on the Edit page.

## Ethiopian dates (v27)
Every date on the student form (registered on, date filled, officer's date) is picked with the Ethiopian calendar: day · month (መስከረም…ጳጉሜን) · year. It is saved as a normal date internally, so nothing already saved changes. Lists, files, Excel and the printed form show Ethiopian dates.

## HR can register students too (v28)
Human Resources now has its own **Register (ምዝገባ)** page (next to Members), with the same form as Education. The HR head and the HR officer can open it, and Members also has a **+ Register student** button. Students registered there appear in Education right away. The Education Register page works as before.

## Passport photo cropper (v29)
Choosing a photo (Register and Edit) opens a 3:4 passport-style (ጉርድ) frame: drag to move, zoom with the slider, + / −, mouse wheel or two fingers, then **Use photo**. Tap the photo preview to adjust again. Saved at 300×400.

## v30
Removed the questions «Date filled», «Officer who had it filled» and «Officer's date» from Register/Edit. On the printed form and Word file the ቀን and ቅጹን ያስሞላው ኃላፊ lines stay blank for signing by hand.

## v31
Registration form: typed answers are bold (dark blue) while the questions stay regular; the coloured header band (yellow to teal, with the school logo) is added at the top of the printed form and the Word file.

## v32 – registration form
- Header band now carries the two emblems (`emblem-l.jpg`, `emblem-r.jpg` – keep them in the same folder) on the printed form and in Word.
- Results (ውጤት) are never part of the form any more; the ON/OFF button was removed.
- **All forms at once**: on **Members** (HR) and **Students** (Education) the buttons **ሁሉም ቅጽ · Word** (one .docx, each student on its own page) and **ሁሉም ቅጽ · Print/PDF** (each student on its own page; choose «Save as PDF») use the current class / search filter. Pick a class first to get only that class.

## v33 – absent list as Word
**Report** (Education and Hymn) now has **Word · ያልተገኙ**. It downloads the list of people below the limit % for the chosen months as a .docx in the school's format: navy title bar («በጥቅምት ወር ያልተገኙ ተማሪዎች ዝርዝር እና ለጥያቄ ማዘጋጃ»), table ተ.ቁ · ሙሉ ስም · ክፍል · የቀረበት ቀን/ሳምንት · የመቅረት ምክንያት · የተደረገ ክትትል, and the footer with page numbers. Blank rows are added up to 27 so the rest can be written by hand. The reason column is filled from the notes typed on the Report page.

## v34 – parent photo
Register and Edit have a second photo box, **የወላጅ ፎቶ (Parent / guardian photo)**, with the same passport-style cropper (drag + zoom). It fills the right-hand photo frame on the printed form and the Word file (single and all-forms). It is saved, backed up and removed together with the student.

## v35 – database moved from Firebase to Cloudflare
- **Cloudflare D1** replaces Firestore and **our own sign-in** (in the same Cloudflare function) replaces Firebase Authentication. All the old permission rules (who may read/write staff lists, settings, student-portal records, the self-registration inbox) are enforced there.
- `index.html`: the `CONFIG` block now has `api: '/api'` instead of Firebase keys; the sign-in, document and storage code talk to `/api`. Everything else is unchanged.
- New: `functions/api/[[path]].js`, `schema.sql`, `wrangler.toml`, `.dev.vars.example`. Removed: `firestore.rules`. `sw.js` (cache v35) never caches `/api`.
- Deleting a staff member now also removes their login.
- Moving old data: see "Moving the data from the old Firebase site" above.

