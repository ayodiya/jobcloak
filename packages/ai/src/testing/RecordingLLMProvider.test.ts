import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AIProviderError, InternalError } from '@jobs-app/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockLLMProvider } from './MockLLMProvider.js';
import { RecordingLLMProvider, loadRecording } from './RecordingLLMProvider.js';

const schema = z.object({ ok: z.boolean() });

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempFile(name: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'jobs-app-ai-'));
  tempDirs.push(dir);
  return join(dir, name);
}

describe('RecordingLLMProvider', () => {
  it('records delegate calls and replays them', async () => {
    const delegate = new MockLLMProvider({ complete: 'text', structured: { ok: true } });
    const recorder = RecordingLLMProvider.recording(delegate);

    await recorder.complete({ prompt: 'hi' });
    await recorder.structured({ prompt: 'p', schema });

    const recording = recorder.recording;
    expect(recording.version).toBe(1);
    expect(recording.entries).toHaveLength(2);
    expect(recording.entries[0]).toMatchObject({ method: 'complete', response: 'text' });
    expect(recording.entries[1]).toMatchObject({ method: 'structured', response: { ok: true } });

    const replay = RecordingLLMProvider.replaying(recording);
    await expect(replay.complete({ prompt: 'different' })).resolves.toMatchObject({ text: 'text' });
    await expect(replay.structured({ prompt: 'p', schema })).resolves.toEqual({ ok: true });
  });

  it('replays structured responses from raw model text', async () => {
    const delegate = new MockLLMProvider({ structured: '{"ok":true}' });
    const recorder = RecordingLLMProvider.recording(delegate);
    await recorder.structured({ prompt: 'p', schema });

    const replay = RecordingLLMProvider.replaying(recorder.recording);
    await expect(replay.structured({ prompt: 'p', schema })).resolves.toEqual({ ok: true });
  });

  it('records and revives provider failures', async () => {
    const delegate = new MockLLMProvider({ complete: new AIProviderError('offline') });
    const recorder = RecordingLLMProvider.recording(delegate);
    await expect(recorder.complete({ prompt: 'hi' })).rejects.toBeInstanceOf(AIProviderError);
    expect(recorder.recording.entries[0]?.error).toMatchObject({
      name: 'AIProviderError',
      message: 'offline',
    });

    const replay = RecordingLLMProvider.replaying(recorder.recording);
    await expect(replay.complete({ prompt: 'hi' })).rejects.toBeInstanceOf(AIProviderError);
  });

  it('throws when the recording is exhausted or methods mismatch', async () => {
    const delegate = new MockLLMProvider({ complete: 'text' });
    const recorder = RecordingLLMProvider.recording(delegate);
    await recorder.complete({ prompt: 'hi' });

    const replay = RecordingLLMProvider.replaying(recorder.recording);
    await expect(replay.chat([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(InternalError);
  });

  it('saves and loads recordings from disk', async () => {
    const path = await tempFile('recording.json');
    const delegate = new MockLLMProvider({ complete: 'persisted' });
    const recorder = RecordingLLMProvider.recording(delegate);
    await recorder.complete({ prompt: 'hi' });
    await recorder.save(path);

    const loaded = await loadRecording(path);
    expect(loaded.entries[0]?.response).toBe('persisted');
    const replay = RecordingLLMProvider.replaying(loaded);
    await expect(replay.complete({ prompt: 'any' })).resolves.toMatchObject({ text: 'persisted' });
  });

  it('reports healthy while replaying', async () => {
    const replay = RecordingLLMProvider.replaying({
      version: 1,
      provider: 'test',
      createdAt: new Date(0).toISOString(),
      entries: [],
    });
    await expect(replay.healthCheck()).resolves.toBe(true);
  });
});
