
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Edit, UserPlus, UserMinus, UserCheck, Shield, FileSpreadsheet, Filter, ArrowUpDown, Eye } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import ImportarFuncionarios from "@/components/ImportarFuncionarios";
import ExportarFuncionarios from "@/components/ExportarFuncionarios";
import DesligamentoDialog from "@/components/funcionarios/DesligamentoDialog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

type Funcionario = {
  id: string;
  nome_completo: string;
  funcao: string;
  escala_id: number;
  ativo: boolean;
  data_admissao: string;
  tenant_id?: string | null;
  data_desligamento?: string | null;
  motivo_desligamento?: string | null;
  escalas?: {
    nome: string;
  };
};

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionariosFiltrados, setFuncionariosFiltrados] = useState<Funcionario[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [funcDesligamento, setFuncDesligamento] = useState<Funcionario | null>(null);
  const [funcReligar, setFuncReligar] = useState<Funcionario | null>(null);
  const [religando, setReligando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>("ativo");
  const [filtroFuncao, setFiltroFuncao] = useState<string>("todas");
  const [filtroEscala, setFiltroEscala] = useState<string>("todas");
  const [filtroNome, setFiltroNome] = useState<string>("");
  const [ordenacao, setOrdenacao] = useState<string>("nome");
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();

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
        data_admissao,
        tenant_id,
        data_desligamento,
        motivo_desligamento,
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

  function abrirDesligamento(func: Funcionario) {
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Acesso negado",
        description: "Apenas administradores podem desligar funcionários",
      });
      return;
    }
    setFuncDesligamento(func);
  }

  async function confirmarReligamento() {
    if (!funcReligar) return;
    setReligando(true);
    const { error } = await supabase
      .from("funcionarios")
      .update({
        ativo: true,
        data_desligamento: null,
        motivo_desligamento: null,
        aviso_previo: false,
        tipo_aviso_previo: null,
        modalidade_reducao_aviso: null,
        data_inicio_aviso: null,
        data_fim_aviso: null,
        observacoes_desligamento: null,
        desligado_por: null,
      })
      .eq("id", funcReligar.id);
    setReligando(false);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao religar", description: error.message });
      return;
    }
    toast({ title: "Funcionário religado", description: `${funcReligar.nome_completo} foi reativado.` });
    setFuncReligar(null);
    fetchFuncionarios();
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
          <ExportarFuncionarios selecionados={selecionados} />
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
                <th className="py-2 px-3 text-left w-8">
                  <Checkbox
                    checked={
                      funcionariosFiltrados.length > 0 &&
                      funcionariosFiltrados.every((f) => selecionados.includes(f.id))
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const novos = funcionariosFiltrados.map((f) => f.id);
                        setSelecionados((prev) => Array.from(new Set([...prev, ...novos])));
                      } else {
                        const idsFiltrados = new Set(funcionariosFiltrados.map((f) => f.id));
                        setSelecionados((prev) => prev.filter((id) => !idsFiltrados.has(id)));
                      }
                    }}
                  />
                </th>
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
                  <td className="py-2 px-3">
                    <Checkbox
                      checked={selecionados.includes(func.id)}
                      onCheckedChange={(checked) => {
                        setSelecionados((prev) =>
                          checked ? [...prev, func.id] : prev.filter((id) => id !== func.id),
                        );
                      }}
                    />
                  </td>
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
                      title="Ficha do Funcionário"
                      onClick={() => navigate(`/funcionarios/${func.id}/ficha`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
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
                        onClick={() => abrirDesligamento(func)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="outline"
                        className="w-8 h-8 border-green-500 text-green-600 hover:bg-green-50"
                        title="Religar funcionário"
                        onClick={() => setFuncReligar(func)}
                      >
                        <UserCheck className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {funcionariosFiltrados.length === 0 && funcionarios.length > 0 && (
                <tr>
                  <td className="py-6 px-3 text-center text-muted-foreground" colSpan={6}>
                    Nenhum funcionário encontrado com os filtros aplicados.
                  </td>
                </tr>
              )}
              {funcionarios.length === 0 && (
                <tr>
                  <td className="py-6 px-3 text-center text-muted-foreground" colSpan={6}>
                    Nenhum funcionário cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <DesligamentoDialog
        funcionario={funcDesligamento}
        open={!!funcDesligamento}
        onOpenChange={(o) => { if (!o) setFuncDesligamento(null); }}
        onSuccess={() => { setFuncDesligamento(null); fetchFuncionarios(); }}
      />

      <Dialog open={!!funcReligar} onOpenChange={(o) => { if (!o) setFuncReligar(null); }}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Religar funcionário</h3>
            <p className="text-sm text-muted-foreground">
              Confirma a reativação de <strong>{funcReligar?.nome_completo}</strong>? Os dados de desligamento serão limpos e o funcionário voltará ao status ativo. O histórico em <em>desligamentos_historico</em> será preservado para auditoria.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFuncReligar(null)} disabled={religando}>
                Cancelar
              </Button>
              <Button onClick={confirmarReligamento} disabled={religando}>
                {religando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                Confirmar religamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

