import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TIPO_LABELS: Record<string, string> = {
  advertencia_verbal: "ADVERTÊNCIA VERBAL",
  advertencia_escrita: "ADVERTÊNCIA ESCRITA",
  suspensao: "SUSPENSÃO DISCIPLINAR",
  justa_causa: "DEMISSÃO POR JUSTA CAUSA",
};

export interface AdvertenciaImpressao {
  id: string;
  tipo: string;
  motivo: string;
  descricao: string;
  data_ocorrencia: string;
  dias_suspensao: number | null;
  data_inicio_suspensao: string | null;
  data_fim_suspensao: string | null;
  testemunha_1: string | null;
  cpf_testemunha_1: string | null;
  testemunha_2: string | null;
  cpf_testemunha_2: string | null;
  funcionario_recusou_assinar: boolean;
  observacoes: string | null;
  created_at: string;
  hash_verificacao: string | null;
  funcionarios: {
    nome_completo: string;
    funcao: string;
    cpf?: string;
  };
}

interface ImpressaoAdvertenciaProps {
  advertencia: AdvertenciaImpressao;
  onClose: () => void;
}

export default function ImpressaoAdvertencia({ advertencia, onClose }: ImpressaoAdvertenciaProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [empresa, setEmpresa] = useState<{ nome_empresa: string; cnpj: string | null; logo_url: string | null } | null>(null);

  useEffect(() => {
    async function fetchEmpresa() {
      const { data } = await supabase
        .from("configuracoes_empresa")
        .select("nome_empresa, cnpj, logo_url")
        .limit(1)
        .single();
      if (data) setEmpresa(data);
    }
    fetchEmpresa();
  }, []);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${TIPO_LABELS[advertencia.tipo] || "DOCUMENTO DISCIPLINAR"}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.4; color: #000; padding: 20px 50px; }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 6px; }
          .header h1 { font-size: 13pt; font-weight: bold; margin-bottom: 2px; letter-spacing: 1px; }
          .header h2 { font-size: 10pt; font-weight: normal; color: #333; }
          .tipo-doc { text-align: center; font-size: 12pt; font-weight: bold; margin: 8px 0; text-decoration: underline; letter-spacing: 1px; }
          .info-box { border: 1px solid #333; padding: 8px 12px; margin: 8px 0; }
          .info-row { display: flex; margin-bottom: 3px; }
          .info-label { font-weight: bold; min-width: 160px; }
          .info-value { flex: 1; }
          .descricao { margin: 10px 0; text-align: justify; }
          .descricao h3 { font-weight: bold; margin-bottom: 4px; font-size: 11pt; }
          .descricao p { text-indent: 2em; }
          .suspensao-box { border: 1px solid #333; padding: 8px; margin: 8px 0; background: #f9f9f9; }
          .legal-text { margin: 12px 0; font-size: 9pt; text-align: justify; border-top: 1px solid #ccc; padding-top: 8px; }
          .legal-text p { margin-bottom: 4px; }
          .assinaturas { margin-top: 25px; }
          .assinatura-row { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .assinatura-item { text-align: center; width: 45%; }
          .assinatura-linha { border-top: 1px solid #000; padding-top: 3px; margin-top: 25px; font-size: 9pt; }
          .recusa-box { border: 1px dashed #666; padding: 6px; margin: 8px 0; font-size: 9pt; }
          .hash-box { margin-top: 12px; padding: 6px; border: 1px solid #ccc; font-size: 7pt; color: #666; text-align: center; }
          .hash-box p { margin-bottom: 2px; }
          .data-local { text-align: right; margin: 10px 0; font-size: 10pt; }
          @media print { body { padding: 15px 40px; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const dataOcorrencia = format(new Date(advertencia.data_ocorrencia + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const dataRegistro = format(new Date(advertencia.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Visualização para Impressão</h3>
        <div className="flex gap-2">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button variant="outline" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Preview visível no modal */}
      <div className="border rounded-lg p-6 bg-white text-black max-h-[65vh] overflow-y-auto text-sm leading-relaxed" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        <div ref={printRef}>
          {/* Cabeçalho */}
          <div className="header">
            {empresa?.logo_url && (
              <img src={empresa.logo_url} alt="Logotipo" style={{ maxHeight: '50px', margin: '0 auto 6px', display: 'block' }} />
            )}
            <h1>{empresa?.nome_empresa || "EMPRESA"}</h1>
            {empresa?.cnpj && <p style={{ fontSize: '10pt', margin: '3px 0 0' }}>CNPJ: {empresa.cnpj}</p>}
            <h2>Documento Disciplinar</h2>
          </div>

          {/* Tipo */}
          <div className="tipo-doc">
            {TIPO_LABELS[advertencia.tipo] || "DOCUMENTO DISCIPLINAR"}
          </div>

          {/* Dados do funcionário */}
          <div className="info-box">
            <div className="info-row">
              <span className="info-label">Funcionário:</span>
              <span className="info-value">{advertencia.funcionarios.nome_completo}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Função:</span>
              <span className="info-value">{advertencia.funcionarios.funcao}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Data da Ocorrência:</span>
              <span className="info-value">{dataOcorrencia}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Motivo (Base Legal):</span>
              <span className="info-value">{advertencia.motivo}</span>
            </div>
          </div>

          {/* Descrição */}
          <div className="descricao">
            <h3>DESCRIÇÃO DOS FATOS</h3>
            <p>{advertencia.descricao}</p>
          </div>

          {/* Suspensão */}
          {advertencia.tipo === "suspensao" && advertencia.dias_suspensao && (
            <div className="suspensao-box">
              <p><strong>DADOS DA SUSPENSÃO (Art. 474, CLT — máx. 30 dias):</strong></p>
              <p>Dias de suspensão: <strong>{advertencia.dias_suspensao}</strong></p>
              {advertencia.data_inicio_suspensao && (
                <p>Período: de <strong>{format(new Date(advertencia.data_inicio_suspensao + "T00:00:00"), "dd/MM/yyyy")}</strong>
                  {advertencia.data_fim_suspensao && <> até <strong>{format(new Date(advertencia.data_fim_suspensao + "T00:00:00"), "dd/MM/yyyy")}</strong></>}
                </p>
              )}
            </div>
          )}

          {/* Observações */}
          {advertencia.observacoes && (
            <div className="descricao">
              <h3>OBSERVAÇÕES</h3>
              <p>{advertencia.observacoes}</p>
            </div>
          )}

          {/* Texto legal */}
          <div className="legal-text">
            <p>Pelo presente documento, o(a) empregado(a) acima identificado(a) fica formalmente {advertencia.tipo === "suspensao" ? "suspenso(a)" : "advertido(a)"} em razão dos fatos acima descritos, com fundamento no Art. 482 da Consolidação das Leis do Trabalho (CLT) e demais disposições legais aplicáveis.</p>
            <p>O(a) empregado(a) declara estar ciente de que a reincidência poderá acarretar sanções disciplinares mais severas, inclusive a rescisão do contrato de trabalho por justa causa.</p>
            <p>Este documento é parte integrante do prontuário funcional do(a) empregado(a) e está em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
          </div>

          {/* Data e local */}
          <div className="data-local">
            <p>_________________, {hoje}</p>
          </div>

          {/* Assinaturas */}
          <div className="assinaturas">
            <div className="assinatura-row">
              <div className="assinatura-item">
                <div className="assinatura-linha">
                  <p><strong>Empregador / Representante</strong></p>
                </div>
              </div>
              <div className="assinatura-item">
                <div className="assinatura-linha">
                  <p><strong>{advertencia.funcionarios.nome_completo}</strong></p>
                  <p>Empregado(a)</p>
                </div>
              </div>
            </div>

            {/* Testemunhas */}
            {(advertencia.testemunha_1 || advertencia.testemunha_2) && (
              <div className="assinatura-row">
                {advertencia.testemunha_1 && (
                  <div className="assinatura-item">
                    <div className="assinatura-linha">
                      <p><strong>{advertencia.testemunha_1}</strong></p>
                      {advertencia.cpf_testemunha_1 && <p>CPF: {advertencia.cpf_testemunha_1}</p>}
                      <p>Testemunha 1</p>
                    </div>
                  </div>
                )}
                {advertencia.testemunha_2 && (
                  <div className="assinatura-item">
                    <div className="assinatura-linha">
                      <p><strong>{advertencia.testemunha_2}</strong></p>
                      {advertencia.cpf_testemunha_2 && <p>CPF: {advertencia.cpf_testemunha_2}</p>}
                      <p>Testemunha 2</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recusa */}
          {advertencia.funcionario_recusou_assinar && (
            <div className="recusa-box">
              <p><strong>REGISTRO DE RECUSA:</strong> O(a) empregado(a) recusou-se a assinar o presente documento, conforme testemunhado pelas pessoas acima identificadas.</p>
            </div>
          )}

          {/* Hash de verificação */}
          <div className="hash-box">
            <p><strong>CÓDIGO DE VERIFICAÇÃO DE INTEGRIDADE</strong></p>
            <p>Hash SHA-256: <strong>{advertencia.hash_verificacao || "Não disponível"}</strong></p>
            <p>Registro: {advertencia.id} | Gerado em: {dataRegistro}</p>
            <p>Este código garante a integridade e autenticidade do documento conforme LGPD (Lei 13.709/2018) e Marco Civil da Internet (Lei 12.965/2014).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
