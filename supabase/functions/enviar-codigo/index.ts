
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, nome, codigo } = await req.json();
    if (!email || !codigo) {
      return new Response(JSON.stringify({ error: "email e codigo são obrigatórios" }), { status: 400, headers: corsHeaders });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Chave RESEND_API_KEY não configurada." }), { status: 500, headers: corsHeaders });
    }

    // Buscar configurações da empresa para obter o domínio
    const { data: config } = await supabase
      .from('configuracoes_empresa')
      .select('dominio_email, nome_empresa')
      .single();

    const dominioEmail = config?.dominio_email || "no-reply@resend.dev";
    const nomeEmpresa = config?.nome_empresa || "Controle de Ponto";

    // Enviar email via Resend
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${nomeEmpresa} <${dominioEmail}>`,
        to: [email],
        subject: `Bem-vindo(a)! Seu código de registro`,
        html: `<h2>Olá, ${nome || "Funcionário"}!</h2>
            <p>Seu código de registro de ponto é: <strong style="font-size:18px;">${codigo}</strong></p>
            <p>Utilize este código para registrar seus pontos de entrada, intervalo e saída.</p>
            <br/><small>Não compartilhe este código com terceiros.</small>`
      }),
    });

    if (!resp.ok) {
      const msg = await resp.text();
      throw new Error("Falha ao enviar email: " + msg);
    }

    return new Response(JSON.stringify({ status: "ok" }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || err }), { status: 500, headers: corsHeaders });
  }
};

serve(handler);
