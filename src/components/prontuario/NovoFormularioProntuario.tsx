import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  Heart,
  Pill,
  Clock,
  Stethoscope,
  Smile,
  AlertTriangle,
  FileText,
  Users,
  Lock,
  Send,
  Unlock,
} from "lucide-react";
import AssistenteProntuarioIA from "./AssistenteProntuarioIA";
import LinhaTempoProntuario from "./LinhaTempoProntuario";
import {
  TIPOS_LANCAMENTO,
  cicloAceitaLancamento,
  hojeCicloISO,
  montarLinhaTempo,
  type LancamentoProntuario,
} from "@/utils/prontuarioLancamentos";

interface NovoFormularioProntuarioProps {
  funcionarioId: string;
  residenteId: string;
  cicloStatus?: string;
  onChangeResidente?: (residenteId: string) => void;
  onVoltar?: () => void;
  onStatusChange?: (residenteId: string, status: string, cicloId: string) => void;
}

type ValoresFormulario = Record<string, any>;

const iconesSecao: Record<string, any> = {
  identificacao: User,
  historico_saude: Heart,
  medicacoes: Pill,
  rotina_diaria: Clock,
  aspectos_clinicos: Stethoscope,
  bem_estar: Smile,
  ocorrencias: AlertTriangle,
  observacoes: FileText,
};

const titulosSecao: Record<string, string> = {
  rotina_diaria: "Rotina Diária",
  aspectos_clinicos: "Aspectos Clínicos",
  bem_estar: "Avaliação de Bem-Estar",
  ocorrencias: "Registro de Ocorrências",
  observacoes: "Observações Gerais",
};

const ordemSecoes = [
  "rotina_diaria",
  "aspectos_clinicos",
  "bem_estar",
  "ocorrencias",
  "observacoes",
];

const isValorPreenchido = (valor: any, tipo?: string): boolean => {
  if (valor === undefined || valor === null) return false;
  if (typeof valor === "string") return valor.trim().length > 0;
  if (Array.isArray(valor)) {
    if (tipo === "slider") return valor.length > 0 && valor[0] !== undefined && valor[0] !== null;
    return valor.length > 0 && valor.some((item) => isValorPreenchido(item));
  }
  if (typeof valor === "number") return Number.isFinite(valor);
  if (typeof valor === "object") return Object.values(valor).some((item) => isValorPreenchido(item));
  return Boolean(valor);
};

export default function NovoFormularioProntuario({
  funcionarioId,
  residenteId,
  onChangeResidente,
  onVoltar,
  onStatusChange,
}: NovoFormularioProntuarioProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [residenteData, setResidenteData] = useState<any>(null);
  const [camposConfigurados, setCamposConfigurados] = useState<any[]>([]);
  const [cicloId, setCicloId] = useState<string | null>(null);
  const [cicloStatus, setCicloStatus] = useState<string>("nao_iniciado");
  const [registros, setRegistros] = useState<LancamentoProntuario[]>([]);
  const [valores, setValores] = useState<ValoresFormulario>({});
  const rascunhoCarregado = useRef(false);

  const chaveRascunho = `prontuario_rascunho:${residenteId}:${hojeCicloISO()}`;
  const cicloAberto = cicloAceitaLancamento(cicloId ? hojeCicloISO() : null, cicloStatus);

  const rotulos = useMemo(() => {
    const mapa: Record<string, string> = {};
    camposConfigurados.forEach((campo) => {
      mapa[`campo_${campo.id}`] = campo.label;
    });
    mapa.texto = "Correção";
    return mapa;
  }, [camposConfigurados]);

  const linhaTempo = useMemo(() => montarLinhaTempo(registros), [registros]);

  /** Carrega os lançamentos já registrados no ciclo do dia. */
  const carregarRegistros = useCallback(
    async (idCiclo: string) => {
      const { data, error } = await supabase
        .from("prontuario_registros")
        .select(
          "id, ciclo_id, residente_id, funcionario_id, funcionario_nome, tipo_registro, titulo, descricao, created_at, horario_registro, retifica_registro_id, justificativa_retificacao",
        )
        .eq("ciclo_id", idCiclo)
        .in("tipo_registro", TIPOS_LANCAMENTO as unknown as string[])
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erro ao carregar lançamentos:", error);
        return;
      }
      setRegistros((data || []) as LancamentoProntuario[]);
    },
    [],
  );

  // Inicialização: residente + ciclo do dia + lançamentos
  useEffect(() => {
    let cancelado = false;

    const inicializar = async () => {
      setLoading(true);
      setRegistros([]);
      setCicloId(null);
      setCicloStatus("nao_iniciado");
      rascunhoCarregado.current = false;

      try {
        const { data: residente } = await supabase
          .from("residentes")
          .select("*")
          .eq("id", residenteId)
          .single();

        if (cancelado) return;
        setResidenteData(residente);

        const { data: verificacao } = await supabase.rpc("verificar_prontuario_diario_existente", {
          p_residente_id: residenteId,
        });

        const ciclo = verificacao?.[0];
        if (cancelado) return;

        if (ciclo?.ciclo_id) {
          setCicloId(ciclo.ciclo_id);
          setCicloStatus(ciclo.status || "nao_iniciado");
          onStatusChange?.(residenteId, ciclo.status || "nao_iniciado", ciclo.ciclo_id);
          await carregarRegistros(ciclo.ciclo_id);
        }
      } catch (error) {
        console.error("Erro ao inicializar prontuário:", error);
        toast({
          title: "Erro inesperado",
          description: "Não foi possível abrir o prontuário.",
          variant: "destructive",
        });
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    if (residenteId && funcionarioId) inicializar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residenteId, funcionarioId]);

  // Campos configurados
  useEffect(() => {
    const carregarCampos = async () => {
      const { data, error } = await supabase
        .from("formulario_campos_config")
        .select("*")
        .eq("ativo", true)
        .order("secao, ordem" as any);

      if (error) {
        console.error("Erro ao carregar campos configurados:", error);
        return;
      }
      setCamposConfigurados(data || []);
    };
    carregarCampos();
  }, []);

  // Rascunho local (não perder digitação antes do envio)
  useEffect(() => {
    if (rascunhoCarregado.current) return;
    try {
      const salvo = localStorage.getItem(chaveRascunho);
      setValores(salvo ? JSON.parse(salvo) : {});
    } catch {
      setValores({});
    }
    rascunhoCarregado.current = true;
  }, [chaveRascunho]);

  useEffect(() => {
    if (!rascunhoCarregado.current) return;
    try {
      if (Object.keys(valores).length > 0) {
        localStorage.setItem(chaveRascunho, JSON.stringify(valores));
      } else {
        localStorage.removeItem(chaveRascunho);
      }
    } catch {
      /* armazenamento indisponível */
    }
  }, [valores, chaveRascunho]);

  const setCampo = (chave: string, valor: any) => {
    setValores((prev) => ({ ...prev, [chave]: valor }));
  };

  const dadosPreenchidos = useMemo(() => {
    const resultado: Record<string, any> = {};
    Object.entries(valores).forEach(([chave, valor]) => {
      const campo = camposConfigurados.find((c) => `campo_${c.id}` === chave);
      if (isValorPreenchido(valor, campo?.tipo)) resultado[chave] = valor;
    });
    return resultado;
  }, [valores, camposConfigurados]);

  const enviarLancamento = async () => {
    if (Object.keys(dadosPreenchidos).length === 0) {
      toast({
        title: "Nada para registrar",
        description: "Preencha ao menos uma informação antes de enviar.",
      });
      return;
    }

    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc("registrar_lancamento_prontuario", {
        p_residente_id: residenteId,
        p_funcionario_id: funcionarioId,
        p_conteudo: dadosPreenchidos,
        p_titulo: "Lançamento do prontuário",
      });

      if (error) throw error;

      const resultado = data?.[0];
      if (!resultado?.success) {
        toast({
          title: "Não foi possível registrar",
          description: resultado?.message || "Erro desconhecido",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Registro enviado",
        description: "As informações foram gravadas e não podem mais ser alteradas.",
      });

      setValores({});
      localStorage.removeItem(chaveRascunho);
      setCicloId(resultado.ciclo_id);
      setCicloStatus("em_andamento");
      onStatusChange?.(residenteId, "em_andamento", resultado.ciclo_id);
      await carregarRegistros(resultado.ciclo_id);
    } catch (error: any) {
      console.error("Erro ao registrar lançamento:", error);
      toast({
        title: "Erro ao registrar",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  };

  const registrarRetificacao = async (registroId: string, texto: string, justificativa: string) => {
    try {
      const { data, error } = await supabase.rpc("registrar_lancamento_prontuario", {
        p_residente_id: residenteId,
        p_funcionario_id: funcionarioId,
        p_conteudo: { texto },
        p_titulo: "Retificação",
        p_retifica_id: registroId,
        p_justificativa: justificativa,
      });

      if (error) throw error;

      const resultado = data?.[0];
      if (!resultado?.success) {
        toast({
          title: "Não foi possível retificar",
          description: resultado?.message || "Erro desconhecido",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Retificação registrada", description: "A correção foi adicionada ao prontuário." });
      if (resultado.ciclo_id) await carregarRegistros(resultado.ciclo_id);
    } catch (error: any) {
      console.error("Erro ao retificar:", error);
      toast({
        title: "Erro ao retificar",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const renderCampoConfigurado = (campo: any, valor: any, onChange: (valor: any) => void) => {
    const isDisabled = !cicloAberto;

    switch (campo.tipo) {
      case "text":
        return (
          <div key={campo.id} className="space-y-2">
            <Label htmlFor={campo.id} className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={campo.id}
              placeholder={campo.placeholder || ""}
              value={valor || ""}
              onChange={(e) => onChange(e.target.value)}
              className="mt-1 text-sm sm:text-base"
              disabled={isDisabled}
            />
          </div>
        );

      case "textarea":
        return (
          <div key={campo.id} className="space-y-2">
            <Label htmlFor={campo.id} className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={campo.id}
              placeholder={campo.placeholder || ""}
              value={valor || ""}
              onChange={(e) => onChange(e.target.value)}
              className="mt-1 min-h-[80px] text-sm sm:text-base resize-none"
              rows={campo.configuracoes?.rows || 3}
              disabled={isDisabled}
            />
          </div>
        );

      case "radio":
        return (
          <div key={campo.id} className="space-y-2">
            <Label className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup
              value={valor || ""}
              onValueChange={(value) => onChange(value)}
              className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2"
              disabled={isDisabled}
            >
              {(campo.opcoes || []).map((opcao: string) => (
                <div key={opcao} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                  <RadioGroupItem value={opcao} id={`${campo.id}_${opcao}`} disabled={isDisabled} />
                  <Label htmlFor={`${campo.id}_${opcao}`} className="text-sm flex-1 cursor-pointer">
                    {opcao}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case "checkbox":
        return (
          <div key={campo.id} className="space-y-2">
            <Label className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-3">
              {(campo.opcoes || []).map((opcao: string) => (
                <div key={opcao} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                  <Checkbox
                    id={`${campo.id}_${opcao}`}
                    checked={Array.isArray(valor) ? valor.includes(opcao) : false}
                    onCheckedChange={(checked) => {
                      const atual = Array.isArray(valor) ? valor : [];
                      onChange(checked ? [...atual, opcao] : atual.filter((i: string) => i !== opcao));
                    }}
                    disabled={isDisabled}
                  />
                  <Label htmlFor={`${campo.id}_${opcao}`} className="text-sm flex-1 cursor-pointer">
                    {opcao}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case "slider":
        return (
          <div key={campo.id} className="space-y-2">
            <Label className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="mt-3 px-2">
              <Slider
                value={Array.isArray(valor) ? valor : [campo.configuracoes?.min || 0]}
                onValueChange={(novoValor) => onChange(novoValor)}
                max={campo.configuracoes?.max || 100}
                min={campo.configuracoes?.min || 0}
                step={campo.configuracoes?.step || 1}
                className="w-full touch-pan-x"
                disabled={isDisabled}
              />
              <div className="flex justify-between text-xs sm:text-sm text-muted-foreground mt-2">
                <span>{campo.configuracoes?.min || 0}</span>
                <span className="font-medium">
                  Valor: {Array.isArray(valor) ? valor[0] : campo.configuracoes?.min || 0}
                </span>
                <span>{campo.configuracoes?.max || 100}</span>
              </div>
            </div>
          </div>
        );

      case "select":
        return (
          <div key={campo.id} className="space-y-2">
            <Label className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={valor || ""} onValueChange={(value) => onChange(value)} disabled={isDisabled}>
              <SelectTrigger className="mt-1 text-sm sm:text-base">
                <SelectValue placeholder={isDisabled ? "Prontuário encerrado" : "Selecione uma opção"} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {(campo.opcoes || []).map((opcao: string) => (
                  <SelectItem key={opcao} value={opcao} className="text-sm sm:text-base">
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      default:
        return null;
    }
  };

  if (!funcionarioId) return null;

  const camposPorSecao = camposConfigurados.reduce((acc: any, campo: any) => {
    (acc[campo.secao] = acc[campo.secao] || []).push(campo);
    return acc;
  }, {});

  return (
    <div className="space-y-4 sm:space-y-6 pb-28 sm:pb-24">
      {/* Cabeçalho */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b p-2 sm:p-4 z-50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            {onVoltar && (
              <Button variant="ghost" size="sm" onClick={onVoltar} className="flex-shrink-0">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline sm:ml-2">Outro residente</span>
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold truncate">Prontuário do dia</h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {residenteData?.nome_completo || "Carregando..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs sm:text-sm flex-shrink-0">
            {cicloAberto ? (
              <span className="flex items-center gap-1 text-emerald-700">
                <Unlock className="w-4 h-4" />
                <span className="hidden sm:inline">Aberto até 23h59</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Encerrado</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Identificação do residente */}
      <Card className="mx-2 sm:mx-0">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
            Identificação do Idoso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div>
            <Label className="text-sm font-medium">Nome completo</Label>
            <div className="mt-1 p-2 sm:p-3 bg-muted rounded-md text-xs sm:text-sm break-words">
              {residenteData?.nome_completo || "Carregando..."}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Data de nascimento</Label>
            <div className="mt-1 p-2 sm:p-3 bg-muted rounded-md text-xs sm:text-sm">
              {residenteData?.data_nascimento
                ? new Date(`${residenteData.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR")
                : "Não informado"}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Contato de emergência</Label>
            <div className="mt-1 p-2 sm:p-3 bg-muted rounded-md text-xs sm:text-sm">
              {residenteData?.responsavel_nome && residenteData?.responsavel_telefone
                ? `${residenteData.responsavel_nome} - ${residenteData.responsavel_telefone}`
                : "Não informado"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linha do tempo dos lançamentos */}
      <LinhaTempoProntuario
        lancamentos={linhaTempo}
        rotulos={rotulos}
        permitirRetificacao={cicloAberto}
        onRetificar={registrarRetificacao}
      />

      {!cicloAberto && (
        <div className="bg-muted border rounded-lg p-3 sm:p-4 mx-2 sm:mx-0 flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-xs sm:text-sm text-muted-foreground">
            Este prontuário foi encerrado e está disponível apenas para leitura.
          </p>
        </div>
      )}

      {/* Formulário de novo lançamento */}
      {cicloAberto && (
        <>
          {Object.keys(camposPorSecao).length > 0 ? (
            ordemSecoes
              .filter((secao) => camposPorSecao[secao])
              .map((secao) => {
                const campos = camposPorSecao[secao];
                const Icone = iconesSecao[secao] || FileText;
                const titulo = titulosSecao[secao] || secao;

                return (
                  <Card key={secao} className="mx-2 sm:mx-0">
                    <CardHeader className="pb-3 sm:pb-4">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Icone className="w-4 h-4 sm:w-5 sm:h-5" />
                        {titulo}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 sm:space-y-6">
                      {campos
                        .sort((a: any, b: any) => a.ordem - b.ordem)
                        .map((campo: any) => {
                          const chave = `campo_${campo.id}`;
                          return renderCampoConfigurado(campo, valores[chave], (novoValor) =>
                            setCampo(chave, novoValor),
                          );
                        })}
                    </CardContent>
                  </Card>
                );
              })
          ) : (
            <Card className="mx-2 sm:mx-0">
              <CardContent className="p-6 sm:p-8 text-center">
                <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-base sm:text-lg font-medium mb-2">Configuração não encontrada</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Nenhum campo foi configurado para o formulário.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Barra fixa de envio */}
      {cicloAberto && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-3 sm:p-4 safe-area-pb">
          <div className="max-w-screen-xl mx-auto space-y-2">
            <p className="text-[11px] sm:text-xs text-muted-foreground text-center">
              Ao enviar, as informações ficam gravadas com seu nome e horário e não podem mais ser
              alteradas. Correções são feitas por retificação.
            </p>
            <Button
              onClick={enviarLancamento}
              disabled={enviando || loading || Object.keys(dadosPreenchidos).length === 0}
              className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold"
              size="lg"
            >
              <Send className="w-4 h-4 mr-2" />
              {enviando ? "Enviando..." : "Registrar informações"}
            </Button>
          </div>
        </div>
      )}

      <AssistenteProntuarioIA
        residenteId={residenteId}
        funcionarioId={funcionarioId}
        residenteNome={residenteData?.nome_completo}
      />
    </div>
  );
}
