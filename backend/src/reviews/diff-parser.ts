import { Injectable } from '@nestjs/common';
import type {
  DiffFile,
  DiffHunk,
  ParsedDiff,
  ParsedFile,
  DiffStats,
} from '../types';

const IGNORE_PATTERNS: RegExp[] = [
  /^\.env($|\.)/,
  /node_modules\//,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /^out\//,
  /^coverage\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.lock$/,
  /\.DS_Store$/,
  // Binary image/font/media files
  /\.ico$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.webp$/,
  /\.bmp$/,
  /\.svg$/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.eot$/,
  /\.otf$/,
  /\.mp3$/,
  /\.mp4$/,
  /\.wav$/,
  /\.avi$/,
  /\.mov$/,
  /\.pdf$/,
  /\.zip$/,
  /\.tar$/,
  /\.gz$/,
  /\.jar$/,
  /\.exe$/,
  /\.dll$/,
  /\.so$/,
  /\.dylib$/,
  /\.wasm$/,
];

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  php: 'php',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  md: 'markdown',
  mdx: 'markdown',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'protobuf',
  tf: 'terraform',
  dockerfile: 'dockerfile',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  vue: 'vue',
  svelte: 'svelte',
};

function inferLanguage(filePath: string): string {
  const basename = filePath.split('/').pop()?.toLowerCase() ?? '';
  if (basename === 'dockerfile' || basename.startsWith('dockerfile.'))
    return 'dockerfile';
  if (basename === 'makefile') return 'makefile';

  const ext = basename.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_LANGUAGE_MAP[ext] ?? 'unknown';
}

function shouldIgnoreFile(filename: string): boolean {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(filename));
}

/**
 * Parses a unified diff patch into structured hunks.
 *
 * Each hunk header looks like: @@ -oldStart,oldCount +newStart,newCount @@
 * We extract the new-file line numbers and the changed/context lines.
 */
function parseHunks(patch: string): DiffHunk[] {
  if (!patch.trim()) return [];

  const hunks: DiffHunk[] = [];
  const hunkHeaderRegex = /^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/;
  const lines = patch.split('\n');

  let currentHunk: {
    startLine: number;
    lines: string[];
    addedLines: string[];
    removedLines: string[];
    currentLine: number;
  } | null = null;

  for (const line of lines) {
    const headerMatch = hunkHeaderRegex.exec(line);
    if (headerMatch) {
      if (currentHunk) {
        hunks.push(finalizeHunk(currentHunk));
      }
      const newStart = parseInt(headerMatch[1], 10);
      currentHunk = {
        startLine: newStart,
        lines: [],
        addedLines: [],
        removedLines: [],
        currentLine: newStart,
      };
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('+')) {
      currentHunk.addedLines.push(line.slice(1));
      currentHunk.lines.push(line);
      currentHunk.currentLine++;
    } else if (line.startsWith('-')) {
      currentHunk.removedLines.push(line.slice(1));
      currentHunk.lines.push(line);
    } else if (line.startsWith(' ') || line === '') {
      currentHunk.lines.push(line);
      currentHunk.currentLine++;
    }
  }

  if (currentHunk) {
    hunks.push(finalizeHunk(currentHunk));
  }

  return hunks;
}

function finalizeHunk(hunk: {
  startLine: number;
  lines: string[];
  addedLines: string[];
  removedLines: string[];
  currentLine: number;
}): DiffHunk {
  return {
    startLine: hunk.startLine,
    endLine: Math.max(hunk.startLine, hunk.currentLine - 1),
    content: hunk.lines.join('\n'),
    addedLines: hunk.addedLines,
    removedLines: hunk.removedLines,
  };
}

@Injectable()
export class DiffParser {
  /**
   * Parses raw DiffFile[] from GitHub into a structured ParsedDiff,
   * filtering out irrelevant files and extracting per-file hunks.
   */
  parse(files: DiffFile[]): ParsedDiff {
    const parsedFiles: ParsedFile[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const file of files) {
      if (shouldIgnoreFile(file.filename)) continue;
      if (!file.patch) continue;

      const hunks = parseHunks(file.patch);
      if (hunks.length === 0) continue;

      const additions = hunks.reduce((sum, h) => sum + h.addedLines.length, 0);
      const deletions = hunks.reduce(
        (sum, h) => sum + h.removedLines.length,
        0,
      );
      totalAdditions += additions;
      totalDeletions += deletions;

      parsedFiles.push({
        path: file.filename,
        status: file.status,
        hunks,
        language: inferLanguage(file.filename),
      });
    }

    const stats: DiffStats = {
      filesChanged: parsedFiles.length,
      additions: totalAdditions,
      deletions: totalDeletions,
      totalChangedLines: totalAdditions + totalDeletions,
    };

    return { files: parsedFiles, stats };
  }

  /**
   * Formats ParsedFile[] into a structured prompt string for agents.
   * Each file is presented with its path, language, status, and hunks.
   */
  formatForPrompt(files: ParsedFile[], tokenBudget?: number): string {
    const sections: string[] = [];
    let totalChars = 0;
    const charBudget = tokenBudget ? tokenBudget * 4 : Infinity;

    for (const file of files) {
      const header = `## File: ${file.path} (${file.status}) [${file.language}]`;
      const hunkContent = file.hunks.map((h) => h.content).join('\n\n');
      const section = `${header}\n\`\`\`diff\n${hunkContent}\n\`\`\``;

      if (totalChars + section.length > charBudget) {
        sections.push(
          `\n... (${files.length - sections.length} more files omitted due to token budget)`,
        );
        break;
      }

      sections.push(section);
      totalChars += section.length;
    }

    return sections.join('\n\n');
  }
}
