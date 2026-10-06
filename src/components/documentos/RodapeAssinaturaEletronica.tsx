import sxCareLogo from "@/assets/sxcare-assinatura-eletronica.jpg.asset.json";
import type { RegistroAssinaturaDocumento, SeloAutenticidade } from "@/utils/rodapeDocumento";
import { formatarDataHoraAssinatura, normalizarHashDocumento } from "@/utils/rodapeDocumento";

interface RodapeAssinaturaEletronicaProps {
  autenticidade: SeloAutenticidade;
  assinatura?: RegistroAssinaturaDocumento | null;
  className?: string;
}

/** Visualização responsiva do mesmo rodapé usado nos PDFs emitidos pelo sistema. */
export function RodapeAssinaturaEletronica({
  autenticidade,
  assinatura,
  className = "",
}: RodapeAssinaturaEletronicaProps) {
  return (
    <section
      aria-label="Assinatura eletrônica e verificação de autenticidade"
      className={`w-full border-y border-border bg-background text-foreground print:break-inside-avoid ${className}`}
    >
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 border-b border-border px-1 py-3 sm:grid-cols-[76px_minmax(0,1fr)]">
        <img
          src={sxCareLogo.url}
          alt="SXCare assinatura eletrônica"
          className="h-16 w-16 rounded border border-border object-cover sm:h-[76px] sm:w-[76px]"
        />
        {assinatura ? (
          <p className="min-w-0 text-xs leading-relaxed sm:text-sm">
            Documento assinado eletronicamente por <strong>{assinatura.nome}</strong>
            {assinatura.papel ? <>, {assinatura.papel}</> : null} em{" "}
            {formatarDataHoraAssinatura(assinatura.assinadoEm)}, conforme horário oficial de Brasília.
          </p>
        ) : (
          <p className="min-w-0 text-xs leading-relaxed sm:text-sm">
            <strong>DOCUMENTO ELETRÔNICO · AUTENTICIDADE</strong><br />
            Este bloco comprova a integridade do documento; não representa assinatura eletrônica.
          </p>
        )}
      </div>

      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 px-1 py-3 sm:grid-cols-[88px_minmax(0,1fr)]">
        <img
          src={autenticidade.qrDataUrl}
          alt="QR Code para verificar o documento"
          className="h-[76px] w-[76px] sm:h-[88px] sm:w-[88px]"
        />
        <p className="min-w-0 break-words text-[11px] leading-relaxed sm:text-xs">
          A autenticidade deste documento pode ser conferida no site{" "}
          <a className="underline" href={autenticidade.urlVerificacao}>
            {autenticidade.urlVerificacao}
          </a>
          , informando o código verificador <strong>{autenticidade.id}</strong> e o código CRC/SHA-256{" "}
          <strong className="break-all font-mono">{normalizarHashDocumento(autenticidade.hash)}</strong>.
        </p>
      </div>
    </section>
  );
}