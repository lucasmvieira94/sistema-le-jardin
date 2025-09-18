import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Thermometer, Download, FileText, Calendar, Clock, CheckCircle, XCircle } from "lucide-react";
import { FormularioTemperatura } from "@/components/temperatura/FormularioTemperatura";
import { HistoricoTemperatura } from "@/components/temperatura/HistoricoTemperatura";
import { ExportarTemperatura } from "@/components/temperatura/ExportarTemperatura";
import { useTemperatura } from "@/hooks/useTemperatura";

const ControleTemperatura = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  const { 
    registrosTemperatura,
    estatisticas,
    isLoading 
  } = useTemperatura();

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Thermometer className="h-8 w-8 text-primary" />
            Controle de Temperatura
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoramento da sala de medicamentos - ANVISA RDC 430/2020 e RDC 301/2019
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Input
            placeholder="Buscar registros..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registros Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : estatisticas?.registrosHoje || 0}
            </div>
            <p className="text-xs text-muted-foreground">medições realizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conformidade</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? "..." : `${estatisticas?.percentualConformidade || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">dentro da faixa (15°C-30°C)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Não Conformes</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {isLoading ? "..." : estatisticas?.registrosNaoConformes || 0}
            </div>
            <p className="text-xs text-muted-foreground">fora da faixa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Medição</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {estatisticas?.ultimaMedicao ? 
                new Date(estatisticas.ultimaMedicao).toLocaleTimeString('pt-BR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }) : "--:--"
              }
            </div>
            <p className="text-xs text-muted-foreground">horário da medição</p>
          </CardContent>
        </Card>
      </div>

      {/* Botões de Ação */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Thermometer className="h-4 w-4 mr-2" />
              Nova Medição
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <FormularioTemperatura 
              onSuccess={() => setShowFormDialog(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Exportar Relatório
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <ExportarTemperatura />
          </DialogContent>
        </Dialog>
      </div>

      {/* Histórico de Registros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Registros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HistoricoTemperatura searchTerm={searchTerm} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ControleTemperatura;