import { AIProviderError } from '@jobs-app/shared';
import { MockLLMProvider } from '@jobs-app/ai/testing';
import { describe, expect, it } from 'vitest';
import { extractRequirementsWithAI, buildRequirementPrompt } from './requirements-ai.js';
import type { JobRequirementInput } from './types.js';

const DESCRIPTION = 'We need a developer who knows Rust and speaks German.';

const deterministic = (): JobRequirementInput[] => [
  {
    kind: 'Required',
    category: 'Skill',
    key: 'rust',
    name: 'Rust',
    detail: 'We need a developer who knows Rust and speaks German.',
    source: 'Deterministic',
  },
];

describe('extractRequirementsWithAI', () => {
  it('merges new AI requirements under deterministic ones', async () => {
    const provider = new MockLLMProvider({
      structured: {
        requirements: [
          { kind: 'Required', category: 'Language', name: 'German', confidence: 0.9 },
        ],
      },
    });

    const result = await extractRequirementsWithAI(DESCRIPTION, deterministic(), { provider });

    expect(result).toHaveLength(2);
    const german = result.find((r) => r.key === 'german');
    expect(german?.category).toBe('Language');
    expect(german?.source).toBe('AI');
    expect(german?.confidence).toBe(0.9);
    // deterministic entry untouched
    expect(result.find((r) => r.key === 'rust')?.source).toBe('Deterministic');
  });

  it("lets deterministic entries win over the model's duplicates", async () => {
    const provider = new MockLLMProvider({
      structured: {
        requirements: [
          { kind: 'Required', category: 'Skill', name: 'Rust' },
          { kind: 'NiceToHave', category: 'Language', name: 'German' },
        ],
      },
    });

    const result = await extractRequirementsWithAI(DESCRIPTION, deterministic(), { provider });
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.key === 'rust')?.source).toBe('Deterministic');
    expect(result.find((r) => r.key === 'german')?.kind).toBe('NiceToHave');
  });

  it('falls back to deterministic when the provider is unavailable', async () => {
    const provider = new MockLLMProvider({ structured: new AIProviderError('ollama down') });
    const result = await extractRequirementsWithAI(DESCRIPTION, deterministic(), { provider });
    expect(result).toEqual(deterministic());
  });

  it('falls back to deterministic when the model output is invalid', async () => {
    const provider = new MockLLMProvider({ structured: { requirements: 'not-an-array' } });
    const result = await extractRequirementsWithAI(DESCRIPTION, deterministic(), { provider });
    expect(result).toEqual(deterministic());
  });

  it('caps requirement count via schema', async () => {
    const provider = new MockLLMProvider({
      structured: {
        requirements: Array.from({ length: 150 }, (_, i) => ({
          kind: 'Required' as const,
          category: 'Other' as const,
          name: `Requirement ${i}`,
        })),
      },
    });
    const result = await extractRequirementsWithAI(DESCRIPTION, deterministic(), { provider, model: 'test' });
    expect(result.length).toBeLessThanOrEqual(100);
  });
});

describe('buildRequirementPrompt', () => {
  it('includes the known deterministic requirements', () => {
    const prompt = buildRequirementPrompt(DESCRIPTION, deterministic());
    expect(prompt).toContain('- [Required/Skill] Rust');
    expect(prompt).toContain(DESCRIPTION);
  });
});