import { Injectable } from '@nestjs/common';
import type { ExpandedContext, ExpandedFile } from 'shared';
import { DiffParser } from './diff-parser';

export type AgentContextType =
  | 'security'
  | 'code-quality'
  | 'architecture'
  | 'performance';

const SECURITY_RELEVANT_PATTERNS = [
  'redirect',
  'auth',
  'sanitize',
  'validate',
  'escape',
  'token',
  'password',
  'cookie',
  'session',
  'cors',
  'origin',
];

function isSecurityRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return SECURITY_RELEVANT_PATTERNS.some((p) => lower.includes(p));
}

function filterSecurityContext(ctx: ExpandedContext): ExpandedContext {
  return {
    enclosingFunction: ctx.enclosingFunction,
    referencedDeclarations:
      ctx.referencedDeclarations.filter(isSecurityRelevant),
    calledHelpers: ctx.calledHelpers.filter(isSecurityRelevant),
  };
}

function formatContext(ctx: ExpandedContext, language: string): string {
  const parts: string[] = [];

  if (ctx.enclosingFunction) {
    parts.push(
      `### Enclosing Function\n\`\`\`${language}\n${ctx.enclosingFunction}\n\`\`\``,
    );
  }

  if (ctx.referencedDeclarations.length > 0) {
    parts.push(
      `### Referenced Declarations\n\`\`\`${language}\n${ctx.referencedDeclarations.join('\n')}\n\`\`\``,
    );
  }

  if (ctx.calledHelpers.length > 0) {
    parts.push(
      `### Helper Functions (same file)\n\`\`\`${language}\n${ctx.calledHelpers.join('\n\n')}\n\`\`\``,
    );
  }

  return parts.join('\n\n');
}

@Injectable()
export class AgentContextShaper {
  /**
   * Formats ExpandedFile[] into a prompt string tailored for the given agent.
   * Token budget: 4500 by default (extra 1000 for local context over previous 3500).
   */
  formatForAgent(
    files: ExpandedFile[],
    agentType: AgentContextType,
    tokenBudget = 4500,
  ): string {
    const preamble = DiffParser.DIFF_SCOPE_PREAMBLE;
    const sections: string[] = [preamble];
    const charBudget = tokenBudget * 4;
    let totalChars = preamble.length;

    for (const file of files) {
      const header = `## File: ${file.path} (${file.status}) [${file.language}]`;
      const diffContent = file.expandedHunks
        .map((eh) => eh.hunk.content)
        .join('\n\n');
      const diffSection = `### Changed Code (diff)\n\`\`\`diff\n${diffContent}\n\`\`\``;

      let ctx: ExpandedContext;
      switch (agentType) {
        case 'security': {
          const raw = file.expandedHunks.reduce<ExpandedContext>(
            (acc, eh) => ({
              enclosingFunction:
                acc.enclosingFunction ?? eh.localContext.enclosingFunction,
              referencedDeclarations: [
                ...acc.referencedDeclarations,
                ...eh.localContext.referencedDeclarations,
              ],
              calledHelpers: [
                ...acc.calledHelpers,
                ...eh.localContext.calledHelpers,
              ],
            }),
            {
              enclosingFunction: null,
              referencedDeclarations: [],
              calledHelpers: [],
            },
          );
          ctx = filterSecurityContext(raw);
          break;
        }
        case 'code-quality':
          ctx = file.expandedHunks.reduce<ExpandedContext>(
            (acc, eh) => ({
              enclosingFunction:
                acc.enclosingFunction ?? eh.localContext.enclosingFunction,
              referencedDeclarations: [
                ...acc.referencedDeclarations,
                ...eh.localContext.referencedDeclarations,
              ],
              calledHelpers: [
                ...acc.calledHelpers,
                ...eh.localContext.calledHelpers,
              ],
            }),
            {
              enclosingFunction: null,
              referencedDeclarations: [],
              calledHelpers: [],
            },
          );
          break;
        case 'architecture':
          ctx = file.expandedHunks.reduce<ExpandedContext>(
            (acc, eh) => ({
              enclosingFunction:
                acc.enclosingFunction ?? eh.localContext.enclosingFunction,
              referencedDeclarations: acc.referencedDeclarations,
              calledHelpers: acc.calledHelpers,
            }),
            {
              enclosingFunction: null,
              referencedDeclarations: [],
              calledHelpers: [],
            },
          );
          break;
        case 'performance':
          ctx = file.expandedHunks.reduce<ExpandedContext>(
            (acc, eh) => ({
              enclosingFunction:
                acc.enclosingFunction ?? eh.localContext.enclosingFunction,
              referencedDeclarations: acc.referencedDeclarations,
              calledHelpers: [
                ...acc.calledHelpers,
                ...eh.localContext.calledHelpers,
              ],
            }),
            {
              enclosingFunction: null,
              referencedDeclarations: [],
              calledHelpers: [],
            },
          );
          break;
        default:
          ctx = {
            enclosingFunction: null,
            referencedDeclarations: [],
            calledHelpers: [],
          };
      }

      const contextSection = formatContext(ctx, file.language);
      const section = contextSection
        ? `${header}\n\n${diffSection}\n\n${contextSection}`
        : `${header}\n\n${diffSection}`;

      if (totalChars + section.length > charBudget) {
        sections.push(
          `\n... (${files.length - sections.length + 1} more files omitted due to token budget)`,
        );
        break;
      }

      sections.push(section);
      totalChars += section.length;
    }

    return sections.join('\n\n');
  }
}
