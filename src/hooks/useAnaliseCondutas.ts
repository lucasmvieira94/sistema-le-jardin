import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, getDay, format, subDays } from "date-fns";
import { parseDataLocal, hojeISO } from "@/utils/dateUtils";

export type TipoAlertaConduta =
  | "atraso"
  | "atrasos_recorrentes"
  | "falta"
  | "saida_nao_registrada"
  | "intervalo_nao_registrado"
  | "intervalo_incompleto"
  | "intervalo_insuficiente";


export interface AlertaConduta {
  id: string;
  tipo: TipoAlertaConduta;
  funcionario_id: string;
  funcionario_nome: string;
  data: string;
  descricao: string;
  minutos_atraso?: number;
  horario_previsto?: string;
  horario_registrado?: string;
  detalhes?: Record<string, any>;
}

export interface JustificativaAtraso {
  id: string;
  tenant_id: string;
  funcionario_id: string;
  funcionario_nome?: string;
  registro_ponto_id: string | null;
  data: string;
  horario_previsto: string;
  horario_registrado: string;
  minutos_atraso: number;
  justificativa: string;
  status: "pendente" | "aprovada" | "rejeitada";
  resposta_gestor: string | null;
  analisado_em: string | null;
  created_at: string;
}

/** Retorna true se, dada a jornada e a data de início de vigência, o funcionário estaria de folga. */
function estaEmFolga(jornada: string, dataInicioVigencia: string, dia: Date): boolean {
  const inicio = parseDataLocal(dataInicioVigencia);
  const diff = differenceInDays(dia, inicio);
  const dow = getDay(dia); // 0=dom
  switch (jornada) {
    case "12x36": return diff % 2 === 1;
    case "24x48": return diff % 3 !== 0;
    case "6x1": return diff % 7 === 6;
    case "5x2":
    case "40h_8h_segsex": return dow === 0 || dow === 6;
    case "44h_8h_segsex_4h_sab":
    case "36h_6h_seg_sab": return dow === 0;
    default: return false;
  }
}

function diffMinutos(previsto: string, real: string): number {
  const [ph, pm] = previsto.split(":").map(Number);
  const [rh, rm] = real.split(":").map(Number);
  return (rh * 60 + rm) - (ph * 60 + pm);
}

const TOLERANCIA_ATRASO_MIN = 15;
const LIMITE_ATRASOS_MES = 3;

export function useAnaliseCondutas(diasAnalise = 30) {
  const [alertas, setAlertas] = useState<AlertaConduta[]>([]);
  const [justificativas, setJustificativas] = useState<JustificativaAtraso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const hoje = parseDataLocal(hojeISO());
        const dataInicio = format(subDays(hoje, diasAnalise), "yyyy-MM-dd");
        const dataFimStr = hojeISO();

        const { data: funcionarios } = await supabase
          .from("funcionarios")
          .select("id, nome_completo, data_inicio_vigencia, escala_id, escalas:escala_id(entrada, saida, jornada_trabalho, intervalo_pre_assinalado, intervalo_minutos)")
          .eq("ativo", true);

        const { data: registros } = await supabase
          .from("registros_ponto")
          .select("id, funcionario_id, data, entrada, saida, intervalo_inicio, intervalo_fim, intervalos_pausas")
          .gte("data", dataInicio)
          .lte("data", dataFimStr);

        const { data: afastamentos } = await supabase
          .from("afastamentos")
          .select("funcionario_id, data_inicio, data_fim")
          .lte("data_inicio", dataFimStr)
          .gte("data_fim", dataInicio);

        const { data: justifs } = await supabase
          .from("justificativas_atraso")
          .select("*, funcionarios:funcionario_id(nome_completo)")
          .gte("data", dataInicio)
          .order("created_at", { ascending: false });

        const jsList: JustificativaAtraso[] = (justifs || []).map((j: any) => ({
          ...j,
          funcionario_nome: j.funcionarios?.nome_completo,
        }));
        setJustificativas(jsList);

        const novosAlertas: AlertaConduta[] = [];
        const contagemAtrasoPorFunc = new Map<string, number>();

        for (const func of funcionarios || []) {
          const escala: any = (func as any).escalas;
          if (!escala || !escala.entrada) continue;
          const jornada = escala.jornada_trabalho || "5x2";
          const inicioVig = (func as any).data_inicio_vigencia;
          if (!inicioVig) continue;

          // afastamentos do funcionário
          const afastFunc = (afastamentos || []).filter((a: any) => a.funcionario_id === func.id);
          const afastadoEm = (d: string) =>
            afastFunc.some((a: any) => d >= a.data_inicio && d <= a.data_fim);

          // Iterar por cada dia
          for (let i = 0; i <= diasAnalise; i++) {
            const dia = subDays(hoje, i);
            const diaStr = format(dia, "yyyy-MM-dd");
            if (diaStr === hojeISO()) continue; // ignora dia corrente (ainda em curso)

            if (estaEmFolga(jornada, inicioVig, dia)) continue;
            if (afastadoEm(diaStr)) continue;

            const reg: any = (registros || []).find(
              (r: any) => r.funcionario_id === func.id && r.data === diaStr
            );

            // Sem entrada → falta
            if (!reg || !reg.entrada) {
              novosAlertas.push({
                id: `falta-${func.id}-${diaStr}`,
                tipo: "falta",
                funcionario_id: func.id,
                funcionario_nome: func.nome_completo,
                data: diaStr,
                descricao: `Não registrou entrada em ${format(dia, "dd/MM/yyyy")}`,
              });
              continue;
            }

            // Entrada existente
            if (reg.entrada) {
              const atrasoMin = diffMinutos(escala.entrada, reg.entrada);
              if (atrasoMin > TOLERANCIA_ATRASO_MIN) {
                novosAlertas.push({
                  id: `atraso-${func.id}-${diaStr}`,
                  tipo: "atraso",
                  funcionario_id: func.id,
                  funcionario_nome: func.nome_completo,
                  data: diaStr,
                  descricao: `Chegou ${atrasoMin} min após o horário previsto (${escala.entrada.slice(0, 5)})`,
                  minutos_atraso: atrasoMin,
                  horario_previsto: escala.entrada,
                  horario_registrado: reg.entrada,
                });
                contagemAtrasoPorFunc.set(
                  func.id,
                  (contagemAtrasoPorFunc.get(func.id) || 0) + 1
                );
              }

              // Saída não registrada
              if (!reg.saida) {
                novosAlertas.push({
                  id: `saida-${func.id}-${diaStr}`,
                  tipo: "saida_nao_registrada",
                  funcionario_id: func.id,
                  funcionario_nome: func.nome_completo,
                  data: diaStr,
                  descricao: `Registrou entrada mas não registrou saída`,
                });
              }

              // ===== Análise de intervalo (somente escalas SEM intervalo pré-assinalado) =====
              if (!escala.intervalo_pre_assinalado) {
                const pausas: any[] = Array.isArray(reg.intervalos_pausas)
                  ? reg.intervalos_pausas
                  : [];

                // Pausa iniciada e não finalizada
                const pausaAberta = pausas.some((p) => p?.inicio && !p?.fim);
                const intervaloLegadoAberto = !!reg.intervalo_inicio && !reg.intervalo_fim;

                // Total de minutos efetivamente registrados
                let minutosIntervalo = 0;
                for (const p of pausas) {
                  if (p?.inicio && p?.fim) {
                    let d = diffMinutos(p.inicio, p.fim);
                    if (d < 0) d += 24 * 60;
                    minutosIntervalo += d;
                  }
                }
                if (pausas.length === 0 && reg.intervalo_inicio && reg.intervalo_fim) {
                  let d = diffMinutos(reg.intervalo_inicio, reg.intervalo_fim);
                  if (d < 0) d += 24 * 60;
                  minutosIntervalo += d;
                }

                // Mínimo exigido pela CLT conforme duração da jornada prevista
                let jornadaMin = diffMinutos(escala.entrada, escala.saida || escala.entrada);
                if (jornadaMin < 0) jornadaMin += 24 * 60;
                const minimoExigido =
                  jornadaMin > 360
                    ? Number(escala.intervalo_minutos) || 60
                    : jornadaMin > 240
                    ? 15
                    : 0;

                const nenhumRegistro = minutosIntervalo === 0 && !pausaAberta && !intervaloLegadoAberto;

                if (pausaAberta || intervaloLegadoAberto) {
                  novosAlertas.push({
                    id: `interv-aberto-${func.id}-${diaStr}`,
                    tipo: "intervalo_incompleto",
                    funcionario_id: func.id,
                    funcionario_nome: func.nome_completo,
                    data: diaStr,
                    descricao: `Iniciou o intervalo mas não registrou o retorno`,
                    detalhes: { minutos_registrados: minutosIntervalo, minimo_exigido: minimoExigido },
                  });
                } else if (minimoExigido > 0 && nenhumRegistro) {
                  novosAlertas.push({
                    id: `interv-${func.id}-${diaStr}`,
                    tipo: "intervalo_nao_registrado",
                    funcionario_id: func.id,
                    funcionario_nome: func.nome_completo,
                    data: diaStr,
                    descricao: `Não registrou intervalo (mínimo exigido: ${minimoExigido} min)`,
                    detalhes: { minimo_exigido: minimoExigido },
                  });
                } else if (minimoExigido > 0 && minutosIntervalo > 0 && minutosIntervalo < minimoExigido) {
                  novosAlertas.push({
                    id: `interv-insuf-${func.id}-${diaStr}`,
                    tipo: "intervalo_insuficiente",
                    funcionario_id: func.id,
                    funcionario_nome: func.nome_completo,
                    data: diaStr,
                    descricao: `Intervalo de ${minutosIntervalo} min abaixo do mínimo de ${minimoExigido} min`,
                    detalhes: { minutos_registrados: minutosIntervalo, minimo_exigido: minimoExigido },
                  });
                }
              }

            }
          }
        }

        // Alertas de recorrência (3+ atrasos no período)
        for (const [funcId, qtd] of contagemAtrasoPorFunc) {
          if (qtd >= LIMITE_ATRASOS_MES) {
            const func = funcionarios?.find((f: any) => f.id === funcId);
            novosAlertas.push({
              id: `recorrencia-${funcId}`,
              tipo: "atrasos_recorrentes",
              funcionario_id: funcId,
              funcionario_nome: func?.nome_completo || "",
              data: hojeISO(),
              descricao: `${qtd} atrasos acima de ${TOLERANCIA_ATRASO_MIN} min nos últimos ${diasAnalise} dias`,
              detalhes: { quantidade: qtd },
            });
          }
        }

        setAlertas(novosAlertas);
      } catch (e) {
        console.error("[useAnaliseCondutas] erro:", e);
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, [diasAnalise, refreshKey]);

  return { alertas, justificativas, loading, refresh };
}