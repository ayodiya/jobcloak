import type { FormField, MappingConfidence, MappingDecision } from './types.js';

/** A value the caller is willing to put into a form. Keys/labels drive matching. */
export interface AvailableValue {
  key: string;
  label: string;
  value: string;
  /** Backup keywords used to match field labels. */
  aliases?: string[];
  /** Value must never appear in audit events. */
  sensitive?: boolean;
}

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'your',
  'you',
  'for',
  'of',
  'to',
  'and',
  'in',
  'on',
  'at',
  'please',
  'enter',
  'provide',
  'current',
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

const TYPE_HINTS: Record<FormField['type'], string> = {
  text: '',
  textarea: '',
  email: 'email',
  tel: 'phone',
  url: 'url website',
  date: 'date',
  number: 'number',
  file: 'file',
  select: '',
  checkbox: '',
  radio: '',
  password: '',
  unknown: '',
};

function scoreFieldValue(field: FormField, value: AvailableValue): number {
  const fieldText = `${field.label} ${field.placeholder ?? ''} ${field.name ?? ''} ${TYPE_HINTS[field.type]}`;
  const normalizedField = fieldText.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedValue = value.label.toLowerCase().replace(/\s+/g, ' ').trim();
  const fieldTokens = tokens(normalizedField);
  const valueTokens = tokens(`${value.label} ${(value.aliases ?? []).join(' ')}`);

  if (normalizedField === normalizedValue) return 100;

  const fieldSet = new Set(fieldTokens);
  const valueSet = new Set(valueTokens);
  const shared = fieldTokens.filter((token) => valueSet.has(token));
  const sharedSet = new Set(shared);

  if (fieldTokens.length > 0 && fieldTokens.every((token) => sharedSet.has(token))) return 95;
  if (valueTokens.length > 1 && valueTokens.every((token) => fieldSet.has(token))) return 85;

  const strongShared = Array.from(sharedSet).filter((token) => token.length >= 3).length;
  if (field.type === 'email' && value.label.toLowerCase().includes('email')) return 80;
  if (field.type === 'tel' && /phone|telephone|mobile/.test(value.label.toLowerCase()))
    return 80;
  if (
    field.type === 'url' &&
    /website|linkedin|portfolio|github/.test(value.label.toLowerCase())
  )
    return 80;
  if (strongShared >= 2) return 80;
  if (strongShared === 1) return 60;

  return 0;
}

function confidenceFromScore(score: number): MappingConfidence {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'none';
}

/**
 * Deterministic field to value mapping. Never fabricates: a field with no
 * matching value yields `value: null` and `confidence: 'none'` so the caller
 * must stop for a human instead of inventing an answer.
 */
export function mapFields(
  fields: readonly FormField[],
  values: readonly AvailableValue[],
): MappingDecision[] {
  return fields.map((field) => {
    if (field.type === 'checkbox' || field.type === 'radio' || field.type === 'file') {
      const decision = mapFields([{ ...field, type: 'text' }], values)[0]!;
      return { ...decision, field };
    }

    let best: AvailableValue | null = null;
    let bestScore = 0;
    for (const value of values) {
      const score = scoreFieldValue(field, value);
      if (score > bestScore) {
        bestScore = score;
        best = value;
      }
    }

    if (!best || bestScore === 0) {
      return {
        field,
        value: null,
        sourceKey: null,
        confidence: confidenceFromScore(0),
        sensitive: field.type === 'password' || field.type === 'textarea',
        reason:
          'No available value maps to this field; refusing to fabricate.' +
          (field.required ? ' Required field needs human input.' : ''),
      };
    }

    const confidence = confidenceFromScore(bestScore);
    return {
      field,
      value: best.value,
      sourceKey: best.key,
      confidence,
      sensitive:
        Boolean(best.sensitive) || field.type === 'password' || field.type === 'textarea',
      reason:
        confidence === 'high'
          ? `Confident match on value "${best.label}".`
          : `Partial match on value "${best.label}". Review before submitting.`,
    };
  });
}

/** Unresolved *required* fields (nothing mapped) — these always need a human. */
export function unresolvedRequired(decisions: readonly MappingDecision[]): MappingDecision[] {
  return decisions.filter(
    (decision) =>
      decision.field.required && decision.value === null && decision.confidence === 'none',
  );
}
