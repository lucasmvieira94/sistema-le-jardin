import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";

export type DocumentoTipo = "contrato_residente" | "contrato_temporario" | "advertencia";

export interface RegistrarDocumentoInput {
  tipo: DocumentoTipo;
  referencia_id?: string | null;
  referencia_tabela?: string | null;
  numero_documento?: string | null;
  titular_nome: string;
  dados_estruturais: Record<string, any>;
  tenant_id?: string | null;
}

export interface DocumentoAutenticidade {
  id: string;
  hash: string;
  urlVerificacao: string;
  qrDataUrl: string;
}

function buildUrlVerificacao(id: string, hash: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/verificar-documento?id=${encodeURIComponent(id)}&hash=${encodeURIComponent(hash)}`;
}

/**
 * Hook que registra o documento no backend (gera + persiste hash SHA-256, auditoria com IP/usuário)
 * e devolve o QR Code + URL de verificação pública para inserir no rodapé do PDF.
 */
export function useDocumentoAutenticidade() {
  const [loading, setLoading] = useState(false);

  const registrar = useCallback(
    async (input: RegistrarDocumentoInput): Promise<DocumentoAutenticidade> => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("registrar-documento", {
          body: input,
        });
        if (error) throw error;
        if (!data?.id || !data?.hash) throw new Error("Falha ao registrar documento");

        const urlVerificacao = buildUrlVerificacao(data.id, data.hash);
        const qrDataUrl = await QRCode.toDataURL(urlVerificacao, {
          width: 160,
          margin: 1,
          errorCorrectionLevel: "M",
        });

        return { id: data.id, hash: data.hash, urlVerificacao, qrDataUrl };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { registrar, loading };
}

/**
 * Gera o HTML do rodapé de autenticidade a ser injetado nos PDFs.
 * Mantém o estilo consistente entre contratos e advertências (Times New Roman).
 */
export function rodapeAutenticidadeHTML(auth: DocumentoAutenticidade): string {
  return `
    <div class="autenticidade" style="margin-top:24px;padding:10px;border:1px solid #999;font-family:'Times New Roman',Times,serif;font-size:9pt;color:#222;page-break-inside:avoid;">
      <table style="width:100%;border-collapse:collapse;"><tr>
        <td style="width:170px;vertical-align:top;text-align:center;padding-right:10px;">
          <img src="${auth.qrDataUrl}" alt="QR Code de verificação" style="width:140px;height:140px;display:block;margin:0 auto;" />
          <div style="font-size:8pt;margin-top:3px;">Escaneie para verificar</div>
        </td>
        <td style="vertical-align:top;text-align:left;">
          <div style="font-weight:bold;font-size:10pt;margin-bottom:4px;">CÓDIGO DE AUTENTICIDADE</div>
          <div><strong>ID:</strong> ${auth.id}</div>
          <div style="word-break:break-all;"><strong>Hash SHA-256:</strong> ${auth.hash}</div>
          <div style="margin-top:4px;"><strong>Verificar em:</strong> ${auth.urlVerificacao}</div>
          <div style="margin-top:6px;font-size:8pt;color:#555;">
            Este documento é arquivado eletronicamente em conformidade com a LGPD (Lei 13.709/2018).
            Qualquer alteração no conteúdo invalidará o hash acima.
          </div>
        </td>
      </tr></table>
    </div>
  `;
}