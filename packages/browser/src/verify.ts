import type { PageSnapshot, VerificationResult } from './types.js';

const SUCCESS_TEXTS = [
  'application submitted',
  'thank you for applying',
  'thank you for your interest',
  'successfully submitted',
  'your application has been',
  'received your application',
  'we received your application',
  'application was received',
  'submit successful',
  'apply complete',
  'application complete',
  'submission received',
];

const SUCCESS_URL = ['thank-you', 'thankyou', 'application-submitted', 'submitted', 'success'];

const FAILURE_TEXTS = [
  'there was a problem',
  'something went wrong',
  'not submitted',
  'unable to submit',
  'failed to submit',
  'cannot be submitted',
  'missing information',
  'please review the form',
  'please correct the following',
  'incomplete form',
  'please try again',
  'an error occurred',
  'we could not process',
];

const FAILURE_URL = ['error', 'failed'];

/** Submission success detection over a post-submit page snapshot. */
export function verifySubmission(snapshot: PageSnapshot): VerificationResult {
  const body = snapshot.bodyText.toLowerCase();
  const title = snapshot.title.toLowerCase();
  const url = snapshot.url.toLowerCase();
  const haystack = `${body}\n${title}`;

  const success =
    SUCCESS_TEXTS.some((marker) => haystack.includes(marker)) ||
    SUCCESS_URL.some((marker) => url.includes(marker));
  const failure =
    FAILURE_TEXTS.some((marker) => haystack.includes(marker)) ||
    FAILURE_URL.some((marker) => url.includes(marker));

  const evidence: string[] = [];
  if (success) {
    evidence.push(
      ...SUCCESS_TEXTS.filter((marker) => haystack.includes(marker)),
      ...SUCCESS_URL.filter((marker) => url.includes(marker)),
    );
  }
  if (failure) {
    evidence.push(
      ...FAILURE_TEXTS.filter((marker) => haystack.includes(marker)),
      ...FAILURE_URL.filter((marker) => url.includes(marker)),
    );
  }

  if (success && failure) return { status: 'pending', evidence: evidence.slice(0, 4) };
  if (success) return { status: 'verified', evidence };
  if (failure) return { status: 'failed', evidence };
  return { status: 'inconclusive', evidence: [] };
}
