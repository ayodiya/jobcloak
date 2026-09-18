import { AIValidationError } from '@jobs-app/shared';
import type { z } from 'zod';

/**
 * Extracts the first balanced JSON object/array from model text.
 *
 * Small local models frequently wrap JSON in prose or markdown fences, e.g.
 * "Sure! Here is the JSON:\n```json\n{...}\n```". This scans for the first
 * `{`/`[` and tracks nesting, string literals and escapes so braces inside
 * string values do not terminate the fragment early.
 */
export function extractJsonFragment(text: string): string | undefined {
  const start = findJsonStart(text);
  if (start === -1) return undefined;

  const open = text.charAt(start);
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text.charAt(i);

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return undefined;
}

function findJsonStart(text: string): number {
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  if (objectStart === -1) return arrayStart;
  if (arrayStart === -1) return objectStart;
  return Math.min(objectStart, arrayStart);
}

/**
 * Best-effort JSON parse of model text: strict parse first, then a balanced
 * fragment extracted from surrounding prose/fences. Throws `AIValidationError`
 * (never returns undefined) when no JSON can be recovered.
 */
export function parseLooseJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new AIValidationError('Model returned an empty response where JSON was expected');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to fragment extraction
  }

  const fragment = extractJsonFragment(trimmed);
  if (fragment !== undefined) {
    try {
      return JSON.parse(fragment);
    } catch {
      // fall through to the error below
    }
  }

  throw new AIValidationError('Model response did not contain parseable JSON', {
    details: { preview: preview(text) },
  });
}

/** Parse model text and validate it against a Zod schema. */
export function parseStructuredOutput<S extends z.ZodTypeAny>(text: string, schema: S): z.output<S> {
  const json = parseLooseJson(text);
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new AIValidationError(formatZodIssues(result.error), {
      details: { issues: result.error.issues, preview: preview(text) },
    });
  }
  return result.data;
}

/** Human-readable zod issue summary, suitable for logs and corrective prompts. */
export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

/**
 * Corrective message appended after a failed structured attempt so the model
 * can repair its own output. Includes the validation error and a bounded
 * preview of the invalid output.
 */
export function buildJsonCorrectionMessage(invalidOutput: string, errorMessage: string): string {
  return [
    'Your previous response was not valid for the required JSON schema.',
    `Error: ${errorMessage}`,
    'Previous response (truncated):',
    '```',
    preview(invalidOutput),
    '```',
    'Reply with ONLY a corrected, complete JSON value. No prose, no markdown fences.',
  ].join('\n');
}

function preview(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
