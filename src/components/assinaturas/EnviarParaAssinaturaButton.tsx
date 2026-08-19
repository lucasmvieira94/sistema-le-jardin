/**
 * Botão reutilizável que envia um documento JÁ GERADO pelo sistema
 * (contrato, contrato temporário, advertência, recibo, folha de ponto...)
 * para o fluxo de assinatura eletrônica.
 *
 * - A rubrica institucional da empresa é aplicada automaticamente pelo
 *   edge function `assinatura-envelope` (signatário com método `rubrica_empresa`).
 * - Quando há signatário externo, o link público `/assinar/:token` é gerado e
 *   enviado por e-mail/WhatsApp, podendo também ser copiado na Central de Assinaturas.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSignature } from 'lucide-react';
import NovoEnvelopeDialog from '@/components/assinaturas/NovoEnvelopeDialog';
import type { SignatarioInput } from '@/hooks/useAssinaturas';

export interface EnviarParaAssinaturaProps {
  /** Título do documento no envelope. */
  titulo: string;
  /** Tipo (chave de TIPO_LABEL). */
  tipo: string;
  /** Função que devolve o HTML final do documento no momento do clique. */
  obterConteudoHtml: () => string;
  /** Signatários externos sugeridos (além da empresa). */
  signatarios?: SignatarioInput[];
  referenciaId?: string | null;
  referenciaTabela?: string | null;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  className?: string;
  label?: string;
  disabled?: boolean;
}

export default function EnviarParaAssinaturaButton({
  titulo,
  tipo,
  obterConteudoHtml,
  signatarios,
  referenciaId,
  referenciaTabela,
  size = 'sm',
  variant = 'outline',
  className,
  label = 'Assinar',
  disabled,
}: EnviarParaAssinaturaProps) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState('');

  const abrir = () => {
    setHtml(obterConteudoHtml());
    setOpen(true);
  };

  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} onClick={abrir} disabled={disabled}>
        <FileSignature className="w-4 h-4 mr-2" />
        {label}
      </Button>

      {open && (
        <NovoEnvelopeDialog
          open={open}
          onOpenChange={setOpen}
          inicial={{
            titulo,
            tipo,
            conteudo_html: html,
            referencia_id: referenciaId ?? undefined,
            referencia_tabela: referenciaTabela ?? undefined,
            signatarios,
          }}
        />
      )}
    </>
  );
}
