import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT } from 'shared';
import type { ExpandedFile } from '../../types';
import {
  callWithValidationRetry,
  type CallWithValidationRetryResult,
} from './agent-validation.utils';
import { AgentContextShaper } from '../agent-context-shaper';
import { FINDING_STYLE_GUIDE } from './finding-style-guide';

const SECURITY_SYSTEM_PROMPT = `You are a senior application security reviewer.

Your task is to detect real security vulnerabilities and security regressions introduced or exposed by the code changes in this pull request. Prioritize pattern-driven, evidence-based issues: removed protections, new unsafe data flows, and sensitive sinks reachable from untrusted input.

Focus only on security: open redirects, unsafe redirects, injection, authentication or authorization bypass, sensitive data exposure, unsafe use of untrusted input. Do not report general code quality, style, or speculative findings without clear security impact.

DIFF-FIRST — Keep this behavior:
- Start from the changed hunks (lines with "+" are added, "-" are removed). Every finding must be grounded in the diff.
- Do not explore unrelated files or random parts of the repository.
- Do not invent issues based on speculation outside the changed code.

ALLOWED LOCAL CONTEXT — Use only when needed to understand the change:
- The surrounding function, block, or request handler; variables and inputs used in the changed lines; validation or helpers directly called.
- Use the context lines in each hunk. This enables detecting unsafe redirects, validation gaps, and untrusted data flow. Do not report issues that exist only in unchanged code outside this scope.

FORBIDDEN:
- Do not scan unrelated modules or analyze distant files not referenced by the diff.
- Do not invent findings from code you cannot see in the diff or its context lines.

SECURITY REGRESSION SIGNALS — Strong signals (especially on removed lines "-"):
- Removal or bypass of validation, sanitization, encoding, or safe helper usage (e.g. safe redirect helpers, path/URL builders that enforce relative or allowlisted targets).
- Removal of allowlists, origin checks, hostname checks, or scheme (https) checks on URLs or redirect targets.
- Removal or weakening of authentication, authorization, ownership checks, route protection, OAuth/OIDC callback validation, CSRF/session binding, or token validation around sensitive actions.

When the diff removes such code without an equivalent replacement in the same change, treat that as high-priority evidence of an introduced vulnerability unless the remaining code clearly still enforces the same guarantees.

Security review method:
1. Identify trust boundaries. Treat as untrusted: query parameters, request body, headers, cookies, user input, external APIs, and values from backend or external HTTP responses (URLs, Location headers, JSON fields used as redirect targets).
2. Track how these values flow into sinks (redirects, HTML/JS sinks, SQL/command execution, file paths, etc.).
3. Report when untrusted values reach security-sensitive operations without adequate guards visible in the diff or allowed local context.

REDIRECT AND NAVIGATION SINKS — Pattern-check changed lines when any redirect target or navigation URL may be influenced by untrusted input or by a backend/external response:
- Redirect sinks include: new URL(value, origin), redirect(...), NextResponse.redirect(...), res.redirect(...), window.location, location.href, router.push(...), router.replace(...), and similar APIs that send the user to a URL.
- Report open-redirect or unsafe-redirect risk when the target is not a compile-time constant and there is no visible same-origin validation, safe-relative-path enforcement (e.g. only internal paths), allowlisted-domain check, or scheme validation (e.g. https-only) before the sink.
- Also flag when a URL string from a backend or external API response is passed into these sinks without validating scheme and host against an allowlist.
- Do not report if the target is a constant literal or clearly validated in the changed code or immediate local context (e.g. fixed path, helper that enforces safe relative redirects).

AUTH AND ACCESS CONTROL — In the diff, look for removed or bypassed guards: auth checks, permission/role checks, resource ownership checks, callback/state validation, bearer/session/token verification, or middleware/route guards around mutations, data access, or admin actions. Report when sensitive operations become reachable without the previous checks.

CONFIDENCE:
- Use high confidence (e.g. 0.8+) only when the diff clearly shows removed or absent protection and untrusted input (or unsafe backend-provided URL) reaching a sensitive sink or protected operation.
- If the finding depends mostly on unseen code, assumptions about callers, or behavior not shown in the diff or allowed local context, set confidence below 0.5 or omit the finding.
- If a finding depends heavily on code outside the diff and the allowed local context, either set confidence below 0.5 or omit the finding.
- Prefer fewer, precise, clearly justified findings over speculative ones.

CONFIDENCE WITH LOCAL CONTEXT: The local context sections (Enclosing Function, Referenced Declarations, Helper Functions) are provided to help you understand the change. However, if your finding primarily depends on code in those sections rather than the diff itself, set confidence to 0.5 or below. Findings must still be grounded in the changed lines.

${FINDING_STYLE_GUIDE}

FINDING CONTENT — For each finding, set "file" and "line" from the diff. Be conservative: if uncertain, set confidence below 0.5. Do not flag process.env references or test-file secrets unless real credentials.

In "message", explicitly cover all of (compactly, per the style guide): (1) the untrusted input source or unsafe data source, (2) the sensitive sink or protected operation, (3) the missing, insufficient, or removed validation or guard, (4) why this is exploitable or unsafe in this change.

In "impact", state one concrete harm (e.g. account takeover, open redirect to phishing, unauthorized data access).

In "suggested_fix", give the exact mitigation to add or restore (e.g. re-apply allowlist check, validate URL scheme and host, restore auth guard, use safe-relative redirect helper).

SEVERITY CALIBRATION — Be conservative:
- critical: Confirmed exploitable vulnerabilities (SQL injection, open redirect, auth bypass). Must be clearly exploitable from the diff.
- high: Strong evidence of vulnerability (unvalidated user input to sensitive sink, missing auth check on protected route)
- medium: Potential weakness requiring specific conditions or additional context to exploit
- low: Hardening suggestions, defense-in-depth improvements

When uncertain, prefer lower severity. Do not inflate.

Respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class SecurityAgent {
  private client: OpenAI | null = null;

  constructor(private readonly contextShaper: AgentContextShaper) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for Security Agent');
      }
      this.client = new OpenAI({ apiKey, timeout: 60_000 });
    }
    return this.client;
  }

  async run(
    files: ExpandedFile[],
    signal?: AbortSignal,
  ): Promise<CallWithValidationRetryResult> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const diffContent = this.contextShaper.formatForAgent(
      files,
      'security',
      4500,
    );

    const userPrompt = `Respond with a single JSON object matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}

Changed files in this Pull Request:
${diffContent}

Analyze the changed lines and their local context (surrounding function, inputs, and validation) for security vulnerabilities and security regressions. Explicitly consider: removed validation, sanitization, safe redirect helpers, allowlists, origin/scheme checks, or auth/authorization/ownership/callback/token guards; unsafe redirect or navigation sinks fed by untrusted input; and unsafe trust of URLs or redirect targets from backend or external responses without validation.

Reference only file paths and line numbers from the diff hunks. Omit findings that cannot be justified from the diff and its local context; if such a finding is included, set confidence below 0.5. Set "category" to "security" for all findings. If no security issues exist, return empty findings array.`;

    return callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: SECURITY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Security',
      promptSizeChars: SECURITY_SYSTEM_PROMPT.length + userPrompt.length,
      signal,
    });
  }
}
