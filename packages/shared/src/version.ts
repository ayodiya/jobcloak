/**
 * Runtime identity for the running build. Intentionally independent from
 * package.json so tools (tsx, tsc) cannot drift the reported version.
 */
export const SERVICE_VERSION = '0.1.0';
export const SERVICE_ALIAS = 'jobs-applications';