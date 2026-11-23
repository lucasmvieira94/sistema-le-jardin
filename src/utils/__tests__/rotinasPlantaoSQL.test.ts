import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const f = '00000000-0000-0000-0000-000000000001';
const r = '00000000-0000-0000-0000-000000000002';
const t = '00000000-0000-0000-0000-000000000003';
const rotina = '00000000-0000-0000-0000-000000000004';
const clock = (hora: string) => db.query("SELECT set_config('test.clock',$1,false)", [`2026-11-23 ${hora}`]);
const registrar = (data?: string, chave = 'noturno') => db.query('SELECT portal_rotina_executar($1,$2,NULL,NULL,$3)', [rotina, chave, data ?? null]);

beforeAll(async () => {
  await db.exec(readFileSync('src/utils/__tests__/fixtures/supervisao-schema.sql', 'utf8'));
  await db.exec(`DROP TABLE cuidados_rotinas_execucoes; DROP TABLE cuidados_rotinas;
    ALTER TABLE funcionarios ADD PRIMARY KEY(id); ALTER TABLE residentes ADD PRIMARY KEY(id);
    CREATE FUNCTION portal_cuidados_funcionario() RETURNS uuid LANGUAGE sql AS $$
      SELECT CASE WHEN 'portal_cuidados'=ANY(COALESCE(modulos_funcionario(portal_funcionario_atual()),'{}')) THEN portal_funcionario_atual() END $$;
    INSERT INTO funcionarios VALUES ('${f}','${t}','Cuidadora teste',true);
    INSERT INTO residentes VALUES ('${r}','${t}','Residente teste','1',true,0,NULL);`);
  const original = readFileSync('supabase/migrations/20261114151448_88655635-8d0e-4702-bfa0-5dc4d0dae32e.sql', 'utf8');
  await db.exec(original.slice(original.indexOf('-- Rotinas'), original.indexOf('REVOKE ALL ON FUNCTION')));
  await db.exec(readFileSync('supabase/migrations/20261122011009_db590f17-55c4-422e-9b40-757c134bd2d5.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261123003253_50194dad-74b6-4acb-b432-5e3308a6c9cc.sql', 'utf8'));
  // Only the clock is substituted, in this isolated DB, so the production RPC can run at 02h/19h.
  await db.exec(`CREATE FUNCTION test_clock() RETURNS timestamp LANGUAGE sql AS $$ SELECT current_setting('test.clock')::timestamp $$;
    DO $$ DECLARE src text; fn text; BEGIN
      FOREACH fn IN ARRAY ARRAY['public.portal_rotina_executar(uuid,text,text,text,date)','public.portal_rotinas_listar(uuid,boolean)','public.portal_supervisao_painel()'] LOOP
        src:=pg_get_functiondef(fn::regprocedure);
        EXECUTE replace(src,'now() AT TIME ZONE ''America/Sao_Paulo''','public.test_clock()');
      END LOOP;
    END $$;
    SELECT set_config('test.employee','${f}',false),set_config('test.modules','{portal_cuidados,supervisor}',false);
    INSERT INTO cuidados_rotinas(id,tenant_id,residente_id,titulo,tipo,frequencia,inicio,criado_por)
    VALUES('${rotina}','${t}','${r}','Curativo','procedimento','plantao','2026-11-22','${f}');`);
});
afterAll(async () => { await db.close(); });

describe.sequential('plantão noturno: RPC real', () => {
  it('02h salva na data de início da noite e aparece nas consultas do cuidador e supervisor', async () => {
    await clock('02:00');
    await registrar('2026-11-22');
    expect((await db.query<{ data: string }>('SELECT data::text FROM cuidados_rotinas_execucoes')).rows).toEqual([{ data: '2026-11-22' }]);
    expect((await db.query("SELECT * FROM portal_rotinas_execucoes('2026-11-22','2026-11-23',NULL)")).rows).toHaveLength(1);
    const p = await db.query<{ painel: { execucoes: { data: string }[] } }>('SELECT portal_supervisao_painel() painel');
    expect(p.rows[0].painel.execucoes.map(e => e.data)).toEqual(['2026-11-22']);
  });
  it('confirmação repetida no mesmo plantão falha; próxima noite continua livre', async () => {
    await clock('06:59');
    await expect(registrar()).rejects.toThrow('já foi registrada');
    await clock('19:00');
    await registrar('2026-11-23');
    expect((await db.query('SELECT * FROM cuidados_rotinas_execucoes')).rows).toHaveLength(2);
  });
  it('bloqueia próxima noite às 07h e formulário com data de outro plantão', async () => {
    await clock('07:00');
    await expect(registrar('2026-11-23')).rejects.toThrow('ainda não iniciado');
    await clock('19:00');
    await expect(registrar('2026-11-22')).rejects.toThrow('plantão mudou');
  });
  it('vigência encerrada ontem continua válida até 07h, não para a próxima noite', async () => {
    await db.exec(`UPDATE cuidados_rotinas SET fim='2026-11-22',dias_semana='{0}' WHERE id='${rotina}'`);
    await clock('02:00');
    expect((await db.query('SELECT * FROM portal_rotinas_listar(NULL,false)')).rows).toHaveLength(1);
    await clock('19:00');
    expect((await db.query('SELECT * FROM portal_rotinas_listar(NULL,false)')).rows).toHaveLength(0);
    await expect(registrar()).rejects.toThrow('não vigente');
  });
  it('nega confirmação sem passe ou módulo do portal', async () => {
    await db.exec("SELECT set_config('test.employee','',false)");
    await expect(registrar()).rejects.toMatchObject({ code: '42501' });
    await db.exec(`SELECT set_config('test.employee','${f}',false),set_config('test.modules','{supervisor}',false)`);
    await expect(registrar()).rejects.toMatchObject({ code: '42501' });
  });
});