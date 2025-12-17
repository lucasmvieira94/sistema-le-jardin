import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, MoreHorizontal, FileText, Plus, Edit, Ban, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useContratos } from "./useContratos";
import ContratoForm from "./ContratoForm";
import ContratoPDFGenerator from "./ContratoPDFGenerator";
import type { ContratoData, ContratoFormData, ResidenteData } from "./types";

interface ContratosListaProps {
  residenteId: string;
  residenteData: ResidenteData & { responsavel_nome?: string; responsavel_telefone?: string; responsavel_email?: string };
  onClose: () => void;
}

export default function ContratosLista({
  residenteId,
  residenteData,
  onClose,
}: ContratosListaProps) {
  const {
    contratos,
    loading,
    fetchContratos,
    criarContrato,
    atualizarContrato,
    alterarStatusContrato,
  } = useContratos();

  const [novoContratoOpen, setNovoContratoOpen] = useState(false);
  const [editarContratoOpen, setEditarContratoOpen] = useState(false);
  const [visualizarContratoOpen, setVisualizarContratoOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<ContratoData | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [novoStatus, setNovoStatus] = useState<string>("");

  useEffect(() => {
    fetchContratos(residenteId);
  }, [residenteId, fetchContratos]);

  const handleCriarContrato = async (data: ContratoFormData) => {
    setSaving(true);
    try {
      const contrato = await criarContrato(residenteId, data);
      setNovoContratoOpen(false);
      await fetchContratos(residenteId);
      // Abrir visualização do contrato recém-criado
      setSelectedContrato({
        ...contrato,
        servicos_inclusos: data.servicos_inclusos,
      });
      setVisualizarContratoOpen(true);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditarContrato = async (data: ContratoFormData) => {
    if (!selectedContrato?.id) return;
    setSaving(true);
    try {
      await atualizarContrato(selectedContrato.id, data);
      setEditarContratoOpen(false);
      await fetchContratos(residenteId);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleAlterarStatus = async () => {
    if (!selectedContrato?.id || !novoStatus) return;
    try {
      await alterarStatusContrato(selectedContrato.id, novoStatus);
      setStatusDialogOpen(false);
      await fetchContratos(residenteId);
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ativo":
        return <Badge className="bg-green-500 hover:bg-green-600">Ativo</Badge>;
      case "suspenso":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Suspenso</Badge>;
      case "encerrado":
        return <Badge className="bg-red-500 hover:bg-red-600">Encerrado</Badge>;
      case "pendente":
        return <Badge variant="secondary">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openStatusDialog = (contrato: ContratoData, status: string) => {
    setSelectedContrato(contrato);
    setNovoStatus(status);
    setStatusDialogOpen(true);
  };

  const contratoToFormData = (contrato: ContratoData): ContratoFormData => ({
    valor_mensalidade: contrato.valor_mensalidade.toString(),
    dia_vencimento: contrato.dia_vencimento.toString(),
    forma_pagamento: contrato.forma_pagamento,
    data_inicio_contrato: contrato.data_inicio_contrato,
    data_fim_contrato: contrato.data_fim_contrato || "",
    contratante_nome: contrato.contratante_nome,
    contratante_cpf: contrato.contratante_cpf || "",
    contratante_rg: contrato.contratante_rg || "",
    contratante_endereco: contrato.contratante_endereco || "",
    contratante_cidade: contrato.contratante_cidade || "",
    contratante_estado: contrato.contratante_estado || "",
    contratante_cep: contrato.contratante_cep || "",
    contratante_telefone: contrato.contratante_telefone || "",
    contratante_email: contrato.contratante_email || "",
    servicos_inclusos: contrato.servicos_inclusos || [],
    servicos_adicionais: contrato.servicos_adicionais || "",
    clausulas_especiais: contrato.clausulas_especiais || "",
    observacoes: contrato.observacoes || "",
  });

  return (
    <div className="space-y-4">
      {/* Header com botão de novo contrato */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Contratos de {residenteData.nome_completo}</h3>
          <p className="text-sm text-muted-foreground">
            Prontuário: {residenteData.numero_prontuario}
          </p>
        </div>
        <Button onClick={() => setNovoContratoOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Contrato
        </Button>
      </div>

      {/* Lista de contratos */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Carregando contratos...
        </div>
      ) : contratos.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Nenhum contrato cadastrado</p>
          <Button onClick={() => setNovoContratoOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Criar primeiro contrato
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Contrato</TableHead>
                <TableHead>Valor Mensal</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratos.map((contrato) => (
                <TableRow key={contrato.id}>
                  <TableCell className="font-medium">
                    {contrato.numero_contrato}
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(contrato.valor_mensalidade)}
                  </TableCell>
                  <TableCell>Dia {contrato.dia_vencimento}</TableCell>
                  <TableCell>
                    {format(new Date(contrato.data_inicio_contrato), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>{getStatusBadge(contrato.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedContrato(contrato);
                            setVisualizarContratoOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Visualizar / PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedContrato(contrato);
                            setEditarContratoOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {contrato.status !== "ativo" && (
                          <DropdownMenuItem
                            onClick={() => openStatusDialog(contrato, "ativo")}
                          >
                            <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                            Ativar
                          </DropdownMenuItem>
                        )}
                        {contrato.status !== "suspenso" && (
                          <DropdownMenuItem
                            onClick={() => openStatusDialog(contrato, "suspenso")}
                          >
                            <Ban className="w-4 h-4 mr-2 text-yellow-600" />
                            Suspender
                          </DropdownMenuItem>
                        )}
                        {contrato.status !== "encerrado" && (
                          <DropdownMenuItem
                            onClick={() => openStatusDialog(contrato, "encerrado")}
                          >
                            <XCircle className="w-4 h-4 mr-2 text-red-600" />
                            Encerrar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog para novo contrato */}
      <Dialog open={novoContratoOpen} onOpenChange={setNovoContratoOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Contrato - {residenteData.nome_completo}</DialogTitle>
          </DialogHeader>
          <ContratoForm
            residenteNome={residenteData.nome_completo}
            responsavelNome={residenteData.responsavel_nome}
            responsavelTelefone={residenteData.responsavel_telefone}
            responsavelEmail={residenteData.responsavel_email}
            onSubmit={handleCriarContrato}
            onCancel={() => setNovoContratoOpen(false)}
            isLoading={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog para editar contrato */}
      <Dialog open={editarContratoOpen} onOpenChange={setEditarContratoOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar Contrato {selectedContrato?.numero_contrato}
            </DialogTitle>
          </DialogHeader>
          {selectedContrato && (
            <ContratoForm
              initialData={contratoToFormData(selectedContrato)}
              residenteNome={residenteData.nome_completo}
              responsavelNome={residenteData.responsavel_nome}
              responsavelTelefone={residenteData.responsavel_telefone}
              responsavelEmail={residenteData.responsavel_email}
              onSubmit={handleEditarContrato}
              onCancel={() => setEditarContratoOpen(false)}
              isLoading={saving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Visualização do contrato para PDF */}
      {selectedContrato && (
        <ContratoPDFGenerator
          open={visualizarContratoOpen}
          onOpenChange={setVisualizarContratoOpen}
          contrato={selectedContrato}
          residente={residenteData}
          empresa={{
            nome_empresa: "LE JARDIN RESIDENCIAL SÊNIOR LTDA ME",
            cnpj: "48.897.411/0001-58",
            endereco: "Rua Promotor Arquibaldo Mendonça, 660, Bairro Suíssa, Aracaju/SE",
          }}
        />
      )}

      {/* Dialog de confirmação de alteração de status */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de status</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente {novoStatus === "ativo" ? "ativar" : novoStatus === "suspenso" ? "suspender" : "encerrar"}{" "}
              o contrato nº {selectedContrato?.numero_contrato}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAlterarStatus}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
