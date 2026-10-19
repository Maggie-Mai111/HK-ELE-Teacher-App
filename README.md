## Offline continuity — v15, completed 2026-10-20

Navigation falls back to the installed App or cached shell on HTTP errors (including 503) as well as network loss. Healthy responses remain online-first; a first visit without a local copy retains the original server error. Error pages never replace a saved App.

After an offline download or rollback, reopening checks session-only passage text, photo/OCR work and Known/Not known answers. It offers Back to my text or an explicit Reopen and clear session choice. Returning preserves the current passage, OCR edits and answers; confirmed reopening clears that session while keeping saved lessons/notes. A pending/failed lesson save or active download blocks reopening. These checks add in-memory flags only, not passage/photo/response persistence or collection.

## Offline PWA — v14, 2026-10-19

Menu → Offline use prepares a verified, full-database download (about 115 MB including OCR, application assets and all 163,784 Package67 families). Online link use remains available. Downloading is explicit, not automatic on first visit. A complete download is activated atomically; cancelled/failed downloads retain the previous generation and never write lesson storage. Reopen after installation or rollback; each running tab pins one data generation. The browser may evict storage, so readiness checks the entire inventory and supports repair. AI interpretation, Google Forms and new downloads still require a connection.

The deployment finalizer generates `offline-package.json` from the explicitly approved data inventory in `src/config/offlineDataReleases.json`, the existing update manifest, OCR and the exported shell. Web/App data parity is checked using `node scripts/verify_web_data_parity.mjs <explicit-web-data-directory>`. The build refuses data fingerprint changes without an explicit new approval. See [offline and data-update workflow](OFFLINE_AND_DATA_UPDATES_ZH.md). This does not refresh research data or provide native APK/IPA release.

Targeted local cold-start acceptance stops the independent preview service and closes/reopens the browser tab, checks a previously unopened non-Core record, new passage analysis, in-context detail/return, first-use OCR and Excel export. Physical iOS/Android installation, flight mode, camera and long-term storage remain device checks after deployment. The Web UI is unchanged from v13; its data matches the App's current Package67 inventory.

# HK-ELE Teacher App and PWA

HK-ELE helps teachers look up vocabulary, check classroom texts, review word-family and form evidence, and build editable teaching lists. The PWA includes on-device English OCR with an editable preview, contextual Known/Not known responses, vocabulary-review suggestions, highlighting, text-complexity information and teaching-list exports. Problem reports and word ratings open the configured Google Forms with a prefilled product and word reference.

## Word and lesson continuity — 19 October 2026 (v13)

Exact-form searches retain the database's matched form when opening its information or adding it to a lesson. Mobile results name the matched word and its family; family evidence remains explicitly labelled. A different form in the same family can be added separately. Lesson rows with multiple selected forms offer a choice when opening word information. List entry counts consistently mean selected words, with family counts labelled separately in the lesson summary.

Text suggestions, optional batch selection, search and word information show the active lesson and a compact Change lesson action. Teachers can switch or create a lesson there without a compulsory setup step before checking text. Existing device-local lessons, notes and migration keys are retained. Feedback opens with the selected word already shown; Change word is optional. Sort is labelled directly. The privacy notice distinguishes submitted Google Forms responses from click/feature-use collection, which remains disabled and requires a separate future agreement.

## Saved lessons and long-text navigation — 19 October 2026 (v12)

Teaching list now supports multiple named lessons on this device, with one active lesson at a time. New lesson starts an empty list and retains the previous lesson. Saved lessons switches between lists; inline lesson-name editing, plans, notes, word order, selected forms and exports apply to the active lesson. Names are included in export filenames so files from different lessons are easier to distinguish. Changes save automatically, with a visible saving/error state and a retry action.

The new `hkele-lessons-v1` library migrates the existing current list once, preserving all teacher fields. The earlier `hkele-teaching-list-v2` and Package72 keys remain read-only migration sources, not overwritten backups. Invalid or unsupported library data stops loading without replacing it. Changes and queued writes are scoped to the selected lesson; Undo is reset on a lesson switch. Evidence refresh merges only evidence fields, preserving notes and decisions edited while a lookup was in progress. Stable family identities and per-item data-version fields remain available for future approved wordlist refreshes.

For passages over 80 checked words, a shortcut above the reader opens pre-teaching suggestions; a reciprocal control returns to the text. Both routes move keyboard focus to the target. Native navigation uses the existing App scroll container. Short passages keep the compact layout.

The passage remains a temporary working text. Switching lessons resets contextual knowledge responses, selection checkboxes and the optional class-level setting, so one class's responses are not silently reused for another. Saved lessons contain selected words and teacher notes, not the source passage or Known/Not known answers. Storage is local; account synchronisation, sharing and server collection are outside this update. Earlier sections below describe the preceding versions.

## Teacher workflow refinements — 19 October 2026 (v11)

Class level is now optional and starts unselected. General pre-teaching reasons remain available; comparisons with a chosen class level use the actual form's textbook evidence where present, or explicitly labelled family evidence. Missing HK ranks no longer create an “outside Top 2k” reason. These are recommendation-presentation corrections over unchanged Package67 records.

Editing a passage keeps its checked results, knowledge responses and batch selection mounted but hidden. Returning to the checked passage preserves this session work; checking a new passage resets the relevant responses and selections. A failed check leaves the previous checked passage available. None of these responses or the clicked context is added to persistent teaching-list data or feedback URLs.

Word detail includes the clicked occurrence's context, with a return button naming the originating screen. Navigation places Check a text before Find words and shows how many word forms are selected for the current lesson. This is still one active lesson; multiple saved lessons and synchronisation remain outside this update.

## Text-first lesson flow — 19 October 2026 (v10)

Check a text now starts with a readable, tappable passage. Tapping a matched word opens its actual form and family information; highlighting is optional in the same reader. Pre-teaching suggestions appear directly below the passage, with a class-level control, concise reasons and Add buttons. Knowledge checking, extra batch selection and detailed text results open on demand. The editor reopens with Edit text, preserving the checked passage when returning from word details.

A missing entry uses a short word-level message; ambiguous forms offer the registered families, and short forms show their expansion. This UI update preserves Package67 and does not add compounds or guess new family owners. Existing teaching lists, feedback Forms and the consent gate remain in place. The website remains at v9; this iteration changes App/PWA presentation only.

## Lesson planning update — 19 October 2026

Teaching list now has one optional lesson name, compact rows showing the actual selected forms, and expandable editing. Teachers may leave the plan undecided, choose “Teach in depth”, or choose “Briefly introduce”. These describe teaching intentions, not learner attainment. Existing notes, related words, order, selected forms and legacy teaching-depth values are retained. The latter are kept separately and are not converted into the new plan.

After checking a passage, teachers can search within its matched words, tick the families they want and add the observed forms in one action. Nothing is selected automatically. Unmatched, ambiguous and blocked records are excluded from batch addition. A generic source label is saved locally; the passage and Known/Not known responses are not added to the saved list. This version supports one active lesson; it does not claim multiple saved lessons or cross-device sync.

Excel is the main export, with CSV and Markdown under More formats. Exports include the lesson name, selected words, plan and notes. Existing storage keys and stable family identities are preserved, so later approved data updates can refresh evidence while retaining teacher work. Feedback submissions remain a separate, explicit action through the existing Forms links.

## Full database and Core list

Browse, ordinary lookup and AI filtering default to **Full database**. Teachers can switch to **Core list**, which retains the existing product Candidate membership. Reference is a research comparison and is not a separate teacher-facing list. The desktop table keeps all 15 columns directly available; smaller screens use the existing responsive word cards. Older membership fields are retained internally for data and saved-list compatibility. Teaching-list exports translate those fields into the two teacher labels without rewriting teachers' notes or choices.

AI interprets filters and asks for confirmation. The App produces actual matches from registered records. A full search uses the complete form-enriched projection and cannot silently shrink to the smaller local cache if loading fails. Core searches can still use saved data. The existing deployed interpreter remains compatible through the teacher-scope query adapter; the reviewed Full/Core scope is applied locally. No model receives the database records or the teacher's passage through this feature.

## Data and future refreshes

This local candidate retains Package67 from 14 September 2026: 163,784 family identities, 3,185 Core members, 163,570 ranked and 214 unranked. This teacher-facing Core label does not import the later manuscript's 3,179-family selection. BAWF repairs and compound resources require a separate approved data release. The existing supplemental-expression interface remains unconnected.

`public/hkele-data/ai_full_projection.json.gz` is a product-derived view of those same records, with all 319,924 registered forms contributing available morphology. The view is identical to the website's and checks the source result identity and family count at load time. No frequency, membership or research result is recomputed.

For an approved future release, use `scripts/build_ai_projection.py` with explicit `--data-root`, `--source-root`, `--manifest-sha256`, `--data-version`, `--cpb-index`, `--output` and `--report` arguments. Use a fresh output path. The producer verifies every detail shard against the selected frozen source and checks family/form/Core controls. Select compatible CPB mappings explicitly; regenerate them when family ownership changes. Ship the new view with its matching static manifest. Do not make the UI read an arbitrarily edited Excel workbook, or reuse the prior AI index with a new base version.

Full AI filtering requires this matching view online or in an installed data package. Historical native update archives may not include it; the App reports unavailability rather than presenting a partial search as complete. Native camera, OCR and update-package acceptance still require actual device checks; this product remains on the PWA/mobile route and is not an app-store release.

## Review and manual publication

The consent choice is stored on the current device before Home. Remote usage-event collection and shared teacher authentication are not enabled. Feedback is sent only when the teacher submits a Google Form.

Use the repository's existing build scripts with its pinned dependencies. A separate local fixture build can exercise AI confirmation without calling a model; it must not be used as the public build. The normal local build hides unconfigured AI controls. The existing Pages workflow is manual; keep its environment at **staging** to preserve the registered App/PWA Worker environment. This iteration does not commit, push, deploy or change backend environments.
