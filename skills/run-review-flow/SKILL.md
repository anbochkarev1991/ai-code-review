---
name: run-review-flow
description: Defines the end-to-end flow for running an AI code review (POST /reviews). Use when implementing or modifying the review pipeline, quota checks, trace storage, or usage increment.
---

# Run Review Flow

This is the sequence for handling **POST /reviews** with body `{ repo_full_name, pr_number }`. Run synchronously with a timeout (e.g. 60s).

## 1. Quota check

- Resolve current user from JWT (Guard).
- Load `subscriptions.plan` and current month `usage.review_count` for that user.
- Limits: **free** 10/month, **pro** 200/month.
- If `review_count >= limit`: return **402** or **429** with a clear message (e.g. "Monthly limit reached") and do not proceed.

## 2. Fetch PR diff

- Ensure user has GitHub connected (token in `github_connections`).
- Call GitHub: get PR (base.sha, head.sha), then compare or list files to obtain unified diff (or per-file patches).
- If fetch fails (e.g. 404, 401): return 4xx with message; do not start pipeline.
- Optional: create `review_runs` row here with status `running` and persist `repo_full_name`, `pr_number`, `pr_title`.

## 3. Run pipeline

- **Create trace array** (empty initially).
- Run **Code Quality**, **Architecture**, **Performance**, **Security** agents (sequence or parallel). For each:
  - Record `started_at`, call OpenAI with schema + diff, parse JSON, validate with Zod.
  - On invalid output: retry up to 2 times with "invalid JSON" message; then record step as `status: 'failed'` and optionally skip or fail run.
  - Record `finished_at`, `tokens_used` (if available), `status: 'ok' | 'failed'`.
- Run **Aggregator** on the four outputs (only non-failed); same validation and retry; append to trace.
- Build **result_snapshot** from Aggregator output (single `AgentOutput`: findings + summary).
- On timeout: set status to `failed`, store partial trace and error_message.

## 4. Save and respond

- Persist to `review_runs`: `result_snapshot`, `trace`, `status` (`completed` or `failed`), `error_message` (if any).
- **Increment usage:** upsert `usage` for (user_id, current_month), increment `review_count` by 1. Only on **completed** runs.
- Return response: `{ id, status, result_snapshot?, trace?, error_message? }`.

## Order summary

1. Quota check → reject if over limit.  
2. Fetch diff → reject if GitHub fails.  
3. Run agents (Code, Arch, Perf, Sec) then Aggregator; build trace.  
4. Save trace + result_snapshot to DB; increment usage on success; return payload.

## Idempotency

- One POST = one review run. Do not retry the same request automatically; client may retry and get a second run (and second usage). Optional: idempotency key later.
