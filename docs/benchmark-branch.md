# Benchmark Branch: review-evaluation

This document describes the **benchmark/review-evaluation** branch, used to evaluate the AI code review engine. The branch contains **7 intentional issues** that a good reviewer (human or AI) should flag. Do not merge this branch into `main`.

## How to use

- Open a pull request from `benchmark/review-evaluation` into `main`.
- Run the AI code review on that PR.
- Compare which of the 7 issues below are detected.
- Re-run as needed when the review engine changes.

## Inserted issues (summary)

| # | File | Category | Severity | Expected concern |
|---|------|----------|----------|------------------|
| 1 | frontend/app/auth/callback/route.ts | Security | Critical | Unvalidated redirect using user-controlled `next` (open redirect). |
| 2 | backend/src/github/github.service.ts | Reliability | High | Missing null/undefined check for `pull.base` and `pull.head` before property access. |
| 3 | frontend/app/dashboard/upgrade-to-pro-button.tsx | Security | High | Redirect URL not validated (scheme/origin) before `window.location.href`. |
| 4 | backend/src/reviews/deterministic-aggregator.ts | Reliability | Medium | `output.findings` not checked for null/undefined before iteration. |
| 5 | backend/src/github/github.service.ts | Reliability / error handling | Medium | All GitHub API errors surfaced as 401; 5xx/403 should be distinguished. |
| 6 | frontend/app/dashboard/usage-context.tsx | Reliability | Medium | Refetch errors tracked in state but not exposed to user (silent failure). |
| 7 | backend/src/reviews/risk-engine.ts | Validation / edge case | Medium | Typo in severity check (`critcal` vs `critical`); risk floor never applied. |

## Detection difficulty (easiest to hardest)

1. Issue 1 — Open redirect (explicit redirect to user-controlled URL).
2. Issue 3 — Checkout URL without validation.
3. Issue 2 — Missing null check for `pull.base` / `pull.head`.
4. Issue 5 — Wrong HTTP status mapping for GitHub errors.
5. Issue 4 — Partial guard, `output.findings` still unchecked.
6. Issue 7 — Typo in string literal for critical severity.
7. Issue 6 — Error state set but never exposed; requires following data flow.

## Note on tests

- **risk-engine.spec.ts**: One test is skipped (`applies floor 70 when critical finding exists`) because issue #7 intentionally breaks that behavior. The skip is documented in the test.
