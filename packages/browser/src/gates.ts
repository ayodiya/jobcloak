import type { GateKind, GateSeverity, GateVerdict, PageSnapshot } from './types.js';

interface GateRule {
  kind: GateKind;
  severity: GateSeverity;
  dom: string[];
  url: string[];
}

const GATE_RULES: GateRule[] = [
  {
    kind: 'captcha',
    severity: 'stop',
    dom: [
      'recaptcha',
      'hcaptcha',
      'turnstile',
      'captcha',
      'verify you are human',
      'verify you are a human',
      'i am not a robot',
      'not a robot',
      'security check',
      'cf-chl',
      'challenge-platform',
      'enter the characters',
      'google.com/recaptcha',
      'hcaptcha.com',
      'challenges.cloudflare.com',
      'cloudflare challenges',
    ],
    url: ['captcha', 'challenge', 'cf-chl', 'turnstile'],
  },
  {
    kind: 'mfa',
    severity: 'stop',
    dom: [
      'two-factor',
      '2-factor',
      '2fa',
      'two step',
      'one-time code',
      'one time code',
      'one-time password',
      'otp',
      'verification code',
      'authenticator app',
      'authenticator',
      'sms code',
      'texted code',
      'enter the code',
    ],
    url: ['verify', '2fa', 'two-factor', 'otp'],
  },
  {
    kind: 'identity',
    severity: 'stop',
    dom: [
      'identity verification',
      'confirm your identity',
      'government-issued',
      'government issued',
      'passport number',
      'national id',
      'national identification',
      'drive license',
      'driving licence',
      'social security number',
      'identity card',
    ],
    url: ['identity'],
  },
  {
    kind: 'challenge',
    severity: 'stop',
    dom: [
      'unusual activity',
      'suspicious activity',
      'confirm you are human',
      'device verification',
      'security verification',
      'prove you are human',
    ],
    url: ['challenge'],
  },
  {
    kind: 'legal',
    severity: 'stop',
    dom: [
      'terms and conditions',
      'terms of service',
      'i agree to the',
      'consent',
      'declaration',
      'e-signature',
      'e signature',
      'signature',
      'certify that',
      'acknowledge that',
      'equal opportunity',
      'self-identification',
      'criminal record',
      'background check',
      'drug test',
      'non-compete',
      'arbitration',
      'disclosure',
    ],
    url: ['legal', 'terms', 'consent'],
  },
  {
    kind: 'work_authorization',
    severity: 'stop',
    dom: [
      'work authorization',
      'work permit',
      'visa status',
      'visa sponsorship',
      'sponsorship',
      'legally authorized',
      'legal right to work',
      'right to work',
      'citizenship',
      'immigration status',
      'green card',
    ],
    url: ['authorization', 'visa'],
  },
];

/**
 * Deterministic security-gate detection over a page snapshot. Used to enforce
 * the automation stop points (CAPTCHA / MFA / challenge / identity / legal /
 * work-authorization) before any submission (docs/architecture/automation.md).
 */
export function detectGates(snapshot: PageSnapshot): GateVerdict[] {
  const body = snapshot.bodyText.toLowerCase();
  const html = snapshot.html.toLowerCase();
  const url = snapshot.url.toLowerCase();
  const text = `${body}\n${html}`;
  const verdicts: GateVerdict[] = [];

  for (const rule of GATE_RULES) {
    const domHit = rule.dom.find((marker) => text.includes(marker));
    if (domHit) {
      verdicts.push({
        kind: rule.kind,
        severity: rule.severity,
        detector: 'dom',
        evidence: domHit,
      });
      continue;
    }
    const urlHit = rule.url.find((marker) => url.includes(marker));
    if (urlHit) {
      verdicts.push({
        kind: rule.kind,
        severity: rule.severity,
        detector: 'url',
        evidence: urlHit,
      });
    }
  }

  return verdicts;
}

export function hasStopGates(verdicts: readonly GateVerdict[]): boolean {
  return verdicts.some((verdict) => verdict.severity === 'stop');
}
