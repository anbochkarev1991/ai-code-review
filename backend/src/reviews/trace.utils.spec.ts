import {
  buildTraceStep,
  TRACE_AGENT_NAMES,
  type TraceAgentName,
} from './trace.utils';
import { TRACE_RAW_OUTPUT_MAX_LENGTH } from 'shared';

describe('trace.utils', () => {
  const baseStarted = new Date('2025-01-15T10:00:00.000Z');
  const baseFinished = new Date('2025-01-15T10:00:05.000Z');

  describe('TRACE_AGENT_NAMES', () => {
    it('has exactly 5 agent names: Code, Arch, Perf, Sec, Agg', () => {
      expect(TRACE_AGENT_NAMES).toHaveLength(5);
      expect(TRACE_AGENT_NAMES).toEqual([
        'Code Quality',
        'Architecture',
        'Performance',
        'Security',
        'Aggregator',
      ]);
    });
  });

  describe('buildTraceStep', () => {
    it('produces TraceStep with required fields', () => {
      const step = buildTraceStep({
        agent: 'Code Quality',
        startedAt: baseStarted,
        finishedAt: baseFinished,
        status: 'ok',
      });

      expect(step).toMatchObject({
        agent: 'Code Quality',
        started_at: '2025-01-15T10:00:00.000Z',
        finished_at: '2025-01-15T10:00:05.000Z',
        status: 'ok',
      });
      expect(step.agent).toBeDefined();
      expect(step.started_at).toBeDefined();
      expect(step.finished_at).toBeDefined();
      expect(step.status).toBeDefined();
    });

    it('includes tokens_used when provided', () => {
      const step = buildTraceStep({
        agent: 'Architecture',
        startedAt: baseStarted,
        finishedAt: baseFinished,
        status: 'ok',
        tokensUsed: 1200,
      });

      expect(step.tokens_used).toBe(1200);
    });

    it('includes raw_output when provided and truncates if large', () => {
      const smallRaw = '{"findings":[],"summary":"ok"}';
      const step = buildTraceStep({
        agent: 'Performance',
        startedAt: baseStarted,
        finishedAt: baseFinished,
        status: 'ok',
        rawOutput: smallRaw,
      });

      expect(step.raw_output).toBe(smallRaw);
    });

    it('truncates raw_output when exceeding max length', () => {
      const longRaw = 'x'.repeat(TRACE_RAW_OUTPUT_MAX_LENGTH + 100);
      const step = buildTraceStep({
        agent: 'Security',
        startedAt: baseStarted,
        finishedAt: baseFinished,
        status: 'ok',
        rawOutput: longRaw,
      });

      expect(step.raw_output).toHaveLength(TRACE_RAW_OUTPUT_MAX_LENGTH);
      expect(step.raw_output).toMatch(/\.\.\.$/);
    });

    it('omits raw_output when empty string', () => {
      const step = buildTraceStep({
        agent: 'Aggregator',
        startedAt: baseStarted,
        finishedAt: baseFinished,
        status: 'ok',
        rawOutput: '',
      });

      expect(step.raw_output).toBeUndefined();
    });

    it('builds trace with status failed', () => {
      const step = buildTraceStep({
        agent: 'Code Quality',
        startedAt: baseStarted,
        finishedAt: baseFinished,
        status: 'failed',
      });

      expect(step.status).toBe('failed');
    });
  });

  describe('trace array with 5 entries (Code, Arch, Perf, Sec, Agg)', () => {
    it('produces trace array with all 5 agent entries', () => {
      let offset = 0;
      const trace = TRACE_AGENT_NAMES.map((agent, i) => {
        const started = new Date(baseStarted.getTime() + offset);
        offset += 1000;
        const finished = new Date(baseStarted.getTime() + offset);
        return buildTraceStep({
          agent,
          startedAt: started,
          finishedAt: finished,
          status: 'ok',
          tokensUsed: 100 + i * 10,
        });
      });

      expect(trace).toHaveLength(5);
      expect(trace.map((s) => s.agent)).toEqual([
        'Code Quality',
        'Architecture',
        'Performance',
        'Security',
        'Aggregator',
      ]);
      trace.forEach((step, i) => {
        expect(step.agent).toBe(TRACE_AGENT_NAMES[i] as TraceAgentName);
        expect(step.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
        expect(step.finished_at).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
        expect(step.status).toBe('ok');
        expect(step.tokens_used).toBe(100 + i * 10);
      });
    });
  });
});
