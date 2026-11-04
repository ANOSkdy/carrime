import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { hashPassword } from 'better-auth/crypto';
import { Pool } from 'pg';

export async function setupCrmAdmin({ pool, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Valid admin email is required');
  if (password.length < 12 || password.length > 128) throw new Error('Password must contain 12 to 128 characters');
  const migration = await readFile(new URL('../db/migrations/20261104_crm_auth.sql', import.meta.url), 'utf8');
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migration);
    const existing = await client.query('SELECT id FROM crm_auth_user WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount) {
      await client.query('COMMIT');
      return { created: false, email: normalizedEmail };
    }
    const id = randomUUID();
    await client.query('INSERT INTO crm_auth_user (id, name, email, "emailVerified", role, "mustChangePassword") VALUES ($1, $2, $3, true, $4, true)', [id, 'Carrime管理者', normalizedEmail, 'admin']);
    await client.query('INSERT INTO crm_auth_account (id, "accountId", "providerId", "userId", password) VALUES ($1, $2, $3, $4, $5)', [randomUUID(), id, 'credential', id, passwordHash]);
    await client.query('COMMIT');
    return { created: true, email: normalizedEmail };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    let value = '';
    for await (const chunk of process.stdin) value += chunk;
    return value.replace(/\r?\n$/, '');
  }
  process.stderr.write('Initial CRM admin password (hidden): ');
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const done = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stderr.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\r' || character === '\n') { done(); return; }
        if (character === '\u0003') { done(new Error('Cancelled')); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const email = process.argv[process.argv.indexOf('--email') + 1];
  if (!process.argv.includes('--email') || !email) {
    console.error('Usage: node --env-file-if-exists=.env.local scripts/setup-crm-admin.mjs --email <email>; provide the initial password on stdin.');
    process.exit(1);
  }
  let password = await readPassword();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL, max: 1 });
  try {
    console.log(JSON.stringify(await setupCrmAdmin({ pool, email, password })));
  } catch {
    console.error('CRM admin setup failed. No password or database details are logged.');
    process.exitCode = 1;
  } finally {
    password = '';
    await pool.end();
  }
}
