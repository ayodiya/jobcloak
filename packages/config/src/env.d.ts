import { z } from 'zod';
export declare const AutomationModeSchema: z.ZodEnum<["safe", "review", "auto_apply"]>;
export type AutomationMode = z.infer<typeof AutomationModeSchema>;
export declare const LogLevelSchema: z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace", "silent"]>;
/**
 * Source of truth for the application configuration.
 *
 * Every variable used by the system is declared here with validation and safe
 * development defaults. Unknown or invalid values fail fast at boot.
 */
export declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace", "silent"]>>;
    DATABASE_URL: z.ZodDefault<z.ZodString>;
    REDIS_URL: z.ZodDefault<z.ZodString>;
    OLLAMA_BASE_URL: z.ZodDefault<z.ZodString>;
    OLLAMA_MODEL: z.ZodDefault<z.ZodString>;
    OLLAMA_TIMEOUT_MS: z.ZodDefault<z.ZodNumber>;
    AUTOMATION_MODE: z.ZodDefault<z.ZodEnum<["safe", "review", "auto_apply"]>>;
    JOB_MATCH_THRESHOLD: z.ZodDefault<z.ZodNumber>;
    AUTO_APPLY_THRESHOLD: z.ZodDefault<z.ZodNumber>;
    APPLICATION_DAILY_LIMIT: z.ZodDefault<z.ZodNumber>;
    JOB_DISCOVERY_DAILY_LIMIT: z.ZodDefault<z.ZodNumber>;
    APPLICATION_PREPARATION_DAILY_LIMIT: z.ZodDefault<z.ZodNumber>;
    API_HOST: z.ZodDefault<z.ZodString>;
    API_PORT: z.ZodDefault<z.ZodNumber>;
    WEB_PORT: z.ZodDefault<z.ZodNumber>;
    WEB_ORIGIN: z.ZodDefault<z.ZodString>;
    BROWSER_DATA_DIR: z.ZodDefault<z.ZodString>;
    BROWSER_HEADLESS: z.ZodDefault<z.ZodEffects<z.ZodString, boolean, string>>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
    DATABASE_URL: string;
    REDIS_URL: string;
    OLLAMA_BASE_URL: string;
    OLLAMA_MODEL: string;
    OLLAMA_TIMEOUT_MS: number;
    AUTOMATION_MODE: "safe" | "review" | "auto_apply";
    JOB_MATCH_THRESHOLD: number;
    AUTO_APPLY_THRESHOLD: number;
    APPLICATION_DAILY_LIMIT: number;
    JOB_DISCOVERY_DAILY_LIMIT: number;
    APPLICATION_PREPARATION_DAILY_LIMIT: number;
    API_HOST: string;
    API_PORT: number;
    WEB_PORT: number;
    WEB_ORIGIN: string;
    BROWSER_DATA_DIR: string;
    BROWSER_HEADLESS: boolean;
}, {
    NODE_ENV?: "development" | "test" | "production" | undefined;
    LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent" | undefined;
    DATABASE_URL?: string | undefined;
    REDIS_URL?: string | undefined;
    OLLAMA_BASE_URL?: string | undefined;
    OLLAMA_MODEL?: string | undefined;
    OLLAMA_TIMEOUT_MS?: number | undefined;
    AUTOMATION_MODE?: "safe" | "review" | "auto_apply" | undefined;
    JOB_MATCH_THRESHOLD?: number | undefined;
    AUTO_APPLY_THRESHOLD?: number | undefined;
    APPLICATION_DAILY_LIMIT?: number | undefined;
    JOB_DISCOVERY_DAILY_LIMIT?: number | undefined;
    APPLICATION_PREPARATION_DAILY_LIMIT?: number | undefined;
    API_HOST?: string | undefined;
    API_PORT?: number | undefined;
    WEB_PORT?: number | undefined;
    WEB_ORIGIN?: string | undefined;
    BROWSER_DATA_DIR?: string | undefined;
    BROWSER_HEADLESS?: string | undefined;
}>;
export type Env = z.infer<typeof envSchema>;
/** Parse and validate a raw environment object. Throws ConfigError on failure. */
export declare function parseEnv(raw?: Record<string, string | undefined>): Env;
/**
 * Load the resolved application configuration from the current process environment.
 * Cached per content snapshot; call `resetConfig` in tests between cases.
 */
export declare function loadConfig(raw?: Record<string, string | undefined>): Env;
export declare function resetConfig(raw?: Record<string, string | undefined>): void;
/**
 * Load a `.env` file into process.env using Node's native loader. No-op when
 * the file is absent (callers that already have env set — e.g. CI — are fine).
 */
export declare function loadEnvFileIfExists(path?: string): void;
export declare const AUTOMATION_MODES: AutomationMode[];
