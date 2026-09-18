import type { JobRequirementInput, RequirementCategory, RequirementKind } from './types.js';

export interface RequirementExtractionOptions {
  /** Safety cap so a pathological description cannot explode the table. */
  maxRequirements?: number;
}

const DEFAULT_MAX_REQUIREMENTS = 200;

interface SkillEntry {
  key: string;
  name: string;
  aliases: string[];
}

/** Compact tech/role lexicon. Keys are canonical; aliases match case-insensitively. */
const SKILLS: SkillEntry[] = [
  { key: 'javascript', name: 'JavaScript', aliases: ['javascript', 'js'] },
  { key: 'typescript', name: 'TypeScript', aliases: ['typescript', 'ts'] },
  { key: 'react', name: 'React', aliases: ['react', 'react.js', 'reactjs'] },
  { key: 'vue', name: 'Vue', aliases: ['vue', 'vue.js', 'vuejs'] },
  { key: 'angular', name: 'Angular', aliases: ['angular'] },
  { key: 'node.js', name: 'Node.js', aliases: ['node.js', 'nodejs', 'node js', 'node'] },
  { key: 'next.js', name: 'Next.js', aliases: ['next.js', 'nextjs'] },
  { key: 'express', name: 'Express', aliases: ['express', 'express.js'] },
  { key: 'python', name: 'Python', aliases: ['python'] },
  { key: 'django', name: 'Django', aliases: ['django'] },
  { key: 'flask', name: 'Flask', aliases: ['flask'] },
  { key: 'fastapi', name: 'FastAPI', aliases: ['fastapi'] },
  { key: 'java', name: 'Java', aliases: ['java'] },
  { key: 'spring', name: 'Spring', aliases: ['spring', 'spring boot'] },
  { key: 'kotlin', name: 'Kotlin', aliases: ['kotlin'] },
  { key: 'swift', name: 'Swift', aliases: ['swift'] },
  { key: 'go', name: 'Go', aliases: ['golang', 'go'] },
  { key: 'rust', name: 'Rust', aliases: ['rust'] },
  { key: 'c++', name: 'C++', aliases: ['c++'] },
  { key: 'c#', name: 'C#', aliases: ['c#', 'csharp'] },
  { key: '.net', name: '.NET', aliases: ['.net', 'dotnet', 'asp.net'] },
  { key: 'php', name: 'PHP', aliases: ['php'] },
  { key: 'laravel', name: 'Laravel', aliases: ['laravel'] },
  { key: 'ruby', name: 'Ruby', aliases: ['ruby'] },
  { key: 'rails', name: 'Ruby on Rails', aliases: ['rails', 'ruby on rails'] },
  { key: 'sql', name: 'SQL', aliases: ['sql'] },
  { key: 'postgresql', name: 'PostgreSQL', aliases: ['postgresql', 'postgres'] },
  { key: 'mysql', name: 'MySQL', aliases: ['mysql'] },
  { key: 'mongodb', name: 'MongoDB', aliases: ['mongodb', 'mongo'] },
  { key: 'redis', name: 'Redis', aliases: ['redis'] },
  { key: 'elasticsearch', name: 'Elasticsearch', aliases: ['elasticsearch', 'elastic search'] },
  { key: 'graphql', name: 'GraphQL', aliases: ['graphql'] },
  { key: 'rest', name: 'REST APIs', aliases: ['rest', 'restful', 'rest api'] },
  { key: 'html', name: 'HTML', aliases: ['html', 'html5'] },
  { key: 'css', name: 'CSS', aliases: ['css', 'css3'] },
  { key: 'sass', name: 'Sass', aliases: ['sass', 'scss'] },
  { key: 'tailwind', name: 'Tailwind CSS', aliases: ['tailwind', 'tailwindcss'] },
  { key: 'docker', name: 'Docker', aliases: ['docker'] },
  { key: 'kubernetes', name: 'Kubernetes', aliases: ['kubernetes', 'k8s'] },
  { key: 'aws', name: 'AWS', aliases: ['aws', 'amazon web services'] },
  { key: 'azure', name: 'Azure', aliases: ['azure'] },
  { key: 'gcp', name: 'Google Cloud', aliases: ['gcp', 'google cloud'] },
  { key: 'terraform', name: 'Terraform', aliases: ['terraform'] },
  { key: 'kafka', name: 'Kafka', aliases: ['kafka'] },
  { key: 'rabbitmq', name: 'RabbitMQ', aliases: ['rabbitmq'] },
  { key: 'jest', name: 'Jest', aliases: ['jest'] },
  { key: 'vitest', name: 'Vitest', aliases: ['vitest'] },
  { key: 'playwright', name: 'Playwright', aliases: ['playwright'] },
  { key: 'cypress', name: 'Cypress', aliases: ['cypress'] },
  { key: 'linux', name: 'Linux', aliases: ['linux', 'unix'] },
  { key: 'git', name: 'Git', aliases: ['git', 'github', 'gitlab'] },
  { key: 'agile', name: 'Agile', aliases: ['agile', 'scrum', 'kanban'] },
  { key: 'machine-learning', name: 'Machine Learning', aliases: ['machine learning', 'ml'] },
  { key: 'tensorflow', name: 'TensorFlow', aliases: ['tensorflow'] },
  { key: 'pytorch', name: 'PyTorch', aliases: ['pytorch'] },
  { key: 'pandas', name: 'pandas', aliases: ['pandas'] },
  { key: 'spark', name: 'Apache Spark', aliases: ['spark'] },
  { key: 'microservices', name: 'Microservices', aliases: ['microservices', 'micro-services'] },
  { key: 'oauth', name: 'OAuth', aliases: ['oauth', 'oauth2'] },
  { key: 'jwt', name: 'JWT', aliases: ['jwt'] },
];

const LANGUAGE_NAMES = [
  'english',
  'spanish',
  'french',
  'german',
  'italian',
  'portuguese',
  'dutch',
  'mandarin',
  'japanese',
  'korean',
];

const KIND_ORDER: RequirementKind[] = ['Required', 'Preferred', 'NiceToHave'];

const HEADINGS: Array<{ kind: RequirementKind; pattern: RegExp }> = [
  {
    kind: 'NiceToHave',
    pattern: /^(nice[- ]to[- ]have|bonus( points)?|a plus|desired|additional)\b/i,
  },
  {
    kind: 'Preferred',
    pattern: /^(preferred( qualifications)?|strongly preferred|we'?d love|ideally)\b/i,
  },
  {
    kind: 'Required',
    pattern:
      /^(requirements|required( qualifications)?|must[- ]have|you have|what you'?ll need|what you will need|minimum qualifications|basic qualifications|qualifications|about you|who you are)\b/i,
  },
];

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalized lookup key for a requirement name (shared with the AI merger). */
export function normalizeRequirementKey(value: string): string {
  return normalizeKey(value);
}

function containsAlias(text: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(text);
}

function detectKind(line: string): RequirementKind | undefined {
  for (const heading of HEADINGS) {
    if (heading.pattern.test(line)) return heading.kind;
  }
  return undefined;
}

interface Candidate {
  kind: RequirementKind;
  category: RequirementCategory;
  key: string;
  name: string;
  minYears?: number;
  detail?: string;
}

/**
 * Deterministic requirement extraction: section-aware (required/preferred/
 * nice-to-have) skill lexicon matching plus experience, education and language
 * patterns. This is the baseline that AI output is merged *under*.
 */
export function extractRequirements(
  description: string,
  options: RequirementExtractionOptions = {},
): JobRequirementInput[] {
  const max = options.maxRequirements ?? DEFAULT_MAX_REQUIREMENTS;
  const collected = new Map<string, Candidate>();
  let kind: RequirementKind = 'Required';

  for (const rawLine of description.split(/\n+/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const heading = detectKind(line);
    if (heading && line.length <= 80) {
      kind = heading;
      continue;
    }

    const detail = line.slice(0, 300);

    for (const skill of SKILLS) {
      if (skill.aliases.some((alias) => containsAlias(line, alias))) {
        add(collected, { kind, category: 'Skill', key: skill.key, name: skill.name, detail });
      }
    }

    const years = line.match(/(\d{1,2})\s*\+?\s*(?:-|to|–)?\s*(\d{1,2})?\s*years?/i);
    if (years?.[1]) {
      const minYears = Number.parseInt(years[1], 10);
      if (minYears > 0 && minYears <= 40) {
        add(collected, {
          kind,
          category: 'Experience',
          key: `${minYears}+ years`,
          name: `${minYears}+ years experience`,
          minYears,
          detail,
        });
      }
    }

    const education = line.match(/\b(bachelor'?s?|master'?s?|phd|doctorate|degree)\b/i);
    if (education?.[1]) {
      const name = normalizeText(education[1]);
      add(collected, { kind, category: 'Education', key: normalizeKey(name), name, detail });
    }

    for (const language of LANGUAGE_NAMES) {
      if (containsAlias(line, language)) {
        add(collected, {
          kind,
          category: 'Language',
          key: language,
          name: language.charAt(0).toUpperCase() + language.slice(1),
          detail,
        });
      }
    }
  }

  return [...collected.values()]
    .sort((a, b) => {
      const kindDiff = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      if (kindDiff !== 0) return kindDiff;
      const categoryDiff = a.category.localeCompare(b.category);
      if (categoryDiff !== 0) return categoryDiff;
      return a.key.localeCompare(b.key);
    })
    .slice(0, max)
    .map((candidate) => ({
      kind: candidate.kind,
      category: candidate.category,
      key: candidate.key,
      name: candidate.name,
      ...(candidate.minYears !== undefined ? { minYears: candidate.minYears } : {}),
      ...(candidate.detail !== undefined ? { detail: candidate.detail } : {}),
      source: 'Deterministic' as const,
    }));
}

function add(map: Map<string, Candidate>, candidate: Candidate): void {
  const key = `${candidate.kind}|${candidate.category}|${candidate.key}`;
  if (!map.has(key)) map.set(key, candidate);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
