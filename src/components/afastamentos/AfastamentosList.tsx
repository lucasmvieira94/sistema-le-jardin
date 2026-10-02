
import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { formatarData } from "@/utils/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Link2, Ban, Paperclip } from "lucide-react";
import AnexoInput from './AnexoInput';
import { AnexoAfastamento, linkAnexo, registrarAnexoAfastamento, revogarAnexo } from '@/utils/anexoAfastamento';
import { useTenantContext } from '@/contexts/TenantContext';
import { toast } from "@/components/ui/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import EditarAfastamentoDialog from "./EditarAfastamentoDialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Afastamento {
  id: string;
  funcionario_nome: string;
  tipo_descricao: string;
  tipo_remunerado: boolean;
  tipo_periodo: string;
  data_inicio: string;
  data_fim: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  quantidade_horas: number | null;
  quantidade_dias: number | null;
  observacoes: string | null;
  created_at: string;
}

export interface AfastamentosListRef {
  fetchAfastamentos: () => void;
}

const AfastamentosList = forwardRef<AfastamentosListRef>((props, ref) => {
  const [afastamentos, setAfastamentos] = useState<Afastamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [justificativaExclusao, setJustificativaExclusao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [anexos, setAnexos] = useState<Record<string, AnexoAfastamento>>({});
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState('');
  const { tenantId } = useTenantContext();
  const { logEvent } = useAuditLog();

  useImperativeHandle(ref, () => ({
    fetchAfastamentos
  }));

  useEffect(() => {
    fetchAfastamentos();
  }, []);

  async function fetchAfastamentos() {
    try {
      const { data, error } = await supabase
        .from("afastamentos")
        .select(`
          *,
          funcionario:funcionarios(nome_completo),
          tipo_afastamento:tipos_afastamento(descricao, remunerado)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedData = data?.map((item: any) => ({
        id: item.id,
        funcionario_nome: item.funcionario.nome_completo,
        tipo_descricao: item.tipo_afastamento.descricao,
        tipo_remunerado: item.tipo_afastamento.remunerado,
        tipo_periodo: item.tipo_periodo,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        hora_inicio: item.hora_inicio,
        hora_fim: item.hora_fim,
        quantidade_horas: item.quantidade_horas,
        quantidade_dias: item.quantidade_dias,
        observacoes: item.observacoes,
        created_at: item.created_at,
      })) || [];

      setAfastamentos(formattedData);
      const { data: anexosData, error: anexosError } = await supabase.from('afastamentos_anexos')
        .select('id, afastamento_id, nome_original, hash_pdf, token, revogado_em, documento_id')
        .is('revogado_em', null);
      if (anexosError) throw anexosError;
      setAnexos(Object.fromEntries((anexosData ?? []).map(item => [item.afastamento_id, item])));
    } catch (error) {
      console.error("Erro ao buscar afastamentos:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveAnexo() {
    if (!uploadId || !uploadFile || !tenantId) return;
    setBusy(true);
    try {
      await registrarAnexoAfastamento(uploadFile, uploadId, tenantId, setProgresso);
      toast({ title: 'Documento convertido e autenticado' });
      setUploadId(null);
      setUploadFile(null);
      await fetchAfastamentos();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Não foi possível anexar', description: error instanceof Error ? error.message : 'Tente novamente.' });
    } finally { setBusy(false); setProgresso(''); }
  }

  async function revoke(id: string) {
    try { await revogarAnexo(id); await fetchAfastamentos(); toast({ title: 'Link revogado' }); }
    catch (error) { toast({ variant: 'destructive', title: 'Falha ao revogar', description: error instanceof Error ? error.message : '' }); }
  }

  /**
   * Exclusão auditada no banco: guarda cópia do afastamento, do documento e dos
   * acessos ao link, remove os abonos/faltas gerados e exige justificativa.
   */
  async function deleteAfastamento(id: string) {
    if (justificativaExclusao.trim().length < 5) {
      toast({ variant: "destructive", title: "Informe a justificativa (mínimo 5 caracteres)" });
      return;
    }
    setExcluindo(true);
    try {
      const { error } = await (supabase as any).rpc("excluir_afastamento", { p_id: id, p_justificativa: justificativaExclusao.trim() });
      if (error) throw error;
      toast({
        title: "Afastamento excluído!",
        description: "Os lançamentos na apropriação de horas foram removidos e a exclusão ficou registrada na auditoria.",
      });
      fetchAfastamentos();
      setDeleteId(null);
      setJustificativaExclusao("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao excluir afastamento", description: error?.message });
    } finally {
      setExcluindo(false);
    }
  }

  if (loading) {
    return <div className="text-center">Carregando afastamentos...</div>;
  }

  if (afastamentos.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Nenhum afastamento registrado até o momento.
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-4">Afastamentos Registrados</h3>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Ações</TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead>Documento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {afastamentos.map((afastamento) => (
              <TableRow key={afastamento.id}>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditId(afastamento.id);
                        setEditOpen(true);
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(afastamento.id)}
                      title="Excluir"
                      className="text-destructive hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  {afastamento.funcionario_nome}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm">{afastamento.tipo_descricao}</span>
                    <Badge variant={afastamento.tipo_remunerado ? "default" : "secondary"}>
                      {afastamento.tipo_remunerado ? "Remunerado" : "Não remunerado"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {afastamento.tipo_periodo === "horas" ? "Horas" : "Dias"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>Início: {formatarData(afastamento.data_inicio)}</div>
                    {afastamento.data_fim && (
                      <div>Fim: {formatarData(afastamento.data_fim)}</div>
                    )}
                    {afastamento.hora_inicio && (
                      <div>Horário: {afastamento.hora_inicio} - {afastamento.hora_fim}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {afastamento.tipo_periodo === "horas" 
                    ? `${afastamento.quantidade_horas}h`
                    : `${afastamento.quantidade_dias} dia(s)`
                  }
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {afastamento.observacoes || "-"}
                </TableCell>
                <TableCell>
                  {anexos[afastamento.id] ? <div className="flex items-center gap-1">
                    <Button asChild variant="ghost" size="icon" title="Abrir PDF autenticado"><a href={linkAnexo(anexos[afastamento.id].token)} target="_blank" rel="noopener noreferrer"><Link2 className="w-4 h-4" /></a></Button>
                    <Button variant="ghost" size="icon" title="Revogar link" onClick={() => revoke(anexos[afastamento.id].id)}><Ban className="w-4 h-4" /></Button>
                    <span className="text-xs text-muted-foreground max-w-28 truncate" title={anexos[afastamento.id].nome_original}>{anexos[afastamento.id].nome_original}</span>
                  </div> : <Button variant="outline" size="sm" onClick={() => { setUploadId(afastamento.id); setUploadFile(null); }}><Paperclip className="w-4 h-4 mr-1" />Anexar</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditarAfastamentoDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        afastamentoId={editId}
        onSaved={fetchAfastamentos}
      />

      <AlertDialog open={!!uploadId} onOpenChange={open => { if (!open && !busy) { setUploadId(null); setUploadFile(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Anexar documento</AlertDialogTitle><AlertDialogDescription>O arquivo será convertido para PDF, autenticado e disponibilizado por link.</AlertDialogDescription></AlertDialogHeader>
          <AnexoInput onChange={setUploadFile} value={uploadFile} disabled={busy} />
          {progresso && <p role="status" className="text-sm text-muted-foreground">{progresso}</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><Button disabled={!uploadFile || busy} onClick={saveAnexo}>Salvar documento</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) { setDeleteId(null); setJustificativaExclusao(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir afastamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os abonos/faltas lançados por este afastamento saem da apropriação de horas.
              Uma cópia do afastamento e do documento anexado fica guardada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Justificativa da exclusão (obrigatória)"
            value={justificativaExclusao}
            maxLength={500}
            onChange={(e) => setJustificativaExclusao(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={excluindo || justificativaExclusao.trim().length < 5}
              onClick={(e) => { e.preventDefault(); if (deleteId) deleteAfastamento(deleteId); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

AfastamentosList.displayName = 'AfastamentosList';

export default AfastamentosList;
