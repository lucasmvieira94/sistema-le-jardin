import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import * as XLSX from 'xlsx';
import { validateCPF, validateEmail } from "@/utils/validation";

type PlanilhaFuncionario = {
  nome_completo: string;
  email: string;
  cpf: string;
  data_nascimento: string;
  data_admissao: string;
  funcao: string;
  escala_nome: string;
};

type ErroValidacao = {
  linha: number;
  erros: string[];
};

interface ImportarFuncionariosProps {
  onImportSuccess: () => void;
}

export default function ImportarFuncionarios({ onImportSuccess }: ImportarFuncionariosProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [dadosPlanilha, setDadosPlanilha] = useState<PlanilhaFuncionario[]>([]);
  const [errosValidacao, setErrosValidacao] = useState<ErroValidacao[]>([]);
  const { logEvent } = useAuditLog();

  const gerarPlanilhaModelo = () => {
    const modelo = [
      {
        nome_completo: "João Silva Santos",
        email: "joao.silva@empresa.com",
        cpf: "123.456.789-00",
        data_nascimento: "1990-05-15",
        data_admissao: "2024-01-15",
        funcao: "Analista",
        escala_nome: "Comercial"
      },
      {
        nome_completo: "Maria Oliveira Costa",
        email: "maria.oliveira@empresa.com", 
        cpf: "987.654.321-00",
        data_nascimento: "1985-08-22",
        data_admissao: "2024-02-01",
        funcao: "Coordenadora",
        escala_nome: "Administrativo"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(modelo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários");
    XLSX.writeFile(wb, "modelo_funcionarios.xlsx");
    
    toast({
      title: "Planilha modelo baixada",
      description: "Use este arquivo como base para importar seus funcionários."
    });
  };

  const processarArquivo = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      const funcionarios: PlanilhaFuncionario[] = data.map((row, index) => ({
        nome_completo: row.nome_completo || "",
        email: row.email || "",
        cpf: row.cpf || "",
        data_nascimento: row.data_nascimento || "",
        data_admissao: row.data_admissao || "",
        funcao: row.funcao || "",
        escala_nome: row.escala_nome || ""
      }));

      setDadosPlanilha(funcionarios);
      validarDados(funcionarios);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao processar arquivo",
        description: "Verifique se o arquivo está no formato correto."
      });
    }
  };

  const validarDados = async (funcionarios: PlanilhaFuncionario[]) => {
    const erros: ErroValidacao[] = [];
    
    // Buscar escalas existentes
    const { data: escalas } = await supabase
      .from("escalas")
      .select("nome");
    
    const nomesEscalas = escalas?.map(e => e.nome.toLowerCase()) || [];

    // Buscar CPFs e emails existentes
    const { data: funcionariosExistentes } = await supabase
      .from("funcionarios")
      .select("cpf, email");

    const cpfsExistentes = funcionariosExistentes?.map(f => f.cpf) || [];
    const emailsExistentes = funcionariosExistentes?.map(f => f.email.toLowerCase()) || [];

    funcionarios.forEach((func, index) => {
      const errosLinha: string[] = [];
      const linha = index + 2; // +2 porque começa na linha 2 do Excel

      // Validações obrigatórias
      if (!func.nome_completo.trim()) errosLinha.push("Nome completo é obrigatório");
      if (!func.email.trim()) errosLinha.push("Email é obrigatório");
      if (!func.cpf.trim()) errosLinha.push("CPF é obrigatório");
      if (!func.data_nascimento) errosLinha.push("Data de nascimento é obrigatória");
      if (!func.data_admissao) errosLinha.push("Data de admissão é obrigatória");
      if (!func.funcao.trim()) errosLinha.push("Função é obrigatória");
      if (!func.escala_nome.trim()) errosLinha.push("Nome da escala é obrigatório");

      // Validação de email
      if (func.email && !validateEmail(func.email)) {
        errosLinha.push("Email inválido");
      }

      // Validação de CPF
      if (func.cpf && !validateCPF(func.cpf)) {
        errosLinha.push("CPF inválido");
      }

      // Validação de escala existente
      if (func.escala_nome && !nomesEscalas.includes(func.escala_nome.toLowerCase())) {
        errosLinha.push("Escala não encontrada");
      }

      // Validação de duplicatas na base
      if (func.cpf && cpfsExistentes.includes(func.cpf)) {
        errosLinha.push("CPF já cadastrado");
      }
      
      if (func.email && emailsExistentes.includes(func.email.toLowerCase())) {
        errosLinha.push("Email já cadastrado");
      }

      // Validação de duplicatas na própria planilha
      const cpfsDuplicados = funcionarios.filter(f => f.cpf === func.cpf).length > 1;
      const emailsDuplicados = funcionarios.filter(f => f.email.toLowerCase() === func.email.toLowerCase()).length > 1;
      
      if (cpfsDuplicados) errosLinha.push("CPF duplicado na planilha");
      if (emailsDuplicados) errosLinha.push("Email duplicado na planilha");

      if (errosLinha.length > 0) {
        erros.push({ linha, erros: errosLinha });
      }
    });

    setErrosValidacao(erros);
  };

  const importarFuncionarios = async () => {
    if (errosValidacao.length > 0) {
      toast({
        variant: "destructive",
        title: "Corrija os erros antes de importar",
        description: `Existem ${errosValidacao.length} linhas com erros.`
      });
      return;
    }

    setImportando(true);

    try {
      // Buscar escalas para mapear nomes para IDs
      const { data: escalas } = await supabase
        .from("escalas")
        .select("id, nome");

      const mapEscalas = new Map(escalas?.map(e => [e.nome.toLowerCase(), e.id]));

      // Gerar códigos únicos para cada funcionário
      const funcionariosParaInserir = await Promise.all(
        dadosPlanilha.map(async (func) => {
          // Gerar código único
          let codigo: string;
          let codigoUnico = false;
          
          do {
            codigo = Math.floor(1000 + Math.random() * 9000).toString();
            const { data } = await supabase
              .from("funcionarios")
              .select("codigo_4_digitos")
              .eq("codigo_4_digitos", codigo)
              .single();
            codigoUnico = !data;
          } while (!codigoUnico);

          return {
            nome_completo: func.nome_completo.trim(),
            email: func.email.trim(),
            cpf: func.cpf.trim(),
            data_nascimento: func.data_nascimento,
            data_admissao: func.data_admissao,
            data_inicio_vigencia: func.data_admissao,
            funcao: func.funcao.trim(),
            escala_id: mapEscalas.get(func.escala_nome.toLowerCase())!,
            codigo_4_digitos: codigo,
            ativo: true
          };
        })
      );

      const { error } = await supabase
        .from("funcionarios")
        .insert(funcionariosParaInserir);

      if (error) throw error;

      await logEvent('funcionarios', 'INSERT_BULK', null, { 
        quantidade: funcionariosParaInserir.length,
        arquivo: arquivo?.name 
      });

      toast({
        title: "Importação concluída",
        description: `${funcionariosParaInserir.length} funcionários importados com sucesso.`
      });

      // Limpar estado
      setArquivo(null);
      setDadosPlanilha([]);
      setErrosValidacao([]);
      onImportSuccess();

    } catch (error) {
      console.error("Erro ao importar:", error);
      toast({
        variant: "destructive",
        title: "Erro na importação",
        description: "Ocorreu um erro ao importar os funcionários."
      });
    } finally {
      setImportando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Importar Funcionários via Planilha
        </CardTitle>
        <CardDescription>
          Importe vários funcionários de uma só vez usando uma planilha Excel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={gerarPlanilhaModelo}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Baixar Modelo
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="arquivo">Selecionar arquivo Excel</Label>
          <Input
            id="arquivo"
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setArquivo(file);
                processarArquivo(file);
              }
            }}
          />
        </div>

        {dadosPlanilha.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {dadosPlanilha.length} funcionários encontrados na planilha
              </p>
              {errosValidacao.length === 0 && (
                <div className="text-sm text-green-600 flex items-center gap-1">
                  ✓ Dados validados com sucesso
                </div>
              )}
            </div>

            {errosValidacao.length > 0 && (
              <div className="border border-destructive/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-destructive font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Erros de validação encontrados:
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {errosValidacao.map((erro) => (
                    <div key={erro.linha} className="text-sm">
                      <span className="font-medium">Linha {erro.linha}:</span>
                      <ul className="ml-4 list-disc">
                        {erro.erros.map((msg, i) => (
                          <li key={i} className="text-destructive">{msg}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={importarFuncionarios}
              disabled={importando || errosValidacao.length > 0}
              className="w-full"
            >
              {importando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar {dadosPlanilha.length} Funcionários
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}