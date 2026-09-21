# HK-ELE Teacher

HK-ELE Teacher is an Expo React Native and Web application for browsing the HK-ELE lexical
database, checking classroom texts and maintaining a device-local teaching list.

This repository is the public-repository form of the verified Package77 Phase 5B1 implementation.
The current app version is `0.3.0`, Android `versionCode` is `3`, and iOS `buildNumber` is `3`.
Its preparation status is `PUBLIC_REPOSITORY_CANDIDATE_PUSH_PENDING`: no GitHub push, Pages
deployment, EAS cloud build or app-store submission is represented by this repository.

## What the app includes

- Browse Candidate 3,185, inclusive Reference 3,430 or the complete 163,784-family database.
- Exact form search, word details and safe registered morphology display.
- Check a Text with CPB 100 and HK-frequency highlighting, custom HK-rank ranges, word-knowledge
  checks, coverage review, estimated text complexity and editable pre-teach suggestions.
- A persistent Teaching List with CSV, Markdown and Excel export.
- Three explicit data modes: built-in Candidate + Reference, online full database and a verified
  installed full database on supported native builds.
- Safe fallback: if the full database cannot be checked, words outside the built-in set remain
  pending for a later full check and are not reported as genuinely unmatched.
- On-device OCR adapters for native Android/iOS builds. The Web/PWA version does not claim native
  OCR support.
- Hash-verified data installation, atomic activation and rollback on native builds.
- An installable `/HK-ELE-Teacher-App/` PWA whose service worker caches the app shell, not the complete
  database, data shards or bulk update archive.

## Local verification

Use Node.js 22.13 or later and pnpm 10.15.1.

```powershell
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build:web
pnpm run validate:pwa
```

To inspect the exported site beneath the same subpath used by GitHub Pages:

```powershell
pnpm run serve:subpath
```

Then open `http://127.0.0.1:19078/HK-ELE-Teacher-App/`.

## Deployment boundary

The workflow in `.github/workflows/deploy-pages.yml` installs from the frozen lockfile, repeats the
checks above, builds `dist` and deploys only the generated Pages artifact. Generated build folders,
native prebuild folders, dependencies and local test output are excluded from version control.

The configured future repository is `Maggie-Mai111/HK-ELE-Teacher-App`, with the future Pages
location `https://maggie-mai111.github.io/HK-ELE-Teacher-App/`. It must not be
treated as live until an authorised deployment and production-URL acceptance check have completed.

The existing `Maggie-Mai111/HK-ELE` repository and `https://maggie-mai111.github.io/HK-ELE/`
website are separate predecessor products and must remain unchanged.

GitHub Pages is public static hosting. If this repository is published, technically capable visitors
can read the data shards and update archive needed by the Web app even though the teacher interface
does not provide a database-download button. The project owner must confirm CPB, HK-ELE data and
brand distribution rights, plus MPL and OCR notices, before publication.

## Documentation

- `TEACHER_GUIDE_ZH.md` — teacher workflows and interpretation safeguards.
- `DEVELOPMENT_AND_RUN_GUIDE.md` — clean setup, tests, Web export and configuration.
- `NATIVE_BUILD_AND_INSTALL_GUIDE_ZH.md` — Android/iOS build and account boundaries.
- `GITHUB_PAGES_DEPLOYMENT_GUIDE_ZH.md` — Pages deployment procedure.
- `EAS_FREE_ANDROID_BUILD_GUIDE_ZH.md` — EAS Android APK procedure.
- `DATA_CONTRACT.md` — data modes, identity and update contracts.
- `DATA_PROVENANCE.md` — public-safe data versions, authority identifiers and hashes.
- `PRIVACY_ZH.md` — classroom data, OCR, local storage and public-hosting disclosures.
- `THIRD_PARTY_NOTICES.md` — third-party data and software notice gates.

## Historical evidence note

Package76 and Phase 5A were predecessor hardening work. Their original reports describe app version
0.2.0 and platform build numbers 2 and are inherited historical evidence only; they are intentionally
not included in this clean public repository and do not describe the current version.
