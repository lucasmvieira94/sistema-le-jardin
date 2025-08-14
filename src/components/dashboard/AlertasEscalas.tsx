import { useState, useEffect } from "react";
import { AlertTriangle, Calendar, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Alerta {
  tipo: 'escala' | 'funcionario' | 'afastamento';
  titulo: string;
  descricao: string;
  urgencia: 'alta' | 'media' | 'baixa';
}

export default function AlertasEscalas() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verificarAlertas = async () => {
      try {
        const alertasEncontrados: Alerta[] = [];
        
        // Verificar funcionários sem escala
        const { data: funcionariosSemEscala } = await supabase
          .from('funcionarios')
          .select('nome_completo, escala_id')
          .eq('ativo', true)
          .is('escala_id', null);

        if (funcionariosSemEscala?.length) {
          alertasEncontrados.push({
            tipo: 'funcionario',
            titulo: `${funcionariosSemEscala.length} funcionário(s) sem escala`,
            descricao: 'Funcionários ativos que não possuem escala definida',
            urgencia: 'alta'
          });
        }

        // Verificar escalas sem funcionários
        const { data: escalas } = await supabase
          .from('escalas')
          .select('id, nome');

        const { data: funcionarios } = await supabase
          .from('funcionarios')
          .select('escala_id')
          .eq('ativo', true);

        const escalasUsadas = new Set(funcionarios?.map(f => f.escala_id));
        const escalasNaoUsadas = escalas?.filter(e => !escalasUsadas.has(e.id));

        if (escalasNaoUsadas?.length) {
          alertasEncontrados.push({
            tipo: 'escala',
            titulo: `${escalasNaoUsadas.length} escala(s) não utilizadas`,
            descricao: 'Escalas criadas mas não associadas a funcionários',
            urgencia: 'baixa'
          });
        }

        // Verificar afastamentos ativos hoje
        const hoje = new Date().toISOString().split('T')[0];
        const { data: afastamentosHoje } = await supabase
          .from('afastamentos')
          .select('funcionario_id, tipo_periodo, quantidade_dias')
          .lte('data_inicio', hoje)
          .gte('data_fim', hoje);

        if (afastamentosHoje?.length) {
          alertasEncontrados.push({
            tipo: 'afastamento',
            titulo: `${afastamentosHoje.length} afastamento(s) ativos hoje`,
            descricao: 'Funcionários com afastamentos registrados para hoje',
            urgencia: 'media'
          });
        }

        setAlertas(alertasEncontrados);
      } catch (error) {
        console.error('Erro ao verificar alertas:', error);
      } finally {
        setLoading(false);
      }
    };

    verificarAlertas();
  }, []);

  const getUrgenciaBadge = (urgencia: string) => {
    switch (urgencia) {
      case 'alta':
        return <Badge variant="destructive">Alta</Badge>;
      case 'media':
        return <Badge variant="secondary">Média</Badge>;
      default:
        return <Badge variant="outline">Baixa</Badge>;
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'escala':
        return <Calendar className="h-4 w-4" />;
      case 'funcionario':
        return <Users className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas e Pendências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Verificando alertas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alertas e Pendências
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alertas.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhum alerta no momento
          </p>
        ) : (
          <div className="space-y-3">
            {alertas.map((alerta, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="mt-0.5">
                  {getTipoIcon(alerta.tipo)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm">{alerta.titulo}</p>
                    {getUrgenciaBadge(alerta.urgencia)}
                  </div>
                  <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}