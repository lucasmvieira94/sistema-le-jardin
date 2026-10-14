/**
 * Painel do gestor da Central de Documentos.
 * - Publica comunicados, regimentos e políticas para todos ou para colaboradores escolhidos.
 * - Acompanha quem assinou (biometria facial) ou recusou cada documento interno.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { supabase } from '@/integrations/supabase/client';
import { conteudoCanonico, ROTULO_TIPO, sha256Hex, type TipoDocumentoInterno } from '@/utils/documentosInternos';
import { formatarTimestampDataHora } from '@/utils/formatTimestamp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { FileSignature, Loader2, Send, Paperclip, X, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { estaAtrasado, type LinhaAssinatura } from '@/utils/controleAssinaturas';

const sb = supabase as any;

/** Converte texto simples em parágrafos HTML seguros. */
function textoParaHtml(texto: string): string {
  return texto.split(/\n{2,}/).map((p) => `<p>${DOMPurify.sanitize(p.trim()).replace(/\n/g, '<br/>')}</p>`).join('');
}

export default function DocumentosInternos() {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('comunicado');
  const [texto, setTexto] = useState('');
  const [todos, setTodos] = useState(true);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [pdf, setPdf] = useState<File | null>(null);
  const [prazo, setPrazo] = useState('');
  const [prazoPadraoEdit, setPrazoPadraoEdit] = useState<string | null>(null);

  // Prazo padrão (dias) para assinar qualquer documento, salvo nas configurações da empresa
  const { data: config } = useQuery({
    queryKey: ['config-prazo-assinatura'],
    queryFn: async () => {
      const { data, error } = await sb.from('configuracoes_empresa').select('id, prazo_assinatura_dias').order('created_at').limit(1).maybeSingle();
      if (error) throw error;
      return data as { id: string; prazo_assinatura_dias: number } | null;
    },
  });
  const prazoPadrao = config?.prazo_assinatura_dias ?? 3;
  const salvarPrazoPadrao = async () => {
    const dias = Number(prazoPadraoEdit);
    if (!config || !Number.isInteger(dias) || dias < 1 || dias > 90) {
      toast({ variant: 'destructive', title: 'Informe um prazo entre 1 e 90 dias.' }); return;
    }
    const { error } = await sb.from('configuracoes_empresa').update({ prazo_assinatura_dias: dias }).eq('id', config.id);
    if (error) { toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message }); return; }
    toast({ title: 'Prazo padrão atualizado' });
    setPrazoPadraoEdit(null);
    qc.invalidateQueries({ queryKey: ['config-prazo-assinatura'] });
    qc.invalidateQueries({ queryKey: ['painel-assinaturas'] });
  };

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['docs-internos-funcionarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('funcionarios').select('id, nome_completo').eq('ativo', true).order('nome_completo');
      if (error) throw error;
      return data as { id: string; nome_completo: string }[];
    },
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ['docs-internos'],
    queryFn: async () => {
      const { data, error } = await sb.from('documentos_internos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: assinaturas = [], isLoading } = useQuery({
    queryKey: ['docs-internos-assinaturas'],
    queryFn: async () => {
      const { data, error } = await sb.from('documentos_internos_assinaturas')
        .select('*, funcionarios(nome_completo)').order('assinado_em', { ascending: false }).limit(300);
      if (error) throw error;
      return data as any[];
    },
  });

  // Documentos já disponíveis no sistema e ainda não assinados (folhas, contracheques, advertências, comunicados)
  const { data: pendentes = [], isLoading: carregandoPend } = useQuery({
    queryKey: ['painel-assinaturas'],
    queryFn: async () => {
      const { data, error } = await sb.rpc('painel_assinaturas_documentos');
      if (error) throw error;
      return ((data ?? []) as LinhaAssinatura[]).filter((l) => l.status === 'pendente');
    },
  });
  const pendPorTipo = useMemo(() => {
    const m = new Map<string, number>();
    pendentes.forEach((l) => m.set(l.tipo_documento, (m.get(l.tipo_documento) ?? 0) + 1));
    return m;
  }, [pendentes]);

  const nomes = useMemo(() => new Map(funcionarios.map((f) => [f.id, f.nome_completo])), [funcionarios]);

  const publicar = async () => {
    if (titulo.trim().length < 3 || (!pdf && texto.trim().length < 10)) {
      toast({ variant: 'destructive', title: pdf ? 'Preencha o título do documento.' : 'Preencha o título e o texto, ou anexe um PDF.' });
      return;
    }
    if (!todos && selecionados.length === 0) {
      toast({ variant: 'destructive', title: 'Escolha ao menos um colaborador.' });
      return;
    }
    const hojeBR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (prazo && prazo < hojeBR) {
      toast({ variant: 'destructive', title: 'O prazo não pode ser uma data passada.' }); return;
    }
    setSalvando(true);
    try {
      const t = titulo.trim();
      const conteudo_html = texto.trim() ? textoParaHtml(texto) : '';
      let hash_documento: string;
      let arquivo_path: string | null = null;
      if (pdf) {
        // Com PDF, o documento assinado é o próprio arquivo: o hash é dos bytes exatos enviados.
        const bytes = await pdf.arrayBuffer();
        hash_documento = await sha256Hex(bytes);
        arquivo_path = `${Date.now()}-${crypto.randomUUID()}.pdf`;
        const up = await supabase.storage.from('documentos-internos').upload(arquivo_path, pdf, { contentType: 'application/pdf' });
        if (up.error) throw up.error;
      } else {
        hash_documento = await sha256Hex(conteudoCanonico({ titulo: t, conteudo_html }));
      }
      const { data: u } = await supabase.auth.getUser();
      const { error } = await sb.from('documentos_internos').insert({
        titulo: t, tipo, conteudo_html, hash_documento, arquivo_path, prazo_assinatura: prazo || null,
        funcionario_ids: todos ? null : selecionados, criado_por: u.user?.id ?? null,
      });
      if (error) throw error;
      toast({ title: 'Documento publicado no portal dos colaboradores' });
      setTitulo(''); setTexto(''); setSelecionados([]); setTodos(true); setPdf(null); setPrazo('');
      qc.invalidateQueries({ queryKey: ['docs-internos'] });
      qc.invalidateQueries({ queryKey: ['painel-assinaturas'] });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao publicar', description: (e as Error).message });
    } finally {
      setSalvando(false);
    }
  };

  const desativar = async (id: string) => {
    const { error } = await sb.from('documentos_internos').update({ ativo: false }).eq('id', id);
    if (error) toast({ variant: 'destructive', title: 'Erro', description: error.message });
    else qc.invalidateQueries({ queryKey: ['docs-internos'] });
  };

  const totalDestinatarios = (d: any) => (d.funcionario_ids ? d.funcionario_ids.length : funcionarios.length);
  const assinadosDoc = (id: string) => assinaturas.filter((a) => a.tipo_documento === 'comunicado' && a.referencia_id === id);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileSignature className="w-6 h-6" /> Documentos Internos</h1>
        <p className="text-muted-foreground text-sm">
          Os colaboradores assinam no portal com biometria facial: advertências, folhas de ponto, contracheques e os comunicados publicados aqui.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg flex items-center gap-2"><Clock className="w-5 h-5" /> Aguardando assinatura ({pendentes.length})</CardTitle>
          <Button asChild size="sm" variant="outline"><Link to="/controle-assinaturas">Ver controle completo</Link></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm rounded border p-2">
            <span>Prazo padrão para assinar folhas de ponto, contracheques, advertências e comunicados sem data própria:</span>
            {prazoPadraoEdit === null ? (<>
              <b>{prazoPadrao} dia(s)</b>
              <Button size="sm" variant="ghost" onClick={() => setPrazoPadraoEdit(String(prazoPadrao))}>Alterar</Button>
            </>) : (<>
              <Input type="number" min={1} max={90} className="w-20 h-8" value={prazoPadraoEdit} onChange={(e) => setPrazoPadraoEdit(e.target.value)} />
              <Button size="sm" onClick={salvarPrazoPadrao}>Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => setPrazoPadraoEdit(null)}>Cancelar</Button>
            </>)}
            <span className="text-xs text-muted-foreground w-full">O colaborador é avisado ao publicar, quando falta 1 dia e quando o prazo vence.</span>
          </div>
          {carregandoPend ? <Loader2 className="animate-spin" /> : pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento pendente de assinatura.</p>
          ) : (<>
            <div className="flex flex-wrap gap-2">
              {[...pendPorTipo].map(([t, n]) => <Badge key={t} variant="secondary">{ROTULO_TIPO[t as TipoDocumentoInterno] ?? t}: {n}</Badge>)}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y border rounded">
              {[...pendentes].sort((a, b) => a.criado_em.localeCompare(b.criado_em)).map((l) => (
                <div key={`${l.funcionario_id}-${l.tipo_documento}-${l.referencia_id}`} className="flex items-center justify-between gap-2 p-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{l.funcionario_nome}</div>
                    <div className="text-xs text-muted-foreground truncate">{l.titulo} · disponível desde {formatarTimestampDataHora(l.criado_em)}{l.prazo_em ? ` · prazo ${formatarTimestampDataHora(l.prazo_em)}` : ''}</div>
                  </div>
                  {estaAtrasado(l) ? <Badge variant="destructive">Atrasado</Badge> : <Badge variant="outline">Pendente</Badge>}
                </div>
              ))}
            </div>
          </>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Publicar comunicado ou regimento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={150} placeholder="Ex.: Regimento interno 2026" />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comunicado">Comunicado</SelectItem>
                  <SelectItem value="regimento">Regimento interno</SelectItem>
                  <SelectItem value="politica">Política interna</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1 max-w-xs">
            <Label>Prazo para assinar (opcional)</Label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            <p className="text-xs text-muted-foreground">Sem data, vale o prazo padrão de {prazoPadrao} dia(s) após a publicação.</p>
          </div>
          <div className="space-y-1">
            <Label>Arquivo PDF (opcional)</Label>
            {pdf ? (
              <div className="flex items-center gap-2 text-sm border rounded p-2">
                <Paperclip className="w-4 h-4" /> <span className="truncate flex-1">{pdf.name}</span>
                <Button size="sm" variant="ghost" onClick={() => setPdf(null)}><X className="w-4 h-4" /></Button>
              </div>
            ) : (
              <Input type="file" accept="application/pdf,.pdf" onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.type !== 'application/pdf') { toast({ variant: 'destructive', title: 'Envie um arquivo PDF.' }); e.target.value = ''; return; }
                if (f && f.size > 20 * 1024 * 1024) { toast({ variant: 'destructive', title: 'O PDF deve ter até 20 MB.' }); e.target.value = ''; return; }
                setPdf(f);
              }} />
            )}
            <p className="text-xs text-muted-foreground">Para documentos mais complexos, como o regimento interno: o colaborador verá e assinará o PDF no lugar do texto.</p>
          </div>
          <div className="space-y-1">
            <Label>{pdf ? 'Texto de apresentação (opcional)' : 'Texto'}</Label>
            <Textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={20000}
              placeholder="Separe os parágrafos com uma linha em branco." />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={todos} onCheckedChange={(v) => setTodos(v === true)} /> Enviar para todos os colaboradores ativos
            </label>
            {!todos && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1 max-h-48 overflow-y-auto border rounded p-2">
                {funcionarios.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selecionados.includes(f.id)}
                      onCheckedChange={(v) => setSelecionados((s) => v ? [...s, f.id] : s.filter((x) => x !== f.id))} />
                    {f.nome_completo}
                  </label>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Depois de publicado, o texto não pode ser alterado: para corrigir, desative e publique uma nova versão.</p>
          <Button onClick={publicar} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Publicar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Comunicados publicados</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {documentos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comunicado publicado.</p>}
          {documentos.map((d) => {
            const s = assinadosDoc(d.id);
            const ok = s.filter((a) => a.status === 'assinado').length;
            return (
              <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded p-3">
                <div>
                  <div className="font-medium">{d.titulo} {d.arquivo_path && <Badge variant="outline">PDF</Badge>} {!d.ativo && <Badge variant="secondary">Desativado</Badge>}</div>
                  <div className="text-xs text-muted-foreground">
                    Publicado em {formatarTimestampDataHora(d.created_at)}{d.prazo_assinatura ? ` · prazo ${d.prazo_assinatura.split('-').reverse().join('/')}` : ''} · {ok} de {totalDestinatarios(d)} assinaram
                    {s.length - ok > 0 && ` · ${s.length - ok} recusa(s)`}
                  </div>
                </div>
                {d.ativo && <Button size="sm" variant="outline" onClick={() => desativar(d.id)}>Desativar</Button>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Assinaturas e recusas recentes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="animate-spin" /> : assinaturas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma assinatura registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-2">Colaborador</th><th className="pr-2">Documento</th><th className="pr-2">Situação</th><th className="pr-2">Data/hora</th><th>Hash da assinatura</th>
                </tr></thead>
                <tbody>
                  {assinaturas.map((a) => (
                    <tr key={a.id} className="border-b align-top">
                      <td className="py-2 pr-2">{a.funcionarios?.nome_completo ?? nomes.get(a.funcionario_id) ?? '—'}</td>
                      <td className="pr-2">
                        <div>{a.titulo}</div>
                        <div className="text-xs text-muted-foreground">{ROTULO_TIPO[a.tipo_documento as TipoDocumentoInterno]}</div>
                      </td>
                      <td className="pr-2">
                        {a.status === 'assinado' ? <Badge className="bg-emerald-600">Biometria</Badge> : <Badge variant="destructive">Recusado</Badge>}
                        {a.motivo_recusa && <div className="text-xs mt-1">{a.motivo_recusa}</div>}
                      </td>
                      <td className="pr-2 whitespace-nowrap">{formatarTimestampDataHora(a.assinado_em)}</td>
                      <td className="text-[11px] font-mono break-all max-w-[200px]">{a.hash_assinatura}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
