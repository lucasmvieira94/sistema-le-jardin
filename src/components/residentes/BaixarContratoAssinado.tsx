/**
 * Baixa a via final assinada (mesmo PDF certificado enviado por e-mail)
 * de um envelope concluído. Usado na lista de residentes e no contrato.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileCheck2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { prepararViaFinal, salvarViaFinal } from "@/utils/baixarViaFinal";

interface Props {
  envelopeId: string;
  titulo: string;
  label?: string;
  compacto?: boolean;
}

export default function BaixarContratoAssinado({ envelopeId, titulo, label = "Baixar PDF assinado", compacto }: Props) {
  const { toast } = useToast();
  const [carregando, setCarregando] = useState(false);

  const baixar = async () => {
    setCarregando(true);
    try {
      const { blob, filename } = await prepararViaFinal(envelopeId, titulo);
      await salvarViaFinal(blob, filename);
    } catch (e) {
      toast({ title: "Não foi possível baixar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  };

  const icone = carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />;
  if (compacto) {
    return (
      <Button variant="ghost" size="sm" onClick={baixar} disabled={carregando} title="Contrato assinado — baixar PDF" aria-label="Baixar contrato assinado" className="h-7 px-1.5 text-emerald-600 hover:text-emerald-700">
        {icone}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={baixar} disabled={carregando} className="text-emerald-700">
      {icone}<span className="ml-2">{label}</span>
    </Button>
  );
}
