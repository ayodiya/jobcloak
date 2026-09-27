import { NotFoundError, ValidationError } from '@jobs-app/shared';
import type { JobSource, JobSourceFactory } from './JobSource.js';
import {
  arbeitnowJobSourceFactory,
  sponsorshipJobSourceFactory,
} from './arbeitnow/ArbeitnowJobSource.js';
import { berlinStartupJobsJobSourceFactory } from './berlinstartupjobs/BerlinStartupJobsJobSource.js';
import { fixtureJobSourceFactory } from './fixture/FixtureJobSource.js';
import { japanDevJobSourceFactory } from './japandev/JapanDevJobSource.js';
import { jobicyJobSourceFactory } from './jobicy/JobicyJobSource.js';
import { jobzillaJobSourceFactory } from './jobzilla/JobzillaJobSource.js';
import { myJobMagJobSourceFactory } from './myjobmag/MyJobMagJobSource.js';
import { remoteOkJobSourceFactory } from './remoteok/RemoteOkJobSource.js';
import { remotiveJobSourceFactory } from './remotive/RemotiveJobSource.js';
import { wantedlyJobSourceFactory } from './wantedly/WantedlyJobSource.js';

const registry = new Map<string, JobSourceFactory>();

/** Register (or replace) a source factory. Names must be stable identifiers. */
export function registerJobSource(name: string, factory: JobSourceFactory): void {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    throw new ValidationError(`Invalid job source name: ${name}`);
  }
  registry.set(name, factory);
}

export function hasJobSource(name: string): boolean {
  return registry.has(name);
}

export function listJobSources(): string[] {
  return [...registry.keys()].sort();
}

/** Instantiate a source by name, failing fast on unknown names. */
export function createJobSource(name: string, options?: unknown): JobSource {
  const factory = registry.get(name);
  if (!factory) throw new NotFoundError(`Unknown job source: ${name}`);
  const source = factory(options);
  if (source.name !== name) {
    throw new ValidationError(
      `Job source factory '${name}' produced a source named '${source.name}'`,
    );
  }
  return source;
}

/** Test helper: drop all registrations. */
export function clearJobSources(): void {
  registry.clear();
}

registerJobSource('arbeitnow', arbeitnowJobSourceFactory);
registerJobSource('berlinstartupjobs', berlinStartupJobsJobSourceFactory);
registerJobSource('fixture', fixtureJobSourceFactory);
registerJobSource('japan-dev', japanDevJobSourceFactory);
registerJobSource('jobicy', jobicyJobSourceFactory);
registerJobSource('jobzilla', jobzillaJobSourceFactory);
registerJobSource('myjobmag', myJobMagJobSourceFactory);
registerJobSource('remoteok', remoteOkJobSourceFactory);
registerJobSource('remotive', remotiveJobSourceFactory);
registerJobSource('sponsorship', sponsorshipJobSourceFactory);
registerJobSource('wantedly', wantedlyJobSourceFactory);
