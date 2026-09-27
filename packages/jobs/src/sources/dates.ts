/** Listing feeds vary between ISO strings and Unix epoch seconds. */
export function toPostedDate(value: string | number | undefined): Date | undefined {
  if (value === undefined) return undefined;
  const ms = typeof value === 'number' ? value * 1000 : value;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
