import type { Page } from 'playwright';
import type { FormField, FormFieldType, SelectOption } from './types.js';

/** JSON-safe per-element data harvested from the DOM via `evaluateAll`. */
export interface ElementDatum {
  tag: 'input' | 'textarea' | 'select';
  type: string;
  id: string | null;
  name: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  label: string | null;
  required: boolean;
  value: string | null;
  options: { value: string; label: string }[];
}

const QUESTION_MARKERS =
  /\b(why|how|describe|tell us|what (makes|would|are)|explain|summarize|walk me through|greatest (strength|accomplishment)|most (challenging|interesting|proud))\b/i;

const NOT_QUESTION =
  /(^|\s)(summary|bio|notes?|comments?|additional information|custom message)(\s|$)/i;

/** Map an input/textarea/select to our field-type taxonomy. */
export function inferType(
  input: Pick<ElementDatum, 'tag' | 'type' | 'name' | 'label'>,
): FormFieldType {
  if (input.tag === 'select') return 'select';
  switch (input.type) {
    case 'email':
      return 'email';
    case 'tel':
      return 'tel';
    case 'url':
      return 'url';
    case 'date':
      return 'date';
    case 'number':
      return 'number';
    case 'password':
      return 'password';
    case 'file':
      return 'file';
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radio';
  }
  const name = (input.name ?? '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  const text = `${name} ${input.label ?? ''}`.toLowerCase();
  if (/\bemail\b/.test(text)) return 'email';
  if (/\b(phone|telephone|mobile|cell)\b/.test(text)) return 'tel';
  if (/\b(linkedin|website|portfolio|github|url)\b/.test(text)) return 'url';
  if (/\bdate\b/.test(text)) return 'date';
  if (/\b(years?|budget|amount|salary)\b/.test(text)) return 'number';
  if (input.tag === 'textarea') return 'textarea';
  return 'text';
}

/** Determine whether the element is labelled as required. */
export function isRequired(attrs: {
  type: string;
  label: string | null;
  required: boolean;
}): boolean {
  if (attrs.required) return true;
  if (!attrs.label) return false;
  return /\*\s*$/.test(attrs.label.trim()) || /\bread\s*required\b/i.test(attrs.label);
}

/** Open-ended fields are candidate questions; known boilerplate is not. */
export function looksLikeQuestion(
  type: FormFieldType,
  label: string,
  placeholder: string | null,
): boolean {
  if (NOT_QUESTION.test(label)) return false;
  if (type === 'textarea') return label.length >= 8 || Boolean(placeholder);
  const text = `${label} ${placeholder ?? ''}`;
  return text.length >= 14 && QUESTION_MARKERS.test(text);
}

function quoteCss(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Conservative, stable selector for reuse within the same session. */
export function selectorFor(datum: ElementDatum, ordinal: number): string {
  if (datum.id) return `${datum.tag}[id=${quoteCss(datum.id)}]`;
  if (datum.name) return `${datum.tag}[name=${quoteCss(datum.name)}]`;
  if (datum.ariaLabel) return `${datum.tag}[aria-label=${quoteCss(datum.ariaLabel)}]`;
  return `${datum.tag}:nth-of-type(${ordinal})`;
}

function groupLabel(datum: ElementDatum, name: string): string {
  return (
    datum.label ??
    datum.ariaLabel ??
    datum.placeholder ??
    (name ? `Group ${name}` : 'Radio group')
  );
}

/**
 * Pure builder: turns a DOM harvest into session `FormField`s. Radio inputs are
 * grouped by `name` into one field with its options; selects carry their
 * `<option>` labels/values. Unit-testable without a browser.
 */
export function buildFields(datums: readonly ElementDatum[]): FormField[] {
  const fields: FormField[] = [];
  const keySeen = new Set<string>();

  const pushField = (field: Omit<FormField, 'key'>): void => {
    let key = `f-${fields.length}`;
    let suffix = 1;
    while (keySeen.has(key)) key = `f-${fields.length}-${(suffix += 1)}`;
    keySeen.add(key);
    fields.push({ ...field, key });
  };

  const radioGroups = new Map<string, { datums: ElementDatum[]; ordinal: number }[]>();

  for (let i = 0; i < datums.length; i += 1) {
    const datum = datums[i]!;
    if (datum.tag === 'input') {
      if (
        datum.type === 'hidden' ||
        datum.type === 'submit' ||
        datum.type === 'button' ||
        datum.type === 'reset' ||
        datum.type === 'image'
      ) {
        continue;
      }
      if (datum.type === 'radio') {
        const key = datum.name ?? `radio-${i}`;
        const bucket = radioGroups.get(key) ?? [];
        bucket.push({ datums: [datum], ordinal: i });
        radioGroups.set(key, bucket);
        continue;
      }
    }
    if (datum.tag === 'input' && datum.type === 'checkbox') {
      const label = datum.label ?? datum.ariaLabel ?? datum.name ?? 'Checkbox';
      pushField({
        selector: selectorFor(datum, i + 1),
        name: datum.name,
        label,
        type: 'checkbox',
        required: isRequired({ type: datum.type, label, required: datum.required }),
        options: [],
        placeholder: datum.placeholder,
        isQuestion: false,
        group: datum.name ?? null,
      });
      continue;
    }

    const type = inferType(datum);
    const label =
      datum.label ?? datum.ariaLabel ?? datum.placeholder ?? datum.name ?? '(unnamed)';
    pushField({
      selector: selectorFor(datum, i + 1),
      name: datum.name,
      label,
      type,
      required: isRequired({ type: datum.type, label, required: datum.required }),
      options:
        type === 'select'
          ? datum.options.map((option) => ({ value: option.value, label: option.label }))
          : [],
      placeholder: datum.placeholder,
      isQuestion: looksLikeQuestion(type, label, datum.placeholder),
      group: null,
    });
  }

  for (const [name, groups] of radioGroups) {
    const members = groups.flatMap((group) => group.datums);
    const options: SelectOption[] = [];
    for (const member of members) {
      const own = member.options[0];
      if (own) {
        options.push({ value: own.value, label: own.label });
      } else {
        options.push({ value: member.value ?? '', label: member.label ?? '' });
      }
    }
    const first = members[0]!;
    const label = groupLabel(first, name);
    pushField({
      selector: `input[name=${quoteCss(name)}]`,
      name,
      label,
      type: 'radio',
      required: members.some((member) =>
        isRequired({
          type: member.type,
          label: groupLabel(member, name),
          required: member.required,
        }),
      ),
      options,
      placeholder: null,
      isQuestion: false,
      group: name,
    });
  }

  return fields;
}

/**
 * Playwright-backed form harvest. Reads every visible input/textarea/select in
 * the page, computes labels in the DOM, and returns pure `ElementDatum`s.
 */
export function harvestForm(page: Page): Promise<ElementDatum[]> {
  return page
    .locator('input, textarea, select')
    .filter({ visible: true })
    .evaluateAll((elements): ElementDatum[] =>
      elements.slice(0, 200).map((element) => {
        const input = element as HTMLInputElement;
        const tag = (
          element.tagName.toLowerCase() === 'textarea'
            ? 'textarea'
            : element.tagName.toLowerCase() === 'select'
              ? 'select'
              : 'input'
        ) as 'input' | 'textarea' | 'select';

        const labelText = (el: Element): string | null => {
          const text = el.textContent?.trim() ?? '';
          return text.length > 0 ? text.replace(/\s+/g, ' ') : null;
        };

        let ownLabel: string | null = null;
        if (element.id) {
          const escapedId = element.id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const forLabel = document.querySelector(`label[for="${escapedId}"]`);
          if (forLabel) ownLabel = labelText(forLabel);
        }
        if (!ownLabel) {
          const parentLabel = element.closest('label');
          if (parentLabel) ownLabel = labelText(parentLabel);
        }
        let label = ownLabel;
        if (input.type === 'radio') {
          const legend = element.closest('fieldset')?.querySelector('legend');
          if (legend) label = labelText(legend);
        }

        let options: { value: string; label: string }[] = [];
        if (tag === 'select') {
          options = Array.from((element as HTMLSelectElement).options).map((option) => ({
            value: option.value,
            label: option.text.trim(),
          }));
        } else if (input.type === 'radio') {
          options = [{ value: input.value, label: ownLabel ?? '' }];
        }

        return {
          tag,
          type: tag === 'input' ? input.type : '',
          id: element.id || null,
          name: input.name || null,
          placeholder: input.getAttribute('placeholder'),
          ariaLabel: element.getAttribute('aria-label'),
          label: label ?? null,
          required:
            element.hasAttribute('required') ||
            element.getAttribute('aria-required') === 'true',
          value: input.value,
          options,
        };
      }),
    );
}
