import { NotFoundError, ValidationError } from '@jobs-app/shared';
import { describe, expect, it } from 'vitest';
import { PromptManager } from './PromptManager.js';

function manager(): PromptManager {
  const prompts = new PromptManager();
  prompts.register({ id: 'extract', version: 1, template: 'Extract from {{ text }}' });
  prompts.register({ id: 'extract', version: 2, template: 'Strictly extract from {{ text }} at {{ level }}' });
  return prompts;
}

describe('PromptManager', () => {
  it('returns the latest version by default and a pinned version on request', () => {
    const prompts = manager();
    expect(prompts.get('extract').version).toBe(2);
    expect(prompts.get('extract', 1).version).toBe(1);
  });

  it('lists versions ascending', () => {
    expect(manager().versions('extract')).toEqual([1, 2]);
  });

  it('renders the latest template by default', () => {
    expect(manager().render('extract', { text: 'cv', level: 'high' })).toBe(
      'Strictly extract from cv at high',
    );
  });

  it('renders a pinned version', () => {
    expect(manager().render('extract', { text: 'cv', level: 'high' }, 1)).toBe('Extract from cv');
  });

  it('throws when a placeholder has no value', () => {
    expect(() => manager().render('extract', { text: 'cv' })).toThrow(ValidationError);
  });

  it('throws for an unknown prompt id', () => {
    expect(() => manager().get('missing')).toThrow(NotFoundError);
  });

  it('throws for an unknown version', () => {
    expect(() => manager().get('extract', 99)).toThrow(NotFoundError);
  });

  it('rejects duplicate versions', () => {
    const prompts = manager();
    expect(() => prompts.register({ id: 'extract', version: 1, template: 'x' })).toThrow(
      ValidationError,
    );
  });

  it('rejects invalid ids, versions and empty templates', () => {
    const prompts = new PromptManager();
    expect(() => prompts.register({ id: 'bad id', version: 1, template: 'x' })).toThrow(ValidationError);
    expect(() => prompts.register({ id: 'ok', version: 0, template: 'x' })).toThrow(ValidationError);
    expect(() => prompts.register({ id: 'ok2', version: 1, template: '  ' })).toThrow(ValidationError);
  });

  it('reports presence and lists all templates', () => {
    const prompts = manager();
    expect(prompts.has('extract')).toBe(true);
    expect(prompts.has('missing')).toBe(false);
    expect(prompts.list().map((t) => t.version)).toEqual([1, 2]);
  });
});
