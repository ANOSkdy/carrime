import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

type QueryResult<T> = { rows: T[] };
export type SqlStatement = { query: string; params: unknown[] };
const metrics = new AsyncLocalStorage<{ requests: number }>();

export async function measureDatabaseRequests<T>(run: () => Promise<T>) {
  const state = { requests: 0 };
  return metrics.run(state, async () => ({ value: await run(), requests: state.requests }));
}

type DatabaseEnvKey = 'DATABASE_URL_UNPOOLED' | 'DATABASE_URL' | 'NEON_DATABASE_URL';
type EnvValueState = 'missing' | 'empty' | 'set';

const DATABASE_ENV_KEYS: DatabaseEnvKey[] = ['DATABASE_URL_UNPOOLED', 'DATABASE_URL', 'NEON_DATABASE_URL'];

type DatabaseConfigMeta = {
  selectedKey: DatabaseEnvKey | null;
  selectedState: EnvValueState;
  envStateByKey: Record<DatabaseEnvKey, EnvValueState>;
  sqlHttpUrlState: EnvValueState;
  protocol: string | null;
  hasHostname: boolean;
  vercelEnv: string;
  nodeEnv: string;
};

const readEnvState = (value: string | undefined): EnvValueState => {
  if (value === undefined) return 'missing';
  if (!value.trim()) return 'empty';
  return 'set';
};

export const resolveDatabaseConfigMeta = (): DatabaseConfigMeta => {
  const envStateByKey = DATABASE_ENV_KEYS.reduce(
    (acc, key) => {
      acc[key] = readEnvState(process.env[key]);
      return acc;
    },
    {} as Record<DatabaseEnvKey, EnvValueState>
  );

  const selectedKey = DATABASE_ENV_KEYS.find((key) => envStateByKey[key] === 'set') ?? null;
  const selectedRaw = selectedKey ? process.env[selectedKey] : undefined;
  const selectedState = selectedKey ? envStateByKey[selectedKey] : 'missing';

  let protocol: string | null = null;
  let hasHostname = false;

  if (selectedRaw?.trim()) {
    try {
      const parsed = new URL(selectedRaw.trim());
      protocol = parsed.protocol;
      hasHostname = Boolean(parsed.hostname);
    } catch {
      protocol = 'malformed';
    }
  }

  return {
    selectedKey,
    selectedState,
    envStateByKey,
    sqlHttpUrlState: readEnvState(process.env.NEON_SQL_HTTP_URL),
    protocol,
    hasHostname,
    vercelEnv: process.env.VERCEL_ENV ?? 'local',
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
  };
};

const resolveDatabaseUrl = () => {
  const meta = resolveDatabaseConfigMeta();

  if (!meta.selectedKey) {
    throw new Error(
      `Database connection is not configured (keys: ${DATABASE_ENV_KEYS.join(', ')}, states=${JSON.stringify(meta.envStateByKey)})`
    );
  }

  const raw = process.env[meta.selectedKey];
  if (!raw) {
    throw new Error(`Database connection resolved to ${meta.selectedKey} but value is missing`);
  }

  const connectionString = raw.trim();
  if (!connectionString) {
    throw new Error(`Database connection resolved to ${meta.selectedKey} but value is empty`);
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error(`Database connection in ${meta.selectedKey} is malformed`);
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(
      `Database connection in ${meta.selectedKey} must use postgres:// or postgresql:// (received ${parsed.protocol})`
    );
  }

  if (!parsed.hostname) {
    throw new Error(`Database connection in ${meta.selectedKey} is missing hostname`);
  }

  return connectionString;
};

const getSqlEndpoint = () => {
  const explicit = process.env.NEON_SQL_HTTP_URL?.trim();
  if (explicit) return explicit;

  const url = new URL(resolveDatabaseUrl());
  return `https://${url.host}/sql`;
};

const buildNeonHeaders = () => ({
  'Content-Type': 'application/json',
  'Neon-Connection-String': resolveDatabaseUrl(),
});

async function execute(body: SqlStatement | { queries: SqlStatement[] }) {
  const state = metrics.getStore();
  if (state) state.requests++;
  const response = await fetch(getSqlEndpoint(), {
    method: 'POST',
    headers: { ...buildNeonHeaders(), ...('queries' in body ? { 'Neon-Batch-Isolation-Level': 'ReadCommitted' } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    // Provider messages can echo query parameters or credentials.
    throw new Error(`Postgres request failed (${response.status})`);
  }

  return response.json();
}

export async function query<T>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const payload = await execute({ query: text, params });
  if (!Array.isArray(payload.rows)) throw new Error('Invalid Postgres response');
  return { rows: payload.rows };
}

// Neon's queries envelope executes the entire batch as ONE transaction in ONE
// HTTP request. Separate HTTP BEGIN/COMMIT calls do not share a session.
export async function queryBatch<T>(statements: SqlStatement[]): Promise<QueryResult<T>[]> {
  if (!statements.length) return [];
  const payload = await execute({ queries: statements });
  if (!Array.isArray(payload.results) || payload.results.length !== statements.length ||
    payload.results.some((result: QueryResult<T> | null) => !result || !Array.isArray(result.rows))) {
    throw new Error('Invalid Postgres batch response');
  }
  return payload.results;
}
