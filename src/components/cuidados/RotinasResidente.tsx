import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO } from "@/utils/dateUtils";
import type { EventoCuidados } from "@/utils/agendaCuidados";
import { AFERICOES, TIPOS, descreverFrequencia, type ExecucaoRotina, type RotinaCuidado } from "@/utils/rotinasCuidados";
import RotinaDialog from "./RotinaDialog";
import EventoAgendaDialog from "./EventoAgendaDialog";
import { CartaoRotina, EncerrarRotinaDialog } from "./RotinasDia";

const somaDias = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const dataBR = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");
const dataHoraBR = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Próximos compromissos (aba Resumo da ficha). */
export function ProximosCompromissos({ residenteId }: { residenteId: string }) {
  const [lista, setLista] = useState<EventoCuidados[]>([]);
  const [novo, setNovo] = useState(false);
  const carregar = useCallback(() => { const h = hojeISO(); supabase.rpc("portal_cuidados_agenda_periodo" as any, { _inicio: h, _fim: somaDias(h, 60), _residente_id: residenteId }).then(({ data }) => setLista(((data as EventoCuidados[]) ?? []).filter((e) => !e.cancelado_em))); }, [residenteId]);
  useEffect(() => { carregar(); }, [carregar]);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1 font-semibold"><CalendarDays className="h-4 w-4" />Próximos compromissos</h3><Button size="sm" variant="ghost" onClick={() => setNovo(true)}><Plus className="mr-1 h-3.5 w-3.5" />Agendar</Button></div>
      {!lista.length ? <p className="text-sm text-muted-foreground">Nenhum compromisso agendado.</p> : lista.slice(0, 5).map((e) => (
        <div key={e.id} className="border-b py-1.5 text-sm"><b>{dataBR(e.data_evento)} {e.horario.slice(0, 5)}</b> · {e.titulo}{e.visto_em && <Badge variant="secondary" className="ml-2">Feito</Badge>}</div>
      ))}
      <EventoAgendaDialog open={novo} onOpenChange={setNovo} residentePadrao={residenteId} onSalvo={carregar} />
    </section>
  );
}

/** Aba Rotinas da ficha: ativas, encerradas e histórico de registros/aferições (30 dias). */
export default function RotinasResidente({ residenteId }: { residenteId: string }) {
  const [rotinas, setRotinas] = useState<RotinaCuidado[]>([]);
  const [historico, setHistorico] = useState<ExecucaoRotina[]>([]);
  const [editar, setEditar] = useState<RotinaCuidado | null | undefined>(undefined);
  const [encerrar, setEncerrar] = useState<RotinaCuidado | null>(null);
  const carregar = useCallback(async () => {
    const h = hojeISO();
    const [r, e] = await Promise.all([
      supabase.rpc("portal_rotinas_listar" as any, { _residente_id: residenteId, _incluir_encerradas: true }),
      supabase.rpc("portal_rotinas_execucoes" as any, { _inicio: somaDias(h, -30), _fim: h, _residente_id: residenteId }),
    ]);
    setRotinas((r.data as RotinaCuidado[]) ?? []); setHistorico((e.data as ExecucaoRotina[]) ?? []);
  }, [residenteId]);
  useEffect(() => { carregar(); }, [carregar]);
  const h = hojeISO();
  const ativas = rotinas.filter((r) => !r.encerrada_em && (!r.fim || r.fim >= h));
  const encerradas = rotinas.filter((r) => !ativas.includes(r));

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Rotinas ativas</h3><Button size="sm" onClick={() => setEditar(null)}><Plus className="mr-1 h-3.5 w-3.5" />Nova</Button></div>
        {!ativas.length && <p className="text-sm text-muted-foreground">Nenhuma rotina ativa.</p>}
        <div className="space-y-2">{ativas.map((r) => <CartaoRotina key={r.id} r={r} onEditar={() => setEditar(r)} onEncerrar={() => setEncerrar(r)} />)}</div>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Registros dos últimos 30 dias</h3>
        {!historico.length && <p className="text-sm text-muted-foreground">Sem registros.</p>}
        {historico.map((x) => (
          <div key={x.id} className="border-b py-1.5 text-sm">
            <span className="text-xs text-muted-foreground">{dataHoraBR(x.feito_em)} · {x.feito_por_nome}</span>
            <p>{x.titulo}{x.valor && <b> — {AFERICOES[x.tipo_afericao ?? ""] ? `${AFERICOES[x.tipo_afericao!]}: ` : ""}{x.valor}</b>}</p>
            {x.observacao && <p className="text-xs text-muted-foreground">{x.observacao}</p>}
          </div>
        ))}
      </section>
      {!!encerradas.length && (
        <section>
          <h3 className="mb-2 font-semibold">Encerradas</h3>
          {encerradas.map((r) => (
            <div key={r.id} className="border-b py-1.5 text-sm text-muted-foreground">
              <p className="text-foreground">{r.titulo} <Badge variant="outline">{TIPOS[r.tipo]}</Badge></p>
              <p className="text-xs">{descreverFrequencia(r)} · {dataBR(r.inicio)} a {r.fim ? dataBR(r.fim) : "—"}{r.motivo_encerramento ? ` · Motivo: ${r.motivo_encerramento}` : ""}</p>
            </div>
          ))}
        </section>
      )}
      <RotinaDialog open={editar !== undefined} onOpenChange={(o) => !o && setEditar(undefined)} rotina={editar} residentePadrao={residenteId} onSalvo={carregar} />
      <EncerrarRotinaDialog rotina={encerrar} onClose={() => setEncerrar(null)} onFeito={carregar} />
    </div>
  );
}
