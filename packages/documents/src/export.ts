/**
 * File export for generated materials: clean TXT natively and DOCX via the
 * pure-JS `docx` builder (no binary dependencies, fully local).
 */
import { Document, Packer, Paragraph, TextRun } from 'docx';

const BULLET_RE = /^[-•]\s+/;

/** Normalize a generated material to export-ready plain text. */
export function toTxt(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

/** Render a generated material as a DOCX buffer. Pure JS; safe for local use. */
export async function toDocx(content: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];
  for (const raw of toTxt(content).split('\n')) {
    if (raw.trim().length === 0) {
      paragraphs.push(new Paragraph({ children: [emptyRun()], spacing: { after: 120 } }));
      continue;
    }
    const bullet = BULLET_RE.test(raw);
    const text = bullet ? raw.replace(BULLET_RE, '') : raw;
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text })],
        bullet: bullet ? { level: 0 } : undefined,
        spacing: { after: 80 },
      }),
    );
  }

  const document = new Document({
    sections: [{ children: paragraphs }],
  });
  return Packer.toBuffer(document);
}

function emptyRun(): TextRun {
  return new TextRun({ text: '', size: 22 });
}