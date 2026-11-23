# Seating Plans | Private Teacher Toolkit

A fully client-side seating plan and teaching toolkit designed for static hosting on GitHub Pages. No pupil files or example personal data are included.

## Data protection and deployment

* Edulink CSVs, Word DOCX OPPs and ZIP bundles are parsed by JavaScript in the teacher's own browser. Files are not uploaded.
* There is no backend, API, analytics, external font, runtime CDN, login, cookies, localStorage, IndexedDB or service worker.
* The Content Security Policy blocks network connections with `connect-src 'none'`, remote scripts, frames and object embeds.
* Pupil and teacher record data is held in memory. Reloading or closing the page discards the session unless the teacher chooses to download a local **encrypted** backup.
* Backup export uses native Web Crypto AES-256-GCM with PBKDF2-SHA-256 (310,000 iterations), unique random salt and IV. Passwords never leave the browser and cannot be recovered.
* Exported backups can contain highly sensitive pupil data, including OPP wording and photographs. Treat them as school confidential records and store only in school-approved protected locations.
* Teacher printouts may display confidential information. Pupil printouts deliberately hide the indicators on seating cards.
* A static website still needs school approval and a deployment/data protection review. GitHub serves the blank application files only; it receives ordinary page requests for app files, never imported pupils.
* To guarantee fully offline access, download the files to a school-managed device and serve them on an approved local origin. For browser modules and encryption, a secure HTTPS or loopback origin is recommended. Opening `index.html` directly as a `file://` page may block ES modules.

## Features

- Import or refresh Edulink marksheets with pupil name, class, reg group, SEND, PP, EAL, prior attainment, reading/spelling ages, target and current grades.
- Bulk OPP import from individual `.docx` or `.zip` files with Word text-box extraction, photo extraction and exact pupil-name matching; ambiguous matches are shown for review.
- Standard 2-4-2 room (four rows, 32 seats), **IT3 (34 seats: 8 top, 7 left, 7 right and 12 on the central island in two rows of 6)**, **IT2 (33 seats: 8 left, 7 right, 10 central, 4 upper and 4 lower)**, pairs, group tables and U-shape, plus custom drag-and-drop editing, teacher desk and per-seat accessibility priority.
- Manual placement, swaps and locking; automatically suggested seating according to separation, preferred pairing and accessible seating rules. Conflicts are reported rather than silently ignored.
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

## Install on GitHub Pages

1. Upload `index.html`, `styles.css` and the `js` folder to the `main` branch of `kingsnortongirls/seatingplans`.
2. In repository Settings → Pages, select **Deploy from a branch**, `main`, `/ (root)`.
3. Visit `https://kingsnortongirls.github.io/seatingplans/` using a recent Chromium, Edge, Firefox or Safari browser.
4. Test imports with **synthetic data first** and complete the school's approval before importing real pupil records.

## Testing

`tests/smoke.py` uses Playwright with synthetic pupils to exercise class import, plan creation, auto-seat, rules, versions, room editing, record entry, questioning and groups. It also tests synthetic Word text-box OPP parsing without any network request. See `tests/crypto.mjs` for a Node Web Crypto round-trip check.

**Do not commit real Edulink CSVs, Word OPPs, ZIPs, backups, images or screenshots containing pupil data.**
