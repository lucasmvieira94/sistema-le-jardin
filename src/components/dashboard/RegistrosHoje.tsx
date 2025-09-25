import { useState, useEffect } from "react";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RegistroHoje {
  funcionario_nome: string;
  entrada: string | null;
  saida: string | null;
  status: 'completo' | 'em_andamento' | 'pendente' | 'falta';
}

// Função para verificar se o funcionário está de folga baseado na escala
function isFuncionarioEmFolga(jornadaTrabalho: string, dataInicioVigencia: string, dataHoje: Date): boolean {
  const inicioVigencia = new Date(dataInicioVigencia);
  const diasDecorridos = differenceInDays(dataHoje, inicioVigencia);
  const diaSemana = getDay(dataHoje); // 0 = domingo, 1 = segunda, etc.

  switch (jornadaTrabalho) {
    case "12x36":
      // 12x36: trabalha um dia, folga um dia
      return diasDecorridos % 2 === 1;
    
    case "24x48":
      // 24x48: trabalha um dia, folga dois dias
      return diasDecorridos % 3 !== 0;
    
    case "6x1":
      // 6x1: trabalha 6 dias, folga 1 dia por semana
      return diasDecorridos % 7 === 6;
    
    case "5x2":
    case "40h_8h_segsex":
      // 5x2 ou 40h: Segunda a sexta (folga sábado e domingo)
      return diaSemana === 0 || diaSemana === 6; // domingo ou sábado
    
    case "44h_8h_segsex_4h_sab":
      // 44h: Segunda a sexta + sábado meio período (folga só domingo)
      return diaSemana === 0; // só domingo
    
    case "36h_6h_seg_sab":
      // 36h: Segunda a sábado (folga só domingo)
      return diaSemana === 0; // só domingo
    
    default:
      return false;
  }
}

export default function RegistrosHoje() {
  const [registros, setRegistros] = useState<RegistroHoje[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarRegistrosHoje = async () => {
      try {
        const hoje = format(new Date(), 'yyyy-MM-dd');
        
        // Buscar funcionários ativos com suas escalas
        const { data: funcionarios } = await supabase
          .from('funcionarios')
          .select(`
            id, 
            nome_completo, 
            data_inicio_vigencia,
            escalas!inner(jornada_trabalho)
          `)
          .eq('ativo', true);

        if (!funcionarios) return;

        // Buscar registros de hoje
        const { data: registrosPonto } = await supabase
          .from('registros_ponto')
          .select('funcionario_id, entrada, saida')
          .eq('data', hoje);

        const registrosProcessados = funcionarios
          .filter(func => {
            // Filtrar apenas funcionários que deveriam trabalhar hoje
            const jornadaTrabalho = func.escalas?.jornada_trabalho;
            const dataInicioVigencia = func.data_inicio_vigencia;
            const estaEmFolga = jornadaTrabalho && dataInicioVigencia 
              ? isFuncionarioEmFolga(jornadaTrabalho, dataInicioVigencia, new Date())
              : false;
            
            // Só incluir se NÃO está de folga
            return !estaEmFolga;
          })
          .map(func => {
            const registro = registrosPonto?.find(r => r.funcionario_id === func.id);
            
            let status: 'completo' | 'em_andamento' | 'pendente' | 'falta' = 'pendente';
            
            if (registro) {
              if (registro.entrada && registro.saida) {
                status = 'completo';
              } else if (registro.entrada) {
                status = 'em_andamento';
              }
            } else {
              status = 'falta';
            }

            return {
              funcionario_nome: func.nome_completo,
              entrada: registro?.entrada || null,
              saida: registro?.saida || null,
              status
            };
          });

        setRegistros(registrosProcessados);
      } catch (error) {
        console.error('Erro ao carregar registros:', error);
      } finally {
        setLoading(false);
      }
    };

    carregarRegistrosHoje();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completo':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'em_andamento':
        return <Clock className="h-4 w-4 text-accent-foreground" />;
      case 'falta':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completo':
        return <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">Completo</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">Em andamento</Badge>;
      case 'falta':
        return <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50">Falta</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Registros de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Funcionários na Escala de Hoje
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="space-y-3 max-h-80 sm:max-h-96 overflow-y-auto">
          {registros.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <Clock className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm sm:text-base text-muted-foreground">
                Nenhum funcionário na escala de hoje.
              </p>
            </div>
          ) : (
            registros.map((registro, index) => (
              <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-card border rounded-lg hover:shadow-sm transition-all gap-2 sm:gap-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getStatusIcon(registro.status)}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm sm:text-base truncate">{registro.funcionario_nome}</p>
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        Entrada: {registro.entrada || '--:--'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        Saída: {registro.saida || '--:--'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {getStatusBadge(registro.status)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}