
import React, { useState, useEffect } from "react";
import { Edit2, Save, X, Trash2, Clock, Coffee, LogIn, LogOut, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

/** Pausa individual registrada pelo funcionário no dia. */
interface Pausa {
  inicio: string | null;
  fim: string | null;
}

interface RegistroPonto {
  id: string;
  data: string;
  entrada: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  saida: string | null;
  observacoes: string | null;
  funcionario_id: string;
  intervalos_pausas?: Pausa[] | null;
}

interface EscalaInfo {
  nome?: string | null;
  entrada: string;
  saida: string;
  intervalo_minutos?: number | null;
  intervalo_pre_assinalado?: boolean | null;
}

/* ---------- Helpers de tempo (puros, fáceis de testar) ---------- */

/** Converte "HH:MM[:SS]" em minutos desde 00:00. Retorna null se inválido. */
export function horaParaMinutos(hora?: string | null): number | null {
  if (!hora) return null;
  const [h, m] = hora.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Formata minutos em "HHhMM". */
export function formatarMinutos(min: number): string {
  const sinal = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  return `${sinal}${String(Math.floor(abs / 60)).padStart(2, "0")}h${String(abs % 60).padStart(2, "0")}`;
}

/** Normaliza o JSONB de pausas em uma lista tipada. */
export function parsePausas(valor: unknown): Pausa[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((p) => p && typeof p === "object")
    .map((p: any) => ({ inicio: p.inicio ?? null, fim: p.fim ?? null }));
}

/** Total, em minutos, das pausas finalizadas (fallback no par legado). */
export function totalIntervaloMinutos(registro: RegistroPonto): number {
  const pausas = parsePausas(registro.intervalos_pausas);
  if (pausas.length > 0) {
    return pausas.reduce((acc, p) => {
      const i = horaParaMinutos(p.inicio);
      const f = horaParaMinutos(p.fim);
      if (i === null || f === null) return acc;
      return acc + (f >= i ? f - i : f + 1440 - i);
    }, 0);
  }
  const i = horaParaMinutos(registro.intervalo_inicio);
  const f = horaParaMinutos(registro.intervalo_fim);
  if (i === null || f === null) return 0;
  return f >= i ? f - i : f + 1440 - i;
}

/** Minutos trabalhados no dia (entrada → saída, já descontando intervalos). */
export function minutosTrabalhados(registro: RegistroPonto): number | null {
  const e = horaParaMinutos(registro.entrada);
  const s = horaParaMinutos(registro.saida);
  if (e === null || s === null) return null;
  const bruto = s >= e ? s - e : s + 1440 - e; // turno noturno
  return Math.max(0, bruto - totalIntervaloMinutos(registro));
}

interface FolhaPontoTableProps {
  funcionarioId: string;
  dataInicio: string;
  dataFim: string;
}

export default function FolhaPontoTable({ funcionarioId, dataInicio, dataFim }: FolhaPontoTableProps) {
  const [registros, setRegistros] = useState<RegistroPonto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [registroEditado, setRegistroEditado] = useState<Partial<RegistroPonto>>({});
  const [funcionarioNome, setFuncionarioNome] = useState<string>("");
  const [escalaFuncionario, setEscalaFuncionario] = useState<EscalaInfo | null>(null);

  useEffect(() => {
    carregarRegistros();
    carregarNomeFuncionario();
    carregarEscalaFuncionario();
  }, [funcionarioId, dataInicio, dataFim]);

  const carregarNomeFuncionario = async () => {
    const { data } = await supabase
      .from("funcionarios")
      .select("nome_completo")
      .eq("id", funcionarioId)
      .single();
    
    if (data) setFuncionarioNome(data.nome_completo);
  };

  const carregarEscalaFuncionario = async () => {
    const { data } = await supabase
      .from("funcionarios")
      .select(`
        escalas (
          nome,
          entrada,
          saida,
          intervalo_minutos,
          intervalo_pre_assinalado
        )
      `)
      .eq("id", funcionarioId)
      .single();
    
    if (data?.escalas) {
      setEscalaFuncionario(data.escalas as unknown as EscalaInfo);
    }
  };

  const carregarRegistros = async () => {
    try {
      setCarregando(true);
      
      console.log('🚀 Iniciando carregarRegistros...');
      
      // Gerar todas as datas do período
      const datasPerido = gerarDatasPerido(dataInicio, dataFim);
      
      console.log('📊 Total de datas no período:', datasPerido.length);
      
      // Buscar registros existentes incluindo turnos noturnos
      console.log('🔍 Buscando registros no banco...');
      
      const { data: registrosExistentes, error } = await supabase
        .from("registros_ponto")
        .select("*")
        .eq("funcionario_id", funcionarioId)
        .gte("data", new Date(new Date(dataInicio).getTime() - 24*60*60*1000).toISOString().split('T')[0]) // Incluir dia anterior para turnos noturnos
        .lte("data", dataFim)
        .order("data");

      console.log('📦 Resultado da consulta:', { registrosExistentes: registrosExistentes?.length, error });

      if (error) {
        console.error('❌ Erro na consulta:', error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar registros",
          description: error.message
        });
        setCarregando(false);
        return;
      }

      // Criar mapa de registros existentes para evitar duplicatas
      const registrosMap = new Map();
      
      registrosExistentes?.forEach(r => {
        // Adicionar o registro no dia em que foi criado
        registrosMap.set(r.data, r);
        
        // Para turnos noturnos, NÃO adicionar no dia seguinte
        // O dia seguinte deve aparecer como folga se não tiver registro próprio
      });

      // Criar registros para todas as datas do período - INCLUINDO DIAS DE FOLGA
      const todosRegistros: RegistroPonto[] = [];
      
      datasPerido.forEach(data => {
        const registroExistente = registrosMap.get(data);
        
        // Se há registro existente, verificar se tem horários preenchidos
        if (registroExistente && (registroExistente.entrada || registroExistente.saida)) {
          // Registro com horários - usar ele
          todosRegistros.push(registroExistente);
        } else {
          // Não há registro com horários para este dia - criar registro editável para folga
          todosRegistros.push({
            id: `temp-${data}-${funcionarioId}`,
            data,
            entrada: null,
            intervalo_inicio: null,
            intervalo_fim: null,
            saida: null,
            observacoes: null,
            funcionario_id: funcionarioId,
            intervalos_pausas: []
          });
        }
      });

      console.log('✅ Processamento finalizado!', {
        totalDatas: datasPerido.length,
        registrosExistentes: registrosExistentes?.length,
        registrosFinais: todosRegistros.length,
        diasComHorarios: todosRegistros.filter(r => r.entrada || r.saida).length,
        diasDeFolga: todosRegistros.filter(r => !r.entrada && !r.saida).length
      });

      setRegistros(todosRegistros);
      setCarregando(false);
    } catch (error) {
      console.error('💥 Erro inesperado:', error);
      setCarregando(false);
    }
  };

  const gerarDatasPerido = (inicio: string, fim: string): string[] => {
    const datas: string[] = [];
    const dataInicial = new Date(inicio + 'T12:00:00'); // Usar meio-dia para evitar problemas de fuso
    const dataFinal = new Date(fim + 'T12:00:00');

    // Usar milissegundos para garantir precisão na iteração
    const tempoInicial = dataInicial.getTime();
    const tempoFinal = dataFinal.getTime();
    
    for (let tempo = tempoInicial; tempo <= tempoFinal; tempo += 24 * 60 * 60 * 1000) {
      const data = new Date(tempo);
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const dia = String(data.getDate()).padStart(2, '0');
      
      datas.push(`${ano}-${mes}-${dia}`);
    }

    return datas;
  };

  const formatarData = (data: string) => {
    const dataObj = new Date(data + 'T00:00:00');
    
    return dataObj.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
  };

  /** Rótulo detalhado da data: "seg" + "05/08/2026". */
  const detalharData = (data: string) => {
    const d = new Date(data + 'T12:00:00');
    return {
      diaSemana: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      completa: d.toLocaleDateString('pt-BR'),
      fimDeSemana: [0, 6].includes(d.getDay()),
    };
  };

  /** Minutos de atraso em relação à escala (0 quando dentro do horário). */
  const minutosAtraso = (registro: RegistroPonto): number => {
    const prev = horaParaMinutos(escalaFuncionario?.entrada);
    const real = horaParaMinutos(registro.entrada);
    if (prev === null || real === null) return 0;
    return Math.max(0, real - prev);
  };

  const limiteIntervalo = escalaFuncionario?.intervalo_minutos ?? null;

  const formatarHora = (hora: string | null) => {
    if (!hora) return "--:--";
    return hora.slice(0, 5);
  };

  const iniciarEdicao = (registro: RegistroPonto) => {
    setEditandoId(registro.id);
    setRegistroEditado({
      entrada: registro.entrada || "",
      intervalo_inicio: registro.intervalo_inicio || "",
      intervalo_fim: registro.intervalo_fim || "",
      saida: registro.saida || "",
      observacoes: registro.observacoes || ""
    });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setRegistroEditado({});
  };

  const salvarEdicao = async (registro: RegistroPonto) => {
    const dadosParaSalvar = {
      funcionario_id: funcionarioId,
      data: registro.data,
      entrada: registroEditado.entrada || null,
      intervalo_inicio: registroEditado.intervalo_inicio || null,
      intervalo_fim: registroEditado.intervalo_fim || null,
      saida: registroEditado.saida || null,
      observacoes: registroEditado.observacoes || null
    };

    let error;
    
    if (registro.id.startsWith('temp-')) {
      // Inserir novo registro
      const { error: insertError } = await supabase
        .from("registros_ponto")
        .insert(dadosParaSalvar);
      error = insertError;
    } else {
      // Atualizar registro existente
      const { error: updateError } = await supabase
        .from("registros_ponto")
        .update(dadosParaSalvar)
        .eq("id", registro.id);
      error = updateError;
    }

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message
      });
      return;
    }

    toast({
      title: "Registro salvo com sucesso!"
    });

    setEditandoId(null);
    setRegistroEditado({});
    carregarRegistros();
  };

  const excluirRegistro = async (registro: RegistroPonto) => {
    if (registro.id.startsWith('temp-')) {
      toast({
        variant: "destructive",
        title: "Não é possível excluir",
        description: "Este registro ainda não foi salvo"
      });
      return;
    }

    const { error } = await supabase
      .from("registros_ponto")
      .delete()
      .eq("id", registro.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message
      });
      return;
    }

    toast({
      title: "Registro excluído com sucesso!"
    });

    carregarRegistros();
  };

  const preencherHorariosPadrao = async () => {
    if (!escalaFuncionario) {
      toast({
        variant: "destructive",
        title: "Escala não encontrada",
        description: "Não foi possível encontrar a escala do funcionário"
      });
      return;
    }

    try {
      // Usar a nova função que considera a vigência e tipos de escala
      const { data: horariosEscala, error } = await supabase.rpc('preencher_horarios_por_escala', {
        p_funcionario_id: funcionarioId,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim
      });

      if (error) throw error;

      if (!horariosEscala || horariosEscala.length === 0) {
        toast({
          title: "Nenhum horário para preencher",
          description: "Não foi possível gerar horários para este período"
        });
        return;
      }

      // Filtrar apenas os dias que devem ter trabalho
      const diasTrabalho = horariosEscala.filter((h: any) => h.deve_trabalhar);
      
      if (diasTrabalho.length === 0) {
        toast({
          title: "Nenhum dia de trabalho encontrado",
          description: "Baseado na escala e vigência, não há dias de trabalho neste período"
        });
        return;
      }

      // Contar quantos registros serão atualizados
      let registrosAtualizados = 0;

      // Processar cada dia de trabalho
      for (const horario of diasTrabalho) {
        const registro = registros.find(r => r.data === horario.data);
        if (!registro) continue;

        // Verificar se o registro já tem horários completos
        if (registro.entrada && registro.saida) continue;

        const dadosParaSalvar = {
          funcionario_id: funcionarioId,
          data: horario.data,
          entrada: horario.entrada,
          intervalo_inicio: horario.intervalo_inicio,
          intervalo_fim: horario.intervalo_fim,
          saida: horario.saida,
          observacoes: registro.observacoes || "Horários preenchidos automaticamente com base na escala e vigência"
        };

        let error;
        
        if (registro.id.startsWith('temp-')) {
          // Inserir novo registro
          const { error: insertError } = await supabase
            .from("registros_ponto")
            .insert(dadosParaSalvar);
          error = insertError;
        } else {
          // Atualizar registro existente
          const { error: updateError } = await supabase
            .from("registros_ponto")
            .update(dadosParaSalvar)
            .eq("id", registro.id);
          error = updateError;
        }

        if (error) {
          toast({
            variant: "destructive",
            title: "Erro ao preencher horários",
            description: error.message
          });
          return;
        }

        registrosAtualizados++;
      }

      toast({
        title: "Horários preenchidos com sucesso!",
        description: `${registrosAtualizados} registro(s) atualizado(s) baseado na escala e vigência do funcionário`
      });

      carregarRegistros();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao preencher horários",
        description: error.message || "Erro desconhecido"
      });
    }
  };

  if (carregando) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="text-center py-8">Carregando registros...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h3 className="text-xl font-semibold">Registros de Ponto</h3>
          <p className="text-muted-foreground">
            {funcionarioNome} • {formatarData(dataInicio)} a {formatarData(dataFim)}
          </p>
          {escalaFuncionario && (
            <p className="text-xs text-muted-foreground mt-1">
              Escala {escalaFuncionario.nome ?? ""} • Previsto{" "}
              {formatarHora(escalaFuncionario.entrada)} às {formatarHora(escalaFuncionario.saida)}
              {limiteIntervalo != null && ` • Intervalo ${limiteIntervalo} min`}
              {escalaFuncionario.intervalo_pre_assinalado && " (pré-assinalado)"}
            </p>
          )}
        </div>
        
        {escalaFuncionario && (
          <Button
            onClick={preencherHorariosPadrao}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Preencher com Escala
          </Button>
        )}
      </div>

      {/* Resumo do período */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {(() => {
          const comRegistro = registros.filter((r) => r.entrada || r.saida);
          const totalTrab = comRegistro.reduce((a, r) => a + (minutosTrabalhados(r) ?? 0), 0);
          const totalInt = comRegistro.reduce((a, r) => a + totalIntervaloMinutos(r), 0);
          const semSaida = comRegistro.filter((r) => r.entrada && !r.saida).length;
          const atrasos = comRegistro.filter((r) => minutosAtraso(r) > 15).length;
          const cards = [
            { label: "Dias com registro", valor: String(comRegistro.length), icon: LogIn },
            { label: "Horas trabalhadas", valor: formatarMinutos(totalTrab), icon: Clock },
            { label: "Total de intervalos", valor: formatarMinutos(totalInt), icon: Coffee },
            { label: "Sem saída", valor: String(semSaida), icon: LogOut },
            { label: "Atrasos > 15min", valor: String(atrasos), icon: AlertTriangle },
          ];
          return cards.map(({ label, valor, icon: Icon }) => (
            <div key={label} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <p className="text-lg font-semibold mt-1">{valor}</p>
            </div>
          ));
        })()}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Intervalos</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead>Total intervalo</TableHead>
              <TableHead>Horas trabalhadas</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="w-32">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((registro) => (
              <TableRow
                key={registro.data}
                className={detalharData(registro.data).fimDeSemana ? "bg-muted/20" : undefined}
              >
                <TableCell className="font-medium whitespace-nowrap">
                  <span className="capitalize">{detalharData(registro.data).diaSemana}</span>
                  <span className="block text-xs text-muted-foreground">
                    {detalharData(registro.data).completa}
                  </span>
                </TableCell>
                
                {editandoId === registro.id ? (
                  <>
                    <TableCell>
                      <Input
                        type="time"
                        value={registroEditado.entrada || ""}
                        onChange={(e) => setRegistroEditado({...registroEditado, entrada: e.target.value})}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={registroEditado.intervalo_inicio || ""}
                        onChange={(e) => setRegistroEditado({...registroEditado, intervalo_inicio: e.target.value})}
                        className="w-24"
                      />
                      <Input
                        type="time"
                        value={registroEditado.intervalo_fim || ""}
                        onChange={(e) => setRegistroEditado({...registroEditado, intervalo_fim: e.target.value})}
                        className="w-24 mt-1"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={registroEditado.saida || ""}
                        onChange={(e) => setRegistroEditado({...registroEditado, saida: e.target.value})}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-muted-foreground text-xs">Editando</TableCell>
                    <TableCell>
                      <Textarea
                        value={registroEditado.observacoes || ""}
                        onChange={(e) => setRegistroEditado({...registroEditado, observacoes: e.target.value})}
                        className="min-h-8 max-h-20"
                        rows={1}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => salvarEdicao(registro)}
                          className="h-8 w-8 p-0"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelarEdicao}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium">{formatarHora(registro.entrada)}</span>
                      {minutosAtraso(registro) > 0 && (
                        <span className="block text-xs text-amber-600">
                          +{minutosAtraso(registro)} min
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[170px]">
                      {(() => {
                        const pausas = parsePausas(registro.intervalos_pausas);
                        if (pausas.length === 0) {
                          if (!registro.intervalo_inicio && !registro.intervalo_fim) {
                            return escalaFuncionario?.intervalo_pre_assinalado && registro.entrada ? (
                              <span className="text-xs text-muted-foreground">Pré-assinalado</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">--:--</span>
                            );
                          }
                          return (
                            <span className="text-sm">
                              {formatarHora(registro.intervalo_inicio)} → {formatarHora(registro.intervalo_fim)}
                            </span>
                          );
                        }
                        return (
                          <div className="space-y-0.5">
                            {pausas.map((p, i) => {
                              const ini = horaParaMinutos(p.inicio);
                              const fim = horaParaMinutos(p.fim);
                              const dur =
                                ini !== null && fim !== null
                                  ? fim >= ini
                                    ? fim - ini
                                    : fim + 1440 - ini
                                  : null;
                              return (
                                <div key={i} className="text-xs flex items-center gap-1">
                                  <Coffee className="h-3 w-3 text-muted-foreground" />
                                  <span>
                                    {formatarHora(p.inicio)} → {p.fim ? formatarHora(p.fim) : "em andamento"}
                                  </span>
                                  {dur !== null && (
                                    <span className="text-muted-foreground">({dur} min)</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="font-medium">{formatarHora(registro.saida)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {(() => {
                        const tot = totalIntervaloMinutos(registro);
                        if (!registro.entrada) return <span className="text-muted-foreground">-</span>;
                        const excedeu = limiteIntervalo != null && tot > limiteIntervalo;
                        return (
                          <span className={excedeu ? "text-red-600 font-medium" : ""}>
                            {tot} min
                            {excedeu && (
                              <span className="block text-xs">
                                +{tot - (limiteIntervalo ?? 0)} min excedente
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {minutosTrabalhados(registro) !== null
                        ? formatarMinutos(minutosTrabalhados(registro)!)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {!registro.entrada && !registro.saida ? (
                        <Badge variant="outline">Sem registro</Badge>
                      ) : registro.entrada && !registro.saida ? (
                        <Badge variant="destructive">Saída pendente</Badge>
                      ) : minutosAtraso(registro) > 15 ? (
                        <Badge className="bg-amber-500 hover:bg-amber-500">Atraso</Badge>
                      ) : (
                        <Badge variant="secondary">Completo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      {registro.observacoes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => iniciarEdicao(registro)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {!registro.id.startsWith('temp-') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => excluirRegistro(registro)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
