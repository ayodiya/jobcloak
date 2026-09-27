import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBerlinStartupJobsJobSource } from './berlinstartupjobs/BerlinStartupJobsJobSource.js';
import { createJapanDevJobSource } from './japandev/JapanDevJobSource.js';
import { hasJobSource, listJobSources } from './registry.js';
import { createWantedlyJobSource } from './wantedly/WantedlyJobSource.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body: string | object): void {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(text)),
  );
}

const WANTEDLY_FIXTURE = {
  data: [
    {
      id: 2256501,
      title: 'クリエイティブ部隊立ち上げ！Webデザイン、グラフィックデザイナーさん募集',
      published_at: '2025-11-11T14:37:26.807+09:00',
      location: '東京都渋谷区渋谷2-21-1',
      description: '<p>デザイン部隊を募集しています。</p>',
      company: { id: 4256426, name: '株式会社アットマーク・ソリューション' },
      tags: [{ name: 'Webデザイン' }],
    },
  ],
  _metadata: { total_objects: 190204 },
};

describe('WantedlyJobSource', () => {
  it('maps Japanese project listings', async () => {
    stubFetch(WANTEDLY_FIXTURE);
    const [job] = await createWantedlyJobSource().search();
    expect(job).toMatchObject({
      sourceName: 'wantedly',
      title: 'クリエイティブ部隊立ち上げ！Webデザイン、グラフィックデザイナーさん募集',
      company: '株式会社アットマーク・ソリューション',
      location: '東京都渋谷区渋谷2-21-1',
      externalId: '2256501',
    });
    expect(job!.url).toBe('https://www.wantedly.com/projects/2256501');
    expect(job!.postedAt?.toISOString().slice(0, 10)).toBe('2025-11-11');
    expect(job!.description).toContain('デザイン部隊');
  });

  it('accepts epoch-seconds published_at', async () => {
    stubFetch({
      data: [{ ...WANTEDLY_FIXTURE.data[0], id: 1, published_at: 1_760_000_000 }],
    });
    const [job] = await createWantedlyJobSource().search();
    expect(job!.postedAt?.getUTCFullYear()).toBeGreaterThanOrEqual(2020);
  });
});

const JAPAN_DEV_FIXTURE = `<!doctype html><html><body>
<a href="/employer/jobs">Dashboard</a>
<a href="/jobs">Search Jobs</a>
<a href="/jobs/money-forward/money-forward-ai-engineer-erp-cross-functional-engineering-d">
  AI Engineer (AI Agent Platform Development), ERP
</a>
<a href="/jobs/micoworks/mico-lead-cloud-engineer-9k0te6">Lead Cloud Engineer</a>
<a href="/jobs/money-forward/money-forward-ai-engineer-erp-cross-functional-engineering-d">
  AI Engineer (AI Agent Platform Development), ERP
</a>
</body></html>`;

describe('JapanDevJobSource', () => {
  it('extracts jobs with company from the listing path and dedupes', async () => {
    stubFetch(JAPAN_DEV_FIXTURE);
    const jobs = await createJapanDevJobSource().search();
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      sourceName: 'japan-dev',
      title: 'AI Engineer (AI Agent Platform Development), ERP',
      company: 'money-forward',
    });
    expect(jobs[0]!.url).toBe(
      'https://japan-dev.com/jobs/money-forward/money-forward-ai-engineer-erp-cross-functional-engineering-d',
    );
    expect(jobs[1]).toMatchObject({ title: 'Lead Cloud Engineer', company: 'micoworks' });
  });
});

const BSC_FIXTURE = `<!doctype html><html><body>
<ul class="bjs-jlid__list">
<li class="bjs-jlid">
  <div class="bjs-jlid__wrapper">
    <div class="bjs-jlid__header">
      <div class="bjs-jlid__meta">
        <h4 class="bjs-jlid__h">
          <a href="https://berlinstartupjobs.com/engineering/product-engineer-withyou/">Product Engineer</a>
        </h4>
        <a class="bjs-jlid__b" href="https://berlinstartupjobs.com/companies/withyou/">withyou</a>
      </div>
    </div>
    <div class="bjs-jlid__description">We build the future of solar billing.</div>
  </div>
</li>
<li class="bjs-jlid">
  <div class="bjs-jlid__wrapper">
    <div class="bjs-jlid__header">
      <div class="bjs-jlid__meta">
        <h4 class="bjs-jlid__h">
          <a href="https://berlinstartupjobs.com/engineering/senior-fullstack-developer-typescript-javascript/">Senior Fullstack Developer &#8211; TypeScript</a>
        </h4>
        <a class="bjs-jlid__b" href="https://berlinstartupjobs.com/companies/acmecorp/">Acme Corp</a>
      </div>
    </div>
  </div>
</li>
</ul>
</body></html>`;

describe('BerlinStartupJobsJobSource', () => {
  it('pairs job title with company link per card', async () => {
    stubFetch(BSC_FIXTURE);
    const jobs = await createBerlinStartupJobsJobSource().search();
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      sourceName: 'berlinstartupjobs',
      title: 'Product Engineer',
      company: 'withyou',
    });
    expect(jobs[0]!.url).toBe(
      'https://berlinstartupjobs.com/engineering/product-engineer-withyou/',
    );
    expect(jobs[0]!.description).toBe('We build the future of solar billing.');
    expect(jobs[1]).toMatchObject({
      title: 'Senior Fullstack Developer – TypeScript',
      company: 'Acme Corp',
    });
  });

  it('crawls configured categories', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        calls.push(String(input));
        return new Response(BSC_FIXTURE);
      }),
    );
    const source = createBerlinStartupJobsJobSource({
      categories: ['/engineering/', '/design-ux/'],
    });
    await source.search();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('/engineering/');
    expect(calls[1]).toContain('/design-ux/');
  });
});

describe('built-in web sources registry', () => {
  it('registers the country board sources', () => {
    for (const name of ['berlinstartupjobs', 'japan-dev', 'wantedly']) {
      expect(hasJobSource(name)).toBe(true);
      expect(listJobSources()).toContain(name);
    }
  });
});
