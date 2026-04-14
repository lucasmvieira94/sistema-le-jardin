import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, Package, AlertTriangle, Plus, FileText, ShieldAlert, User, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CadastroMedicamentoForm } from "@/components/medicamentos/CadastroMedicamentoForm";
import { ListaMedicamentos } from "@/components/medicamentos/ListaMedicamentos";
import { EstoqueResidente } from "@/components/medicamentos/EstoqueResidente";
import { EstoqueUrgencia } from "@/components/medicamentos/EstoqueUrgencia";
import { MapaMedicamentos } from "@/components/medicamentos/MapaMedicamentos";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { Badge } from "@/components/ui/badge";

const ControleMedicamentos = () => {
  const [cadastroDialogOpen, setCadastroDialogOpen] = useState(false);

  const {
    medicamentos,
    estoqueResidentes,
    estoqueUrgencia,
    prescricoes,
    medicamentosEstoqueBaixo,
    isLoadingMedicamentos,
    isLoadingEstoqueResidentes,
    isLoadingEstoqueUrgencia,
    isLoadingEstoqueBaixo,
  } = useMedicamentos();

  const totalMedicamentos = medicamentos.length;
  const estoquesBaixos = medicamentosEstoqueBaixo?.length || 0;
  const totalPrescricoes = prescricoes.length;
  const totalEstoqueUrgencia = estoqueUrgencia.length;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Controle de Medicamentos</h1>
          <p className="text-muted-foreground mt-1">
            Catálogo, estoque por residente, urgência e mapa de prescrições
          </p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Catálogo</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingMedicamentos ? "..." : totalMedicamentos}</div>
            <p className="text-xs text-muted-foreground">medicamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{isLoadingEstoqueBaixo ? "..." : estoquesBaixos}</div>
            <p className="text-xs text-muted-foreground">alertas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgência</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingEstoqueUrgencia ? "..." : totalEstoqueUrgencia}</div>
            <p className="text-xs text-muted-foreground">itens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prescrições</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPrescricoes}</div>
            <p className="text-xs text-muted-foreground">ativas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="catalogo" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="catalogo" className="gap-1">
            <Pill className="h-4 w-4 hidden sm:block" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="estoque-residente" className="gap-1">
            <User className="h-4 w-4 hidden sm:block" />
            Por Residente
          </TabsTrigger>
          <TabsTrigger value="urgencia" className="gap-1">
            <ShieldAlert className="h-4 w-4 hidden sm:block" />
            Urgência
          </TabsTrigger>
          <TabsTrigger value="mapa" className="gap-1">
            <Map className="h-4 w-4 hidden sm:block" />
            Mapa
          </TabsTrigger>
        </TabsList>

        {/* ABA: CATÁLOGO */}
        <TabsContent value="catalogo" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Catálogo de Medicamentos</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Base centralizada — cadastre uma vez, reutilize em entradas e prescrições
                  </p>
                </div>
                <Dialog open={cadastroDialogOpen} onOpenChange={setCadastroDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" />Novo Medicamento</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <CadastroMedicamentoForm onSuccess={() => setCadastroDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
          </Card>
          <ListaMedicamentos />
        </TabsContent>

        {/* ABA: ESTOQUE POR RESIDENTE */}
        <TabsContent value="estoque-residente">
          <EstoqueResidente />
        </TabsContent>

        {/* ABA: URGÊNCIA */}
        <TabsContent value="urgencia">
          <EstoqueUrgencia />
        </TabsContent>

        {/* ABA: MAPA DE MEDICAMENTOS */}
        <TabsContent value="mapa">
          <MapaMedicamentos />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ControleMedicamentos;
