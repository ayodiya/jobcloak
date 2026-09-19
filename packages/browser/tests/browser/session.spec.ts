import { expect, test } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AvailableValue } from '../../src/map.js';
import { BrowserSession } from '../../src/session.js';

const BASE = 'http://127.0.0.1:8787';

const AVAILABLE: AvailableValue[] = [
  { key: 'full_name', label: 'Full name', value: 'Ada Lovelace' },
  { key: 'email', label: 'Email', value: 'ada@example.com' },
  { key: 'phone', label: 'Phone', value: '+49 30 123456' },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    value: 'https://www.linkedin.com/in/ada',
    aliases: ['LinkedIn profile URL'],
  },
  { key: 'confirm', label: 'I confirm the information above is accurate.', value: 'true' },
  {
    key: 'why',
    label: 'Why do you want to work here?',
    value: 'I love building privacy tools.',
  },
  { key: 'channel', label: 'Preferred contact channel', value: 'Email' },
  { key: 'country', label: 'Country', value: 'Germany' },
];

function newSession(): BrowserSession {
  return new BrowserSession({
    userDataDir: mkdtempSync(join(tmpdir(), 'jobs-browser-test-')),
    headless: true,
  });
}

test('maps, fills and submits an application end to end', async () => {
  const session = newSession();
  try {
    await session.open(`${BASE}/form`);
    const fields = await session.map();
    expect(fields.map((field) => field.name)).toContain('why');

    const decisions = session.mapValues(fields, AVAILABLE);
    await session.fill(decisions);
    await session.gates();
    await session.submit();

    const result = await session.verify();
    expect(result.status).toBe('verified');

    const events = session.eventsList();
    const types = events.map((event) => event.type);
    expect(types).toContain('session.opened');
    expect(types).toContain('form.mapped');
    expect(types).toContain('field.mapped');
    expect(types).toContain('submission.submitted');
    expect(types).toContain('verification.result');

    const gone = events.find((event) => event.type === 'session.closed');
    expect(gone).toBeUndefined();
  } finally {
    await session.close().catch(() => undefined);
  }
});

test('blocks submission when a CAPTCHA gate is on the page', async () => {
  const session = newSession();
  try {
    await session.open(`${BASE}/captcha`);
    await session.map();
    await expect(session.submit()).rejects.toThrow('captcha');
    expect(session.stageName).toBe('waiting-approval');
  } finally {
    await session.cancel().catch(() => undefined);
  }
});

test('blocks submission when a required field cannot be filled', async () => {
  const session = newSession();
  try {
    await session.open(`${BASE}/unresolved`);
    const fields = await session.map();
    await session.fill(session.mapValues(fields, []));
    await expect(session.submit()).rejects.toThrow('required');
    expect(session.stageName).toBe('waiting-approval');
  } finally {
    await session.cancel().catch(() => undefined);
  }
});

test('maps radio groups and selects, and uploads files', async () => {
  const session = newSession();
  const resumePath = join(tmpdir(), `resume-${Date.now()}.pdf`);
  writeFileSync(resumePath, 'fake pdf bytes');
  try {
    await session.open(`${BASE}/fields`);
    const fields = await session.map();

    const radio = fields.find((field) => field.type === 'radio');
    const select = fields.find((field) => field.type === 'select');
    const file = fields.find((field) => field.type === 'file');
    expect(radio).toBeDefined();
    expect(select).toBeDefined();
    expect(file).toBeDefined();
    expect(radio!.options.map((option) => option.label)).toEqual(['Email', 'Phone']);

    const decisions = session.mapValues(fields, AVAILABLE);
    await session.fill(decisions);
    await session.upload(file!, [resumePath]);
    await session.submit();

    const result = await session.verify();
    expect(result.status).toBe('verified');

    const uploadEvent = session.eventsList().find((event) => event.type === 'file.uploaded');
    expect(uploadEvent?.payload).toMatchObject({ key: file!.key, count: 1 });
    expect(uploadEvent?.payload?.digest).toMatch(/^[0-9a-f]{16}$/);
  } finally {
    await session.close().catch(() => undefined);
  }
});

test('does not fabricate a radio answer for an unmatched option', async () => {
  const session = newSession();
  try {
    await session.open(`${BASE}/fields`);
    const fields = await session.map();

    const decisions = session.mapValues(fields, [
      { key: 'channel', label: 'Preferred contact channel', value: 'SMS' },
    ]);
    const radioDecision = decisions.find((decision) => decision.field.type === 'radio');
    expect(radioDecision?.value).toBe('SMS');
    await session.fill(decisions);

    await expect(session.submit()).rejects.toThrow('navigate away');
  } finally {
    await session.cancel().catch(() => undefined);
  }
});
