import { useState } from "react";
import { Trophy, Users, Gift, Award, Plus, Check, X, Coins, Star, Flame, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useGamificacaoAdmin, calcularNivel, getNivelConfig, getProgressoNivel, GamificationNivel } from "@/hooks/useGamificacao";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatarDataHora } from "@/utils/dateUtils";

const NIVEL_ICONS: Record<string, string> = {
  bronze: '🥉', prata: '🥈', ouro: '🥇', diamante: '💎',
};

const PENALIDADES = [
  { tipo: 'plantao', label: 'Plantão Trabalhado', xp: 10, moedas: 10, positivo: true },
  { tipo: 'micro_tarefa_ponto', label: 'Ponto Batido Corretamente', xp: 2, moedas: 2, positivo: true },
  { tipo: 'micro_tarefa_prontuario', label: 'Prontuário Completo', xp: 3, moedas: 3, positivo: true },
  { tipo: 'falta_injustificada', label: 'Falta Injustificada', xp: -100, moedas: -100, positivo: false },
  { tipo: 'advertencia_verbal', label: 'Advertência Verbal', xp: -50, moedas: -50, positivo: false },
  { tipo: 'advertencia_escrita', label: 'Advertência Escrita', xp: -150, moedas: -150, positivo: false },
  { tipo: 'suspensao', label: 'Suspensão (por dia)', xp: -500, moedas: -500, positivo: false },
];

export default function GestaoGamificacao() {
  const { profiles, resgatesPendentes, rewards, loading, aprovarResgate, rejeitarResgate, aplicarPontuacao, criarPremio, atualizarPremio, deletarPremio, refetch } = useGamificacaoAdmin();
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [showPontuacao, setShowPontuacao] = useState(false);
  const [showPremio, setShowPremio] = useState(false);
  const [selectedFuncionario, setSelectedFuncionario] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [xpCustom, setXpCustom] = useState('');
  const [moedasCustom, setMoedasCustom] = useState('');
  const [premioForm, setPremioForm] = useState({ nome: '', descricao: '', custo_moedas: '', nivel_minimo: 'bronze' as GamificationNivel, tipo: 'voucher' });

  const loadFuncionarios = async () => {
    const { data } = await supabase.from('funcionarios').select('id, nome_completo, funcao').eq('ativo', true).order('nome_completo');
    if (data) setFuncionarios(data);
  };

  const handleAbrirPontuacao = () => {
    loadFuncionarios();
    setShowPontuacao(true);
  };

  const handleAplicarPontuacao = async () => {
    if (!selectedFuncionario || !selectedTipo) {
      toast.error('Selecione funcionário e tipo');
      return;
    }
    const pen = PENALIDADES.find(p => p.tipo === selectedTipo);
    const xp = xpCustom ? parseInt(xpCustom) : (pen?.xp ?? 0);
    const moedas = moedasCustom ? parseInt(moedasCustom) : (pen?.moedas ?? 0);
    const desc = descricao || pen?.label || selectedTipo;

    await aplicarPontuacao(selectedFuncionario, selectedTipo, xp, moedas, desc);
    toast.success('Pontuação aplicada com sucesso!');
    setShowPontuacao(false);
    setSelectedFuncionario('');
    setSelectedTipo('');
    setDescricao('');
    setXpCustom('');
    setMoedasCustom('');
  };

  const handleCriarPremio = async () => {
    if (!premioForm.nome || !premioForm.custo_moedas) {
      toast.error('Preencha nome e custo');
      return;
    }
    await criarPremio({
      nome: premioForm.nome,
      descricao: premioForm.descricao,
      custo_moedas: parseInt(premioForm.custo_moedas),
      nivel_minimo: premioForm.nivel_minimo,
      tipo: premioForm.tipo,
      ativo: true,
    });
    toast.success('Prêmio criado!');
    setShowPremio(false);
    setPremioForm({ nome: '', descricao: '', custo_moedas: '', nivel_minimo: 'bronze', tipo: 'voucher' });
  };

  if (loading) {
    return <div className="container mx-auto p-6"><p>Carregando...</p></div>;
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-500" /> Gamificação de Desempenho
          </h1>
          <p className="text-muted-foreground">Gestão do sistema de pontuação e prêmios</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAbrirPontuacao} variant="outline">
            <TrendingUp className="w-4 h-4 mr-2" /> Lançar Pontuação
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{profiles.length}</p>
            <p className="text-xs text-muted-foreground">Funcionários</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Gift className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold">{resgatesPendentes.length}</p>
            <p className="text-xs text-muted-foreground">Resgates Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
            <p className="text-2xl font-bold">{profiles.filter(p => calcularNivel(p.xp_total) === 'diamante').length}</p>
            <p className="text-xs text-muted-foreground">Nível Diamante</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Flame className="w-8 h-8 mx-auto mb-2 text-orange-500" />
            <p className="text-2xl font-bold">{profiles.length > 0 ? Math.max(...profiles.map(p => p.streak_plantoes)) : 0}</p>
            <p className="text-xs text-muted-foreground">Maior Streak</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ranking">
        <TabsList>
          <TabsTrigger value="ranking"><Users className="w-4 h-4 mr-1" /> Ranking</TabsTrigger>
          <TabsTrigger value="resgates"><Gift className="w-4 h-4 mr-1" /> Resgates ({resgatesPendentes.length})</TabsTrigger>
          <TabsTrigger value="premios"><Award className="w-4 h-4 mr-1" /> Catálogo</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead className="text-right">XP</TableHead>
                    <TableHead className="text-right">Moedas</TableHead>
                    <TableHead className="text-right">Streak</TableHead>
                    <TableHead>Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p, i) => {
                    const nivel = calcularNivel(p.xp_total);
                    const prog = getProgressoNivel(p.xp_total);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-bold">{i + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{(p as any).funcionarios?.nome_completo || '—'}</p>
                            <p className="text-xs text-muted-foreground">{(p as any).funcionarios?.funcao || ''}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" style={{ borderColor: getNivelConfig(nivel).color }}>
                            {NIVEL_ICONS[nivel]} {getNivelConfig(nivel).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">{p.xp_total.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{p.moedas.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Flame className="w-3 h-3 text-orange-500" /> {p.streak_plantoes}
                          </span>
                        </TableCell>
                        <TableCell className="w-32">
                          <Progress value={prog.progresso} className="h-2" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {profiles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum funcionário com perfil de gamificação.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resgates" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {resgatesPendentes.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum resgate pendente.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Prêmio</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resgatesPendentes.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{r.funcionarios?.nome_completo || '—'}</TableCell>
                        <TableCell>{r.gamification_rewards?.nome || '—'}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Coins className="w-3 h-3 text-amber-500" /> {r.gamification_rewards?.custo_moedas}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{formatarDataHora(r.created_at)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" className="text-green-600" onClick={() => { aprovarResgate(r.id); toast.success('Resgate aprovado!'); }}>
                            <Check className="w-3 h-3 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => { rejeitarResgate(r.id); toast.info('Resgate rejeitado.'); }}>
                            <X className="w-3 h-3 mr-1" /> Rejeitar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="premios" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowPremio(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Prêmio
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{r.nome}</h3>
                      <p className="text-sm text-muted-foreground">{r.descricao}</p>
                    </div>
                    <Badge variant="outline">{NIVEL_ICONS[r.nivel_minimo]} {getNivelConfig(r.nivel_minimo).label}+</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="flex items-center gap-1 font-bold text-amber-600">
                      <Coins className="w-4 h-4" /> {r.custo_moedas} moedas
                    </span>
                    <Button size="sm" variant="ghost" className="text-red-500 text-xs" onClick={() => { deletarPremio(r.id); toast.info('Prêmio desativado.'); }}>
                      Desativar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Lançar Pontuação */}
      <Dialog open={showPontuacao} onOpenChange={setShowPontuacao}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lançar Pontuação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário</Label>
              <Select value={selectedFuncionario} onValueChange={setSelectedFuncionario}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {funcionarios.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome_completo} — {f.funcao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={selectedTipo} onValueChange={(v) => {
                setSelectedTipo(v);
                const pen = PENALIDADES.find(p => p.tipo === v);
                if (pen) { setXpCustom(String(pen.xp)); setMoedasCustom(String(pen.moedas)); }
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PENALIDADES.map(p => (
                    <SelectItem key={p.tipo} value={p.tipo}>
                      {p.positivo ? '✅' : '❌'} {p.label} ({p.xp > 0 ? '+' : ''}{p.xp} XP)
                    </SelectItem>
                  ))}
                  <SelectItem value="bonus_manual">⭐ Bônus Manual</SelectItem>
                  <SelectItem value="penalidade_manual">🔻 Penalidade Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>XP</Label>
                <Input type="number" value={xpCustom} onChange={e => setXpCustom(e.target.value)} />
              </div>
              <div>
                <Label>Moedas</Label>
                <Input type="number" value={moedasCustom} onChange={e => setMoedasCustom(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Motivo ou observações..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPontuacao(false)}>Cancelar</Button>
            <Button onClick={handleAplicarPontuacao}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Novo Prêmio */}
      <Dialog open={showPremio} onOpenChange={setShowPremio}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Prêmio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={premioForm.nome} onChange={e => setPremioForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={premioForm.descricao} onChange={e => setPremioForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Custo (Moedas)</Label>
                <Input type="number" value={premioForm.custo_moedas} onChange={e => setPremioForm(p => ({ ...p, custo_moedas: e.target.value }))} />
              </div>
              <div>
                <Label>Nível Mínimo</Label>
                <Select value={premioForm.nivel_minimo} onValueChange={v => setPremioForm(p => ({ ...p, nivel_minimo: v as GamificationNivel }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">🥉 Bronze</SelectItem>
                    <SelectItem value="prata">🥈 Prata</SelectItem>
                    <SelectItem value="ouro">🥇 Ouro</SelectItem>
                    <SelectItem value="diamante">💎 Diamante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={premioForm.tipo} onValueChange={v => setPremioForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voucher">Voucher</SelectItem>
                  <SelectItem value="folga">Folga</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPremio(false)}>Cancelar</Button>
            <Button onClick={handleCriarPremio}>Criar Prêmio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
