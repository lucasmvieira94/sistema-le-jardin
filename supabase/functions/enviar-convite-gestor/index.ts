import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConviteRequest {
  email: string;
  nome: string;
  funcao: string;
  funcionario_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    if (token !== supabaseServiceKey) {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { email, nome, funcao, funcionario_id }: ConviteRequest = await req.json();

    if (!email || !nome || !funcionario_id) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: email, nome, funcionario_id" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    // Buscar configurações da empresa para usar o domínio personalizado
    const { data: config } = await supabase
      .from('configuracoes_empresa')
      .select('nome_empresa, dominio_email')
      .single();

    const nomeEmpresa = config?.nome_empresa || 'Sistema de Gestão';
    const dominioEmail = config?.dominio_email || 'onboarding@resend.dev';
    
    const linkConvite = `${Deno.env.get("SUPABASE_URL")}/auth/v1/signup?redirect_to=${encodeURIComponent(`${req.headers.get("origin")}/auth?convite=${funcionario_id}`)}`;

    const emailResponse = await resend.emails.send({
      from: `${nomeEmpresa} <${dominioEmail}>`,
      to: [email],
      subject: `Convite para acessar o ${nomeEmpresa}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Convite para ${nomeEmpresa}</h1>
          </div>
          
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Olá <strong>${nome}</strong>,</p>
            
            <p style="font-size: 16px; color: #555; line-height: 1.6; margin-bottom: 25px;">
              Você foi convidado(a) para acessar o sistema <strong>${nomeEmpresa}</strong> com o perfil de <strong style="color: #667eea;">${funcao}</strong>.
            </p>
            
            <p style="font-size: 16px; color: #555; line-height: 1.6; margin-bottom: 30px;">
              Para aceitar o convite e criar sua conta, clique no botão abaixo:
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${linkConvite}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; padding: 16px 32px; text-decoration: none; 
                        border-radius: 8px; display: inline-block; font-weight: 600; 
                        font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                        transition: all 0.3s ease;">
                🚀 Aceitar Convite
              </a>
            </div>
            
            <div style="background: #f8f9fa; border-radius: 6px; padding: 20px; margin: 30px 0;">
              <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">
                <strong>Não consegue clicar no botão?</strong><br>
                Copie e cole este link no seu navegador:<br>
                <a href="${linkConvite}" style="color: #667eea; word-break: break-all;">${linkConvite}</a>
              </p>
            </div>
            
            <hr style="margin: 40px 0; border: none; border-top: 1px solid #e9ecef;">
            
            <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
              Este convite foi enviado automaticamente pelo sistema ${nomeEmpresa}.<br>
              Se você não esperava este convite, pode ignorar este email.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Email de convite enviado:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Erro ao enviar convite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);