# How to add a job source

A job source wraps an accessible, permitted source of job listings — a public board,
an employer ATS that allows access, or a manual sheet. This guide gets a contributor
from "I want to add a source" to a tested `JobSource` registered in the system.

## 1. Understand the interface

`packages/jobs/src/sources/JobSource.ts`:

```ts
interface JobSource {
  name: string;
  search(params: JobSearchParams): Promise<Job[]>;
  getJob(url: string): Promise<Job>;
  healthCheck(): Promise<boolean>;
}
```

- `search` returns normalized jobs (or an empty array).
- `getJob` fetches a single job by URL (used by the worker for parsing).
- `healthCheck` reports whether the source is reachable/usable. It must not otherwise
  mutate state.

The `jobs` package normalizes further, deduplicates, and extracts requirements.
Your source returns reasonable normalized shape; you do **not** need to handle
matching or storage.

## 2. Create the source

Create `packages/jobs/src/sources/<name>/<name>.ts`:

```ts
import { z } from 'zod';
import { Job, JobSearchParams, JobSource } from '../JobSource.js';

const OptionsSchema = z.object({ baseUrl: z.string().url() });

export class ExampleJobSource implements JobSource {
  readonly name = 'example';
  private readonly opts: z.infer<typeof OptionsSchema>;

  constructor(opts: unknown = {}) {
    this.opts = OptionsSchema.parse(opts);   // fail fast on bad config
  }

  async search(params: JobSearchParams): Promise<Job[]> {
    // params: query, location, remote, page, limit, since
    const response = await fetch(`${this.opts.baseUrl}/api/jobs?...`);
    if (!response.ok) {
      throw new SourceError('ExampleJobSource request failed', {
        status: response.status,
      });
    }
    return (await response.json()).map((r: unknown) => this.toJob(r));
  }

  async getJob(url: string): Promise<Job> {
    const response = await fetch(url);
    if (!response.ok) throw new SourceError('getJob failed', { url, status: response.status });
    const body = await response.json();
    return this.toJob(body);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.opts.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private toJob(raw: unknown): Job {
    // Map the source's shape to the normalized Job shape. Keep it pure.
  }
}
```

Use `zod` to validate the source's JSON at the boundary (`parse` it with a local schema
for `search`). Never trust raw API shapes.

## 3. Register the source and its tests

- Register in `packages/jobs/src/sources/registry.ts` (a `Record<string, () => JobSource>`
  factory map).
- Add fixtures in `tests/fixtures/jobs/` for the source's responses (realistic,
  fictional).
- Write unit tests in `packages/jobs/src/sources/<name>/<name>.test.ts`:
  - `search` maps fixture JSON into normalized jobs
  - `getJob` handles 404/network error
  - malformed payloads are rejected (Zod)
  - `healthCheck` returns false on failure, true on `200`

## 4. Ethics and automation constraints

Before writing a `search`/`getJob` that hits a live site, confirm the site permits the
access you are using:

- Respect `robots.txt` and the site's terms.
- Do not bypass CAPTCHA, authentication, rate limits, access controls, paywalls, or
  anti-bot protections.
- If the site does not permit automation, implement the interface for **manual import**
  (fixtures/CSV) instead and document it in the source's README.

## 5. Run the checks

```bash
npm run lint
npm run typecheck
npm run test:unit -- @jobs-app/jobs
npm run test:integration -- @jobs-app/jobs
```

## 6. Commit

Use Conventional Commits:

```text
feat(jobs): add ExampleJobSource adapter
test(jobs): add ExampleJobSource fixtures and tests
docs(guides): document adding a job source
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for requirements (branch from `develop`,
focused commits, PR against `develop`).