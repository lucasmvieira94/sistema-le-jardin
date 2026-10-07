/**
 * Central unificada de documentos do colaborador (portal por código de 4 dígitos).
 *
 * Reúne advertências/suspensões, folhas de ponto, contracheques e comunicados/
 * regimentos. A assinatura exige leitura, aceite do termo e validação por
 * biometria facial; recusas exigem motivo. Tudo fica registrado com hash do
 * documento, hash da assinatura, data/hora, IP e dispositivo.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { useFuncionarioSession } from '@/hooks/useFuncionarioSession';
import { useDocumentosFuncionario, assinarDocumentoInterno } from '@/hooks/useDocumentosFuncionario';
import { getFolhaPontoSignedUrl } from '@/hooks/useFolhasPonto';
import { getContrachequeSignedUrl } from '@/hooks/useContracheques';
import CapturaAssinaturaDialog from '@/components/biometria/CapturaAssinaturaDialog';
import AutoCadastroBiometriaDialog from '@/components/biometria/AutoCadastroBiometriaDialog';
import { useBiometriaStatus } from '@/hooks/useBiometriaFuncionario';
import { gerarPdfDocumentoAssinado } from '@/utils/documentoAssinadoPDF';
import { obterAutenticidadeAssinatura } from '@/utils/autenticidadeAssinatura';
import {
  ROTULO_TIPO, conteudoCanonico, filtrarDocumentos, resumirDocumentos, rotuloRecusa, sha256Hex,
  textoTermo, validarMotivoRecusa, type DocumentoFuncionario, type FiltroDocumentos,
} from '@/utils/documentosInternos';
import { formatarTimestampDataHora } from '@/utils/formatTimestamp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, CheckCircle2, Download, ExternalLink, FileSignature, FileText, Loader2, ScanFace, XCircle } from 'lucide-react';

export default function MeusDocumentos() {
  useFuncionarioSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const funcionarioId = params.get('funcionario_id');
  const funcionarioNome = params.get('funcionario_nome') || '';

  const { data = [], isLoading, error } = useDocumentosFuncionario(funcionarioId);
  const [filtro, setFiltro] = useState<FiltroDocumentos>('pendentes');
  const resumo = useMemo(() => resumirDocumentos(data), [data]);
  const lista = useMemo(() => filtrarDocumentos(data, filtro), [data, filtro]);

  // Estado do documento aberto
  const [aberto, setAberto] = useState<DocumentoFuncionario | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [aceite, setAceite] = useState(false);
  const [modoRecusa, setModoRecusa] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [biometriaOpen, setBiometriaOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const { data: bio, refetch: recarregarBio } = useBiometriaStatus(funcionarioId);
  const semBiometria = bio && !bio.cadastrada;

  const abrir = async (doc: DocumentoFuncionario) => {
    setAberto(doc); setAceite(false); setModoRecusa(false); setMotivo(''); setPdfUrl(null); setHash(null);
    setCarregando(true);
    try {
      if (doc.arquivo_path) {
        const url = doc.tipo_documento === 'folha_ponto'
          ? await getFolhaPontoSignedUrl(doc.arquivo_path)
          : await getContrachequeSignedUrl(doc.arquivo_path);
        if (!url) throw new Error('Não foi possível abrir o arquivo.');
        setPdfUrl(url);
        // O hash é do arquivo exato que o colaborador está vendo
        const buf = await (await fetch(url)).arrayBuffer();
        setHash(await sha256Hex(buf));
      } else if (doc.tipo_documento === 'comunicado' && doc.hash_referencia) {
        setHash(doc.hash_referencia);
      } else {
        setHash(await sha256Hex(conteudoCanonico(doc)));
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao abrir documento', description: (e as Error).message });
      setAberto(null);
    } finally {
      setCarregando(false);
    }
  };

  const fechar = () => { if (!enviando) setAberto(null); };

  /** Grava assinatura (com rosto) ou recusa. Erros são relançados para a tela de captura permitir nova tentativa. */
  const enviar = async (aceitou: boolean, descriptor?: number[]) => {
    if (!aberto || !funcionarioId || !hash) return;
    setEnviando(true);
    try {
      const r = await assinarDocumentoInterno({
        funcionarioId, tipo: aberto.tipo_documento, referenciaId: aberto.referencia_id, hashDocumento: hash,
        aceite: aceitou, motivoRecusa: aceitou ? undefined : motivo.trim(), descriptor,
      });
      toast({ title: aceitou ? 'Documento assinado com biometria' : 'Recusa registrada' });
      if (aceitou) {
        try {
          await baixarDocumento(aberto, hash, r.hash_assinatura, r.assinado_em);
        } catch (e) {
          toast({ variant: 'destructive', title: 'Assinatura salva; download não concluído', description: (e as Error).message });
        }
      }
      qc.invalidateQueries({ queryKey: ['documentos-funcionario', funcionarioId] });
      setAberto(null);
    } catch (e) {
      if (aceitou) throw e;
      toast({ variant: 'destructive', title: 'Não foi possível concluir', description: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  };

  const baixarDocumento = async (doc: DocumentoFuncionario, hashDoc: string, hashAss: string, quando: string) => {
    const autenticidade = await obterAutenticidadeAssinatura({
      origem: 'interno', referencia_id: doc.referencia_id, hash: hashDoc, hash_assinatura: hashAss,
    });
    let arquivoOriginal: ArrayBuffer | undefined;
    if (doc.arquivo_path) {
      const url = doc.tipo_documento === 'folha_ponto'
        ? await getFolhaPontoSignedUrl(doc.arquivo_path)
        : await getContrachequeSignedUrl(doc.arquivo_path);
      if (!url) throw new Error('Não foi possível carregar o documento original.');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Não foi possível carregar o documento original.');
      arquivoOriginal = await response.arrayBuffer();
    }
    await gerarPdfDocumentoAssinado({
      ...autenticidade,
      arquivo_original: arquivoOriginal,
      titulo: doc.titulo,
      tipo: ROTULO_TIPO[doc.tipo_documento],
      conteudo_html: `
        ${DOMPurify.sanitize(`<h2>${doc.titulo}</h2>`)}
        ${doc.conteudo_html ? DOMPurify.sanitize(doc.conteudo_html) : ''}`,
      hash_documento: hashDoc,
      signatarios: [{
        nome: funcionarioNome, papel: 'Colaborador', metodo: 'biometria_facial', status: 'assinado',
        assinado_em: quando, user_agent: navigator.userAgent, hash_assinatura: hashAss,
      }],
    });
  };

  const badge = (s: DocumentoFuncionario['status']) =>
    s === 'pendente' ? <Badge variant="outline" className="border-amber-500 text-amber-700">Pendente</Badge>
    : s === 'assinado' ? <Badge className="bg-emerald-600">Assinado</Badge>
    : <Badge variant="destructive">Recusado</Badge>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="bg-white" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="text-white">
            <h1 className="text-xl sm:text-2xl font-bold">Meus Documentos</h1>
            <p className="text-sm opacity-90">{funcionarioNome}</p>
          </div>
        </div>

        {semBiometria && (
          <Card className="border-2 border-amber-400">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="text-sm">
                <div className="font-semibold">Cadastre seu rosto para assinar</div>
                <div className="text-muted-foreground">Leva menos de 1 minuto e é feito uma única vez.</div>
              </div>
              <Button onClick={() => setCadastroOpen(true)}><ScanFace className="w-4 h-4 mr-1" /> Cadastrar agora</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-2">
          {[['Pendentes', resumo.pendentes, 'text-amber-700'], ['Assinados', resumo.assinados, 'text-emerald-700'], ['Recusados', resumo.recusados, 'text-red-700']].map(([l, v, c]) => (
            <Card key={l as string}><CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold ${c}`}>{v as number}</div>
              <div className="text-xs text-muted-foreground">{l as string}</div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-green-800"><FileSignature className="w-5 h-5" /> Documentos</CardTitle>
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroDocumentos)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="pendentes">A assinar</TabsTrigger>
                <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
                <TabsTrigger value="todos">Todos</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-green-700" /></div>
            ) : error ? (
              <p className="text-center text-destructive py-6">Não foi possível carregar seus documentos.</p>
            ) : lista.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{filtro === 'pendentes' ? 'Nenhum documento aguardando sua assinatura.' : 'Nenhum documento.'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lista.map((d) => (
                  <button
                    key={`${d.tipo_documento}-${d.referencia_id}`}
                    onClick={() => abrir(d)}
                    className="w-full text-left flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{ROTULO_TIPO[d.tipo_documento]}</div>
                      <div className="font-semibold truncate">{d.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.assinado_em ? `${d.status === 'assinado' ? 'Assinado' : 'Recusado'} em ${formatarTimestampDataHora(d.assinado_em)}` : `Disponível desde ${formatarTimestampDataHora(d.criado_em)}`}
                      </div>
                    </div>
                    {badge(d.status)}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!aberto && !biometriaOpen} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle>{aberto.titulo}</DialogTitle>
                <DialogDescription>{ROTULO_TIPO[aberto.tipo_documento]}{aberto.subtitulo ? ` — ${aberto.subtitulo}` : ''}</DialogDescription>
              </DialogHeader>

              {carregando ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="space-y-4">
                  {pdfUrl ? (
                    <div className="space-y-2">
                      <iframe src={pdfUrl} title={aberto.titulo} className="w-full h-[50vh] border rounded" />
                      <Button variant="outline" size="sm" onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}>
                        <ExternalLink className="w-4 h-4 mr-1" /> Abrir em tela cheia
                      </Button>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none border rounded p-3 bg-muted/20"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(aberto.conteudo_html ?? '') }} />
                  )}

                  <p className="text-[11px] text-muted-foreground break-all">Hash SHA-256: {hash}</p>

                  {aberto.status === 'pendente' ? (
                    modoRecusa ? (
                      <div className="space-y-2">
                        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000}
                          placeholder="Explique o motivo" />
                        {aberto.tipo_documento === 'advertencia' && (
                          <p className="text-xs text-muted-foreground">Em caso de recusa, a empresa poderá registrar a ciência com duas testemunhas, conforme a CLT.</p>
                        )}
                      </div>
                    ) : (
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <Checkbox checked={aceite} onCheckedChange={(v) => setAceite(v === true)} className="mt-0.5" />
                        <span>{textoTermo(aberto.tipo_documento)}</span>
                      </label>
                    )
                  ) : (
                    <div className="rounded border p-3 text-sm space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        {aberto.status === 'assinado' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-destructive" />}
                        {aberto.status === 'assinado' ? 'Assinado com biometria facial' : 'Assinatura recusada'} em {formatarTimestampDataHora(aberto.assinado_em!)}
                      </div>
                      {aberto.motivo_recusa && <div>Motivo: {aberto.motivo_recusa}</div>}
                      <div className="text-[11px] text-muted-foreground break-all">Hash da assinatura: {aberto.hash_assinatura}</div>
                      {aberto.hash_documento && hash && aberto.hash_documento !== hash && (
                        <div className="text-xs text-destructive">Atenção: o arquivo atual difere do que foi assinado.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                {aberto.status === 'pendente' ? (
                  modoRecusa ? (
                    <>
                      <Button variant="outline" onClick={() => setModoRecusa(false)} disabled={enviando}>Voltar</Button>
                      <Button variant="destructive" disabled={enviando || !!validarMotivoRecusa(motivo)} onClick={() => enviar(false)}>
                        {enviando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirmar recusa
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setModoRecusa(true)} disabled={carregando || enviando}>
                        {rotuloRecusa(aberto.tipo_documento)}
                      </Button>
                      <Button disabled={!aceite || !hash || carregando || enviando} onClick={() => (semBiometria ? setCadastroOpen(true) : setBiometriaOpen(true))}>
                        {enviando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ScanFace className="w-4 h-4 mr-1" />}
                        Assinar com biometria
                      </Button>
                    </>
                  )
                ) : aberto.status === 'assinado' && hash ? (
                  <Button disabled={enviando || !aberto.assinado_em} onClick={async () => {
                    if (!aberto.assinado_em) return;
                    setEnviando(true);
                    try { await baixarDocumento(aberto, aberto.hash_documento ?? hash, aberto.hash_assinatura ?? '', aberto.assinado_em); }
                    catch (e) { toast({ variant: 'destructive', title: 'Falha ao baixar documento', description: (e as Error).message }); }
                    finally { setEnviando(false); }
                  }}>
                    <Download className="w-4 h-4 mr-1" /> Baixar documento assinado
                  </Button>
                ) : (
                  <Button variant="outline" onClick={fechar}><FileText className="w-4 h-4 mr-1" /> Fechar</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {funcionarioId && aberto && (
        <CapturaAssinaturaDialog
          open={biometriaOpen}
          onOpenChange={setBiometriaOpen}
          titulo={aberto.titulo}
          onCapturado={(d) => enviar(true, d)}
        />
      )}

      {funcionarioId && (
        <AutoCadastroBiometriaDialog
          open={cadastroOpen}
          onOpenChange={setCadastroOpen}
          funcionarioId={funcionarioId}
          funcionarioNome={funcionarioNome}
          onConcluido={() => recarregarBio()}
        />
      )}
    </div>
  );
}
