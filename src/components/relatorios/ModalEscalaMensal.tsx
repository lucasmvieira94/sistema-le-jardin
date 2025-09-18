import React, { useState } from "react";
import { Calendar, Download, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

// Cores quentes para escalas até 11:59 AM
const coresQuentes = [
  '#dc2626', // Vermelho
  '#ef4444', // Vermelho claro
  '#f59e0b', // Laranja
  '#f97316', // Laranja escuro
  '#eab308', // Amarelo
  '#d97706', // Âmbar
  '#b91c1c', // Vermelho escuro
  '#ea580c', // Laranja queimado
  '#fbbf24', // Amarelo dourado
  '#f59e0b', // Laranja vibrante
  '#fb923c', // Laranja salmão
  '#ec4899', // Rosa quente
  '#e11d48', // Rosa vermelho
  '#be123c', // Rosa escuro
  '#a16207', // Amarelo escuro
  '#92400e', // Bronze
  '#78350f', // Marrom
  '#451a03', // Marrom escuro
];

// Cores frias para escalas após 12:00 PM
const coresFrias = [
  '#3b82f6', // Azul
  '#1d4ed8', // Azul escuro
  '#10b981', // Verde
  '#059669', // Verde escuro
  '#8b5cf6', // Roxo
  '#7c3aed', // Roxo escuro
  '#06b6d4', // Ciano
  '#0891b2', // Ciano escuro
  '#14b8a6', // Turquesa
  '#0d9488', // Verde azulado
  '#065f46', // Verde floresta
  '#047857', // Verde esmeralda
  '#4338ca', // Índigo
  '#3730a3', // Índigo escuro
  '#1e40af', // Azul royal
  '#1e3a8a', // Azul marinho
  '#0369a1', // Azul céu
  '#0c4a6e', // Azul petróleo
  '#134e4a', // Verde azul escuro
  '#064e3b', // Verde escuro profundo
];

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
    // month é 1-indexed (1-12), mas Date() espera 0-indexed (0-11)
    // new Date(year, month, 0) retorna o último dia do mês anterior
    // Como estamos passando month (que é 1-12), isso nos dá o último dia do mês atual
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
    try {
      // Criar documento PDF em modo paisagem
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Configurar título
      const nomeEmpresa = configuracaoEmpresa?.nome_empresa || "Empresa";
      const titulo = `${nomeEmpresa} - Escala de ${monthNames[selectedMonth - 1]} ${selectedYear}`;
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(titulo, 20, 20);
      
      // Preparar dados da tabela
      const diasDoMes = getDaysInMonth(selectedMonth, selectedYear);
      const columns = ['Funcionário'];
      
      // Adicionar colunas dos dias
      for (let dia = 1; dia <= diasDoMes; dia++) {
        columns.push(dia.toString());
      }
      
      // Preparar linhas da tabela
      const rows = escalaData.map(funcionario => {
        const row = [funcionario.funcionario_nome];
        
        for (let dia = 1; dia <= diasDoMes; dia++) {
          const trabalhaNoDia = funcionario.dias[dia];
          const escalaMarcacao = trabalhaNoDia ? 
            `${funcionario.jornada_trabalho.replace('_', ' ').replace('segsex', 'seg-sex')} ${funcionario.horario_entrada.substring(0, 5)}` : 
            '';
          row.push(escalaMarcacao);
        }
        
        return row;
      });
      
      // Gerar tabela no PDF
      (doc as any).autoTable({
        head: [columns],
        body: rows,
        startY: 30,
        styles: {
          fontSize: 6,
          cellPadding: 1,
          halign: 'center',
          valign: 'middle'
        },
        headStyles: {
          fillColor: [51, 51, 51],
          textColor: [255, 255, 255],
          fontSize: 7,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { // Coluna do funcionário
            cellWidth: 35,
            halign: 'left',
            fontSize: 7
          }
        },
        theme: 'grid',
        tableWidth: 'auto',
        margin: { left: 10, right: 10 }
      });
      
      // Adicionar legenda
      let yPosition = (doc as any).lastAutoTable.finalY + 15;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Legenda das Escalas:', 20, yPosition);
      
      yPosition += 8;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      
      // Agrupar escalas únicas para a legenda
      const escalasUnicas = new Set();
      escalaData.forEach(escala => {
        const chave = `${escala.jornada_trabalho} - ${escala.horario_entrada.substring(0, 5)}`;
        escalasUnicas.add(chave);
      });
      
      Array.from(escalasUnicas).forEach((escala, index) => {
        if (yPosition > 190) { // Se passar da página, quebrar
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`• ${escala}`, 20, yPosition);
        yPosition += 5;
      });
      
      // Salvar o PDF
      doc.save(`Escala_${monthNames[selectedMonth - 1]}_${selectedYear}.pdf`);
      toast.success("PDF gerado com sucesso!");
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const getCorEscala = (jornada: string, horario: string) => {
    // Normalizar horário para formato HH:MM (remover segundos se houver)
    const horarioFormatado = horario.substring(0, 5);
    
    // Extrair horas do horário
    const [horasStr] = horarioFormatado.split(':');
    const horas = parseInt(horasStr, 10);
    
    // Determinar se é manhã (até 11:59) ou tarde/noite (12:00 em diante)
    const ehManha = horas < 12;
    
    // Criar um hash simples baseado na combinação jornada + horário para consistência
    const chave = `${jornada}_${horarioFormatado}`;
    let hash = 0;
    for (let i = 0; i < chave.length; i++) {
      const char = chave.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Converter para 32bit integer
    }
    
    // Selecionar cor baseada no período
    if (ehManha) {
      const indice = Math.abs(hash) % coresQuentes.length;
      return coresQuentes[indice];
    } else {
      const indice = Math.abs(hash) % coresFrias.length;
      return coresFrias[indice];
    }
  };

  const jornadasUnicas = Array.from(new Set(escalaData.map(e => `${e.jornada_trabalho} - ${e.horario_entrada}`)));
  const diasDoMes = getDaysInMonth(selectedMonth, selectedYear);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto print:max-w-none print:max-h-none print:overflow-visible">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: landscape;
                margin: 10mm;
              }
              .print\\:hidden {
                display: none !important;
              }
              table {
                page-break-inside: auto;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              thead {
                display: table-header-group;
              }
              .text-sm {
                font-size: 8px !important;
              }
            }
          `
        }} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {configuracaoEmpresa?.nome_empresa ? 
              `${configuracaoEmpresa.nome_empresa} - Escala Mensal` : 
              "Escala Mensal - Todos os Funcionários"
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4 items-end print:hidden">
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
              <div className="flex justify-between items-center print:block">
                <div>
                  <h3 className="text-lg font-semibold">
                    {configuracaoEmpresa?.nome_empresa || "Empresa"}
                  </h3>
                  <p className="text-muted-foreground">
                    Escala de {monthNames[selectedMonth - 1]} de {selectedYear}
                  </p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <Button onClick={exportarPDF} variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar PDF
                  </Button>
                  <Button onClick={() => window.print()} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
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
                    const chaveUnica = `${escala.jornada_trabalho}_${escala.horario_entrada.substring(0, 5)}`;
                    return escalaData.findIndex(e => `${e.jornada_trabalho}_${e.horario_entrada.substring(0, 5)}` === chaveUnica) === 
                           escalaData.indexOf(escala) ? (
                      <div key={chaveUnica} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: getCorEscala(escala.jornada_trabalho, escala.horario_entrada) }}
                        />
                        <span className="text-sm">{escala.jornada_trabalho} - {escala.horario_entrada.substring(0, 5)}</span>
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