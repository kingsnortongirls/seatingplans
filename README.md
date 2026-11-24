# Seating Plans | Private Teacher Toolkit

A fully client-side seating plan and teaching toolkit designed for static hosting on GitHub Pages. No pupil files or example personal data are included.

## PDF One Page Profile import

**Supported:** searchable, text-based `.pdf` files, Word `.docx` files, several of either format selected together, and `.zip` archives containing a mixture of PDFs and DOCX files. All extraction and pupil matching runs locally. No external PDF library, OCR service, file upload or network request is used.

**Not supported:** scanned/image-only PDFs without a text layer, encrypted PDFs, and some unusual PDF encodings. The importer reports individual file errors and leaves the pupil's existing profile untouched. To use a scanned OPP, obtain the original Word file or create a searchable PDF using school-approved OCR software before importing. **Always check the pupil's imported support information and seating preferences**, since PDF layouts may place text in a different reading order from Word.

The embedded browser extractor includes internal size/complexity limits and avoids inferring names or needs from unreadable image content.

## Complete guided setup: imports, two backups and all seating plans

Every **fresh page load** offers **Restore my backup** or **Set up my classes**. No pupil data or wizard progress is retained in browser storage.

1. **Import a class:** choose an Edulink CSV, review matches and explicitly confirm.
2. **Import its One Page Profiles:** the wizard scrolls to the OPP step. The folder reference is **Staffshare → Inclusion → Inclusion Matters → One Page Profiles**. Select multiple Word `.docx` or searchable PDF `.pdf` files, a mixed ZIP, or drag them onto the upload area. Ambiguous pupil matches require teacher confirmation. The OPP step can be skipped.
3. **Repeat for each class:** after each import, choose **Import next class**, **Import more OPPs**, or **Done importing · Back up classes**. Multiple teaching groups in one CSV are supported.
4. **Back up the imported classes:** an encrypted backup form opens, with a filename beginning `seating-classes-`. The wizard requires you to **verify the downloaded file against the current session** before continuing. Downloading alone does not count as a successful backup.
5. **Set up seating plans class by class:** the wizard displays every imported class and its progress. For each one, select a room template (or existing plan), review OPP-derived seating suggestions, approve applicable rules, preview the rules-aware generator, and inspect/adjust the final positions on the normal seating plan screen. An easy **Return to guided setup** button takes you back. Before confirming, the wizard reports unseated pupils, unmet required rules, advisory conflicts and unreviewed OPP suggestions. Any outstanding concerns require explicit acknowledgement.
6. **Confirm each class:** the wizard automatically advances to the next group. You may revisit a previous class, and edits to that class invalidate its previous confirmation.
7. **Back up the completed seating plans:** after the last class is confirmed, the wizard opens the final encrypted backup form. The filename begins `seating-plans-finished-`. **Verify this second downloaded file** before selecting **Finish guided setup**.
8. **Return to teaching:** the completed view links to Seating Plans and the dashboard. Both files should be stored only in a school-approved secure location. Create and verify an updated backup after subsequent changes.

The two exports are full encrypted session backups taken at different points. The first protects imported class/OPP data before room design, while the second also captures all the final seating assignments and rules. Both use the existing AES-256-GCM protection and minimum 8-character password. They are **not automatically stored**.

If you restore a verified classes backup on a subsequent visit, the dashboard has **Guided seating plans** to resume from the seating stage without reimporting the pupils. Staff can also leave the wizard and use the rest of the application normally.

Staffshare is a folder-location instruction, **not an automatic network connection**. No document, class, OPP, seating plan or backup is uploaded or sent to a service. There is no persistent onboarding state, server account or automatic saving. Cancelling an import or backup does **not** delete your current work. Closing or refreshing the browser without storing verified encrypted backups risks losing that session.


## Data protection and deployment

* Edulink CSVs, Word DOCX OPPs, searchable text-based PDFs and ZIP bundles containing either or both formats are parsed by JavaScript in the teacher's own browser. Files are not uploaded.
* There is no backend, API, analytics, external font, runtime CDN, login, cookies, localStorage, IndexedDB or service worker.
* The Content Security Policy blocks network connections with `connect-src 'none'`, remote scripts, frames and object embeds.
* Pupil and teacher record data is held in memory. Reloading or closing the page discards the session unless the teacher chooses to download a local **encrypted** backup.
* Backup export uses native Web Crypto AES-256-GCM with PBKDF2-SHA-256 (310,000 iterations), unique random salt and IV. Passwords never leave the browser and cannot be recovered. New backups require passwords of at least **8 characters**; a longer, unique passphrase is recommended. Existing backup files continue to restore using their original password.
* Exported backups can contain highly sensitive pupil data, including OPP wording and photographs. Treat them as school confidential records and store only in school-approved protected locations.
* Teacher printouts may display confidential information. Pupil printouts deliberately hide the indicators on seating cards.
* A static website still needs school approval and a deployment/data protection review. GitHub serves the blank application files only; it receives ordinary page requests for app files, never imported pupils.
* To guarantee fully offline access, download the files to a school-managed device and serve them on an approved local origin. For browser modules and encryption, a secure HTTPS or loopback origin is recommended. Opening `index.html` directly as a `file://` page may block ES modules.

## Features

- Import or refresh Edulink marksheets with pupil name, class, reg group, SEND, PP, EAL, prior attainment, reading/spelling ages, target and current grades.
- Bulk OPP import from `.docx`, searchable `.pdf` or `.zip` files, including mixed PDF/Word archives. Word text boxes and photographs are supported; searchable PDF text is extracted locally without accessing a service. Scanned/image-only PDFs, encrypted PDFs or unusual PDF encodings are reported as errors rather than silently attached to pupils. Ambiguous pupil matches require review.
- Standard 2-4-2 room (four rows, 32 seats), **IT3 (34 seats: 8 top, 7 left, 7 right and 12 on the central island in two rows of 6)**, **IT2 (33 seats: 8 left, 7 right, 10 central, 4 upper and 4 lower)**, pairs, group tables and U-shape, plus custom drag-and-drop editing, teacher desk and per-seat accessibility priority.
- Manual placement, swaps and locking; automatically suggested seating according to separation, preferred pairing and accessible seating rules. Optional **SEND and/or Pupil Premium accessible seat preference** is selected separately on each plan, with capacity and individual unaccommodated-pupil reporting. Conflicts are reported rather than silently ignored.
- Named seating plan versions, duplication, comparison and undo/redo.
- Missing homework, lateness, behaviour entries, dated notes, pupil support and attainment views.
- Random questioning without repetition, absence exclusion and grouping by attainment or position.
- Print-friendly teacher and pupil plans; empty room template exports and encrypted complete workspace backups.

## Simplified Room Designer

- **Select room** switches between existing named rooms without modifying them.
- **Edit room** uses the canvas directly: drag desks or the teacher's desk, click a seat to adjust accessibility, and add or remove seats.
- **+ New room** asks for a name and a one-time starting layout (2-4-2, IT2, IT3, pairs, groups or U-shape). There is no second preset dropdown to confuse with the saved room.
- **Reset room** restores that room's recorded starting preset (IT2 resets to IT2, IT3 resets to IT3), with confirmation and Undo. Existing seating plan versions are not changed.
- The selected room's starting preset is retained in encrypted backups. Legacy custom rooms with no identifiable starting preset cannot be reset until replaced with a new template.

## IT3 preset

The **IT3** room is available immediately in the Room Designer, including a central island with both the whiteboard and teacher desk at the bottom of the plan (the teaching front). Choose **+ New room**, then select **IT3 · 34 seats** as the starting layout. Staff can still move individual seats or edit accessibility priorities. Preset geometry, custom room edits and seating assignments are included in encrypted local backups. The photograph and pupil names from the reference screenshot are **not** committed or included in the application.

The IT3 starting layout follows the approved classroom screenshot. Seats **13, 20 and 29 to 34** start as **easy teacher access**; seats **15 and 22** start as **avoid if possible**. All others start as standard seats. Room edits remain possible, and Reset Room restores these default classifications. No names or photos from the reference screenshot are part of the preset.

## IT2 preset

The **IT2** classroom is also available immediately in Room Designer, and as a 33-seat option when choosing **+ New room**, including all 8 usually unoccupied positions: four on the upper desks, two at the lower-left table, one on the left bank and one in the central block. The whiteboard and movable teacher desk are both at the bottom of the plan, matching IT3. 'Front' seating priority correctly means closer to the lower edge for these two rooms. Empty positions remain real, assignable seats, not permanently blocked chairs. No names or photographs from the reference screenshot are included.

## Teacher-selected SEND / PP accessible seating

From a seating plan, choose **SEND / PP accessible seats**. Tick SEND, PP or both, and save the preference. This is **off by default** and applies only to that plan version. The generator tries to reserve green **easy teacher access** seats for eligible pupils, counting any pupil flagged in both groups **once**. Individual seat locks and existing mandatory separation/priority rules remain in effect.

The seating plan displays the total eligible pupils, number of accessible seats, a warning when marked accessible capacity is insufficient (including when locks occupy those seats), and a teacher-only list of eligible pupils not placed in accessible seats after generation. It is a preference, not an assumption that everyone with SEND or PP needs a special position. Teachers should confirm individual provision and adjust seats manually where appropriate. All eligibility checks, optimisation and reporting happen **locally in the browser**, and no pupil details or preferences are sent over the network. Preferences and results are included only when the teacher explicitly exports an encrypted backup.

## Four priority classroom improvements

1. **Non-destructive pupil swapping:** Move an already seated pupil onto another occupied seat to swap the two places. Locked seats are protected and the change can be undone. Trying to place a previously unseated pupil onto an occupied seat is rejected rather than silently removing the other pupil.
2. **Named seating-rule validation:** Seating plan rules are classified as required or advisory. The seating plan shows the affected pupils and unresolved rules. If a generated proposal breaches a required rule, the current plan stays unchanged unless the teacher explicitly chooses **Apply despite conflicts**.
3. **Edulink import review:** Before anything is changed, the browser shows suggested matched pupils, additions, duplicates and possible name changes. Where a matching identifier exists in the Edulink file it is used within the same teaching class; otherwise a unique pupil-name match is suggested. Staff can manually match renamed pupils and choose whether missing pupils should become **inactive**. Missing pupils are retained by default, and existing seating versions, OPPs, notes and records remain linked to matched pupils.
4. **Whole-class missing homework:** Choose **Mark homework** from Seating Plans (or **Mark whole-class homework** from Teacher Records), enter the task and due date, then tap pupils on the plan or class list. The selection is temporary until **Save missing records** is confirmed. Repeat marking of the same pupil, task and due date updates the existing local homework record rather than duplicating it.

These changes retain the strict **local only, no automatic student-data storage** design.

OPP text is interpreted locally using explicit, deterministic phrase matching, not sent to an external AI service. Near-teacher means one of the closest third of seats to the teacher desk in the current room template. Independent seating means no other assigned pupil within 15 layout units. These are useful starting definitions, not substitutes for reviewing the individual OPP and room layout. Backups and restoration remain encrypted and entirely browser based. Always test with synthetic data and obtain school approval before using real pupil files.

## Interface and everyday workflow

The interface uses a consistent set of **local SVG icons** across the menu and main actions; there is no external icon library or remote asset request. Navigation is grouped into **Plan & teach**, **Pupil information** and **Your data**, with a mobile drawer that closes on navigation or a tap outside.

The dashboard has four prominent steps: **Set up classes → Create seating plan → Start a lesson → Save a backup**. The seating-plan screen keeps frequently used actions visible and groups less frequent controls under **More views** and **More plan options**.

### Tap a seated pupil for their support summary

On the **Seating plans** or **Lesson mode** screen, click or tap an **occupied seat** to open a private, concise **Pupil support at a glance** dialogue. It includes available SEND/PP/More Able/EAL flags, OPP area of need, identification and access arrangements, seating preferences, selected classroom adaptations, pupil voice and reviewed teacher strategies. It also provides **Full OPP / profile** and quick record actions. It does not display pupil photographs.

This is **teacher-only** information. It is never added to pupil printouts or the name-only projector view, and the pop-up is hidden in printed views. Privacy lock closes any open pupil dialogue.

**Tapping a pupil never swaps or moves them.** Select **Move / swap** deliberately and then tap the destination seat. Alternatively, select a pupil in the class register and tap a seat to place them. An active move can be cancelled, and Undo remains available. While marking missing homework, tapping a seat continues to mark the homework record rather than opening a profile.

## Classroom features, generation and privacy verification

### Teacher-only teaching features

- **Projector view:** opens a separate name-only classroom view. Pupil names and their positions are the only pupil information copied into its page. SEND/PP, OPP content, attainment, notes and photographs are not included. Reopen the projector view to focus it; the random name picker highlights the selected seat and can request full-screen display, depending on browser permissions.
- **Attainment bands:** comparable GCSE 9–1 or A-level A*–U current/target grades are shown as a five-colour indicator: 2+ below, 1 below, on target, 1 above, 2+ above. Mixed scales, unknown grades or missing results are not compared. Pupil printouts hide this indicator.
- **OPP seating preferences:** the local parser automatically identifies *explicit* preferences such as **front seating**, **near the teacher desk**, **independent seating**, and **easy-access seats**, while excluding general adaptations such as reading materials, task boards, chunking, praise and questioning strategies. Suggestions are grouped by pupil and type, with the original wording shown. After importing OPPs, the tool reports the number of potential seating preferences, and the seating-plan button shows outstanding suggestions. Teachers can tick and approve several suggestions together (advisory by default), or review one and make it mandatory. The generator and rule audit honour the approved rules and warn of conflicts. Guidance involving an unmodelled feature, such as sitting away from a specific window, is flagged for **manual review only**. No OPP rule is added or a pupil moved without teacher confirmation.
- **Plan notes:** each seating plan version can have private teacher rationale/review notes, retained in the encrypted backup.
- **Spinning random pupil picker:** eligible names roll past visibly for around two seconds in Lesson Mode and Teaching Tools (including the name-only projector). The winning pupil is drawn randomly *before* the animation; it does not favour the name that happens to appear on a frame. Reduced-motion settings skip animation. Only pupils explicitly marked **Questioned** are excluded from subsequent selections. No photography is added to seating cards.

### Six-option seating generator

Click **Generate seats** to select the priorities before generating:
1. Prefer accessible seats for SEND pupils
2. Prefer accessible seats for Pupil Premium pupils
3. Keep teacher-specified pupils apart
4. Preserve existing locked seats
5. Balance high and low prior attainment across table groups
6. Apply front-seat rules for individually selected pupils

Nothing is changed until the **Review proposed seating plan** screen is explicitly accepted. It reports required conflicts, advisory preferences, accessible-seat shortfalls and affected pupils. Opting out of locked seats clears locks only when the teacher applies the proposal. Disabling a mandatory rule does not delete it: any resulting conflict must still be acknowledged explicitly before application. Options are remembered per plan version, and Undo is available.

### Verify backups and test that pupil data remains local

**Backup & restore** now has **Verify downloaded backup**. Choose a downloaded `.seatingplan` file, enter its password and locally decrypt it without changing the session. It reports whether the file is readable and whether it exactly matches the current session. The 'Changes not backed up' marker is only cleared after an exact successful verification; an attempted download alone cannot guarantee that a file was retained.

`python tests/privacy_e2e.py` uses localhost and synthetic pupils to test the real (not disabled) Content Security Policy, verify name-only projector output, block an attempted external POST, round-trip the encrypted backup and restore it into a clean browser session. `python tests/smoke.py` covers the general interface; `node tests/crypto.mjs` checks encryption and decryption. The test suite requires locally installed Playwright and Chromium. **Only synthetic pupil records should ever be used in these tests.** The application is still subject to school IT and data-protection approval.

## Classroom features and lesson improvements (November 2026)

The application includes pupil imports, seating arrangements, teaching strategies, assessment history and day-to-day classroom records.

### Restored original workflows
- **Task timer:** dedicated local countdown within Lesson mode, with 2/5/10/15/20/30 minute presets, custom duration, pause/resume and fullscreen.
- **COTTA choice:** Edulink imports retain all recognised assessment column headings and their per-pupil values. Assessment history includes a class-specific **Displayed Edulink COTTA** dropdown that updates the grade shown on pupil cards. A reviewed CSV import reports missing required headings and duplicates.
- **Teacher assessments:** enter, edit, or delete dated results with a result, target and notes, independently of Edulink. Results survive a class refresh and appear in each pupil's history and progress chart. Pupil cards show both selected COTTA and latest manually saved result.
- **Pupil strategies:** separate teacher-maintained **Agreed teaching strategies**, **What helps me learn (pupil voice)**, and **Reviewed date** fields, preserved on matching Edulink imports.
- **Questioned/absent:** picking a name no longer marks it questioned. Use **Questioned ✓** or **Absent** explicitly; reset the round for a new lesson. Optional exclusions prevent calling on absent pupils.
- **Behaviour and lateness:** separate totals for late arrivals and other behaviour, including older incidents categorised as **Late to lesson**. Record a date, optional lesson/period, minutes late and notes. Teacher Records provides pupil-level lateness totals and 7/30/90-day trends, plus editable behaviour categories.
- **Class overview:** attainment vs target, key class indicators, import quality, homework totals, lateness and other behaviour counts. A blank SEND or PP cell is not a missing-data error; only explicit indicators count. Older COTTA records with a saved current grade are supported. Includes teacher-controlled local CSV export without OPP text or SEND/PP fields.
- **Privacy:** hide confidential indicators on the live seating plan, use the name-only projector, or select the top-bar **Privacy lock** (also **Alt+L**) to conceal the workspace instantly. It also closes open dialogs and projector windows. This is a visual privacy screen, **not a password-protected security lock**.
- **Pupil card labels:** give **SEND** and **PP** separate, high-priority badges on the live teacher view and printout, followed by any More Able/EAL flags and compact other information. Visible seat numbers have been removed from seating cards to free space; room designer controls and seat identifiers remain available for editing. Pupil printouts and name-only projector hide confidential tags. No photographs are required.
- **Restore previous seating:** restore the last generated/cleared arrangement in a plan version, in addition to the existing Undo and saved versions.

### Additional improvements
- **Integrated Lesson mode:** one screen for seating, timer, random picker, questioned/absent status, missing homework and behaviour actions.
- **Progress graph:** dated assessment results plotted per pupil, with targets shown only when their scale is comparable.
- **Import quality:** source warnings for duplicate headings or missing target, SEND, PP and COTTA fields, plus missing pupil data in Class overview.
- **Quick pupil actions:** tap a seat in Lesson mode, or right-click / long-press a seated pupil, to open profile, homework, behaviour, rule and seat-lock actions.
- **Homework trends:** missing and resolved totals plus pupil counts over 7, 30, 90 days or all dates.
- **Academic-year rollover:** creates a new class and fresh pupil identities while retaining the old class, versions, assessment history and records. Optionally archive the old class. Reimport a new Edulink list afterwards to update grades.
- **Local-only controls:** no cloud services, tracking, localStorage or external dependencies. New fields are contained in explicit encrypted session backups and old schema-1 backups remain importable.

### Regression tests
Run `npm test` for the dependency-free synthetic logic and encryption tests. The browser test is `npm run test:browser` (requires an installed Playwright/Chromium environment). The privacy test uses the *real CSP*, tests a blocked attempted external POST and checks encrypted backup verification and restore. Do not commit real pupil data, assessment exports or OPP content. A browser test is still required before production use on school-managed devices.

## Install on GitHub Pages

1. Upload `index.html`, `styles.css` and the `js` folder to the `main` branch of `kingsnortongirls/seatingplans`.
2. In repository Settings → Pages, select **Deploy from a branch**, `main`, `/ (root)`.
3. Visit `https://kingsnortongirls.github.io/seatingplans/` using a recent Chromium, Edge, Firefox or Safari browser.
4. Test imports with **synthetic data first** and complete the school's approval before importing real pupil records.

## Testing

`tests/smoke.py` uses Playwright with synthetic pupils to exercise class import, plan creation, auto-seat, rules, versions, room editing, record entry, questioning and groups. It also tests synthetic Word text-box OPP parsing without any network request. See `tests/crypto.mjs` for a Node Web Crypto round-trip check.

**Do not commit real Edulink CSVs, PDF or Word OPPs, ZIPs, backups, images or screenshots containing pupil data.**
