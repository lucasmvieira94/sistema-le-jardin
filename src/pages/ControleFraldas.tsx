import { useState } from "react";
import { Package, Plus, History, Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useFraldas } from "@/hooks/useFraldas";
import { CadastroEstoqueFraldaForm } from "@/components/fraldas/CadastroEstoqueFraldaForm";
import { ListaEstoqueFraldas } from "@/components/fraldas/ListaEstoqueFraldas";
import { RegistroUsoFraldaForm } from "@/components/fraldas/RegistroUsoFraldaForm";
import { HistoricoUsoFraldas } from "@/components/fraldas/HistoricoUsoFraldas";
import { ConfiguracoesAlertasFraldas } from "@/components/fraldas/ConfiguracoesAlertasFraldas";

const ControleFraldas = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCadastroDialog, setShowCadastroDialog] = useState(false);
  const [showUsoDialog, setShowUsoDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  const { estoques, alertas } = useFraldas();

  const totalEstoque = estoques?.reduce((acc, e) => acc + e.quantidade_atual, 0) || 0;
  const alertasCriticos = alertas?.filter(a => a.nivel_alerta === 'critico').length || 0;
  const alertasAviso = alertas?.filter(a => a.nivel_alerta === 'aviso').length || 0;
  const tiposEstoque = estoques?.length || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Controle de Fraldas</h1>
          <p className="text-muted-foreground">
            Gerenciamento de estoque e uso de fraldas
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showUsoDialog} onOpenChange={setShowUsoDialog}>
            <DialogTrigger asChild>
              <Button>
                <History className="mr-2 h-4 w-4" />
                Registrar Uso
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <RegistroUsoFraldaForm onSuccess={() => setShowUsoDialog(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={showCadastroDialog} onOpenChange={setShowCadastroDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Estoque
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <CadastroEstoqueFraldaForm onSuccess={() => setShowCadastroDialog(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <ConfiguracoesAlertasFraldas onSuccess={() => setShowConfigDialog(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total em Estoque</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEstoque}</div>
            <p className="text-xs text-muted-foreground">unidades disponíveis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipos Cadastrados</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tiposEstoque}</div>
            <p className="text-xs text-muted-foreground">tipos diferentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{alertasCriticos}</div>
            <p className="text-xs text-muted-foreground">requerem atenção imediata</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avisos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{alertasAviso}</div>
            <p className="text-xs text-muted-foreground">estoques em aviso</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="estoque" className="space-y-4">
        <TabsList>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Uso</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="estoque" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estoque de Fraldas</CardTitle>
              <CardDescription>
                Gerencie o estoque de fraldas cadastradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  placeholder="Buscar por tipo ou tamanho..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <ListaEstoqueFraldas searchTerm={searchTerm} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Uso</CardTitle>
              <CardDescription>
                Visualize o histórico de uso de fraldas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HistoricoUsoFraldas />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertas de Estoque</CardTitle>
              <CardDescription>
                Fraldas que precisam de reposição
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alertas && alertas.length > 0 ? (
                <div className="space-y-4">
                  {alertas.map((alerta) => (
                    <div
                      key={alerta.estoque_id}
                      className={`p-4 rounded-lg border ${
                        alerta.nivel_alerta === 'critico'
                          ? 'bg-destructive/10 border-destructive'
                          : alerta.nivel_alerta === 'aviso'
                          ? 'bg-warning/10 border-warning'
                          : 'bg-muted border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold">
                            {alerta.tipo_fralda} - {alerta.tamanho}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {alerta.localizacao || 'Sem localização'}
                          </p>
                          <div className="flex gap-4 mt-2 text-sm">
                            <span>
                              <strong>Quantidade:</strong> {alerta.quantidade_atual} unidades
                            </span>
                            <span>
                              <strong>Consumo médio:</strong>{' '}
                              {alerta.consumo_medio_diario.toFixed(1)} un/dia
                            </span>
                            <span className="font-semibold">
                              Suficiente para {alerta.dias_restantes} dias
                            </span>
                          </div>
                        </div>
                        <AlertTriangle
                          className={`h-5 w-5 ${
                            alerta.nivel_alerta === 'critico'
                              ? 'text-destructive'
                              : alerta.nivel_alerta === 'aviso'
                              ? 'text-warning'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum alerta de estoque no momento
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ControleFraldas;
