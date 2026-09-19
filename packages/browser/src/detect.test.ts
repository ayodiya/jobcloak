import { describe, expect, it } from 'vitest';
import type { ElementDatum } from './detect.js';
import {
  buildFields,
  inferType,
  isRequired,
  looksLikeQuestion,
  selectorFor,
} from './detect.js';

function datum(overrides: Partial<ElementDatum> & { tag: ElementDatum['tag'] }): ElementDatum {
  return {
    type: '',
    id: null,
    name: null,
    placeholder: null,
    ariaLabel: null,
    label: null,
    required: false,
    value: null,
    options: [],
    ...overrides,
  };
}

describe('inferType', () => {
  it('maps native input types', () => {
    expect(inferType({ tag: 'input', type: 'email', name: null, label: null })).toBe('email');
    expect(inferType({ tag: 'input', type: 'tel', name: 'phone', label: null })).toBe('tel');
    expect(inferType({ tag: 'input', type: 'url', name: null, label: null })).toBe('url');
    expect(inferType({ tag: 'input', type: 'password', name: null, label: null })).toBe(
      'password',
    );
    expect(inferType({ tag: 'input', type: 'file', name: null, label: null })).toBe('file');
    expect(inferType({ tag: 'input', type: 'checkbox', name: null, label: null })).toBe(
      'checkbox',
    );
    expect(inferType({ tag: 'input', type: 'radio', name: null, label: null })).toBe('radio');
    expect(inferType({ tag: 'select', type: '', name: null, label: null })).toBe('select');
  });

  it('infers email/tel/url from name or label text', () => {
    expect(inferType({ tag: 'input', type: 'text', name: 'work_email', label: null })).toBe(
      'email',
    );
    expect(inferType({ tag: 'input', type: 'text', name: null, label: 'Cell phone' })).toBe(
      'tel',
    );
    expect(
      inferType({ tag: 'input', type: 'text', name: null, label: 'LinkedIn profile' }),
    ).toBe('url');
  });

  it('defaults plain inputs to text', () => {
    expect(
      inferType({ tag: 'input', type: 'text', name: 'first_name', label: 'First name' }),
    ).toBe('text');
    expect(inferType({ tag: 'textarea', type: '', name: null, label: null })).toBe('textarea');
  });
});

describe('isRequired', () => {
  it('honours the required attribute and trailing asterisk', () => {
    expect(isRequired({ type: 'text', label: null, required: true })).toBe(true);
    expect(isRequired({ type: 'text', label: 'Full name *', required: false })).toBe(true);
    expect(isRequired({ type: 'text', label: 'Full name', required: false })).toBe(false);
  });
});

describe('looksLikeQuestion', () => {
  it('flags open-ended why/how text, excludes boilerplate', () => {
    expect(looksLikeQuestion('textarea', 'Why do you want to work here?', null)).toBe(true);
    expect(looksLikeQuestion('text', 'Tell us about yourself', null)).toBe(true);
    expect(looksLikeQuestion('textarea', 'Summary', null)).toBe(false);
    expect(looksLikeQuestion('text', 'First name', null)).toBe(false);
  });
});

describe('selectorFor', () => {
  it('prefers id, then name, then aria-label, then ordinal', () => {
    expect(selectorFor(datum({ tag: 'input', id: 'email', name: 'email' }), 3)).toBe(
      'input[id="email"]',
    );
    expect(selectorFor(datum({ tag: 'input', id: null, name: 'phone' }), 3)).toBe(
      'input[name="phone"]',
    );
    expect(selectorFor(datum({ tag: 'input', name: null, ariaLabel: 'City' }), 3)).toBe(
      'input[aria-label="City"]',
    );
    expect(selectorFor(datum({ tag: 'textarea' }), 3)).toBe('textarea:nth-of-type(3)');
  });
});

describe('buildFields', () => {
  it('builds a labelled required text field', () => {
    const fields = buildFields([
      datum({
        tag: 'input',
        type: 'text',
        id: 'first',
        name: 'first_name',
        label: 'First name *',
        required: true,
      }),
    ]);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      type: 'text',
      label: 'First name *',
      required: true,
      isQuestion: false,
      name: 'first_name',
    });
  });

  it('groups radio inputs by name into one field with options', () => {
    const fields = buildFields([
      datum({
        tag: 'input',
        type: 'radio',
        name: 'sponsorship',
        label: 'I need visa sponsorship',
        value: 'yes',
      }),
      datum({
        tag: 'input',
        type: 'radio',
        name: 'sponsorship',
        label: 'I do not need sponsorship',
        value: 'no',
      }),
      datum({ tag: 'input', type: 'text', name: 'full_name', label: 'Who should we contact?' }),
    ]);
    const radio = fields.find((field) => field.type === 'radio');
    expect(radio).toMatchObject({
      selector: 'input[name="sponsorship"]',
      group: 'sponsorship',
      options: [
        { value: 'yes', label: 'I need visa sponsorship' },
        { value: 'no', label: 'I do not need sponsorship' },
      ],
    });
    expect(fields).toHaveLength(2);
  });

  it('keeps checkboxes as standalone fields', () => {
    const fields = buildFields([
      datum({
        tag: 'input',
        type: 'checkbox',
        name: 'privacy',
        label: 'I agree to the privacy policy',
        required: true,
      }),
    ]);
    expect(fields[0]).toMatchObject({ type: 'checkbox', required: true, group: 'privacy' });
  });

  it('skips hidden, submit and button inputs', () => {
    const fields = buildFields([
      datum({ tag: 'input', type: 'hidden', name: 'csrf' }),
      datum({ tag: 'input', type: 'submit', name: 'go' }),
      datum({ tag: 'input', type: 'text', name: 'q', label: 'Search' }),
    ]);
    expect(fields).toHaveLength(1);
  });

  it('carries select options', () => {
    const fields = buildFields([
      datum({
        tag: 'select',
        name: 'country',
        label: 'Country',
        options: [
          { value: 'de', label: 'Germany' },
          { value: 'us', label: 'United States' },
        ],
      }),
    ]);
    expect(fields[0]).toMatchObject({
      type: 'select',
      options: [
        { value: 'de', label: 'Germany' },
        { value: 'us', label: 'United States' },
      ],
    });
  });
});
