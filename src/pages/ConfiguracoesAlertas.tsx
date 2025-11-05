import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Save, Smartphone } from 'lucide-react';
import { useAlertasConfig } from '@/hooks/useAlertasConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { Separator } from '@/components/ui/separator';

export default function ConfiguracoesAlertas() {
  const { configuracoes, isLoading, salvarConfiguracao } = useAlertasConfig();
  const { permission, requestPermission, isSupported } = useNotifications();
  const [configs, setConfigs] = useState<Record<string, any>>({});

  const tiposAlertas = [
    {
      tipo: 'fraldas_estoque_critico',
      nome: 'Fraldas - Estoque Crítico',
      descricao: 'Alerta quando o estoque de fraldas estiver em nível crítico (menos de 3 dias)',
    },
    {
      tipo: 'fraldas_estoque_baixo',
      nome: 'Fraldas - Estoque Baixo',
      descricao: 'Alerta quando o estoque de fraldas estiver baixo (menos de 7 dias)',
    },
    {
      tipo: 'medicamentos_vencimento',
      nome: 'Medicamentos - Próximo ao Vencimento',
      descricao: 'Alerta quando medicamentos estiverem próximos ao vencimento',
    },
    {
      tipo: 'medicamentos_estoque_baixo',
      nome: 'Medicamentos - Estoque Baixo',
      descricao: 'Alerta quando estoque de medicamentos estiver abaixo do mínimo',
    },
    {
      tipo: 'prontuarios_atraso',
      nome: 'Prontuários - Em Atraso',
      descricao: 'Alerta quando prontuários estiverem atrasados',
    },
    {
      tipo: 'temperatura_nao_conforme',
      nome: 'Temperatura - Não Conforme',
      descricao: 'Alerta quando temperatura dos medicamentos estiver fora do padrão',
    },
  ];

  useEffect(() => {
    if (configuracoes.length > 0) {
      const configsMap: Record<string, any> = {};
      configuracoes.forEach((config) => {
        configsMap[config.tipo_alerta] = config;
      });
      setConfigs(configsMap);
    } else {
      // Configurações padrão
      const defaultConfigs: Record<string, any> = {};
      tiposAlertas.forEach((tipo) => {
        defaultConfigs[tipo.tipo] = {
          tipo_alerta: tipo.tipo,
          notificar_push: true,
          notificar_email: false,
          notificar_dashboard: true,
          ativo: true,
        };
      });
      setConfigs(defaultConfigs);
    }
  }, [configuracoes]);

  const handleToggle = (tipo: string, campo: string, valor: boolean) => {
    setConfigs((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        [campo]: valor,
      },
    }));
  };

  const handleSalvar = async () => {
    for (const config of Object.values(configs)) {
      await salvarConfiguracao.mutateAsync(config);
    }
  };

  const handleHabilitarNotificacoes = async () => {
    await requestPermission();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações de Alertas</h1>
          <p className="text-muted-foreground mt-2">
            Configure como e quando você deseja receber notificações
          </p>
        </div>
      </div>

      {/* Status de Notificações Push */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <CardTitle>Notificações Push</CardTitle>
          </div>
          <CardDescription>
            Receba notificações em tempo real no seu dispositivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                Status: {!isSupported ? 'Não suportado' : permission === 'granted' ? 'Ativado' : 'Desativado'}
              </p>
              <p className="text-sm text-muted-foreground">
                {!isSupported
                  ? 'Seu navegador não suporta notificações push'
                  : permission === 'granted'
                  ? 'Você receberá notificações push conforme configurado abaixo'
                  : 'Habilite as notificações para receber alertas em tempo real'}
              </p>
            </div>
            {isSupported && permission !== 'granted' && (
              <Button onClick={handleHabilitarNotificacoes}>
                <Bell className="h-4 w-4 mr-2" />
                Habilitar Notificações
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configurações por Tipo de Alerta */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Alertas</CardTitle>
          <CardDescription>
            Configure individualmente cada tipo de alerta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {tiposAlertas.map((tipoAlerta, index) => (
            <div key={tipoAlerta.tipo}>
              {index > 0 && <Separator className="my-6" />}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">{tipoAlerta.nome}</h3>
                  <p className="text-sm text-muted-foreground">{tipoAlerta.descricao}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor={`${tipoAlerta.tipo}-ativo`} className="text-sm">
                      Ativo
                    </Label>
                    <Switch
                      id={`${tipoAlerta.tipo}-ativo`}
                      checked={configs[tipoAlerta.tipo]?.ativo ?? true}
                      onCheckedChange={(checked) =>
                        handleToggle(tipoAlerta.tipo, 'ativo', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor={`${tipoAlerta.tipo}-push`} className="text-sm">
                      Push
                    </Label>
                    <Switch
                      id={`${tipoAlerta.tipo}-push`}
                      checked={configs[tipoAlerta.tipo]?.notificar_push ?? true}
                      onCheckedChange={(checked) =>
                        handleToggle(tipoAlerta.tipo, 'notificar_push', checked)
                      }
                      disabled={!configs[tipoAlerta.tipo]?.ativo}
                    />
                  </div>

                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor={`${tipoAlerta.tipo}-email`} className="text-sm">
                      E-mail
                    </Label>
                    <Switch
                      id={`${tipoAlerta.tipo}-email`}
                      checked={configs[tipoAlerta.tipo]?.notificar_email ?? false}
                      onCheckedChange={(checked) =>
                        handleToggle(tipoAlerta.tipo, 'notificar_email', checked)
                      }
                      disabled={!configs[tipoAlerta.tipo]?.ativo}
                    />
                  </div>

                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor={`${tipoAlerta.tipo}-dashboard`} className="text-sm">
                      Dashboard
                    </Label>
                    <Switch
                      id={`${tipoAlerta.tipo}-dashboard`}
                      checked={configs[tipoAlerta.tipo]?.notificar_dashboard ?? true}
                      onCheckedChange={(checked) =>
                        handleToggle(tipoAlerta.tipo, 'notificar_dashboard', checked)
                      }
                      disabled={!configs[tipoAlerta.tipo]?.ativo}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSalvar} size="lg" disabled={salvarConfiguracao.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {salvarConfiguracao.isPending ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
