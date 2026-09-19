import { describe, expect, it } from 'vitest';
import { toDocx, toTxt } from './export.js';

describe('export', () => {
  it('normalizes TXT line endings and whitespace', () => {
    expect(toTxt('a\r\nb  \n\n\nc')).toBe('a\nb\n\nc');
  });

  it('produces a non-empty DOCX buffer (zip container)', async () => {
    const buffer = await toDocx('Alex Rivera\n- Led the payments platform migration.');
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
    // ZIP magic bytes: PK\x03\x04
    expect([buffer[0], buffer[1]]).toEqual([0x50, 0x4b]);
  });

  it('handles bullets and blank lines in DOCX export', async () => {
    const buffer = await toDocx('- bullet one\n\n- bullet two\nplain text');
    expect(buffer.length).toBeGreaterThan(100);
  });
});