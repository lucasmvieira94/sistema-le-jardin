import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Bot, TrendingUp, Users, Clock } from 'lucide-react';

interface MetricasProps {
  onObterMetricas: () => Promise<{
    conversasAtivas: number;
    mensagensEnviadas: number;
    consultasIA: number;
  }>;
}

export function DashboardMetricas({ onObterMetricas }: MetricasProps) {
  const [metricas, setMetricas] = useState({
    conversasAtivas: 0,
    mensagensEnviadas: 0,
    consultasIA: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarMetricas = async () => {
      setLoading(true);
      try {
        const dados = await onObterMetricas();
        setMetricas(dados);
      } catch (error) {
        console.error('Erro ao carregar métricas:', error);
      } finally {
        setLoading(false);
      }
    };

    carregarMetricas();
    
    // Atualizar métricas a cada 30 segundos
    const interval = setInterval(carregarMetricas, 30000);
    return () => clearInterval(interval);
  }, [onObterMetricas]);

  const cards = [
    {
      title: 'Conversas Ativas',
      value: metricas.conversasAtivas,
      icon: MessageSquare,
      description: 'Conversas em andamento',
      color: 'text-blue-500'
    },
    {
      title: 'Mensagens Enviadas',
      value: metricas.mensagensEnviadas,
      icon: Send,
      description: 'Total de mensagens enviadas',
      color: 'text-green-500'
    },
    {
      title: 'Consultas à IA',
      value: metricas.consultasIA,
      icon: Bot,
      description: 'Consultas processadas pela IA',
      color: 'text-purple-500'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}