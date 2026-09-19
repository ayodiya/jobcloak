/**
 * Deterministic view builders for the generator. All input is loaded from the
 * candidate/jobs repositories — the model never supplies these facts.
 */
import type { EvidenceRecord } from '@jobs-app/database';
import { NotFoundError } from '@jobs-app/shared';
import type { CandidateRepository } from '@jobs-app/candidate';
import type { JobRepository } from '@jobs-app/jobs';
import { asStringArray } from './evidence-snapshot.js';

export interface SkillView {
  name: string;
  level: string;
  years: number | null;
}

export interface ExperienceView {
  organization: string;
  title: string;
  period: string;
  responsibilities: string[];
  achievements: string[];
}

export interface ProjectView {
  name: string;
  role: string | null;
  url: string | null;
  period: string;
  achievements: string[];
}

export interface EducationView {
  institution: string;
  degree: string | null;
  field: string | null;
  period: string;
}

export interface CertificationView {
  name: string;
  issuer: string | null;
}

export interface CandidateBackground {
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  city: string | null;
  country: string | null;
  emails: string[];
  phones: string[];
  languages: string[];
  workAuthorization: string | null;
  skills: SkillView[];
  summary: string | null;
  experience: ExperienceView[];
  projects: ProjectView[];
  education: EducationView[];
  certifications: CertificationView[];
  achievements: string[];
}

export interface CandidateMaterialSource {
  profileId: string;
  background: CandidateBackground;
  evidence: EvidenceRecord[];
}

export type LoadMaterialSource = () => Promise<CandidateMaterialSource>;

export interface JobContext {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  description: string;
  seniority: string | null;
  requirements: Array<{
    kind: 'Required' | 'Preferred' | 'NiceToHave';
    category: string;
    name: string;
    minYears: number | null;
    source: string;
  }>;
}

export type LoadJobContext = (jobId: string) => Promise<JobContext>;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export function formatPeriod(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  current: boolean,
): string {
  const start = startDate ? formatMonthYear(startDate) : '';
  const end = current || !endDate ? 'Present' : formatMonthYear(endDate);
  return start && end ? `${start} – ${end}` : end;
}

function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Load the candidate facts the generator may draw on. */
export function defaultLoadMaterialSource(
  candidates: CandidateRepository,
): LoadMaterialSource {
  const client = candidates as Pick<
    CandidateRepository,
    'findProfile' | 'listSkills' | 'listExperience' | 'listProjects' | 'listEducation' | 'listCertifications' | 'listAchievements' | 'listEvidence'
  >;
  return async (): Promise<CandidateMaterialSource> => {
    const profile = await client.findProfile();
    if (!profile) throw new NotFoundError('CandidateProfile not found. Create a profile first.');
    const [skills, experience, projects, education, certifications, achievements, evidence] =
      await Promise.all([
        client.listSkills(profile.id),
        client.listExperience(profile.id),
        client.listProjects(profile.id),
        client.listEducation(profile.id),
        client.listCertifications(profile.id),
        client.listAchievements(profile.id),
        client.listEvidence(profile.id),
      ]);

    const background: CandidateBackground = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      title: profile.title,
      city: profile.city,
      country: profile.country,
      emails: asStringArray(profile.emails),
      phones: asStringArray(profile.phones),
      languages: asStringArray(profile.languages),
      workAuthorization: profile.workAuthorization,
      skills: skills.map((skill) => ({
        name: skill.name,
        level: skill.level,
        years: skill.years,
      })),
      summary: profile.title ?? null,
      experience: experience.map((entry) => ({
        organization: entry.organization,
        title: entry.title,
        period: formatPeriod(entry.startDate, entry.endDate, entry.current),
        responsibilities: asStringArray(entry.responsibilities),
        achievements: asStringArray(entry.achievements),
      })),
      projects: projects.map((project) => ({
        name: project.name,
        role: project.role,
        url: project.url,
        period: formatPeriod(project.startDate, project.endDate, project.current),
        achievements: asStringArray(project.achievements),
      })),
      education: education.map((entry) => ({
        institution: entry.institution,
        degree: entry.degree,
        field: entry.field,
        period: formatPeriod(entry.startDate, entry.endDate, false),
      })),
      certifications: certifications.map((entry) => ({
        name: entry.name,
        issuer: entry.issuer,
      })),
      achievements: achievements.map((entry) => entry.title),
    };

    return { profileId: profile.id, background, evidence };
  };
}

/** Load a job (and its requirements) for tailoring. */
export function defaultLoadJobContext(jobs: JobRepository): LoadJobContext {
  const client = jobs as Pick<JobRepository, 'findById' | 'getRequirements'>;
  return async (jobId): Promise<JobContext> => {
    const job = await client.findById(jobId);
    if (!job) throw new NotFoundError(`Job not found: ${jobId}`);
    const requirements = await client.getRequirements(jobId);
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      remote: job.remote,
      description: job.description,
      seniority: job.seniority,
      requirements: requirements.map((requirement) => ({
        kind: requirement.kind,
        category: requirement.category,
        name: requirement.name,
        minYears: requirement.minYears,
        source: requirement.source,
      })),
    };
  };
}

export { asStringArray };