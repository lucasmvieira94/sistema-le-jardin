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
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
              line-height: 1.6; 
              color: #1f2937; 
              background-color: #f9fafb;
              padding: 20px;
            }
            .email-wrapper {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            .header {
              background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .logo {
              width: 180px;
              height: auto;
              margin-bottom: 20px;
              filter: brightness(0) invert(1);
            }
            .header h1 {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .header p {
              font-size: 16px;
              opacity: 0.95;
              font-weight: 500;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              font-size: 18px;
              color: #374151;
              margin-bottom: 20px;
              font-weight: 500;
            }
            .intro {
              color: #6b7280;
              margin-bottom: 30px;
              font-size: 15px;
            }
            .section-title {
              font-size: 20px;
              font-weight: 700;
              color: #7c3aed;
              margin: 30px 0 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #e5e7eb;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .section-title .icon {
              font-size: 24px;
            }
            .resumo-box {
              background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #7c3aed;
              margin-bottom: 25px;
              font-size: 15px;
              line-height: 1.7;
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin: 25px 0;
            }
            .metric-card {
              background: white;
              padding: 20px;
              border-radius: 10px;
              border: 2px solid #e5e7eb;
              text-align: center;
              transition: all 0.3s ease;
            }
            .metric-card:hover {
              border-color: #7c3aed;
              box-shadow: 0 4px 12px rgba(124, 58, 237, 0.15);
            }
            .metric-label {
              font-size: 13px;
              color: #6b7280;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            .metric-value {
              font-size: 36px;
              font-weight: 800;
              color: #7c3aed;
              line-height: 1;
            }
            .alert-box {
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
              border-left: 4px solid #f59e0b;
              padding: 20px;
              border-radius: 8px;
              margin: 25px 0;
            }
            .alert-box.critical {
              background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
              border-left-color: #ef4444;
            }
            .alert-box h3 {
              color: #92400e;
              font-size: 18px;
              margin-bottom: 10px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .alert-box.critical h3 {
              color: #991b1b;
            }
            .alert-box p {
              color: #78350f;
              font-size: 14px;
              line-height: 1.6;
            }
            .alert-box.critical p {
              color: #7f1d1d;
            }
            .attachment-box {
              background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
              border-left: 4px solid #3b82f6;
              padding: 20px;
              border-radius: 8px;
              margin: 30px 0;
            }
            .attachment-box strong {
              color: #1e40af;
              font-size: 16px;
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;
            }
            .attachment-box p {
              color: #1e3a8a;
              font-size: 14px;
              margin-left: 28px;
            }
            .divider {
              height: 1px;
              background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
              margin: 30px 0;
            }
            .footer {
              background: #f9fafb;
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              color: #6b7280;
              font-size: 13px;
              margin: 5px 0;
            }
            .footer .timestamp {
              color: #9ca3af;
              font-size: 12px;
              margin-top: 10px;
            }
            .brand-footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
            }
            .brand-footer p {
              color: #7c3aed;
              font-weight: 600;
              font-size: 14px;
            }
            @media only screen and (max-width: 600px) {
              .email-wrapper { border-radius: 0; }
              .header, .content, .footer { padding: 20px !important; }
              .metrics-grid { grid-template-columns: 1fr; }
              .logo { width: 140px; }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <!-- Header com Logo -->
            <div class="header">
              <svg class="logo" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
                <text x="10" y="40" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white">
                  Senex Care
                </text>
              </svg>
              <h1>📊 Relatório Semanal com IA</h1>
              <p>Período: ${dataInicio} a ${dataFim}</p>
            </div>
            
            <!-- Conteúdo -->
            <div class="content">
              <p class="greeting">Olá, ${nomeGestor}!</p>
              
              <p class="intro">
                Segue em anexo o relatório semanal de análise dos prontuários gerado automaticamente 
                pela nossa inteligência artificial. Este relatório foi criado para fornecer insights 
                valiosos sobre o cuidado dos residentes.
              </p>
              
              <div class="divider"></div>
              
              <!-- Resumo Executivo -->
              <h2 class="section-title">
                <span class="icon">📈</span>
                Resumo Executivo
              </h2>
              <div class="resumo-box">
                ${relatorio.resumo_executivo}
              </div>
              
              <!-- Métricas -->
              <h2 class="section-title">
                <span class="icon">📊</span>
                Métricas do Período
              </h2>
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-label">Prontuários Analisados</div>
                  <div class="metric-value">${relatorio.total_prontuarios}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Não Conformidades</div>
                  <div class="metric-value">${relatorio.nao_conformidades_encontradas}</div>
                </div>
              </div>
              
              ${relatorio.nao_conformidades_encontradas > 0 ? `
                <div class="alert-box ${relatorio.nao_conformidades_encontradas > 5 ? 'critical' : ''}">
                  <h3>⚠️ Ações Necessárias</h3>
                  <p>
                    Foram identificadas <strong>${relatorio.nao_conformidades_encontradas} não conformidades</strong> 
                    que requerem sua atenção imediata. Por favor, revise o relatório completo em anexo 
                    para detalhes específicos e ações recomendadas pela IA.
                  </p>
                </div>
              ` : `
                <div class="alert-box">
                  <h3>✅ Excelente!</h3>
                  <p>
                    Nenhuma não conformidade crítica foi identificada neste período. 
                    Continue mantendo os altos padrões de cuidado!
                  </p>
                </div>
              `}
              
              <div class="divider"></div>
              
              <!-- Anexo -->
              <div class="attachment-box">
                <strong>
                  📎 Relatório Completo em PDF
                </strong>
                <p>
                  O arquivo anexado contém análise detalhada, observações destacadas pelos cuidadores, 
                  tendências identificadas e sugestões práticas de melhorias para a equipe.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
              <p>Este é um email automático do Sistema de Gestão de Cuidados.</p>
              <p class="timestamp">Gerado em: ${new Date().toLocaleString('pt-BR', { 
                dateStyle: 'long', 
                timeStyle: 'short',
                timeZone: 'America/Sao_Paulo'
              })}</p>
              
              <div class="brand-footer">
                <p>🏥 Senex Care - Gestão Inteligente de Cuidados</p>
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
