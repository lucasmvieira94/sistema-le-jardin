import { Phone, ShieldPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AREA_PROTEGIDA } from "@/utils/areaProtegida";

export default function AreaProtegida() {
  return <section aria-label="Área protegida" className="border-l-4 border-destructive bg-destructive/5 px-4 py-4 space-y-3">
    <div className="flex items-start gap-3">
      <ShieldPlus className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
      <div className="min-w-0">
        <h2 className="text-base font-semibold">Área protegida · {AREA_PROTEGIDA.prestador}</h2>
        <p className="text-sm text-muted-foreground">Em caso de urgência ou emergência, ligue:</p>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
      {AREA_PROTEGIDA.telefones.map((telefone) => <Button key={telefone} asChild variant="destructive" className="min-h-11">
        <a href={`tel:${telefone}`} aria-label={`Ligar para ${telefone}`}><Phone className="mr-2 h-4 w-4 shrink-0" />{telefone.slice(0, 4)} {telefone.slice(4)}</a>
      </Button>)}
    </div>
    <p className="text-sm">Informe o código do contratante: <strong className="inline-block font-mono text-base select-all">{AREA_PROTEGIDA.codigoContratante}</strong></p>
  </section>;
}