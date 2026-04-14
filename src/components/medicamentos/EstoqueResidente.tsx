import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { EntradaEstoqueForm } from "./EntradaEstoqueForm";
import { Plus, Search, User, Pill, Package } from "lucide-react";
import { format } from "date-fns";

export const EstoqueResidente = () => {
  const { estoqueResidentes, isLoadingEstoqueResidentes } = useMedicamentos();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Agrupar por residente
  const porResidente = estoqueResidentes.reduce((acc, item) => {
    const residenteNome = item.residente?.nome || "Sem residente";
    const residenteId = item.residente_id || "none";
    if (!acc[residenteId]) {
      acc[residenteId] = { nome: residenteNome, itens: [] };
    }
    acc[residenteId].itens.push(item);
    return acc;
  }, {} as Record<string, { nome: string; itens: typeof estoqueResidentes }>);

  const filteredResidentes = Object.entries(porResidente).filter(([_, data]) =>
    data.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    data.itens.some(i => i.medicamento?.nome.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoadingEstoqueResidentes) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar residente ou medicamento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Entrada de Estoque</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <EntradaEstoqueForm defaultTipoEstoque="residente" onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {filteredResidentes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum estoque individual cadastrado</p>
            <p className="text-sm">Registre entradas de medicamentos por residente</p>
          </CardContent>
        </Card>
      ) : (
        filteredResidentes.map(([residenteId, data]) => (
          <Card key={residenteId}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{data.nome}</CardTitle>
                <Badge variant="secondary">{data.itens.length} medicamento{data.itens.length !== 1 ? 's' : ''}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.itens.map((item) => {
                  const estoqueBaixo = item.quantidade_atual <= (item.quantidade_minima || 10);
                  return (
                    <div key={item.id} className={`border rounded-lg p-3 ${estoqueBaixo ? 'border-orange-300 bg-orange-50' : 'border-border'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Pill className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{item.medicamento?.nome}</span>
                        </div>
                        {estoqueBaixo && <Badge variant="destructive" className="text-xs">Baixo</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div className="flex justify-between">
                          <span>Estoque:</span>
                          <span className="font-medium">{item.quantidade_atual}</span>
                        </div>
                        {item.lote && <div className="flex justify-between"><span>Lote:</span><span>{item.lote}</span></div>}
                        {item.data_validade && (
                          <div className="flex justify-between">
                            <span>Validade:</span>
                            <span>{format(new Date(item.data_validade + "T12:00:00"), "dd/MM/yyyy")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
