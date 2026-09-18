import { describe, expect, it } from 'vitest';
import {
  cvImportInputSchema,
  evidenceInputSchema,
  experienceInputSchema,
  profileInputSchema,
  skillInputSchema,
  validateOrThrow,
} from './validation.js';
import { ValidationError } from '@jobs-app/shared';
import { SkillLevel } from '@jobs-app/database';

describe('candidate validation', () => {
  it('normalizes skill names and applies the default level', () => {
    const parsed = skillInputSchema.parse({ name: '  Node.  JS ' });
    expect(parsed.name).toBe('Node. JS');
    expect(parsed.level).toBe(SkillLevel.Intermediate);
    expect(parsed.years).toBeNull();
  });

  it('treats empty optional text as absent', () => {
    const parsed = profileInputSchema.parse({ firstName: '', city: '  Berlin ' });
    expect(parsed.firstName).toBeUndefined();
    expect(parsed.city).toBe('Berlin');
  });

  it('rejects an end date before the start date', () => {
    const result = experienceInputSchema.safeParse({
      organization: 'Acme',
      title: 'Engineer',
      startDate: '2022-01-01',
      endDate: '2021-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('drops the end date when an experience is current', () => {
    const parsed = experienceInputSchema.parse({
      organization: 'Acme',
      title: 'Engineer',
      startDate: '2022-01-01',
      endDate: '2023-01-01',
      current: true,
    });
    expect(parsed.endDate).toBeNull();
  });

  it('rejects an inverted expected salary range', () => {
    const result = profileInputSchema.safeParse({ expectedSalaryMin: 100, expectedSalaryMax: 50 });
    expect(result.success).toBe(false);
  });

  it('preserves CV line breaks in raw text', () => {
    const raw = 'Experience\nAcme\n\nSkills\nTypeScript';
    const parsed = cvImportInputSchema.parse({ rawText: raw });
    expect(parsed.rawText).toBe(raw);
  });

  it('throws a ValidationError carrying issue paths', () => {
    try {
      validateOrThrow(skillInputSchema, { name: '' }, 'skill');
      throw new Error('expected validateOrThrow to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const details = (error as ValidationError).details as { issues: { path: string }[] };
      expect(details.issues[0]?.path).toBe('name');
    }
  });

  it('defaults evidence source to user-provided', () => {
    const parsed = evidenceInputSchema.parse({ rawText: 'shipped feature X' });
    expect(parsed.source).toBe('UserProvided');
  });
});
