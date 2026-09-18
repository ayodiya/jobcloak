/**
 * Candidate profile service: the single entry point apps use to read and
 * maintain the candidate profile and its facets. All input is validated and
 * normalized; the repository persists. Single-profile operations assume the
 * local-first model (at most one candidate profile).
 */
import type { Prisma } from '@jobs-app/database';
import { ConflictError, NotFoundError } from '@jobs-app/shared';
import type {
  AchievementEntry,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  Skill,
} from '@jobs-app/database';
import { toSkillKey } from './text.js';
import { CandidateRepository } from './repository.js';
import { EvidenceService } from './evidence-service.js';
import { CvImportService } from './cv-import-service.js';
import {
  achievementInputSchema,
  certificationInputSchema,
  educationInputSchema,
  experienceInputSchema,
  profileInputSchema,
  projectInputSchema,
  skillInputSchema,
  validateOrThrow,
  type AchievementInput,
  type CertificationInput,
  type EducationInput,
  type ExperienceInput,
  type ProfileInput,
  type ProjectInput,
  type SkillInput,
} from './validation.js';

type IncludeSkills = Prisma.CandidateProfileGetPayload<{ include: { skills: true } }>;

export interface CandidateServiceDeps {
  repository?: CandidateRepository;
  evidence?: EvidenceService;
}

export class CandidateService {
  private readonly repo: CandidateRepository;
  private readonly evidence: EvidenceService;
  private readonly cvImports: CvImportService;

  constructor(deps: CandidateServiceDeps = {}) {
    this.repo = deps.repository ?? new CandidateRepository();
    this.evidence = deps.evidence ?? new EvidenceService(this.repo);
    this.cvImports = new CvImportService(this.repo);
  }

  get evidenceService(): EvidenceService {
    return this.evidence;
  }

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------

  getProfile(): Promise<IncludeSkills | null> {
    return this.repo.findProfile();
  }

  async getProfileOrThrow(): Promise<IncludeSkills> {
    const profile = await this.repo.findProfile();
    if (!profile) throw new NotFoundError('CandidateProfile not found. Create a profile first.');
    return profile;
  }

  async ensureProfile(input: unknown = {}): Promise<IncludeSkills> {
    const existing = await this.repo.findProfile();
    if (existing) return existing;
    const data = validateOrThrow(profileInputSchema, input, 'profile');
    return this.repo.createProfile(data);
  }

  async updateProfile(input: unknown): Promise<IncludeSkills> {
    const existing = await this.repo.findProfile();
    if (!existing) throw new NotFoundError('CandidateProfile not found. Create a profile first.');
    const data = validateOrThrow(profileInputSchema, input, 'profile');
    return this.repo.updateProfile(existing.id, data);
  }

  async deleteProfile(): Promise<void> {
    const existing = await this.repo.findProfile();
    if (!existing) throw new NotFoundError('CandidateProfile not found.');
    await this.repo.deleteProfile(existing.id);
  }

  private async requireProfileId(): Promise<string> {
    const profile = await this.repo.findProfile();
    if (!profile) throw new NotFoundError('CandidateProfile not found. Create a profile first.');
    return profile.id;
  }

  // -------------------------------------------------------------------------
  // Skills
  // -------------------------------------------------------------------------

  async addSkill(profileId: string, input: unknown): Promise<Skill> {
    const data = validateOrThrow(skillInputSchema, input, 'skill');
    return this.repo.createSkill(profileId, { ...data, key: toSkillKey(data.name) });
  }

  listSkills(profileId: string): Promise<Skill[]> {
    return this.repo.listSkills(profileId);
  }

  async updateSkill(id: string, input: unknown): Promise<Skill> {
    const data = validateOrThrow(skillInputSchema, input, 'skill');
    return this.repo.updateSkill(id, { ...data, key: toSkillKey(data.name) });
  }

  removeSkill(id: string): Promise<void> {
    return this.repo.removeSkill(id);
  }

  // -------------------------------------------------------------------------
  // Experience
  // -------------------------------------------------------------------------

  addExperience(profileId: string, input: unknown): Promise<ExperienceEntry> {
    const data = validateOrThrow(experienceInputSchema, input, 'experience');
    return this.repo.createExperience(profileId, withCurrentEndDate(data));
  }

  listExperience(profileId: string): Promise<ExperienceEntry[]> {
    return this.repo.listExperience(profileId);
  }

  updateExperience(id: string, input: unknown): Promise<ExperienceEntry> {
    const data = validateOrThrow(experienceInputSchema, input, 'experience');
    return this.repo.updateExperience(id, withCurrentEndDate(data));
  }

  removeExperience(id: string): Promise<void> {
    return this.repo.removeExperience(id);
  }

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  addProject(profileId: string, input: unknown): Promise<ProjectEntry> {
    const data = validateOrThrow(projectInputSchema, input, 'project');
    return this.repo.createProject(profileId, withNullableEnds(data));
  }

  listProjects(profileId: string): Promise<ProjectEntry[]> {
    return this.repo.listProjects(profileId);
  }

  updateProject(id: string, input: unknown): Promise<ProjectEntry> {
    const data = validateOrThrow(projectInputSchema, input, 'project');
    return this.repo.updateProject(id, withNullableEnds(data));
  }

  removeProject(id: string): Promise<void> {
    return this.repo.removeProject(id);
  }

  // -------------------------------------------------------------------------
  // Education
  // -------------------------------------------------------------------------

  addEducation(profileId: string, input: unknown): Promise<EducationEntry> {
    const data = validateOrThrow(educationInputSchema, input, 'education');
    return this.repo.createEducation(profileId, data);
  }

  listEducation(profileId: string): Promise<EducationEntry[]> {
    return this.repo.listEducation(profileId);
  }

  updateEducation(id: string, input: unknown): Promise<EducationEntry> {
    const data = validateOrThrow(educationInputSchema, input, 'education');
    return this.repo.updateEducation(id, data);
  }

  removeEducation(id: string): Promise<void> {
    return this.repo.removeEducation(id);
  }

  // -------------------------------------------------------------------------
  // Certifications
  // -------------------------------------------------------------------------

  addCertification(profileId: string, input: unknown): Promise<CertificationEntry> {
    const data = validateOrThrow(certificationInputSchema, input, 'certification');
    return this.repo.createCertification(profileId, data);
  }

  listCertifications(profileId: string): Promise<CertificationEntry[]> {
    return this.repo.listCertifications(profileId);
  }

  updateCertification(id: string, input: unknown): Promise<CertificationEntry> {
    const data = validateOrThrow(certificationInputSchema, input, 'certification');
    return this.repo.updateCertification(id, data);
  }

  removeCertification(id: string): Promise<void> {
    return this.repo.removeCertification(id);
  }

  // -------------------------------------------------------------------------
  // Achievements
  // -------------------------------------------------------------------------

  addAchievement(profileId: string, input: unknown): Promise<AchievementEntry> {
    const data = validateOrThrow(achievementInputSchema, input, 'achievement');
    return this.repo.createAchievement(profileId, data);
  }

  listAchievements(profileId: string): Promise<AchievementEntry[]> {
    return this.repo.listAchievements(profileId);
  }

  updateAchievement(id: string, input: unknown): Promise<AchievementEntry> {
    const data = validateOrThrow(achievementInputSchema, input, 'achievement');
    return this.repo.updateAchievement(id, data);
  }

  removeAchievement(id: string): Promise<void> {
    return this.repo.removeAchievement(id);
  }

  // -------------------------------------------------------------------------
  // Evidence & CV import
  // -------------------------------------------------------------------------

  getEvidenceService(): EvidenceService {
    return this.evidence;
  }

  async importCv(input: unknown): Promise<ReturnType<CvImportService['importCv']>> {
    const profileId = await this.requireProfileId();
    return this.cvImports.importCv({ ...(input as object), profileId });
  }
}

/** A `current: true` entry must not persist an endDate. */
function withCurrentEndDate(data: ExperienceInput): Omit<Prisma.ExperienceEntryUncheckedCreateInput, 'profileId'> {
  return data.current ? { ...data, endDate: null } : data;
}

/** Projects/education may leave ends unfilled; serialize to null explicitly. */
function withNullableEnds(data: ProjectInput): Omit<Prisma.ProjectEntryUncheckedCreateInput, 'profileId'> {
  return {
    ...data,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    ...(data.url === '' ? { url: null } : { url: data.url ?? null }),
  };
}

export type { ProfileInput, SkillInput, ExperienceInput, ProjectInput, EducationInput, CertificationInput, AchievementInput };
export { ConflictError };