import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Coins, Flame, Star, Gift, History, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useGamificacaoProfile, calcularNivel, getNivelConfig, getProgressoNivel, GamificationReward } from "@/hooks/useGamificacao";
import { toast } from "sonner";
import { formatarDataHora } from "@/utils/dateUtils";

const NIVEL_ICONS: Record<string, string> = {
  bronze: '🥉',
  prata: '🥈',
  ouro: '🥇',
  diamante: '💎',
};

export default function Gamificacao() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const funcionarioId = searchParams.get("funcionario_id");
  const funcionarioNome = searchParams.get("funcionario_nome") || "";
  const { profile, transactions, rewards, resgates, loading, resgatarPremio } = useGamificacaoProfile(funcionarioId);
  const [selectedReward, setSelectedReward] = useState<GamificationReward | null>(null);
  const [resgatando, setResgatando] = useState(false);

  if (!funcionarioId) {
    navigate("/");
    return null;
  }

  const xp = profile?.xp_total ?? 0;
  const moedas = profile?.moedas ?? 0;
  const streak = profile?.streak_plantoes ?? 0;
  const nivel = calcularNivel(xp);
  const nivelConfig = getNivelConfig(nivel);
  const progresso = getProgressoNivel(xp);
  const nivelOrdem = ['bronze', 'prata', 'ouro', 'diamante'];

  const handleResgate = async () => {
    if (!selectedReward) return;
    setResgatando(true);
    const result = await resgatarPremio(selectedReward.id);
    setResgatando(false);
    if (result.success) {
      toast.success("Resgate solicitado! Aguarde a aprovação do gestor.");
      setSelectedReward(null);
    } else {
      toast.error(result.error || "Erro ao solicitar resgate");
    }
  };

  const podeResgatar = (reward: GamificationReward) => {
    return nivelOrdem.indexOf(nivel) >= nivelOrdem.indexOf(reward.nivel_minimo) && moedas >= reward.custo_moedas;
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      plantao: '🏥 Plantão',
      micro_tarefa_ponto: '⏰ Ponto',
      micro_tarefa_prontuario: '📋 Prontuário',
      falta_injustificada: '❌ Falta',
      advertencia_verbal: '⚠️ Adv. Verbal',
      advertencia_escrita: '📝 Adv. Escrita',
      suspensao: '🚫 Suspensão',
      resgate: '🎁 Resgate',
      bonus_manual: '⭐ Bônus',
      penalidade_manual: '🔻 Penalidade',
    };
    return labels[tipo] || tipo;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 flex items-center justify-center">
        <div className="text-white text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/20">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" /> Meu Desempenho
            </h1>
            <p className="text-green-200 text-sm">{decodeURIComponent(funcionarioNome)}</p>
          </div>
        </div>

        {/* Cards de Status */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <CardContent className="p-3">
              <div className="text-3xl mb-1">{NIVEL_ICONS[nivel]}</div>
              <p className="text-xs text-muted-foreground">Nível</p>
              <p className="font-bold text-sm" style={{ color: nivelConfig.color }}>{nivelConfig.label}</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3">
              <Star className="w-7 h-7 mx-auto mb-1 text-yellow-500" />
              <p className="text-xs text-muted-foreground">XP Total</p>
              <p className="font-bold text-lg">{xp.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3">
              <Coins className="w-7 h-7 mx-auto mb-1 text-amber-500" />
              <p className="text-xs text-muted-foreground">Moedas</p>
              <p className="font-bold text-lg">{moedas.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Progresso */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium flex items-center gap-1">
                <Flame className="w-4 h-4 text-orange-500" />
                Streak: {streak} plantões
              </span>
              <span className="text-muted-foreground">
                {nivel !== 'diamante' 
                  ? `${xp} / ${progresso.xpProximo} XP`
                  : `${xp} XP — Nível máximo!`}
              </span>
            </div>
            <Progress value={progresso.progresso} className="h-3" />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">{NIVEL_ICONS[nivel]} {nivelConfig.label}</span>
              {nivel !== 'diamante' && (
                <span className="text-xs text-muted-foreground">
                  {NIVEL_ICONS[nivelOrdem[nivelOrdem.indexOf(nivel) + 1]]} {getNivelConfig(nivelOrdem[nivelOrdem.indexOf(nivel) + 1] as any).label}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="loja">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="loja" className="text-xs sm:text-sm"><ShoppingBag className="w-4 h-4 mr-1" /> Loja</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs sm:text-sm"><History className="w-4 h-4 mr-1" /> Histórico</TabsTrigger>
            <TabsTrigger value="resgates" className="text-xs sm:text-sm"><Gift className="w-4 h-4 mr-1" /> Resgates</TabsTrigger>
          </TabsList>

          <TabsContent value="loja" className="space-y-3 mt-3">
            {rewards.map(reward => {
              const pode = podeResgatar(reward);
              return (
                <Card key={reward.id} className={`${!pode ? 'opacity-60' : 'hover:shadow-md cursor-pointer'}`} onClick={() => pode && setSelectedReward(reward)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{reward.nome}</span>
                        <Badge variant="outline" className="text-xs">{NIVEL_ICONS[reward.nivel_minimo]} {getNivelConfig(reward.nivel_minimo).label}+</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{reward.descricao}</p>
                    </div>
                    <div className="text-right ml-3">
                      <div className="flex items-center gap-1 font-bold text-amber-600">
                        <Coins className="w-4 h-4" /> {reward.custo_moedas}
                      </div>
                      {!pode && (
                        <p className="text-xs text-red-500 mt-1">
                          {nivelOrdem.indexOf(nivel) < nivelOrdem.indexOf(reward.nivel_minimo) ? 'Nível insuficiente' : 'Moedas insuficientes'}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {rewards.length === 0 && <p className="text-center text-white/70 py-8">Nenhum prêmio disponível.</p>}
          </TabsContent>

          <TabsContent value="historico" className="mt-3">
            <Card>
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma transação registrada.</p>
                ) : (
                  <div className="divide-y">
                    {transactions.map(t => (
                      <div key={t.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{getTipoLabel(t.tipo)}</p>
                          <p className="text-xs text-muted-foreground">{t.descricao}</p>
                          <p className="text-xs text-muted-foreground">{formatarDataHora(t.created_at)}</p>
                        </div>
                        <div className="text-right space-y-0.5">
                          {t.xp_delta !== 0 && (
                            <p className={`text-xs font-bold ${t.xp_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {t.xp_delta > 0 ? '+' : ''}{t.xp_delta} XP
                            </p>
                          )}
                          {t.moedas_delta !== 0 && (
                            <p className={`text-xs font-bold ${t.moedas_delta > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                              {t.moedas_delta > 0 ? '+' : ''}{t.moedas_delta} 🪙
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resgates" className="mt-3">
            <Card>
              <CardContent className="p-0">
                {resgates.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum resgate solicitado.</p>
                ) : (
                  <div className="divide-y">
                    {resgates.map(r => (
                      <div key={r.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{(r as any).gamification_rewards?.nome || 'Prêmio'}</p>
                          <p className="text-xs text-muted-foreground">{formatarDataHora(r.created_at)}</p>
                        </div>
                        <Badge variant={r.status === 'aprovado' ? 'default' : r.status === 'rejeitado' ? 'destructive' : 'secondary'}>
                          {r.status === 'pendente' ? '⏳ Pendente' : r.status === 'aprovado' ? '✅ Aprovado' : '❌ Rejeitado'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de Resgate */}
      <Dialog open={!!selectedReward} onOpenChange={() => setSelectedReward(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resgatar Prêmio</DialogTitle>
            <DialogDescription>
              Deseja solicitar o resgate de <strong>{selectedReward?.nome}</strong> por <strong>{selectedReward?.custo_moedas} moedas</strong>?
              O resgate será enviado para aprovação do gestor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReward(null)}>Cancelar</Button>
            <Button onClick={handleResgate} disabled={resgatando}>
              {resgatando ? 'Solicitando...' : 'Confirmar Resgate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
