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
import { Users, Plus, Edit, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [editingResident, setEditingResident] = useState<Residente | null>(null);
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
      // Buscar o último número de prontuário
      const { data, error } = await supabase
        .from('residentes')
        .select('numero_prontuario')
        .order('numero_prontuario', { ascending: false })
        .limit(1);

      if (error) throw error;

      let proximoNumero = 1;
      if (data && data.length > 0) {
        const ultimoNumero = parseInt(data[0].numero_prontuario.replace(/\D/g, '')) || 0;
        proximoNumero = ultimoNumero + 1;
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(residente)}
                      >
                        <Edit className="w-4 h-4" />
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
    </Card>
  );
}