import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, Clock, Mail, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { Badge } from "@/components/ui/badge";

interface Agendamento {
  id: string;
  dia_semana: number;
  hora: string;
  periodo_dias: number;
  email_destinatario: string;
  nome_destinatario: string;
  ativo: boolean;
}

const diasSemana = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

export function ConfiguracaoAgendamento() {
  const { tenantId } = useTenant();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novoAgendamento, setNovoAgendamento] = useState({
    dia_semana: 1,
    hora: "08:00",
    periodo_dias: 7,
    email_destinatario: "",
    nome_destinatario: "",
    ativo: true,
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (tenantId) {
      carregarAgendamentos();
    }
  }, [tenantId]);

  const carregarAgendamentos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agendamentos_relatorios_ia")
        .select("*")
        .order("dia_semana", { ascending: true });

      if (error) throw error;
      setAgendamentos(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar agendamentos:", error);
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!novoAgendamento.email_destinatario || !novoAgendamento.nome_destinatario) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.from("agendamentos_relatorios_ia").insert({
        tenant_id: tenantId,
        ...novoAgendamento,
      });

      if (error) throw error;

      toast.success("Agendamento criado com sucesso!");
      setShowForm(false);
      setNovoAgendamento({
        dia_semana: 1,
        hora: "08:00",
        periodo_dias: 7,
        email_destinatario: "",
        nome_destinatario: "",
        ativo: true,
      });
      carregarAgendamentos();
    } catch (error: any) {
      console.error("Erro ao salvar agendamento:", error);
      if (error.code === "23505") {
        toast.error("Já existe um agendamento para este dia da semana");
      } else {
        toast.error("Erro ao salvar agendamento");
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from("agendamentos_relatorios_ia")
        .update({ ativo })
        .eq("id", id);

      if (error) throw error;

      toast.success(ativo ? "Agendamento ativado" : "Agendamento desativado");
      carregarAgendamentos();
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status do agendamento");
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este agendamento?")) return;

    try {
      const { error } = await supabase.from("agendamentos_relatorios_ia").delete().eq("id", id);

      if (error) throw error;

      toast.success("Agendamento excluído com sucesso!");
      carregarAgendamentos();
    } catch (error: any) {
      console.error("Erro ao excluir agendamento:", error);
      toast.error("Erro ao excluir agendamento");
    }
  };

  const getDiaSemanaLabel = (dia: number) => {
    return diasSemana.find((d) => d.value === dia)?.label || "";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendamento Automático
            </CardTitle>
            <CardDescription>
              Configure relatórios semanais para serem gerados e enviados automaticamente
            </CardDescription>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Novo Agendamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dia-semana">Dia da Semana</Label>
                  <Select
                    value={novoAgendamento.dia_semana.toString()}
                    onValueChange={(value) =>
                      setNovoAgendamento({ ...novoAgendamento, dia_semana: parseInt(value) })
                    }
                  >
                    <SelectTrigger id="dia-semana">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {diasSemana.map((dia) => (
                        <SelectItem key={dia.value} value={dia.value.toString()}>
                          {dia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hora">Horário</Label>
                  <Input
                    id="hora"
                    type="time"
                    value={novoAgendamento.hora}
                    onChange={(e) => setNovoAgendamento({ ...novoAgendamento, hora: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periodo">Período de Análise (dias)</Label>
                  <Select
                    value={novoAgendamento.periodo_dias.toString()}
                    onValueChange={(value) =>
                      setNovoAgendamento({ ...novoAgendamento, periodo_dias: parseInt(value) })
                    }
                  >
                    <SelectTrigger id="periodo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias (1 semana)</SelectItem>
                      <SelectItem value="14">14 dias (2 semanas)</SelectItem>
                      <SelectItem value="30">30 dias (1 mês)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Destinatário</Label>
                  <Input
                    id="nome"
                    placeholder="Nome do gestor"
                    value={novoAgendamento.nome_destinatario}
                    onChange={(e) =>
                      setNovoAgendamento({ ...novoAgendamento, nome_destinatario: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Email do Destinatário</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="gestor@exemplo.com"
                    value={novoAgendamento.email_destinatario}
                    onChange={(e) =>
                      setNovoAgendamento({ ...novoAgendamento, email_destinatario: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSalvar} disabled={salvando}>
                  {salvando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Agendamento"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {agendamentos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum agendamento configurado</p>
            <p className="text-sm mt-2">Clique em "Novo Agendamento" para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agendamentos.map((agendamento) => (
              <Card key={agendamento.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={agendamento.ativo}
                          onCheckedChange={(checked) => handleToggleAtivo(agendamento.id, checked)}
                        />
                        {agendamento.ativo ? (
                          <Badge variant="default" className="bg-green-600">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{getDiaSemanaLabel(agendamento.dia_semana)}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{agendamento.hora}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {agendamento.nome_destinatario} ({agendamento.email_destinatario})
                            </span>
                          </div>

                          <Badge variant="outline">{agendamento.periodo_dias} dias</Badge>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExcluir(agendamento.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
