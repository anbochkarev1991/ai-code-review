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
  'open redirect',
  'unvalidated url',
];

/** Explicit open-redirect class issues (security category only). */
const OPEN_REDIRECT_PHRASES = ['open redirect', 'unsafe redirect'];

/** Signals that redirect target is user- / attacker-controlled (pairs with redirect in text). */
const USER_CONTROLLED_REDIRECT_SIGNALS = [
  'user-controlled',
  'user controlled',
  'attacker-controlled',
  'attacker controlled',
  'attacker',
  'untrusted',
  'unvalidated',
  'without validation',
  'without allowlist',
  'without an allowlist',
  'searchparams',
  'search params',
  'query param',
  'querystring',
  'query string',
  'get("next"',
  "get('next'",
  '["next"]',
];

const REDIRECT_SINK_KEYWORDS = [
  'res.redirect',
  'redirect(',
  'redirect()',
  'window.location',
  'location.href',
];

/** Risk that URL is external / not validated (for sink-based rule 3). */
const UNVALIDATED_EXTERNAL_URL_SIGNALS = [
  'unvalidated',
  'unvalidated url',
  'external url',
  'external site',
  'external link',
  'from api',
  'from the api',
  'api response',
  'without https',
  'without allowlist',
  'no allowlist',
  'arbitrary url',
  'attacker-controlled',
  'phishing',
];

/**
 * Auth/OAuth/login flows — elevate open redirect to critical when combined with open-redirect signals.
 * Phrases are chosen to avoid matching casual mentions like "after login" in general navigation text.
 */
const AUTH_CONTEXT_KEYWORDS = [
  'oauth',
  'oidc',
  '/auth/',
  'auth/callback',
  'auth callback',
  'oauth callback',
  'login callback',
  'sign-in',
  'sign in flow',
  'session fixation',
  'token exchange',
  'authorization code',
];

/** Mitigations: cap promotion via redirect override; monotonic rule still preserves higher agent severity. */
const DOWNGRADE_KEYWORDS = [
  'allowlisted',
  'against allowlist',
  'against an allowlist',
  'domain allowlist',
  'allow list',
  'whitelist',
  'same-origin',
  'relative path',
  'internal only',
  'strict validation',
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

/** Open redirect with user-controlled target (rule 1). */
function isOpenRedirectUserControlled(combined: string): boolean {
  if (containsAny(combined, OPEN_REDIRECT_PHRASES)) return true;
  const c = combined.toLowerCase();
  if (!c.includes('redirect')) return false;
  return containsAny(combined, USER_CONTROLLED_REDIRECT_SIGNALS);
}

/** window.location / redirect + unvalidated external URL (rule 3). */
function isRedirectSinkWithUnvalidatedExternalUrl(combined: string): boolean {
  if (!containsAny(combined, REDIRECT_SINK_KEYWORDS)) return false;
  return containsAny(combined, UNVALIDATED_EXTERNAL_URL_SIGNALS);
}

export function maxSeverity(
  a: FindingSeverity,
  b: FindingSeverity,
): FindingSeverity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
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
  const combined =
    `${finding.message || ''} ${finding.title || ''} ${finding.impact || ''}`.toLowerCase();
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
  const combined =
    `${finding.message || ''} ${finding.title || ''} ${finding.impact || ''}`.toLowerCase();
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
 * Security-only severity adjustment for redirect / unvalidated external URL patterns.
 * Does not add findings; only assigns policy severity when text clearly matches existing finding.
 * Returns null to use the generic impact/likelihood matrix.
 */
export function securitySeverityOverride(
  finding: Finding,
  confidence: number,
): FindingSeverity | null {
  if (finding.category !== 'security') return null;

  const combined = `${finding.title} ${finding.message} ${finding.impact ?? ''} ${finding.suggested_fix ?? ''}`;

  const openRedirectUserControlled = isOpenRedirectUserControlled(combined);
  const sinkUnvalidatedExternal =
    isRedirectSinkWithUnvalidatedExternalUrl(combined);

  if (!openRedirectUserControlled && !sinkUnvalidatedExternal) return null;

  if (containsAny(combined, DOWNGRADE_KEYWORDS)) {
    return 'medium';
  }

  if (confidence < 0.7) return null;

  // Rule 2: open redirect in auth/callback flow → CRITICAL
  if (
    openRedirectUserControlled &&
    containsAny(combined, AUTH_CONTEXT_KEYWORDS) &&
    confidence >= 0.8
  ) {
    return 'critical';
  }

  // Rule 1: open redirect (user-controlled) → HIGH
  if (openRedirectUserControlled) {
    return 'high';
  }

  // Rule 3: window.location / redirect + unvalidated external URL → HIGH
  return 'high';
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

  const securityOverride = securitySeverityOverride(finding, confidence);
  if (securityOverride !== null) {
    return maxSeverity(finding.severity, securityOverride);
  }

  const impact = inferImpactLevel(finding);
  const likelihood = inferLikelihood(finding, confidence);

  let base: FindingSeverity = 'medium';

  let s: FindingSeverity;

  if (impact === 'high' && likelihood === 'high' && confidence >= 0.8) {
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

  s = base;

  if (confidence < 0.8) {
    s = capAtMost(s, 'medium');
  }
  if (likelihood === 'low') {
    s = capAtMost(s, 'medium');
  }
  if (!affectsRuntime(finding)) {
    s = capAtMost(s, 'medium');
  }

  if (finding.category === 'security') {
    s = maxSeverity(finding.severity, s);
  }

  return s;
}

export function applyFindingSeverity(finding: Finding): Finding {
  return { ...finding, severity: computeSeverity(finding) };
}
