---
name: context7-code-review
description: Use Context7 to ground code reviews in up-to-date API and framework docs. Use when reviewing this project's code, reviewing pull requests, or auditing usage of Next.js, Nest.js, Supabase, Stripe, or OpenAI in the codebase.
---

# Use Context7 During Code Review

When reviewing this project's code (PRs, diffs, or full codebase), **use Context7** so feedback is based on current APIs and best practices, not outdated or hallucinated docs.

## When to use

- Reviewing pull requests or diffs for the AI Code Review Assistant.
- Auditing how the codebase uses Next.js, Nest.js, Supabase, Stripe, or OpenAI.
- Checking whether API usage, options, or patterns match official current documentation.

## How to use

1. **Before or during review:** Invoke Context7 (e.g. "use context7" or via Context7 MCP) for the relevant libraries and versions used in the code you're reviewing.
2. **Libraries to query:** Next.js (App Router), Nest.js, Supabase (Auth, client, RLS), Stripe (Node SDK, webhooks), OpenAI (Node SDK). Match the package versions in the project when possible.
3. **Ground feedback:** Cite or align review comments with the docs Context7 returns (e.g. "Per [Next.js App Router docs], …"). Prefer Context7 over generic or recalled API details.
4. **Scope:** Use Context7 for "is this API used correctly?" and "what's the current recommended pattern?"; use project skills (api-contract, review-schema, run-review-flow) for this app's own contracts and flows.

## Outcome

Review feedback reflects current documentation and reduces incorrect or outdated suggestions.
