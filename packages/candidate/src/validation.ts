/**
 * Zod schemas for every user-authored candidate input. Values are normalized
 * (trimmed, whitespace-collapsed) at the schema layer and validated strictly —
 * services never accept raw shapes.
 */
import { z } from 'zod';
import { SourceType, SkillLevel } from '@jobs-app/database';
import { ValidationError } from '@jobs-app/shared';
import { normalizeWhitespace, normalizeRawText } from './text.js';

const Trimmed = (schema: z.ZodString, max: number) => schema.trim().max(max);
const OptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional();
const OptionalNullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === '' ? null : value))
    .optional();

const OptionalStringList = z.array(z.string().trim().min(1).max(120)).max(32).optional();
const OptionalNullableDate = z
  .union([z.literal(''), z.coerce.date().nullable()])
  .transform((value) => (value === '' ? null : value))
  .optional();

/** Single-line normalized string (collapses whitespace), e.g. a skill name. */
const NormalizedString = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .transform((value) => normalizeWhitespace(value));

/** Raw text that must preserve line breaks (evidence snippets, CV bodies). */
const RawText = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .transform((value) => normalizeRawText(value));

export const SkillLevelSchema = z.enum(Object.values(SkillLevel) as [SkillLevel, ...SkillLevel[]]);
export const SourceTypeSchema = z.enum(Object.values(SourceType) as [SourceType, ...SourceType[]]);

const optionalUuid = z.string().uuid().optional();

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const profileInputSchema = z
  .object({
    firstName: OptionalText(80),
    lastName: OptionalText(80),
    title: OptionalText(120),
    emails: OptionalStringList,
    phones: OptionalStringList,
    address: OptionalText(200),
    city: OptionalText(100),
    country: OptionalText(100),
    nationality: OptionalText(100),
    languages: z.array(z.string().trim().min(1).max(60)).max(24).optional(),
    workAuthorization: OptionalText(120),
    visaStatus: OptionalText(120),
    remotePreferred: z.boolean().optional(),
    relocationWilling: z.boolean().optional(),
    preferredLocations: OptionalStringList,
    targetRoles: OptionalStringList,
    expectedSalaryMin: z.number().int().min(0).max(100_000_000).optional(),
    expectedSalaryMax: z.number().int().min(0).max(100_000_000).optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code')
      .optional(),
  })
  .refine((p) => {
    if (p.expectedSalaryMin === undefined || p.expectedSalaryMax === undefined) return true;
    return p.expectedSalaryMin <= p.expectedSalaryMax;
  }, 'expectedSalaryMin must not exceed expectedSalaryMax');

export type ProfileInput = z.infer<typeof profileInputSchema>;

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

export const skillInputSchema = z.object({
  name: NormalizedString(1, 100),
  category: OptionalNullableText(60),
  level: SkillLevelSchema.default(SkillLevel.Intermediate),
  years: z.number().int().min(0).max(60).nullable().default(null),
  lastUsedYear: z.number().int().min(1950).max(2100).nullable().default(null),
  frequency: OptionalNullableText(40),
});
export type SkillInput = z.infer<typeof skillInputSchema>;

export const experienceInputSchema = z
  .object({
    organization: Trimmed(z.string(), 160),
    title: Trimmed(z.string(), 160),
    startDate: z.coerce.date(),
    endDate: OptionalNullableDate,
    current: z.boolean().default(false),
    location: OptionalNullableText(160),
    remote: z.boolean().optional(),
    summary: OptionalText(2000),
    technologies: OptionalStringList,
    responsibilities: z.array(z.string().trim().min(1).max(1000)).max(100).optional(),
    achievements: z.array(z.string().trim().min(1).max(1000)).max(100).optional(),
    evidenceId: optionalUuid,
    sortOrder: z.number().int().min(0).default(0),
  })
  .refine((e) => e.endDate === null || e.endDate === undefined || e.endDate >= e.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  })
  .transform((e) => (e.current ? { ...e, endDate: null } : e));
export type ExperienceInput = z.infer<typeof experienceInputSchema>;

export const projectInputSchema = z
  .object({
    name: Trimmed(z.string(), 160),
    role: OptionalNullableText(160),
    description: OptionalText(4000),
    technologies: OptionalStringList,
    achievements: z.array(z.string().trim().min(1).max(1000)).max(100).optional(),
    url: z.union([z.string().trim().url(), z.literal('')]).optional().nullable(),
    startDate: OptionalNullableDate,
    endDate: OptionalNullableDate,
    current: z.boolean().default(false),
    evidenceId: optionalUuid,
    sortOrder: z.number().int().min(0).default(0),
  })
  .refine((p) => p.endDate === null || p.endDate === undefined || p.startDate === null || p.startDate === undefined || p.endDate >= p.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  });
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const educationInputSchema = z
  .object({
    institution: Trimmed(z.string(), 200),
    degree: OptionalNullableText(160),
    field: OptionalNullableText(160),
    startDate: OptionalNullableDate,
    endDate: OptionalNullableDate,
    gpa: OptionalNullableText(20),
    notes: OptionalText(2000),
    evidenceId: optionalUuid,
    sortOrder: z.number().int().min(0).default(0),
  })
  .refine((e) => e.endDate === null || e.endDate === undefined || e.startDate === null || e.startDate === undefined || e.endDate >= e.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  });
export type EducationInput = z.infer<typeof educationInputSchema>;

export const certificationInputSchema = z.object({
  name: Trimmed(z.string(), 160),
  issuer: OptionalNullableText(160),
  issueDate: OptionalNullableDate,
  expiryDate: OptionalNullableDate,
  credentialUrl: OptionalNullableText(500),
  verificationStatus: OptionalNullableText(40),
  evidenceId: optionalUuid,
  sortOrder: z.number().int().min(0).default(0),
});
export type CertificationInput = z.infer<typeof certificationInputSchema>;

export const achievementInputSchema = z.object({
  title: Trimmed(z.string(), 200),
  category: OptionalNullableText(80),
  date: OptionalNullableDate,
  url: OptionalNullableText(500),
  description: OptionalText(2000),
  evidenceId: optionalUuid,
  sortOrder: z.number().int().min(0).default(0),
});
export type AchievementInput = z.infer<typeof achievementInputSchema>;

// ---------------------------------------------------------------------------
// Evidence & CV import
// ---------------------------------------------------------------------------

export const evidenceInputSchema = z.object({
  summary: OptionalText(300),
  rawText: RawText(5, 50_000),
  source: SourceTypeSchema.default(SourceType.UserProvided),
});
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;

export const cvImportInputSchema = z.object({
  profileId: optionalUuid,
  rawText: RawText(20, 200_000),
  sourceNote: OptionalText(300),
});
export type CvImportInput = z.infer<typeof cvImportInputSchema>;

/** A partial update of a profile facet; intended for single-field edits. */
export const facetUpdateSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Parse user input against a schema, throwing a semantic ValidationError with
 * a stable shape instead of zod's raw issues. Services always funnel input
 * through this helper.
 */
export function validateOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown, label = 'input'): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(`Invalid ${label}`, {
      details: {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }
  return result.data;
}