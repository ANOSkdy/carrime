import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCrmAuth } from './auth';
import { getCrmAccess } from './access';

export async function getCrmSessionFromHeaders(incoming: Headers) {
  if (!incoming.get('cookie')) return null;
  return getCrmAuth().api.getSession({ headers: incoming, query: { disableCookieCache: true } });
}

export const getCrmSession = cache(async () => getCrmSessionFromHeaders(await headers()));

export async function requireCrmAdmin() {
  const session = await getCrmSession();
  const access = getCrmAccess(session);
  if (access === 'anonymous' || access === 'forbidden') redirect('/crm/login');
  if (access === 'password-change') redirect('/crm/password');
  return session!;
}
