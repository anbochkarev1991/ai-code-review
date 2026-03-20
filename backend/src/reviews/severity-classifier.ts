import type { Finding, FindingSeverity } from 'shared';

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const UNCERTAINTY_PHRASES = [
  'might',
  'possibly',
  'perhaps',
  'could potentially',
  'may or may not',
  'not entirely sure',
  'uncertain',
  'unclear whether',
  'hard to tell',
];

const HIGH_IMPACT_KEYWORDS = [
  'injection',
  'compromise',
  'crash',
  'bypass',
  'exploit',
  'exposure',
  'rce',
  'sql injection',
  'xss',
  'csrf',
  'auth bypass',
  'data breach',
  'remote code',
];

const LOW_IMPACT_KEYWORDS = [
  'readability',
  'style',
  'format',
  'naming',
  'convention',
  'lint',
  'cosmetic',
];

const STYLISTIC_KEYWORDS = [
  'style',
  'format',
  'naming',
  'readability',
  'convention',
  'lint',
];

const NO_RUNTIME_PHRASES = [
  'no functional impact',
  'readability only',
  'does not affect runtime',
  'no behavioral impact',
  'no runtime impact',
  'purely cosmetic',
];

function containsAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

export type ImpactLevel = 'high' | 'medium' | 'low';
export type LikelihoodLevel = 'high' | 'medium' | 'low';

/** Infer impact level from impact text, or from agent-reported severity when impact is absent. */
export function inferImpactLevel(finding: Finding): ImpactLevel {
  const impact = (finding.impact || '').trim();
  if (impact) {
    if (containsAny(impact, HIGH_IMPACT_KEYWORDS)) return 'high';
    if (containsAny(impact, LOW_IMPACT_KEYWORDS)) return 'low';
    if (finding.category === 'code-quality' && finding.severity === 'low') {
      return 'low';
    }
    return 'medium';
  }

  const sev = finding.severity;
  if (sev === 'critical' || sev === 'high') return 'high';
  if (sev === 'low') return 'low';
  return 'medium';
}

/**
 * Infer likelihood from confidence and uncertainty language in the finding text.
 * High likelihood requires very strong confidence (>= 0.95) so HIGH severity remains
 * reachable (impact high + likelihood medium + confidence in [0.8, 1) → HIGH, not CRITICAL).
 */
export function inferLikelihood(
  finding: Finding,
  confidence: number,
): LikelihoodLevel {
  const combined = `${finding.message || ''} ${finding.title || ''} ${finding.impact || ''}`.toLowerCase();
  if (UNCERTAINTY_PHRASES.some((p) => combined.includes(p))) {
    return 'low';
  }
  if (confidence < 0.6) return 'low';
  if (confidence >= 0.95) return 'high';
  return 'medium';
}

/** Purely stylistic/readability issues in code-quality category. */
export function isStylisticFinding(finding: Finding): boolean {
  if (finding.category !== 'code-quality') return false;
  const combined = `${finding.message || ''} ${finding.title || ''} ${finding.impact || ''}`;
  return containsAny(combined, STYLISTIC_KEYWORDS);
}

/** Whether the issue can affect runtime behavior (vs docs-only / readability-only). */
export function affectsRuntime(finding: Finding): boolean {
  if (isStylisticFinding(finding)) return false;
  const combined = `${finding.message || ''} ${finding.title || ''} ${finding.impact || ''}`.toLowerCase();
  if (NO_RUNTIME_PHRASES.some((p) => combined.includes(p))) return false;
  return true;
}

function capAtMost(
  severity: FindingSeverity,
  max: FindingSeverity,
): FindingSeverity {
  if (SEVERITY_ORDER[severity] > SEVERITY_ORDER[max]) return max;
  return severity;
}

/**
 * Deterministic severity from inferred impact, likelihood, and confidence.
 * Does not discover new findings — only reassigns severity for existing ones.
 */
export function computeSeverity(finding: Finding): FindingSeverity {
  const confidence = finding.confidence ?? 0.7;

  if (isStylisticFinding(finding)) {
    return 'low';
  }

  const impact = inferImpactLevel(finding);
  const likelihood = inferLikelihood(finding, confidence);

  let base: FindingSeverity = 'medium';

  if (
    impact === 'high' &&
    likelihood === 'high' &&
    confidence >= 0.8
  ) {
    base = 'critical';
  } else if (
    impact === 'high' &&
    (likelihood === 'medium' || likelihood === 'high') &&
    confidence >= 0.8
  ) {
    base = 'high';
  } else {
    base = 'medium';
  }

  let s = base;

  if (confidence < 0.8) {
    s = capAtMost(s, 'medium');
  }
  if (likelihood === 'low') {
    s = capAtMost(s, 'medium');
  }
  if (!affectsRuntime(finding)) {
    s = capAtMost(s, 'medium');
  }

  return s;
}

export function applyFindingSeverity(finding: Finding): Finding {
  return { ...finding, severity: computeSeverity(finding) };
}
