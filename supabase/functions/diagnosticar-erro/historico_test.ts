import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { consultarCorrecoes } from "../_shared/historicoCorrecoes.ts";

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