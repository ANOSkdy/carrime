import 'server-only';
import { Pool } from 'pg';
import { createCrmAuth } from './auth-config';
import { resolveCrmAuthOrigins } from './auth-origins';

let auth: ReturnType<typeof createCrmAuth> | undefined;

export function getCrmAuth() {
  if (auth) return auth;
  const secret = process.env.CRM_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('CRM_AUTH_SECRET must contain at least 32 characters');
  const connectionString = (process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.NEON_DATABASE_URL)?.trim();
  if (!connectionString) throw new Error('CRM authentication database is not configured');

  auth = createCrmAuth({
    database: new Pool({ connectionString, max: 3, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000 }),
    secret,
    ...resolveCrmAuthOrigins(process.env),
  });
  return auth;
}
