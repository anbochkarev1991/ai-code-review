import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { Finding } from 'shared';

const ISSUE_GENERATION_SYSTEM_PROMPT = `You are a senior engineering lead generating issue tickets from code review findings.

Generate a concise, practical Jira/Linear-style issue draft in proper Markdown format. Follow this exact structure with clear section headers:

## Title

[SEVERITY] Short actionable summary

## Location

\`file_path:line_number\`

## Context

Short explanation of where the issue was detected and why the system flagged it.

## Description

Explain the problem clearly and technically.

## Impact

Explain what could go wrong if this issue remains unresolved.

## Suggested Fix

Short practical description of the intended fix direction.

## Acceptance Criteria

- [ ] Checklist items describing the expected implementation outcome
- [ ] Each item should be actionable and testable

## Testing Notes

- Short bullet list explaining how the fix should be validated
- Include specific test scenarios when relevant

## Source

AI Code Review Finding  
Confidence: X%  
False Positive Risk: Low/Medium/High

**Formatting Rules:**
- Use proper Markdown syntax: \`##\` for section headers, \`- [ ]\` for checkboxes, \`\`\`code\`\`\` for code blocks
- Include blank lines between sections for readability
- Keep the issue concise — avoid generic AI filler language
- Do NOT hallucinate project details not present in the finding
- Avoid overly verbose text — keep sections short and useful for developers
- Be specific and practical — engineers should be able to act on this immediately
- The title line must start with the severity in brackets, e.g. [HIGH] or [CRITICAL]
- Include confidence percentage and false positive risk in the Source section
- Use code fences (\`\`\`) for any code snippets or file paths when appropriate`;

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
        throw new Error('OPENAI_API_KEY is required for issue generation');
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
      parts.push(
        `File: ${finding.file}${finding.line != null ? `:${finding.line}` : ''}`,
      );
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
      parts.push(
        '',
        'Code context:',
        '```',
        finding.diff_context.snippet,
        '```',
      );
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
