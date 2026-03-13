# Benchmark Branch: review-evaluation

This document describes the **benchmark/review-evaluation** branch, used to evaluate the AI code review engine. The branch contains **8 issues** that a good reviewer (human or AI) should flag. Do not merge this branch into `main`.

## How to use

- Open a pull request from `benchmark/review-evaluation` into `main`.
- Run the AI code review on that PR.
- Compare which of the 8 issues below are detected.
- Re-run as needed when the review engine changes.

## Inserted issues (summary)

| # | File | Agent | Severity | Expected concern |
|---|------|--------|----------|------------------|
| 1 | frontend/app/auth/callback/route.ts | Security | Critical | User-controlled `next` passed to `new URL(next, origin)` and used as redirect target; protocol-relative or absolute URLs allow open redirect to external origin. |
| 2 | backend/src/github/github.service.ts | Code Quality | High | Missing null/undefined check for `pull.base` and `pull.head` before property access. |
| 3 | frontend/app/dashboard/upgrade-to-pro-button.tsx | Security | High | Checkout redirect URL from backend used in `window.location.href` without validating scheme (https) or allowlisting expected domain (e.g. Stripe). |
| 4 | backend/src/reviews/deterministic-aggregator.ts | Code Quality | Medium | `output.findings` not checked for null/undefined before iteration in `mergeFindings`. |
| 5 | backend/src/github/github.service.ts | Architecture | Medium | GitHub API errors (5xx, 403, etc.) surfaced as 401; status mapping conflates transport vs auth. |
| 6 | frontend/app/dashboard/usage-context.tsx | Code Quality | Medium | Refetch errors tracked in state but not exposed in context (silent failure). |
| 7 | backend/src/reviews/risk-engine.ts | Code Quality | Medium | Typo in constant used for critical severity check (`critcal` vs `critical`); risk floor never applied. |
| 8 | backend/src/reviews/deterministic-aggregator.ts | Performance | Medium | Per-finding `calculateRiskBreakdown` called in loop; result unused (repeated expensive work). |

## Detection difficulty (easiest to hardest)

1. Issue 1 — Open redirect via `new URL(next, origin)` with user-controlled `next` (protocol-relative or absolute URL).
2. Issue 3 — Backend-supplied checkout URL used without scheme/origin validation.
3. Issue 2 — Missing null check for `pull.base` / `pull.head`.
4. Issue 5 — Wrong HTTP status mapping for GitHub errors.
5. Issue 8 — Redundant loop calling `calculateRiskBreakdown` per finding with no use of result.
6. Issue 4 — `output.findings` unchecked before iteration.
7. Issue 7 — Typo in constant value for critical severity check.
8. Issue 6 — Error state set but never exposed; requires following data flow.

## Note on tests

- **risk-engine.spec.ts**: One test is skipped (`applies floor 70 when critical finding exists`) because the current implementation does not apply the floor for that case. The skip is documented in the test.
