import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { consultarCorrecoes } from "../_shared/historicoCorrecoes.ts";
import { diagnosticarErroEnvio } from "../_shared/diagnosticoEnvio.ts";

function cliente(data: unknown[], error: unknown = null) {
  const calls: unknown[][] = [];
  const q = {
    select(...args: unknown[]) { calls.push(['select', ...args]); return q; },
    eq(...args: unknown[]) { calls.push(['eq', ...args]); return q; },
    not(...args: unknown[]) { calls.push(['not', ...args]); return q; },
    order(...args: unknown[]) { calls.push(['order', ...args]); return q; },
    async limit(n: number) { calls.push(['limit', n]); return { data, error }; },
  };
  return { admin: { from: () => q } as unknown as SupabaseClient, calls };
}

Deno.test('consulta somente correções resolvidas do mesmo módulo e erro, com limite de cinco', async () => {
  const { admin, calls } = cliente([{ id: 'correcao-1', observacao_resolucao: 'UUID corrigido' }]);
  assertEquals(await consultarCorrecoes(admin, 'Financeiro', 'Dados inválidos'), ['correcao-1']);
  assertEquals(calls.filter(c => c[0] === 'eq'), [
    ['eq', 'origem', 'Financeiro'], ['eq', 'erro', 'Dados inválidos'], ['eq', 'resolvido', true],
  ]);
  assertEquals(calls.at(-1), ['limit', 5]);
});

Deno.test('não retorna notas internas nem usa registros sem resolução documentada', async () => {
  const { admin } = cliente([{ id: '1', observacao_resolucao: 'Nota interna' }, { id: '2', observacao_resolucao: ' ' }]);
  assertEquals(await consultarCorrecoes(admin, 'Painel', 'erro'), ['1']);
});

Deno.test('falha de consulta não mascara o erro original', async () => {
  const { admin } = cliente([], new Error('Sem conexão'));
  assertEquals(await consultarCorrecoes(admin, 'Painel', 'erro'), []);
});

Deno.test('recorrência consulta histórico antes do diagnóstico, grava novo erro aberto e não expõe nota', async () => {
  const { admin: reader } = cliente([{ id: 'anterior', observacao_resolucao: 'Nota interna confidencial' }]);
  let registro: Record<string, unknown> = {};
  const admin = { from: () => ({
    ...(reader.from('erros_envio_suporte') as unknown as object),
    insert: (row: Record<string, unknown>) => { registro = row; return Promise.resolve({ error: null }); },
  }) } as unknown as SupabaseClient;
  // Evita qualquer e-mail real durante o teste.
  const key = Deno.env.get('RESEND_API_KEY');
  Deno.env.delete('RESEND_API_KEY');
  try {
    const result = await diagnosticarErroEnvio(admin, { origem: 'Financeiro', erro: 'Dados inválidos' });
    assertEquals(result?.diagnostico, 'Recorrência de erro com correção anterior registrada.');
    assertEquals(JSON.stringify(result).includes('Nota interna confidencial'), false);
    assertEquals(registro.resolvido, undefined); // O padrão no banco é false.
    assertEquals((registro.contexto as Record<string, unknown>).correcoes_anteriores, ['anterior']);
  } finally { if (key) Deno.env.set('RESEND_API_KEY', key); }
});