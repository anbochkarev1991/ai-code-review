import type { Finding, RiskLevel } from 'shared';

export function detectSystemicPatterns(findings: Finding[]): string[] {
  const patterns: string[] = [];

  const categoryCount: Record<string, number> = {};
  for (const f of findings) {
    const cat = f.category || 'unknown';
    categoryCount[cat] = (categoryCount[cat] ?? 0) + 1;
  }

  for (const [cat, count] of Object.entries(categoryCount)) {
    if (count >= 3) {
      patterns.push(`Recurring ${cat} issues (${count} findings)`);
    }
  }

  const titleWords = new Map<string, Set<string>>();
  for (const f of findings) {
    if (!f.file) continue;
    const words = f.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    for (const word of words) {
      if (!titleWords.has(word)) titleWords.set(word, new Set());
      titleWords.get(word)!.add(f.file);
    }
  }

  for (const [word, files] of titleWords) {
    if (files.size >= 2) {
      const keywords = [
        'injection',
        'error',
        'handling',
        'validation',
        'missing',
        'unsafe',
        'async',
        'memory',
        'leak',
      ];
      if (keywords.includes(word)) {
        patterns.push(
          `Cross-file "${word}" pattern across ${files.size} files`,
        );
      }
    }
  }

  return [...new Set(patterns)].slice(0, 3);
}

/**
 * Deterministic summary paragraph aligned with merge recommendation and finding counts.
 */
export function buildReviewSummaryParagraph(params: {
  findings: Finding[];
  counts: { critical: number; high: number; medium: number; low: number };
  riskScore: number;
  riskLevel: RiskLevel;
  mergeRecommendation: string;
  primaryRiskCategory?: string;
  systemicPatterns: string[];
  multiAgentConfirmedCount: number;
}): string {
  const {
    findings,
    counts,
    riskScore,
    riskLevel,
    mergeRecommendation,
    primaryRiskCategory,
    systemicPatterns,
    multiAgentConfirmedCount,
  } = params;

  if (findings.length === 0) {
    return 'No issues found in this Pull Request. The changes appear clean across all review dimensions. Recommendation: Safe to merge.';
  }

  const sentences: string[] = [];

  if (counts.critical > 0 && primaryRiskCategory) {
    sentences.push(
      `This PR introduces ${counts.critical} critical ${primaryRiskCategory} concern${counts.critical === 1 ? '' : 's'} requiring immediate attention.`,
    );
  } else if (counts.high > 0 && primaryRiskCategory) {
    sentences.push(
      `This PR raises ${primaryRiskCategory} concerns with ${counts.high} high-severity finding${counts.high === 1 ? '' : 's'} identified across the changed files.`,
    );
  } else {
    sentences.push(
      `Found ${findings.length} issue${findings.length === 1 ? '' : 's'} across the changed files (risk: ${riskScore}/100, ${riskLevel}).`,
    );
  }

  if (systemicPatterns.length > 0) {
    const patternDesc =
      systemicPatterns.length === 1
        ? systemicPatterns[0].toLowerCase()
        : `${systemicPatterns.length} systemic patterns detected`;
    sentences.push(
      `Analysis reveals ${patternDesc}, suggesting structural gaps rather than isolated incidents.`,
    );
  }

  if (multiAgentConfirmedCount > 0) {
    sentences.push(
      `${multiAgentConfirmedCount} finding${multiAgentConfirmedCount === 1 ? ' was' : 's were'} independently confirmed by multiple agents, increasing confidence in their accuracy.`,
    );
  }

  if (sentences.length < 4) {
    if (mergeRecommendation === 'Merge blocked') {
      sentences.push(
        'Recommendation: Block merge until high/critical issues are resolved.',
      );
    } else if (mergeRecommendation === 'Merge with caution') {
      sentences.push(
        'Recommendation: Proceed with caution and address medium-severity findings.',
      );
    } else {
      sentences.push('Recommendation: Safe to merge.');
    }
  }

  return sentences.slice(0, 4).join(' ');
}
