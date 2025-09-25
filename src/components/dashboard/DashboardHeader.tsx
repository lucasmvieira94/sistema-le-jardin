import { Calendar, Users, AlertTriangle, Clock, Activity, Clipboard } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  funcionariosAtivos: number;
  registrosHoje: number;
  pendencias: number;
  escalasAtivas: number;
  prontuariosPendentes: number;
  medicamentosVencendo: number;
}

export default function DashboardHeader() {
  const [stats, setStats] = useState<DashboardStats>({
    funcionariosAtivos: 0,
    registrosHoje: 0,
    pendencias: 0,
    escalasAtivas: 0,
    prontuariosPendentes: 0,
    medicamentosVencendo: 0
  });
  const [loading, setLoading] = useState(true);

  const hoje = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  useEffect(() => {
    const carregarStats = async () => {
      try {
        // Funcionários ativos
        const { count: funcionariosAtivos } = await supabase
          .from('funcionarios')
          .select('*', { count: 'exact', head: true })
          .eq('ativo', true);

        // Registros de hoje
        const hoje = new Date().toISOString().split('T')[0];
        const { count: registrosHoje } = await supabase
          .from('registros_ponto')
          .select('*', { count: 'exact', head: true })
          .eq('data', hoje);

        // Escalas ativas
        const { count: escalasAtivas } = await supabase
          .from('escalas')
          .select('*', { count: 'exact', head: true });

        // Prontuários pendentes - usando dados disponíveis
        const prontuariosPendentes = 0; // Temporário até implementação completa

        // Medicamentos vencendo - usando dados disponíveis
        const medicamentosVencendo = 0; // Temporário até implementação completa

        const pendencias = prontuariosPendentes + medicamentosVencendo;

        setStats({
          funcionariosAtivos: funcionariosAtivos || 0,
          registrosHoje: registrosHoje || 0,
          pendencias,
          escalasAtivas: escalasAtivas || 0,
          prontuariosPendentes: prontuariosPendentes || 0,
          medicamentosVencendo: medicamentosVencendo || 0
        });
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    carregarStats();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Centro de Controle</h1>
              <p className="text-muted-foreground capitalize">{hoje}</p>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-primary/10 rounded-lg p-4 text-center hover:bg-primary/20 transition-colors">
              <Users className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {loading ? "..." : stats.funcionariosAtivos}
              </div>
              <p className="text-sm text-muted-foreground">Funcionários Ativos</p>
            </div>
            
            <div className="bg-accent/10 rounded-lg p-4 text-center hover:bg-accent/20 transition-colors">
              <Clock className="h-6 w-6 text-accent-foreground mx-auto mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {loading ? "..." : stats.registrosHoje}
              </div>
              <p className="text-sm text-muted-foreground">Registros Hoje</p>
            </div>
            
            <div className="bg-destructive/10 rounded-lg p-4 text-center hover:bg-destructive/20 transition-colors">
              <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {loading ? "..." : stats.pendencias}
              </div>
              <p className="text-sm text-muted-foreground">Pendências</p>
            </div>
            
            <div className="bg-secondary/10 rounded-lg p-4 text-center hover:bg-secondary/20 transition-colors">
              <Activity className="h-6 w-6 text-secondary-foreground mx-auto mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {loading ? "..." : stats.escalasAtivas}
              </div>
              <p className="text-sm text-muted-foreground">Escalas Ativas</p>
            </div>
            
            <div className="bg-orange-100 rounded-lg p-4 text-center hover:bg-orange-200 transition-colors">
              <Clipboard className="h-6 w-6 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {loading ? "..." : stats.prontuariosPendentes}
              </div>
              <p className="text-sm text-muted-foreground">Prontuários</p>
            </div>
            
            <div className="bg-red-100 rounded-lg p-4 text-center hover:bg-red-200 transition-colors">
              <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {loading ? "..." : stats.medicamentosVencendo}
              </div>
              <p className="text-sm text-muted-foreground">Vencimentos</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-medium">Status do Sistema</span>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">
                Sistema Online
              </Badge>
              <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                {stats.funcionariosAtivos} Ativos
              </Badge>
              {stats.pendencias > 0 && (
                <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50">
                  {stats.pendencias} Pendentes
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}