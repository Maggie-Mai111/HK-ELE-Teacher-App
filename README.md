# HK-ELE Teacher App/PWA

Current data: A main release `2026-10-20-a-main-v1` (163,906 Full family identities; 2,871 Core members). The approved teacher interface, OCR and lesson workflow are preserved. See DATA_CONTRACT.md and DATA_PROVENANCE.md.

App/PWA v23 adds the separate closed-compound release `2026-10-22-a-main-closed-v1`: 57,881 recorded whole words, available through the existing search box and passage reader. Compound cards show recorded word parts and available component-family links. Whole compounds can be added to the current lesson, annotated, rated and exported with expression IDs. Their ranks, grades and Core membership are not inferred from components. The full offline download includes all compound files in the same verified, atomic installation. Reopen HK-ELE after an update. Spaced or hyphenated expressions and generated inflections are outside this release. Existing AI family filtering and staging connection are retained.

Display correction (2026-10-21): external grades follow the exact displayed, searched or selected word form, with no family union or minimum substituted. MSVL zero membership and absent records both display a dash; their source values remain distinct. Research data and layouts are unchanged.

Home entry alignment requested on 2026-10-21: remove the two duplicate introduction buttons and keep the three existing task cards, with Check a text highlighted in green. Existing navigation and other page layouts are retained.

The browser App can be opened by link or installed as a PWA. Explicit full offline download includes the database, AI filter projection and OCR assets; interrupted updates retain the prior usable generation. No native store release is implied.

Build and validation use the existing package scripts. Deployment remains a manually triggered GitHub Pages workflow, with the App's registered **staging** environment. Existing Worker configuration and secrets are not included or changed by this data update. Web and App share evidence semantics, not UI code.

Keep existing browser site data and saved lessons during updates. Read OFFLINE_AND_DATA_UPDATES_ZH.md before replacing an offline release. Source and licence notices remain in THIRD_PARTY_NOTICES.md and existing source materials.

Consistency closeout: selected-word records use the exact form for AWL/MSVL, textbook observations and word parts. Family frequency records and the approved layouts remain unchanged.
