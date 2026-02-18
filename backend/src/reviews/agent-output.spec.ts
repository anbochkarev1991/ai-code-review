import { agentOutputSchema, AGENT_OUTPUT_SCHEMA_PROMPT } from 'shared';

describe('agentOutputSchema', () => {
  const validSample = {
    findings: [
      {
        id: 'f1',
        title: 'Unused variable',
        severity: 'medium' as const,
        category: 'code-quality',
        file: 'src/utils.ts',
        line: 42,
        message: 'Variable x is declared but never used.',
        suggestion: 'Remove the unused variable or use it.',
      },
    ],
    summary: 'One code quality issue found.',
  };

  it('validates valid sample JSON', () => {
    const result = agentOutputSchema.safeParse(validSample);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.findings).toHaveLength(1);
      expect(result.data.findings[0].id).toBe('f1');
      expect(result.data.summary).toBe('One code quality issue found.');
    }
  });

  it('validates findings with optional fields omitted', () => {
    const minimal = {
      findings: [
        {
          id: 'f2',
          title: 'Security concern',
          severity: 'high',
          category: 'security',
          message: 'Potential SQL injection.',
        },
      ],
      summary: 'Security finding.',
    };
    const result = agentOutputSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('rejects invalid severity', () => {
    const invalid = {
      ...validSample,
      findings: [{ ...validSample.findings[0], severity: 'invalid' }],
    };
    const result = agentOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing summary', () => {
    const invalid = { findings: validSample.findings };
    const result = agentOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing required finding fields', () => {
    const invalid = {
      findings: [{ id: 'f1', title: 'Foo' }],
      summary: 'Summary',
    };
    const result = agentOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('AGENT_OUTPUT_SCHEMA_PROMPT', () => {
  it('contains key schema fields for prompts', () => {
    expect(AGENT_OUTPUT_SCHEMA_PROMPT).toContain('findings');
    expect(AGENT_OUTPUT_SCHEMA_PROMPT).toContain('summary');
    expect(AGENT_OUTPUT_SCHEMA_PROMPT).toContain('id');
    expect(AGENT_OUTPUT_SCHEMA_PROMPT).toContain('severity');
    expect(AGENT_OUTPUT_SCHEMA_PROMPT).toContain('message');
  });

  it('is non-empty and suitable for agent prompts', () => {
    expect(AGENT_OUTPUT_SCHEMA_PROMPT.length).toBeGreaterThan(20);
    expect(AGENT_OUTPUT_SCHEMA_PROMPT).not.toMatch(/\s{2,}/);
  });
});
