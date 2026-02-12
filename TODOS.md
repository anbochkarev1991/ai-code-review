# AI Code Review Assistant — Atomic TODOs by Day

All items are scoped so the project stays **testable locally** at the end of each day (frontend + backend + Supabase dev project; Stripe CLI for webhooks when billing is in play).

**Workflow integrations:** Development is tracked in [Linear](https://linear.app/) and spec-driven work is planned and handed off via [Traycer](https://traycer.ai/). Documentation is provided to the agent via **Context7**; reusable agent capabilities come from **skills.sh** and project-specific **Cursor skills**.

---

## Day 0 — Workflow, docs & skills setup

| # | Task | How to test locally |
|---|------|----------------------|
| 0.1 | **Linear:** Create workspace (or use existing); create project "AI Code Review Assistant"; add labels/cycles if desired | Project visible in Linear; ready to create issues |
| 0.2 | **Linear:** Create a small set of issues (or epic + issues) mirroring Day 1–2 scope so work is trackable from day one | Issues exist; can move to In Progress / Done |
| 0.3 | **Traycer:** Account setup; create first Artifact (e.g. "Foundation – Nest + Next + Supabase") describing Day 1 scope and acceptance criteria | Artifact exists; can share / hand off to Cursor |
| 0.4 | **Context7:** Install and enable Context7 MCP in Cursor (e.g. via [Context7 docs](https://context7.com/docs)); add API key from context7.com for better rate limits | "Use context7" or MCP tools available; docs resolve for chosen stack |
| 0.5 | **Context7:** Pin or configure docs relevant to stack (Next.js App Router, Nest.js, Supabase, Stripe) so agents get up-to-date API reference | Key libraries return current docs when queried |
| 0.6 | **skills.sh:** Install relevant skills via `npx skillsadd <owner/repo>` (e.g. Nest.js, Next.js, Supabase, Stripe, or community skills from [skills.sh](https://skills.sh/)) | Skills available in Cursor; agent can use them when relevant |
| 0.7 | **Project skills:** Add a small set of Cursor skills under `.cursor/skills/`: e.g. API contract + shared types, review output schema (findings + summary), and "run review" flow (optional: use create-skill flow) | Agent follows project conventions when editing backend/frontend/schema |

**Day 0 exit criteria:** Linear project ready; Traycer artifact for Foundation; Context7 and skills.sh skills available; project skills in `.cursor/skills/` for API/schema and review flow.

---

## Day 1 — Foundation

| # | Task | How to test locally |
|---|------|----------------------|
| 1.1 | Create frontend: Next.js 14+ (App Router), TypeScript, `npm run dev` runs | `cd frontend && npm run dev` → app on localhost |
| 1.2 | Create backend: Nest.js CLI (`nest new`), TypeScript, `npm run start:dev` runs | `cd backend && npm run start:dev` → server on PORT |
| 1.2a | Backend: setup Nest.js modules structure (AppModule, AuthModule, GitHubModule, BillingModule, ReviewsModule) | Modules compile; app starts without errors |
| 1.3 | Add shared types: define TS types/interfaces for API contract (repos, PRs, reviews, billing) in shared package or `/types` | Types compile; backend and frontend can import |
| 1.4 | Create Supabase project (or use existing); note project URL and anon key | Project exists; can open Supabase dashboard |
| 1.5 | Enable Auth providers: Google + Microsoft (dev credentials); set redirect URLs | Sign-in with Google/Microsoft works in Supabase Auth UI |
| 1.6 | DB migration: create `profiles` table (id, email, display_name, avatar_url, created_at, updated_at) + RLS (user sees own row) | Table exists; RLS blocks cross-user read |
| 1.7 | DB migration: create `github_connections` (id, user_id, github_user_id, access_token, refresh_token, expires_at, created_at, updated_at) + RLS | Table exists; index on user_id |
| 1.8 | DB migration: create `subscriptions` (id, user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, created_at, updated_at) + RLS | Table exists; index on user_id |
| 1.9 | DB migration: create `review_runs` (id, user_id, repo_full_name, pr_number, pr_title, status, result_snapshot, trace, error_message, created_at, updated_at) + RLS | Table exists; index on user_id, created_at |
| 1.10 | DB migration: create `usage` (id, user_id, month, review_count, created_at, updated_at), unique (user_id, month) + RLS | Table exists; index on (user_id, month) |
| 1.11 | Backend: add GET `/health` Controller (returns 200) | `curl http://localhost:PORT/health` → 200 |
| 1.12 | Backend: JWT verification Guard (extract Bearer token, verify with Supabase `getUser(jwt)` or JWKS, attach user to request via `@Request()` decorator) | Protected route returns 401 without token; 200 with valid Supabase JWT |
| 1.13 | Backend: GET `/me` (or `/users/me`) Controller: return profile + plan + github_connected using auth user_id from Guard | With valid JWT, `curl` returns JSON with profile, plan, github_connected |

**Day 1 exit criteria:** Both apps run locally; can sign up with Google; all tables exist; `/health` and `/me` (with JWT) work.

| **Workflow** | |
|---|------|
| 1.W1 | **Traycer:** Use "Foundation" artifact for hand-off; optionally create sub-artifacts for Nest modules and Supabase schema | Implementation matches Foundation spec |
| 1.W2 | **Linear:** Move or create Day 1 issues (frontend/backend init, DB, health, JWT, /me); update status | Day 1 progress visible in Linear |

---

## Day 2 — Auth + GitHub

| # | Task | How to test locally |
|---|------|----------------------|
| 2.1 | Next.js: install `@supabase/ssr`, configure Supabase client for server and client | No runtime errors on load |
| 2.2 | Next.js: auth callback route (e.g. `/auth/callback`) and session refresh | After Google login, session cookie set; refresh works |
| 2.3 | Next.js: login UI — buttons "Sign in with Google" / "Sign in with Microsoft" | Click → redirect to provider → back to app, logged in |
| 2.4 | Next.js: middleware or layout guard — redirect unauthenticated users to login | Visiting dashboard without session redirects to login |
| 2.5 | Next.js: fetch and pass JWT to backend (e.g. Server Action or API route that calls backend with `Authorization: Bearer <token>`) | Dashboard calls `/me` with JWT and shows profile |
| 2.6 | Backend: GET `/github/oauth` Controller — redirect to GitHub OAuth with client_id, redirect_uri, scope `read:user repo` | Browser redirects to GitHub consent |
| 2.7 | Backend: GET `/github/oauth/callback` Controller — exchange code for access_token; create/update `github_connections` for user via Service | After GitHub consent, row in `github_connections`; token stored |
| 2.8 | Backend: GET `/github/repos` Controller — list repos for authenticated user (use token from `github_connections` via Service); support pagination (e.g. first page) | With GitHub connected, endpoint returns list of repos |
| 2.9 | Backend: GET `/github/repos/:owner/:repo/pulls` Controller — list PRs; optional query `?state=open` | Returns PRs for selected repo |
| 2.10 | Backend: GET `/github/repos/:owner/:repo/pulls/:pr_number/diff` Controller — fetch PR (base/head), then compare or files; return `{ diff, files }` | Returns unified diff (or files) for given PR |
| 2.11 | Frontend: "Connect GitHub" button → redirect to backend `/github/oauth` | User can connect account; callback returns to app |
| 2.12 | Frontend: repo selector — call GET `/github/repos`, show dropdown or list | User sees their repos |
| 2.13 | Frontend: PR selector — call GET `/github/repos/:owner/:repo/pulls` after repo selected | User sees PRs for selected repo |

**Day 2 exit criteria:** Login with Google/Microsoft; connect GitHub; select repo and PR from real data; get PR diff from backend.

| **Workflow** | |
|---|------|
| 2.W1 | **Traycer:** Create Artifact "Auth + GitHub" (scope: Supabase SSR, GitHub OAuth, repos/PRs/diff API); use for hand-off to Cursor before starting Day 2 | Artifact linked to Day 2 scope; hand-off works |
| 2.W2 | **Linear:** Create or update issues for Day 2 (auth UI, GitHub OAuth, endpoints, selectors); track progress in Linear | Issues reflect current state |

---

## Day 3 — Billing

| # | Task | How to test locally |
|---|------|----------------------|
| 3.1 | Stripe: create Product "AI Code Review Pro" and monthly Price; note Price ID | Price ID in env (e.g. STRIPE_PRO_PRICE_ID) |
| 3.2 | Backend: POST `/billing/checkout` Controller — body `{ success_url, cancel_url }`; create Stripe Customer if needed via Service; create Checkout Session (subscription, Pro price); return `{ url }` | Frontend gets URL and redirects to Stripe Checkout (test mode) |
| 3.3 | Backend: POST `/billing/webhook` Controller — verify `Stripe-Signature` with STRIPE_WEBHOOK_SECRET (use Nest.js raw body or Stripe webhook guard) | Stripe CLI `forward` to local URL; webhook returns 200 |
| 3.4 | Webhook Service: handle `checkout.session.completed` — create/update `subscriptions` (stripe_customer_id, stripe_subscription_id, plan=pro, status) | Trigger with Stripe CLI; subscription row created/updated |
| 3.5 | Webhook Service: handle `customer.subscription.updated` and `customer.subscription.deleted` — update `subscriptions` (plan=free or status=canceled) | Idempotent; DB matches Stripe state |
| 3.6 | Backend: GET `/billing/usage` Controller — return `{ review_count, limit, plan }` for current month (from `usage` + `subscriptions` via Service) | Correct counts and limit (10 free, 200 pro) |
| 3.7 | Backend: in POST `/reviews` Controller (stub or real), before starting: read plan and current month usage via Service; if `review_count >= limit` return 402 or 429 | Manually set usage to 10 for free user; 11th request returns 402/429 |
| 3.8 | Backend: after successful review completion (Day 4): upsert `usage` for (user_id, current_month), increment `review_count` via Service | After one review, usage row shows review_count 1 |
| 3.9 | Frontend: display usage and plan (e.g. "5 / 10 reviews this month — Free") using GET `/billing/usage` | Dashboard shows usage and limit |
| 3.10 | Frontend: "Upgrade to Pro" button → POST `/billing/checkout` with success/cancel URLs → redirect to session.url | User completes test checkout; returns to success_url |
| 3.11 | Frontend: success and cancel redirect pages (e.g. `/billing/success`, `/billing/cancel`) | After checkout, user lands on success page; plan updates after webhook |

**Day 3 exit criteria:** Checkout flow works with Stripe CLI; webhook updates subscriptions; quota enforced (free 10, pro 200); usage increments after review.

| **Workflow** | |
|---|------|
| 3.W1 | **Traycer:** Create Artifact "Billing" (Stripe product, checkout, webhook, quota, usage UI); hand off to Cursor for implementation | Artifact defines billing scope; verification after code gen if using Traycer review |
| 3.W2 | **Linear:** Issues for Day 3 (Stripe, webhook, quota, frontend billing); update status as done | Billing work visible in Linear |

---

## Day 4 — Agents

| # | Task | How to test locally |
|---|------|----------------------|
| 4.1 | Define shared Zod schema for agent output: `{ findings: [{ id, title, severity, category, file, line, message, suggestion }], summary: string }` | Schema validates sample JSON |
| 4.2 | Serialize schema to short text form for prompts (e.g. "findings: array of { id, title, severity, … }") | Used in agent prompts |
| 4.3 | Code Quality Agent: system prompt (role + "respond with valid JSON only") + user prompt (schema + PR diff); call OpenAI | Manual test: returns JSON matching schema |
| 4.4 | Architecture Agent: same pattern, different role description | Same |
| 4.5 | Performance Agent: same pattern | Same |
| 4.6 | Security Agent: same pattern | Same |
| 4.7 | Aggregator Agent: input = array of 4 agent outputs; prompt to merge, dedupe, prioritize; output same schema | Given 4 mock outputs, returns single findings + summary |
| 4.8 | Validation: after each agent, parse JSON and validate with Zod; on failure retry up to 2 times with "invalid JSON" message | Invalid response triggers retry; then mark step failed in trace |
| 4.9 | Trace: for each step record `{ agent, started_at, finished_at, tokens_used?, status }`; optional per-agent raw output (truncate if large) | Trace array has 5 entries (Code, Arch, Perf, Sec, Agg) |
| 4.10 | Review pipeline Service: run Code, Arch, Perf, Sec (sequence or parallel), then Aggregator; build trace; save `result_snapshot` (aggregator output) and `trace` to `review_runs` via Repository | POST runs pipeline; DB row has result_snapshot + trace |
| 4.11 | POST `/reviews` Controller — body `{ repo_full_name, pr_number }`; quota check → fetch diff → run pipeline Service (timeout e.g. 60s) → save → return `{ id, status, result_snapshot, trace }` | Full run returns result and trace; row in `review_runs` |
| 4.12 | GET `/reviews/:id` Controller — return one review run (result_snapshot, trace, error_message, status, created_at) via Service | Fetch by id returns full run |
| 4.13 | GET `/reviews` Controller — query `?limit=20&offset=0`; return `{ items, total }` for current user via Service | List shows user's past reviews |

**Day 4 exit criteria:** POST `/reviews` with real repo+PR returns structured result and trace; invalid agent output triggers retry then failure; usage increments.

| **Workflow** | |
|---|------|
| 4.W1 | **Traycer:** Create Artifact "Agents + pipeline" (Zod schema, 5 agents, validation/retry, trace, POST/GET reviews); hand off for implementation; use project skill for schema if present | Single artifact covers agent orchestration; schema matches project skill |
| 4.W2 | **Linear:** Issues for Day 4 (schema, each agent, pipeline, endpoints); track in Linear | Agent work trackable in Linear |

---

## Day 5 — Frontend review flow + trace

| # | Task | How to test locally |
|---|------|----------------------|
| 5.1 | Frontend: "Run review" button — send POST `/reviews` with selected repo_full_name and pr_number | Button triggers request; loading state shown |
| 5.2 | Frontend: handle long-running review (loading + timeout ~60s) and errors (display error_message) | User sees loading then result or error |
| 5.3 | Frontend: review result view — display findings list (title, severity, file, line, message, suggestion) from result_snapshot | All fields visible in list/cards |
| 5.4 | Frontend: display summary from result_snapshot | Summary text shown |
| 5.5 | Frontend: expandable trace section — steps with agent name, started_at, finished_at, tokens_used (if present), status | Expand/collapse trace; all steps visible |
| 5.6 | Frontend: list past reviews — GET `/reviews`, link each to review detail (GET `/reviews/:id`) | User can open past runs and see result + trace |
| 5.7 | Responsive layout: breakpoints and mobile-friendly layout for dashboard, repo/PR selectors, result and trace | Key screens usable on narrow viewport |

**Day 5 exit criteria:** Full flow in browser: select repo → PR → Run review → see findings + summary + expandable trace; list past reviews; layout works on mobile.

| **Workflow** | |
|---|------|
| 5.W1 | **Traycer:** Create Artifact "Review UI + trace" (run review, results view, trace, list past reviews, responsive); hand off and verify UI against spec | UI matches artifact; Traycer verification passes if enabled |
| 5.W2 | **Linear:** Issues for Day 5 (run button, result/trace UI, list, responsive); close or update as done | Day 5 scope reflected in Linear |

---

## Day 6 — Deploy

| # | Task | How to test locally / in prod |
|---|------|------------------------------|
| 6.1 | Vercel: connect repo, set root (e.g. `frontend/`), build `next build`; set env (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_BACKEND_URL) | Frontend URL loads; login works |
| 6.2 | Railway (or Fly/Render): create project, deploy backend; set env (DATABASE_URL, SUPABASE_*, GITHUB_*, STRIPE_*, OPENAI_*, PORT) | Backend URL returns 200 on /health |
| 6.3 | Stripe: register webhook URL `https://<backend>/billing/webhook`; set STRIPE_WEBHOOK_SECRET in backend | Production webhook receives events |
| 6.4 | Supabase: production URL and keys in frontend and backend; CORS on backend allows Vercel frontend origin | No CORS errors; auth and API work |
| 6.5 | Smoke test: production sign up → connect GitHub → run one review → see result/trace → upgrade (test mode) → verify quota | Full E2E on production URLs |

**Day 6 exit criteria:** Frontend on Vercel, backend on Railway/Fly/Render; webhook and auth work in prod; one full demo run succeeds.

---

## Day 7 — Buffer + demo

| # | Task | How to test locally |
|---|------|----------------------|
| 7.1 | Fix bugs found in E2E (prod and local) | Re-run full flow without errors |
| 7.2 | Polish UI: copy, loading states, error messages (quota, timeout, invalid PR) | Clear feedback for all error cases |
| 7.3 | Write short demo script: sign up → connect GitHub → run review → result/trace → upgrade → quota | Script or checklist in README or docs |
| 7.4 | README: list all env vars (frontend + backend + Supabase + Stripe); "Run locally" (install, Supabase dev project, Stripe CLI `stripe listen --forward-to localhost:PORT/billing/webhook`, `npm run dev` for frontend, `npm run start:dev` for Nest.js backend) | New dev can run frontend + backend + webhook locally from README |
| 7.5 | README: deploy steps (Vercel, Railway/Fly/Render, webhook registration); "Workflow" section (Linear, Traycer, Context7, skills.sh + project skills) per 7.W1 | Deploy and workflow reproducible from README |

**Day 7 exit criteria:** Demo runs without errors; README allows local run and deploy; project is testable locally and in production.

| **Workflow** | |
|---|------|
| 7.W1 | **README:** Add short "Workflow" section: Linear project link, Traycer usage (artifacts per phase), Context7 for docs, skills.sh + project skills | New dev can adopt same workflow from README |
| 7.W2 | **Linear:** Close or archive completed issues; optional: add "Demo" / "Buffer" issues for Day 7 | Backlog clean; demo script in Linear if desired |

---

## Skills (context7 + skills.sh + project)

- **Context7 (documentation):** Primary source of up-to-date API docs for the agent. Use for Next.js App Router, Nest.js, Supabase (Auth + DB), Stripe, and OpenAI. Configure once in Day 0; reference in prompts or via MCP when implementing.
- **skills.sh:** Add skills that match the stack and workflow, e.g.:
  - Nest.js (controllers, guards, services, modules)
  - Next.js App Router (server/client components, auth)
  - Supabase (auth, RLS, migrations)
  - Stripe (checkout, webhooks, idempotency)
  - Optional: GitHub API, OpenAI usage
- **Project skills (`.cursor/skills/`):** Create at least:
  - **API contract:** Shared types and endpoint shapes (repos, PRs, diff, reviews, billing) so backend and frontend stay aligned.
  - **Review schema:** Zod shape and prompt snippet for agent output (findings + summary) and aggregator; used by all agents and validation.
  - **Run review flow:** Steps: quota check → fetch diff → run pipeline → save trace + result; helps agent implement POST `/reviews` and trace correctly.

Use **Context7** for "how" (current APIs); **skills.sh** for stack best practices; **project skills** for "what" (this app’s contract and schema).

---

## Local testability summary

- **Day 1:** Two apps run; DB and auth work with Supabase (hosted dev project is fine).
- **Day 2:** GitHub OAuth uses a dev app with localhost callback; all GitHub endpoints hit real API with dev token.
- **Day 3:** Stripe CLI forwards webhooks to `localhost`; checkout in test mode; quota and usage verified via API/DB.
- **Day 4:** POST `/reviews` run against a real repo/PR; trace and result in DB and API response.
- **Day 5:** Full UI flow locally (select repo/PR → run review → result + trace).
- **Day 6–7:** Production deploy plus README so the project remains runnable and testable locally.

**Total:** ~56 implementation tasks (Days 1–7) + 7 Day 0 setup tasks + 2 workflow tasks per day (Days 1–7); each with a concrete local (or prod) test criterion.
