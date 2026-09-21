# HK-ELE mobile data contract 1.2.0

The App data layer separates structure compatibility from ordinary data updates.

- `schemaVersion` changes only for incompatible structure changes.
- `dataVersion` changes for ranking, frequency, set, evidence or other compatible data refreshes.
- `minimumAppVersion` prevents older apps from silently reading a package they cannot support.
- The manifest records the exact source package identities, frozen population controls, every payload file's byte size, SHA-256 and compression format, and fail-closed compatibility rules.

Stable identities are `baseword_key` for families and `form_key` for recorded forms. Positional joins are not part of the contract.

## Phase 1 bundled data

The bundled offline release contains all 3,430 Candidate + inclusive Reference families and their 64,641 registered form rows. Tables use a compact `fields` plus `rows` representation and retain every column from the Package67 `family` and `form` tables. Search routes include every database owner for any surface that touches the inclusive Reference set, so equal-best ambiguity and lower-priority alternatives are not silently lost.

The full-database interface is defined in `src/data/DataSource.ts`. Phase 1 provides a deterministic test adapter only. Network, local sharding, download, cache, hash verification and rollback implementations are deliberately deferred.

## Identity rules

The TypeScript tokenizer preserves `P69-TEXT-CHECK-PAIRED-QUOTES-1.3.0`, original surfaces, UTF-16 offsets, token order, separator audit events and fail-closed character handling. Identity resolution follows the registered order:

1. Empty input is unmatched.
2. Exact uppercase `US` remains context-blocked.
3. A 60-item registered grammatical-relation registry is checked before family routes. Its entries
   preserve registered components/alternatives, have no family owner or rank, and are not counted as
   ranked M families.
4. `does` remains context-blocked when it is not one of those exact registered relation surfaces.
5. `I` and lowercase `us` use the registered pronoun identities.
6. Database routes use minimum `match_priority`, retain equal-best owners and preserve lower-priority alternatives.

No stemming, fuzzy matching, string guessing or LLM family assignment is permitted.

## CPB 100

The CPB file preserves the original `Word` display value, source rank, source row, filename, source SHA-256 and extraction date. Its match key applies NFKC, trim, casefold and U+2018/U+2019 apostrophe normalization. CPB matching is independent of HK-ELE family assignment. Public redistribution remains blocked until permission is confirmed.

## Phase 2–4 static and native data access

The Web build reads the Package74-compatible static shard API with the packaged Candidate +
inclusive Reference data as its fallback. Native builds first use an installed, verified `active`
static-data directory; when none exists they use `EXPO_PUBLIC_HKELE_DATA_URL` if configured, then
fall back to the packaged Candidate + inclusive Reference release. All routes continue to return
stable `baseword_key` and `form_key` identities.

`public/hkele-data/update-manifest.json` is the update transport contract. It includes update-schema
and data-API versions, minimum App version, population controls, the source manifest hash and an
exact inventory of paths, byte sizes and SHA-256 values. The current inventory has 1,192 static
data files and 62,969,832 bytes.

Native installation uses these ordered gates:

1. Accept only HTTPS manifests (loopback HTTP is allowed for local tests).
2. Reject incompatible update-schema/data-API versions, unsafe paths, invalid population
   relationships, oversize manifests and a higher `minimumAppVersion`.
3. If the manifest has an archive, download that single archive, validate its byte length and
   SHA-256, require a safe single-disk stored ZIP with exactly the registered paths, and unpack into
   `staging`. Revalidate every internal byte length and SHA-256. Older per-file manifests retain the
   same per-file verified staging path.
4. Only after all internal checks pass, move the current `active` directory to `previous`, then move
   verified `staging` to `active`.
5. If download, archive parsing, internal verification or activation fails, restore/retain the old
   release; an interrupted startup also restores `previous` when `active`
   is absent. Manual rollback swaps `active` and `previous`.

When the first installed update has no earlier downloaded directory, rollback removes it from
`active` and returns to the immutable bundled Candidate + inclusive Reference release. This
deliberate bundled state is recorded separately so startup recovery does not mistake it for an
interrupted activation.

The repository is selected at App startup. A successful install or rollback therefore asks the
user to restart before loading the changed version. Teacher-authored list state remains in
AsyncStorage and is keyed by stable family identity, outside the data-release directories.

## Phase 5B1 availability states and unmatched boundary

Every teacher-facing query now reports one of three data modes:

- `bundled-reference`: the built-in Candidate + inclusive Reference set (3,430 families). It works
  offline but cannot establish that a form outside that set is absent from the full database.
- `remote-full`: all 163,784 family records are queried through the online static-shard service.
  This is full-database access, not a complete local installation.
- `installed-full`: a complete update has passed archive and internal-file verification and is the
  active local release. Full-database queries remain available offline.

Only `remote-full` or `installed-full` may return `UNMATCHED`, because only those modes complete a
full-database query. A supported form absent from `bundled-reference` returns
`FULL_DATABASE_CHECK_UNAVAILABLE`; it stays outside “Unmatched words to review”, knowledge tests,
coverage calculations and automatic pre-teach suggestions. A later online or installed-full check
may resolve or genuinely reject it. If a remote query fails, valid bundled matches remain usable.

The GitHub Pages Web repository is rooted at `/HK-ELE-Teacher-App/hkele-data`. Native preview, Android APK and
production profiles contain the expected HTTPS endpoint, but it remains
`EXPECTED_NOT_YET_LIVE` until separately deployed and verified.

## OCR boundary

`OcrAdapter` accepts a local image URI and returns plain editable text plus provider metadata. The
selected native implementation uses Android ML Kit and Apple Vision through
`expo-text-extractor`. OCR never calls identity resolution itself and never edits a family mapping;
the teacher must choose whether to use or append the recognized text before the unchanged
tokenizer/identity pipeline runs. The Web adapter fails closed and retains manual paste/editing.

Images, original text, teaching-list notes and knowledge-test answers are not part of the update
or analytics contract and are not uploaded by this App.

## Web/native packaging boundary

Web exports include `public/hkele-data`, including the full static database and one verified update
archive. Native exports set `EXPO_PUBLIC_FOLDER=public-native`, so the full Web directory cannot be
copied into Android/iOS exports; Metro includes only the referenced Candidate + Reference offline
assets and small contract data. The native-boundary validator checks exact offline hashes, rejects
any `hkele-data` path and enforces file-count/byte caps.
