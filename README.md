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
- Standard 2-4-2 room (four rows, 32 seats), **IT3 (34 seats: 8 top, 7 left, 7 right and 12 on the central island in two rows of 6)**, pairs, group tables and U-shape, plus custom drag-and-drop editing, teacher desk and per-seat accessibility priority.
- Manual placement, swaps and locking; automatically suggested seating according to separation, preferred pairing and accessible seating rules. Conflicts are reported rather than silently ignored.
- Named seating plan versions, duplication, comparison and undo/redo.
- Missing homework, lateness, behaviour entries, dated notes, pupil support and attainment views.
- Random questioning without repetition, absence exclusion and grouping by attainment or position.
- Print-friendly teacher and pupil plans; empty room template exports and encrypted complete workspace backups.

## IT3 preset

The **IT3** room is available immediately in the Room Designer, including a central island and teacher desk at the front. Choose **IT3 · 34 seats** in the layout preset menu for another room. Staff can still move individual seats or edit accessibility priorities. Preset geometry, custom room edits and seating assignments are included in encrypted local backups. The photograph and pupil names from the reference screenshot are **not** committed or included in the application.

## Install on GitHub Pages

1. Upload `index.html`, `styles.css` and the `js` folder to the `main` branch of `kingsnortongirls/seatingplans`.
2. In repository Settings → Pages, select **Deploy from a branch**, `main`, `/ (root)`.
3. Visit `https://kingsnortongirls.github.io/seatingplans/` using a recent Chromium, Edge, Firefox or Safari browser.
4. Test imports with **synthetic data first** and complete the school's approval before importing real pupil records.

## Testing

`tests/smoke.py` uses Playwright with synthetic pupils to exercise class import, plan creation, auto-seat, rules, versions, room editing, record entry, questioning and groups. It also tests synthetic Word text-box OPP parsing without any network request. See `tests/crypto.mjs` for a Node Web Crypto round-trip check.

**Do not commit real Edulink CSVs, Word OPPs, ZIPs, backups, images or screenshots containing pupil data.**
