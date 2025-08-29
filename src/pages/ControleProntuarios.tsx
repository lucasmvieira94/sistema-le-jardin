import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';
import { FileText, Search, Eye, Edit, Calendar, User as UserIcon, LogOut, Save, X, Settings } from "lucide-react";
import ConfiguracoesProntuario from "@/components/prontuario/ConfiguracoesProntuario";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProntuarioRegistro {
  id: string;
  residente_id: string;
  funcionario_id: string | null;
  data_registro: string;
  horario_registro: string;
  tipo_registro: string;
  titulo: string;
  descricao: string;
  observacoes: string;
  created_at: string;
  updated_at: string;
  ciclo_id?: string;
  status_ciclo?: string;
  data_encerramento?: string;
  residentes: {
    id: string;
    nome_completo: string;
    numero_prontuario: string;
    quarto: string;
  };
  funcionarios: {
    nome_completo: string;
  } | null;
}

export default function ControleProntuarios() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [prontuarios, setProntuarios] = useState<ProntuarioRegistro[]>([]);
  const [filtros, setFiltros] = useState({
    dataInicio: new Date().toISOString().split('T')[0], // Data de hoje por padrão
    dataFim: "",
    residente: "todos_residentes",
    funcionario: "todos_funcionarios",
    status: "todos"
  });
  const [residentes, setResidentes] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [selectedProntuario, setSelectedProntuario] = useState<ProntuarioRegistro | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProntuario, setEditingProntuario] = useState<ProntuarioRegistro | null>(null);
  const [editForm, setEditForm] = useState({
    observacoes_gerais: "",
    justificativa_edicao: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [prontuarioStatus, setProntuarioStatus] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user && !loading) {
          navigate('/auth');
        }
        
        if (loading) {
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (!session?.user) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, loading]);

  useEffect(() => {
    if (user) {
      fetchProntuarios();
      fetchResidentes();
      fetchFuncionarios();
    }
  }, [user, filtros]);

  // Verificar status de atraso
  useEffect(() => {
    const verificarAtrasos = async () => {
      const statusMap: {[key: string]: boolean} = {};
      
      for (const prontuario of prontuarios) {
        if (prontuario.ciclo_id && prontuario.status_ciclo !== 'encerrado') {
          try {
            const { data, error } = await supabase
              .rpc('verificar_prontuario_em_atraso', { p_ciclo_id: prontuario.ciclo_id });
            
            if (!error) {
              statusMap[prontuario.ciclo_id] = data || false;
            }
          } catch (error) {
            console.error('Erro ao verificar atraso:', error);
          }
        }
      }
      
      setProntuarioStatus(statusMap);
    };

    if (prontuarios.length > 0) {
      verificarAtrasos();
    }
  }, [prontuarios]);

  const fetchProntuarios = async () => {
    try {
      // Buscar ciclos ao invés de registros individuais
      let query = supabase
        .from('prontuario_ciclos')
        .select(`
          *,
          residente:residentes!inner (
            id,
            nome_completo,
            numero_prontuario,
            quarto
          )
        `)
        .order('data_ciclo', { ascending: false });

      // Aplicar filtros
      if (filtros.dataInicio) {
        query = query.gte('data_ciclo', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte('data_ciclo', filtros.dataFim);
      }
      if (filtros.residente && filtros.residente !== "todos_residentes") {
        query = query.eq('residente_id', filtros.residente);
      }

      const { data: ciclos, error } = await query;

      if (error) throw error;

      // Para cada ciclo, buscar os registros completos
      const prontuariosCompletos = await Promise.all(
        (ciclos || []).map(async (ciclo) => {
          const { data: registros, error: registrosError } = await supabase
            .from('prontuario_registros')
            .select(`
              *,
              funcionarios (nome_completo)
            `)
            .eq('ciclo_id', ciclo.id)
            .eq('tipo_registro', 'prontuario_completo');

          if (registrosError) {
            console.error('Erro ao buscar registros:', registrosError);
            return null;
          }

          // Se há registro completo, usar esses dados
          if (registros && registros.length > 0) {
            const registro = registros[0];
            return {
              id: registro.id,
              residente_id: ciclo.residente_id,
              funcionario_id: registro.funcionario_id,
              data_registro: ciclo.data_ciclo,
              horario_registro: registro.horario_registro,
              tipo_registro: registro.tipo_registro,
              titulo: registro.titulo,
              descricao: registro.descricao,
              observacoes: registro.observacoes,
              created_at: registro.created_at,
              updated_at: registro.updated_at,
              ciclo_id: ciclo.id,
              status_ciclo: ciclo.status,
              data_encerramento: ciclo.data_encerramento,
              residentes: ciclo.residente,
              funcionarios: registro.funcionarios
            };
          }

          // Se não há registro completo, criar um placeholder para ciclos em andamento
          return {
            id: ciclo.id,
            residente_id: ciclo.residente_id,
            funcionario_id: null,
            data_registro: ciclo.data_ciclo,
            horario_registro: '00:00:00',
            tipo_registro: 'prontuario_completo',
            titulo: 'Prontuários Diários',
            descricao: '',
            observacoes: '',
            created_at: ciclo.created_at,
            updated_at: ciclo.updated_at,
            ciclo_id: ciclo.id,
            status_ciclo: ciclo.status,
            data_encerramento: ciclo.data_encerramento,
            residentes: ciclo.residente,
            funcionarios: null
          };
        })
      );

      // Filtrar e aplicar filtro de funcionário se necessário
      let prontuariosFiltrados = prontuariosCompletos.filter(p => p !== null);
      
      if (filtros.funcionario && filtros.funcionario !== "todos_funcionarios") {
        prontuariosFiltrados = prontuariosFiltrados.filter(p => 
          p.funcionario_id === filtros.funcionario
        );
      }

      setProntuarios(prontuariosFiltrados);
      console.log('📋 Prontuários carregados:', prontuariosFiltrados.length);
      console.log('📋 Filtros aplicados:', filtros);
    } catch (error) {
      console.error('Erro ao carregar prontuários:', error);
      toast({
        title: "Erro ao carregar prontuários",
        description: "Não foi possível carregar os prontuários.",
        variant: "destructive",
      });
    }
  };

  const fetchResidentes = async () => {
    try {
      const { data, error } = await supabase
        .from('residentes')
        .select('id, nome_completo, numero_prontuario')
        .eq('ativo', true)
        .order('nome_completo');

      if (error) throw error;
      setResidentes(data || []);
    } catch (error) {
      console.error('Erro ao buscar residentes:', error);
    }
  };

  const fetchFuncionarios = async () => {
    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('ativo', true)
        .order('nome_completo');

      if (error) throw error;
      setFuncionarios(data || []);
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Erro ao sair",
          description: "Não foi possível sair da conta.",
          variant: "destructive",
        });
      } else {
        navigate('/auth');
      }
    } catch (err) {
      toast({
        title: "Erro inesperado",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (prontuario: ProntuarioRegistro) => {
    const emAtraso = prontuario.ciclo_id ? prontuarioStatus[prontuario.ciclo_id] : false;
    
    if (prontuario.status_ciclo === 'encerrado') {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">Encerrado</Badge>;
    } else if (prontuario.status_ciclo === 'completo') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Completo</Badge>;
    } else if (emAtraso) {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 animate-pulse">⚠️ Em Atraso</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Em Andamento</Badge>;
    }
  };

  const parseDescricao = (descricao: string) => {
    try {
      if (!descricao || descricao.trim() === "") {
        return {};
      }
      const parsed = JSON.parse(descricao);
      return parsed;
    } catch {
      return { observacoes_gerais: descricao };
    }
  };

  const viewProntuario = (prontuario: ProntuarioRegistro) => {
    setSelectedProntuario(prontuario);
    setDialogOpen(true);
  };

  const editProntuario = (prontuario: ProntuarioRegistro) => {
    const dados = parseDescricao(prontuario.descricao);
    setEditingProntuario(prontuario);
    setEditForm({
      observacoes_gerais: dados.observacoes_gerais || prontuario.observacoes || "",
      justificativa_edicao: ""
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingProntuario) return;
    
    if (!editForm.justificativa_edicao.trim()) {
      toast({
        title: "Justificativa obrigatória",
        description: "É necessário informar o motivo da edição.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const dadosAtuais = parseDescricao(editingProntuario.descricao);
      const dadosAtualizados = {
        ...dadosAtuais,
        observacoes_gerais: editForm.observacoes_gerais
      };

      const { error: updateError } = await supabase
        .from('prontuario_registros')
        .update({
          descricao: JSON.stringify(dadosAtualizados),
          observacoes: editForm.observacoes_gerais,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingProntuario.id);

      if (updateError) throw updateError;

      toast({
        title: "Prontuário atualizado",
        description: "As alterações foram salvas com sucesso.",
      });

      setEditDialogOpen(false);
      setEditingProntuario(null);
      setEditForm({ observacoes_gerais: "", justificativa_edicao: "" });
      fetchProntuarios();
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProntuarios = prontuarios.filter(prontuario => {
    if (filtros.status === "todos") return true;
    
    switch (filtros.status) {
      case "andamento":
        return prontuario.status_ciclo === 'em_andamento';
      case "concluidos":
        return prontuario.status_ciclo === 'completo';
      case "finalizados":
        return prontuario.status_ciclo === 'encerrado';
      default:
        return true;
    }
  });

  console.log('📊 Total prontuários brutos:', prontuarios.length);
  console.log('📊 Prontuários após filtro:', filteredProntuarios.length);
  console.log('📊 Status filter:', filtros.status);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                Controle de Prontuários
              </h1>
              <p className="text-sm text-muted-foreground">
                Logado como: {user.email}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/')}
              >
                Voltar ao Sistema
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <Tabs defaultValue="prontuarios" className="space-y-6">
          <TabsList>
            <TabsTrigger value="prontuarios">Prontuários</TabsTrigger>
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="prontuarios" className="space-y-6">
            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="dataInicio">Data Início</Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={filtros.dataInicio}
                      onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dataFim">Data Fim</Label>
                    <Input
                      id="dataFim"
                      type="date"
                      value={filtros.dataFim}
                      onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="residente">Residente</Label>
                    <Select value={filtros.residente} onValueChange={(value) => setFiltros({...filtros, residente: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os residentes" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg z-50">
                        <SelectItem value="todos_residentes">Todos os residentes</SelectItem>
                        {residentes.map((residente) => (
                          <SelectItem key={residente.id} value={residente.id}>
                            {residente.nome_completo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="funcionario">Funcionário</Label>
                    <Select value={filtros.funcionario} onValueChange={(value) => setFiltros({...filtros, funcionario: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os funcionários" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg z-50">
                        <SelectItem value="todos_funcionarios">Todos os funcionários</SelectItem>
                        {funcionarios.map((funcionario) => (
                          <SelectItem key={funcionario.id} value={funcionario.id}>
                            {funcionario.nome_completo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={filtros.status} onValueChange={(value) => setFiltros({...filtros, status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg z-50">
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluidos">Concluídos Hoje</SelectItem>
                        <SelectItem value="finalizados">Finalizados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Prontuários */}
            <Card>
              <CardHeader>
                <CardTitle>Prontuários ({filteredProntuarios.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Residente</TableHead>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProntuarios.map((prontuario) => (
                        <TableRow key={prontuario.id}>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">
                                {format(new Date(prontuario.data_registro), 'dd/MM/yyyy', { locale: ptBR })}
                              </div>
                              <div className="text-gray-500">
                                {prontuario.horario_registro.substring(0, 5)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{prontuario.residentes?.nome_completo}</div>
                              <div className="text-gray-500">
                                Quarto: {prontuario.residentes?.quarto || 'N/A'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{prontuario.funcionarios?.nome_completo || 'N/A'}</TableCell>
                          <TableCell>{prontuario.titulo}</TableCell>
                          <TableCell>{getStatusBadge(prontuario)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewProntuario(prontuario)}
                                title="Visualizar prontuário"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editProntuario(prontuario)}
                                title="Editar prontuário"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredProntuarios.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                            Nenhum prontuário encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuracoes">
            <ConfiguracoesProntuario />
          </TabsContent>
        </Tabs>

        {/* Dialog para visualizar prontuário */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Prontuário</DialogTitle>
            </DialogHeader>
            
            {selectedProntuario && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium">Residente</Label>
                    <p className="text-sm">{selectedProntuario.residentes?.nome_completo}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedProntuario)}</div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Conteúdo do Prontuário</Label>
                  <div className="mt-2 p-4 bg-white border rounded-lg">
                    {(() => {
                      const dados = parseDescricao(selectedProntuario.descricao);
                      
                      if (!dados || Object.keys(dados).length === 0) {
                        return <p className="text-gray-500 text-sm">Nenhum conteúdo registrado.</p>;
                      }
                      
                      return (
                        <div className="space-y-4">
                          {dados.observacoes_gerais && (
                            <div>
                              <h4 className="font-medium text-sm mb-2 text-gray-700">Observações Gerais</h4>
                              <p className="text-sm text-gray-700 pl-4">{dados.observacoes_gerais}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog para editar prontuário */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Prontuário</DialogTitle>
            </DialogHeader>
            
            {editingProntuario && (
              <div className="space-y-6">
                <Alert>
                  <AlertDescription>
                    <strong>Atenção:</strong> Esta edição será registrada no sistema de auditoria.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="observacoes_gerais">Observações Gerais</Label>
                    <Textarea
                      id="observacoes_gerais"
                      value={editForm.observacoes_gerais}
                      onChange={(e) => setEditForm({...editForm, observacoes_gerais: e.target.value})}
                      placeholder="Atualize as observações do prontuário..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div>
                    <Label htmlFor="justificativa_edicao">
                      Justificativa da Edição <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="justificativa_edicao"
                      value={editForm.justificativa_edicao}
                      onChange={(e) => setEditForm({...editForm, justificativa_edicao: e.target.value})}
                      placeholder="Explique o motivo desta edição (obrigatório)..."
                      className="min-h-[80px]"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditDialogOpen(false);
                      setEditingProntuario(null);
                      setEditForm({ observacoes_gerais: "", justificativa_edicao: "" });
                    }}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editForm.justificativa_edicao.trim()}
                  >
                    {isSaving ? (
                      <>Salvando...</>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}