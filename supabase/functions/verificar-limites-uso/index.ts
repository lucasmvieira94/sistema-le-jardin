// Edge function: verifica se algum tenant atingiu 80%/90%/100% dos limites do plano
// e dispara e-mail ao admin do tenant. Evita reenvio via tabela tenant_uso_alertas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMIARES = [80, 90, 100];

interface Recurso {
  chave: "funcionarios" | "residentes" | "usuarios_admin";
  label: string;
  colunaUso: string;
  colunaLimite: string;
}

const RECURSOS: Recurso[] = [
  { chave: "funcionarios", label: "Funcionários ativos", colunaUso: "funcionarios_ativos", colunaLimite: "limite_funcionarios" },
  { chave: "residentes", label: "Residentes ativos", colunaUso: "residentes_ativos", colunaLimite: "limite_residentes" },
  { chave: "usuarios_admin", label: "Usuários administradores", colunaUso: "usuarios_admin", colunaLimite: "limite_usuarios_admin" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

  try {
    const dataRef = new Date();
    const primeiroDia = `${dataRef.getFullYear()}-${String(dataRef.getMonth() + 1).padStart(2, "0")}-01`;

    const { data: assinaturas, error: aErr } = await supabase
      .from("assinaturas")
      .select(`
        tenant_id,
        status,
        plano:planos ( nome, limite_funcionarios, limite_residentes, limite_usuarios_admin ),
        tenant:tenants ( id, nome )
      `)
      .in("status", ["ativa", "trial"]);
    if (aErr) throw aErr;

    const resultado: any[] = [];

    for (const a of assinaturas ?? []) {
      const tenantId = (a as any).tenant_id;
      const plano = (a as any).plano;
      const tenant = (a as any).tenant;
      if (!plano || !tenant) continue;

      const { data: uso } = await supabase
        .from("tenant_uso").select("*")
        .eq("tenant_id", tenantId).eq("data_referencia", primeiroDia).maybeSingle();
      if (!uso) continue;

      for (const r of RECURSOS) {
        const limite = (plano as any)[r.colunaLimite] as number | null;
        const consumo = (uso as any)[r.colunaUso] as number;
        if (!limite || limite <= 0) continue;

        const pct = Math.floor((consumo / limite) * 100);
        const limiarAtingido = LIMIARES.filter((l) => pct >= l).sort((x, y) => y - x)[0];
        if (!limiarAtingido) continue;

        const { data: jaEnviado } = await supabase
          .from("tenant_uso_alertas").select("id")
          .eq("tenant_id", tenantId)
          .eq("recurso", r.chave)
          .eq("percentual_atingido", limiarAtingido)
          .eq("data_referencia", primeiroDia)
          .maybeSingle();
        if (jaEnviado) continue;

        // Busca o e-mail do primeiro admin do tenant (via auth.users)
        const { data: adminRole } = await supabase
          .from("user_roles").select("user_id")
          .eq("tenant_id", tenantId).eq("role", "admin").limit(1).maybeSingle();

        let destinatario: string | null = null;
        if (adminRole?.user_id) {
          const { data: userInfo } = await supabase.auth.admin.getUserById(adminRole.user_id);
          destinatario = userInfo?.user?.email ?? null;
        }

        if (!destinatario) {
          resultado.push({ tenantId, recurso: r.chave, limiarAtingido, skipped: "sem-email" });
          continue;
        }

        const assunto = limiarAtingido === 100
          ? `🚨 Limite do plano atingido: ${r.label}`
          : `⚠️ Atenção: ${limiarAtingido}% do limite de ${r.label}`;

        const html = `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:auto;padding:24px">
            <h2 style="color:#0f172a">${assunto}</h2>
            <p>Olá, ${tenant.nome}.</p>
            <p>Seu plano <strong>${plano.nome}</strong> permite até <strong>${limite}</strong> ${r.label.toLowerCase()}.</p>
            <p>Atualmente você está utilizando <strong>${consumo}</strong> (${pct}% do limite).</p>
            ${limiarAtingido === 100
              ? `<p style="color:#b91c1c"><strong>Você atingiu 100% do limite.</strong> Entre em contato com nosso time comercial para upgrade.</p>`
              : `<p>Considere fazer o upgrade do plano para evitar interrupções.</p>`}
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
            <p style="color:#64748b;font-size:13px">Senex Care · Plataforma de gestão para ILPIs</p>
          </div>
        `;

        const env = await resend.emails.send({
          from: "Senex Care <no-reply@resend.dev>",
          to: [destinatario],
          subject: assunto,
          html,
        });

        await supabase.from("tenant_uso_alertas").insert({
          tenant_id: tenantId,
          recurso: r.chave,
          percentual_atingido: limiarAtingido,
          data_referencia: primeiroDia,
          email_destinatario: destinatario,
          status: env.error ? "erro" : "enviado",
        });

        resultado.push({ tenantId, recurso: r.chave, limiarAtingido, ok: !env.error, error: env.error?.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, total: resultado.length, resultado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("Erro ao verificar limites:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});