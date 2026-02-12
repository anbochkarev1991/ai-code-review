---
name: api-contract
description: Defines shared API contract and types for the AI Code Review Assistant. Use when adding or changing backend endpoints, frontend API calls, or shared types for repos, PRs, diff, reviews, and billing.
---

# API Contract

Keep backend (Nest.js) and frontend (Next.js) aligned by using these shapes. All authenticated requests use `Authorization: Bearer <supabase_jwt>`.

## Auth & user

- **GET /me** (or **GET /users/me**)  
  Response: `{ profile: Profile, plan: 'free' | 'pro', github_connected: boolean }`  
  `Profile`: `{ id, email, display_name?, avatar_url? }`

## GitHub

- **GET /github/repos**  
  Response: `{ repos: Array<{ full_name: string, private: boolean, default_branch: string }> }`  
  Pagination: first page only for MVP (e.g. `per_page=30`).

- **GET /github/repos/:owner/:repo/pulls**  
  Query: `?state=open` (optional).  
  Response: `{ pulls: Array<{ number: number, title: string, state: string, head: { ref: string }, created_at: string }> }`

- **GET /github/repos/:owner/:repo/pulls/:pr_number/diff**  
  Response: `{ diff: string, files?: Array<{ filename: string, patch: string }> }`  
  Unified diff and/or per-file patches.

## Reviews

- **POST /reviews**  
  Body: `{ repo_full_name: string, pr_number: number }`.  
  Response: `{ id: string, status: string, result_snapshot?: ReviewResult, trace?: TraceStep[], error_message?: string }`  
  Or 402/429 when quota exceeded.

- **GET /reviews/:id**  
  Response: `{ id, status, result_snapshot?, trace?, error_message?, created_at, updated_at }`

- **GET /reviews**  
  Query: `?limit=20&offset=0`.  
  Response: `{ items: ReviewRun[], total: number }`

Types: `ReviewRun` has `id, user_id, repo_full_name, pr_number, pr_title, status, result_snapshot, trace, error_message, created_at, updated_at`.  
`ReviewResult` and `TraceStep[]` are defined in the review-schema skill.

## Billing

- **GET /billing/usage**  
  Response: `{ review_count: number, limit: number, plan: 'free' | 'pro' }`  
  Current month only. Free limit 10, Pro limit 200.

- **POST /billing/checkout**  
  Body: `{ success_url: string, cancel_url: string }`.  
  Response: `{ url: string }` (Stripe Checkout URL).

- **POST /billing/webhook**  
  Stripe webhook; raw body required for signature verification. No JSON body contract for callers.

## Conventions

- Use the same TypeScript interfaces or shared types in both apps (e.g. shared package or `types/`).  
- Use kebab-case for HTTP paths; camelCase for JSON.  
- Return 401 when JWT is missing or invalid; 402 or 429 when quota exceeded.
