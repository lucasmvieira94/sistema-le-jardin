import { useState, useEffect } from "react";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RegistroHoje {
  funcionario_nome: string;
  entrada: string | null;
  saida: string | null;
  status: 'completo' | 'em_andamento' | 'pendente' | 'falta';
}

export default function RegistrosHoje() {
  const [registros, setRegistros] = useState<RegistroHoje[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarRegistrosHoje = async () => {
      try {
        const hoje = format(new Date(), 'yyyy-MM-dd');
        
        // Buscar funcionários ativos
        const { data: funcionarios } = await supabase
          .from('funcionarios')
          .select('id, nome_completo')
          .eq('ativo', true);

        if (!funcionarios) return;

        // Buscar registros de hoje
        const { data: registrosPonto } = await supabase
          .from('registros_ponto')
          .select('funcionario_id, entrada, saida')
          .eq('data', hoje);

        const registrosProcessados = funcionarios.map(func => {
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
        return <Badge variant="default" className="bg-primary text-primary-foreground">Completo</Badge>;
      case 'em_andamento':
        return <Badge variant="secondary">Em andamento</Badge>;
      case 'falta':
        return <Badge variant="destructive">Falta</Badge>;
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
          Registros de Hoje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {registros.map((registro, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(registro.status)}
                <div>
                  <p className="font-medium text-sm">{registro.funcionario_nome}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Entrada: {registro.entrada || '--:--'}</span>
                    <span>Saída: {registro.saida || '--:--'}</span>
                  </div>
                </div>
              </div>
              {getStatusBadge(registro.status)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}