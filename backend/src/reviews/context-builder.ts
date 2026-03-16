import { Injectable } from '@nestjs/common';
import type {
  DiffHunk,
  ExpandedContext,
  ExpandedFile,
  ExpandedHunk,
  ParsedFile,
} from 'shared';
import { GitHubService } from '../github/github.service';

const ENCLOSING_FUNCTION_MAX_LINES = 100;
const HELPER_BODY_MAX_LINES = 50;
const MAX_HELPERS_PER_HUNK = 3;
const TOTAL_LOCAL_CONTEXT_MAX_LINES = 200;
const IDENTIFIER_SEARCH_RADIUS = 50;

const JS_TS_FUNCTION_PATTERNS = [
  /\b(function\s+\w+\s*\([^)]*\)\s*\{)/,
  /\b(function\s*\([^)]*\)\s*\{)/,
  /\b(async\s+function\s*\([^)]*\)\s*\{)/,
  /\b(async\s+function\s+\w+\s*\([^)]*\)\s*\{)/,
  /(\w+\s*=\s*async\s*\([^)]*\)\s*=>)/,
  /(\w+\s*=\s*\([^)]*\)\s*=>)/,
  /\b(class\s+\w+[\s\S]*?\{)/,
  /\b(export\s+default\s+function)/,
  /\b(export\s+async\s+function)/,
  /\b(export\s+function)/,
];

const PYTHON_DEF_PATTERN = /^\s*(def\s+\w+\s*\(|class\s+\w+\s*\(?)/;
const PYTHON_INDENT = /^(\s*)/;

const IDENTIFIER_REGEX = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
const JS_KEYWORDS = new Set([
  'function',
  'const',
  'let',
  'var',
  'return',
  'if',
  'else',
  'for',
  'while',
  'switch',
  'case',
  'break',
  'continue',
  'try',
  'catch',
  'finally',
  'throw',
  'new',
  'this',
  'super',
  'class',
  'extends',
  'import',
  'export',
  'from',
  'default',
  'async',
  'await',
  'typeof',
  'instanceof',
  'in',
  'of',
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',
]);

const FUNCTION_CALL_REGEX = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;

export interface ExpandContextParams {
  accessToken: string;
  owner: string;
  repo: string;
  headRef: string;
}

@Injectable()
export class ContextBuilder {
  constructor(private readonly githubService: GitHubService) {}

  /**
   * Converts ParsedFile[] to ExpandedFile[] with empty local context.
   * Used when gitContext is not available (e.g. runPipeline without GitHub credentials).
   */
  toExpandedFiles(files: ParsedFile[]): ExpandedFile[] {
    return files.map((file) => ({
      ...file,
      expandedHunks: file.hunks.map((hunk) => ({
        hunk,
        localContext: this.emptyContext(),
      })),
    }));
  }

  /**
   * Expands ParsedFile[] into ExpandedFile[] by fetching full file content
   * and extracting enclosing functions, referenced declarations, and called helpers.
   * Falls back to diff-only context if file fetch fails.
   */
  async expand(
    files: ParsedFile[],
    params: ExpandContextParams,
  ): Promise<ExpandedFile[]> {
    const results: ExpandedFile[] = [];

    for (const file of files) {
      const fullSource = await this.githubService.getFileContent(
        params.accessToken,
        params.owner,
        params.repo,
        file.path,
        params.headRef,
      );

      const expandedHunks: ExpandedHunk[] = file.hunks.map((hunk) => {
        const localContext = fullSource
          ? this.extractLocalContext(file, hunk, fullSource)
          : this.emptyContext();
        return { hunk, localContext };
      });

      results.push({
        ...file,
        expandedHunks,
        fullSource: fullSource ?? undefined,
      });
    }

    return results;
  }

  private emptyContext(): ExpandedContext {
    return {
      enclosingFunction: null,
      referencedDeclarations: [],
      calledHelpers: [],
    };
  }

  private extractLocalContext(
    file: ParsedFile,
    hunk: DiffHunk,
    fullSource: string,
  ): ExpandedContext {
    const lines = fullSource.split('\n');
    const isPython = ['python', 'py'].includes(file.language);

    const enclosingFunction = isPython
      ? this.extractEnclosingPython(lines, hunk)
      : this.extractEnclosingFunction(lines, hunk);

    const changedLines = [...hunk.addedLines, ...hunk.removedLines];
    const identifiers = this.extractIdentifiers(changedLines);
    const referencedDeclarations = this.findDeclarations(
      lines,
      hunk,
      identifiers,
      enclosingFunction,
    );

    const calledNames = this.extractCalledFunctions(changedLines);
    const calledHelpers = this.findHelperBodies(lines, calledNames);

    return this.applyBounds({
      enclosingFunction,
      referencedDeclarations,
      calledHelpers,
    });
  }

  private extractEnclosingFunction(
    lines: string[],
    hunk: DiffHunk,
  ): string | null {
    const startIdx = Math.max(0, hunk.startLine - 1);
    let funcStart = -1;

    for (let i = startIdx; i >= 0; i--) {
      const line = lines[i];
      for (const pattern of JS_TS_FUNCTION_PATTERNS) {
        if (pattern.test(line)) {
          funcStart = i;
          break;
        }
      }
      if (funcStart >= 0) break;

      if (line.includes('{') && !line.trim().startsWith('//')) {
        funcStart = i;
        break;
      }
    }

    if (funcStart < 0) return null;

    let braceCount = 0;
    const startLine = lines[funcStart];
    const openBraces = (startLine.match(/\{/g) ?? []).length;
    const closeBraces = (startLine.match(/\}/g) ?? []).length;
    braceCount += openBraces - closeBraces;

    let funcEnd = funcStart;
    if (braceCount > 0) {
      for (
        let i = funcStart + 1;
        i < lines.length && i < funcStart + ENCLOSING_FUNCTION_MAX_LINES;
        i++
      ) {
        const l = lines[i];
        braceCount +=
          (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
        funcEnd = i;
        if (braceCount <= 0) break;
      }
    }

    const slice = lines.slice(funcStart, funcEnd + 1);
    return slice.length > 0 ? slice.join('\n') : null;
  }

  private extractEnclosingPython(
    lines: string[],
    hunk: DiffHunk,
  ): string | null {
    const startIdx = Math.max(0, hunk.startLine - 1);
    let funcStart = -1;

    for (let i = startIdx; i >= 0; i--) {
      const line = lines[i];
      if (PYTHON_DEF_PATTERN.test(line)) {
        funcStart = i;
        break;
      }
    }

    if (funcStart < 0) return null;

    const baseIndent = (lines[funcStart].match(PYTHON_INDENT)?.[1] ?? '')
      .length;
    let funcEnd = funcStart;

    for (
      let i = funcStart + 1;
      i < lines.length && i < funcStart + ENCLOSING_FUNCTION_MAX_LINES;
      i++
    ) {
      const line = lines[i];
      if (line.trim() === '') {
        funcEnd = i;
        continue;
      }
      const indent = (line.match(PYTHON_INDENT)?.[1] ?? '').length;
      if (indent <= baseIndent && line.trim() !== '') break;
      funcEnd = i;
    }

    const slice = lines.slice(funcStart, funcEnd + 1);
    return slice.length > 0 ? slice.join('\n') : null;
  }

  private extractIdentifiers(lines: string[]): Set<string> {
    const ids = new Set<string>();
    const text = lines.join(' ');
    let m: RegExpExecArray | null;
    const re = new RegExp(IDENTIFIER_REGEX.source, 'g');
    while ((m = re.exec(text)) !== null) {
      const id = m[1];
      if (!JS_KEYWORDS.has(id) && id.length > 1) {
        ids.add(id);
      }
    }
    return ids;
  }

  private findDeclarations(
    lines: string[],
    hunk: DiffHunk,
    identifiers: Set<string>,
    enclosingFunction: string | null,
  ): string[] {
    const searchLines = enclosingFunction
      ? enclosingFunction.split('\n')
      : lines.slice(
          Math.max(0, hunk.startLine - 1 - IDENTIFIER_SEARCH_RADIUS),
          Math.min(lines.length, hunk.endLine + IDENTIFIER_SEARCH_RADIUS),
        );
    const declarations: string[] = [];
    const declPattern = /^\s*(const|let|var)\s+(\w+)/;
    const found = new Set<string>();

    for (const line of searchLines) {
      const match = line.match(declPattern);
      if (match && identifiers.has(match[2]) && !found.has(match[2])) {
        found.add(match[2]);
        declarations.push(line.trim());
      }
    }
    return declarations;
  }

  private extractCalledFunctions(lines: string[]): Set<string> {
    const names = new Set<string>();
    const text = lines.join(' ');
    let m: RegExpExecArray | null;
    const re = new RegExp(FUNCTION_CALL_REGEX.source, 'g');
    while ((m = re.exec(text)) !== null) {
      const name = m[1];
      if (!JS_KEYWORDS.has(name)) {
        names.add(name);
      }
    }
    return names;
  }

  private findHelperBodies(
    lines: string[],
    calledNames: Set<string>,
  ): string[] {
    const helpers: string[] = [];
    const funcDefRegex =
      /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>))/g;

    for (
      let i = 0;
      i < lines.length && helpers.length < MAX_HELPERS_PER_HUNK;
      i++
    ) {
      const line = lines[i];
      funcDefRegex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = funcDefRegex.exec(line)) !== null) {
        const name = m[1] ?? m[2];
        if (name && calledNames.has(name)) {
          const body = this.extractFunctionBody(lines, i);
          if (body && body.split('\n').length <= HELPER_BODY_MAX_LINES) {
            helpers.push(body);
          }
        }
      }
    }

    return helpers;
  }

  private extractFunctionBody(
    lines: string[],
    startIdx: number,
  ): string | null {
    const startLine = lines[startIdx];
    let braceCount =
      (startLine.match(/\{/g) ?? []).length -
      (startLine.match(/\}/g) ?? []).length;
    if (braceCount <= 0) return null;

    const result: string[] = [lines[startIdx]];
    for (
      let i = startIdx + 1;
      i < lines.length && i < startIdx + HELPER_BODY_MAX_LINES;
      i++
    ) {
      const l = lines[i];
      braceCount +=
        (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
      result.push(l);
      if (braceCount <= 0) break;
    }
    return result.join('\n');
  }

  private applyBounds(ctx: ExpandedContext): ExpandedContext {
    const totalLines =
      (ctx.enclosingFunction?.split('\n').length ?? 0) +
      ctx.referencedDeclarations.reduce((s, d) => s + d.split('\n').length, 0) +
      ctx.calledHelpers.reduce((s, h) => s + h.split('\n').length, 0);

    if (totalLines <= TOTAL_LOCAL_CONTEXT_MAX_LINES) return ctx;

    let remaining = TOTAL_LOCAL_CONTEXT_MAX_LINES;
    let enclosingFunction: string | null = null;
    if (ctx.enclosingFunction) {
      const efLines = ctx.enclosingFunction.split('\n');
      const take = Math.min(efLines.length, Math.floor(remaining * 0.6));
      enclosingFunction = efLines.slice(0, take).join('\n');
      remaining -= take;
    }

    const referencedDeclarations = ctx.referencedDeclarations.slice(
      0,
      Math.min(ctx.referencedDeclarations.length, Math.floor(remaining / 2)),
    );
    remaining -= referencedDeclarations.reduce(
      (s, d) => s + d.split('\n').length,
      0,
    );

    const calledHelpers = ctx.calledHelpers.slice(0, MAX_HELPERS_PER_HUNK);
    const truncatedHelpers = calledHelpers.map((h) => {
      const hLines = h.split('\n');
      const take = Math.min(
        hLines.length,
        Math.floor(remaining / calledHelpers.length),
      );
      return hLines.slice(0, take).join('\n');
    });

    return {
      enclosingFunction,
      referencedDeclarations,
      calledHelpers: truncatedHelpers,
    };
  }
}
