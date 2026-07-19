# LINE odor vertical slice evidence

This document records implementation and automated-test evidence without assigning or closing Requirement IDs. The requested specification files (`PRODUCT_SCOPE.md`, `REQUIREMENT_COVERAGE_MATRIX.md`, `API_REQUIREMENTS.md`, `DATA_DICTIONARY.md`, `USER_FLOW.md`, `ACCEPTANCE_CRITERIA.md`, and `RELEASE_CHECKLIST.md`) are not present in the repository, implementation ZIP, local workspace, or PR discussion.

| Capability | Automated evidence | Current status |
|---|---|---|
| LINE ID-token session | issuer, audience, expiry, encrypted-cookie tests | TESTED LOCALLY |
| Onboarding writes | route integration plus transactional Supabase RPC verification | TESTED LOCALLY |
| Webhook signature and duplicate handling | wrong-signature and duplicate integration tests | TESTED LOCALLY |
| Baseline 1/3, 2/3, 3/3 | route integration, HTTP smoke, transactional Supabase verification | TESTED LOCALLY |
| Required API and LIFF pages | lint, typecheck, API integration, production build | TESTED LOCALLY |
| Cross-user RLS | transactional Supabase RLS assertion | TESTED LOCALLY; EMPTY-DB CI PENDING |
| Client bundle server-secret isolation | eight sentinel production-build scan | TESTED LOCALLY |
| 390x844 browser journey | Playwright spec committed; macOS sandbox blocks local Chromium process | CI PENDING |
| Empty-database migration replay | PostgreSQL 17 service and SQL assertions committed | CI PENDING |

`COVERED` is intentionally not used. Requirement IDs remain `UNKNOWN_PENDING_SPEC_PACK` until the seven source files are supplied and compared with passing CI evidence.
