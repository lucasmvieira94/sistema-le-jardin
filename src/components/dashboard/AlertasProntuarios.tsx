import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileHeart, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface ProntuarioAtrasado {
  id: string;
  data_ciclo: string;
  residente: {
    nome_completo: string;
    numero_prontuario: string;
    quarto?: string;
  };
  registros_preenchidos: number;
  registros_totais: number;
}

export default function AlertasProntuarios() {
  const [prontuarios, setProntuarios] = useState<ProntuarioAtrasado[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProntuarios = async () => {
    try {
      setLoading(true);
      
      // Buscar ciclos em andamento de hoje e dias anteriores
      const hoje = format(new Date(), 'yyyy-MM-dd');
      
      const { data: ciclos, error } = await supabase
        .from('prontuario_ciclos')
        .select(`
          *,
          residente:residentes!inner (
            nome_completo,
            numero_prontuario,
            quarto
          )
        `)
        .eq('status', 'em_andamento')
        .order('data_ciclo', { ascending: false });

      if (error) throw error;

      // Para cada ciclo, contar registros
      const prontuariosComContadores = await Promise.all(
        (ciclos || []).map(async (ciclo) => {
          const { data: registros, error: registrosError } = await supabase
            .from('prontuario_registros')
            .select('funcionario_id, descricao')
            .eq('ciclo_id', ciclo.id);

          if (registrosError) {
            console.error('Erro ao buscar registros:', registrosError);
            return null;
          }

          const totais = registros?.length || 0;
          const preenchidos = registros?.filter(r => 
            r.funcionario_id && r.descricao && r.descricao.trim() !== ''
          ).length || 0;

          return {
            id: ciclo.id,
            data_ciclo: ciclo.data_ciclo,
            residente: ciclo.residente,
            registros_preenchidos: preenchidos,
            registros_totais: totais
          };
        })
      );

      setProntuarios(prontuariosComContadores.filter(Boolean) as ProntuarioAtrasado[]);
    } catch (error) {
      console.error('Erro ao carregar prontuários:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProntuarios();
    
    // Atualizar a cada 5 minutos
    const interval = setInterval(fetchProntuarios, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleVisualizarProntuario = (residenteId: string) => {
    navigate(`/prontuario?residente=${residenteId}`);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileHeart className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Prontuários em Andamento</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (prontuarios.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileHeart className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Prontuários em Andamento</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Nenhum prontuário em andamento
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hoje = format(new Date(), 'yyyy-MM-dd');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileHeart className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">
            Prontuários em Andamento ({prontuarios.length})
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {prontuarios.slice(0, 6).map((prontuario) => {
          const isAtrasado = prontuario.data_ciclo < hoje;
          const progresso = prontuario.registros_totais > 0 ? 
            Math.round((prontuario.registros_preenchidos / prontuario.registros_totais) * 100) : 0;

          return (
            <div
              key={prontuario.id}
              className={`border rounded-lg p-3 ${
                isAtrasado ? 'bg-red-50 border-red-200' : 'bg-muted/30 border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">
                    {prontuario.residente.nome_completo}
                  </h4>
                  {isAtrasado && (
                    <Badge variant="destructive" className="text-xs">
                      Atrasado
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVisualizarProntuario(prontuario.residente.nome_completo)}
                  className="h-7 px-2 text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Ver
                </Button>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>
                  {format(new Date(prontuario.data_ciclo), "dd/MM", { locale: ptBR })}
                </span>
                <span>•</span>
                <span>
                  Quarto: {prontuario.residente.quarto || 'N/A'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {prontuario.registros_preenchidos}/{prontuario.registros_totais}
                </span>
                <div className="flex-1 bg-muted rounded-full h-1.5">
                  <div 
                    className="bg-primary h-1.5 rounded-full" 
                    style={{ width: `${progresso}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium">{progresso}%</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}