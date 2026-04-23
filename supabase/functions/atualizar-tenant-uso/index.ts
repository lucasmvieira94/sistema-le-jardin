// Edge function: recalcula uso de recursos por tenant (funcionários, residentes, prontuários do mês)
// e grava em public.tenant_uso. Pode ser chamada via cron diário (pg_cron + pg_net).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id");
    if (tErr) throw tErr;

    const hoje = new Date();
    const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();

    const resultados: any[] = [];

    for (const t of tenants ?? []) {
      const tenantId = t.id;

      const [{ count: funcs }, { count: resids }, { count: prontMes }] = await Promise.all([
        supabase.from("funcionarios").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("residentes").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("prontuarios").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).gte("created_at", inicioMes),
      ]);

      // Upsert na tabela de uso
      const { error: upErr } = await supabase.from("tenant_uso").upsert({
        tenant_id: tenantId,
        mes_referencia: mesRef,
        qtd_funcionarios: funcs ?? 0,
        qtd_residentes: resids ?? 0,
        qtd_prontuarios_mes: prontMes ?? 0,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "tenant_id,mes_referencia" });

      if (upErr) {
        resultados.push({ tenantId, ok: false, error: upErr.message });
      } else {
        resultados.push({ tenantId, ok: true, funcs, resids, prontMes });
      }
    }

    return new Response(JSON.stringify({ ok: true, total: resultados.length, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
