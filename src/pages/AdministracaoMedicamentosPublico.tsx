import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Pill, Clock, Check, Search, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Prescricao {
  id: string;
  residente_id: string;
  medicamento_id: string;
  dosagem: string;
  frequencia_tipo: string;
  frequencia_valor?: number;
  horarios?: string[];
  dia_semana?: number;
  intervalo_dias?: number;
  via_administracao?: string;
  prescrito_por?: string;
  data_inicio: string;
  data_fim?: string;
  observacoes?: string;
  medicamento?: { id: string; nome: string; dosagem?: string };
  residente?: { id: string; nome_completo: string };
}

interface AdminRegistro {
  prescricao: Prescricao;
  horario: string;
  jaAdministrado: boolean;
}

const frequenciaLabel = (tipo: string, valor?: number, diaSemana?: number, intervaloDias?: number) => {
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  switch (tipo) {
    case "a_cada_x_horas": return `A cada ${valor}h`;
    case "hora_fixa_diaria": return "Diário";
    case "dia_especifico": return `Toda ${dias[diaSemana || 0]}`;
    case "intervalo_dias": return `A cada ${intervaloDias} dia(s)`;
    default: return tipo;
  }
};

export default function AdministracaoMedicamentosPublico() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const funcionarioId = searchParams.get("funcionario_id") || "";
  const funcionarioNome = decodeURIComponent(searchParams.get("funcionario_nome") || "");

  const [prescricoes, setPrescricoes] = useState<Prescricao[]>([]);
  const [administracoes, setAdministracoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; prescricao?: Prescricao; horario?: string }>({ open: false });
  const [observacoes, setObservacoes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hoje = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!funcionarioId) return;
    fetchData();
  }, [funcionarioId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar prescrições ativas com medicamento e residente
      const { data: presc, error: prescError } = await supabase
        .from("prescricoes_medicamentos")
        .select("*, medicamento:medicamentos(id, nome, dosagem), residente:residentes(id, nome_completo)")
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (prescError) throw prescError;

      // Buscar administrações de hoje
      const { data: admin, error: adminError } = await supabase
        .from("administracao_medicamentos")
        .select("*")
        .eq("data_administracao", hoje);

      if (adminError) throw adminError;

      setPrescricoes(presc || []);
      setAdministracoes(admin || []);
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao carregar dados: " + error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Agrupar prescrições por residente
  const porResidente = prescricoes.reduce((acc, p) => {
    const nome = p.residente?.nome_completo || "Sem residente";
    const id = p.residente_id;
    if (!acc[id]) acc[id] = { nome, prescricoes: [] };
    acc[id].prescricoes.push(p);
    return acc;
  }, {} as Record<string, { nome: string; prescricoes: Prescricao[] }>);

  const filtered = Object.entries(porResidente).filter(([_, data]) =>
    data.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    data.prescricoes.some(p => p.medicamento?.nome.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Verificar se já foi administrado hoje naquele horário
  const jaAdministrado = (prescricao: Prescricao, horario: string) => {
    return administracoes.some(a =>
      a.medicamento_id === prescricao.medicamento_id &&
      a.residente_id === prescricao.residente_id &&
      a.horario_administracao?.substring(0, 5) === horario
    );
  };

  const confirmarAdministracao = async () => {
    if (!confirmDialog.prescricao || !confirmDialog.horario) return;
    setSubmitting(true);

    const p = confirmDialog.prescricao;

    try {
      // Buscar estoque do residente para este medicamento
      const { data: estoque } = await supabase
        .from("estoque_medicamentos")
        .select("id")
        .eq("medicamento_id", p.medicamento_id)
        .eq("residente_id", p.residente_id)
        .eq("ativo", true)
        .maybeSingle();

      // Se não tem estoque do residente, tentar urgência
      let estoqueId = estoque?.id;
      if (!estoqueId) {
        const { data: estoqueUrg } = await supabase
          .from("estoque_medicamentos")
          .select("id")
          .eq("medicamento_id", p.medicamento_id)
          .eq("tipo_estoque", "urgencia")
          .eq("ativo", true)
          .maybeSingle();
        estoqueId = estoqueUrg?.id;
      }

      const { error } = await supabase
        .from("administracao_medicamentos")
        .insert({
          medicamento_id: p.medicamento_id,
          residente_id: p.residente_id,
          funcionario_id: funcionarioId,
          dosagem_administrada: p.dosagem,
          horario_administracao: confirmDialog.horario,
          data_administracao: hoje,
          quantidade_utilizada: 1,
          via_administracao: p.via_administracao,
          estoque_medicamento_id: estoqueId || null,
          observacoes: observacoes || null,
          status: "administrado",
        });

      if (error) throw error;

      toast({ title: "✅ Registrado", description: `${p.medicamento?.nome} administrado com sucesso` });
      setConfirmDialog({ open: false });
      setObservacoes("");
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getHorariosParaPrescricao = (p: Prescricao): string[] => {
    if (p.horarios && p.horarios.length > 0) return p.horarios;
    if (p.frequencia_tipo === "a_cada_x_horas" && p.frequencia_valor) {
      const hrs: string[] = [];
      for (let h = 0; h < 24; h += p.frequencia_valor) {
        hrs.push(`${String(h).padStart(2, "0")}:00`);
      }
      return hrs;
    }
    // Sem horários definidos — retorna lista vazia para tratar com aviso
    return [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-2xl space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-green-800">Administração de Medicamentos</h1>
              <p className="text-sm text-muted-foreground">{funcionarioNome} — {format(new Date(), "dd/MM/yyyy")}</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar residente ou medicamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Lista por residente */}
        {filtered.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="text-center py-8 text-muted-foreground">
              <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma prescrição ativa encontrada</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(([residenteId, data]) => (
            <Card key={residenteId} className="bg-white shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-green-700" />
                  <CardTitle className="text-base">{data.nome}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.prescricoes.map((p) => {
                  const horarios = getHorariosParaPrescricao(p);

                  return (
                    <div key={p.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-sm">{p.medicamento?.nome}</span>
                          <span className="text-xs text-muted-foreground ml-2">{p.dosagem}</span>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {frequenciaLabel(p.frequencia_tipo, p.frequencia_valor, p.dia_semana, p.intervalo_dias)}
                        </Badge>
                      </div>

                      {p.via_administracao && (
                        <p className="text-xs text-muted-foreground">Via: {p.via_administracao}</p>
                      )}

                      {/* Botões de horários */}
                      <div className="flex flex-wrap gap-2">
                        {horarios.map((horario) => {
                          const administrado = jaAdministrado(p, horario);
                          return (
                            <Button
                              key={horario}
                              size="sm"
                              variant={administrado ? "default" : "outline"}
                              className={administrado
                                ? "bg-green-600 hover:bg-green-600 text-white cursor-default text-xs"
                                : "border-green-600 text-green-700 hover:bg-green-50 text-xs"
                              }
                              disabled={administrado}
                              onClick={() => {
                                if (!administrado) {
                                  setConfirmDialog({ open: true, prescricao: p, horario });
                                  setObservacoes("");
                                }
                              }}
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {horario}
                              {administrado && <Check className="h-3 w-3 ml-1" />}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog de confirmação */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Administração</DialogTitle>
            <DialogDescription>Confirme os dados antes de registrar</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="bg-green-50 rounded-lg p-3 space-y-1">
              <p className="text-sm"><strong>Residente:</strong> {confirmDialog.prescricao?.residente?.nome_completo}</p>
              <p className="text-sm"><strong>Medicamento:</strong> {confirmDialog.prescricao?.medicamento?.nome}</p>
              <p className="text-sm"><strong>Dosagem:</strong> {confirmDialog.prescricao?.dosagem}</p>
              <p className="text-sm"><strong>Via:</strong> {confirmDialog.prescricao?.via_administracao || "Não especificada"}</p>
              <p className="text-sm"><strong>Horário:</strong> {confirmDialog.horario}</p>
            </div>

            <div className="flex items-start gap-2 p-2 bg-amber-50 rounded text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>O estoque será descontado automaticamente ao confirmar.</span>
            </div>

            <Textarea
              placeholder="Observações (opcional)"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDialog({ open: false })}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-green-700 hover:bg-green-800"
                onClick={confirmarAdministracao}
                disabled={submitting}
              >
                {submitting ? "Registrando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
