import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { EntradaEstoqueForm } from "./EntradaEstoqueForm";
import { Plus, Search, ShieldAlert, Package } from "lucide-react";
import { format } from "date-fns";

export const EstoqueUrgencia = () => {
  const { estoqueUrgencia, isLoadingEstoqueUrgencia } = useMedicamentos();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = estoqueUrgencia.filter(item =>
    item.medicamento?.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoadingEstoqueUrgencia) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              <div>
                <CardTitle>Medicamentos de Urgência</CardTitle>
                <CardDescription>Estoque institucional disponível para todos os residentes</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Entrada</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <EntradaEstoqueForm defaultTipoEstoque="urgencia" onSuccess={() => setDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum medicamento de urgência cadastrado</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicamento</TableHead>
                    <TableHead>Dosagem</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => {
                    const estoqueBaixo = item.quantidade_atual <= (item.quantidade_minima || 10);
                    const vencido = item.data_validade && new Date(item.data_validade) < new Date();
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.medicamento?.nome}</TableCell>
                        <TableCell>{item.medicamento?.dosagem || "-"}</TableCell>
                        <TableCell>
                          <span className={estoqueBaixo ? "text-orange-600 font-semibold" : ""}>
                            {item.quantidade_atual}
                          </span>
                        </TableCell>
                        <TableCell>{item.lote || "-"}</TableCell>
                        <TableCell>
                          {item.data_validade 
                            ? format(new Date(item.data_validade + "T12:00:00"), "dd/MM/yyyy")
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {vencido && <Badge variant="destructive" className="text-xs">Vencido</Badge>}
                            {estoqueBaixo && <Badge variant="secondary" className="text-xs bg-orange-200 text-orange-800">Baixo</Badge>}
                            {!vencido && !estoqueBaixo && <Badge variant="outline" className="text-xs">OK</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
