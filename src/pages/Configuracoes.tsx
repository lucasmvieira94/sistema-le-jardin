import { Settings, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GestaoPermissoes } from "@/components/configuracoes/GestaoPermissoes";
import { ConviteGestor } from "@/components/configuracoes/ConviteGestor";
import { LogotipoEmpresa } from "@/components/configuracoes/LogotipoEmpresa";

export default function Configuracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    nome_empresa: "",
    cnpj: "",
    endereco: "",
    dominio_email: "",
    adicional_noturno: 20,
    adicional_hora_extra_50: 50,
    adicional_hora_extra_100: 100,
    hora_inicio_noturno: "22:00",
    hora_fim_noturno: "05:00",
    intervalo_minimo_minutos: 60,
    logo_url: ""
  });

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_empresa')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setConfig({
          nome_empresa: data.nome_empresa || "",
          cnpj: data.cnpj || "",
          endereco: data.endereco || "",
          dominio_email: data.dominio_email || "",
          adicional_noturno: data.adicional_noturno || 20,
          adicional_hora_extra_50: data.adicional_hora_extra_50 || 50,
          adicional_hora_extra_100: data.adicional_hora_extra_100 || 100,
          hora_inicio_noturno: data.hora_inicio_noturno || "22:00",
          hora_fim_noturno: data.hora_fim_noturno || "05:00",
          intervalo_minimo_minutos: data.intervalo_minimo_minutos || 60,
          logo_url: data.logo_url || ""
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const salvarConfiguracoes = async () => {
    setSaving(true);
    try {
      // Primeiro, verificar se já existe uma configuração
      const { data: existingConfig } = await supabase
        .from('configuracoes_empresa')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConfig) {
        // Atualizar configuração existente
        const { error } = await supabase
          .from('configuracoes_empresa')
          .update(config)
          .eq('id', existingConfig.id);
        
        if (error) throw error;
      } else {
        // Criar nova configuração
        const { error } = await supabase
          .from('configuracoes_empresa')
          .insert(config);
        
        if (error) throw error;
      }

      toast.success('Configurações salvas com sucesso!');
      await carregarConfiguracoes(); // Recarregar para sincronizar
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl pt-12">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary flex items-center gap-2">
        <Settings className="w-8 h-8" /> Configurações do Sistema
      </h2>
      <p className="mb-5 text-muted-foreground">
        Configure as informações da empresa e parâmetros do sistema.
      </p>

      <div className="grid gap-6">
        {/* Informações da Empresa */}
        <Card>
          <CardHeader>
            <CardTitle>Informações da Empresa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome_empresa">Nome da Empresa</Label>
                <Input
                  id="nome_empresa"
                  value={config.nome_empresa}
                  onChange={(e) => setConfig({...config, nome_empresa: e.target.value})}
                  placeholder="Nome da empresa"
                />
              </div>
              <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={config.cnpj}
                  onChange={(e) => setConfig({...config, cnpj: e.target.value})}
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={config.endereco}
                onChange={(e) => setConfig({...config, endereco: e.target.value})}
                placeholder="Endereço completo"
              />
            </div>
            <div>
              <Label htmlFor="dominio_email">Domínio de Email</Label>
              <Input
                id="dominio_email"
                value={config.dominio_email}
                onChange={(e) => setConfig({...config, dominio_email: e.target.value})}
                placeholder="contato@suaempresa.com"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Este email será usado para enviar os códigos de registro aos funcionários
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Configurações de Horário */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Horário</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hora_inicio_noturno">Início do Horário Noturno</Label>
                <Input
                  id="hora_inicio_noturno"
                  type="time"
                  value={config.hora_inicio_noturno}
                  onChange={(e) => setConfig({...config, hora_inicio_noturno: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="hora_fim_noturno">Fim do Horário Noturno</Label>
                <Input
                  id="hora_fim_noturno"
                  type="time"
                  value={config.hora_fim_noturno}
                  onChange={(e) => setConfig({...config, hora_fim_noturno: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="intervalo_minimo">Intervalo Mínimo (minutos)</Label>
              <Input
                id="intervalo_minimo"
                type="number"
                value={config.intervalo_minimo_minutos}
                onChange={(e) => setConfig({...config, intervalo_minimo_minutos: parseInt(e.target.value) || 0})}
                placeholder="60"
              />
            </div>
          </CardContent>
        </Card>

        {/* Configurações de Adicionais */}
        <Card>
          <CardHeader>
            <CardTitle>Adicionais (%)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="adicional_noturno">Adicional Noturno</Label>
                <Input
                  id="adicional_noturno"
                  type="number"
                  value={config.adicional_noturno}
                  onChange={(e) => setConfig({...config, adicional_noturno: parseFloat(e.target.value) || 0})}
                  placeholder="20"
                />
              </div>
              <div>
                <Label htmlFor="adicional_50">Hora Extra 50%</Label>
                <Input
                  id="adicional_50"
                  type="number"
                  value={config.adicional_hora_extra_50}
                  onChange={(e) => setConfig({...config, adicional_hora_extra_50: parseFloat(e.target.value) || 0})}
                  placeholder="50"
                />
              </div>
              <div>
                <Label htmlFor="adicional_100">Hora Extra 100%</Label>
                <Input
                  id="adicional_100"
                  type="number"
                  value={config.adicional_hora_extra_100}
                  onChange={(e) => setConfig({...config, adicional_hora_extra_100: parseFloat(e.target.value) || 0})}
                  placeholder="100"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logotipo da Empresa */}
        <LogotipoEmpresa
          logoUrl={config.logo_url}
          onLogoUpdate={(url) => setConfig({ ...config, logo_url: url })}
        />

        {/* Gestão de Permissões */}
        <GestaoPermissoes />

        {/* Convite para Gestores */}
        <ConviteGestor />

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <Button
            onClick={salvarConfiguracoes}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    </div>
  );
}