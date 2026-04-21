import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useFolhaPonto } from "@/hooks/useFolhaPonto";
import { calcularNivel, getNivelConfig, getProgressoNivel } from "@/hooks/useGamificacao";
import HistoricoAdvertencias from "@/components/advertencias/HistoricoAdvertencias";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Loader2, User, Calendar, Clock, Shield, Trophy, FileText, AlertTriangle, Briefcase, Edit } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type FuncionarioCompleto = {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  telefone: string | null;
  funcao: string;
  data_admissao: string;
  data_nascimento: string;
  codigo_4_digitos: string;
  ativo: boolean;
  registra_ponto: boolean;
  acesso_supervisor: boolean;
  data_inicio_vigencia: string | null;
  escala_id: number | null;
  escalas?: { nome: string; entrada: string; saida: string; jornada_trabalho: string; intervalo_inicio: string | null; intervalo_fim: string | null } | null;
};

type Afastamento = {
  id: string;
  data_inicio: string;
  data_fim: string | null;
  tipo_periodo: string;
  quantidade_dias: number | null;
  observacoes: string | null;
  tipos_afastamento?: { descricao: string; remunerado: boolean } | null;
};

export default function FichaFuncionario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [funcionario, setFuncionario] = useState<FuncionarioCompleto | null>(null);
  const [afastamentos, setAfastamentos] = useState<Afastamento[]>([]);
  const [gamProfile, setGamProfile] = useState<any>(null);
  const [gamTransactions, setGamTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Folha de ponto
  const hoje = new Date();
  const [fpMes, setFpMes] = useState(hoje.getMonth() + 1);
  const [fpAno, setFpAno] = useState(hoje.getFullYear());
  const [fpEnabled, setFpEnabled] = useState(false);
  const { data: folhaPonto, isLoading: fpLoading } = useFolhaPonto(id || "", fpMes, fpAno, fpEnabled);

  useEffect(() => {
    if (!id) { navigate("/funcionarios"); return; }
    fetchAll();
  }, [id]);

  async function fetchAll() {
    setLoading(true);
    const [funcRes, afastRes, gamProfRes, gamTransRes] = await Promise.all([
      supabase.from("funcionarios").select("*, escalas(nome, entrada, saida, jornada_trabalho, intervalo_inicio, intervalo_fim)").eq("id", id!).single(),
      supabase.from("afastamentos").select("*, tipos_afastamento(descricao, remunerado)").eq("funcionario_id", id!).order("data_inicio", { ascending: false }),
      supabase.from("gamification_profiles").select("*").eq("funcionario_id", id!).maybeSingle(),
      supabase.from("gamification_transactions").select("*").eq("funcionario_id", id!).order("created_at", { ascending: false }).limit(20),
    ]);
    if (funcRes.data) setFuncionario(funcRes.data as any);
    else { navigate("/funcionarios"); return; }
    setAfastamentos((afastRes.data || []) as any);
    if (gamProfRes.data) setGamProfile(gamProfRes.data);
    setGamTransactions((gamTransRes.data || []) as any);
    setLoading(false);
  }

  if (roleLoading || loading) {
    return <div className="container mx-auto max-w-5xl py-10 flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" /> Carregando ficha...</div>;
  }

  if (!isAdmin || !funcionario) {
    navigate("/funcionarios");
    return null;
  }

  const formatDate = (d: string) => {
    try { return format(new Date(d + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
  };

  const nivelInfo = gamProfile ? getProgressoNivel(gamProfile.xp_total) : null;
  const nivelConfig = nivelInfo ? getNivelConfig(nivelInfo.nivel) : null;

  return (
    <div className="container mx-auto max-w-5xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/funcionarios")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{funcionario.nome_completo}</h1>
            <Badge variant={funcionario.ativo ? "default" : "destructive"}>
              {funcionario.ativo ? "Ativo" : "Desligado"}
            </Badge>
          </div>
          <p className="text-muted-foreground">{funcionario.funcao} {funcionario.escalas ? `• ${funcionario.escalas.nome}` : ""}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/funcionarios/${id}/editar`)}>
          <Edit className="w-4 h-4 mr-2" /> Editar
        </Button>
      </div>

      <Tabs defaultValue="cadastro">
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="cadastro" className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Cadastro</TabsTrigger>
          <TabsTrigger value="escala" className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Escala</TabsTrigger>
          <TabsTrigger value="afastamentos" className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> Afastamentos</TabsTrigger>
          <TabsTrigger value="advertencias" className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Disciplinar</TabsTrigger>
          <TabsTrigger value="folha" className="flex items-center gap-1" onClick={() => setFpEnabled(true)}><FileText className="w-3.5 h-3.5" /> Folha de Ponto</TabsTrigger>
          <TabsTrigger value="gamificacao" className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Desempenho</TabsTrigger>
        </TabsList>

        {/* CADASTRO */}
        <TabsContent value="cadastro">
          <Card>
            <CardHeader><CardTitle className="text-lg">Informações Cadastrais</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <Info label="Nome Completo" value={funcionario.nome_completo} />
                <Info label="CPF" value={funcionario.cpf} />
                <Info label="E-mail" value={funcionario.email} />
                <Info label="Telefone" value={funcionario.telefone || "—"} />
                <Info label="Função" value={funcionario.funcao} />
                <Info label="Data de Nascimento" value={formatDate(funcionario.data_nascimento)} />
                <Info label="Data de Admissão" value={formatDate(funcionario.data_admissao)} />
                <Info label="Início de Vigência" value={funcionario.data_inicio_vigencia ? formatDate(funcionario.data_inicio_vigencia) : "—"} />
                <Info label="Código de Acesso" value={funcionario.codigo_4_digitos} />
                <Info label="Registra Ponto" value={funcionario.registra_ponto ? "Sim" : "Não"} />
                <Info label="Acesso Supervisor" value={funcionario.acesso_supervisor ? "Sim" : "Não"} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ESCALA */}
        <TabsContent value="escala">
          <Card>
            <CardHeader><CardTitle className="text-lg">Escala de Trabalho</CardTitle></CardHeader>
            <CardContent>
              {funcionario.escalas ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <Info label="Nome da Escala" value={funcionario.escalas.nome} />
                  <Info label="Jornada" value={funcionario.escalas.jornada_trabalho} />
                  <Info label="Entrada" value={funcionario.escalas.entrada} />
                  <Info label="Saída" value={funcionario.escalas.saida} />
                  <Info label="Intervalo Início" value={funcionario.escalas.intervalo_inicio || "—"} />
                  <Info label="Intervalo Fim" value={funcionario.escalas.intervalo_fim || "—"} />
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-6">Nenhuma escala vinculada.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AFASTAMENTOS */}
        <TabsContent value="afastamentos">
          <Card>
            <CardHeader><CardTitle className="text-lg">Afastamentos ({afastamentos.length})</CardTitle></CardHeader>
            <CardContent>
              {afastamentos.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">Nenhum afastamento registrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {afastamentos.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>{(a as any).tipos_afastamento?.descricao || a.tipo_periodo}</TableCell>
                        <TableCell>{formatDate(a.data_inicio)}</TableCell>
                        <TableCell>{a.data_fim ? formatDate(a.data_fim) : "—"}</TableCell>
                        <TableCell>{a.quantidade_dias ?? "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{a.observacoes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVERTÊNCIAS */}
        <TabsContent value="advertencias">
          <Card>
            <CardContent className="pt-6">
              <HistoricoAdvertencias funcionarioId={id!} funcionarioNome={funcionario.nome_completo} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* FOLHA DE PONTO */}
        <TabsContent value="folha">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-lg">Folha de Ponto</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={String(fpMes)} onValueChange={v => { setFpMes(Number(v)); setFpEnabled(true); }}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {format(new Date(2024, i, 1), "MMMM", { locale: ptBR })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(fpAno)} onValueChange={v => { setFpAno(Number(v)); setFpEnabled(true); }}>
                    <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!fpEnabled ? (
                <p className="text-muted-foreground text-center py-6">Clique na aba para carregar a folha de ponto.</p>
              ) : fpLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground justify-center py-6"><Loader2 className="animate-spin w-4 h-4" /> Carregando...</div>
              ) : !folhaPonto?.dados?.length ? (
                <p className="text-muted-foreground text-center py-6">Nenhum registro para o período selecionado.</p>
              ) : (
                <>
                  {/* Resumo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <MiniCard label="Dias Trabalhados" value={folhaPonto.totais.dias_trabalhados} />
                    <MiniCard label="Horas Trabalhadas" value={folhaPonto.totais.total_horas_trabalhadas} />
                    <MiniCard label="HE Diurnas" value={folhaPonto.totais.total_horas_extras_diurnas} />
                    <MiniCard label="HE Noturnas" value={folhaPonto.totais.total_horas_extras_noturnas} />
                  </div>
                  <div className="overflow-auto max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dia</TableHead>
                          <TableHead>Entrada</TableHead>
                          <TableHead>Saída</TableHead>
                          <TableHead>Horas</TableHead>
                          <TableHead>Falta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {folhaPonto.dados.map((d, i) => (
                          <TableRow key={i}>
                            <TableCell>{String(d.dia).padStart(2, '0')}</TableCell>
                            <TableCell>{d.entrada || "—"}</TableCell>
                            <TableCell>{d.saida || "—"}</TableCell>
                            <TableCell>{d.horas_trabalhadas}</TableCell>
                            <TableCell>{d.faltas ? <Badge variant="destructive" className="text-xs">Falta</Badge> : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GAMIFICAÇÃO */}
        <TabsContent value="gamificacao">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Desempenho & Recompensas</CardTitle></CardHeader>
              <CardContent>
                {!gamProfile ? (
                  <p className="text-muted-foreground text-center py-6">Nenhum perfil de gamificação encontrado.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MiniCard label="XP Total" value={gamProfile.xp_total} />
                      <MiniCard label="Moedas" value={gamProfile.moedas} />
                      <MiniCard label="Streak" value={`${gamProfile.streak_plantoes} plantões`} />
                      <MiniCard label="Nível" value={nivelConfig?.label || "—"} />
                    </div>
                    {nivelInfo && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progresso para próximo nível</span>
                          <span>{nivelInfo.progresso}%</span>
                        </div>
                        <Progress value={nivelInfo.progresso} className="h-2" />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {gamTransactions.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Últimas Transações</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-auto">
                    {gamTransactions.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                        <div>
                          <p>{t.descricao}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                        </div>
                        <div className="flex gap-3 text-xs font-medium">
                          {t.xp_delta !== 0 && <span className={t.xp_delta > 0 ? "text-green-600" : "text-red-500"}>{t.xp_delta > 0 ? "+" : ""}{t.xp_delta} XP</span>}
                          {t.moedas_delta !== 0 && <span className={t.moedas_delta > 0 ? "text-green-600" : "text-red-500"}>{t.moedas_delta > 0 ? "+" : ""}{t.moedas_delta} 🪙</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{String(value)}</p>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
