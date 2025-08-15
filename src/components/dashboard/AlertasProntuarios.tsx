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
  const [prontuariosAtrasados, setProntuariosAtrasados] = useState<ProntuarioAtrasado[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProntuariosAtrasados = async () => {
    try {
      setLoading(true);
      
      // Buscar ciclos em andamento de dias anteriores
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
        .lt('data_ciclo', hoje)
        .order('data_ciclo', { ascending: true });

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

      setProntuariosAtrasados(prontuariosComContadores.filter(Boolean) as ProntuarioAtrasado[]);
    } catch (error) {
      console.error('Erro ao carregar prontuários atrasados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProntuariosAtrasados();
    
    // Atualizar a cada 5 minutos
    const interval = setInterval(fetchProntuariosAtrasados, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleAcessarProntuario = () => {
    navigate('/prontuario');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileHeart className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Prontuários em Atraso</CardTitle>
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

  if (prontuariosAtrasados.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileHeart className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Prontuários em Atraso</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Nenhum prontuário em atraso
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <CardTitle className="text-lg text-red-700">
              Prontuários em Atraso ({prontuariosAtrasados.length})
            </CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAcessarProntuario}
            className="border-red-300 hover:bg-red-50"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Acessar Prontuários
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {prontuariosAtrasados.slice(0, 5).map((prontuario) => {
          const diasAtraso = Math.ceil(
            (new Date().getTime() - new Date(prontuario.data_ciclo).getTime()) / (1000 * 60 * 60 * 24)
          );
          const progresso = prontuario.registros_totais > 0 ? 
            Math.round((prontuario.registros_preenchidos / prontuario.registros_totais) * 100) : 0;

          return (
            <div
              key={prontuario.id}
              className="bg-red-50 border border-red-200 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm text-red-900">
                    {prontuario.residente.nome_completo}
                  </h4>
                  <Badge variant="destructive" className="text-xs">
                    {diasAtraso} dia{diasAtraso > 1 ? 's' : ''} atraso
                  </Badge>
                </div>
                <span className="text-xs text-red-700">
                  {format(new Date(prontuario.data_ciclo), "dd/MM", { locale: ptBR })}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-red-700">
                <span>
                  Prontuário: {prontuario.residente.numero_prontuario}
                  {prontuario.residente.quarto && ` • Quarto: ${prontuario.residente.quarto}`}
                </span>
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-red-700">
                  Progresso: {prontuario.registros_preenchidos}/{prontuario.registros_totais}
                </span>
                <div className="flex-1 bg-red-200 rounded-full h-1.5">
                  <div 
                    className="bg-red-600 h-1.5 rounded-full" 
                    style={{ width: `${progresso}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-red-700">{progresso}%</span>
              </div>
            </div>
          );
        })}
        
        {prontuariosAtrasados.length > 5 && (
          <div className="text-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAcessarProntuario}
              className="text-red-700 hover:bg-red-50"
            >
              Ver todos ({prontuariosAtrasados.length - 5} restantes)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}