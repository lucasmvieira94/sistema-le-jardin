import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFuncionarioSession } from '@/hooks/useFuncionarioSession';
import {
  useMinhasFolhasPonto,
  getFolhaPontoSignedUrl,
  marcarAberturaFolhaPonto,
  confirmarFolhaPonto,
  type FolhaPontoItem,
} from '@/hooks/useFolhasPonto';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, FileText, Loader2, Download, Clock, CheckCircle2, AlertTriangle, Receipt,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { formatarTimestampDataHora } from '@/utils/formatTimestamp';
import { useQueryClient } from '@tanstack/react-query';
import { gerarReciboConfirmacaoFolhaPonto } from '@/utils/reciboConfirmacaoFolhaPonto';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function MinhasFolhasPonto() {
  useFuncionarioSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const funcionarioId = params.get('funcionario_id');
  const funcionarioNome = params.get('funcionario_nome') || '';
  const qc = useQueryClient();

  const { data, isLoading } = useMinhasFolhasPonto(funcionarioId);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<FolhaPontoItem | null>(null);
  const [modo, setModo] = useState<'concorda' | 'discorda' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const abrirPDF = async (item: FolhaPontoItem, download = false) => {
    setOpeningId(item.id);
    try {
      const url = await getFolhaPontoSignedUrl(item.path);
      if (!url) {
        toast({
          variant: 'destructive',
          title: 'Não foi possível abrir a folha de ponto',
          description: 'Verifique sua conexão ou fale com o gestor.',
        });
        return;
      }

      // Marca primeira abertura
      if (!item.primeira_abertura_at && funcionarioId) {
        try { await marcarAberturaFolhaPonto(item.id, funcionarioId); } catch { /* ignore */ }
        qc.invalidateQueries({ queryKey: ['minhas-folhas-ponto', funcionarioId] });
      }

      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = item.path.split('/').pop() || 'folha-ponto.pdf';
        a.click();
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }

      // Se ainda não confirmou, abrir modal automaticamente
      if (item.confirmado === null) {
        setTimeout(() => {
          setConfirmando(item);
          setModo(null);
          setMotivo('');
        }, 400);
      }
    } finally {
      setOpeningId(null);
    }
  };

  const submeter = async () => {
    if (!confirmando || !funcionarioId || !modo) return;
    if (modo === 'discorda' && motivo.trim().length < 5) {
      toast({
        variant: 'destructive',
        title: 'Descreva o motivo',
        description: 'Informe ao menos 5 caracteres para justificar a discordância.',
      });
      return;
    }
    setEnviando(true);
    try {
      const concorda = modo === 'concorda';
      await confirmarFolhaPonto({
        folhaId: confirmando.id,
        funcionarioId,
        concorda,
        motivo: concorda ? undefined : motivo.trim(),
      });

      // Gera recibo automaticamente
      try {
        const blob = await gerarReciboConfirmacaoFolhaPonto({
          folhaId: confirmando.id,
          funcionarioId,
          funcionarioNome,
          mes: confirmando.mes,
          ano: confirmando.ano,
          concorda,
          motivo: concorda ? null : motivo.trim(),
          confirmadoAt: new Date().toISOString(),
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recibo-folha-ponto-${confirmando.ano}-${String(confirmando.mes).padStart(2, '0')}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      } catch (e) {
        console.error('Erro ao gerar recibo:', e);
      }

      toast({
        title: concorda ? 'Concordância registrada' : 'Discordância registrada',
        description: 'O recibo em PDF foi baixado como comprovação.',
      });
      setConfirmando(null);
      qc.invalidateQueries({ queryKey: ['minhas-folhas-ponto', funcionarioId] });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar confirmação',
        description: e?.message ?? 'Tente novamente.',
      });
    } finally {
      setEnviando(false);
    }
  };

  const statusBadge = (f: FolhaPontoItem) => {
    if (f.confirmado === true) {
      return (
        <Badge className="bg-green-600 hover:bg-green-600">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Concordou
        </Badge>
      );
    }
    if (f.confirmado === false) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="w-3 h-3 mr-1" /> Discordou
        </Badge>
      );
    }
    return <Badge variant="secondary">Aguardando confirmação</Badge>;
  };

  const pendente = useMemo(() => (data || []).some((f) => f.confirmado === null), [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="bg-white"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="text-white">
            <h1 className="text-xl sm:text-2xl font-bold">Minhas Folhas de Ponto</h1>
            <p className="text-sm opacity-90">{funcionarioNome}</p>
          </div>
        </div>

        {pendente && (
          <div className="bg-amber-100 border border-amber-300 text-amber-900 rounded-lg p-3 text-sm flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              Você tem folhas de ponto aguardando sua confirmação. Após abrir o
              documento, informe se concorda ou não com os registros — um recibo em
              PDF será gerado como comprovação.
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Clock className="w-5 h-5" /> Folhas de ponto disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-green-700" />
              </div>
            ) : !data || data.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma folha de ponto disponível ainda.</p>
                <p className="text-xs mt-1">
                  Assim que o gestor gerar o relatório mensal, ela aparecerá aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.map((f) => (
                  <div
                    key={f.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between p-3 border rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          {MESES[f.mes - 1]} / {f.ano}
                        </span>
                        {statusBadge(f)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Disponibilizado em {formatarTimestampDataHora(f.created_at)}
                        {f.confirmado_at && (
                          <> · Confirmado em {formatarTimestampDataHora(f.confirmado_at)}</>
                        )}
                      </div>
                      {f.confirmado === false && f.motivo_discordancia && (
                        <div className="text-xs text-red-700 mt-1 italic">
                          Motivo: {f.motivo_discordancia}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirPDF(f, false)}
                        disabled={openingId === f.id}
                      >
                        {openingId === f.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4 mr-1" />
                        )}
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => abrirPDF(f, true)}
                        className="bg-green-700 hover:bg-green-800"
                        disabled={openingId === f.id}
                      >
                        <Download className="w-4 h-4 mr-1" /> Baixar
                      </Button>
                      {f.confirmado === null && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setConfirmando(f);
                            setModo(null);
                            setMotivo('');
                          }}
                        >
                          <Receipt className="w-4 h-4 mr-1" /> Confirmar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!confirmando}
        onOpenChange={(o) => { if (!o && !enviando) setConfirmando(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-700" />
              Confirmação da folha de ponto
            </DialogTitle>
            <DialogDescription>
              {confirmando && (
                <>Período: <strong>{MESES[confirmando.mes - 1]} / {confirmando.ano}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Você revisou os registros de ponto do período? Sua resposta será
              registrada com data, hora e IP, gerando um recibo em PDF para
              comprovação junto ao gestor.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={modo === 'concorda' ? 'default' : 'outline'}
                className={modo === 'concorda' ? 'bg-green-700 hover:bg-green-800' : ''}
                onClick={() => setModo('concorda')}
                disabled={enviando}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" /> Concordo
              </Button>
              <Button
                variant={modo === 'discorda' ? 'destructive' : 'outline'}
                onClick={() => setModo('discorda')}
                disabled={enviando}
              >
                <AlertTriangle className="w-4 h-4 mr-1" /> Não concordo
              </Button>
            </div>

            {modo === 'discorda' && (
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="motivo-folha">
                  Descreva o motivo da discordância <span className="text-red-600">*</span>
                </label>
                <Textarea
                  id="motivo-folha"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value.slice(0, 1000))}
                  placeholder="Ex.: Falta lançamento do dia 15; horas extras do dia 22 estão incorretas..."
                  rows={4}
                  disabled={enviando}
                />
                <p className="text-xs text-muted-foreground">
                  {motivo.length}/1000 caracteres
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmando(null)}
              disabled={enviando}
            >
              Depois
            </Button>
            <Button
              onClick={submeter}
              disabled={!modo || enviando}
              className="bg-green-700 hover:bg-green-800"
            >
              {enviando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar e gerar recibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
