import type { Finding } from 'shared';
import {
  applyFindingSeverity,
  computeSeverity,
  inferImpactLevel,
  inferLikelihood,
  isStylisticFinding,
  affectsRuntime,
  securitySeverityOverride,
} from './severity-classifier';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f-1',
    title: 'Test finding',
    severity: 'medium',
    category: 'security',
    message: 'Concrete security issue with clear evidence in the diff.',
    confidence: 0.85,
    file: 'src/app.ts',
    line: 10,
    ...overrides,
  };
}

describe('severity-classifier', () => {
  describe('computeSeverity', () => {
    it('defaults missing confidence to 0.7 for classification', () => {
      const f = makeFinding({
        confidence: undefined as unknown as number,
        severity: 'high',
        impact: 'Remote code execution possible.',
      });
      expect(computeSeverity(f)).toBeDefined();
    });

    it('caps at MEDIUM when confidence < 0.8 even if agent said critical', () => {
      const s = computeSeverity(
        makeFinding({
          severity: 'critical',
          confidence: 0.79,
          impact: 'Full database compromise.',
          message: 'No uncertainty.',
        }),
      );
      expect(s).toBe('medium');
    });

    it('assigns CRITICAL only when impact high, likelihood high, confidence >= 0.8', () => {
      const s = computeSeverity(
        makeFinding({
          severity: 'critical',
          confidence: 0.96,
          impact: 'SQL injection may allow full database compromise.',
          message:
            'User input is concatenated into the query without sanitization.',
        }),
      );
      expect(s).toBe('critical');
    });

    it('assigns HIGH when impact high, likelihood medium or high, confidence >= 0.8', () => {
      const s = computeSeverity(
        makeFinding({
          severity: 'high',
          confidence: 0.9,
          impact: 'Authentication bypass for protected routes.',
          message: 'Missing auth check on the handler.',
        }),
      );
      expect(s).toBe('high');
    });

    it('caps at MEDIUM when likelihood is low (uncertainty in message)', () => {
      const s = computeSeverity(
        makeFinding({
          severity: 'critical',
          confidence: 0.96,
          impact: 'SQL injection may allow compromise.',
          message: 'This might be exploitable under certain conditions.',
        }),
      );
      expect(s).toBe('medium');
    });

    it('forces LOW for purely stylistic code-quality findings', () => {
      const s = computeSeverity(
        makeFinding({
          category: 'code-quality',
          severity: 'high',
          confidence: 0.9,
          message: 'Variable naming convention should use camelCase here.',
        }),
      );
      expect(s).toBe('low');
    });

    it('caps at MEDIUM when issue does not affect runtime', () => {
      const s = computeSeverity(
        makeFinding({
          category: 'architecture',
          severity: 'high',
          confidence: 0.9,
          impact: 'Documentation only; no functional impact.',
          message: 'Comment is outdated.',
        }),
      );
      expect(s).toBe('medium');
    });

    it('applyFindingSeverity overwrites severity', () => {
      const out = applyFindingSeverity(
        makeFinding({
          severity: 'critical',
          confidence: 0.5,
          impact: 'Issue.',
        }),
      );
      expect(out.severity).toBe(computeSeverity(out));
    });

    describe('security redirect / unvalidated URL override', () => {
      it('assigns CRITICAL for open redirect in OAuth callback with confidence >= 0.8', () => {
        const s = computeSeverity(
          makeFinding({
            category: 'security',
            severity: 'medium',
            confidence: 0.85,
            title: 'Open redirect in OAuth callback handler',
            message:
              'The redirect target is built from query params and passed to redirect() without allowlisting.',
            impact: 'Attackers can steal OAuth tokens via phishing redirects.',
          }),
        );
        expect(s).toBe('critical');
      });

      it('assigns HIGH for open redirect in general navigation with confidence >= 0.8', () => {
        const s = computeSeverity(
          makeFinding({
            category: 'security',
            severity: 'medium',
            confidence: 0.85,
            title: 'Open redirect via next query parameter',
            message:
              'searchParams.get("next") is passed to redirect() without validation.',
            impact:
              'Users can be sent to attacker-controlled URLs after login.',
          }),
        );
        expect(s).toBe('high');
      });

      it('assigns HIGH for unvalidated external URL in window.location with confidence 0.8', () => {
        const s = computeSeverity(
          makeFinding({
            category: 'security',
            severity: 'medium',
            confidence: 0.8,
            title: 'window.location assigned from API response URL',
            message:
              'The URL from the API is assigned to window.location without https or allowlist checks.',
            impact: 'Arbitrary navigation and potential phishing.',
          }),
        );
        expect(s).toBe('high');
      });

      it('assigns HIGH for redirect sink with confidence 0.7 (relaxed threshold)', () => {
        const s = computeSeverity(
          makeFinding({
            category: 'security',
            severity: 'medium',
            confidence: 0.7,
            title: 'Redirect uses untrusted next parameter',
            message: 'searchParams.get("next") is passed to redirect().',
            impact: 'Arbitrary URL navigation.',
          }),
        );
        expect(s).toBe('high');
      });

      it('caps at MEDIUM when strict allowlist / mitigation is described', () => {
        const s = computeSeverity(
          makeFinding({
            category: 'security',
            severity: 'high',
            confidence: 0.9,
            title: 'Redirect target validated against allowlist',
            message:
              'User-supplied next is passed to redirect() but strict validation restricts to same-origin paths.',
            impact: 'Limited risk due to allowlist.',
          }),
        );
        expect(s).toBe('medium');
      });

      it('does not promote open redirect when confidence < 0.7', () => {
        const s = computeSeverity(
          makeFinding({
            category: 'security',
            severity: 'medium',
            confidence: 0.5,
            title: 'Open redirect via next query param',
            message:
              'The next parameter is passed to redirect() without validation.',
            impact: 'Users can be sent to an attacker-controlled destination.',
          }),
        );
        expect(s).toBe('medium');
      });

      it('leaves non-redirect security findings on generic path', () => {
        const s = computeSeverity(
          makeFinding({
            category: 'security',
            severity: 'critical',
            confidence: 0.96,
            title: 'SQL injection in search handler',
            message:
              'User input is concatenated into the query without sanitization.',
            impact: 'SQL injection may allow full database compromise.',
          }),
        );
        expect(s).toBe('critical');
      });
    });
  });

  describe('securitySeverityOverride', () => {
    it('returns null for non-security category', () => {
      expect(
        securitySeverityOverride(
          makeFinding({
            category: 'code-quality',
            title: 'redirect() misuse',
            message: 'Uses redirect from query.',
            confidence: 0.9,
          }),
          0.9,
        ),
      ).toBeNull();
    });

    it('returns null when no redirect/url signals', () => {
      expect(
        securitySeverityOverride(
          makeFinding({
            category: 'security',
            title: 'Missing CSRF token',
            message: 'POST form has no CSRF protection.',
            confidence: 0.9,
          }),
          0.9,
        ),
      ).toBeNull();
    });
  });

  describe('inferImpactLevel', () => {
    it('detects high impact from impact string', () => {
      expect(
        inferImpactLevel(
          makeFinding({
            impact: 'Remote SQL injection leading to data breach.',
          }),
        ),
      ).toBe('high');
    });

    it('detects low impact from impact string', () => {
      expect(
        inferImpactLevel(
          makeFinding({ impact: 'Minor readability improvement.' }),
        ),
      ).toBe('low');
    });

    it('infers from severity when impact is empty', () => {
      expect(
        inferImpactLevel(makeFinding({ impact: '', severity: 'critical' })),
      ).toBe('high');
      expect(
        inferImpactLevel(makeFinding({ impact: '', severity: 'low' })),
      ).toBe('low');
    });
  });

  describe('inferLikelihood', () => {
    it('returns low when message has uncertainty phrases', () => {
      expect(
        inferLikelihood(
          makeFinding({ message: 'This possibly fails under load.' }),
          0.9,
        ),
      ).toBe('low');
    });

    it('returns high when confidence >= 0.95 and no uncertainty', () => {
      expect(
        inferLikelihood(makeFinding({ message: 'Clear bug.' }), 0.96),
      ).toBe('high');
    });

    it('returns low when confidence < 0.6', () => {
      expect(inferLikelihood(makeFinding({ message: 'Clear.' }), 0.5)).toBe(
        'low',
      );
    });
  });

  describe('isStylisticFinding / affectsRuntime', () => {
    it('marks code-quality with style keywords as stylistic', () => {
      expect(
        isStylisticFinding(
          makeFinding({
            category: 'code-quality',
            message: 'Naming convention for the helper.',
          }),
        ),
      ).toBe(true);
    });

    it('affectsRuntime false when no runtime phrase present', () => {
      expect(
        affectsRuntime(
          makeFinding({
            message: 'This has no behavioral impact on runtime.',
            category: 'architecture',
            impact: 'Docs only.',
          }),
        ),
      ).toBe(false);
    });
  });
});
