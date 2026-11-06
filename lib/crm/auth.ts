import 'server-only';
import { Pool } from 'pg';
import { createCrmAuth } from './auth-config';

let auth: ReturnType<typeof createCrmAuth> | undefined;

export function getCrmAuth() {
  if (auth) return auth;
  const secret = process.env.CRM_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('CRM_AUTH_SECRET must contain at least 32 characters');
  const connectionString = (process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.NEON_DATABASE_URL)?.trim();
  if (!connectionString) throw new Error('CRM authentication database is not configured');

  const trustedOrigins = [
    process.env.CRM_AUTH_URL,
    process.env.APP_BASE_URL,
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
      .filter(Boolean).map((host) => `https://${host}`),
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:3127'] : []),
  ].filter((origin): origin is string => Boolean(origin));

  auth = createCrmAuth({
    database: new Pool({ connectionString, max: 3, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000 }),
    secret,
    baseURL: process.env.CRM_AUTH_URL?.trim() || undefined,
    trustedOrigins: [...new Set(trustedOrigins)],
    secureCookies: process.env.NODE_ENV === 'production',
  });
  return auth;
}
