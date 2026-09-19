import { describe, expect, it } from 'vitest';
import { detectGates, hasStopGates } from './gates.js';
import type { PageSnapshot } from './types.js';

function snapshot(bodyText: string, url = 'https://careers.example.com/apply'): PageSnapshot {
  return { url, html: `<html><body>${bodyText}</body></html>`, title: '', bodyText };
}

describe('detectGates', () => {
  it('detects a captcha from DOM markers', () => {
    const gates = detectGates(snapshot('Complete the reCAPTCHA to continue.'));
    expect(gates[0]).toMatchObject({
      kind: 'captcha',
      severity: 'stop',
      detector: 'dom',
      evidence: 'recaptcha',
    });
    expect(hasStopGates(gates)).toBe(true);
  });

  it('detects CAPTCHA from the URL', () => {
    const gates = detectGates(
      snapshot('Verify your session.', 'https://jobs.example.com/captcha'),
    );
    expect(gates.some((gate) => gate.kind === 'captcha' && gate.detector === 'url')).toBe(true);
  });

  it('detects MFA and identity gates', () => {
    const mfa = detectGates(snapshot('Enter the one-time code from your authenticator app.'));
    expect(mfa.some((gate) => gate.kind === 'mfa')).toBe(true);
    const identity = detectGates(
      snapshot('Confirm your identity with a government-issued ID.'),
    );
    expect(identity.some((gate) => gate.kind === 'identity')).toBe(true);
  });

  it('detects legal and work-authorization stops', () => {
    const legal = detectGates(snapshot('Please certify the declaration and sign below.'));
    expect(legal.some((gate) => gate.kind === 'legal')).toBe(true);
    const workAuth = detectGates(snapshot('Do you have the right to work in the EU?'));
    expect(workAuth.some((gate) => gate.kind === 'work_authorization')).toBe(true);
  });

  it('returns no gates for a plain form', () => {
    expect(detectGates(snapshot('First name, Email, Phone, Submit application.'))).toEqual([]);
  });

  it('reports no stop points for a plain page', () => {
    expect(hasStopGates(detectGates(snapshot('Complete the application below.')))).toBe(false);
  });
});
