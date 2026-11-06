export const CANONICAL_ORIGIN = 'https://www.carrime.app';

type AuthEnvironment = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  CRM_AUTH_URL?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
};

function originOf(value: string): string {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('CRM_AUTH_URL must be an origin without a path or credentials');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('CRM authentication requires HTTPS outside localhost');
  }
  return url.origin;
}

export function resolveCrmAuthOrigins(env: AuthEnvironment) {
  if (env.VERCEL_ENV === 'preview') {
    // Preview must never inherit the production base URL or trust every Vercel
    // project. Only this deployment and its branch alias are permitted.
    const origins = [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
      .filter((host): host is string => Boolean(host))
      .map((host) => originOf(`https://${host}`));
    if (origins.length === 0) throw new Error('Preview authentication hostname is not configured');
    return { baseURL: origins[0], trustedOrigins: [...new Set(origins)], secureCookies: true };
  }

  if (env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production') {
    const baseURL = originOf(env.CRM_AUTH_URL || CANONICAL_ORIGIN);
    if (baseURL !== CANONICAL_ORIGIN) throw new Error('Production CRM_AUTH_URL must match the canonical domain');
    return { baseURL, trustedOrigins: [baseURL], secureCookies: true };
  }

  const baseURL = originOf(env.CRM_AUTH_URL || 'http://localhost:3000');
  return {
    baseURL,
    trustedOrigins: [...new Set([baseURL, 'http://localhost:3000', 'http://localhost:3127'])],
    secureCookies: baseURL.startsWith('https:'),
  };
}
