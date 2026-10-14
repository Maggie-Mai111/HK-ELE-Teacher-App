# HK-ELE Teacher App/PWA

HK-ELE helps teachers find vocabulary, check classroom passages and build teaching lists using word-family information and evidence from English corpora and Hong Kong textbooks.

## Teacher preview changes

- An explicit data-choice screen opens before Home. The choice can be reviewed and withdrawn.
- Home introduces the product and links to Find words, Check a text and Teaching list.
- Problem-report and word-rating entry points connect to the owner's Google Forms. HK-ELE automatically fills one reference field with the current word, page and versions.
- Clearer word and text results distinguish missing data matches from context checks.
- Search and text edits invalidate stale results; advanced information opens on demand.
- Photo OCR runs on the device and lets teachers review, edit, append or replace the recognized text.

## Data and participation

Product data remains Package67, dated 14 September 2026: 163,784 identities, Candidate 3,185 and inclusive Reference 3,430. Later research repairs have not been imported. The supplementary expression contract is reserved for a future approved release; compound records have not been added.

The data-choice screen saves a choice on this device only. Usage-event collection and teacher accounts are not connected. Formal research participation requires its own information and confirmation. Feedback is sent only when the teacher submits the connected Google Form. Opening a form does not mean a response was received. Receipt in the owner's linked Sheets still needs a marked test submission.

## Runtime configuration

The existing manual GitHub Actions workflow builds the PWA. Keep its `environment` input at `staging` to preserve the registered App/PWA Worker environment. The `production` option is a different environment and is not selected by this update.

Configure feedback URLs and prefill mappings in `src/config/feedbackForms.json`.

## Development

Use Node.js 24 and pnpm 10.15.1. Install with `pnpm install --frozen-lockfile`, then run `pnpm run typecheck`, `pnpm run lint` and `pnpm test`. Use `pnpm run build:web` for the PWA build. Follow `.github/workflows/deploy-pages.yml` for the controlled deployment.

The App is a PWA and mobile development route. APK, IPA and app-store distribution are not part of this update.

## Validation and deployment status

The source candidate passed 118 App regression tests and its local PWA export on 14 October 2026. Four actual Google prefill initialization responses were checked for Web/App report/rating links. Local App rating entry and destination opening were checked; remote Google visual interaction timed out, so real submission and linked Sheets receipt are not claimed. This source update does not itself declare a successful public deployment. Use the actual GitHub Actions and Pages deployment record to identify the deployed commit.

Licence and source attribution notices remain in the repository. Historical package and deployment records refer to their original versions.
