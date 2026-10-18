# HK-ELE Teacher App and PWA

HK-ELE helps teachers look up vocabulary, check classroom texts, review word-family and form evidence, and build editable teaching lists. The PWA includes on-device English OCR with an editable preview, contextual Known/Not known responses, vocabulary-review suggestions, highlighting, text-complexity information and teaching-list exports. Problem reports and word ratings open the configured Google Forms with a prefilled product and word reference.

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
