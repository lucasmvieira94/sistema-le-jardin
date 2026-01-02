
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Edit, UserPlus, UserMinus, Shield, FileSpreadsheet, Filter, ArrowUpDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuditLog } from "@/hooks/useAuditLog";
import ImportarFuncionarios from "@/components/ImportarFuncionarios";
import ExportarFuncionarios from "@/components/ExportarFuncionarios";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Funcionario = {
  id: string;
  nome_completo: string;
  funcao: string;
  escala_id: number;
  ativo: boolean;
  escalas?: {
    nome: string;
  };
};

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionariosFiltrados, setFuncionariosFiltrados] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [desligandoId, setDesligandoId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("ativo");
  const [filtroFuncao, setFiltroFuncao] = useState<string>("todas");
  const [filtroEscala, setFiltroEscala] = useState<string>("todas");
  const [filtroNome, setFiltroNome] = useState<string>("");
  const [ordenacao, setOrdenacao] = useState<string>("nome");
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { logEvent } = useAuditLog();

  async function fetchFuncionarios() {
    setLoading(true);
    const { data, error } = await supabase
      .from("funcionarios")
      .select(`
        id, 
        nome_completo, 
        funcao, 
        escala_id, 
        ativo,
        escalas(nome)
      `)
      .order("nome_completo");
    if (!error) setFuncionarios(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchFuncionarios();
  }, []);

  // Aplicar filtros e ordenação
  useEffect(() => {
    let filtrados = [...funcionarios];

    // Filtro por nome
    if (filtroNome) {
      filtrados = filtrados.filter(func => 
        func.nome_completo.toLowerCase().includes(filtroNome.toLowerCase())
      );
    }

    // Filtro por status
    if (filtroStatus !== "todos") {
      const statusAtivo = filtroStatus === "ativo";
      filtrados = filtrados.filter(func => func.ativo === statusAtivo);
    }

    // Filtro por função
    if (filtroFuncao !== "todas") {
      filtrados = filtrados.filter(func => func.funcao === filtroFuncao);
    }

    // Filtro por escala
    if (filtroEscala !== "todas") {
      filtrados = filtrados.filter(func => func.escalas?.nome === filtroEscala);
    }

    // Ordenação
    filtrados.sort((a, b) => {
      switch (ordenacao) {
        case "nome":
          return a.nome_completo.localeCompare(b.nome_completo);
        case "funcao":
          return a.funcao.localeCompare(b.funcao);
        case "status":
          return Number(b.ativo) - Number(a.ativo);
        case "escala":
          return (a.escalas?.nome || "").localeCompare(b.escalas?.nome || "");
        default:
          return 0;
      }
    });

    setFuncionariosFiltrados(filtrados);
  }, [funcionarios, filtroNome, filtroStatus, filtroFuncao, filtroEscala, ordenacao]);

  // Obter listas únicas para os filtros
  const funcoesUnicas = [...new Set(funcionarios.map(f => f.funcao))].sort();
  const escalasUnicas = [...new Set(funcionarios.map(f => f.escalas?.nome).filter(Boolean))].sort();

  async function desligarFuncionario(id: string) {
    if (!isAdmin) {
      toast({ 
        variant: "destructive", 
        title: "Acesso negado",
        description: "Apenas administradores podem desligar funcionários" 
      });
      return;
    }

    setDesligandoId(id);
    
    // Get current funcionario data for audit
    const { data: funcionarioAtual } = await supabase
      .from("funcionarios")
      .select("*")
      .eq("id", id)
      .single();
    
    const { error } = await supabase
      .from("funcionarios")
      .update({ ativo: false })
      .eq("id", id);

    if (!error) {
      await logEvent('funcionarios', 'UPDATE', funcionarioAtual, { ativo: false });
      toast({ title: "Funcionário desligado com sucesso." });
      fetchFuncionarios();
    } else {
      toast({ variant: "destructive", title: "Erro ao desligar funcionário" });
    }
    setDesligandoId(null);
  }

  if (roleLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-10">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" /> Verificando permissões...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-4xl py-10">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas administradores podem acessar o gerenciamento de funcionários.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Funcionários</h2>
        <div className="flex gap-2">
          <ExportarFuncionarios />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> 
                Importar Planilha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <ImportarFuncionarios onImportSuccess={fetchFuncionarios} />
            </DialogContent>
          </Dialog>
          <Link to="/funcionarios/novo">
            <Button><UserPlus className="w-4 h-4 mr-2" /> Novo Funcionário</Button>
          </Link>
        </div>
      </div>

      {/* Filtros e Ordenação */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span>Filtros e Ordenação</span>
          <Badge variant="outline">{funcionariosFiltrados.length} de {funcionarios.length}</Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Busca por nome */}
          <div className="lg:col-span-2">
            <Input
              placeholder="Buscar por nome..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
            />
          </div>

          {/* Filtro por status */}
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Desligados</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por função */}
          <Select value={filtroFuncao} onValueChange={setFiltroFuncao}>
            <SelectTrigger>
              <SelectValue placeholder="Função" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Funções</SelectItem>
              {funcoesUnicas.map(funcao => (
                <SelectItem key={funcao} value={funcao}>{funcao}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro por escala */}
          <Select value={filtroEscala} onValueChange={setFiltroEscala}>
            <SelectTrigger>
              <SelectValue placeholder="Escala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Escalas</SelectItem>
              {escalasUnicas.map(escala => (
                <SelectItem key={escala} value={escala}>{escala}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Ordenação */}
          <Select value={ordenacao} onValueChange={setOrdenacao}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Nome
                </div>
              </SelectItem>
              <SelectItem value="funcao">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Função
                </div>
              </SelectItem>
              <SelectItem value="status">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Status
                </div>
              </SelectItem>
              <SelectItem value="escala">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Escala
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="overflow-auto rounded shadow-sm">
          <table className="min-w-full bg-white rounded">
            <thead>
              <tr className="bg-green-50 text-muted-foreground">
                <th className="py-2 px-3 text-left">Nome</th>
                <th className="py-2 px-3 text-left">Função</th>
                <th className="py-2 px-3 text-left">Escala</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {funcionariosFiltrados.map((func) => (
                <tr key={func.id} className="border-b last:border-b-0">
                  <td className="py-2 px-3">{func.nome_completo}</td>
                  <td className="py-2 px-3">{func.funcao}</td>
                  <td className="py-2 px-3">{func.escalas?.nome || '-'}</td>
                  <td className="py-2 px-3 font-semibold">
                    {func.ativo ? (
                      <Badge variant="outline" className="border-green-500 text-green-600">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-500 text-red-500">Desligado</Badge>
                    )}
                  </td>
                  <td className="py-2 px-3 flex gap-2 justify-center">
                    <Button
                      size="icon"
                      variant="outline"
                      className="w-8 h-8"
                      title="Editar"
                      onClick={() => navigate(`/funcionarios/${func.id}/editar`)}
                      disabled={!func.ativo}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {func.ativo ? (
                      <Button
                        size="icon"
                        variant="destructive"
                        className="w-8 h-8"
                        title="Desligar"
                        onClick={() => desligarFuncionario(func.id)}
                        disabled={desligandoId === func.id}
                      >
                        {desligandoId === func.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserMinus className="w-4 h-4" />
                        )}
                      </Button>
                    ) : (
                      <span className="w-8 h-8 inline-flex items-center justify-center opacity-50">
                        <UserMinus className="w-4 h-4" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {funcionariosFiltrados.length === 0 && funcionarios.length > 0 && (
                <tr>
                  <td className="py-6 px-3 text-center text-muted-foreground" colSpan={5}>
                    Nenhum funcionário encontrado com os filtros aplicados.
                  </td>
                </tr>
              )}
              {funcionarios.length === 0 && (
                <tr>
                  <td className="py-6 px-3 text-center text-muted-foreground" colSpan={5}>
                    Nenhum funcionário cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

