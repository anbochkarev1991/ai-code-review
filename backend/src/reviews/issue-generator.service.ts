import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { Finding } from 'shared';

const ISSUE_GENERATION_SYSTEM_PROMPT = `You are a senior engineering lead generating issue tickets from code review findings.

Generate a concise, practical Jira/Linear-style issue draft. Follow this exact structure:

## [SEVERITY] <Short actionable title>

### Description
- What was detected
- Where it was detected (file path + line if available)
- Why it matters (concrete impact)

### Acceptance Criteria
- [ ] Specific, testable criteria
- [ ] Implementation-focused
- [ ] Based on the finding context

### Suggested Technical Direction
- Practical implementation guidance based on the suggested fix
- Avoid vague recommendations

### Testing Notes
- How to validate the fix
- What to check manually or automatically

### Priority
<Mapped from severity: critical→P0/Urgent, high→P1/High, medium→P2/Medium, low→P3/Low>

### Affected File(s)
<File path(s) if available>

Rules:
- Be specific and practical. No corporate filler.
- Do NOT invent project-specific details not present in the finding.
- Keep it concise — engineers should be able to act on this immediately.
- Use markdown formatting.
- The title line must start with the severity in brackets, e.g. [HIGH].`;

interface PRMeta {
  repo_full_name: string;
  pr_number: number;
  pr_title: string;
}

@Injectable()
export class IssueGeneratorService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'OPENAI_API_KEY is required for issue generation',
        );
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async generate(finding: Finding, prMeta?: PRMeta): Promise<string> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const userPrompt = this.buildUserPrompt(finding, prMeta);

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: ISSUE_GENERATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('OpenAI returned empty response for issue generation');
      }

      return content;
    } catch (err) {
      if (err instanceof OpenAI.APIError) {
        if (err.status === 429) {
          throw new HttpException(
            'OpenAI API quota exceeded. Please try again later.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (err.status === 401) {
          throw new HttpException(
            'OpenAI API authentication failed.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        if (err.status === 500 || err.status === 503) {
          throw new HttpException(
            'OpenAI API is temporarily unavailable. Please try again.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        throw new HttpException(
          `OpenAI API error: ${err.message || 'Unknown error'}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw err;
    }
  }

  private buildUserPrompt(finding: Finding, prMeta?: PRMeta): string {
    const parts: string[] = [
      'Generate an issue ticket from the following code review finding:',
      '',
      `Title: ${finding.title}`,
      `Severity: ${finding.severity}`,
      `Category: ${finding.category}`,
    ];

    if (finding.file) {
      parts.push(`File: ${finding.file}${finding.line != null ? `:${finding.line}` : ''}`);
    }

    if (finding.affected_locations?.length) {
      const locs = finding.affected_locations
        .map((l) => `${l.file}${l.line != null ? `:${l.line}` : ''}`)
        .join(', ');
      parts.push(`Affected locations: ${locs}`);
    }

    parts.push('', `Description: ${finding.message}`);

    if (finding.impact) {
      parts.push(`Impact: ${finding.impact}`);
    }

    if (finding.suggested_fix || finding.suggestion) {
      parts.push(
        `Suggested fix: ${finding.suggested_fix || finding.suggestion}`,
      );
    }

    if (finding.confidence != null) {
      parts.push(`Confidence: ${(finding.confidence * 100).toFixed(0)}%`);
    }

    if (finding.false_positive_risk) {
      parts.push(`False positive risk: ${finding.false_positive_risk}`);
    }

    if (finding.diff_context?.snippet) {
      parts.push('', 'Code context:', '```', finding.diff_context.snippet, '```');
    }

    if (prMeta) {
      parts.push(
        '',
        'PR context:',
        `Repository: ${prMeta.repo_full_name}`,
        `PR #${prMeta.pr_number}: ${prMeta.pr_title}`,
      );
    }

    return parts.join('\n');
  }
}
