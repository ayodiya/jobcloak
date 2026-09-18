/**
 * Persistence for the candidate domain. All writes are scoped to a profile;
 * decorators translate Prisma errors into shared semantic errors.
 */
import { Prisma, prisma, type PrismaClient } from '@jobs-app/database';
import { ConflictError, DatabaseError, NotFoundError } from '@jobs-app/shared';

type Db = PrismaClient;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function toNotFound(model: string): NotFoundError {
  return new NotFoundError(`${model} not found`);
}

export class CandidateRepository {
  constructor(private readonly db: Db = prisma) {}

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------

  /** The single local profile, if one exists (updated-last wins). */
  findProfile(): Promise<Prisma.CandidateProfileGetPayload<{ include: { skills: true } }> | null> {
    return this.db.candidateProfile.findFirst({ orderBy: { updatedAt: 'desc' }, include: { skills: true } });
  }

  findProfileById(id: string): Promise<Prisma.CandidateProfileGetPayload<{ include: { skills: true } }> | null> {
    return this.db.candidateProfile.findUnique({ where: { id }, include: { skills: true } });
  }

  createProfile(data: Prisma.CandidateProfileUncheckedCreateInput): Promise<Prisma.CandidateProfileGetPayload<{ include: { skills: true } }>> {
    return this.db.candidateProfile.create({ data, include: { skills: true } });
  }

  updateProfile(id: string, data: Prisma.CandidateProfileUncheckedUpdateInput): Promise<Prisma.CandidateProfileGetPayload<{ include: { skills: true } }>> {
    return this.db.candidateProfile.update({ where: { id }, data, include: { skills: true } });
  }

  deleteProfile(id: string): Promise<void> {
    return this.db.candidateProfile
      .delete({ where: { id } })
      .then(() => undefined)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('CandidateProfile');
        throw new DatabaseError('Failed to delete candidate profile', { cause: error });
      });
  }

  // -------------------------------------------------------------------------
  // Skills
  // -------------------------------------------------------------------------

  createSkill(profileId: string, data: Omit<Prisma.SkillUncheckedCreateInput, 'profileId'>): Promise<Prisma.SkillGetPayload<Record<string, never>>> {
    return this.db.skill
      .create({ data: { ...data, profileId } })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ConflictError('A skill with this name already exists');
        throw new DatabaseError('Failed to create skill', { cause: error });
      });
  }

  listSkills(profileId: string): Promise<Prisma.SkillGetPayload<Record<string, never>>[]> {
    return this.db.skill.findMany({ where: { profileId }, orderBy: [{ name: 'asc' }, { createdAt: 'asc' }] });
  }

  updateSkill(id: string, data: Prisma.SkillUncheckedUpdateInput): Promise<Prisma.SkillGetPayload<Record<string, never>>> {
    return this.db.skill.update({ where: { id }, data }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('Skill');
      if (isUniqueViolation(error)) throw new ConflictError('A skill with this name already exists');
      throw new DatabaseError('Failed to update skill', { cause: error });
    });
  }

  removeSkill(id: string): Promise<void> {
    return this.db.skill
      .delete({ where: { id } })
      .then(() => undefined)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('Skill');
        throw new DatabaseError('Failed to delete skill', { cause: error });
      });
  }

  // -------------------------------------------------------------------------
  // Experience
  // -------------------------------------------------------------------------

  createExperience(profileId: string, data: Omit<Prisma.ExperienceEntryUncheckedCreateInput, 'profileId'>): Promise<Prisma.ExperienceEntryGetPayload<Record<string, never>>> {
    return this.db.experienceEntry.create({ data: { ...data, profileId } }).catch((error: unknown) => {
      throw new DatabaseError('Failed to create experience entry', { cause: error });
    });
  }

  listExperience(profileId: string): Promise<Prisma.ExperienceEntryGetPayload<Record<string, never>>[]> {
    return this.db.experienceEntry.findMany({ where: { profileId }, orderBy: [{ sortOrder: 'asc' }, { startDate: 'desc' }] });
  }

  updateExperience(id: string, data: Prisma.ExperienceEntryUncheckedUpdateInput): Promise<Prisma.ExperienceEntryGetPayload<Record<string, never>>> {
    return this.db.experienceEntry.update({ where: { id }, data }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('ExperienceEntry');
      throw new DatabaseError('Failed to update experience entry', { cause: error });
    });
  }

  removeExperience(id: string): Promise<void> {
    return this.db.experienceEntry
      .delete({ where: { id } })
      .then(() => undefined)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('ExperienceEntry');
        throw new DatabaseError('Failed to delete experience entry', { cause: error });
      });
  }

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  createProject(profileId: string, data: Omit<Prisma.ProjectEntryUncheckedCreateInput, 'profileId'>): Promise<Prisma.ProjectEntryGetPayload<Record<string, never>>> {
    return this.db.projectEntry.create({ data: { ...data, profileId } }).catch((error: unknown) => {
      throw new DatabaseError('Failed to create project entry', { cause: error });
    });
  }

  listProjects(profileId: string): Promise<Prisma.ProjectEntryGetPayload<Record<string, never>>[]> {
    return this.db.projectEntry.findMany({ where: { profileId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  updateProject(id: string, data: Prisma.ProjectEntryUncheckedUpdateInput): Promise<Prisma.ProjectEntryGetPayload<Record<string, never>>> {
    return this.db.projectEntry.update({ where: { id }, data }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('ProjectEntry');
      throw new DatabaseError('Failed to update project entry', { cause: error });
    });
  }

  removeProject(id: string): Promise<void> {
    return this.db.projectEntry
      .delete({ where: { id } })
      .then(() => undefined)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('ProjectEntry');
        throw new DatabaseError('Failed to delete project entry', { cause: error });
      });
  }

  // -------------------------------------------------------------------------
  // Education
  // -------------------------------------------------------------------------

  createEducation(profileId: string, data: Omit<Prisma.EducationEntryUncheckedCreateInput, 'profileId'>): Promise<Prisma.EducationEntryGetPayload<Record<string, never>>> {
    return this.db.educationEntry.create({ data: { ...data, profileId } }).catch((error: unknown) => {
      throw new DatabaseError('Failed to create education entry', { cause: error });
    });
  }

  listEducation(profileId: string): Promise<Prisma.EducationEntryGetPayload<Record<string, never>>[]> {
    return this.db.educationEntry.findMany({ where: { profileId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  updateEducation(id: string, data: Prisma.EducationEntryUncheckedUpdateInput): Promise<Prisma.EducationEntryGetPayload<Record<string, never>>> {
    return this.db.educationEntry.update({ where: { id }, data }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('EducationEntry');
      throw new DatabaseError('Failed to update education entry', { cause: error });
    });
  }

  removeEducation(id: string): Promise<void> {
    return this.db.educationEntry
      .delete({ where: { id } })
      .then(() => undefined)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('EducationEntry');
        throw new DatabaseError('Failed to delete education entry', { cause: error });
      });
  }

  // -------------------------------------------------------------------------
  // Certifications
  // -------------------------------------------------------------------------

  createCertification(profileId: string, data: Omit<Prisma.CertificationEntryUncheckedCreateInput, 'profileId'>): Promise<Prisma.CertificationEntryGetPayload<Record<string, never>>> {
    return this.db.certificationEntry.create({ data: { ...data, profileId } }).catch((error: unknown) => {
      throw new DatabaseError('Failed to create certification entry', { cause: error });
    });
  }

  listCertifications(profileId: string): Promise<Prisma.CertificationEntryGetPayload<Record<string, never>>[]> {
    return this.db.certificationEntry.findMany({ where: { profileId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  updateCertification(id: string, data: Prisma.CertificationEntryUncheckedUpdateInput): Promise<Prisma.CertificationEntryGetPayload<Record<string, never>>> {
    return this.db.certificationEntry.update({ where: { id }, data }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('CertificationEntry');
      throw new DatabaseError('Failed to update certification entry', { cause: error });
    });
  }

  removeCertification(id: string): Promise<void> {
    return this.db.certificationEntry
      .delete({ where: { id } })
      .then(() => undefined)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('CertificationEntry');
        throw new DatabaseError('Failed to delete certification entry', { cause: error });
      });
  }

  // -------------------------------------------------------------------------
  // Achievements
  // -------------------------------------------------------------------------

  createAchievement(profileId: string, data: Omit<Prisma.AchievementEntryUncheckedCreateInput, 'profileId'>): Promise<Prisma.AchievementEntryGetPayload<Record<string, never>>> {
    return this.db.achievementEntry.create({ data: { ...data, profileId } }).catch((error: unknown) => {
      throw new DatabaseError('Failed to create achievement entry', { cause: error });
    });
  }

  listAchievements(profileId: string): Promise<Prisma.AchievementEntryGetPayload<Record<string, never>>[]> {
    return this.db.achievementEntry.findMany({ where: { profileId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  updateAchievement(id: string, data: Prisma.AchievementEntryUncheckedUpdateInput): Promise<Prisma.AchievementEntryGetPayload<Record<string, never>>> {
    return this.db.achievementEntry.update({ where: { id }, data }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('AchievementEntry');
      throw new DatabaseError('Failed to update achievement entry', { cause: error });
    });
  }

  removeAchievement(id: string): Promise<void> {
    return this.db.achievementEntry
      .delete({ where: { id } })
      .then(() => undefined)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('AchievementEntry');
        throw new DatabaseError('Failed to delete achievement entry', { cause: error });
      });
  }

  // -------------------------------------------------------------------------
  // Evidence
  // -------------------------------------------------------------------------

  createEvidence(profileId: string, data: Omit<Prisma.EvidenceRecordUncheckedCreateInput, 'profileId'>): Promise<Prisma.EvidenceRecordGetPayload<Record<string, never>>> {
    return this.db.evidenceRecord.create({ data: { ...data, profileId } }).catch((error: unknown) => {
      throw new DatabaseError('Failed to create evidence record', { cause: error });
    });
  }

  getEvidence(id: string): Promise<Prisma.EvidenceRecordGetPayload<Record<string, never>> | null> {
    return this.db.evidenceRecord.findUnique({ where: { id } });
  }

  listEvidence(profileId: string): Promise<Prisma.EvidenceRecordGetPayload<Record<string, never>>[]> {
    return this.db.evidenceRecord.findMany({ where: { profileId }, orderBy: { createdAt: 'desc' } });
  }

  deleteEvidence(id: string): Promise<void> {
    return this.db.evidenceRecord
      .delete({ where: { id } })
      .then(() => undefined)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('EvidenceRecord');
        throw new DatabaseError('Failed to delete evidence record', { cause: error });
      });
  }

  /** Attach a supporting evidence record to a domain entry. */
  attachEvidence<Model extends 'experience' | 'project' | 'education' | 'certification' | 'achievement'>(
    model: Model,
    entryId: string,
    evidenceId: string | null,
  ): Promise<void> {
    type EntryDelegate = {
      update(args: { where: { id: string }; data: { evidenceId?: string | null } }): Promise<unknown>;
    };
    const delegates: Record<'experience' | 'project' | 'education' | 'certification' | 'achievement', unknown> = {
      experience: this.db.experienceEntry,
      project: this.db.projectEntry,
      education: this.db.educationEntry,
      certification: this.db.certificationEntry,
      achievement: this.db.achievementEntry,
    };
    const delegate = delegates[model] as EntryDelegate;
    return delegate
      .update({ where: { id: entryId }, data: { evidenceId } })
      .then(() => undefined)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('Domain entry');
        throw new DatabaseError('Failed to attach evidence', { cause: error });
      });
  }

  // -------------------------------------------------------------------------
  // CV imports
  // -------------------------------------------------------------------------

  createCvImport(profileId: string, data: Omit<Prisma.CvImportUncheckedCreateInput, 'profileId'>): Promise<Prisma.CvImportGetPayload<Record<string, never>>> {
    return this.db.cvImport.create({ data: { ...data, profileId } }).catch((error: unknown) => {
      throw new DatabaseError('Failed to create CV import', { cause: error });
    });
  }

  listCvImports(profileId: string): Promise<Prisma.CvImportGetPayload<Record<string, never>>[]> {
    return this.db.cvImport.findMany({ where: { profileId }, orderBy: { createdAt: 'desc' } });
  }

  updateCvImportStatus(id: string, status: Prisma.CvImportUncheckedUpdateInput['status']): Promise<Prisma.CvImportGetPayload<Record<string, never>>> {
    return this.db.cvImport.update({ where: { id }, data: { status } }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw toNotFound('CvImport');
      throw new DatabaseError('Failed to update CV import', { cause: error });
    });
  }
}