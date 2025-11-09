import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnviarRelatorioRequest {
  emailGestor: string;
  nomeGestor: string;
  relatorio: any;
  pdfBase64: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailGestor, nomeGestor, relatorio, pdfBase64 }: EnviarRelatorioRequest = await req.json();

    console.log('Enviando relatório para:', emailGestor);

    // Converter base64 para buffer
    const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

    const dataInicio = new Date(relatorio.data_inicio).toLocaleDateString('pt-BR');
    const dataFim = new Date(relatorio.data_fim).toLocaleDateString('pt-BR');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .metric { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
            .metric-label { font-weight: bold; color: #667eea; }
            .metric-value { font-size: 24px; font-weight: bold; color: #333; }
            .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .alert-critico { background: #f8d7da; border-left-color: #dc3545; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Relatório Semanal com IA</h1>
              <p>Período: ${dataInicio} a ${dataFim}</p>
            </div>
            
            <div class="content">
              <p>Olá, ${nomeGestor}!</p>
              
              <p>Segue em anexo o relatório semanal de análise dos prontuários gerado automaticamente pela IA.</p>
              
              <h2>📈 Resumo Executivo</h2>
              <p>${relatorio.resumo_executivo}</p>
              
              <div class="metric">
                <div class="metric-label">Total de Prontuários Analisados</div>
                <div class="metric-value">${relatorio.total_prontuarios}</div>
              </div>
              
              <div class="metric">
                <div class="metric-label">Não Conformidades Identificadas</div>
                <div class="metric-value">${relatorio.nao_conformidades_encontradas}</div>
              </div>
              
              ${relatorio.nao_conformidades_encontradas > 0 ? `
                <h3>⚠️ Ações Necessárias</h3>
                <p>Foram identificadas ${relatorio.nao_conformidades_encontradas} não conformidades que requerem sua atenção. Por favor, revise o relatório completo em anexo para detalhes e ações recomendadas.</p>
              ` : ''}
              
              <p style="margin-top: 30px;">
                <strong>📎 Relatório completo em PDF anexado</strong><br>
                O relatório em anexo contém análise detalhada, observações destacadas e sugestões de melhorias.
              </p>
              
              <div class="footer">
                <p>Este é um email automático do sistema de gestão de cuidados.</p>
                <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Relatórios IA <onboarding@resend.dev>",
      to: [emailGestor],
      subject: `📊 Relatório Semanal com IA - ${dataInicio} a ${dataFim}`,
      html: emailHtml,
      attachments: [
        {
          filename: `relatorio_${dataInicio.replace(/\//g, '-')}_${dataFim.replace(/\//g, '-')}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    console.log("Email enviado com sucesso:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Relatório enviado com sucesso!",
        emailId: emailResponse.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro ao enviar email:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
