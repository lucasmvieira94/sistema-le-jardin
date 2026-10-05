import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { rodapeDocumentoHTML } from "@/utils/rodapeDocumento";

export type DocumentoTipo =
  | "contrato_residente"
  | "contrato_temporario"
  | "advertencia"
  | "recibo_pagamento";

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
  return rodapeDocumentoHTML(auth);
}