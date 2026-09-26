# HK-ELE Teacher Web/PWA — Package82

Package82 is the controlled-deployment successor to Package81. It preserves the principal HK-ELE data and teacher workflows, changes GitHub Pages publishing to manual-only, fixes the real Pages origin/Turnstile contract, applies 3-per-minute anonymous-session and 10-per-minute global Worker limits, and adds a 17-case AI usability evaluation.

Current stop: `STAGING_NOT_EXECUTED_WRANGLER_CLI_NOT_AUTHENTICATED`.

The owner authorized Web/PWA staging and production deployment on 2026-09-26, but this machine's Wrangler CLI was not authenticated and GitHub CLI was unavailable. No Package82 push, Worker deployment, platform secret operation, Pages workflow run, or real DeepSeek request was performed. Use `MANUAL_DEPLOYMENT_RUNBOOK_ZH.md` for the safe handoff.

## Frozen authority

- 163,784 identities; 163,570 ranked; 214 unranked.
- Candidate 3,185; inclusive Reference 3,430; reference-only 245.
- Package67 is the data authority, Package72 the Web regression baseline, Package77 the direct product/test evidence, and Package81 the only code baseline.
- Stage 4 proper-name-adjusted ranking remains sensitivity-only.
- Native AI remains deferred; no APK or IPA is built.

## Controlled deployment

`GitHub Pages static Web/PWA → Cloudflare Worker → DeepSeek`

- Repository: `Maggie-Mai111/HK-ELE-Teacher-App`
- Pages path: `/HK-ELE-Teacher-App`
- Staging Worker: `hkele-ai-filter-staging`
- Production Worker: `hkele-ai-filter`
- Turnstile hostname/action: `maggie-mai111.github.io` / `ai_filter`
- Rate limits: session 3/minute; global 10/minute
- Pages deployment: `workflow_dispatch` only

Secrets must be entered only in Cloudflare's dashboard or the interactive `wrangler secret put` prompt. Never add a `.dev.vars` file with real values or paste a secret into chat, source, logs, GitHub variables, or documentation.

## Verified locally

```text
pnpm install --frozen-lockfile
pnpm run format
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build:web
pnpm run validate:pwa
pnpm run validate:public
pnpm run runtime:acceptance
```

Local results: 75/75 tests passed; Web/PWA build and public-repository checks passed; mock-only Wrangler acceptance passed; wide and 390×844 browser regression passed with zero app console warnings/errors. Real DeepSeek calls: 0. Actual provider cost: 0.

Read `DEPLOYMENT_ENTRY.json`, `ACCOUNT_AND_LICENSE_PREFLIGHT_ZH.md`, `STAGING_DEPLOYMENT_REPORT_ZH.md`, `SECURITY_AND_SECRET_VERIFICATION_ZH.md`, `PUBLIC_URLS_AND_ROLLBACK_ZH.md`, and `MANUAL_DEPLOYMENT_RUNBOOK_ZH.md` before any external action.
