---
name: review-schema
description: Defines the shared JSON schema and prompts for AI code review agents (Code, Architecture, Performance, Security, Aggregator). Use when implementing or changing agent output validation, Zod schemas, or prompts that must return findings + summary.
---

# Review Schema

All domain agents (Code Quality, Architecture, Performance, Security) and the Aggregator use the same output shape. Validate every agent response with this schema; retry up to 2 times on invalid JSON.

## Zod schema (TypeScript)

```ts
const findingSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  message: z.string(),
  suggestion: z.string().optional(),
});

const agentOutputSchema = z.object({
  findings: z.array(findingSchema),
  summary: z.string(),
});

type AgentOutput = z.infer<typeof agentOutputSchema>;
```

Use `agentOutputSchema.parse(parsed)` (or `safeParse`) after parsing JSON from the model. On failure, retry with: "Your previous response was invalid. Respond only with valid JSON matching this schema: …"

## Schema snippet for prompts

Include this in the user prompt so the model knows the exact shape:

```
Respond with a single JSON object only (no markdown, no code fence). Schema:
{
  "findings": [ { "id": string, "title": string, "severity": "critical"|"high"|"medium"|"low", "category": string, "file"?: string, "line"?: number, "message": string, "suggestion"?: string } ],
  "summary": string
}
```

## Domain agents (Code, Arch, Perf, Sec)

- **System:** Role description + "You must respond with valid JSON only, no markdown, matching the given schema."
- **User:** "Schema: [snippet above]. PR diff: [unified diff or per-file]. Analyze and return one JSON object."

Each agent returns one `AgentOutput`. Store raw output in trace optionally (truncate if large).

## Aggregator agent

- **Input:** Array of four `AgentOutput` objects (Code, Arch, Perf, Sec).
- **System:** "Merge findings, remove duplicates (by similar message/file/line), assign priority (critical/high/medium/low), and produce a single summary. Respond with valid JSON only, no markdown, matching the given schema."
- **User:** Schema snippet + the four agent outputs (as JSON).
- **Output:** Single `AgentOutput` (same schema). This is stored as `result_snapshot` in `review_runs`.

## Trace step shape

For each step (Code, Arch, Perf, Sec, Agg) record:

```ts
{ agent: string, started_at: string (ISO), finished_at: string (ISO), tokens_used?: number, status: 'ok' | 'failed' }
```

Store the array in `review_runs.trace`.
