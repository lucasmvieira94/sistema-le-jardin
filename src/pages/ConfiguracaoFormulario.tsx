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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  LogOut, 
  Save, 
  Eye, 
  EyeOff,
  ArrowUp,
  ArrowDown,
  FormInput,
  List,
  ToggleLeft
} from "lucide-react";

interface CampoFormulario {
  id: string;
  secao: string;
  tipo: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'number' | 'slider';
  label: string;
  placeholder?: string;
  opcoes?: string[];
  obrigatorio: boolean;
  ativo: boolean;
  ordem: number;
  configuracoes?: {
    min?: number;
    max?: number;
    step?: number;
    rows?: number;
  };
  created_at?: string;
  updated_at?: string;
}

const SECOES_DISPONIVEIS = [
  { value: 'rotina_diaria', label: 'Rotina Diária' },
  { value: 'aspectos_clinicos', label: 'Aspectos Clínicos' },
  { value: 'bem_estar', label: 'Avaliação de Bem-Estar' },
  { value: 'ocorrencias', label: 'Registro de Ocorrências' },
  { value: 'observacoes', label: 'Observações Gerais' }
];

const TIPOS_CAMPO = [
  { value: 'text', label: 'Texto Simples' },
  { value: 'textarea', label: 'Texto Longo' },
  { value: 'select', label: 'Seleção Única' },
  { value: 'radio', label: 'Opção Múltipla' },
  { value: 'checkbox', label: 'Múltipla Escolha' },
  { value: 'number', label: 'Número' },
  { value: 'slider', label: 'Escala Numérica' }
];

export default function ConfiguracaoFormulario() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [campos, setCampos] = useState<CampoFormulario[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampo, setEditingCampo] = useState<CampoFormulario | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState<{
    secao: string;
    tipo: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'number' | 'slider';
    label: string;
    placeholder: string;
    opcoes: string;
    obrigatorio: boolean;
    ativo: boolean;
    configuracoes: {
      min: number;
      max: number;
      step: number;
      rows: number;
    };
  }>({
    secao: '',
    tipo: 'text',
    label: '',
    placeholder: '',
    opcoes: '',
    obrigatorio: false,
    ativo: true,
    configuracoes: {
      min: 0,
      max: 10,
      step: 1,
      rows: 3
    }
  });

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
      loadCamposConfigurados();
    }
  }, [user]);

  const loadCamposConfigurados = async () => {
    try {
      const { data, error } = await supabase
        .from('formulario_campos_config')
        .select('*')
        .order('secao, ordem');

      if (error) {
        console.error('Erro ao carregar campos:', error);
        throw error;
      }

      const camposFormatados = data?.map(campo => ({
        id: campo.id,
        secao: campo.secao,
        tipo: campo.tipo as CampoFormulario['tipo'],
        label: campo.label,
        placeholder: campo.placeholder || undefined,
        opcoes: campo.opcoes || undefined,
        obrigatorio: campo.obrigatorio,
        ativo: campo.ativo,
        ordem: campo.ordem,
        configuracoes: (campo.configuracoes && typeof campo.configuracoes === 'object' && !Array.isArray(campo.configuracoes)) 
          ? campo.configuracoes as { min?: number; max?: number; step?: number; rows?: number; }
          : undefined,
        created_at: campo.created_at,
        updated_at: campo.updated_at
      })) || [];

      setCampos(camposFormatados);
    } catch (error) {
      console.error('Erro detalhado:', error);
      toast({
        title: "Erro ao carregar configuração",
        description: "Não foi possível carregar os campos configurados.",
        variant: "destructive",
      });
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

  const openNewCampoDialog = () => {
    setEditingCampo(null);
    setFormData({
      secao: '',
      tipo: 'text',
      label: '',
      placeholder: '',
      opcoes: '',
      obrigatorio: false,
      ativo: true,
      configuracoes: {
        min: 0,
        max: 10,
        step: 1,
        rows: 3
      }
    });
    setDialogOpen(true);
  };

  const editCampo = (campo: CampoFormulario) => {
    setEditingCampo(campo);
    setFormData({
      secao: campo.secao,
      tipo: campo.tipo,
      label: campo.label,
      placeholder: campo.placeholder || '',
      opcoes: campo.opcoes?.join('\n') || '',
      obrigatorio: campo.obrigatorio,
      ativo: campo.ativo,
      configuracoes: {
        min: campo.configuracoes?.min ?? 0,
        max: campo.configuracoes?.max ?? 10,
        step: campo.configuracoes?.step ?? 1,
        rows: campo.configuracoes?.rows ?? 3
      }
    });
    setDialogOpen(true);
  };

  const saveCampo = async () => {
    if (!formData.label.trim() || !formData.secao) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o rótulo e selecione uma seção.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const dadosCampo = {
        secao: formData.secao,
        tipo: formData.tipo,
        label: formData.label.trim(),
        placeholder: formData.placeholder.trim() || null,
        opcoes: formData.opcoes ? formData.opcoes.split('\n').filter(op => op.trim()).map(op => op.trim()) : null,
        obrigatorio: formData.obrigatorio,
        ativo: formData.ativo,
        ordem: editingCampo?.ordem || Math.max(...campos.filter(c => c.secao === formData.secao).map(c => c.ordem), 0) + 1,
        configuracoes: ['slider', 'number'].includes(formData.tipo) ? formData.configuracoes : null
      };

      let result;
      if (editingCampo) {
        result = await supabase
          .from('formulario_campos_config')
          .update(dadosCampo)
          .eq('id', editingCampo.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('formulario_campos_config')
          .insert(dadosCampo)
          .select()
          .single();
      }

      if (result.error) {
        console.error('Erro ao salvar:', result.error);
        throw result.error;
      }

      toast({
        title: editingCampo ? "Campo atualizado" : "Campo adicionado",
        description: editingCampo ? "As alterações foram salvas com sucesso." : "O novo campo foi criado com sucesso.",
      });

      setDialogOpen(false);
      loadCamposConfigurados(); // Recarregar dados do banco
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o campo. Verifique suas permissões.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCampo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('formulario_campos_config')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Campo removido",
        description: "O campo foi excluído com sucesso.",
      });
      
      loadCamposConfigurados(); // Recarregar dados do banco
    } catch (error) {
      console.error('Erro ao deletar campo:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o campo.",
        variant: "destructive",
      });
    }
  };

  const toggleCampoAtivo = async (id: string) => {
    try {
      const campo = campos.find(c => c.id === id);
      if (!campo) return;

      const { error } = await supabase
        .from('formulario_campos_config')
        .update({ ativo: !campo.ativo })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: campo.ativo ? "Campo desativado" : "Campo ativado",
        description: `O campo "${campo.label}" foi ${campo.ativo ? 'desativado' : 'ativado'}.`,
      });
      
      loadCamposConfigurados(); // Recarregar dados do banco
    } catch (error) {
      console.error('Erro ao alterar status do campo:', error);
      toast({
        title: "Erro ao alterar status",
        description: "Não foi possível alterar o status do campo.",
        variant: "destructive",
      });
    }
  };

  const moveCampo = async (id: string, direction: 'up' | 'down') => {
    try {
      const campo = campos.find(c => c.id === id);
      if (!campo) return;

      const camposSecao = campos.filter(c => c.secao === campo.secao).sort((a, b) => a.ordem - b.ordem);
      const currentIndex = camposSecao.findIndex(c => c.id === id);
      
      if (direction === 'up' && currentIndex > 0) {
        const targetCampo = camposSecao[currentIndex - 1];
        
        // Trocar ordens no banco
        await supabase.from('formulario_campos_config').update({ ordem: targetCampo.ordem }).eq('id', id);
        await supabase.from('formulario_campos_config').update({ ordem: campo.ordem }).eq('id', targetCampo.id);
        
        loadCamposConfigurados();
      } else if (direction === 'down' && currentIndex < camposSecao.length - 1) {
        const targetCampo = camposSecao[currentIndex + 1];
        
        // Trocar ordens no banco
        await supabase.from('formulario_campos_config').update({ ordem: targetCampo.ordem }).eq('id', id);
        await supabase.from('formulario_campos_config').update({ ordem: campo.ordem }).eq('id', targetCampo.id);
        
        loadCamposConfigurados();
      }
    } catch (error) {
      console.error('Erro ao mover campo:', error);
      toast({
        title: "Erro ao reordenar",
        description: "Não foi possível alterar a ordem do campo.",
        variant: "destructive",
      });
    }
  };

  const getCamposPorSecao = (secao: string) => {
    return campos
      .filter(c => c.secao === secao)
      .sort((a, b) => a.ordem - b.ordem);
  };

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
                <Settings className="w-6 h-6 text-primary" />
                Configuração do Formulário
              </h1>
              <p className="text-sm text-muted-foreground">
                Personalize os campos do prontuário eletrônico
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Visualizar
              </Button>
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
        {/* Botão para adicionar novo campo */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Campos do Formulário</h2>
          <Button onClick={openNewCampoDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Campo
          </Button>
        </div>

        {/* Lista de campos por seção */}
        <Tabs defaultValue="rotina_diaria" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {SECOES_DISPONIVEIS.map((secao) => (
              <TabsTrigger key={secao.value} value={secao.value}>
                {secao.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {SECOES_DISPONIVEIS.map((secao) => (
            <TabsContent key={secao.value} value={secao.value}>
              <Card>
                <CardHeader>
                  <CardTitle>{secao.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getCamposPorSecao(secao.value).map((campo) => (
                      <div
                        key={campo.id}
                        className={`p-4 border rounded-lg ${
                          campo.ativo ? 'bg-white' : 'bg-gray-50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{campo.label}</h4>
                              <Badge variant="outline">
                                {TIPOS_CAMPO.find(t => t.value === campo.tipo)?.label}
                              </Badge>
                              {campo.obrigatorio && (
                                <Badge variant="destructive" className="text-xs">
                                  Obrigatório
                                </Badge>
                              )}
                            </div>
                            
                            {campo.placeholder && (
                              <p className="text-sm text-gray-500 mb-1">
                                Placeholder: {campo.placeholder}
                              </p>
                            )}
                            
                            {campo.opcoes && (
                              <p className="text-sm text-gray-600">
                                Opções: {campo.opcoes.join(', ')}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveCampo(campo.id, 'up')}
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveCampo(campo.id, 'down')}
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCampoAtivo(campo.id)}
                              title={campo.ativo ? 'Desativar' : 'Ativar'}
                            >
                              {campo.ativo ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => editCampo(campo)}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCampo(campo.id)}
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {getCamposPorSecao(secao.value).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <FormInput className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhum campo configurado nesta seção</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={openNewCampoDialog}
                        >
                          Adicionar primeiro campo
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Dialog para adicionar/editar campo */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCampo ? 'Editar Campo' : 'Adicionar Novo Campo'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="secao">Seção *</Label>
                  <Select value={formData.secao} onValueChange={(value) => setFormData({...formData, secao: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma seção" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-lg z-50">
                      {SECOES_DISPONIVEIS.map((secao) => (
                        <SelectItem key={secao.value} value={secao.value}>
                          {secao.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="tipo">Tipo de Campo *</Label>
                  <Select value={formData.tipo} onValueChange={(value: any) => setFormData({...formData, tipo: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-lg z-50">
                      {TIPOS_CAMPO.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="label">Rótulo do Campo *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({...formData, label: e.target.value})}
                  placeholder="Ex: Qualidade do sono"
                />
              </div>

              <div>
                <Label htmlFor="placeholder">Placeholder (opcional)</Label>
                <Input
                  id="placeholder"
                  value={formData.placeholder}
                  onChange={(e) => setFormData({...formData, placeholder: e.target.value})}
                  placeholder="Ex: Digite aqui suas observações..."
                />
              </div>

              {['select', 'radio', 'checkbox'].includes(formData.tipo) && (
                <div>
                  <Label htmlFor="opcoes">Opções (uma por linha)</Label>
                  <Textarea
                    id="opcoes"
                    value={formData.opcoes}
                    onChange={(e) => setFormData({...formData, opcoes: e.target.value})}
                    placeholder="Boa&#10;Regular&#10;Ruim"
                    rows={4}
                  />
                </div>
              )}

              {['slider', 'number'].includes(formData.tipo) && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="min">Valor Mínimo</Label>
                    <Input
                      id="min"
                      type="number"
                      value={formData.configuracoes.min}
                      onChange={(e) => setFormData({
                        ...formData,
                        configuracoes: {
                          ...formData.configuracoes,
                          min: parseInt(e.target.value) || 0
                        }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max">Valor Máximo</Label>
                    <Input
                      id="max"
                      type="number"
                      value={formData.configuracoes.max}
                      onChange={(e) => setFormData({
                        ...formData,
                        configuracoes: {
                          ...formData.configuracoes,
                          max: parseInt(e.target.value) || 10
                        }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="step">Incremento</Label>
                    <Input
                      id="step"
                      type="number"
                      value={formData.configuracoes.step}
                      onChange={(e) => setFormData({
                        ...formData,
                        configuracoes: {
                          ...formData.configuracoes,
                          step: parseInt(e.target.value) || 1
                        }
                      })}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="obrigatorio"
                    checked={formData.obrigatorio}
                    onCheckedChange={(checked) => setFormData({...formData, obrigatorio: checked})}
                  />
                  <Label htmlFor="obrigatorio">Campo obrigatório</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="ativo"
                    checked={formData.ativo}
                    onCheckedChange={(checked) => setFormData({...formData, ativo: checked})}
                  />
                  <Label htmlFor="ativo">Campo ativo</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={saveCampo}
                  disabled={isSaving || !formData.label.trim() || !formData.secao}
                >
                  {isSaving ? (
                    <>Salvando...</>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingCampo ? 'Atualizar' : 'Adicionar'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Visualização do Formulário</DialogTitle>
              <DialogDescription>
                Esta é uma prévia de como o formulário será exibido aos usuários
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {SECOES_DISPONIVEIS.map(secao => {
                const camposSecao = getCamposPorSecao(secao.value).filter(campo => campo.ativo);
                
                if (camposSecao.length === 0) return null;
                
                return (
                  <div key={secao.value} className="space-y-4">
                    <div className="border-b pb-2">
                      <h3 className="text-lg font-semibold text-primary">
                        {secao.label}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {camposSecao.map(campo => (
                        <div key={campo.id} className="space-y-2">
                          <Label className="text-sm font-medium">
                            {campo.label}
                            {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          
                          {campo.tipo === 'text' && (
                            <Input 
                              placeholder={campo.placeholder || `Digite ${campo.label.toLowerCase()}`}
                              disabled
                            />
                          )}
                          
                          {campo.tipo === 'textarea' && (
                            <Textarea 
                              placeholder={campo.placeholder || `Digite ${campo.label.toLowerCase()}`}
                              rows={campo.configuracoes?.rows || 3}
                              disabled
                            />
                          )}
                          
                          {campo.tipo === 'number' && (
                            <Input 
                              type="number"
                              placeholder={campo.placeholder || "0"}
                              disabled
                            />
                          )}
                          
                          {campo.tipo === 'select' && (
                            <Select disabled>
                              <SelectTrigger>
                                <SelectValue placeholder={`Selecione ${campo.label.toLowerCase()}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {campo.opcoes?.map((opcao, index) => (
                                  <SelectItem key={index} value={opcao}>
                                    {opcao}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          
                          {campo.tipo === 'radio' && (
                            <div className="space-y-2">
                              {campo.opcoes?.map((opcao, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                  <input 
                                    type="radio" 
                                    id={`${campo.id}-${index}`}
                                    name={campo.id}
                                    disabled
                                    className="h-4 w-4"
                                  />
                                  <Label htmlFor={`${campo.id}-${index}`} className="text-sm">
                                    {opcao}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {campo.tipo === 'checkbox' && (
                            <div className="space-y-2">
                              {campo.opcoes?.map((opcao, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={`${campo.id}-${index}`}
                                    disabled
                                  />
                                  <Label htmlFor={`${campo.id}-${index}`} className="text-sm">
                                    {opcao}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {campo.tipo === 'slider' && (
                            <div className="space-y-2">
                              <Slider 
                                value={[campo.configuracoes?.min || 0]}
                                min={campo.configuracoes?.min || 0}
                                max={campo.configuracoes?.max || 10}
                                step={campo.configuracoes?.step || 1}
                                disabled
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{campo.configuracoes?.min || 0}</span>
                                <span>{campo.configuracoes?.max || 10}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {campos.filter(campo => campo.ativo).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum campo ativo configurado para exibição</p>
                  <p className="text-sm mt-2">Adicione campos na configuração para visualizá-los aqui</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setPreviewOpen(false)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}