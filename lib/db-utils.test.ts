import { describe, expect, test } from 'bun:test';
import { isPooledConnectionString } from './db-utils';

describe('isPooledConnectionString', () => {
  test('detecta pooler de Neon (-pooler en el host)', () => {
    expect(isPooledConnectionString(
      'postgresql://user:pass@ep-abc-123-pooler.us-east-2.aws.neon.tech/neondb',
    )).toBe(true);
  });

  test('detecta Supavisor de Supabase', () => {
    expect(isPooledConnectionString(
      'postgresql://postgres.abc:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
    )).toBe(true);
  });

  test('detecta pgbouncer por query param', () => {
    expect(isPooledConnectionString(
      'postgresql://user:pass@host:6432/db?pgbouncer=true',
    )).toBe(true);
  });

  test('conexión directa local no es pooler', () => {
    expect(isPooledConnectionString(
      'postgresql://postgres:postgres@localhost:5432/postgres',
    )).toBe(false);
  });

  test('conexión directa de Neon (sin -pooler) no es pooler', () => {
    expect(isPooledConnectionString(
      'postgresql://user:pass@ep-abc-123.us-east-2.aws.neon.tech/neondb',
    )).toBe(false);
  });
});
