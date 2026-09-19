/** Total years of experience from dated entries, overlaps merged. */

export interface ExperienceSpan {
  startDate: Date;
  endDate: Date | null;
  current: boolean;
}

/** Deterministic approximation: merge overlapping spans, sum their months. */
export function deriveExperienceYears(entries: readonly ExperienceSpan[], now: Date = new Date()): number {
  const spans: Array<[number, number]> = [];
  for (const entry of entries) {
    let end = entry.current ? now : entry.endDate;
    if (!end) end = entry.startDate;
    const start = entry.startDate;
    if (start > end) continue;
    spans.push([start.getTime(), end.getTime()]);
  }

  if (spans.length === 0) return 0;

  spans.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [spans[0]!];
  for (let i = 1; i < spans.length; i += 1) {
    const [s, e] = spans[i]!;
    const last = merged[merged.length - 1]!;
    if (s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }

  const totalMonths = merged.reduce((sum, [s, e]) => sum + (e - s) / (1000 * 60 * 60 * 24 * 30.44), 0);
  return totalMonths / 12;
}