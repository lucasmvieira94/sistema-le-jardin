import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

// Execute the real PostgreSQL authorization function, not a JS copy of its rules.
const db = new PGlite();
const employee = '00000000-0000-0000-0000-000000000001';
const migration = readFileSync('supabase/migrations/20261102044240_3b3af7e9-4a37-446c-a7a4-ca2508a6b5cd.sql', 'utf8');
const original = readFileSync('supabase/migrations/20261027180420_351bf2de-a9e9-4812-bd22-2cefbfd0e6cd.sql', 'utf8');

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.funcionarios (id uuid, tenant_id uuid);
    CREATE FUNCTION public.portal_funcionario_atual() RETURNS uuid LANGUAGE sql AS $$
      SELECT nullif(current_setting('test.employee', true), '')::uuid $$;
    CREATE FUNCTION public.modulos_funcionario(uuid) RETURNS text[] LANGUAGE sql AS $$
      SELECT current_setting('test.modules', true)::text[] $$;
    CREATE FUNCTION public.portal_eh_supervisor() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;`);
  await db.exec(migration);
  // These production RPCs check supervisor status before querying any stock data.
  for (const name of ['portal_entrada_estoque_emergencia', 'portal_movimentos_emergencia']) {
    const start = original.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    const end = original.indexOf('END $$;', start) + 'END $$;'.length;
    await db.exec(original.slice(start, end));
  }
});
afterAll(async () => { await db.close(); });

async function session(id: string, modules: string[]) {
  await db.query("SELECT set_config('test.employee', $1, false), set_config('test.modules', $2, false)", [id, `{${modules.join(',')}}`]);
}

describe.sequential('permissões SQL de medicamentos', () => {
  it('permite medicamentos sem liberar Portal de Cuidados', async () => {
    await session(employee, ['medicamentos']);
    const result = await db.query<{ id: string }>('SELECT public.portal_med_funcionario() AS id');
    expect(result.rows[0].id).toBe(employee);
  });
  it('permite medicamentos dentro do Portal de Cuidados', async () => {
    await session(employee, ['portal_cuidados', 'medicamentos']);
    expect((await db.query<{ id: string }>('SELECT public.portal_med_funcionario() AS id')).rows[0].id).toBe(employee);
  });
  it('nega sem passe válido, expirado ou revogado (identidade nula)', async () => {
    await session('', ['medicamentos']);
    await expect(db.query('SELECT public.portal_med_funcionario()')).rejects.toMatchObject({ code: '42501' });
  });
  it('nega Portal de Cuidados sem módulo Medicamentos', async () => {
    await session(employee, ['portal_cuidados']);
    await expect(db.query('SELECT public.portal_med_funcionario()')).rejects.toMatchObject({ code: '42501' });
  });
  it('mantém entrada no estoque institucional exclusiva de supervisor', async () => {
    await session(employee, ['medicamentos']);
    await expect(db.query("SELECT public.portal_entrada_estoque_emergencia('Teste', 1, 'L1', CURRENT_DATE)")).rejects.toMatchObject({ code: '42501', message: 'Somente supervisores' });
  });
  it('mantém histórico institucional exclusivo de supervisor', async () => {
    await session(employee, ['medicamentos']);
    await expect(db.query('SELECT * FROM public.portal_movimentos_emergencia()')).rejects.toMatchObject({ code: '42501', message: 'Somente supervisores' });
  });
  it('não expõe o helper diretamente ao navegador', async () => {
    expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege('anon', 'public.portal_med_funcionario()', 'EXECUTE') AS allowed")).rows[0].allowed).toBe(false);
  });
});