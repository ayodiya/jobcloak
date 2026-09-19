import { describe, expect, it } from 'vitest';
import type { AvailableValue } from './map.js';
import { mapFields, unresolvedRequired } from './map.js';
import type { FormField } from './types.js';

const LIGHT_FIELD: Omit<FormField, 'label' | 'key' | 'selector'> = {
  name: null,
  type: 'text',
  required: true,
  options: [],
  placeholder: null,
  isQuestion: false,
  group: null,
};

function field(label: string, overrides?: Partial<FormField>): FormField {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    ...LIGHT_FIELD,
    key: `f-${slug}`,
    selector: `[data-test="${slug}"]`,
    label,
    ...overrides,
  };
}

function value(key: string, label: string, extras?: Partial<AvailableValue>): AvailableValue {
  return { key, label, value: extras?.value ?? label, ...extras };
}

const VALUES: AvailableValue[] = [
  value('name', 'Full name', { value: 'Ada Lovelace' }),
  value('email', 'Email', { value: 'ada@example.com' }),
  value('phone', 'Phone', { value: '+49 30 123456' }),
  value('linkedin', 'LinkedIn', {
    value: 'https://linkedin.com/in/ada',
    aliases: ['LinkedIn profile', 'linkedin url'],
  }),
  value('github', 'GitHub', { value: 'https://github.com/ada' }),
];

describe('mapFields', () => {
  it('maps an exact label match with high confidence', () => {
    const decision = mapFields([field('Full name')], VALUES)[0]!;
    expect(decision).toMatchObject({
      value: 'Ada Lovelace',
      sourceKey: 'name',
      confidence: 'high',
      sensitive: false,
    });
  });

  it('maps aliases on partial overlap', () => {
    const decision = mapFields([field('LinkedIn profile URL')], VALUES)[0]!;
    expect(decision).toMatchObject({ sourceKey: 'linkedin', confidence: 'high' });
  });

  it('matches email by type hint', () => {
    const decision = mapFields([field('Your email address', { type: 'email' })], VALUES)[0]!;
    expect(decision).toMatchObject({ sourceKey: 'email', confidence: 'high' });
  });

  it('returns none with null value when nothing matches and never fabricates', () => {
    const decision = mapFields([field('Favorite color')], VALUES)[0]!;
    expect(decision).toMatchObject({ value: null, sourceKey: null, confidence: 'none' });
    expect(decision.reason).toContain('refusing to fabricate');
  });

  it('flags sensitive values', () => {
    const sensitive = value('ssn', 'Security number', {
      sensitive: true,
      value: '123-45-6789',
    });
    const decision = mapFields([field('Security number')], [sensitive, ...VALUES])[0]!;
    expect(decision.sensitive).toBe(true);
  });

  it('marks password fields sensitive regardless of source', () => {
    const decision = mapFields(
      [field('Password', { type: 'password' })],
      [value('pw', 'hunter2')],
    )[0]!;
    expect(decision.sensitive).toBe(true);
  });

  it('treats checkboxes and radios as scalar text fields for matching', () => {
    const decision = mapFields(
      [field('Do you need visa sponsorship?', { type: 'radio' })],
      [value('sponsorship', 'Visa sponsorship', { value: 'yes', aliases: ['sponsorship'] })],
    )[0]!;
    expect(decision.value).not.toBeNull();
  });
});

describe('unresolvedRequired', () => {
  it('lists only required fields that remained unmapped', () => {
    const decisions = mapFields(
      [
        field('Full name'),
        field('Favorite color', { required: true }),
        field('Phone number', { required: false }),
      ],
      VALUES,
    );
    const unresolved = unresolvedRequired(decisions);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]!.field.label).toBe('Favorite color');
  });
});
