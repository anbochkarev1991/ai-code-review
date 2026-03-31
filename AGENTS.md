# AGENTS.md — AI Code Review Assistant

Quick reference for AI agents working in this codebase. For commit conventions and task planning, see [.cursor/rules/](.cursor/rules/) and [TODOS.md](TODOS.md).

---

## Project Overview

AI Code Review Assistant analyzes GitHub pull requests using four parallel LLM agents (code quality, architecture, performance, security). The monorepo contains three packages: **backend** (Nest.js API), **frontend** (Next.js App Router), and **shared** (Zod schemas + TypeScript types). Key stack: Nest.js, Next.js 16, Supabase (auth + DB), Stripe (billing), OpenAI (agents).

---

## Repository Layout

```
backend/src/
  ├── auth/          # JWT guard, /me endpoint, user decorator
  ├── github/        # OAuth flow, repos/PRs/diff endpoints
  ├── billing/       # Stripe checkout, webhooks, usage tracking
  ├── reviews/       # Review pipeline
  │   ├── agents/    # Four LLM agents (code-quality, architecture, performance, security)
  │   └── engine/    # Orchestrator, aggregator, risk engine
  └── health/        # GET /health

frontend/app/
  ├── login/         # Auth UI (Google/Microsoft)
  ├── dashboard/     # Repo/PR selectors, run review, results
  ├── reviews/       # Review history, detail pages
  ├── billing/       # Stripe success/cancel pages
  ├── components/    # Shared UI components
  └── lib/           # Supabase clients, utilities

shared/src/          # Zod schemas + TS types (auth, billing, github, review, merge-decision)

docs/                # Setup guides (Supabase, Stripe, GitHub, Railway, Koyeb)
supabase/            # Database migrations
skills/              # Cursor skills (api-contract, review-schema, run-review-flow)
```

---

## Key Commands

### Shared (build first)
```bash
cd shared && npm install && npm run build
```

### Backend
```bash
cd backend
npm install              # Install deps
npm run start:dev        # Dev server (watch mode)
npm run build            # Build to dist/
npm run start:prod       # Run production build
npm test                 # Jest unit tests (*.spec.ts)
npm run lint             # ESLint
```

### Frontend
```bash
cd frontend
npm install              # Install deps
npm run dev             # Next.js dev server (port 3000)
npm run build           # Production build (auto-builds shared first)
npm run start           # Run production build
npm run lint            # ESLint
npm run typecheck       # TypeScript check
npm test                # Vitest unit tests
```

### Root (monorepo)
```bash
npm run build:shared    # Build shared package
npm run build:backend   # Build backend (installs deps)
npm run build           # Build shared + backend
npm run start:backend   # Run backend production
```

**Ports:** Frontend `3000`, Backend `3001` (local) / `8000` (production).

---

## Architecture Rules

### Backend
- **Nest.js modules:** Standard `Module` → `Controller` → `Service` pattern. Each domain (auth, github, billing, reviews) is a separate module.
- **Auth:** JWT guard (`JwtAuthGuard`) extracts Bearer token, verifies with Supabase, attaches user to request. Use `@CurrentUser()` decorator to access authenticated user.
- **Data layer:** Supabase client (`@supabase/supabase-js`) directly, no ORM. Repository pattern for DB access (e.g., `ReviewRunsRepository`).
- **Review pipeline:** `ReviewOrchestrator` calls 4 agents in parallel → `DeterministicAggregator` normalizes findings → `RiskEngine` computes score → `ResultFormatter` builds response.

### Frontend
- **Next.js App Router:** Server components by default. Use `'use client'` only for interactivity (hooks, event handlers, browser APIs).
- **Auth:** Supabase SSR (`@supabase/ssr`). Server: `createServerClient()`, client: `createBrowserClient()`. Middleware handles session refresh.
- **API calls:** Server Actions or Server Components fetch backend with JWT from Supabase session. No Next.js API routes as proxies (use backend directly).

### Shared
- **All API contract types and Zod schemas** live here. Both apps depend on `shared` package (`file:../shared`). Import from `shared` (e.g., `import type { ReviewRun } from 'shared'`).
- **Schemas:** `agentOutputSchema`, `reviewRunSchema`, `mergeDecisionSchema`, etc. Used for validation and type inference.

### Environment Variables
- **Backend:** `.env` in `backend/` (never committed). Uses `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `FRONTEND_URL` (must match the frontend origin used in Stripe `success_url` / `cancel_url`), etc.
- **Frontend:** `.env.local` in `frontend/` (never committed). Client code uses **only** `NEXT_PUBLIC_*` vars. Server code can use any env var.

---

## Common Pitfalls

- **Build order:** Always build `shared` before `backend` or `frontend`. Frontend `prebuild` script handles this automatically.
- **Never commit:** `node_modules/`, `dist/`, `.env`, `.env.local`, or any build artifacts. Check `git status` before committing.
- **Port confusion:** Backend defaults to `3001` locally but production uses `8000` (set via `PORT` env var). Frontend is always `3000`.
- **PR diff format:** Backend `/github/repos/:owner/:repo/pulls/:pr_number/diff` returns raw unified diff string. Don't re-parse — pass directly to `DiffParser`.
- **Supabase client:** Server components use `createServerClient()` (cookies), client components use `createBrowserClient()` (no cookies). Don't mix them.
- **Shared imports:** Both apps import from `shared` package. After changing `shared/src/`, rebuild it before testing backend/frontend changes.
- **Checkout redirects:** Never assign API-returned URLs to `window.location` without validating scheme (`https`) and host (Stripe checkout allowlist). See `frontend/lib/redirect-validation.ts` and [docs/frontend-security.md](docs/frontend-security.md). The backend validates Stripe return URLs against `FRONTEND_URL` (hostname + port).
- **Post-login redirects:** `/auth/callback` only allows safe relative `next` paths (see `getSafeRelativeRedirectPath` in `frontend/lib/redirect-validation.ts`).

---

## Conventions Reference

- **Commit/branch workflow:** See [.cursor/rules/commit-tasks.mdc](.cursor/rules/commit-tasks.mdc) — one branch per TODOS.md task, merge to main after verification.
- **Library docs:** Context7 MCP is always available (see [.cursor/rules/context7.mdc](.cursor/rules/context7.mdc)). Use it for code generation, setup steps, and library/API docs.
- **Task roadmap:** See [TODOS.md](TODOS.md) for day-by-day implementation plan. Each task has a "How to test locally" column.

---

## Testing Expectations

- **Backend:** Jest unit tests colocated with source (`*.spec.ts`). Run `npm test` in `backend/` before committing. Coverage includes agents, normalizers, risk engine, aggregator.
- **Frontend:** Run `npm test` in `frontend/` for Vitest unit tests (e.g. checkout redirect validation). Manual testing via `npm run dev`.
- **Task verification:** Each TODOS.md task has a "How to test locally" column. Follow it before marking task complete.
- **Pre-commit:** Run backend tests, verify task criteria, check lint/type errors, ensure no build artifacts in `git status`.
