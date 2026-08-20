/**
 * Central de Assinaturas Eletrônicas (área administrativa).
 * Lista os envelopes, acompanha o status de cada signatário, reenvia convites,
 * cancela documentos e emite o manifesto de assinaturas (peça probatória).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  FileSignature, Loader2, Plus, Copy, Send, Ban, FileDown, ShieldCheck, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import NovoEnvelopeDialog from '@/components/assinaturas/NovoEnvelopeDialog';
import { gerarCertificadoAssinaturas } from '@/utils/certificadoAssinaturaPDF';
import { gerarPdfDocumentoAssinado } from '@/utils/documentoAssinadoPDF';
import {
  METODO_LABEL, STATUS_LABEL, TIPO_LABEL, linkAssinatura,
  useCancelarEnvelope, useEnvelopes, useEventosEnvelope, useReenviarConvite,
  type Envelope,
} from '@/hooks/useAssinaturas';

const dataHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';

const corStatus = (s: string) =>
  s === 'concluido' || s === 'assinado' ? 'default'
    : s === 'recusado' || s === 'cancelado' || s === 'expirado' ? 'destructive'
    : 'secondary';

export default function Assinaturas() {
  const { data: envelopes, isLoading } = useEnvelopes();
  const reenviar = useReenviarConvite();
  const cancelar = useCancelarEnvelope();

  const [novoAberto, setNovoAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState<Envelope | null>(null);
  const [cancelarAlvo, setCancelarAlvo] = useState<Envelope | null>(null);
  const [motivo, setMotivo] = useState('');
  const [baixando, setBaixando] = useState<string | null>(null);

  const { data: eventos } = useEventosEnvelope(detalhe?.id);

  const lista = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return (envelopes ?? []).filter(
      (e) =>
        !termo ||
        e.titulo.toLowerCase().includes(termo) ||
        e.assinatura_signatarios?.some((s) => s.nome.toLowerCase().includes(termo)),
    );
  }, [envelopes, busca]);

  const copiar = async (token: string) => {
    await navigator.clipboard.writeText(linkAssinatura(token));
    toast.success('Link de assinatura copiado');
  };

  const confirmarCancelamento = async () => {
    if (!cancelarAlvo) return;
    try {
      await cancelar.mutateAsync({ envelope_id: cancelarAlvo.id, motivo: motivo.trim() });
      toast.success('Envelope cancelado');
      setCancelarAlvo(null);
      setMotivo('');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  /** Baixa a via do documento com as assinaturas e evidências. */
  const baixarAssinado = async (e: Envelope) => {
    setBaixando(e.id);
    try {
      await gerarPdfDocumentoAssinado({
        titulo: e.titulo,
        tipo: e.tipo,
        conteudo_html: e.conteudo_html ?? '',
        hash_documento: e.hash_documento,
        signatarios: [...(e.assinatura_signatarios ?? [])].sort((a, b) => a.ordem - b.ordem),
      });
    } catch (err: any) {
      toast.error(err.message ?? 'Falha ao gerar o PDF assinado');
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-primary" /> Assinaturas Eletrônicas
          </h1>
          <p className="text-sm text-muted-foreground">
            Validade jurídica pela MP 2.200-2/2001 (art. 10, §2º) e Lei 14.063/2020
          </p>
        </div>
        <Button onClick={() => setNovoAberto(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo documento
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por documento ou signatário..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : lista.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum documento enviado para assinatura ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {lista.map((e) => {
            const assinados = e.assinatura_signatarios?.filter((s) => s.status === 'assinado').length ?? 0;
            const total = e.assinatura_signatarios?.length ?? 0;
            return (
              <Card key={e.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{e.titulo}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {TIPO_LABEL[e.tipo] ?? e.tipo} • criado em {dataHora(e.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={corStatus(e.status)}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                      <Badge variant="outline">{assinados}/{total} assinados</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="divide-y divide-border">
                    {[...(e.assinatura_signatarios ?? [])].sort((a, b) => a.ordem - b.ordem).map((s) => (
                      <div key={s.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-medium">{s.nome}</span>{' '}
                          <span className="text-muted-foreground">• {s.papel} • {METODO_LABEL[s.metodo] ?? s.metodo}</span>
                          <div className="text-xs text-muted-foreground">
                            {s.status === 'assinado'
                              ? `Assinado em ${dataHora(s.assinado_em)} • IP ${s.ip_origem ?? '—'}`
                              : s.status === 'recusado'
                              ? `Recusado: ${s.motivo_recusa}`
                              : 'Aguardando assinatura'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={corStatus(s.status)}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                          {s.status !== 'assinado' && s.metodo !== 'rubrica_empresa' && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => copiar(s.token)} title="Copiar link">
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm" variant="ghost" title="Reenviar convite"
                                disabled={reenviar.isPending}
                                onClick={() =>
                                  reenviar.mutateAsync(s.id).then(() => toast.success('Convite reenviado')).catch((err) => toast.error(err.message))
                                }
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDetalhe(e)}>
                      <ShieldCheck className="w-4 h-4 mr-1" /> Auditoria
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => gerarCertificadoAssinaturas(e)}>
                      <FileDown className="w-4 h-4 mr-1" /> Manifesto (PDF)
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => baixarAssinado(e)}
                      disabled={baixando === e.id || assinados === 0}
                      title={assinados === 0 ? 'Nenhuma assinatura registrada ainda' : 'Baixar documento assinado'}
                    >
                      {baixando === e.id
                        ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        : <FileDown className="w-4 h-4 mr-1" />}
                      PDF assinado
                    </Button>
                    {!['cancelado', 'concluido'].includes(e.status) && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelarAlvo(e)}>
                        <Ban className="w-4 h-4 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NovoEnvelopeDialog open={novoAberto} onOpenChange={setNovoAberto} />

      <Dialog open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trilha de auditoria</DialogTitle>
            <DialogDescription>{detalhe?.titulo}</DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground break-all">
            Hash SHA-256 do documento: {detalhe?.hash_documento}
          </p>
          <Separator />
          <div className="space-y-2">
            {(eventos ?? []).map((ev: any) => (
              <div key={ev.id} className="text-sm border-l-2 border-primary/40 pl-3 py-1">
                <div className="font-medium">{ev.evento}</div>
                <div className="text-xs text-muted-foreground">
                  {dataHora(ev.created_at)} {ev.ip_origem ? `• IP ${ev.ip_origem}` : ''}
                </div>
              </div>
            ))}
            {(eventos ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelarAlvo} onOpenChange={(v) => !v && setCancelarAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar envelope</DialogTitle>
            <DialogDescription>
              Os links pendentes deixam de funcionar. O motivo fica registrado na auditoria.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo do cancelamento" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelarAlvo(null)}>Voltar</Button>
            <Button variant="destructive" onClick={confirmarCancelamento} disabled={cancelar.isPending || motivo.trim().length < 3}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
