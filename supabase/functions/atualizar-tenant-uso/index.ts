// Edge function: recalcula uso de recursos por tenant e grava em public.tenant_uso.
// Roda diariamente via pg_cron (config.toml) e atualiza o snapshot do mês corrente.
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
      .from("tenants").select("id");
    if (tErr) throw tErr;

    const hoje = new Date();
    const dataRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();

    const resultados: any[] = [];

    for (const t of tenants ?? []) {
      const tenantId = t.id;

      const [
        { count: funcs },
        { count: resids },
        { count: admins },
        { count: pontoMes },
        { count: iaMes },
      ] = await Promise.all([
        supabase.from("funcionarios").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("residentes").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("user_roles").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("role", "admin"),
        supabase.from("registros_ponto").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).gte("created_at", inicioMes),
        supabase.from("consultas_ia_whatsapp").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).gte("created_at", inicioMes),
      ]);

      // Verifica se já existe snapshot do mês
      const { data: existente } = await supabase.from("tenant_uso")
        .select("id").eq("tenant_id", tenantId).eq("data_referencia", dataRef).maybeSingle();

      const payload = {
        tenant_id: tenantId,
        data_referencia: dataRef,
        funcionarios_ativos: funcs ?? 0,
        residentes_ativos: resids ?? 0,
        usuarios_admin: admins ?? 0,
        registros_ponto_mes: pontoMes ?? 0,
        consultas_ia_mes: iaMes ?? 0,
        atualizado_em: new Date().toISOString(),
      };

      const op = existente
        ? await supabase.from("tenant_uso").update(payload).eq("id", existente.id)
        : await supabase.from("tenant_uso").insert(payload);

      if (op.error) {
        resultados.push({ tenantId, ok: false, error: op.error.message });
      } else {
        resultados.push({ tenantId, ok: true, ...payload });
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
