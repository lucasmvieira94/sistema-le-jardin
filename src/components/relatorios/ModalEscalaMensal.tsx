import React, { useState } from "react";
import { Calendar, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Funcionario {
  id: string;
  nome_completo: string;
}

interface ModalEscalaMensalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionarios: Funcionario[];
}

interface EscalaData {
  funcionario_id: string;
  funcionario_nome: string;
  jornada_trabalho: string;
  horario_entrada: string;
  dias: { [key: number]: boolean };
}

interface ConfiguracaoEmpresa {
  nome_empresa: string;
}

const cores_jornadas_horarios: { [key: string]: string } = {
  // 12x36 - Diferenciação por horário
  '12x36_07:00': '#f59e0b', // Laranja - 7h
  '12x36_08:00': '#eab308', // Amarelo - 8h  
  '12x36_19:00': '#dc2626', // Vermelho - 19h
  '12x36_20:00': '#b91c1c', // Vermelho escuro - 20h
  
  // 24x48
  '24x48_07:00': '#ef4444', // Vermelho
  '24x48_08:00': '#dc2626', // Vermelho escuro
  
  // Outras jornadas mantêm cor padrão
  '44h_8h_segsex': '#3b82f6', // Azul
  '44h_8h_segsex_4h_sab': '#10b981', // Verde
  '6x1': '#8b5cf6', // Roxo
  '5x2': '#06b6d4', // Ciano
  '4x2': '#f97316', // Laranja
};

export default function ModalEscalaMensal({ open, onOpenChange, funcionarios }: ModalEscalaMensalProps) {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [escalaData, setEscalaData] = useState<EscalaData[]>([]);
  const [configuracaoEmpresa, setConfiguracaoEmpresa] = useState<ConfiguracaoEmpresa | null>(null);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month, 0).getDate();
  };

  const buscarEscalaMensal = async () => {
    try {
      setLoading(true);

      // Buscar configurações da empresa
      const { data: configEmpresa } = await supabase
        .from("configuracoes_empresa")
        .select("nome_empresa")
        .limit(1)
        .single();

      if (configEmpresa) {
        setConfiguracaoEmpresa(configEmpresa);
      }

      const dataInicio = new Date(selectedYear, selectedMonth - 1, 1);
      const dataFim = new Date(selectedYear, selectedMonth - 1, getDaysInMonth(selectedMonth, selectedYear));

      const escalaPromises = funcionarios.map(async (funcionario) => {
        // Buscar dados do funcionário com escala
        const { data: funcionarioData } = await supabase
          .from("funcionarios")
          .select(`
            id,
            nome_completo,
            escalas!inner(jornada_trabalho, entrada)
          `)
          .eq("id", funcionario.id)
          .single();

        if (!funcionarioData) return null;

        // Buscar escala usando a função do banco
        const { data: horarios } = await supabase.rpc('preencher_horarios_por_escala', {
          p_funcionario_id: funcionario.id,
          p_data_inicio: dataInicio.toISOString().split('T')[0],
          p_data_fim: dataFim.toISOString().split('T')[0]
        });

        const dias: { [key: number]: boolean } = {};
        if (horarios) {
          horarios.forEach((horario: any) => {
            const dia = new Date(horario.data).getDate();
            dias[dia] = horario.deve_trabalhar;
          });
        }

        return {
          funcionario_id: funcionario.id,
          funcionario_nome: funcionario.nome_completo,
          jornada_trabalho: funcionarioData.escalas.jornada_trabalho,
          horario_entrada: funcionarioData.escalas.entrada,
          dias
        };
      });

      const resultados = await Promise.all(escalaPromises);
      const escalasFiltradas = resultados.filter(Boolean) as EscalaData[];
      
      setEscalaData(escalasFiltradas);
      
    } catch (error) {
      console.error('Erro ao buscar escala mensal:', error);
      toast.error("Erro ao gerar escala mensal");
    } finally {
      setLoading(false);
    }
  };

  const exportarPDF = () => {
    window.print();
  };

  const getCorEscala = (jornada: string, horario: string) => {
    const chave = `${jornada}_${horario}`;
    return cores_jornadas_horarios[chave] || cores_jornadas_horarios[jornada] || '#6b7280';
  };

  const jornadasUnicas = Array.from(new Set(escalaData.map(e => `${e.jornada_trabalho} - ${e.horario_entrada}`)));
  const diasDoMes = getDaysInMonth(selectedMonth, selectedYear);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Escala Mensal - Todos os Funcionários
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Mês</label>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((month, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Ano</label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={buscarEscalaMensal} disabled={loading}>
              {loading ? "Carregando..." : "Gerar Escala"}
            </Button>
          </div>

          {escalaData.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">
                    {configuracaoEmpresa?.nome_empresa || "Empresa"}
                  </h3>
                  <p className="text-muted-foreground">
                    Escala de {monthNames[selectedMonth - 1]} de {selectedYear}
                  </p>
                </div>
                <Button onClick={exportarPDF} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>

              {/* Grid da Escala */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border p-2 text-left min-w-[200px]">Funcionário</th>
                        {Array.from({ length: diasDoMes }, (_, i) => i + 1).map(dia => (
                          <th key={dia} className="border p-2 text-center w-8">
                            {dia}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {escalaData.map((funcionario) => (
                        <tr key={funcionario.funcionario_id}>
                          <td className="border p-2 font-medium">
                            {funcionario.funcionario_nome}
                          </td>
                          {Array.from({ length: diasDoMes }, (_, i) => i + 1).map(dia => {
                            const trabalhaNoDia = funcionario.dias[dia];
                            const cor = getCorEscala(funcionario.jornada_trabalho, funcionario.horario_entrada);
                            
                            return (
                              <td
                                key={dia}
                                className="border p-1 text-center"
                                style={{
                                  backgroundColor: trabalhaNoDia ? cor : 'transparent',
                                  opacity: trabalhaNoDia ? 0.8 : 1
                                }}
                              >
                                {trabalhaNoDia && (
                                  <div className="w-6 h-6 rounded mx-auto" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Legenda */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3">Legenda das Escalas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {escalaData.map(escala => {
                    const chaveUnica = `${escala.jornada_trabalho}_${escala.horario_entrada}`;
                    return escalaData.findIndex(e => `${e.jornada_trabalho}_${e.horario_entrada}` === chaveUnica) === 
                           escalaData.indexOf(escala) ? (
                      <div key={chaveUnica} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: getCorEscala(escala.jornada_trabalho, escala.horario_entrada) }}
                        />
                        <span className="text-sm">{escala.jornada_trabalho} - {escala.horario_entrada}</span>
                      </div>
                    ) : null;
                  }).filter(Boolean)}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}