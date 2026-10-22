# HK-ELE data contract: A main release

The existing compatible static API is retained. The current release is `2026-10-20-a-main-v1`: 163,906 family identities, 163,371 ranked, 535 unranked, 2,871 Core members and 319,961 accepted family/form pairs (58,188 in Core).

`candidate_member` is the existing internal Core field. `reference_member` and the `broader` route remain compatibility aliases for Core in this release; no separate Reference selection is shown to teachers. Reserved transport counts `inclusiveReference=2871` and `referenceOnly=0` express that compatibility shape, not a new research Reference analysis.

Stable family IDs remain `baseword_key`. Word-form lookups use the frozen main accepted relation. Every old family ID is retained; changed accepted form relations do not silently move saved selections. Safe refresh preserves notes, meanings entered by teachers, lesson plans, order and concrete spellings; it retains a prior evidence snapshot. Unverified selections remain editable and exportable with their original identity and an actionable review status. Raw legacy keys are retained.

Only explicitly registered evidence is shown. Empty/unknown annotations are not false membership, zero frequency, lowest rank or an inferred grade. Textbook first observation and US grade references are distinct; raw VXGL decimals are never printed. The existing root/grade display conversion is retained.

`data/current-manifest.json` selects the compact fallback: 2,871 Core families plus four owners needed to preserve ambiguity, 58,228 form rows. The complete database requires the online static view or an explicitly downloaded full package. Unavailable full access never establishes absence from Full. Both compact and complete views use A.

`public/hkele-data/update-manifest.json` inventories every payload, including the full AI projection. The archive contains exactly those files. The offline PWA inventory also includes the App shell, assets and on-device OCR. New releases are hash/size checked in staging, activated only when complete, pinned within a session and recoverable to the previous release. Old Package67 offline generations remain explicitly approved for recovery; they are never labelled as A. Runtime metadata and feedback context follow the selected generation.

Teacher text is not filtered by the research dictionary. The registered conservative product matcher preserves ambiguous/contextual forms for review. It is not the research corpus context adjudicator and does not apply the paper's calibrated coverage percentages to arbitrary classroom passages. No compound layer or new family assignment is added.

This update does not enable telemetry or authentication, change Worker environments, or publish a native application.

## Word-form search frequency

The optional `a-main-word-frequency-20261022-v1` resource uses the frozen A ICE-HK and GloWbE-HK normalized spelling counts, with the same bytes as the registered Web projection. These counts describe spellings, not disambiguated senses. The existing family, core membership, form ownership and education records are unchanged. The full update inventory includes all 128 frequency shards; PWA installation verifies them before switching its active generation. A session pinned to an older installed package does not fetch missing frequency shards from another generation. Forms remain viewable with a frequency-update prompt. No absent frequency is filled as zero.
