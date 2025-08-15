import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

interface Residente {
  id: string;
  nome_completo: string;
  numero_prontuario: string;
  quarto?: string;
}

interface AtividadeTemplate {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
}

interface NovoRegistroFormProps {
  funcionarioId: string;
  residentes: Residente[];
  onSuccess: () => void;
  onCancel: () => void;
  preSelectedResidente?: string | null;
}

export default function NovoRegistroForm({
  funcionarioId,
  residentes,
  onSuccess,
  onCancel,
  preSelectedResidente
}: NovoRegistroFormProps) {
  const [templates, setTemplates] = useState<AtividadeTemplate[]>([]);
  const [formData, setFormData] = useState({
    residente_id: preSelectedResidente || "",
    tipo_registro: "",
    titulo: "",
    descricao: "",
    observacoes: "",
    template_id: ""
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('atividades_templates')
        .select('*')
        .eq('ativo', true)
        .order('categoria, nome');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        template_id: templateId,
        tipo_registro: template.categoria,
        titulo: template.nome,
        descricao: template.descricao
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.residente_id || !formData.tipo_registro || !formData.titulo || !formData.descricao) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const agora = new Date();
      const { error } = await supabase
        .from('prontuario_registros')
        .insert({
          residente_id: formData.residente_id,
          funcionario_id: funcionarioId,
          data_registro: format(agora, 'yyyy-MM-dd'),
          horario_registro: format(agora, 'HH:mm:ss'),
          tipo_registro: formData.tipo_registro,
          titulo: formData.titulo,
          descricao: formData.descricao,
          observacoes: formData.observacoes || null
        });

      if (error) throw error;
      
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar registro:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar registro no prontuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const tiposRegistro = [
    { value: 'medicacao', label: 'Medicação' },
    { value: 'alimentacao', label: 'Alimentação' },
    { value: 'cuidados_pessoais', label: 'Cuidados Pessoais' },
    { value: 'fisioterapia', label: 'Fisioterapia' },
    { value: 'cuidados_medicos', label: 'Cuidados Médicos' },
    { value: 'recreacao', label: 'Recreação' },
    { value: 'observacao', label: 'Observação' },
  ];

  const templatesPorCategoria = templates.reduce((acc, template) => {
    if (!acc[template.categoria]) {
      acc[template.categoria] = [];
    }
    acc[template.categoria].push(template);
    return acc;
  }, {} as { [key: string]: AtividadeTemplate[] });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <CardTitle>Novo Registro no Prontuário</CardTitle>
        </div>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="residente">Residente *</Label>
              <Select
                value={formData.residente_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, residente_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o residente" />
                </SelectTrigger>
                <SelectContent>
                  {residentes.map((residente) => (
                    <SelectItem key={residente.id} value={residente.id}>
                      {residente.nome_completo} - {residente.numero_prontuario}
                      {residente.quarto && ` (Quarto ${residente.quarto})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Template de Atividade</Label>
              <Select
                value={formData.template_id}
                onValueChange={handleTemplateSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(templatesPorCategoria).map(([categoria, templateList]) => (
                    <div key={categoria}>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                        {tiposRegistro.find(t => t.value === categoria)?.label || categoria}
                      </div>
                      {templateList.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.nome}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Registro *</Label>
              <Select
                value={formData.tipo_registro}
                onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_registro: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposRegistro.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ex: Medicação matinal, Banho assistido..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva detalhadamente a atividade realizada..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Observações adicionais, reações do residente, etc..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Registro
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}