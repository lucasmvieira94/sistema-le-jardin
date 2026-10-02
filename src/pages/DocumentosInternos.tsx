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
import { FileSignature, Loader2, Send } from 'lucide-react';

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

  const nomes = useMemo(() => new Map(funcionarios.map((f) => [f.id, f.nome_completo])), [funcionarios]);

  const publicar = async () => {
    if (titulo.trim().length < 3 || texto.trim().length < 10) {
      toast({ variant: 'destructive', title: 'Preencha o título e o texto do documento.' });
      return;
    }
    if (!todos && selecionados.length === 0) {
      toast({ variant: 'destructive', title: 'Escolha ao menos um colaborador.' });
      return;
    }
    setSalvando(true);
    try {
      const conteudo_html = textoParaHtml(texto);
      const t = titulo.trim();
      const hash_documento = await sha256Hex(conteudoCanonico({ titulo: t, conteudo_html }));
      const { data: u } = await supabase.auth.getUser();
      const { error } = await sb.from('documentos_internos').insert({
        titulo: t, tipo, conteudo_html, hash_documento,
        funcionario_ids: todos ? null : selecionados, criado_por: u.user?.id ?? null,
      });
      if (error) throw error;
      toast({ title: 'Documento publicado no portal dos colaboradores' });
      setTitulo(''); setTexto(''); setSelecionados([]); setTodos(true);
      qc.invalidateQueries({ queryKey: ['docs-internos'] });
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
          <div className="space-y-1">
            <Label>Texto</Label>
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
                  <div className="font-medium">{d.titulo} {!d.ativo && <Badge variant="secondary">Desativado</Badge>}</div>
                  <div className="text-xs text-muted-foreground">
                    Publicado em {formatarTimestampDataHora(d.created_at)} · {ok} de {totalDestinatarios(d)} assinaram
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
