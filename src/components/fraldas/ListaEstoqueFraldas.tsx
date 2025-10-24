import { useState } from "react";
import { Edit, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFraldas } from "@/hooks/useFraldas";
import { CadastroEstoqueFraldaForm } from "./CadastroEstoqueFraldaForm";

interface ListaEstoqueFraldasProps {
  searchTerm: string;
}

export const ListaEstoqueFraldas = ({ searchTerm }: ListaEstoqueFraldasProps) => {
  const { estoques, loadingEstoques } = useFraldas();
  const [editingEstoque, setEditingEstoque] = useState<any>(null);

  const filteredEstoques = estoques?.filter(
    (estoque) =>
      estoque.tipo_fralda.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estoque.tamanho.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getNivelEstoque = (quantidade: number, minima: number) => {
    const percentual = (quantidade / minima) * 100;
    if (percentual <= 50) return "critico";
    if (percentual <= 100) return "aviso";
    return "normal";
  };

  if (loadingEstoques) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Consumo Médio</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEstoques && filteredEstoques.length > 0 ? (
              filteredEstoques.map((estoque) => {
                const nivel = getNivelEstoque(
                  estoque.quantidade_atual,
                  estoque.quantidade_minima
                );
                const diasRestantes =
                  estoque.consumo_medio_diario > 0
                    ? Math.floor(estoque.quantidade_atual / estoque.consumo_medio_diario)
                    : 999;

                return (
                  <TableRow key={estoque.id}>
                    <TableCell className="font-medium">{estoque.tipo_fralda}</TableCell>
                    <TableCell>{estoque.tamanho}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{estoque.quantidade_atual}</span>
                        <span className="text-xs text-muted-foreground">
                          / {estoque.quantidade_minima} mín
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {estoque.consumo_medio_diario > 0
                        ? `${estoque.consumo_medio_diario.toFixed(1)}/dia`
                        : "-"}
                    </TableCell>
                    <TableCell>{estoque.localizacao || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          nivel === "critico"
                            ? "destructive"
                            : nivel === "aviso"
                            ? "outline"
                            : "default"
                        }
                      >
                        {nivel === "critico"
                          ? `Crítico (${diasRestantes}d)`
                          : nivel === "aviso"
                          ? `Aviso (${diasRestantes}d)`
                          : "Normal"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingEstoque(estoque)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum estoque cadastrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingEstoque} onOpenChange={() => setEditingEstoque(null)}>
        <DialogContent className="max-w-2xl">
          <CadastroEstoqueFraldaForm
            estoque={editingEstoque}
            onSuccess={() => setEditingEstoque(null)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
