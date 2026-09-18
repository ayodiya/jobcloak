# @jobs-app/config

Validated, typed application configuration.

## What it does

- Declares **every** environment variable the system reads as a Zod schema.
- Fails fast at boot on invalid values (bad URLs, out-of-range thresholds, unknown modes).
- Provides safe development defaults so a contributor can get running without
  filling in dozens of variables.
- Caches parsed output; `resetConfig()` exists for tests.

## Usage

```ts
import { loadConfig } from '@jobs-app/config';

const config = loadConfig(); // process.env
config.AUTOMATION_MODE; // 'review'
config.JOB_MATCH_THRESHOLD; // 70
```

Wrap values in `z.coerce.*` callers when non-env input arrives loosely typed:
every environment variable arrives as a string.

## Rules

- Never hard-code an environment-dependent value outside this package.
- Add new variables here first, then to `.env.example` and this package's tests.
- Do not import application packages (no circular config); config is a leaf.