
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Escala = {
  id: number;
  nome: string;
  entrada: string;
  saida: string;
  created_at: string;
};

async function fetchEscalas(): Promise<Escala[]> {
  const { data, error } = await supabase
    .from("escalas")
    .select("id, nome, entrada, saida, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export default function EscalasList({ refreshFlag }: { refreshFlag: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["escalas", refreshFlag],
    queryFn: fetchEscalas,
  });

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
                <TableHead>Entrada</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((escala) => (
                <TableRow key={escala.id}>
                  <TableCell>{escala.nome}</TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
