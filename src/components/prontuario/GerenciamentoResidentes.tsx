import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Edit, Eye, Upload, Download, UserX, UserCheck, FileText, FileDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from 'xlsx';
import ContratoForm from "@/components/residentes/ContratoForm";
import ContratoPDFGenerator from "@/components/residentes/ContratoPDFGenerator";
import { useContratos } from "@/components/residentes/useContratos";

interface Residente {
  id: string;
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  numero_prontuario: string;
  quarto: string;
  responsavel_nome: string;
  responsavel_telefone: string;
  responsavel_email: string;
  condicoes_medicas: string;
  observacoes_gerais: string;
  ativo: boolean;
  created_at: string;
}

export default function GerenciamentoResidentes() {
  const { toast } = useToast();
  const [residentes, setResidentes] = useState<Residente[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingResident, setEditingResident] = useState<Residente | null>(null);
  
  // Estados para contratos
  const [contratoDialogOpen, setContratoDialogOpen] = useState(false);
  const [contratoVisualizarOpen, setContratoVisualizarOpen] = useState(false);
  const [selectedResidente, setSelectedResidente] = useState<Residente | null>(null);
  const [selectedContrato, setSelectedContrato] = useState<any>(null);
  const [savingContrato, setSavingContrato] = useState(false);
  
  const { contratos, fetchContratos, criarContrato } = useContratos();
  
  const [formData, setFormData] = useState({
    nome_completo: "",
    cpf: "",
    data_nascimento: "",
    numero_prontuario: "",
    quarto: "",
    responsavel_nome: "",
    responsavel_telefone: "",
    responsavel_email: "",
    condicoes_medicas: "",
    observacoes_gerais: ""
  });

  useEffect(() => {
    fetchResidentes();
  }, []);

  const fetchResidentes = async () => {
    try {
      const { data, error } = await supabase
        .from('residentes')
        .select('*')
        .order('nome_completo');

      if (error) throw error;
      setResidentes(data || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar residentes",
        description: "Não foi possível carregar a lista de residentes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const gerarNumeroProntuario = async () => {
    try {
      // Buscar todos os números de prontuário existentes
      const { data, error } = await supabase
        .from('residentes')
        .select('numero_prontuario')
        .eq('ativo', true);

      if (error) throw error;

      // Extrair todos os números existentes e encontrar o maior
      const numerosExistentes = (data || [])
        .map(item => {
          const match = item.numero_prontuario?.match(/P(\d+)/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(num => num > 0);

      // Encontrar o próximo número disponível
      let proximoNumero = 1;
      if (numerosExistentes.length > 0) {
        const maiorNumero = Math.max(...numerosExistentes);
        proximoNumero = maiorNumero + 1;
      }

      // Formatar como P0001, P0002, etc.
      return `P${proximoNumero.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Erro ao gerar número do prontuário:', error);
      return `P${Date.now().toString().slice(-4)}`; // Fallback usando timestamp
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingResident) {
        const { error } = await supabase
          .from('residentes')
          .update(formData)
          .eq('id', editingResident.id);
        
        if (error) throw error;
        
        toast({
          title: "Residente atualizado",
          description: "Os dados do residente foram atualizados com sucesso.",
        });
      } else {
        // Gerar número do prontuário automaticamente para novos residentes
        const numeroProntuario = await gerarNumeroProntuario();
        const dadosInsercao = {
          ...formData,
          numero_prontuario: numeroProntuario
        };
        
        const { error } = await supabase
          .from('residentes')
          .insert(dadosInsercao);
        
        if (error) throw error;
        
        toast({
          title: "Residente cadastrado",
          description: `O residente foi cadastrado com sucesso. Prontuário: ${numeroProntuario}`,
        });
      }
      
      setDialogOpen(false);
      setEditingResident(null);
      resetForm();
      fetchResidentes();
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar os dados do residente.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (residente: Residente) => {
    setEditingResident(residente);
    setFormData({
      nome_completo: residente.nome_completo,
      cpf: residente.cpf || "",
      data_nascimento: residente.data_nascimento,
      numero_prontuario: residente.numero_prontuario,
      quarto: residente.quarto || "",
      responsavel_nome: residente.responsavel_nome || "",
      responsavel_telefone: residente.responsavel_telefone || "",
      responsavel_email: residente.responsavel_email || "",
      condicoes_medicas: residente.condicoes_medicas || "",
      observacoes_gerais: residente.observacoes_gerais || ""
    });
    setDialogOpen(true);
  };

  const handleToggleStatus = async (residente: Residente) => {
    try {
      const { error } = await supabase
        .from('residentes')
        .update({ ativo: !residente.ativo })
        .eq('id', residente.id);
      
      if (error) throw error;
      
      toast({
        title: residente.ativo ? "Residente inativado" : "Residente ativado",
        description: `${residente.nome_completo} foi ${residente.ativo ? 'inativado' : 'ativado'} com sucesso.`,
      });
      
      fetchResidentes();
    } catch (error) {
      toast({
        title: "Erro ao alterar status",
        description: "Não foi possível alterar o status do residente.",
        variant: "destructive",
      });
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Nome Completo': 'João da Silva',
        'CPF': '123.456.789-00',
        'Data de Nascimento': '1980-01-15',
        'Quarto/Acomodação': '101A',
        'Nome do Responsável': 'Maria da Silva',
        'Telefone do Responsável': '(11) 99999-9999',
        'Email do Responsável': 'maria@email.com',
        'Condições Médicas': 'Diabetes, Hipertensão',
        'Observações Gerais': 'Prefere janelas abertas'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Residentes');
    
    // Definir larguras das colunas
    const columnWidths = [
      { wch: 20 }, // Nome Completo
      { wch: 15 }, // CPF
      { wch: 18 }, // Data de Nascimento
      { wch: 15 }, // Quarto
      { wch: 20 }, // Nome do Responsável
      { wch: 18 }, // Telefone
      { wch: 25 }, // Email
      { wch: 30 }, // Condições Médicas
      { wch: 30 }, // Observações
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.writeFile(workbook, 'template_residentes.xlsx');
    
    toast({
      title: "Template baixado",
      description: "O template foi baixado com sucesso. Preencha os dados e faça o upload.",
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Arquivo selecionado:', file.name, 'Tipo:', file.type, 'Tamanho:', file.size);

    // Verificar tipo de arquivo
    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      console.log('Tipo de arquivo rejeitado:', file.type);
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    
    try {
      console.log('Iniciando leitura do arquivo...');
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          console.log('Arquivo lido, processando dados...');
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          console.log('Workbook criado, sheets:', workbook.SheetNames);
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Planilha vazia ou inválida');
          }
          
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          console.log('Dados extraídos da planilha:', jsonData.length, 'linhas');
          console.log('Primeira linha de dados:', jsonData[0]);

          if (jsonData.length === 0) {
            toast({
              title: "Planilha vazia",
              description: "A planilha não contém dados válidos para importação.",
              variant: "destructive",
            });
            setImporting(false);
            return;
          }

          // Validação de duplicatas - buscar residentes existentes
          console.log('Verificando residentes existentes...');
          const { data: residentesExistentes, error: errorBusca } = await supabase
            .from('residentes')
            .select('id, numero_prontuario, cpf, nome_completo')
            .eq('ativo', true);

          if (errorBusca) {
            console.error('Erro ao buscar residentes existentes:', errorBusca);
            toast({
              title: "Erro ao validar dados existentes",
              description: "Não foi possível verificar duplicatas.",
              variant: "destructive",
            });
            setImporting(false);
            return;
          }

          const cpfsExistentes = new Set(
            residentesExistentes?.map(r => r.cpf?.replace(/\D/g, '')).filter(Boolean) || []
          );
          
          const prontuariosExistentes = new Set(
            residentesExistentes?.map(r => r.numero_prontuario).filter(Boolean) || []
          );

          const processedData = [];
          const errors = [];

          // Determinar o próximo número de prontuário base uma única vez
          let proximoNumero = 1;
          try {
            const { data: dadosProntuario, error: erroProntuario } = await supabase
              .from('residentes')
              .select('numero_prontuario')
              .eq('ativo', true);

            if (erroProntuario) throw erroProntuario;

            // Extrair todos os números existentes e encontrar o maior
            const numerosExistentes = (dadosProntuario || [])
              .map(item => {
                const match = item.numero_prontuario?.match(/P(\d+)/);
                return match ? parseInt(match[1]) : 0;
              })
              .filter(num => num > 0);

            if (numerosExistentes.length > 0) {
              const maiorNumero = Math.max(...numerosExistentes);
              proximoNumero = maiorNumero + 1;
            }
          } catch (error) {
            console.error('Erro ao determinar próximo número de prontuário:', error);
            proximoNumero = 1;
          }

          console.log('Iniciando processamento de', jsonData.length, 'linhas...');
          console.log('Próximo número de prontuário base:', proximoNumero);

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i] as any;
            const linha = i + 2; // +2 porque a linha 1 é cabeçalho e arrays começam em 0

            console.log(`Processando linha ${linha}:`, row);

            // Validar campos obrigatórios
            if (!row['Nome Completo']) {
              console.log(`Linha ${linha}: Nome completo está vazio`);
              errors.push(`Linha ${linha}: Nome completo é obrigatório`);
              continue;
            }

            if (!row['Data de Nascimento']) {
              console.log(`Linha ${linha}: Data de nascimento está vazia`);
              errors.push(`Linha ${linha}: Data de nascimento é obrigatória`);
              continue;
            }

            // Processar e validar tamanhos dos campos primeiro
            const cpfLimpo = row['CPF']?.toString().replace(/\D/g, '').trim() || null;
            const telefone = row['Telefone do Responsável']?.toString().trim() || null;
            
            // Validar CPF duplicado
            if (cpfLimpo) {
              if (cpfsExistentes.has(cpfLimpo)) {
                console.log(`Linha ${linha}: CPF ${cpfLimpo} já existe no banco`);
                errors.push(`Linha ${linha}: CPF ${cpfLimpo} já está cadastrado`);
                continue;
              }
              // Adicionar à lista de verificação para evitar duplicatas na própria planilha
              cpfsExistentes.add(cpfLimpo);
            }

            // Gerar número do prontuário sequencial
            const numeroProntuario = `P${proximoNumero.toString().padStart(4, '0')}`;
            console.log(`Número do prontuário gerado: ${numeroProntuario}`);
            
            // Incrementar para o próximo residente
            proximoNumero++;
            
            // Adicionar à lista para controle
            prontuariosExistentes.add(numeroProntuario);
            
            // Processar data de nascimento
            let dataNascimento = '';
            try {
              console.log(`Processando data de nascimento para linha ${linha}:`, row['Data de Nascimento']);
              if (typeof row['Data de Nascimento'] === 'number') {
                // Excel date serial number
                const excelDate = new Date((row['Data de Nascimento'] - 25569) * 86400 * 1000);
                dataNascimento = excelDate.toISOString().split('T')[0];
              } else if (typeof row['Data de Nascimento'] === 'string') {
                // String date
                const parsedDate = new Date(row['Data de Nascimento']);
                if (isNaN(parsedDate.getTime())) {
                  errors.push(`Linha ${linha}: Data de nascimento inválida`);
                  continue;
                }
                dataNascimento = parsedDate.toISOString().split('T')[0];
              }
              console.log(`Data processada: ${dataNascimento}`);
            } catch (error) {
              console.error(`Erro ao processar data na linha ${linha}:`, error);
              errors.push(`Linha ${linha}: Erro ao processar data de nascimento`);
              continue;
            }

            // Validar tamanhos dos campos para evitar erros de banco
            const nomeCompleto = row['Nome Completo']?.toString().trim();
            if (nomeCompleto && nomeCompleto.length > 255) {
              console.log(`Linha ${linha}: Nome muito longo (${nomeCompleto.length} caracteres)`);
              errors.push(`Linha ${linha}: Nome muito longo (máximo 255 caracteres)`);
              continue;
            }
            
            if (cpfLimpo && cpfLimpo.length > 11) {
              console.log(`Linha ${linha}: CPF inválido (${cpfLimpo.length} caracteres)`);
              errors.push(`Linha ${linha}: CPF inválido (deve conter apenas números)`);
              continue;
            }
            
            const quartoOriginal = row['Quarto/Acomodação']?.toString().trim() || null;
            let quarto = quartoOriginal;
            
            if (quarto && quarto.length > 10) {
              console.log(`Linha ${linha}: Quarto muito longo (${quarto.length} caracteres), truncando para 10 caracteres`);
              quarto = quarto.substring(0, 10);
            }
            
            if (telefone && telefone.length > 20) {
              console.log(`Linha ${linha}: Telefone muito longo (${telefone.length} caracteres)`);
              errors.push(`Linha ${linha}: Telefone do responsável muito longo (máximo 20 caracteres)`);
              continue;
            }

            const dadosProcessados = {
              nome_completo: nomeCompleto,
              cpf: cpfLimpo,
              data_nascimento: dataNascimento,
              numero_prontuario: numeroProntuario,
              quarto: quarto,
              responsavel_nome: row['Nome do Responsável']?.toString().trim()?.substring(0, 255) || null,
              responsavel_telefone: telefone,
              responsavel_email: row['Email do Responsável']?.toString().trim()?.substring(0, 255) || null,
              condicoes_medicas: row['Condições Médicas']?.toString().trim() || null,
              observacoes_gerais: row['Observações Gerais']?.toString().trim() || null,
              ativo: true
            };

            console.log(`Dados processados para linha ${linha}:`, dadosProcessados);
            processedData.push(dadosProcessados);
          }

          console.log('Validação concluída. Erros encontrados:', errors.length);
          console.log('Dados processados:', processedData.length);

          if (errors.length > 0) {
            console.log('Lista de erros:', errors);
            toast({
              title: "Erros encontrados na planilha",
              description: errors.slice(0, 3).join('; ') + (errors.length > 3 ? '...' : ''),
              variant: "destructive",
            });
            setImporting(false);
            return;
          }

          if (processedData.length === 0) {
            console.log('Nenhum dado válido processado');
            toast({
              title: "Nenhum dado válido encontrado",
              description: "Verifique se a planilha está preenchida corretamente.",
              variant: "destructive",
            });
            setImporting(false);
            return;
          }

          // Inserir dados no banco
          console.log('Inserindo dados no banco...', processedData);
          const { error } = await supabase
            .from('residentes')
            .insert(processedData);

          if (error) {
            console.error('Erro ao inserir no banco:', error);
            throw new Error(
              error.code === '22001' 
                ? 'Alguns dados excedem o tamanho permitido. Verifique os tamanhos dos campos na planilha.'
                : `Erro no banco de dados: ${error.message || 'Erro desconhecido'}`
            );
          }

          console.log('Inserção concluída com sucesso');
          toast({
            title: "Importação concluída",
            description: `${processedData.length} residente(s) importado(s) com sucesso.`,
          });

          setImportDialogOpen(false);
          fetchResidentes();
          
        } catch (error) {
          console.error('Erro detalhado ao processar arquivo:', error);
          console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
          toast({
            title: "Erro ao processar arquivo",
            description: error instanceof Error ? error.message : "Verifique se o arquivo está no formato correto.",
            variant: "destructive",
          });
        } finally {
          setImporting(false);
        }
      };
      
      reader.onerror = (error) => {
        console.error('Erro ao ler arquivo:', error);
        toast({
          title: "Erro ao ler arquivo",
          description: "Não foi possível ler o arquivo selecionado.",
          variant: "destructive",
        });
        setImporting(false);
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Erro no try/catch principal:', error);
      toast({
        title: "Erro ao ler arquivo",
        description: "Não foi possível ler o arquivo selecionado.",
        variant: "destructive",
      });
      setImporting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome_completo: "",
      cpf: "",
      data_nascimento: "",
      numero_prontuario: "",
      quarto: "",
      responsavel_nome: "",
      responsavel_telefone: "",
      responsavel_email: "",
      condicoes_medicas: "",
      observacoes_gerais: ""
    });
  };

  const openNewDialog = async () => {
    setEditingResident(null);
    resetForm();
    // Gerar número do prontuário automaticamente para exibição
    const numeroProntuario = await gerarNumeroProntuario();
    setFormData(prev => ({
      ...prev,
      numero_prontuario: numeroProntuario
    }));
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando residentes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gerenciamento de Residentes
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Baixar Template
            </Button>
            
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Importar Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Importar Residentes</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>1. Baixe o template clicando em "Baixar Template"</p>
                    <p>2. Preencha a planilha com os dados dos residentes</p>
                    <p>3. Selecione o arquivo preenchido abaixo</p>
                  </div>
                  
                  <div>
                    <Label htmlFor="file-upload">Selecionar arquivo Excel (.xlsx)</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      disabled={importing}
                      className="mt-1"
                    />
                  </div>
                  
                  {importing && (
                    <div className="text-center text-sm text-muted-foreground">
                      Processando arquivo... Aguarde.
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setImportDialogOpen(false)}
                      disabled={importing}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewDialog} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Residente
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingResident ? "Editar Residente" : "Novo Residente"}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome_completo">Nome completo *</Label>
                    <Input
                      id="nome_completo"
                      value={formData.nome_completo}
                      onChange={(e) => setFormData({...formData, nome_completo: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="data_nascimento">Data de nascimento *</Label>
                    <Input
                      id="data_nascimento"
                      type="date"
                      value={formData.data_nascimento}
                      onChange={(e) => setFormData({...formData, data_nascimento: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="numero_prontuario">Número do prontuário *</Label>
                    <Input
                      id="numero_prontuario"
                      value={formData.numero_prontuario}
                      onChange={(e) => setFormData({...formData, numero_prontuario: e.target.value})}
                      required
                      disabled={!editingResident}
                      placeholder="Será gerado automaticamente"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="quarto">Quarto/Acomodação</Label>
                  <Input
                    id="quarto"
                    value={formData.quarto}
                    onChange={(e) => setFormData({...formData, quarto: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Responsável/Contato de Emergência</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="responsavel_nome">Nome do responsável</Label>
                      <Input
                        id="responsavel_nome"
                        value={formData.responsavel_nome}
                        onChange={(e) => setFormData({...formData, responsavel_nome: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="responsavel_telefone">Telefone</Label>
                        <Input
                          id="responsavel_telefone"
                          value={formData.responsavel_telefone}
                          onChange={(e) => setFormData({...formData, responsavel_telefone: e.target.value})}
                          placeholder="(11) 99999-9999"
                        />
                      </div>
                      <div>
                        <Label htmlFor="responsavel_email">E-mail</Label>
                        <Input
                          id="responsavel_email"
                          type="email"
                          value={formData.responsavel_email}
                          onChange={(e) => setFormData({...formData, responsavel_email: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="condicoes_medicas">Condições médicas</Label>
                  <Textarea
                    id="condicoes_medicas"
                    value={formData.condicoes_medicas}
                    onChange={(e) => setFormData({...formData, condicoes_medicas: e.target.value})}
                    placeholder="Diabetes, hipertensão, alergias, medicamentos em uso, etc."
                    className="min-h-[80px]"
                  />
                </div>

                <div>
                  <Label htmlFor="observacoes_gerais">Observações gerais</Label>
                  <Textarea
                    id="observacoes_gerais"
                    value={formData.observacoes_gerais}
                    onChange={(e) => setFormData({...formData, observacoes_gerais: e.target.value})}
                    placeholder="Preferências, cuidados especiais, histórico relevante, etc."
                    className="min-h-[80px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingResident ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Prontuário</TableHead>
                <TableHead>Quarto</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residentes.map((residente) => (
                <TableRow key={residente.id}>
                  <TableCell className="font-medium">
                    {residente.nome_completo}
                  </TableCell>
                  <TableCell>{residente.numero_prontuario}</TableCell>
                  <TableCell>{residente.quarto || "-"}</TableCell>
                  <TableCell>
                    {format(new Date().getFullYear() - new Date(residente.data_nascimento).getFullYear(), '0')} anos
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={residente.ativo ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleToggleStatus(residente)}
                    >
                      {residente.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(residente)}
                        title="Editar residente"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedResidente(residente);
                          fetchContratos(residente.id);
                          setContratoDialogOpen(true);
                        }}
                        title="Gerar contrato"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(residente)}
                        title={residente.ativo ? "Desativar residente" : "Ativar residente"}
                        className={residente.ativo ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                      >
                        {residente.ativo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {residentes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Nenhum residente cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Dialog para Contrato */}
      <Dialog open={contratoDialogOpen} onOpenChange={setContratoDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle>
              Contrato de Prestação de Serviços - {selectedResidente?.nome_completo}
            </DialogTitle>
          </DialogHeader>
          
          {selectedResidente && (
            <ContratoForm
              residenteNome={selectedResidente.nome_completo}
              responsavelNome={selectedResidente.responsavel_nome}
              responsavelTelefone={selectedResidente.responsavel_telefone}
              responsavelEmail={selectedResidente.responsavel_email}
              onSubmit={async (data) => {
                setSavingContrato(true);
                try {
                  const contrato = await criarContrato(selectedResidente.id, data);
                  setContratoDialogOpen(false);
                  setSelectedContrato({
                    ...contrato,
                    servicos_inclusos: data.servicos_inclusos
                  });
                  setContratoVisualizarOpen(true);
                } catch (error) {
                  console.error(error);
                } finally {
                  setSavingContrato(false);
                }
              }}
              onCancel={() => setContratoDialogOpen(false)}
              isLoading={savingContrato}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Visualização do Contrato para PDF */}
      {selectedContrato && selectedResidente && (
        <ContratoPDFGenerator
          open={contratoVisualizarOpen}
          onOpenChange={setContratoVisualizarOpen}
          contrato={selectedContrato}
          residente={{
            nome_completo: selectedResidente.nome_completo,
            cpf: selectedResidente.cpf,
            data_nascimento: selectedResidente.data_nascimento,
            numero_prontuario: selectedResidente.numero_prontuario,
            quarto: selectedResidente.quarto
          }}
          empresa={{
            nome_empresa: "Senex Care - Residencial para Idosos",
            cnpj: "00.000.000/0001-00",
            endereco: "Endereço da empresa"
          }}
        />
      )}
    </Card>
  );
}