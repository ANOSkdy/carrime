import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';

type CrmAuthOptions = {
  database: BetterAuthOptions['database'];
  secret: string;
  baseURL?: string;
  trustedOrigins: string[];
  secureCookies: boolean;
  rateLimitEnabled?: boolean;
};

export function createCrmAuth(options: CrmAuthOptions) {
  return betterAuth({
    appName: 'Carrime CRM',
    basePath: '/api/crm-auth',
    baseURL: options.baseURL,
    secret: options.secret,
    database: options.database,
    trustedOrigins: options.trustedOrigins,
    // Route-level structured logs record status/code without raw auth errors.
    logger: { disabled: true },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: {
      modelName: 'crm_auth_user',
      additionalFields: {
        role: { type: ['admin', 'user'], defaultValue: 'user', input: false },
        mustChangePassword: { type: 'boolean', defaultValue: true, input: false },
      },
    },
    account: { modelName: 'crm_auth_account' },
    verification: { modelName: 'crm_auth_verification' },
    session: {
      modelName: 'crm_auth_session',
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: 'carrime-crm',
      useSecureCookies: options.secureCookies,
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: options.secureCookies, path: '/' },
    },
    rateLimit: {
      enabled: options.rateLimitEnabled ?? true,
      storage: 'database',
      modelName: 'crm_auth_rate_limit',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 300, max: 5 },
        '/change-password': { window: 300, max: 5 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/change-password' && ctx.body?.newPassword === ctx.body?.currentPassword) {
          throw new APIError('BAD_REQUEST', { message: 'Choose a different password.' });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/change-password' || ctx.context.returned instanceof APIError) return;
        const session = ctx.context.session;
        const returned = ctx.context.returned;
        if (!session || !returned || typeof returned !== 'object' || !('user' in returned)) return;
        await ctx.context.internalAdapter.updateUser(session.user.id, { mustChangePassword: false });
      }),
    },
  });
}
