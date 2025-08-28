import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Clock, Save, Loader2 } from "lucide-react";

interface ConfiguracoesProntuarioData {
  id?: string;
  horario_inicio_ciclo: string;
  tempo_limite_horas: number;
  notificar_atraso: boolean;
}

export default function ConfiguracoesProntuario() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfiguracoesProntuarioData>({
    horario_inicio_ciclo: '08:00',
    tempo_limite_horas: 24,
    notificar_atraso: true
  });

  useEffect(() => {
    fetchConfiguracoes();
  }, []);

  const fetchConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_prontuario')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig({
          id: data.id,
          horario_inicio_ciclo: data.horario_inicio_ciclo,
          tempo_limite_horas: data.tempo_limite_horas,
          notificar_atraso: data.notificar_atraso
        });
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const configData = {
        horario_inicio_ciclo: config.horario_inicio_ciclo,
        tempo_limite_horas: config.tempo_limite_horas,
        notificar_atraso: config.notificar_atraso
      };

      let result;
      if (config.id) {
        // Atualizar existente
        result = await supabase
          .from('configuracoes_prontuario')
          .update(configData)
          .eq('id', config.id);
      } else {
        // Inserir novo
        result = await supabase
          .from('configuracoes_prontuario')
          .insert(configData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      if (result.data && !config.id) {
        setConfig(prev => ({ ...prev, id: result.data.id }));
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações de prontuário foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManualExecution = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('redefinir_prontuarios_com_horario');
      
      if (error) throw error;

      toast({
        title: "Execução manual realizada",
        description: "A criação de prontuários foi executada manualmente.",
      });
    } catch (error) {
      console.error('Erro na execução manual:', error);
      toast({
        title: "Erro",
        description: "Não foi possível executar a criação manual de prontuários.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Carregando configurações...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Configurações de Prontuário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Horário de Início */}
          <div className="space-y-2">
            <Label htmlFor="horario_inicio">
              <Clock className="w-4 h-4 inline mr-2" />
              Horário de Início dos Ciclos
            </Label>
            <Input
              id="horario_inicio"
              type="time"
              value={config.horario_inicio_ciclo}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                horario_inicio_ciclo: e.target.value
              }))}
            />
            <p className="text-sm text-muted-foreground">
              Horário em que os prontuários diários devem ser criados automaticamente.
            </p>
          </div>

          {/* Tempo Limite */}
          <div className="space-y-2">
            <Label htmlFor="tempo_limite">
              Tempo Limite (horas)
            </Label>
            <Input
              id="tempo_limite"
              type="number"
              min="1"
              max="48"
              value={config.tempo_limite_horas}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                tempo_limite_horas: parseInt(e.target.value) || 24
              }))}
            />
            <p className="text-sm text-muted-foreground">
              Número de horas após o início do ciclo para considerar o prontuário em atraso.
            </p>
          </div>
        </div>

        {/* Notificação de Atraso */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Notificar Atrasos</div>
            <div className="text-sm text-muted-foreground">
              Exibir alertas visuais para prontuários em atraso
            </div>
          </div>
          <Switch
            checked={config.notificar_atraso}
            onCheckedChange={(checked) => setConfig(prev => ({
              ...prev,
              notificar_atraso: checked
            }))}
          />
        </div>

        {/* Ações */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={handleManualExecution}
            disabled={saving}
          >
            Executar Manualmente
          </Button>
        </div>

        {/* Informações Adicionais */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">ℹ️ Informações Importantes</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Os prontuários são criados automaticamente no horário configurado</li>
            <li>• Prontuários não finalizados após {config.tempo_limite_horas}h serão marcados como em atraso</li>
            <li>• O sistema executa verificações automáticas a cada hora</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}