import { NotFoundError, ValidationError } from '@jobs-app/shared';

export interface PromptTemplate {
  id: string;
  /** Monotonic per-id version. Recorded so generated output is reproducible. */
  version: number;
  template: string;
  description?: string;
}

export type PromptVariables = Record<string, string | number | boolean | null | undefined>;

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

/**
 * Registry of versioned prompt templates.
 *
 * Prompts are data, not code: templates are registered by id+version, the
 * latest version is used unless a caller pins an explicit one, and rendering
 * never silently leaves a `{{placeholder}}` unresolved. Pinning supports the
 * ADR-0005 requirement that generated material is reproducible.
 */
export class PromptManager {
  private readonly templates = new Map<string, Map<number, PromptTemplate>>();

  register(template: PromptTemplate): void {
    if (!ID_PATTERN.test(template.id)) {
      throw new ValidationError(`Invalid prompt id: ${template.id}`);
    }
    if (!Number.isInteger(template.version) || template.version < 1) {
      throw new ValidationError(`Prompt version must be a positive integer for ${template.id}`);
    }
    if (template.template.trim().length === 0) {
      throw new ValidationError(`Prompt template must not be empty for ${template.id}`);
    }

    const versions = this.templates.get(template.id) ?? new Map<number, PromptTemplate>();
    if (versions.has(template.version)) {
      throw new ValidationError(
        `Prompt ${template.id} already has version ${template.version}`,
      );
    }
    versions.set(template.version, template);
    this.templates.set(template.id, versions);
  }

  /** True when an id has at least one registered version. */
  has(id: string): boolean {
    return this.templates.has(id);
  }

  /** Latest version by default, or an explicit pinned version. */
  get(id: string, version?: number): PromptTemplate {
    const versions = this.templates.get(id);
    if (!versions || versions.size === 0) {
      throw new NotFoundError(`Unknown prompt: ${id}`);
    }
    if (version !== undefined) {
      const template = versions.get(version);
      if (!template) {
        throw new NotFoundError(`Unknown prompt version: ${id}@${version}`);
      }
      return template;
    }
    const latest = Math.max(...versions.keys());
    // latest is guaranteed present because size > 0
    return versions.get(latest) as PromptTemplate;
  }

  /** Ascending list of registered versions for an id. */
  versions(id: string): number[] {
    const versions = this.templates.get(id);
    if (!versions || versions.size === 0) {
      throw new NotFoundError(`Unknown prompt: ${id}`);
    }
    return [...versions.keys()].sort((a, b) => a - b);
  }

  list(): PromptTemplate[] {
    return [...this.templates.values()]
      .flatMap((versions) => [...versions.values()])
      .sort((a, b) => a.id.localeCompare(b.id) || a.version - b.version);
  }

  /**
   * Render a template with `{{var}}` substitution. Missing values throw
   * rather than producing a partially-substituted prompt.
   */
  render(id: string, variables: PromptVariables = {}, version?: number): string {
    const { template } = this.get(id, version);
    const missing: string[] = [];

    const rendered = template.replace(PLACEHOLDER, (_match, name: string) => {
      const value = variables[name];
      if (value === undefined || value === null) {
        missing.push(name);
        return _match;
      }
      return String(value);
    });

    if (missing.length > 0) {
      throw new ValidationError(
        `Missing variables for prompt ${id}: ${[...new Set(missing)].join(', ')}`,
        { details: { promptId: id, missing } },
      );
    }

    return rendered;
  }
}
