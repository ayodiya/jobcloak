import type { LLMProvider } from '@jobs-app/ai';
import { AIProviderError, AIValidationError } from '@jobs-app/shared';
import { z } from 'zod';
import { normalizeRequirementKey } from './requirements.js';
import type { JobRequirementInput } from './types.js';

const AiRequirementsSchema = z.object({
  requirements: z
    .array(
      z.object({
        kind: z.enum(['Required', 'Preferred', 'NiceToHave']),
        category: z.enum([
          'Skill',
          'Experience',
          'Education',
          'Certification',
          'Language',
          'Other',
        ]),
        name: z.string().min(1),
        minYears: z.number().int().positive().max(40).optional(),
        level: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .max(100),
});

export type AiRequirements = z.infer<typeof AiRequirementsSchema>;

export interface AiRequirementExtractionOptions {
  provider: LLMProvider;
  model?: string;
  system?: string;
}

export function buildRequirementPrompt(
  description: string,
  deterministic: JobRequirementInput[],
): string {
  const known = deterministic.map((req) => `- [${req.kind}/${req.category}] ${req.name}`).join('\n');
  return [
    'Extract the job requirements from the listing as structured JSON.',
    'Only include requirements explicitly supported by the text.',
    'Return {"requirements":[{"kind","category","name","minYears?","level?","confidence?"}]}',
    'kind is Required | Preferred | NiceToHave; category is Skill | Experience | Education | Certification | Language | Other.',
    'Do NOT repeat requirements the deterministic parser already found:',
    known.length > 0 ? known : '(none)',
    '',
    'Listing:',
    description.slice(0, 8000),
  ].join('\n');
}

/**
 * AI-assisted requirement extraction, merged *under* the deterministic result:
 * deterministic entries always win; the model can only contribute new keys.
 * If the provider is unavailable or returns invalid output, the deterministic
 * result is returned unchanged.
 */
export async function extractRequirementsWithAI(
  description: string,
  deterministic: JobRequirementInput[],
  options: AiRequirementExtractionOptions,
): Promise<JobRequirementInput[]> {
  let ai: AiRequirements;
  try {
    ai = await options.provider.structured({
      prompt: buildRequirementPrompt(description, deterministic),
      schema: AiRequirementsSchema,
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.system !== undefined ? { system: options.system } : {}),
    });
  } catch (error) {
    if (error instanceof AIProviderError || error instanceof AIValidationError) {
      return deterministic;
    }
    throw error;
  }

  const merged = [...deterministic];
  const seen = new Set(deterministic.map((req) => `${req.kind}|${req.category}|${req.key}`));

  for (const requirement of ai.requirements) {
    const key = normalizeRequirementKey(requirement.name);
    const dedupeKey = `${requirement.kind}|${requirement.category}|${key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push({
      kind: requirement.kind,
      category: requirement.category,
      key,
      name: requirement.name,
      ...(requirement.minYears !== undefined ? { minYears: requirement.minYears } : {}),
      ...(requirement.level !== undefined ? { level: requirement.level } : {}),
      ...(requirement.confidence !== undefined ? { confidence: requirement.confidence } : {}),
      source: 'AI',
    });
  }

  return merged;
}
