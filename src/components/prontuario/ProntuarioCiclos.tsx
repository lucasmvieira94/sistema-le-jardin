import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Clock, CheckCircle, Lock, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ProntuarioRegistrosForm from "./ProntuarioRegistrosForm";

interface Ciclo {
  id: string;
  data_ciclo: string;
  status: string;
  data_encerramento?: string;
  residente: {
    id: string;
    nome_completo: string;
    numero_prontuario: string;
    quarto?: string;
  };
  registros_count?: number;
  registros_preenchidos?: number;
}

interface ProntuarioCiclosProps {
  funcionarioId: string;
}

export default function ProntuarioCiclos({ funcionarioId }: ProntuarioCiclosProps) {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [selectedCiclo, setSelectedCiclo] = useState<Ciclo | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCiclos = async () => {
    try {
      setLoading(true);
      
      // Buscar ciclos dos últimos 7 dias
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 7);
      
      const { data, error } = await supabase
        .from('prontuario_ciclos')
        .select(`
          *,
          residente:residentes!inner (
            id,
            nome_completo,
            numero_prontuario,
            quarto
          )
        `)
        .gte('data_ciclo', format(dataLimite, 'yyyy-MM-dd'))
        .order('data_ciclo', { ascending: false });

      if (error) throw error;

      // Para cada ciclo, contar registros totais e preenchidos
      const ciclosComContadores = await Promise.all(
        (data || []).map(async (ciclo) => {
          const { data: registros, error: registrosError } = await supabase
            .from('prontuario_registros')
            .select('id, funcionario_id, descricao, tipo_registro')
            .eq('ciclo_id', ciclo.id);

          if (registrosError) {
            console.error('Erro ao buscar registros:', registrosError);
            return {
              ...ciclo,
              registros_count: 0,
              registros_preenchidos: 0
            };
          }

          const total = registros?.length || 0;
          let preenchidos = 0;
          
          // Para prontuários encerrados, verificar se existe registro completo
          if (ciclo.status === 'encerrado') {
            preenchidos = registros?.filter(r => 
              r.tipo_registro === 'prontuario_completo' && 
              r.funcionario_id && 
              r.descricao && 
              r.descricao.trim() !== ''
            ).length || 0;
          } else {
            // Para outros status, contar registros preenchidos normalmente
            preenchidos = registros?.filter(r => 
              r.funcionario_id && r.descricao && r.descricao.trim() !== ''
            ).length || 0;
          }

          return {
            ...ciclo,
            registros_count: total,
            registros_preenchidos: preenchidos
          };
        })
      );

      setCiclos(ciclosComContadores);
    } catch (error) {
      console.error('Erro ao carregar ciclos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar prontuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCiclos();
  }, []);

  const handleEncerrarCiclo = async (cicloId: string) => {
    try {
      const { error } = await supabase.rpc('encerrar_ciclo_prontuario', {
        p_ciclo_id: cicloId,
        p_funcionario_id: funcionarioId
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Ciclo encerrado com sucesso!",
      });

      fetchCiclos();
      setSelectedCiclo(null);
    } catch (error) {
      console.error('Erro ao encerrar ciclo:', error);
      toast({
        title: "Erro",
        description: "Erro ao encerrar ciclo",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string, dataCiclo: string, isOverdue: boolean) => {
    if (isOverdue && status === 'em_andamento') {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    
    switch (status) {
      case 'em_andamento':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completo':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'encerrado':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string, isOverdue: boolean) => {
    if (isOverdue && status === 'em_andamento') {
      return <AlertCircle className="w-4 h-4" />;
    }
    
    switch (status) {
      case 'em_andamento':
        return <Clock className="w-4 h-4" />;
      case 'completo':
        return <CheckCircle className="w-4 h-4" />;
      case 'encerrado':
        return <Lock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'em_andamento':
        return 'EM ANDAMENTO';
      case 'completo':
        return 'COMPLETO';
      case 'encerrado':
        return 'ENCERRADO';
      default:
        return status.toUpperCase();
    }
  };

  if (selectedCiclo) {
    return (
      <ProntuarioRegistrosForm
        ciclo={selectedCiclo}
        funcionarioId={funcionarioId}
        onBack={() => setSelectedCiclo(null)}
        onEncerrar={() => handleEncerrarCiclo(selectedCiclo.id)}
        onUpdate={fetchCiclos}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Carregando prontuários...</p>
        </div>
      </div>
    );
  }

  // Separar ciclos em atraso (em andamento de dias anteriores) e atuais
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const ciclosAtrasados = ciclos.filter(c => 
    c.status === 'em_andamento' && c.data_ciclo < hoje
  );
  const ciclosAtuais = ciclos.filter(c => 
    !(c.status === 'em_andamento' && c.data_ciclo < hoje)
  );

  const ciclosOrdenados = [...ciclosAtrasados, ...ciclosAtuais];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Prontuários por Ciclo</h2>
          <p className="text-muted-foreground">
            Geração automática diária às 7h00 - Últimos 7 dias
          </p>
        </div>
      </div>

      {ciclosAtrasados.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-600">
              Prontuários em Atraso ({ciclosAtrasados.length})
            </h3>
          </div>
          
          <div className="space-y-3">
            {ciclosAtrasados.map((ciclo) => {
              const isOverdue = ciclo.status === 'em_andamento' && ciclo.data_ciclo < hoje;
              const progresso = ciclo.registros_count ? 
                Math.round((ciclo.registros_preenchidos! / ciclo.registros_count) * 100) : 0;

              return (
                <Card key={ciclo.id} className="border-red-200 bg-red-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">
                          {ciclo.residente.nome_completo}
                        </CardTitle>
                        <Badge className={getStatusColor(ciclo.status, ciclo.data_ciclo, isOverdue)}>
                          {getStatusIcon(ciclo.status, isOverdue)}
                          <span className="ml-1">{getStatusLabel(ciclo.status)}</span>
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(ciclo.data_ciclo), "dd/MM/yyyy")}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Prontuário: {ciclo.residente.numero_prontuario}
                          {ciclo.residente.quarto && ` • Quarto: ${ciclo.residente.quarto}`}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span>Progresso: {ciclo.registros_preenchidos}/{ciclo.registros_count}</span>
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-red-600 h-2 rounded-full" 
                              style={{ width: `${progresso}%` }}
                            ></div>
                          </div>
                          <span className="font-medium">{progresso}%</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCiclo(ciclo)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Visualizar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Prontuários Atuais</h3>
        
        {ciclosAtuais.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  Nenhum prontuário encontrado
                </h3>
                <p className="text-sm text-muted-foreground">
                  Os prontuários são gerados automaticamente às 7h00
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {ciclosAtuais.map((ciclo) => {
              const isOverdue = ciclo.status === 'em_andamento' && ciclo.data_ciclo < hoje;
              const progresso = ciclo.registros_count ? 
                Math.round((ciclo.registros_preenchidos! / ciclo.registros_count) * 100) : 0;

              return (
                <Card key={ciclo.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">
                          {ciclo.residente.nome_completo}
                        </CardTitle>
                        <Badge className={getStatusColor(ciclo.status, ciclo.data_ciclo, isOverdue)}>
                          {getStatusIcon(ciclo.status, isOverdue)}
                          <span className="ml-1">{getStatusLabel(ciclo.status)}</span>
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(ciclo.data_ciclo), "dd/MM/yyyy")}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Prontuário: {ciclo.residente.numero_prontuario}
                          {ciclo.residente.quarto && ` • Quarto: ${ciclo.residente.quarto}`}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span>Progresso: {ciclo.registros_preenchidos}/{ciclo.registros_count}</span>
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                progresso === 100 ? 'bg-green-600' : 'bg-primary'
                              }`}
                              style={{ width: `${progresso}%` }}
                            ></div>
                          </div>
                          <span className="font-medium">{progresso}%</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCiclo(ciclo)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          {ciclo.status === 'encerrado' ? 'Visualizar' : 'Preencher'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}