import { useState } from "react";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Ocorrencia, RotinaCuidado } from "@/utils/rotinasCuidados";
import { useRotinasDia } from "./useRotinasDia";
import { DetalhesRotinaDialog, RegistrarOcorrenciaDialog } from "./RotinasDia";

const COR: Record<string, string> = { atrasado: "border-destructive bg-destructive/5", agora: "border-primary bg-primary/5", proximo: "", feito: "opacity-70" };
const ROTULO: Record<string, string> = { atrasado: "Atrasado", agora: "Agora", proximo: "Próximo", feito: "Feito" };
const horaBR = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Coluna "Rotinas do dia" da tela inicial: ocorrências por horário; tocar abre detalhes/confirmação. */
export default function RotinasDiaColuna({ onAbrirRotinas }: { onAbrirRotinas: () => void }) {
  const { rotinas, ocorrencias, carregar } = useRotinasDia();
  const [alvo, setAlvo] = useState<Ocorrencia | null>(null);
  const [detalhe, setDetalhe] = useState<RotinaCuidado | null>(null);
  const pendentes = ocorrencias.filter((o) => o.status !== "feito").length;

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><ClipboardList className="h-5 w-5 text-primary" />Rotinas do dia</h2>
            <Button size="sm" variant="ghost" onClick={onAbrirRotinas}>Rotinas</Button>
          </div>
          {rotinas === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !ocorrencias.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma rotina para hoje.</p>
          ) : (
            <ul className="space-y-2">
              {ocorrencias.map((o) => (
                <li key={`${o.rotina.id}${o.data}${o.chave}`}>
                  <button type="button" onClick={() => (o.execucao ? setDetalhe(o.rotina) : setAlvo(o))}
                    className={`w-full rounded-lg border p-2.5 text-left text-sm transition hover:border-primary ${COR[o.status]}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{o.rotulo}</span>
                      <Badge variant={o.status === "atrasado" ? "destructive" : "secondary"} className="shrink-0">{ROTULO[o.status]}</Badge>
                    </div>
                    <p className="font-medium">{o.rotina.titulo}</p>
                    <p className="text-xs text-muted-foreground">{o.rotina.residente_nome}</p>
                    {o.execucao ? (
                      <p className="text-xs">{o.execucao.valor ? <b>{o.execucao.valor} · </b> : null}{o.execucao.feito_por_nome} às {horaBR(o.execucao.feito_em)}</p>
                    ) : (
                      <p className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" />Toque para ver e confirmar</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rotinas !== null && !!ocorrencias.length && (
            <p className="mt-2 text-xs text-muted-foreground">{pendentes ? `${pendentes} pendente(s)` : "Tudo feito por enquanto"}</p>
          )}
        </CardContent>
      </Card>
      <DetalhesRotinaDialog rotina={detalhe} onClose={() => setDetalhe(null)} />
      <RegistrarOcorrenciaDialog alvo={alvo} onClose={() => setAlvo(null)} onFeito={carregar} />
    </>
  );
}
