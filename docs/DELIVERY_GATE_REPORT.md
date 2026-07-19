# Delivery Gate Report — LINE_ODOR_MVP_V1

Generated: 2026-07-19 (Asia/Taipei)

Release decision: **BLOCKED — do not release**.

This is the historical pre-publication report from the implementation package. The referenced `REQUIREMENT_COVERAGE_MATRIX.md` and `RELEASE_CHECKLIST.md` are not present in the repository or implementation ZIP, so this file must not be used to close Requirement IDs. Current vertical-slice evidence is recorded in `VERTICAL_SLICE_EVIDENCE.md` without inventing missing IDs.

## Phase evidence

| Phase | Result | Evidence | Remaining blocker |
|---|---|---|---|
| 0 | PARTIAL | GitHub `justtravelMH/line-odor-preflight` admin/push permission; Vercel project `line-odor-preflight`; Supabase project ACTIVE_HEALTHY | LINE console and phone proof |
| 1 | PASS locally | Next.js production build | Git commit/CI URL |
| 2 | PARTIAL | Two production migrations applied; RLS enabled; indexes/advisor remediation applied | automated cross-user integration fixture |
| 3 | PARTIAL | raw-body HMAC signature and versioned postback unit tests | deployed webhook Verify + live record write |
| 4 | PARTIAL | onboarding, records, result, privacy routes compile | LIFF ID-token session and Playwright/mobile proof |
| 5 | PASS locally | 7 result codes and supplied table fixtures covered by pure Vitest module | CI URL |
| 6 | BLOCKED | analytics allowlist unit tested | live Sentry event, PostHog payload audit |
| 7 | BLOCKED | setup guide available | Rich Menu, iOS, Android screenshots/receipt |
| 8 | BLOCKED | receipt generated with explicit blockers | every Release Checklist blocking item |

## Requirement matrix readout

- The source requirement matrix is unavailable in this checkout.
- No Requirement ID is closed or marked `COVERED` by this report.
- Any prior references to R-009, R-012, or R-024 are historical only and require the missing source matrix before they can be evaluated.

## Specification conflict recorded

`DECISION_RULES.md` priority item 10 says `0.5 <= delta < 1.0` for `POSSIBLE_IMPROVEMENT`, while test fixture P1 expects `POSSIBLE_IMPROVEMENT` for baseline `[2,2,2]` and post `[1,2,1]` (delta `1.0`, only three post records). The implementation follows the explicit fixture: clear improvement still requires five records; a positive delta meeting the possible threshold but not the clear gate remains possible improvement.

## Release Checklist blocking summary

- Playwright, empty-DB replay, cross-user RLS, Flex snapshot and client-secret bundle scan do not yet have complete evidence.
- Sentry/PostHog live events are not verified.
- GitHub Actions, commit, tag, Preview and Production deployment are unavailable until source publication succeeds.
- All LINE manual setup and real iOS/Android closure items require human evidence.
