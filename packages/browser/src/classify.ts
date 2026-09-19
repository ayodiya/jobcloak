import type {
  ClassifierSource,
  FormField,
  QuestionCategory,
  QuestionClassification,
} from './types.js';

/** Classification backend (optional AI-assisted path, Phase 3 adapter). */
export interface QuestionClassifierBackend {
  classify(text: string): Promise<{
    category: QuestionCategory;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
  }>;
}

interface CategoryRule {
  category: QuestionCategory;
  strong: RegExp[];
  weak: RegExp[];
  answerLabel: string | null;
  /** Categories that are always stop points (automation.md). */
  stop: boolean;
}

const RULES: CategoryRule[] = [
  {
    category: 'work_authorization',
    strong: [
      /\bwork authorization\b/,
      /\bwork permit\b/,
      /\bvisa (status|sponsorship)\b/,
      /\bsponsorship\b/,
      /\blegally authorized\b/,
      /\bright to work\b/,
      /\bcitizenship\b/,
      /\bimmigration\b/,
    ],
    weak: [/authorized (to )?work/i],
    answerLabel: 'work authorization',
    stop: true,
  },
  {
    category: 'legal',
    strong: [
      /\bterms and conditions\b/,
      /\b(i agree|consent)\b/,
      /\bdeclaration\b/,
      /\be[- ]?signature\b/,
      /\bsignature\b/,
      /\bequal opportunity\b/,
      /\bself-identification\b/,
      /\bcriminal record\b/,
      /\bbackground check\b/,
      /\bdrug test\b/,
      /\bprivacy policy\b/,
      /\bdisclosure\b/,
    ],
    weak: [/^i agree\b/i, /\bterms\b/i],
    answerLabel: null,
    stop: true,
  },
  {
    category: 'salary',
    strong: [
      /\bsalary\b/,
      /\bcompensation\b/,
      /\bpay (range|expectation|rate)\b/,
      /\brate\b/,
      /\bbudget\b/,
    ],
    weak: [/pay/i],
    answerLabel: 'salary expectation',
    stop: false,
  },
  {
    category: 'availability',
    strong: [
      /\bavailability\b/,
      /\bstart date\b/,
      /\bwhen can you start\b/,
      /\bnotice period\b/,
    ],
    weak: [/^availability\b/i],
    answerLabel: 'availability',
    stop: false,
  },
  {
    category: 'education',
    strong: [
      /\beducation\b/,
      /\buniversity\b/,
      /\bdegree\b/,
      /\bschool\b/,
      /\bgpa\b/,
      /\btranscript\b/,
    ],
    weak: [/studies/i],
    answerLabel: 'education details',
    stop: false,
  },
  {
    category: 'experience',
    strong: [
      /\bwork history\b/,
      /\bcareer history\b/,
      /\bemployment\b/,
      /\bwork experience\b/,
      /\brelevant experience\b/,
      /\byears of experience\b/,
    ],
    weak: [/\bexperience\b/i],
    answerLabel: 'experience summary',
    stop: false,
  },
  {
    category: 'cv',
    strong: [/\bresume\b/, /\bcurriculum vitae\b/, /\bcv\b/],
    weak: [/attach/i],
    answerLabel: 'CV',
    stop: false,
  },
  {
    category: 'cover_letter',
    strong: [/\bcover letter\b/],
    weak: [/^cover letter\b/i],
    answerLabel: 'cover letter',
    stop: false,
  },
  {
    category: 'contact',
    strong: [
      /\bemail\b/,
      /\bphone\b/,
      /\btelephone\b/,
      /\bmobile\b/,
      /\blinkedin\b/,
      /\bwebsite\b/,
      /\bportfolio\b/,
      /\bgithub\b/,
      /\baddress\b/,
      /\bcity\b/,
      /\bcountry\b/,
      /\bpostal code\b/,
      /\bzip code\b/,
    ],
    weak: [/contact/i],
    answerLabel: 'contact',
    stop: false,
  },
  {
    category: 'identity',
    strong: [
      /\bfirst name\b/,
      /\blast name\b/,
      /\bfull name\b/,
      /\blegal name\b/,
      /\bpreferred name\b/,
      /\b(^|\s)name\b/,
    ],
    weak: [/^name\b/i],
    answerLabel: 'full name',
    stop: false,
  },
  {
    category: 'answer',
    strong: [],
    weak: [
      /^why\b/,
      /why do you/,
      /why are you/,
      /tell us about/,
      /describe/,
      /greatest (strength|accomplishment)/,
      /most (challenging|interesting|proud)/,
      /career goals/,
      /what are you looking for/,
      /how (do|would) you/,
      /walk me through/,
      /accomplishment/,
    ],
    answerLabel: 'generated answer',
    stop: false,
  },
];

const UNKNOWN: CategoryRule = {
  category: 'unknown',
  strong: [],
  weak: [],
  answerLabel: null,
  stop: true,
};

/** Deterministic classification of one application question text. */
export function classifyText(text: string): {
  category: QuestionCategory;
  confidence: 'high' | 'medium' | 'low';
  rule: CategoryRule;
} {
  const normalized = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.strong.some((pattern) => pattern.test(normalized))) {
      return { category: rule.category, confidence: 'high', rule };
    }
  }
  for (const rule of RULES) {
    if (rule.weak.some((pattern) => pattern.test(normalized))) {
      return { category: rule.category, confidence: 'medium', rule };
    }
  }
  return { category: 'unknown', confidence: 'low', rule: UNKNOWN };
}

export async function classifyQuestion(
  question: FormField,
  backend?: QuestionClassifierBackend,
): Promise<QuestionClassification> {
  const text = [question.label, question.placeholder].filter(Boolean).join(' ');
  const deterministic = classifyText(text);

  if (deterministic.category !== 'unknown') {
    return toClassification(
      question,
      deterministic.category,
      deterministic.confidence,
      'deterministic',
      deterministic.rule,
    );
  }

  if (backend) {
    try {
      const ai = await backend.classify(question.label);
      return toClassification(
        question,
        ai.category,
        ai.confidence,
        'ai',
        RULES.find((rule) => rule.category === ai.category) ?? UNKNOWN,
        { keepHumanInLoop: true },
      );
    } catch {
      return toClassification(question, 'unknown', 'low', 'deterministic', UNKNOWN);
    }
  }

  return toClassification(question, 'unknown', 'low', 'deterministic', UNKNOWN);
}

export function classifyQuestions(
  questions: readonly FormField[],
  backend?: QuestionClassifierBackend,
): Promise<QuestionClassification[]> {
  return Promise.all(questions.map((question) => classifyQuestion(question, backend)));
}

function toClassification(
  question: FormField,
  category: QuestionCategory,
  confidence: 'high' | 'medium' | 'low',
  source: ClassifierSource,
  rule: CategoryRule,
  options?: { keepHumanInLoop?: boolean },
): QuestionClassification {
  const requiresHuman = options?.keepHumanInLoop === true || rule.stop || confidence === 'low';
  return {
    question,
    category,
    source,
    confidence,
    answerLabel: rule.answerLabel,
    requiresHuman,
  };
}
