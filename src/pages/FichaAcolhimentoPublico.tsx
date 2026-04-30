import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import {
  CAMPOS_HISTORICO_SAUDE,
  CAMPOS_HABITOS_ROTINA,
  TERMO_LGPD,
  type CampoFicha,
} from "@/components/residentes/FichaAcolhimentoCampos";

type Etapa = "lgpd" | "preenchimento" | "concluido" | "erro" | "aprovada";

interface FichaData {
  id: string;
  status: string;
  data_expiracao_token: string;
  residente_id: string;
  aceite_lgpd: boolean;
  preenchido_por_nome: string | null;
  preenchido_por_cpf: string | null;
  preenchido_por_parentesco: string | null;
  preenchido_por_telefone: string | null;
  historico_saude: Record<string, string> | null;
  habitos_rotina: Record<string, string> | null;
}

interface ResidenteInfo {
  nome_completo: string;
}

export default function FichaAcolhimentoPublico() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("lgpd");
  const [erro, setErro] = useState<string>("");
  const [ficha, setFicha] = useState<FichaData | null>(null);
  const [residente, setResidente] = useState<ResidenteInfo | null>(null);

  const [aceite, setAceite] = useState(false);
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respParentesco, setRespParentesco] = useState("");
  const [respTelefone, setRespTelefone] = useState("");
  const [historico, setHistorico] = useState<Record<string, string>>({});
  const [habitos, setHabitos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    carregarFicha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const carregarFicha = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fichas_acolhimento")
        .select("*")
        .eq("token", token!)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setErro("Link inválido ou inexistente.");
        setEtapa("erro");
        return;
      }

      const expirou = new Date(data.data_expiracao_token).getTime() < Date.now();
      if (expirou) {
        setErro("Este link expirou. Solicite um novo à instituição.");
        setEtapa("erro");
        return;
      }

      // Buscar nome do residente (RLS anon permite SELECT em residentes? — usamos rpc segura via select simples)
      const { data: res } = await supabase
        .from("residentes")
        .select("nome_completo")
        .eq("id", data.residente_id)
        .maybeSingle();

      setResidente(res ?? { nome_completo: "Residente" });
      setFicha(data as any);

      // Pré-popular se já houver dados
      setRespNome(data.preenchido_por_nome ?? "");
      setRespCpf(data.preenchido_por_cpf ?? "");
      setRespParentesco(data.preenchido_por_parentesco ?? "");
      setRespTelefone(data.preenchido_por_telefone ?? "");
      setHistorico((data.historico_saude as any) ?? {});
      setHabitos((data.habitos_rotina as any) ?? {});
      setAceite(data.aceite_lgpd);

      if (data.status === "aprovada") {
        setEtapa("aprovada");
      } else if (data.aceite_lgpd) {
        setEtapa("preenchimento");
      } else {
        setEtapa("lgpd");
      }
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar ficha.");
      setEtapa("erro");
    } finally {
      setLoading(false);
    }
  };

  const aceitarLgpd = async () => {
    if (!aceite) {
      toast({ title: "Aceite obrigatório", description: "Você precisa concordar com o termo LGPD para prosseguir.", variant: "destructive" });
      return;
    }
    if (!ficha) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("fichas_acolhimento")
        .update({
          aceite_lgpd: true,
          data_aceite_lgpd: new Date().toISOString(),
        })
        .eq("id", ficha.id);
      if (error) throw error;
      setEtapa("preenchimento");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const salvar = async (finalizar: boolean) => {
    if (!ficha) return;
    if (finalizar) {
      if (!respNome.trim() || !respCpf.trim() || !respParentesco.trim()) {
        toast({ title: "Campos obrigatórios", description: "Informe nome, CPF e parentesco do responsável.", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const updates: any = {
        preenchido_por_nome: respNome.trim() || null,
        preenchido_por_cpf: respCpf.trim() || null,
        preenchido_por_parentesco: respParentesco.trim() || null,
        preenchido_por_telefone: respTelefone.trim() || null,
        historico_saude: historico,
        habitos_rotina: habitos,
      };
      if (finalizar) {
        updates.status = "preenchida";
        updates.data_preenchimento = new Date().toISOString();
      }
      const { error } = await supabase
        .from("fichas_acolhimento")
        .update(updates)
        .eq("id", ficha.id);
      if (error) throw error;

      if (finalizar) {
        setEtapa("concluido");
      } else {
        toast({ title: "Rascunho salvo", description: "Você pode voltar mais tarde para concluir." });
      }
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const renderCampo = (
    campo: CampoFicha,
    valores: Record<string, string>,
    setter: (v: Record<string, string>) => void,
  ) => {
    const valor = valores[campo.key] ?? "";
    if (campo.tipo === "textarea") {
      return (
        <div key={campo.key} className="space-y-2">
          <Label>{campo.label}</Label>
          <Textarea
            value={valor}
            placeholder={campo.placeholder}
            onChange={(e) => setter({ ...valores, [campo.key]: e.target.value })}
            maxLength={2000}
            rows={3}
          />
        </div>
      );
    }
    if (campo.tipo === "select") {
      return (
        <div key={campo.key} className="space-y-2">
          <Label>{campo.label}</Label>
          <Select value={valor} onValueChange={(v) => setter({ ...valores, [campo.key]: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {campo.opcoes!.map((op) => (
                <SelectItem key={op} value={op}>{op}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    return (
      <div key={campo.key} className="space-y-2">
        <Label>{campo.label}</Label>
        <Input
          value={valor}
          placeholder={campo.placeholder}
          onChange={(e) => setter({ ...valores, [campo.key]: e.target.value })}
          maxLength={500}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <FileText className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Ficha de Acolhimento</h1>
          {residente && (
            <p className="text-muted-foreground">Residente: <span className="font-semibold">{residente.nome_completo}</span></p>
          )}
        </div>

        {etapa === "erro" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não foi possível abrir a ficha</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {etapa === "aprovada" && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Ficha já aprovada</AlertTitle>
            <AlertDescription>
              Esta ficha já foi validada pela equipe da instituição. Para alterações, entre em contato com o responsável administrativo.
            </AlertDescription>
          </Alert>
        )}

        {etapa === "concluido" && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Ficha enviada com sucesso!</AlertTitle>
            <AlertDescription>
              Recebemos as informações. Você ainda pode editar este formulário enquanto nossa equipe não validar o conteúdo.
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setEtapa("preenchimento")}>
                  Voltar e revisar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {etapa === "lgpd" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Condições gerais e LGPD
              </CardTitle>
              <CardDescription>Leia atentamente antes de prosseguir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 border rounded-md p-4 max-h-[400px] overflow-y-auto whitespace-pre-line text-sm leading-relaxed">
                {TERMO_LGPD}
              </div>
              <div className="flex items-start gap-3">
                <Checkbox id="aceite" checked={aceite} onCheckedChange={(c) => setAceite(!!c)} />
                <Label htmlFor="aceite" className="text-sm leading-snug cursor-pointer">
                  Li, compreendi e concordo com os termos acima, autorizando o tratamento dos dados pessoais e sensíveis para as finalidades descritas.
                </Label>
              </div>
              <Button onClick={aceitarLgpd} disabled={!aceite || saving} className="w-full">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Concordar e prosseguir
              </Button>
            </CardContent>
          </Card>
        )}

        {etapa === "preenchimento" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Identificação do responsável</CardTitle>
                <CardDescription>Quem está preenchendo esta ficha?</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <Input value={respNome} onChange={(e) => setRespNome(e.target.value)} maxLength={150} />
                </div>
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input value={respCpf} onChange={(e) => setRespCpf(e.target.value)} maxLength={14} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Parentesco / vínculo *</Label>
                  <Input value={respParentesco} onChange={(e) => setRespParentesco(e.target.value)} maxLength={50} placeholder="Filho(a), cônjuge..." />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={respTelefone} onChange={(e) => setRespTelefone(e.target.value)} maxLength={20} placeholder="(00) 00000-0000" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de saúde e medicamentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {CAMPOS_HISTORICO_SAUDE.map((c) => renderCampo(c, historico, setHistorico))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hábitos, preferências e rotina</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {CAMPOS_HABITOS_ROTINA.map((c) => renderCampo(c, habitos, setHabitos))}
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4">
              <Button variant="outline" onClick={() => salvar(false)} disabled={saving} className="flex-1">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar rascunho
              </Button>
              <Button onClick={() => salvar(true)} disabled={saving} className="flex-1">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar ficha à instituição
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}