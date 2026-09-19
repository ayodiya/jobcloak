import { MockLLMProvider } from '@jobs-app/ai/testing';
import { describe, expect, it } from 'vitest';
import { AiQuestionClassifierBackend } from './ai-question.js';

describe('AiQuestionClassifierBackend', () => {
  it('classifies through the LLM provider into a known category', async () => {
    const provider = new MockLLMProvider({
      structured: { category: 'answer', confidence: 'high', reason: 'open question' },
    });
    const backend = new AiQuestionClassifierBackend(provider);
    await expect(backend.classify('Why do you want to join?')).resolves.toEqual({
      category: 'answer',
      confidence: 'high',
      reason: 'open question',
    });
  });

  it('sends the question as untrusted data with a temperature of zero', async () => {
    const provider = new MockLLMProvider({
      structured: { category: 'contact', confidence: 'medium', reason: 'location' },
    });
    const backend = new AiQuestionClassifierBackend(provider);
    await backend.classify('Which city are you based in?');
    const request = provider.calls[0]?.request as {
      prompt: string;
      temperature: number;
      maxTokens: number;
    };
    expect(request.prompt).toContain('untrusted data');
    expect(request.prompt).toContain('<<<Which city are you based in?>>>');
    expect(request.temperature).toBe(0);
    expect(request.maxTokens).toBe(300);
  });
});
