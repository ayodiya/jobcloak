import { AIValidationError } from '@jobs-app/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  buildJsonCorrectionMessage,
  extractJsonFragment,
  parseLooseJson,
  parseStructuredOutput,
} from './StructuredOutputParser.js';

const SkillSchema = z.object({
  skills: z.array(z.object({ name: z.string(), level: z.string() })),
});

describe('extractJsonFragment', () => {
  it('returns undefined when no JSON exists', () => {
    expect(extractJsonFragment('there is nothing here')).toBeUndefined();
  });

  it('extracts an object from surrounding prose and fences', () => {
    const text = 'Sure! Here you go:\n```json\n{"a": 1}\n```\nHope that helps.';
    expect(extractJsonFragment(text)).toBe('{"a": 1}');
  });

  it('ignores braces inside string values', () => {
    const text = '{"note": "use {braces} carefully", "n": 2}';
    expect(extractJsonFragment(text)).toBe(text);
  });

  it('handles nested objects and arrays', () => {
    const text = 'prefix [{"a": [1, 2, {"b": 3}]}] suffix';
    expect(extractJsonFragment(text)).toBe('[{"a": [1, 2, {"b": 3}]}]');
  });

  it('handles escaped quotes inside strings', () => {
    const text = '{"quote": "she said \\"hi\\""}';
    expect(extractJsonFragment(text)).toBe(text);
  });
});

describe('parseLooseJson', () => {
  it('parses strict JSON', () => {
    expect(parseLooseJson('{"ok": true}')).toEqual({ ok: true });
  });

  it('parses JSON wrapped in prose', () => {
    expect(parseLooseJson('Here: {"ok": true}')).toEqual({ ok: true });
  });

  it('throws AIValidationError on empty input', () => {
    expect(() => parseLooseJson('   ')).toThrow(AIValidationError);
  });

  it('throws AIValidationError when no JSON is present', () => {
    expect(() => parseLooseJson('no json at all')).toThrow(AIValidationError);
  });

  it('throws AIValidationError on a truncated object', () => {
    expect(() => parseLooseJson('{"a": 1')).toThrow(AIValidationError);
  });
});

describe('parseStructuredOutput', () => {
  it('returns validated data', () => {
    const text = '```json\n{"skills":[{"name":"TypeScript","level":"Advanced"}]}\n```';
    expect(parseStructuredOutput(text, SkillSchema)).toEqual({
      skills: [{ name: 'TypeScript', level: 'Advanced' }],
    });
  });

  it('throws AIValidationError when the shape is wrong', () => {
    expect(() => parseStructuredOutput('{"skills": "nope"}', SkillSchema)).toThrow(AIValidationError);
  });

  it('exposes issues in the error details', () => {
    try {
      parseStructuredOutput('{"skills": [{"name": 1, "level": "x"}]}', SkillSchema);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AIValidationError);
      const details = (error as AIValidationError).details;
      expect(details?.['issues']).toBeDefined();
    }
  });
});

describe('buildJsonCorrectionMessage', () => {
  it('includes the failure reason and a bounded preview', () => {
    const message = buildJsonCorrectionMessage('{"bad":', 'skills: Required');
    expect(message).toContain('skills: Required');
    expect(message).toContain('{"bad":');
    expect(message).toContain('ONLY a corrected');
  });
});
