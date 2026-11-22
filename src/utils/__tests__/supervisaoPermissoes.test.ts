import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import type { PainelSupervisao } from '../supervisaoCuidados';

const db = new PGlite();
const f = '00000000-0000-0000-0000-000000000001';
const r = '00000000-0000-0000-0000-000000000002';
const t = '00000000-0000-0000-0000-000000000003';
const outra = '00000000-0000-0000-0000-000000000004';
const dia = "(now() AT TIME ZONE 'America/Sao_Paulo')::date";

beforeAll(async () => {
  await db.exec(readFileSync('src/utils/__tests__/fixtures/supervisao-schema.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261122011009_db590f17-55c4-422e-9b40-757c134bd2d5.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261122011830_f144f889-9a30-414f-8eb3-f603d5832284.sql', 'utf8'));
  await db.exec(`INSERT INTO funcionarios VALUES ('${f}','${t}','Ana',true);
    INSERT INTO residentes VALUES ('${r}','${t}','Maria','1',true,4000,'privado'), ('${outra}','${outra}','Outra instituição','2',true,5000,'privado');
    INSERT INTO cuidados_agenda (id,tenant_id,residente_id,titulo,data_evento) VALUES ('${r}','${t}','${r}','Consulta',${dia}), ('${outra}','${outra}','${outra}','Outro evento',${dia});
    INSERT INTO prontuario_ciclos (id,residente_id,data_ciclo,status,tenant_id) VALUES ('${r}','${r}',${dia},'em_andamento','${t}');
    INSERT INTO prontuario_registros (ciclo_id,residente_id,funcionario_id,tenant_id,data_registro,titulo,created_at) VALUES ('${r}','${r}','${f}','${t}',${dia},'Banho',now());
    INSERT INTO intercorrencias (id,tenant_id,titulo,created_at) VALUES ('${r}','${t}','Ocorrência própria',now()), ('${outra}','${outra}','Outra ocorrência',now());`);
});
afterAll(async () => { await db.close(); });
const session = (employee: string, modules: string) => db.query("SELECT set_config('test.employee',$1,false),set_config('test.modules',$2,false)", [employee, modules]);
const snapshot = async () => (await db.query<{ p: PainelSupervisao }>('SELECT portal_supervisao_painel() p')).rows[0].p;

describe.sequential('supervisão protegida por PIN e cargo', () => {
  it('nega sem passe válido (incluindo sessão expirada/revogada)', async () => {
    await session('', '{supervisor}');
    await expect(snapshot()).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('SELECT portal_supervisao_intercorrencias()')).rejects.toMatchObject({ code: '42501' });
  });
  it('nega cuidadora sem módulo Supervisão e módulos nulos', async () => {
    await session(f, '{portal_cuidados,medicamentos}');
    await expect(snapshot()).rejects.toMatchObject({ code: '42501' });
    await session(f, '');
    await expect(snapshot()).rejects.toMatchObject({ code: '42501' });
  });
  it('supervisor não depende do módulo do hub, mas só vê sua instituição', async () => {
    await session(f, '{supervisor}');
    const p = await snapshot();
    expect(p.residentes.map(x => x.id)).toEqual([r]);
    expect(p.agenda.map(x => x.titulo)).toEqual(['Consulta']);
    expect(p.residentes[0]).not.toHaveProperty('valor_mensalidade');
    expect(p.residentes[0]).not.toHaveProperty('cpf_responsavel');
    const i = (await db.query<{ items: { titulo: string }[] }>('SELECT portal_supervisao_intercorrencias() items')).rows[0].items;
    expect(i.map(x => x.titulo)).toEqual(['Ocorrência própria']);
  });
  it('consolida registros do dia e reflete novas atividades na consulta seguinte', async () => {
    let p = await snapshot();
    expect(p.ciclos[0].registros).toBe(1);
    expect(p.equipe[0].total).toBe(1);
    await db.exec(`INSERT INTO uso_fraldas (funcionario_id,residente_id,quantidade_usada,created_at,tenant_id,data_uso) VALUES ('${f}','${r}',1,now(),'${t}',${dia});`);
    p = await snapshot();
    expect(p.equipe[0].total).toBe(2);
    expect(p.atividades.some(a => a.categoria === 'Fraldas')).toBe(true);
  });
  it('nega funcionário inativo mesmo com módulo', async () => {
    await db.exec(`UPDATE funcionarios SET ativo=false WHERE id='${f}'`);
    await expect(snapshot()).rejects.toMatchObject({ code: '42501' });
    await db.exec(`UPDATE funcionarios SET ativo=true WHERE id='${f}'`);
  });
});