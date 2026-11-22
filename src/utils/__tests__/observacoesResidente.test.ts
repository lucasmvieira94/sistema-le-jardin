import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

// Executa a migração real das observações dos residentes.
const db = new PGlite();
const F = '00000000-0000-0000-0000-000000000001', R = '00000000-0000-0000-0000-000000000002';

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${F}'::uuid $$;
    CREATE TABLE funcionarios (id uuid PRIMARY KEY, tenant_id uuid, nome_completo text);
    CREATE TABLE residentes (id uuid PRIMARY KEY, nome_completo text, ativo boolean, tenant_id uuid);
    CREATE FUNCTION portal_cuidados_funcionario() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.func', true), '')::uuid $$;
    CREATE FUNCTION eh_gestor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.gestor', true) = 'sim' $$;
    CREATE FUNCTION has_tenant_access(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    INSERT INTO funcionarios VALUES ('${F}', NULL, 'Ana'); INSERT INTO residentes VALUES ('${R}', 'Maria', true, NULL);`);
  await db.exec(readFileSync('supabase/migrations/20261122004917_ade94ce7-0f34-43fa-b595-dabd1d42c05c.sql', 'utf8'));
});
afterAll(async () => { await db.close(); });
const cuidadora = (on: boolean) => db.query("SELECT set_config('test.func', $1, false)", [on ? F : '']);
const gestor = (on: boolean) => db.query("SELECT set_config('test.gestor', $1, false)", [on ? 'sim' : 'nao']);
const ativas = async () => (await db.query<{ id: string }>(`SELECT id FROM portal_observacoes_residente('${R}')`)).rows;

describe.sequential('observações do residente', () => {
  it('bloqueia sem passe do portal', async () => {
    await cuidadora(false);
    await expect(db.query(`SELECT * FROM portal_observacoes_residente('${R}')`)).rejects.toMatchObject({ code: '42501' });
  });
  it('sem prazo por padrão e validade não pode ser no passado', async () => {
    await cuidadora(true);
    await db.query(`SELECT portal_criar_observacao('${R}', 'Prefere banho à tarde')`);
    expect((await db.query<{ v: string | null }>('SELECT valida_ate v FROM residentes_observacoes')).rows[0].v).toBeNull();
    await expect(db.query(`SELECT portal_criar_observacao('${R}', 'Teste antigo', obs_hoje() - 1)`)).rejects.toThrow(/anterior a hoje/);
  });
  it('observação vencida some da ficha', async () => {
    await db.query(`INSERT INTO residentes_observacoes (residente_id, texto, valida_ate) VALUES ('${R}', 'Vencida', obs_hoje() - 2)`);
    expect((await ativas()).length).toBe(1);
  });
  it('exclusão pede justificativa e retira temporariamente', async () => {
    const id = (await ativas())[0].id;
    await expect(db.query('SELECT portal_solicitar_remocao_observacao($1, $2)', [id, 'curto'])).rejects.toThrow(/Justifique/);
    await db.query('SELECT portal_solicitar_remocao_observacao($1, $2)', [id, 'Não vale mais para ela']);
    expect((await ativas()).length).toBe(0);
  });
  it('só gestor decide; recusa devolve e aprovação remove', async () => {
    const id = (await db.query<{ id: string }>("SELECT id FROM residentes_observacoes WHERE status='remocao_pendente'")).rows[0].id;
    await gestor(false);
    await expect(db.query('SELECT gestor_revisar_remocao_observacao($1, false)', [id])).rejects.toMatchObject({ code: '42501' });
    await gestor(true);
    await db.query('SELECT gestor_revisar_remocao_observacao($1, false)', [id]);
    expect((await ativas()).length).toBe(1);
    await db.query('SELECT portal_solicitar_remocao_observacao($1, $2)', [id, 'Agora sim, não vale mais']);
    await db.query('SELECT gestor_revisar_remocao_observacao($1, true)', [id]);
    expect((await ativas()).length).toBe(0);
    expect((await db.query<{ s: string }>('SELECT status s FROM residentes_observacoes WHERE id=$1', [id])).rows[0].s).toBe('removida');
  });
});
