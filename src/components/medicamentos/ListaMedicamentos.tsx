import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMedicamentos, Medicamento } from "@/hooks/useMedicamentos";
import { Search, Pill, Edit, Trash2, AlertCircle, Shield } from "lucide-react";
import { format } from "date-fns";

interface ListaMedicamentosProps {
  onEdit?: (medicamento: Medicamento) => void;
}

export const ListaMedicamentos = ({ onEdit }: ListaMedicamentosProps) => {
  const { medicamentos, isLoadingMedicamentos } = useMedicamentos();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMedicamentos = medicamentos.filter(medicamento =>
    medicamento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    medicamento.principio_ativo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    medicamento.fabricante?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoadingMedicamentos) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando medicamentos...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Medicamentos Cadastrados ({filteredMedicamentos.length})</span>
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar medicamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filteredMedicamentos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
            {searchTerm ? (
              <p>Nenhum medicamento encontrado para "{searchTerm}"</p>
            ) : (
              <p>Nenhum medicamento cadastrado ainda</p>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Princípio Ativo</TableHead>
                  <TableHead>Dosagem</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastrado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMedicamentos.map((medicamento) => (
                  <TableRow key={medicamento.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Pill className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{medicamento.nome}</div>
                          {medicamento.concentracao && (
                            <div className="text-sm text-muted-foreground">
                              {medicamento.concentracao}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {medicamento.principio_ativo || "-"}
                    </TableCell>
                    <TableCell>
                      {medicamento.dosagem || "-"}
                    </TableCell>
                    <TableCell>
                      {medicamento.forma_farmaceutica || "-"}
                    </TableCell>
                    <TableCell>
                      {medicamento.fabricante || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Ativo
                        </Badge>
                        {medicamento.prescricao_obrigatoria && (
                          <div className="flex items-center">
                            <AlertCircle className="h-3 w-3 text-orange-500 mr-1" />
                            <span className="text-xs text-orange-500">Prescrição</span>
                          </div>
                        )}
                        {medicamento.controlado && (
                          <div className="flex items-center">
                            <Shield className="h-3 w-3 text-red-500 mr-1" />
                            <span className="text-xs text-red-500">Controlado</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(medicamento.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit?.(medicamento)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};