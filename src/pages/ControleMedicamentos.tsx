import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pill, Package, AlertTriangle, Plus, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CadastroMedicamentoForm } from "@/components/medicamentos/CadastroMedicamentoForm";
import { EntradaEstoqueForm } from "@/components/medicamentos/EntradaEstoqueForm";
import { ListaMedicamentos } from "@/components/medicamentos/ListaMedicamentos";
import { useMedicamentos } from "@/hooks/useMedicamentos";

const ControleMedicamentos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [cadastroDialogOpen, setCadastroDialogOpen] = useState(false);
  const [entradaDialogOpen, setEntradaDialogOpen] = useState(false);
  
  const { 
    medicamentos, 
    estoqueMedicamentos, 
    medicamentosEstoqueBaixo,
    isLoadingMedicamentos,
    isLoadingEstoque,
    isLoadingEstoqueBaixo
  } = useMedicamentos();

  // Calcular estatísticas
  const totalMedicamentos = medicamentos.length;
  const estoquesBaixos = medicamentosEstoqueBaixo?.length || 0;
  const vencendoEm30Dias = medicamentosEstoqueBaixo?.filter(item => 
    item.dias_restantes !== null && item.dias_restantes <= 30
  ).length || 0;

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Controle de Medicamentos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie medicamentos, estoque e prescrições dos residentes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar medicamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Medicamentos</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingMedicamentos ? "..." : totalMedicamentos}
            </div>
            <p className="text-xs text-muted-foreground">medicamentos cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {isLoadingEstoqueBaixo ? "..." : estoquesBaixos}
            </div>
            <p className="text-xs text-muted-foreground">medicamentos em falta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximo ao Vencimento</CardTitle>
            <Package className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {isLoadingEstoqueBaixo ? "..." : vencendoEm30Dias}
            </div>
            <p className="text-xs text-muted-foreground">vencendo em 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens em Estoque</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingEstoque ? "..." : estoqueMedicamentos.length}
            </div>
            <p className="text-xs text-muted-foreground">lotes cadastrados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="medicamentos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="medicamentos">Medicamentos</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="prescricoes">Prescrições</TabsTrigger>
          <TabsTrigger value="administracao">Administração</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="medicamentos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cadastro de Medicamentos</CardTitle>
                  <CardDescription>
                    Gerencie o cadastro geral de medicamentos disponíveis
                  </CardDescription>
                </div>
                <Dialog open={cadastroDialogOpen} onOpenChange={setCadastroDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Medicamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <CadastroMedicamentoForm 
                      onSuccess={() => setCadastroDialogOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
          </Card>
          
          <ListaMedicamentos />
        </TabsContent>

        <TabsContent value="estoque" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Controle de Estoque</CardTitle>
                  <CardDescription>
                    Monitore quantidades, lotes e validades dos medicamentos
                  </CardDescription>
                </div>
                <Dialog open={entradaDialogOpen} onOpenChange={setEntradaDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Entrada de Estoque
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <EntradaEstoqueForm 
                      onSuccess={() => setEntradaDialogOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {estoqueMedicamentos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum item no estoque ainda</p>
                  <p className="text-sm">Registre entradas para começar o controle</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Lista de estoque será implementada em breve</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescricoes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Prescrições por Residente</CardTitle>
                  <CardDescription>
                    Gerencie os medicamentos prescritos para cada residente
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Prescrição
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma prescrição cadastrada ainda</p>
                <p className="text-sm">Configure os medicamentos para cada residente</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="administracao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Administração de Medicamentos</CardTitle>
              <CardDescription>
                Registre a administração de medicamentos aos residentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma administração registrada hoje</p>
                <p className="text-sm">Registre quando administrar medicamentos</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertas de Estoque</CardTitle>
              <CardDescription>
                Medicamentos com estoque baixo ou próximos ao vencimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum alerta no momento</p>
                  <p className="text-sm">
                    <Badge variant="outline" className="mr-2">Estoque OK</Badge>
                    Todos os medicamentos estão com estoque adequado
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ControleMedicamentos;