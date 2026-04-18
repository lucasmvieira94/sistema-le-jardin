import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Syringe, Calendar, AlertCircle, CheckCircle2, Plus, Clock } from "lucide-react";
import { format, parseISO, differenceInDays, isPast, isAfter, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RegistroVacinaDialog } from "./RegistroVacinaDialog";

interface Props {
  residenteId: string;
  residenteNome: string;
  funcionarioId?: string;
  /** Quando true, esconde botão de cadastro (modo somente leitura) */
  readOnly?: boolean;
}

interface VacinaCatalogo {
  id: string;
  nome: string;
  descricao: string | null;
  doses_recomendadas: number;
  intervalo_dias: number | null;
  periodicidade: string;
  obrigatoria_idoso: boolean;
  ordem: number;
}

interface VacinaAplicada {
  id: string;
  vacina_id: string | null;
  nome_vacina: string;
  data_aplicacao: string;
  numero_dose: number;
  lote: string | null;
  fabricante: string | null;
  local_aplicacao_corpo: string | null;
  via_administracao: string | null;
  profissional_aplicador: string | null;
  local_aplicacao: string | null;
  reacoes_adversas: string | null;
  observacoes: string | null;
  proxima_dose_prevista: string | null;
}

const PERIODICIDADE_LABEL: Record<string, string> = {
  dose_unica: "Dose única",
  anual: "Anual",
  semestral: "Semestral",
  reforco_5_anos: "Reforço a cada 5 anos",
  reforco_10_anos: "Reforço a cada 10 anos",
  esquema_completo: "Esquema completo",
};

export function CartaoVacinalResidente({ residenteId, residenteNome, funcionarioId, readOnly }: Props) {
  const [catalogo, setCatalogo] = useState<VacinaCatalogo[]>([]);
  const [aplicadas, setAplicadas] = useState<VacinaAplicada[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vacinaPreSelecionada, setVacinaPreSelecionada] = useState<VacinaCatalogo | null>(null);

  const carregar = async () => {
    setLoading(true);
    const [catRes, aplRes] = await Promise.all([
      supabase.from("catalogo_vacinas").select("*").eq("ativo", true).order("ordem"),
      supabase
        .from("vacinas_residentes")
        .select("*")
        .eq("residente_id", residenteId)
        .order("data_aplicacao", { ascending: false }),
    ]);
    setCatalogo(catRes.data || []);
    setAplicadas(aplRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [residenteId]);

  const aplicadasPorVacina = (vacinaId: string) =>
    aplicadas.filter((a) => a.vacina_id === vacinaId).sort((a, b) => a.data_aplicacao.localeCompare(b.data_aplicacao));

  const outrasVacinas = aplicadas.filter((a) => !a.vacina_id);

  /** Status de cada vacina do catálogo para o residente */
  const getStatusVacina = (vac: VacinaCatalogo) => {
    const aplics = aplicadasPorVacina(vac.id);
    if (aplics.length === 0) {
      return { tipo: "pendente" as const, label: "Pendente", cor: "bg-muted text-muted-foreground" };
    }

    const ultima = aplics[aplics.length - 1];

    // Esquema com várias doses
    if (vac.doses_recomendadas > 1 && aplics.length < vac.doses_recomendadas) {
      return {
        tipo: "incompleto" as const,
        label: `${aplics.length}/${vac.doses_recomendadas} doses`,
        cor: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      };
    }

    // Verificar próxima dose prevista
    if (ultima.proxima_dose_prevista) {
      const dataPrevista = parseISO(ultima.proxima_dose_prevista);
      const hoje = new Date();
      const diff = differenceInDays(dataPrevista, hoje);

      if (isPast(dataPrevista)) {
        return {
          tipo: "atrasada" as const,
          label: `Atrasada (${Math.abs(diff)}d)`,
          cor: "bg-destructive/15 text-destructive",
        };
      }
      if (diff <= 30) {
        return {
          tipo: "proxima" as const,
          label: `Em ${diff}d`,
          cor: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        };
      }
    }

    return {
      tipo: "ok" as const,
      label: "Em dia",
      cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    };
  };

  const handleNovaAplicacao = (vac?: VacinaCatalogo) => {
    setVacinaPreSelecionada(vac || null);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Syringe className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Cartão Vacinal Digital</h2>
        </div>
        {!readOnly && (
          <Button onClick={() => handleNovaAplicacao()} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Registrar Vacina
          </Button>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total aplicadas</p>
            <p className="text-2xl font-bold">{aplicadas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Em dia</p>
            <p className="text-2xl font-bold text-emerald-600">
              {catalogo.filter((v) => getStatusVacina(v).tipo === "ok").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Próximas (30d)</p>
            <p className="text-2xl font-bold text-amber-600">
              {catalogo.filter((v) => getStatusVacina(v).tipo === "proxima").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Atrasadas</p>
            <p className="text-2xl font-bold text-destructive">
              {catalogo.filter((v) => getStatusVacina(v).tipo === "atrasada").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Calendário do Idoso (PNI) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Calendário Vacinal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {catalogo.map((vac) => {
            const status = getStatusVacina(vac);
            const aplics = aplicadasPorVacina(vac.id);
            const ultima = aplics[aplics.length - 1];

            return (
              <div
                key={vac.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">{vac.nome}</h4>
                    {vac.obrigatoria_idoso && (
                      <Badge variant="outline" className="text-xs">
                        Idoso
                      </Badge>
                    )}
                    <Badge className={`text-xs ${status.cor}`} variant="secondary">
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {PERIODICIDADE_LABEL[vac.periodicidade] || vac.periodicidade}
                    {vac.descricao ? ` • ${vac.descricao}` : ""}
                  </p>
                  {ultima && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      <p className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Última: {format(parseISO(ultima.data_aplicacao), "dd/MM/yyyy", { locale: ptBR })}
                        {ultima.lote ? ` • Lote ${ultima.lote}` : ""}
                      </p>
                      {ultima.proxima_dose_prevista && (
                        <p className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Próxima:{" "}
                          {format(parseISO(ultima.proxima_dose_prevista), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {!readOnly && (
                  <Button size="sm" variant="outline" onClick={() => handleNovaAplicacao(vac)}>
                    <Plus className="w-3 h-3 mr-1" /> Aplicar
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Outras vacinas */}
      {outrasVacinas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outras Vacinas Registradas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {outrasVacinas.map((v) => (
              <div key={v.id} className="p-3 rounded-lg border text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-medium">{v.nome_vacina}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(v.data_aplicacao), "dd/MM/yyyy", { locale: ptBR })} • Dose {v.numero_dose}
                  </span>
                </div>
                {v.lote && <p className="text-xs text-muted-foreground mt-1">Lote: {v.lote}</p>}
                {v.observacoes && <p className="text-xs text-muted-foreground mt-1">{v.observacoes}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Histórico completo */}
      {aplicadas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico Completo ({aplicadas.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {aplicadas.map((v) => (
              <div key={v.id} className="p-2 rounded border-l-4 border-primary/40 bg-muted/30 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-medium">{v.nome_vacina}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(v.data_aplicacao), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dose {v.numero_dose}
                  {v.lote ? ` • Lote ${v.lote}` : ""}
                  {v.fabricante ? ` • ${v.fabricante}` : ""}
                  {v.profissional_aplicador ? ` • ${v.profissional_aplicador}` : ""}
                </p>
                {v.reacoes_adversas && (
                  <p className="text-xs text-destructive mt-1 flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    Reações: {v.reacoes_adversas}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!readOnly && (
        <RegistroVacinaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          residenteId={residenteId}
          residenteNome={residenteNome}
          funcionarioId={funcionarioId}
          catalogo={catalogo}
          vacinaPreSelecionada={vacinaPreSelecionada}
          onSuccess={() => {
            setDialogOpen(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}
