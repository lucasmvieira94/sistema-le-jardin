import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Upload, Trash2, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useContrachequesAdmin, useDeleteContracheque, getContrachequeSignedUrl } from '@/hooks/useContracheques';
import { processarPDFContracheques, type FuncionarioMatch, normalizar, type ResultadoProcessamento } from '@/utils/contrachequeProcessor';
import { useTenantContext } from '@/contexts/TenantContext';
import { formatarTimestampDataHora } from '@/utils/formatTimestamp';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function Contracheques() {
  const { tenantId } = useTenantContext();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcessamento | null>(null);

  const { data: lista, isLoading } = useContrachequesAdmin(mes, ano);
  const deleteMut = useDeleteContracheque();

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  const handleProcessar = async () => {
    if (!arquivo || !tenantId) {
      toast({ variant: 'destructive', title: 'Selecione um arquivo PDF' });
      return;
    }
    setProcessando(true);
    setResultado(null);
    try {
      // 1. Busca funcionários ativos do tenant
      const { data: funcs, error: fErr } = await supabase
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('tenant_id', tenantId)
        .eq('ativo', true);
      if (fErr) throw fErr;
      if (!funcs || funcs.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhum funcionário ativo encontrado' });
        return;
      }
      const matches: FuncionarioMatch[] = funcs.map((f: any) => ({
        id: f.id,
        nome: f.nome_completo,
        nomeNormalizado: normalizar(f.nome_completo),
      }));

      // 2. Processa PDF
      const res = await processarPDFContracheques(arquivo, matches);
      setResultado(res);

      if (res.holerites.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhum funcionário identificado',
          description: 'Verifique se o PDF contém os nomes completos dos funcionários.',
        });
        return;
      }

      // 3. Upload de cada holerite + insert (upsert por mes/ano/funcionario)
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      let sucesso = 0;
      let falhas = 0;

      for (const h of res.holerites) {
        const path = `${tenantId}/${h.funcionarioId}/${ano}-${String(mes).padStart(2, '0')}.pdf`;
        const { error: upErr } = await supabase.storage
          .from('contracheques')
          .upload(path, new Blob([h.pdfBytes as any], { type: 'application/pdf' }), {
            upsert: true,
            contentType: 'application/pdf',
          });
        if (upErr) { falhas++; continue; }

        const { error: dbErr } = await supabase
          .from('contracheques')
          .upsert({
            tenant_id: tenantId,
            funcionario_id: h.funcionarioId,
            mes,
            ano,
            path,
            paginas: h.paginas.length,
            tamanho_bytes: h.pdfBytes.byteLength,
            enviado_por: uid,
          }, { onConflict: 'tenant_id,funcionario_id,mes,ano' });
        if (dbErr) { falhas++; continue; }
        sucesso++;
      }

      toast({
        title: 'Processamento concluído',
        description: `${sucesso} holerite(s) distribuído(s)${falhas ? ` · ${falhas} falha(s)` : ''}${res.paginasOrfas.length ? ` · ${res.paginasOrfas.length} página(s) sem match` : ''}.`,
      });
      setArquivo(null);
      const input = document.getElementById('pdf-input') as HTMLInputElement;
      if (input) input.value = '';
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Erro no processamento', description: e.message });
    } finally {
      setProcessando(false);
    }
  };

  const visualizar = async (path: string) => {
    const url = await getContrachequeSignedUrl(path);
    if (url) window.open(url, '_blank');
    else toast({ variant: 'destructive', title: 'Não foi possível abrir o arquivo' });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Contracheques</h1>
        <p className="text-muted-foreground text-sm">
          Envie um PDF consolidado com todos os holerites do mês. O sistema separa e distribui automaticamente por funcionário.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" /> Enviar holerites do mês
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Mês de referência</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arquivo PDF consolidado</Label>
              <Input
                id="pdf-input"
                type="file"
                accept="application/pdf"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <Button onClick={handleProcessar} disabled={!arquivo || processando}>
            {processando ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Processar e distribuir</>
            )}
          </Button>

          {resultado && (
            <div className="mt-4 p-4 rounded-md bg-muted/50 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                <strong>{resultado.holerites.length}</strong> holerite(s) identificado(s) de {resultado.totalPaginas} página(s).
              </div>
              {resultado.paginasOrfas.length > 0 && (
                <div className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <div>
                    <strong>{resultado.paginasOrfas.length} página(s) sem funcionário identificado</strong>
                    <ul className="list-disc ml-5 mt-1 text-xs">
                      {resultado.paginasOrfas.slice(0, 5).map((p) => (
                        <li key={p.paginaIndex}>Página {p.paginaIndex + 1}: {p.textoPreview.slice(0, 80)}...</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Holerites de {MESES[mes - 1]}/{ano}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : !lista || lista.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum holerite enviado para este período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Páginas</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.funcionario_nome}</TableCell>
                    <TableCell>{c.paginas ?? '-'}</TableCell>
                    <TableCell>{formatarTimestampDataHora(c.created_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => visualizar(c.path)}>
                        <FileText className="w-4 h-4 mr-1" /> Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm(`Excluir holerite de ${c.funcionario_nome}?`)) {
                            deleteMut.mutate({ id: c.id, path: c.path });
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
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
