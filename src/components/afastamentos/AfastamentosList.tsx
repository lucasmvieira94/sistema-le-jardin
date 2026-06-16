
import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { formatarData } from "@/utils/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import EditarAfastamentoDialog from "./EditarAfastamentoDialog";
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
    } catch (error) {
      console.error("Erro ao buscar afastamentos:", error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteAfastamento(id: string) {
    try {
      // Buscar registro completo para auditoria antes da exclusão
      const { data: anterior } = await supabase
        .from("afastamentos")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      const { error } = await supabase.from("afastamentos").delete().eq("id", id);
      if (error) throw error;

      await logEvent("afastamentos", "DELETE", anterior, null);

      toast({
        title: "Afastamento excluído!",
        description: "O afastamento foi excluído e registrado na auditoria.",
      });

      fetchAfastamentos();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir afastamento",
        description: error?.message,
      });
    } finally {
      setDeleteId(null);
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
              <TableHead>Funcionário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {afastamentos.map((afastamento) => (
              <TableRow key={afastamento.id}>
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
                      className="text-red-600 hover:text-red-700"
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
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

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir afastamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O evento será registrado na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteAfastamento(deleteId)}
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
