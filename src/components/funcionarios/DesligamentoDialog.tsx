import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, UserMinus, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";

export type MotivoDesligamentoCLT =
  | "pedido_demissao"
  | "sem_justa_causa"
  | "com_justa_causa"
  | "acordo_mutuo"
  | "termino_contrato"
  | "aposentadoria"
  | "falecimento";

export type TipoAvisoPrevio = "trabalhado" | "indenizado" | "dispensado";
export type ModalidadeReducaoAviso =
  | "reducao_2h_entrada"
  | "reducao_2h_saida"
  | "reducao_7_dias_corridos";

export const MOTIVOS_CLT: { value: MotivoDesligamentoCLT; label: string; descricao: string }[] = [
  { value: "pedido_demissao", label: "Demissão a pedido", descricao: "Iniciativa do empregado (art. 487 CLT)" },
  { value: "sem_justa_causa", label: "Dispensa sem justa causa", descricao: "Iniciativa do empregador (art. 477 CLT)" },
  { value: "com_justa_causa", label: "Dispensa por justa causa", descricao: "Falta grave do empregado (art. 482 CLT)" },
  { value: "acordo_mutuo", label: "Rescisão por acordo mútuo", descricao: "Comum acordo (art. 484-A CLT)" },
  { value: "termino_contrato", label: "Término de contrato determinado", descricao: "Experiência ou prazo determinado" },
  { value: "aposentadoria", label: "Aposentadoria", descricao: "Encerramento por aposentadoria" },
  { value: "falecimento", label: "Falecimento", descricao: "Encerramento por falecimento" },
];

const MOTIVOS_COM_AVISO: MotivoDesligamentoCLT[] = [
  "pedido_demissao",
  "sem_justa_causa",
  "acordo_mutuo",
];

interface Funcionario {
  id: string;
  nome_completo: string;
  data_admissao: string;
  tenant_id?: string | null;
}

interface DesligamentoDialogProps {
  funcionario: Funcionario | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DesligamentoDialog({
  funcionario,
  open,
  onOpenChange,
  onSuccess,
}: DesligamentoDialogProps) {
  const { logEvent } = useAuditLog();

  const hoje = new Date().toISOString().slice(0, 10);

  const [dataDesligamento, setDataDesligamento] = useState(hoje);
  const [motivo, setMotivo] = useState<MotivoDesligamentoCLT | "">("");
  const [avisoPrevio, setAvisoPrevio] = useState(false);
  const [tipoAviso, setTipoAviso] = useState<TipoAvisoPrevio>("trabalhado");
  const [modalidadeReducao, setModalidadeReducao] =
    useState<ModalidadeReducaoAviso>("reducao_2h_saida");
  const [dataInicioAviso, setDataInicioAviso] = useState(hoje);
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setDataDesligamento(hoje);
      setMotivo("");
      setAvisoPrevio(false);
      setTipoAviso("trabalhado");
      setModalidadeReducao("reducao_2h_saida");
      setDataInicioAviso(hoje);
      setObservacoes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sugere data fim aviso (+30 dias) e ajusta data desligamento se trabalhado
  const dataFimAviso = useMemo(() => {
    if (!avisoPrevio || !dataInicioAviso) return null;
    return addDays(dataInicioAviso, 30);
  }, [avisoPrevio, dataInicioAviso]);

  useEffect(() => {
    if (avisoPrevio && tipoAviso === "trabalhado" && dataFimAviso) {
      setDataDesligamento(dataFimAviso);
    }
  }, [avisoPrevio, tipoAviso, dataFimAviso]);

  const mostrarAviso = motivo && MOTIVOS_COM_AVISO.includes(motivo);

  function validar(): string | null {
    if (!funcionario) return "Funcionário inválido.";
    if (!motivo) return "Selecione o motivo do desligamento.";
    if (!dataDesligamento) return "Informe a data de desligamento.";
    if (funcionario.data_admissao && dataDesligamento < funcionario.data_admissao) {
      return "A data de desligamento não pode ser anterior à admissão.";
    }
    if (avisoPrevio) {
      if (!dataInicioAviso) return "Informe a data de início do aviso prévio.";
      if (tipoAviso === "trabalhado" && !modalidadeReducao) {
        return "Selecione a modalidade de redução de jornada.";
      }
    }
    return null;
  }

  async function handleConfirmar() {
    if (!funcionario) return;
    const erro = validar();
    if (erro) {
      toast({ variant: "destructive", title: "Validação", description: erro });
      return;
    }

    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;

      // Snapshot funcionário
      const { data: snap } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("id", funcionario.id)
        .maybeSingle();

      // Atualiza funcionario
      const isAvisoTrabalhadoEmCurso =
        avisoPrevio && tipoAviso === "trabalhado" && dataDesligamento > hoje;

      // Funcionário permanece ATIVO enquanto cumprir aviso prévio trabalhado
      // (data de desligamento ainda no futuro). Nos demais casos é inativado
      // imediatamente: indenizado, dispensado, sem aviso ou aviso já vencido.
      const updatePayload: Record<string, unknown> = {
        data_desligamento: dataDesligamento,
        motivo_desligamento: motivo,
        aviso_previo: avisoPrevio,
        tipo_aviso_previo: avisoPrevio ? tipoAviso : null,
        modalidade_reducao_aviso:
          avisoPrevio && tipoAviso === "trabalhado" ? modalidadeReducao : null,
        data_inicio_aviso: avisoPrevio ? dataInicioAviso : null,
        data_fim_aviso: avisoPrevio ? dataFimAviso : null,
        observacoes_desligamento: observacoes || null,
        desligado_por: user?.id || null,
        ativo: isAvisoTrabalhadoEmCurso, // true enquanto cumprir aviso trabalhado
      };

      const { error: updErr } = await supabase
        .from("funcionarios")
        .update(updatePayload)
        .eq("id", funcionario.id);
      if (updErr) throw updErr;

      // Histórico
      const { error: histErr } = await supabase.from("desligamentos_historico").insert({
        funcionario_id: funcionario.id,
        tenant_id: funcionario.tenant_id ?? null,
        data_desligamento: dataDesligamento,
        motivo_desligamento: motivo,
        aviso_previo: avisoPrevio,
        tipo_aviso_previo: avisoPrevio ? tipoAviso : null,
        modalidade_reducao_aviso:
          avisoPrevio && tipoAviso === "trabalhado" ? modalidadeReducao : null,
        data_inicio_aviso: avisoPrevio ? dataInicioAviso : null,
        data_fim_aviso: avisoPrevio ? dataFimAviso : null,
        observacoes: observacoes || null,
        snapshot_funcionario: snap ?? null,
        registrado_por: user?.id || null,
      });
      if (histErr) throw histErr;

      // Se redução 7 dias corridos: cria afastamento para os 7 últimos dias
      if (
        avisoPrevio &&
        tipoAviso === "trabalhado" &&
        modalidadeReducao === "reducao_7_dias_corridos" &&
        dataFimAviso
      ) {
        const inicio7 = addDays(dataFimAviso, -6);

        // Busca o tipo "AVPREV" do tenant (ou qualquer com este código)
        const { data: tipo } = await supabase
          .from("tipos_afastamento")
          .select("id")
          .eq("codigo", "AVPREV")
          .maybeSingle();

        if (tipo?.id) {
          const { error: afErr } = await supabase.from("afastamentos").insert({
            funcionario_id: funcionario.id,
            tipo_afastamento_id: tipo.id,
            tipo_periodo: "dias",
            data_inicio: inicio7,
            data_fim: dataFimAviso,
            quantidade_dias: 7,
            observacoes: "Aviso prévio - redução de 7 dias corridos (gerado automaticamente)",
            tenant_id: funcionario.tenant_id ?? null,
          });
          if (afErr) {
            console.warn("Falha ao gerar afastamento de aviso prévio:", afErr);
            toast({
              variant: "destructive",
              title: "Aviso",
              description:
                "Desligamento registrado, mas não foi possível criar o afastamento dos 7 dias automaticamente. Cadastre manualmente.",
            });
          }
        }
      }

      await logEvent("funcionarios", "DESLIGAMENTO", snap, updatePayload);

      toast({
        title: "Desligamento registrado",
        description: isAvisoTrabalhadoEmCurso
          ? "Funcionário permanecerá ativo até o término do aviso prévio."
          : "Funcionário desligado com sucesso.",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast({ variant: "destructive", title: "Erro ao registrar desligamento", description: msg });
    } finally {
      setSaving(false);
    }
  }

  if (!funcionario) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <UserMinus className="w-5 h-5" />
            Desligar funcionário
          </DialogTitle>
          <DialogDescription>
            <strong>{funcionario.nome_completo}</strong> — registre os dados da rescisão
            conforme a CLT.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Motivo */}
          <div>
            <Label>Motivo do desligamento (CLT) *</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoDesligamentoCLT)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_CLT.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-xs text-muted-foreground">{m.descricao}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aviso prévio (apenas quando aplicável) */}
          {mostrarAviso && (
            <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Houve aviso prévio?</Label>
                  <p className="text-xs text-muted-foreground">
                    Aviso prévio de 30 dias (art. 487 CLT)
                  </p>
                </div>
                <Switch checked={avisoPrevio} onCheckedChange={setAvisoPrevio} />
              </div>

              {avisoPrevio && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Data de início do aviso</Label>
                      <Input
                        type="date"
                        value={dataInicioAviso}
                        onChange={(e) => setDataInicioAviso(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Data fim (auto: +30 dias)</Label>
                      <Input type="date" value={dataFimAviso || ""} disabled />
                    </div>
                  </div>

                  <div>
                    <Label>Tipo de aviso prévio</Label>
                    <RadioGroup
                      value={tipoAviso}
                      onValueChange={(v) => setTipoAviso(v as TipoAvisoPrevio)}
                      className="mt-2 space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="trabalhado" id="aviso-trab" className="mt-1" />
                        <Label htmlFor="aviso-trab" className="font-normal cursor-pointer">
                          <strong>Trabalhado</strong> — funcionário cumpre o aviso com redução de
                          jornada
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="indenizado" id="aviso-ind" className="mt-1" />
                        <Label htmlFor="aviso-ind" className="font-normal cursor-pointer">
                          <strong>Indenizado</strong> — empresa paga sem o funcionário trabalhar
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="dispensado" id="aviso-disp" className="mt-1" />
                        <Label htmlFor="aviso-disp" className="font-normal cursor-pointer">
                          <strong>Dispensado</strong> — empregador dispensa o cumprimento (sem
                          pagamento)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {tipoAviso === "trabalhado" && (
                    <div>
                      <Label>Modalidade de redução (art. 488 CLT)</Label>
                      <RadioGroup
                        value={modalidadeReducao}
                        onValueChange={(v) =>
                          setModalidadeReducao(v as ModalidadeReducaoAviso)
                        }
                        className="mt-2 space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <RadioGroupItem
                            value="reducao_2h_entrada"
                            id="red-ent"
                            className="mt-1"
                          />
                          <Label htmlFor="red-ent" className="font-normal cursor-pointer">
                            Entra <strong>2h depois</strong> todos os dias
                          </Label>
                        </div>
                        <div className="flex items-start gap-2">
                          <RadioGroupItem
                            value="reducao_2h_saida"
                            id="red-sai"
                            className="mt-1"
                          />
                          <Label htmlFor="red-sai" className="font-normal cursor-pointer">
                            Sai <strong>2h antes</strong> todos os dias
                          </Label>
                        </div>
                        <div className="flex items-start gap-2">
                          <RadioGroupItem
                            value="reducao_7_dias_corridos"
                            id="red-7"
                            className="mt-1"
                          />
                          <Label htmlFor="red-7" className="font-normal cursor-pointer">
                            Folga nos <strong>7 últimos dias corridos</strong> do aviso
                          </Label>
                        </div>
                      </RadioGroup>
                      {modalidadeReducao === "reducao_7_dias_corridos" && (
                        <Alert className="mt-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Será criado automaticamente um afastamento "Aviso prévio" para os 7
                            últimos dias do aviso — esses dias não contarão como falta.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Data de desligamento efetivo */}
          <div>
            <Label>Data de desligamento efetivo *</Label>
            <Input
              type="date"
              value={dataDesligamento}
              onChange={(e) => setDataDesligamento(e.target.value)}
              min={funcionario.data_admissao}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Último dia de vínculo. Dias posteriores não serão contados como faltas nem como
              dias trabalhados para vale-transporte.
            </p>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes adicionais sobre o desligamento..."
              rows={3}
              maxLength={1000}
            />
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta ação é registrada em auditoria e não pode ser desfeita pela interface. Para
              reverter, entre em contato com o administrador do sistema.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirmar} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...
              </>
            ) : (
              <>
                <UserMinus className="w-4 h-4 mr-2" /> Confirmar desligamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}