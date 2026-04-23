import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Activity, AlertTriangle, Mail } from "lucide-react";
import { toast } from "sonner";

interface LinhaUso {
  id: string;
  tenant_id: string;
  tenant_nome: string;
  data_referencia: string;
  funcionarios_ativos: number;
  residentes_ativos: number;
  usuarios_admin: number;
  registros_ponto_mes: number;
  consultas_ia_mes: number;
  atualizado_em: string;
  limite_funcionarios?: number | null;
  limite_residentes?: number | null;
  limite_usuarios_admin?: number | null;
  plano_nome?: string;
}

interface Alerta {
  id: string;
  tenant_id: string;
  tenant_nome: string;
  recurso: string;
  percentual_atingido: number;
  data_referencia: string;
  email_destinatario: string | null;
  status: string;
  enviado_em: string;
}

function gerarMeses(qtd = 12): string[] {
  const out: string[] = [];
  const hoje = new Date();
  for (let i = 0; i < qtd; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return out;
}

function pctClasse(pct: number) {
  if (pct >= 100) return "bg-destructive text-destructive-foreground";
  if (pct >= 80) return "bg-orange-500 text-white";
  if (pct >= 50) return "bg-yellow-500 text-foreground";
  return "bg-muted text-foreground";
}

function Barra({ atual, limite }: { atual: number; limite?: number | null }) {
  if (!limite || limite <= 0) return <span className="text-sm text-muted-foreground">{atual} / ∞</span>;
  const pct = Math.min(100, Math.round((atual / limite) * 100));
  return (
    <div className="space-y-1 min-w-[120px]">
      <div className="flex justify-between text-xs">
        <span>{atual} / {limite}</span>
        <Badge className={pctClasse(pct)} variant="secondary">{pct}%</Badge>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-orange-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AuditoriaUso() {
  const meses = gerarMeses();
  const [mes, setMes] = useState(meses[0]);
  const [linhas, setLinhas] = useState<LinhaUso[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [executando, setExecutando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [usoRes, tenantsRes, assinRes, alertasRes] = await Promise.all([
        supabase.from("tenant_uso").select("*").eq("data_referencia", mes),
        supabase.from("tenants").select("id, nome"),
        supabase.from("assinaturas").select("tenant_id, plano:planos(nome, limite_funcionarios, limite_residentes, limite_usuarios_admin)"),
        supabase.from("tenant_uso_alertas").select("*").eq("data_referencia", mes).order("enviado_em", { ascending: false }),
      ]);

      const tenantsMap = new Map((tenantsRes.data ?? []).map((t) => [t.id, t.nome]));
      const assinMap = new Map((assinRes.data ?? []).map((a: any) => [a.tenant_id, a.plano]));

      const linhasOk: LinhaUso[] = (usoRes.data ?? []).map((u: any) => {
        const plano = assinMap.get(u.tenant_id) as any;
        return {
          ...u,
          tenant_nome: tenantsMap.get(u.tenant_id) ?? "—",
          plano_nome: plano?.nome,
          limite_funcionarios: plano?.limite_funcionarios,
          limite_residentes: plano?.limite_residentes,
          limite_usuarios_admin: plano?.limite_usuarios_admin,
        };
      }).sort((a, b) => a.tenant_nome.localeCompare(b.tenant_nome));

      const alertasOk: Alerta[] = (alertasRes.data ?? []).map((a: any) => ({
        ...a,
        tenant_nome: tenantsMap.get(a.tenant_id) ?? "—",
      }));

      setLinhas(linhasOk);
      setAlertas(alertasOk);
    } catch (e: any) {
      toast.error("Falha ao carregar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [mes]);

  const recalcular = async () => {
    setExecutando(true);
    try {
      const { error } = await supabase.functions.invoke("atualizar-tenant-uso", { body: {} });
      if (error) throw error;
      toast.success("Snapshots atualizados.");
      await carregar();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setExecutando(false);
    }
  };

  const dispararAlertas = async () => {
    setExecutando(true);
    try {
      const { error } = await supabase.functions.invoke("verificar-limites-uso", { body: {} });
      if (error) throw error;
      toast.success("Verificação de limites disparada.");
      await carregar();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setExecutando(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Auditoria de uso
          </h1>
          <p className="text-sm text-muted-foreground">Histórico mensal de consumo de recursos por empresa.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>
                  {new Date(m).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={recalcular} disabled={executando}>
            <RefreshCw className={`w-4 h-4 mr-2 ${executando ? "animate-spin" : ""}`} />
            Recalcular
          </Button>
          <Button onClick={dispararAlertas} disabled={executando}>
            <Mail className="w-4 h-4 mr-2" />
            Verificar limites
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumo por empresa — {new Date(mes).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : linhas.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sem snapshots para este mês.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Funcionários</TableHead>
                    <TableHead>Residentes</TableHead>
                    <TableHead>Admins</TableHead>
                    <TableHead className="text-right">Pontos no mês</TableHead>
                    <TableHead className="text-right">Consultas IA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.tenant_nome}</TableCell>
                      <TableCell><Badge variant="outline">{l.plano_nome ?? "—"}</Badge></TableCell>
                      <TableCell><Barra atual={l.funcionarios_ativos} limite={l.limite_funcionarios} /></TableCell>
                      <TableCell><Barra atual={l.residentes_ativos} limite={l.limite_residentes} /></TableCell>
                      <TableCell><Barra atual={l.usuarios_admin} limite={l.limite_usuarios_admin} /></TableCell>
                      <TableCell className="text-right tabular-nums">{l.registros_ponto_mes}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.consultas_ia_mes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Alertas enviados no mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertas.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Nenhum alerta enviado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Atingido</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.tenant_nome}</TableCell>
                    <TableCell><Badge variant="outline">{a.recurso}</Badge></TableCell>
                    <TableCell>
                      <Badge className={pctClasse(a.percentual_atingido)}>
                        {a.percentual_atingido}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.email_destinatario ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "enviado" ? "default" : "destructive"}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(a.enviado_em).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}