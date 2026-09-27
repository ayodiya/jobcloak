import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJobzillaJobSource } from './jobzilla/JobzillaJobSource.js';
import { createMyJobMagJobSource } from './myjobmag/MyJobMagJobSource.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubHtml(body: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body)),
  );
}

function card(
  overrides: Partial<Record<'title' | 'desc' | 'date' | 'alt', string>> = {},
): string {
  const title = overrides.title ?? 'Manager: Laundry Service at Veritaspeak Consultancy';
  const desc = overrides.desc ?? 'Veritaspeak Consultancy is an HR consulting firm.';
  const date = overrides.date ?? '<li id="job-date">26 September</li>';
  const alt = overrides.alt ?? 'Veritaspeak Consultancy';
  return `<li class="job-list-li"><ul>
    <li class="job-logo"><a href="/jobs-at/acme"><img src="/company_logo/86/x.png" alt="${alt}" width="100%" height="auto" /></a></li>
    <li class="job-info"><ul>
      <li class="mag-b"><h2><a style=" " href="/job/manager-laundry-service-test">${title}</a></h2></li>
      <li class="job-desc">${desc}</li>
      <li class="job-item"><ul>${date}</ul></li>
    </ul></li></ul>
  </li>`;
}

describe('MyJobMagJobSource', () => {
  it('maps title, company, URL and description from a card', async () => {
    stubHtml(`<html><body>${card()}</body></html>`);
    const [job] = await createMyJobMagJobSource().search();
    expect(job).toMatchObject({
      sourceName: 'myjobmag',
      title: 'Manager: Laundry Service',
      company: 'Veritaspeak Consultancy',
      description: 'Veritaspeak Consultancy is an HR consulting firm.',
      url: 'https://www.myjobmag.com/job/manager-laundry-service-test',
    });
  });

  it('parses a human date like "26 September"', async () => {
    stubHtml(card());
    const [job] = await createMyJobMagJobSource().search();
    expect(job!.postedAt).toBeInstanceOf(Date);
    const posted = job!.postedAt!;
    expect(posted.getUTCMonth()).toBe(8);
    expect(posted.getUTCDate()).toBe(26);
    const year = new Date().getFullYear();
    expect([year, year - 1]).toContain(posted.getUTCFullYear());
  });

  it('handles "Yesterday" dates', async () => {
    stubHtml(card({ date: '<li id="job-date">Yesterday</li>' }));
    const [job] = await createMyJobMagJobSource().search();
    const diffMs = Date.now() - job!.postedAt!.getTime();
    expect(diffMs).toBeGreaterThan(0);
    expect(diffMs).toBeLessThan(2 * 24 * 60 * 60 * 1000);
  });

  it('falls back to the logo alt when the title has no " at " separator', async () => {
    stubHtml(card({ title: 'Software Engineer', alt: 'Innoloft' }));
    const [job] = await createMyJobMagJobSource().search();
    expect(job).toMatchObject({ title: 'Software Engineer', company: 'Innoloft' });
  });

  it('parses multiple cards on the page', async () => {
    stubHtml(
      card() + card({ title: 'Accountant at KWZ Ltd', alt: 'KWZ Ltd', desc: 'Finance role.' }),
    );
    const jobs = await createMyJobMagJobSource().search();
    expect(jobs).toHaveLength(2);
  });
});

const JOBZILLA_HTML = [
  '<div><a href="/jobs/sales-business-development-opportunity-at-chiwiq-325916">',
  'Sales &amp; Business Development Opportunity at Chiwiq</a></div>',
  '<div><a href="/jobs/sales-business-development-opportunity-at-chiwiq-325916">Apply Now</a></div>',
  '<div><a href="/jobs/head-of-finance-at-landgate-investment-limited-328783">',
  'Head of Finance at Landgate Investment Limited</a></div>',
  '<div><a href="/jobs/too-short-5">Nope</a></div>',
].join('');

describe('JobzillaJobSource', () => {
  it('extracts, dedupes and ignores noise links', async () => {
    stubHtml(JOBZILLA_HTML);
    const jobs = await createJobzillaJobSource().search();
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.title)).toEqual([
      'Sales &amp; Business Development Opportunity',
      'Head of Finance',
    ]);
    expect(jobs[0]).toMatchObject({
      sourceName: 'jobzilla',
      company: 'Chiwiq',
      url: 'https://www.jobzilla.ng/jobs/sales-business-development-opportunity-at-chiwiq-325916',
    });
  });
});
