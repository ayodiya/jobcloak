/** Small, pure text helpers shared by validation and the CV parser. */

/** Collapse all whitespace runs to a single space and trim. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Normalize line endings, strip BOM and collapse 3+ blank lines to one. */
export function normalizeText(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normalizer for raw document text (evidence snippets, CV bodies): preserves
 * line breaks and collapses inline run-on blank lines only.
 */
export function normalizeRawText(value: string): string {
  return normalizeText(value)
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Deterministic deduplication key for a skill name: trimmed, lowercased. */
export function toSkillKey(name: string): string {
  return normalizeWhitespace(name).toLowerCase();
}

/** Split a free-form line of comma/semicolon/bullet separated items. */
export function splitListItems(line: string): string[] {
  const stripBullet = (item: string) => item.replace(/^[-–—*•·o]+\s*/u, '');
  return line
    .split(/[,;|•··/]+/u)
    .map((item) => normalizeWhitespace(stripBullet(item)))
    .filter((item) => item.length > 0);
}

/** Lines split on any line ending. */
export function splitLines(text: string): string[] {
  return normalizeText(text).split('\n');
}