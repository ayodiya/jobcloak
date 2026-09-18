import { describe, expect, it } from 'vitest';
import { normalizeRawText, normalizeText, normalizeWhitespace, splitLines, splitListItems, toSkillKey } from './text.js';

describe('text helpers', () => {
  it('collapses whitespace runs and trims', () => {
    expect(normalizeWhitespace('  Node.js\t\t and   TypeScript  ')).toBe('Node.js and TypeScript');
  });

  it('normalizes line endings and blank-line runs', () => {
    const input = 'A\r\nB\rC\n\n\n\nD';
    expect(normalizeText(input)).toBe('A\nB\nC\n\nD');
  });

  it('preserves line breaks in raw text while trimming', () => {
    expect(normalizeRawText('  Summary   \n\n\n\nSkills\n  TS  ')).toBe('Summary\n\nSkills\n  TS');
  });

  it('builds a stable skill key', () => {
    expect(toSkillKey('  Node.JS  ')).toBe('node.js');
  });

  it('splits bullet and comma separated lists', () => {
    expect(splitListItems('• TypeScript, Node.js; React | Docker')).toEqual(['TypeScript', 'Node.js', 'React', 'Docker']);
  });

  it('splits lines without flattening content', () => {
    expect(splitLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });
});
