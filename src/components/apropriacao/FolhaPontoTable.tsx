
import React, { useState, useEffect } from "react";
import { Edit2, Save, X, Plus, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface RegistroPonto {
  id: string;
  data: string;
  entrada: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  saida: string | null;
  observacoes: string | null;
  funcionario_id: string;
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
  const [escalaFuncionario, setEscalaFuncionario] = useState<{entrada: string, saida: string} | null>(null);

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
          entrada,
          saida
        )
      `)
      .eq("id", funcionarioId)
      .single();
    
    if (data?.escalas) {
      setEscalaFuncionario({
        entrada: data.escalas.entrada,
        saida: data.escalas.saida
      });
    }
  };

  const carregarRegistros = async () => {
    setCarregando(true);
    
    // Gerar todas as datas do período
    const datasPerido = gerarDatasPerido(dataInicio, dataFim);
    
    // Buscar registros existentes incluindo turnos noturnos
    const { data: registrosExistentes, error } = await supabase
      .from("registros_ponto")
      .select("*")
      .eq("funcionario_id", funcionarioId)
      .gte("data", new Date(new Date(dataInicio).getTime() - 24*60*60*1000).toISOString().split('T')[0]) // Incluir dia anterior para turnos noturnos
      .lte("data", dataFim)
      .order("data");

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar registros",
        description: error.message
      });
      setCarregando(false);
      return;
    }

    // Criar registros para todas as datas do período, considerando turnos noturnos
    const todosRegistros: RegistroPonto[] = datasPerido.map(data => {
      // Buscar registro para esta data ou turno noturno do dia anterior
      const registroExistente = registrosExistentes?.find(r => {
        // Registro normal do dia
        if (r.data === data) return true;
        
        // Turno noturno: registro do dia anterior que termina no dia atual
        const dataAnterior = new Date(new Date(data).getTime() - 24*60*60*1000).toISOString().split('T')[0];
        if (r.data === dataAnterior && r.entrada && r.saida && r.saida < r.entrada) {
          return true;
        }
        
        return false;
      });
      
      return registroExistente || {
        id: `temp-${data}`,
        data,
        entrada: null,
        intervalo_inicio: null,
        intervalo_fim: null,
        saida: null,
        observacoes: null,
        funcionario_id: funcionarioId
      };
    });

    setRegistros(todosRegistros);
    setCarregando(false);
  };

  const gerarDatasPerido = (inicio: string, fim: string): string[] => {
    const datas: string[] = [];
    const dataAtual = new Date(inicio);
    const dataFinal = new Date(fim);

    while (dataAtual <= dataFinal) {
      datas.push(dataAtual.toISOString().split('T')[0]);
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    return datas;
  };

  const formatarData = (data: string) => {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
  };

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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Início Intervalo</TableHead>
              <TableHead>Fim Intervalo</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="w-32">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((registro) => (
              <TableRow key={registro.id}>
                <TableCell className="font-medium">
                  {formatarData(registro.data)}
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
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={registroEditado.intervalo_fim || ""}
                        onChange={(e) => setRegistroEditado({...registroEditado, intervalo_fim: e.target.value})}
                        className="w-24"
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
                    <TableCell>{formatarHora(registro.entrada)}</TableCell>
                    <TableCell>{formatarHora(registro.intervalo_inicio)}</TableCell>
                    <TableCell>{formatarHora(registro.intervalo_fim)}</TableCell>
                    <TableCell>{formatarHora(registro.saida)}</TableCell>
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
