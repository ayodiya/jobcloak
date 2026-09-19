import { describe, expect, it, vi } from 'vitest';
import type { QuestionClassifierBackend } from './classify.js';
import { classifyQuestion, classifyText } from './classify.js';
import type { FormField } from './types.js';

const FIELD: Omit<FormField, 'label'> = {
  key: 'f-q',
  selector: 'textarea[name="answer"]',
  name: null,
  type: 'textarea',
  required: false,
  options: [],
  placeholder: null,
  isQuestion: true,
  group: null,
};

const question = (label: string, extras?: Partial<FormField>): FormField => ({
  ...FIELD,
  label,
  ...extras,
});

class FakeBackend implements QuestionClassifierBackend {
  classify = vi.fn(
    async (): Promise<{ category: 'answer'; confidence: 'high'; reason: string }> => ({
      category: 'answer',
      confidence: 'high',
      reason: 'test',
    }),
  );
}

describe('classifyText', () => {
  it('detects work authorization as a high-confidence stop point', () => {
    const result = classifyText('Are you legally authorized to work in Germany?');
    expect(result.category).toBe('work_authorization');
    expect(result.confidence).toBe('high');
    expect(result.rule.stop).toBe(true);
  });

  it('detects legal declarations as high-confidence stop points', () => {
    expect(classifyText('Do you agree to our terms and conditions?').category).toBe('legal');
  });

  it('detects salary expectations', () => {
    expect(classifyText('What are your salary expectations?').category).toBe('salary');
  });

  it('detects identity fields', () => {
    expect(classifyText('First name').category).toBe('identity');
  });

  it('detects answer prompts', () => {
    expect(
      classifyText('Tell us about a time you led a cross-functional project').category,
    ).toBe('answer');
  });

  it('falls back to unknown', () => {
    const result = classifyText('lorem ipsum dolor sit amet');
    expect(result.category).toBe('unknown');
    expect(result.confidence).toBe('low');
    expect(result.rule.stop).toBe(true);
  });
});

describe('classifyQuestion', () => {
  it('marks work authorization and legal as requiresHuman', async () => {
    const workAuth = await classifyQuestion(question('Do you need visa sponsorship?'));
    expect(workAuth).toMatchObject({
      category: 'work_authorization',
      requiresHuman: true,
      source: 'deterministic',
    });
    const legal = await classifyQuestion(question('I agree to the processing of my data'));
    expect(legal).toMatchObject({ category: 'legal', requiresHuman: true });
  });

  it('allows answer prompts without a human stop', async () => {
    const result = await classifyQuestion(question('Why do you want to join us?'));
    expect(result).toMatchObject({
      category: 'answer',
      requiresHuman: false,
      answerLabel: 'generated answer',
    });
  });

  it('uses the AI backend for unknown questions but keeps the human in the loop', async () => {
    const backend = new FakeBackend();
    const result = await classifyQuestion(
      question('Which continent is your office in?'),
      backend,
    );
    expect(result).toMatchObject({
      category: 'answer',
      source: 'ai',
      confidence: 'high',
      requiresHuman: true,
    });
    expect(backend.classify).toHaveBeenCalled();
  });

  it('falls back to requiresHuman when no backend is available', async () => {
    const result = await classifyQuestion(question('zzz unknown field'));
    expect(result).toMatchObject({
      category: 'unknown',
      requiresHuman: true,
      source: 'deterministic',
    });
  });
});
