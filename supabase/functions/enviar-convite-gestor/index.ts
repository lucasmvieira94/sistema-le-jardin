import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    const linkConvite = `${Deno.env.get("SUPABASE_URL")}/auth/v1/signup?redirect_to=${encodeURIComponent(`${req.headers.get("origin")}/auth?convite=${funcionario_id}`)}`;

    const emailResponse = await resend.emails.send({
      from: "Sistema de Gestão <onboarding@resend.dev>",
      to: [email],
      subject: "Convite para acessar o Sistema de Gestão",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Convite para o Sistema de Gestão</h2>
          
          <p>Olá ${nome},</p>
          
          <p>Você foi convidado(a) para acessar o Sistema de Gestão com o perfil de <strong>${funcao}</strong>.</p>
          
          <p>Para aceitar o convite e criar sua conta, clique no link abaixo:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${linkConvite}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Aceitar Convite
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Se você não conseguir clicar no botão, copie e cole este link no seu navegador:<br>
            <a href="${linkConvite}" style="color: #007bff;">${linkConvite}</a>
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="color: #888; font-size: 12px; text-align: center;">
            Este convite foi enviado automaticamente pelo Sistema de Gestão.
          </p>
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