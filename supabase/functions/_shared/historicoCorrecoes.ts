import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Consulta exata e limitada; nunca expõe notas, usuários ou contexto antigo ao portal público. */
export async function consultarCorrecoes(admin: SupabaseClient, origem: string, erro: string): Promise<string[]> {
  try {
    const { data, error } = await admin.from("erros_envio_suporte")
      .select("id, observacao_resolucao")
      .eq("origem", origem).eq("erro", erro.slice(0, 4000)).eq("resolvido", true)
      .not("observacao_resolucao", "is", null)
      .order("resolvido_em", { ascending: false }).limit(5);
    if (error) return [];
    return (data ?? []).filter((r) => typeof r.observacao_resolucao === "string" && r.observacao_resolucao.trim())
      .map((r) => String(r.id));
  } catch { return []; }
}