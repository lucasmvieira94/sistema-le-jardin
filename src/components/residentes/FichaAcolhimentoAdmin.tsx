import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatarDataHora } from "@/utils/dateUtils";
import {
  Loader2,
  Link2,
  Copy,
  RefreshCw,
  CheckCircle2,
  ClipboardList,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  CAMPOS_HISTORICO_SAUDE,
  CAMPOS_HABITOS_ROTINA,
} from "./FichaAcolhimentoCampos";

interface Props {
  residenteId: string;
  residenteNome: string;
}

interface Ficha {
  id: string;
  status: string;
  token: string;
  data_expiracao_token: string;
  data_preenchimento: string | null;
  data_aprovacao: string | null;
  aceite_lgpd: boolean;
  data_aceite_lgpd: string | null;
  preenchido_por_nome: string | null;
  preenchido_por_cpf: string | null;
  preenchido_por_parentesco: string | null;
  preenchido_por_telefone: string | null;
  historico_saude: Record<string, string> | null;
  habitos_rotina: Record<string, string> | null;
  observacoes_admin: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  pendente: { label: "Aguardando preenchimento", variant: "outline" },
  preenchida: { label: "Preenchida — aguardando validação", variant: "secondary" },
  aprovada: { label: "Aprovada", variant: "default" },
};

export default function FichaAcolhimentoAdmin({ residenteId, residenteNome }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residenteId]);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fichas_acolhimento")
        .select("*")
        .eq("residente_id", residenteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setFichas((data as any) ?? []);
      const obs: Record<string, string> = {};
      (data ?? []).forEach((f: any) => { obs[f.id] = f.observacoes_admin ?? ""; });
      setObservacoes(obs);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const linkPublico = (token: string) =>
    `${window.location.origin}/ficha-acolhimento/${token}`;

  const gerarFicha = async () => {
    setActing(true);
    try {
      const { error } = await supabase
        .from("fichas_acolhimento")
        .insert({ residente_id: residenteId });
      if (error) throw error;
      toast({ title: "Ficha criada", description: "Link para preenchimento gerado com validade de 7 dias." });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao criar ficha", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const renovarLink = async (id: string) => {
    setActing(true);
    try {
      const novaExp = new Date();
      novaExp.setDate(novaExp.getDate() + 7);
      const { error } = await supabase
        .from("fichas_acolhimento")
        .update({ data_expiracao_token: novaExp.toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Link renovado por mais 7 dias" });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const aprovar = async (id: string) => {
    setActing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("fichas_acolhimento")
        .update({
          status: "aprovada",
          data_aprovacao: new Date().toISOString(),
          aprovado_por: userData.user?.id ?? null,
          observacoes_admin: observacoes[id] ?? null,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Ficha aprovada", description: "O link público foi bloqueado para edição." });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const copiarLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkPublico(token));
      toast({ title: "Link copiado!" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Ficha de Acolhimento — {residenteNome}
          </h3>
          <p className="text-sm text-muted-foreground">
            Envie o link à família. O link expira em 7 dias e fica bloqueado após a aprovação.
          </p>
        </div>
        <Button onClick={gerarFicha} disabled={acting} size="sm">
          {acting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Nova ficha
        </Button>
      </div>

      {fichas.length === 0 && (
        <Alert>
          <AlertDescription>
            Nenhuma ficha de acolhimento gerada para este residente. Clique em "Nova ficha" para criar um link de preenchimento.
          </AlertDescription>
        </Alert>
      )}

      {fichas.map((f) => {
        const expirado = new Date(f.data_expiracao_token).getTime() < Date.now();
        const badge = STATUS_BADGE[f.status] ?? STATUS_BADGE.pendente;
        return (
          <Card key={f.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Ficha de {formatarDataHora(f.created_at)}
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {expirado && f.status !== "aprovada" && (
                    <Badge variant="destructive">Link expirado</Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Link público */}
              {f.status !== "aprovada" && (
                <div className="bg-muted/40 border rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Link2 className="w-4 h-4" /> Link para o responsável
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 break-all">
                      {linkPublico(f.token)}
                    </code>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copiarLink(f.token)}>
                        <Copy className="w-4 h-4 mr-1" /> Copiar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => renovarLink(f.id)} disabled={acting}>
                        <RefreshCw className="w-4 h-4 mr-1" /> Renovar 7d
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Expira em: {formatarDataHora(f.data_expiracao_token)}
                  </p>
                </div>
              )}

              {/* LGPD */}
              {f.aceite_lgpd && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                  LGPD aceito em {f.data_aceite_lgpd ? formatarDataHora(f.data_aceite_lgpd) : "—"}
                </div>
              )}

              {/* Conteúdo preenchido */}
              {f.status !== "pendente" && (
                <>
                  <Separator />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">Responsável que preencheu:</p>
                    <p className="text-muted-foreground">
                      {f.preenchido_por_nome ?? "—"}
                      {f.preenchido_por_parentesco ? ` (${f.preenchido_por_parentesco})` : ""}
                      {f.preenchido_por_cpf ? ` — CPF ${f.preenchido_por_cpf}` : ""}
                      {f.preenchido_por_telefone ? ` — ${f.preenchido_por_telefone}` : ""}
                    </p>
                    {f.data_preenchimento && (
                      <p className="text-xs text-muted-foreground">
                        Enviada em: {formatarDataHora(f.data_preenchimento)}
                      </p>
                    )}
                  </div>

                  <SecaoVisualizacao titulo="Histórico de saúde e medicamentos" campos={CAMPOS_HISTORICO_SAUDE} dados={f.historico_saude ?? {}} />
                  <SecaoVisualizacao titulo="Hábitos, preferências e rotina" campos={CAMPOS_HABITOS_ROTINA} dados={f.habitos_rotina ?? {}} />
                </>
              )}

              {/* Aprovação */}
              {f.status === "preenchida" && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Observações da equipe (opcional)</Label>
                    <Textarea
                      value={observacoes[f.id] ?? ""}
                      onChange={(e) => setObservacoes({ ...observacoes, [f.id]: e.target.value })}
                      maxLength={1000}
                      rows={2}
                    />
                    <Button onClick={() => aprovar(f.id)} disabled={acting} size="sm">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Aprovar e bloquear ficha
                    </Button>
                  </div>
                </>
              )}

              {f.status === "aprovada" && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Ficha aprovada em {f.data_aprovacao ? formatarDataHora(f.data_aprovacao) : "—"}.
                    {f.observacoes_admin && (
                      <div className="mt-2 text-sm"><strong>Observações:</strong> {f.observacoes_admin}</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SecaoVisualizacao({
  titulo,
  campos,
  dados,
}: {
  titulo: string;
  campos: { key: string; label: string }[];
  dados: Record<string, string>;
}) {
  const preenchidos = campos.filter((c) => dados[c.key]?.trim());
  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">{titulo}</p>
      {preenchidos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum campo preenchido nesta seção.</p>
      ) : (
        <div className="grid gap-2">
          {preenchidos.map((c) => (
            <div key={c.key} className="bg-muted/30 border rounded p-2 text-sm">
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <p className="whitespace-pre-line">{dados[c.key]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}