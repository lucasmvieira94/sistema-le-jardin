import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const HistoricoUsoFraldas = () => {
  const { data: historico, isLoading } = useQuery({
    queryKey: ["historico-uso-fraldas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uso_fraldas")
        .select(
          `
          *,
          estoque_fraldas:estoque_fralda_id(tipo_fralda, tamanho),
          residentes:residente_id(nome_completo),
          funcionarios:funcionario_id(nome_completo)
        `
        )
        .order("data_uso", { ascending: false })
        .order("horario_uso", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data/Hora</TableHead>
            <TableHead>Residente</TableHead>
            <TableHead>Tipo de Fralda</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead>Tipo de Troca</TableHead>
            <TableHead>Funcionário</TableHead>
            <TableHead>Observações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {historico && historico.length > 0 ? (
            historico.map((uso: any) => (
              <TableRow key={uso.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {format(new Date(uso.data_uso), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <span className="text-sm text-muted-foreground">{uso.horario_uso}</span>
                  </div>
                </TableCell>
                <TableCell>{uso.residentes?.nome_completo}</TableCell>
                <TableCell>
                  {uso.estoque_fraldas?.tipo_fralda} - {uso.estoque_fraldas?.tamanho}
                </TableCell>
                <TableCell>{uso.quantidade_usada}</TableCell>
                <TableCell>
                  {uso.tipo_troca && (
                    <Badge variant="outline">
                      {uso.tipo_troca === "rotina"
                        ? "Rotina"
                        : uso.tipo_troca === "evacuacao"
                        ? "Evacuação"
                        : uso.tipo_troca === "urgencia"
                        ? "Urgência"
                        : uso.tipo_troca === "banho"
                        ? "Após Banho"
                        : uso.tipo_troca}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{uso.funcionarios?.nome_completo}</TableCell>
                <TableCell className="max-w-xs truncate">{uso.observacoes || "-"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nenhum uso registrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
