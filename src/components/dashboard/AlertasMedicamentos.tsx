import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Pill, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MedicamentoEstoqueBaixo {
  medicamento_nome: string;
  quantidade_atual: number;
  quantidade_minima: number;
  dias_restantes: number | null;
  lote: string | null;
  data_validade: string | null;
}

export default function AlertasMedicamentos() {
  const [medicamentos, setMedicamentos] = useState<MedicamentoEstoqueBaixo[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchMedicamentos = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('obter_medicamentos_estoque_baixo');
      
      if (error) throw error;
      
      setMedicamentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar medicamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicamentos();
    
    // Atualizar a cada 30 minutos
    const interval = setInterval(fetchMedicamentos, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleAcessarMedicamentos = () => {
    navigate('/medicamentos');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Medicamentos</CardTitle>
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">
              Medicamentos
            </CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAcessarMedicamentos}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Ver Todos
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {medicamentos.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Nenhum alerta de medicamento
            </p>
          </div>
        ) : (
          medicamentos.slice(0, 5).map((medicamento, index) => {
            const isEstoqueBaixo = medicamento.quantidade_atual <= medicamento.quantidade_minima;
            const isVencendo = medicamento.dias_restantes !== null && medicamento.dias_restantes <= 30;
            const isVencido = medicamento.dias_restantes !== null && medicamento.dias_restantes < 0;

            return (
              <div
                key={index}
                className={`border rounded-lg p-3 ${
                  isVencido ? 'bg-red-50 border-red-200' : 
                  isVencendo || isEstoqueBaixo ? 'bg-yellow-50 border-yellow-200' : 
                  'bg-muted/30 border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">
                      {medicamento.medicamento_nome}
                    </h4>
                    {isVencido && (
                      <Badge variant="destructive" className="text-xs">
                        Vencido
                      </Badge>
                    )}
                    {isVencendo && !isVencido && (
                      <Badge variant="secondary" className="text-xs bg-yellow-200 text-yellow-800">
                        Vencendo
                      </Badge>
                    )}
                    {isEstoqueBaixo && (
                      <Badge variant="secondary" className="text-xs bg-orange-200 text-orange-800">
                        Estoque Baixo
                      </Badge>
                    )}
                  </div>
                  <AlertTriangle className={`w-4 h-4 ${
                    isVencido ? 'text-red-600' : 
                    isVencendo || isEstoqueBaixo ? 'text-yellow-600' : 
                    'text-muted-foreground'
                  }`} />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Estoque atual:</span>
                    <span className="font-medium">{medicamento.quantidade_atual}</span>
                  </div>
                  
                  {medicamento.lote && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Lote:</span>
                      <span>{medicamento.lote}</span>
                    </div>
                  )}
                  
                  {medicamento.dias_restantes !== null && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {medicamento.dias_restantes < 0 ? 'Vencido há:' : 'Vence em:'}
                      </span>
                      <span className={
                        medicamento.dias_restantes < 0 ? 'text-red-600 font-medium' :
                        medicamento.dias_restantes <= 30 ? 'text-yellow-600 font-medium' :
                        ''
                      }>
                        {Math.abs(medicamento.dias_restantes)} dia{Math.abs(medicamento.dias_restantes) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {medicamentos.length > 5 && (
          <div className="text-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAcessarMedicamentos}
              className="text-muted-foreground hover:bg-muted"
            >
              Ver todos ({medicamentos.length - 5} restantes)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}