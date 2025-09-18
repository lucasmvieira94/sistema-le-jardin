import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Eye, Calendar, Thermometer, User, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTemperatura } from "@/hooks/useTemperatura";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HistoricoTemperaturaProps {
  searchTerm: string;
}

export function HistoricoTemperatura({ searchTerm }: HistoricoTemperaturaProps) {
  const { registrosTemperatura, isLoading } = useTemperatura();
  const [registroSelecionado, setRegistroSelecionado] = useState<any>(null);

  // Filtrar registros baseado no termo de busca
  const registrosFiltrados = registrosTemperatura.filter(registro =>
    registro.nome_responsavel.toLowerCase().includes(searchTerm.toLowerCase()) ||
    registro.localizacao_sala.toLowerCase().includes(searchTerm.toLowerCase()) ||
    registro.observacoes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    registro.periodo_dia.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTemperaturaColor = (temperatura: number, conformidade: boolean) => {
    if (!conformidade) {
      return temperatura < 15 ? "text-blue-600" : "text-red-600";
    }
    return "text-green-600";
  };

  const formatPeriodo = (periodo: string) => {
    const periodos = {
      manha: "Manhã",
      tarde: "Tarde", 
      noite: "Noite",
      madrugada: "Madrugada"
    };
    return periodos[periodo as keyof typeof periodos] || periodo;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-muted-foreground">Carregando registros...</div>
      </div>
    );
  }

  if (registrosFiltrados.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Thermometer className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum registro de temperatura encontrado</p>
        {searchTerm && (
          <p className="text-sm">Tente ajustar os termos de busca</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Versão Mobile - Cards */}
      <div className="block md:hidden space-y-3">
        {registrosFiltrados.map((registro) => (
          <Card key={registro.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{ color: getTemperaturaColor(registro.temperatura, registro.conformidade) }}>
                  {registro.temperatura}°C
                </span>
                {registro.conformidade ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <Badge variant={registro.conformidade ? "secondary" : "destructive"}>
                {registro.conformidade ? "Conforme" : "Não Conforme"}
              </Badge>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(new Date(registro.data_registro), "dd/MM/yyyy", { locale: ptBR })}</span>
                <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                <span>{registro.horario_medicao} - {formatPeriodo(registro.periodo_dia)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{registro.nome_responsavel}</span>
              </div>
              
              <div className="text-muted-foreground">
                {registro.localizacao_sala}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Detalhes do Registro</DialogTitle>
                  </DialogHeader>
                  <DetalheRegistro registro={registro} />
                </DialogContent>
              </Dialog>
            </div>
          </Card>
        ))}
      </div>

      {/* Versão Desktop - Tabela */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Temperatura</TableHead>
              <TableHead>Conformidade</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Local</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrosFiltrados.map((registro) => (
              <TableRow key={registro.id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">
                      {format(new Date(registro.data_registro), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {registro.horario_medicao}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {formatPeriodo(registro.periodo_dia)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span 
                      className={`text-xl font-bold ${getTemperaturaColor(registro.temperatura, registro.conformidade)}`}
                    >
                      {registro.temperatura}°C
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {registro.conformidade ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Conforme
                        </Badge>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <Badge variant="destructive">
                          Não Conforme
                        </Badge>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{registro.nome_responsavel}</div>
                </TableCell>
                <TableCell>
                  <div className="text-muted-foreground">{registro.localizacao_sala}</div>
                </TableCell>
                <TableCell className="text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Detalhes do Registro</DialogTitle>
                      </DialogHeader>
                      <DetalheRegistro registro={registro} />
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DetalheRegistro({ registro }: { registro: any }) {
  const formatPeriodo = (periodo: string) => {
    const periodos = {
      manha: "Manhã",
      tarde: "Tarde", 
      noite: "Noite",
      madrugada: "Madrugada"
    };
    return periodos[periodo as keyof typeof periodos] || periodo;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold mb-2">Informações Gerais</h4>
          <div className="space-y-2 text-sm">
            <div><strong>Data:</strong> {format(new Date(registro.data_registro), "dd/MM/yyyy", { locale: ptBR })}</div>
            <div><strong>Horário:</strong> {registro.horario_medicao}</div>
            <div><strong>Período:</strong> {formatPeriodo(registro.periodo_dia)}</div>
            <div><strong>Local:</strong> {registro.localizacao_sala}</div>
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold mb-2">Medição</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <strong>Temperatura:</strong> 
              <span className={`text-lg font-bold ${registro.conformidade ? 'text-green-600' : (registro.temperatura < 15 ? 'text-blue-600' : 'text-red-600')}`}>
                {registro.temperatura}°C
              </span>
            </div>
            <div className="flex items-center gap-2">
              <strong>Conformidade:</strong>
              {registro.conformidade ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Conforme (15°C - 30°C)
                </Badge>
              ) : (
                <Badge variant="destructive">
                  Não Conforme
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Responsável</h4>
        <div className="text-sm">
          <div><strong>Nome:</strong> {registro.nome_responsavel}</div>
        </div>
      </div>

      {registro.acoes_corretivas && (
        <div>
          <h4 className="font-semibold mb-2 text-red-600">Ações Corretivas</h4>
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
            {registro.acoes_corretivas}
          </div>
        </div>
      )}

      {registro.observacoes && (
        <div>
          <h4 className="font-semibold mb-2">Observações</h4>
          <div className="p-3 bg-gray-50 border rounded text-sm">
            {registro.observacoes}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground pt-2 border-t">
        Registro criado em: {format(new Date(registro.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </div>
    </div>
  );
}