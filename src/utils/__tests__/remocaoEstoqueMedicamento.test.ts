import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

// Executa a migração real de remoção com aprovação do gestor.
const db = new PGlite();
const sql = readFileSync('supabase/migrations/20261117155501_ac6dafa2-af03-4616-9e4d-98e7e602acd3.sql', 'utf8');
const F = '00000000-0000-0000-0000-000000000001', R = '00000000-0000-0000-0000-000000000002', E = '00000000-0000-0000-0000-000000000003';

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${F}'::uuid $$;
    CREATE TABLE funcionarios (id uuid PRIMARY KEY, tenant_id uuid, nome_completo text);
    CREATE TABLE residentes (id uuid PRIMARY KEY, nome_completo text);
    CREATE TABLE medicamentos (id uuid PRIMARY KEY, nome text);
    CREATE TABLE estoque_medicamentos (id uuid PRIMARY KEY, residente_id uuid, medicamento_id uuid, tipo_estoque text, quantidade_atual numeric, ativo boolean, tenant_id uuid);
    CREATE FUNCTION portal_med_funcionario() RETURNS uuid LANGUAGE sql AS $$ SELECT '${F}'::uuid $$;
    CREATE FUNCTION portal_med_residente_ok(uuid, uuid) RETURNS void LANGUAGE sql AS $$ SELECT $$;
    CREATE FUNCTION eh_gestor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.gestor', true) = 'sim' $$;
    CREATE FUNCTION has_tenant_access(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    INSERT INTO funcionarios VALUES ('${F}', NULL, 'Ana'); INSERT INTO residentes VALUES ('${R}', 'Maria');
    INSERT INTO medicamentos VALUES ('${R}', 'Losartana');
    INSERT INTO estoque_medicamentos VALUES ('${E}', '${R}', '${R}', 'residente', 7, true, NULL);`);
  await db.exec(sql);
});
afterAll(async () => { await db.close(); });
const ativo = async () => (await db.query<{ ativo: boolean }>(`SELECT ativo FROM estoque_medicamentos WHERE id='${E}'`)).rows[0].ativo;

describe.sequential('remoção de medicamento do estoque', () => {
  it('exige justificativa', async () => {
    await expect(db.query(`SELECT portal_solicitar_remocao_estoque('${E}', 'curto')`)).rejects.toThrow(/Justifique/);
  });
  it('retira temporariamente ao pedir', async () => {
    await db.query(`SELECT portal_solicitar_remocao_estoque('${E}', 'Remédio acabou e foi suspenso')`);
    expect(await ativo()).toBe(false);
  });
  it('só gestor decide', async () => {
    const id = (await db.query<{ id: string }>('SELECT id FROM remocoes_estoque_medicamentos')).rows[0].id;
    await expect(db.query('SELECT gestor_revisar_remocao_estoque($1, false)', [id])).rejects.toMatchObject({ code: '42501' });
  });
  it('recusa devolve ao estoque com a mesma quantidade', async () => {
    await db.query("SELECT set_config('test.gestor', 'sim', false)");
    const id = (await db.query<{ id: string }>('SELECT id FROM remocoes_estoque_medicamentos')).rows[0].id;
    await db.query('SELECT gestor_revisar_remocao_estoque($1, false)', [id]);
    expect(await ativo()).toBe(true);
    expect((await db.query<{ q: number }>(`SELECT quantidade_atual::int q FROM estoque_medicamentos WHERE id='${E}'`)).rows[0].q).toBe(7);
  });
  it('aprovação mantém removido', async () => {
    await db.query(`SELECT portal_solicitar_remocao_estoque('${E}', 'Remédio não existe mais')`);
    const id = (await db.query<{ id: string }>("SELECT id FROM remocoes_estoque_medicamentos WHERE status='pendente'")).rows[0].id;
    await db.query('SELECT gestor_revisar_remocao_estoque($1, true)', [id]);
    expect(await ativo()).toBe(false);
  });
});
