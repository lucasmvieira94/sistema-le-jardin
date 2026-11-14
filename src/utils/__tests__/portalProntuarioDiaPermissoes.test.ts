import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
const residente = "00000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE prontuario_registros (id uuid, residente_id uuid, data_registro date, horario_registro time, tipo_registro text, titulo text, descricao text, observacoes text, funcionario_nome text, retifica_registro_id uuid, justificativa_retificacao text, created_at timestamptz);
    CREATE FUNCTION portal_cuidados_ficha(uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
      IF current_setting('test.passe',true) IS DISTINCT FROM 'valido' OR current_setting('test.modulo',true) IS DISTINCT FROM 'portal_cuidados' THEN RAISE EXCEPTION 'Não autorizado' USING ERRCODE='42501'; END IF;
      IF $1::text IS DISTINCT FROM current_setting('test.residente',true) THEN RAISE EXCEPTION 'Residente não encontrado' USING ERRCODE='P0002'; END IF;
      RETURN '{}'::jsonb;
    END $$;`);
  await db.exec(readFileSync("supabase/migrations/20261114154522_cf86d9ef-6108-425e-bf1e-68652de99d7b.sql", "utf8"));
  await db.query("INSERT INTO prontuario_registros (id,residente_id,data_registro,horario_registro,descricao) VALUES ($1,$1,'2026-11-14','08:00','Curativo'), ('00000000-0000-0000-0000-000000000002',$1,'2026-11-13','09:00','Ontem')", [residente]);
});
afterAll(async () => { await db.close(); });
async function passe(token: string, modulo = "portal_cuidados") {
  await db.query("SELECT set_config('test.passe',$1,false), set_config('test.modulo',$2,false), set_config('test.residente',$3,false)", [token, modulo, residente]);
}
describe.sequential("prontuário diário protegido", () => {
  it("nega consulta sem passe válido", async () => {
    await passe("");
    await expect(db.query("SELECT portal_cuidados_prontuario_dia($1,'2026-11-14')", [residente])).rejects.toMatchObject({ code: "42501" });
  });
  it("nega consulta sem módulo de cuidados", async () => {
    await passe("valido", "ponto");
    await expect(db.query("SELECT portal_cuidados_prontuario_dia($1,'2026-11-14')", [residente])).rejects.toMatchObject({ code: "42501" });
  });
  it("preserva a verificação de acesso ao residente", async () => {
    await passe("valido");
    await expect(db.query("SELECT portal_cuidados_prontuario_dia('00000000-0000-0000-0000-000000000003','2026-11-14')")).rejects.toMatchObject({ code: "P0002" });
  });
  it("consulta todos e somente os registros do dia autorizado", async () => {
    await passe("valido");
    const resultado = await db.query<{ registros: { descricao: string }[] }>("SELECT portal_cuidados_prontuario_dia($1,'2026-11-14') AS registros", [residente]);
    expect(resultado.rows[0].registros.map((r) => r.descricao)).toEqual(["Curativo"]);
  });
});