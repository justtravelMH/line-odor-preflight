# Delivery execution log

| Phase | Owner | Input | Deliverable | Test evidence | Blocking condition |
|---|---|---|---|---|---|
| 0 | Work+User | connected accounts | cloud preflight | GitHub admin/push; Vercel project found; Supabase ACTIVE_HEALTHY | LINE/LIFF console and phone evidence pending |
| 1 | Code | specification pack | Next.js repository scaffold | `npm run build` | dependencies/build failure |
| 2 | Code | DATA_DICTIONARY | migration and RLS | empty-DB + cross-user test required | not applied to production DB |
| 3 | Code | API/Conversation | raw-body webhook route | signature unit test; live closure pending | LINE Verify and live database write |
| 4 | Code | UI/User Flow | onboarding, records, result, privacy pages | build; mobile E2E pending | LIFF ID and phone login |
| 5 | Code | DECISION_RULES | pure decision engine | table-driven Vitest | none after tests green |
| 6 | Code | Privacy/Release | integration dependencies and env contract | live test events pending | Sentry/PostHog keys/events |
| 7 | User+Work | manual setup guide | LINE setup and phone receipt | screenshots/receipt required | iOS and Android evidence |
| 8 | Work | release checklist | release receipt | all blocking evidence | any MISSING/BLOCKED/MANUAL without receipt |
