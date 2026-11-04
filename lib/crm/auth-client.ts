'use client';

import { createAuthClient } from 'better-auth/react';

export const crmAuthClient = createAuthClient({ basePath: '/api/crm-auth' });
