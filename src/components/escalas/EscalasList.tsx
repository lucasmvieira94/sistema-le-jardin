
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type Escala = {
  id: number;
  nome: string;
  jornada_trabalho: string;
  entrada: string;
  saida: string;
  intervalo_inicio?: string;
  intervalo_fim?: string;
  observacoes?: string;
  created_at: string;
};

async function fetchEscalas(): Promise<Escala[]> {
  const { data, error } = await supabase
    .from("escalas")
    .select("id, nome, jornada_trabalho, entrada, saida, intervalo_inicio, intervalo_fim, observacoes, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

interface EscalasListProps {
  refreshFlag: number;
  onEdit?: (escala: Escala) => void;
}

export default function EscalasList({ refreshFlag, onEdit }: EscalasListProps) {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["escalas", refreshFlag],
    queryFn: fetchEscalas,
  });

  const handleDelete = async (id: number, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir a escala "${nome}"?`)) return;
    
    try {
      const { error } = await supabase
        .from("escalas")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      toast({
        title: "Escala excluída",
        description: `A escala "${nome}" foi excluída com sucesso.`,
      });
      
      refetch();
    } catch (error) {
      console.error("Erro ao excluir escala:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir a escala. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Escalas Cadastradas</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <div>Carregando escalas...</div>}
        {isError && <div>Erro ao carregar escalas.</div>}
        {!isLoading && data && data.length === 0 && (
          <div className="text-muted-foreground">Nenhuma escala cadastrada.</div>
        )}
        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Jornada</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((escala) => (
                <TableRow key={escala.id}>
                  <TableCell>{escala.nome}</TableCell>
                  <TableCell>{escala.jornada_trabalho}</TableCell>
                  <TableCell>{escala.entrada.slice(0,5)}</TableCell>
                  <TableCell>{escala.saida.slice(0,5)}</TableCell>
                  <TableCell>
                    {new Date(escala.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(escala)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(escala.id, escala.nome)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
