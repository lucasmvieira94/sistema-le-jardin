/**
 * Diálogo de criação de um envelope de assinatura eletrônica.
 * Permite montar o documento, adicionar signatários (empresa, funcionários e
 * externos) e escolher o método de confirmação de autoria de cada um.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  METODO_LABEL, TIPO_LABEL, useCriarEnvelope,
  type MetodoAssinatura, type PapelSignatario, type SignatarioInput,
} from '@/hooks/useAssinaturas';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pré-preenchimento opcional (ex.: abrir a partir de um contrato). */
  inicial?: Partial<{
    titulo: string;
    tipo: string;
    conteudo_html: string;
    referencia_id: string;
    referencia_tabela: string;
    /** Signatários já conhecidos do documento de origem. */
    signatarios: SignatarioInput[];
  }>;
}

const vazio = (): SignatarioInput => ({
  nome: '', cpf: '', email: '', telefone: '', papel: 'cliente', metodo: 'otp_email',
});

/** Converte texto simples em HTML preservando os parágrafos. */
function textoParaHtml(texto: string) {
  return texto
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>').trim()}</p>`)
    .join('');
}

export default function NovoEnvelopeDialog({ open, onOpenChange, inicial }: Props) {
  const { tenantId } = useTenantContext();
  const criar = useCriarEnvelope();

  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'outro');
  const [mensagem, setMensagem] = useState('');
  const [dias, setDias] = useState(30);
  const [conteudo, setConteudo] = useState('');
  const [incluirEmpresa, setIncluirEmpresa] = useState(true);
  const [signatarios, setSignatarios] = useState<SignatarioInput[]>([vazio()]);

  /** PDF anexado convertido em HTML (uma imagem por página). */
  const [pdfHtml, setPdfHtml] = useState('');
  const [pdfNome, setPdfNome] = useState('');
  const [pdfPaginas, setPdfPaginas] = useState(0);
  const [convertendo, setConvertendo] = useState(false);

  /**
   * Sincroniza o pré-preenchimento sempre que o diálogo é aberto a partir de um
   * documento já gerado pelo sistema (contrato, advertência, recibo...).
   */
  useEffect(() => {
    if (!open) return;
    setTitulo(inicial?.titulo ?? '');
    setTipo(inicial?.tipo ?? 'outro');
    setSignatarios(
      inicial?.signatarios && inicial.signatarios.length > 0 ? inicial.signatarios : [vazio()],
    );
    setIncluirEmpresa(true);
    setPdfHtml(''); setPdfNome(''); setPdfPaginas(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inicial?.titulo, inicial?.tipo, inicial?.referencia_id]);

  /** Converte o PDF selecionado em páginas de imagem para o envelope. */
  const anexarPdf = async (file?: File | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf') return toast.error('Selecione um arquivo PDF');
    if (file.size > 15 * 1024 * 1024) return toast.error('O PDF deve ter no máximo 15 MB');
    setConvertendo(true);
    try {
      const { html, paginas } = await pdfParaHtml(file);
      setPdfHtml(html);
      setPdfNome(file.name);
      setPdfPaginas(paginas);
      if (!titulo.trim()) setTitulo(file.name.replace(/\.pdf$/i, ''));
      toast.success(`PDF anexado (${paginas} página${paginas > 1 ? 's' : ''})`);
    } catch (e: any) {
      toast.error(e.message ?? 'Não foi possível ler o PDF');
    } finally {
      setConvertendo(false);
    }
  };


  const { data: funcionarios } = useQuery({
    queryKey: ['funcionarios-assinatura'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, cpf, email, telefone')
        .eq('ativo', true)
        .order('nome_completo');
      if (error) throw error;
      return data ?? [];
    },
  });

  const atualizar = (i: number, campo: keyof SignatarioInput, valor: any) =>
    setSignatarios((prev) => prev.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)));

  const escolherFuncionario = (i: number, id: string) => {
    const f = funcionarios?.find((x) => x.id === id);
    if (!f) return;
    setSignatarios((prev) =>
      prev.map((s, idx) =>
        idx === i
          ? { ...s, nome: f.nome_completo, cpf: f.cpf, email: f.email, telefone: f.telefone ?? '', papel: 'funcionario', funcionario_id: f.id }
          : s,
      ),
    );
  };

  const salvar = async () => {
    const html = inicial?.conteudo_html ?? textoParaHtml(conteudo);
    if (!titulo.trim() || !html.trim() || html === '<p></p>') {
      toast.error('Informe o título e o conteúdo do documento');
      return;
    }
    const lista = signatarios.filter((s) => s.nome.trim());
    for (const s of lista) {
      if (s.metodo === 'otp_email' && !s.email) return toast.error(`Informe o e-mail de ${s.nome}`);
      if (s.metodo === 'otp_sms' && !s.telefone) return toast.error(`Informe o telefone de ${s.nome}`);
      if (s.metodo === 'biometria_facial' && !s.funcionario_id)
        return toast.error(`Selecione o funcionário para validar a biometria de ${s.nome}`);
    }
    if (lista.length === 0 && !incluirEmpresa) return toast.error('Adicione ao menos um signatário');

    const todos: SignatarioInput[] = incluirEmpresa
      ? [{ nome: '', papel: 'empresa', metodo: 'rubrica_empresa' }, ...lista]
      : lista;

    try {
      const r = await criar.mutateAsync({
        titulo: titulo.trim(),
        tipo,
        conteudo_html: html,
        mensagem: mensagem.trim() || null,
        expira_em_dias: dias,
        tenant_id: tenantId,
        referencia_id: inicial?.referencia_id ?? null,
        referencia_tabela: inicial?.referencia_tabela ?? null,
        signatarios: todos.map((s, i) => ({ ...s, ordem: i + 1 })),
      });
      if (r?.falhas_envio?.length) {
        toast.warning(`Envelope criado, mas houve falhas no envio: ${r.falhas_envio.join(' | ')}`);
      } else {
        toast.success('Documento enviado para assinatura');
      }
      onOpenChange(false);
      setTitulo(''); setConteudo(''); setMensagem(''); setSignatarios([vazio()]);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao criar o envelope');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar documento para assinatura</DialogTitle>
          <DialogDescription>
            O conteúdo é selado com hash SHA-256 e cada assinatura registra autoria, data/hora, IP e dispositivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>Título do documento</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Contrato de prestação de serviços" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!inicial?.conteudo_html && (
            <div>
              <Label>Conteúdo do documento</Label>
              <Textarea
                rows={8}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Cole ou digite o texto completo do documento..."
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>Mensagem para o signatário (opcional)</Label>
              <Input value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            </div>
            <div>
              <Label>Validade do link (dias)</Label>
              <Input type="number" min={1} max={365} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
            </div>
          </div>

          <Card className={incluirEmpresa ? 'border-primary' : ''}>
            <CardContent className="pt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-primary" />
                <span>Aplicar a rubrica da empresa automaticamente</span>
              </div>
              <Button type="button" size="sm" variant={incluirEmpresa ? 'default' : 'outline'} onClick={() => setIncluirEmpresa((v) => !v)}>
                {incluirEmpresa ? 'Incluída' : 'Não incluir'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Signatários externos</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setSignatarios((p) => [...p, vazio()])}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>

            {signatarios.map((s, i) => (
              <Card key={i}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Signatário {i + 1}</span>
                    {signatarios.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => setSignatarios((p) => p.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Preencher com funcionário</Label>
                      <Select onValueChange={(v) => escolherFuncionario(i, v)}>
                        <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
                        <SelectContent>
                          {(funcionarios ?? []).map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.nome_completo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Nome completo</Label>
                      <Input value={s.nome} onChange={(e) => atualizar(i, 'nome', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">CPF</Label>
                      <Input value={s.cpf ?? ''} onChange={(e) => atualizar(i, 'cpf', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Papel</Label>
                      <Select value={s.papel} onValueChange={(v) => atualizar(i, 'papel', v as PapelSignatario)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="funcionario">Funcionário</SelectItem>
                          <SelectItem value="cliente">Cliente</SelectItem>
                          <SelectItem value="responsavel">Responsável</SelectItem>
                          <SelectItem value="testemunha">Testemunha</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">E-mail</Label>
                      <Input type="email" value={s.email ?? ''} onChange={(e) => atualizar(i, 'email', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Telefone (WhatsApp)</Label>
                      <Input value={s.telefone ?? ''} onChange={(e) => atualizar(i, 'telefone', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Confirmação de autoria</Label>
                      <Select value={s.metodo} onValueChange={(v) => atualizar(i, 'metodo', v as MetodoAssinatura)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="otp_email">{METODO_LABEL.otp_email}</SelectItem>
                          <SelectItem value="otp_sms">{METODO_LABEL.otp_sms}</SelectItem>
                          <SelectItem value="biometria_facial">{METODO_LABEL.biometria_facial}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={criar.isPending}>
            {criar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar para assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
