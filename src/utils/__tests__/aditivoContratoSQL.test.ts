import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const c = uid(1), d = uid(2), tenant = uid(3), r = uid(4);
const criar = (id: number, nova: string, anterior: string | null, distrato: string | null = null, contrato = c) => db.query('SELECT criar_aditivo_prorrogacao($1,$2,$3,$4,$5,$6)', [uid(id), contrato, distrato, nova, 'Condições preservadas', anterior]);
const clock = (date: string) => db.query("SELECT set_config('test.clock',$1,false)", [date]);
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION eh_gestor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.manager',true),'false')::boolean AND $1 IS NOT NULL $$;
    CREATE FUNCTION get_current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.tenant',true),'')::uuid $$;
    CREATE FUNCTION test_clock() RETURNS timestamp LANGUAGE sql AS $$ SELECT current_setting('test.clock')::timestamp $$;
    CREATE TABLE contratos_residentes(id uuid PRIMARY KEY,residente_id uuid,tenant_id uuid,numero_contrato text,status text,data_inicio_contrato date,data_fim_contrato date,contratante_nome text,updated_at timestamptz);
    CREATE TABLE contratos_distratos(id uuid PRIMARY KEY,contrato_id uuid,tenant_id uuid,numero_distrato text,data_efetiva date,updated_at timestamptz);
    CREATE TABLE residentes(id uuid PRIMARY KEY,tenant_id uuid,nome_completo text,cpf text,numero_prontuario text);
    SELECT set_config('test.user','${uid(5)}',false),set_config('test.manager','true',false),set_config('test.tenant','${tenant}',false),set_config('test.clock','2026-11-28',false);
    INSERT INTO residentes VALUES('${r}','${tenant}','Pessoa fictícia',NULL,'1');
    INSERT INTO contratos_residentes VALUES('${c}','${r}','${tenant}','001/2026','ativo','2026-01-01','2026-12-01','Responsável fictício',now());`);
  // Executa a migração real: somente o relógio é controlado para testar as datas civis.
  await db.exec(readFileSync('supabase/migrations/20261128134958_6b5db2b4-5253-4f6d-9851-34258f6d0a4c.sql','utf8').split("now() AT TIME ZONE 'America/Sao_Paulo'").join('public.test_clock()'));
  await db.exec(readFileSync('supabase/migrations/20261128135159_a02f0dc0-3c00-44ba-9653-8bd0768787eb.sql','utf8'));
});
afterAll(async () => { await db.close(); });

describe.sequential('aditivos: RPC de produção, prazo e proteção', () => {
  it('gestor prorroga contrato sem alterar o documento original', async () => {
    await criar(10,'2026-12-31','2026-12-01');
    expect((await db.query('SELECT data_fim_contrato::text,prazo_prorrogado::text FROM contratos_residentes')).rows).toEqual([{data_fim_contrato:'2026-12-01',prazo_prorrogado:'2026-12-31'}]);
    const row = (await db.query<{ dados_documento: { contrato: { data_fim_contrato: string } }; data_anterior: string }>('SELECT dados_documento,data_anterior::text FROM contratos_aditivos')).rows[0];
    expect(row.dados_documento.contrato.data_fim_contrato).toBe('2026-12-01');
    expect(row.data_anterior).toBe('2026-12-01');
  });
  it('repetir a mesma solicitação não cria outro aditivo', async () => {
    await criar(10,'2026-12-31','2026-12-01');
    expect((await db.query('SELECT * FROM contratos_aditivos')).rows).toHaveLength(1);
  });
  it('bloqueia formulário desatualizado e prazo não posterior', async () => {
    await expect(criar(11,'2027-01-31','2026-12-01')).rejects.toThrow('prazo foi alterado');
    await expect(criar(11,'2026-12-31','2026-12-31')).rejects.toThrow('posterior');
    await expect(criar(11,'2026-11-28','2026-12-31')).rejects.toThrow('posterior');
  });
  it('bloqueia cuidadora e contratos de outra instituição', async () => {
    await db.exec("SELECT set_config('test.manager','false',false)");
    await expect(criar(11,'2027-01-31','2026-12-31')).rejects.toMatchObject({code:'42501'});
    await db.exec(`SELECT set_config('test.manager','true',false),set_config('test.tenant','${uid(99)}',false)`);
    await expect(criar(11,'2027-01-31','2026-12-31')).rejects.toMatchObject({code:'42501'});
    await db.exec(`SELECT set_config('test.tenant','${tenant}',false)`);
  });
  it('RLS isola leitura e não permite editar ou excluir histórico', async () => {
    await db.exec('SET ROLE authenticated');
    expect((await db.query('SELECT * FROM contratos_aditivos')).rows).toHaveLength(1);
    await expect(db.query("UPDATE contratos_aditivos SET condicoes='Alteradas'")).rejects.toMatchObject({code:'42501'});
    await expect(db.query('DELETE FROM contratos_aditivos')).rejects.toMatchObject({code:'42501'});
    await db.exec(`SELECT set_config('test.tenant','${uid(99)}',false)`);
    expect((await db.query('SELECT * FROM contratos_aditivos')).rows).toHaveLength(0);
    await db.exec(`SELECT set_config('test.tenant','${tenant}',false); RESET ROLE;`);
  });
  it('exige prorrogar o distrato quando existe encerramento programado', async () => {
    await db.exec(`INSERT INTO contratos_distratos(id,contrato_id,tenant_id,numero_distrato,data_efetiva) VALUES('${d}','${c}','${tenant}','D-001','2026-12-05')`);
    await expect(criar(12,'2027-01-31','2026-12-31')).rejects.toThrow('Prorrogue o distrato');
    await criar(12,'2027-01-31','2026-12-05',d);
    expect((await db.query('SELECT data_efetiva::text,prazo_prorrogado::text FROM contratos_distratos')).rows).toEqual([{data_efetiva:'2026-12-05',prazo_prorrogado:'2027-01-31'}]);
  });
  it('encerramento automático respeita a nova data do distrato', async () => {
    await clock('2026-12-05');
    expect((await db.query<{ n: number }>('SELECT encerrar_contratos_distratados() n')).rows[0].n).toBe(0);
    await clock('2027-01-31');
    expect((await db.query<{ n: number }>('SELECT encerrar_contratos_distratados() n')).rows[0].n).toBe(1);
    expect((await db.query<{status:string}>('SELECT status FROM contratos_residentes')).rows[0].status).toBe('encerrado');
  });
  it('contrato encerrado não pode ser prorrogado', async () => {
    await expect(criar(13,'2027-03-01','2027-01-31',d)).rejects.toThrow('encerrado');
  });
});