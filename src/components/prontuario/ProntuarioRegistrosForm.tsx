import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Save, Lock, AlertTriangle, Shield } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CodigoFinalizacaoProntuario from "./CodigoFinalizacaoProntuario";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CicloForm {
  id: string;
  data_ciclo: string;
  status: string;
  data_inicio_efetivo?: string;
  residente: {
    nome_completo: string;
    numero_prontuario: string;
    quarto?: string;
  };
}

interface Registro {
  id: string;
  tipo_registro: string;
  titulo: string;
  descricao: string;
  observacoes?: string;
  funcionario_id?: string;
  horario_registro: string;
  jsonData?: any;
  funcionarios?: {
    nome_completo: string;
  };
}

interface ProntuarioRegistrosFormProps {
  ciclo: CicloForm;
  funcionarioId: string;
  onBack: () => void;
  onEncerrar: () => void;
  onUpdate: () => void;
}

export default function ProntuarioRegistrosForm({
  ciclo,
  funcionarioId,
  onBack,
  onEncerrar,
  onUpdate
}: ProntuarioRegistrosFormProps) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const { toast } = useToast();

  const fetchRegistros = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('prontuario_registros')
        .select(`
          *,
          funcionarios (
            nome_completo
          )
        `)
        .eq('ciclo_id', ciclo.id)
        .order('tipo_registro, titulo');

      if (error) throw error;
      
      // Processar registros, incluindo dados JSON para prontuários encerrados
      const processedRegistros = (data || []).map(registro => {
        if (registro.tipo_registro === 'prontuario_completo' && registro.descricao) {
          try {
            const jsonData = JSON.parse(registro.descricao);
            return {
              ...registro,
              jsonData
            };
          } catch {
            // Se não for JSON válido, mantém como string
            return registro;
          }
        }
        return registro;
      });
      
      setRegistros(processedRegistros);
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar registros do prontuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistros();
  }, [ciclo.id]);

  const handleFinalizarProntuario = async (codigo: string, funcionarioNome: string) => {
    setFinalizando(true);
    try {
      // Marcar início efetivo se ainda não foi marcado
      if (ciclo.status === 'nao_iniciado') {
        await supabase
          .from('prontuario_ciclos')
          .update({
            status: 'em_andamento',
            data_inicio_efetivo: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', ciclo.id);
      }

      // Chamar função para finalizar o prontuário
      const { data, error } = await supabase
        .rpc('finalizar_prontuario_diario', {
          p_ciclo_id: ciclo.id,
          p_funcionario_id: funcionarioId,
          p_codigo_validacao: codigo
        });

      if (error) throw error;

      const result = data?.[0];
      
      if (result?.success) {
        toast({
          title: "Prontuário finalizado",
          description: `Prontuário finalizado com sucesso por ${funcionarioNome}`,
        });
        setShowFinalizarDialog(false);
        onUpdate();
        onBack(); // Voltar à lista após finalizar
      } else {
        toast({
          title: "Erro ao finalizar",
          description: result?.message || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao finalizar prontuário:', error);
      toast({
        title: "Erro ao finalizar",
        description: "Não foi possível finalizar o prontuário.",
        variant: "destructive",
      });
    } finally {
      setFinalizando(false);
    }
  };

  const handleSaveRegistro = async (registroId: string, descricao: string, observacoes?: string) => {
    try {
      setSaving(true);
      
      // Marcar início efetivo do ciclo se ainda não foi marcado
      if (!ciclo.data_inicio_efetivo && ciclo.status === 'nao_iniciado') {
        await supabase
          .from('prontuario_ciclos')
          .update({
            status: 'em_andamento',
            data_inicio_efetivo: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', ciclo.id);
        
        onUpdate(); // Atualizar o estado do ciclo
      }

      const { error } = await supabase
        .from('prontuario_registros')
        .update({
          descricao,
          observacoes,
          funcionario_id: funcionarioId,
          horario_registro: format(new Date(), 'HH:mm:ss'),
          updated_at: new Date().toISOString()
        })
        .eq('id', registroId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Registro salvo com sucesso!",
      });

      fetchRegistros();
      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar registro:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar registro",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getTipoColor = (tipo: string) => {
    const colors: { [key: string]: string } = {
      'medicacao': 'bg-red-100 text-red-800',
      'alimentacao': 'bg-green-100 text-green-800',
      'cuidados_pessoais': 'bg-blue-100 text-blue-800',
      'fisioterapia': 'bg-purple-100 text-purple-800',
      'cuidados_medicos': 'bg-orange-100 text-orange-800',
      'recreacao': 'bg-pink-100 text-pink-800',
      'observacao': 'bg-gray-100 text-gray-800',
    };
    return colors[tipo] || 'bg-gray-100 text-gray-800';
  };

  const getTipoLabel = (tipo: string) => {
    const labels: { [key: string]: string } = {
      'medicacao': 'Medicação',
      'alimentacao': 'Alimentação',
      'cuidados_pessoais': 'Cuidados Pessoais',
      'fisioterapia': 'Fisioterapia',
      'cuidados_medicos': 'Cuidados Médicos',
      'recreacao': 'Recreação',
      'observacao': 'Observação',
    };
    return labels[tipo] || tipo;
  };

  // Agrupar registros por tipo
  const registrosPorTipo = registros.reduce((acc, registro) => {
    if (!acc[registro.tipo_registro]) {
      acc[registro.tipo_registro] = [];
    }
    acc[registro.tipo_registro].push(registro);
    return acc;
  }, {} as Record<string, Registro[]>);

  const tipos = Object.keys(registrosPorTipo).sort();
  const isReadOnly = ciclo.status === 'encerrado';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Carregando registros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h2 className="text-2xl font-bold">
              Prontuário - {ciclo.residente.nome_completo}
            </h2>
            <p className="text-muted-foreground">
              {format(new Date(ciclo.data_ciclo), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} •
              Prontuário: {ciclo.residente.numero_prontuario}
              {ciclo.residente.quarto && ` • Quarto: ${ciclo.residente.quarto}`}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {ciclo.status !== 'encerrado' && (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => setShowFinalizarDialog(true)}
              disabled={finalizando}
            >
              <Shield className="w-4 h-4 mr-2" />
              {finalizando ? 'Finalizando...' : 'Finalizar Prontuário'}
            </Button>
          )}
          
          {ciclo.status === 'completo' && !isReadOnly && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Lock className="w-4 h-4 mr-2" />
                  Encerrar Ciclo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Encerramento</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja encerrar este ciclo do prontuário? 
                    Após o encerramento, não será mais possível editar os registros.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onEncerrar}>
                    Encerrar Ciclo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          <Badge className={
            ciclo.status === 'encerrado' ? 'bg-gray-100 text-gray-800' :
            ciclo.status === 'completo' ? 'bg-green-100 text-green-800' :
            'bg-yellow-100 text-yellow-800'
          }>
            {ciclo.status === 'encerrado' ? 'ENCERRADO' :
             ciclo.status === 'completo' ? 'COMPLETO' : 'EM ANDAMENTO'}
          </Badge>
        </div>
      </div>

      {isReadOnly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              Este prontuário foi encerrado e não pode mais ser editado.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue={tipos[0]} className="space-y-4">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tipos.length}, 1fr)` }}>
          {tipos.map((tipo) => (
            <TabsTrigger key={tipo} value={tipo} className="text-xs">
              {getTipoLabel(tipo)}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {tipos.map((tipo) => (
          <TabsContent key={tipo} value={tipo} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge className={getTipoColor(tipo)}>
                {getTipoLabel(tipo)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {registrosPorTipo[tipo].length} registro(s)
              </span>
            </div>
            
            <div className="space-y-4">
              {registrosPorTipo[tipo].map((registro) => (
                <RegistroCard
                  key={registro.id}
                  registro={registro}
                  onSave={handleSaveRegistro}
                  isReadOnly={isReadOnly}
                  saving={saving}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      
      {/* Dialog para finalização com código */}
      <Dialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Prontuário</DialogTitle>
          </DialogHeader>
          <CodigoFinalizacaoProntuario
            onCodigoValidado={handleFinalizarProntuario}
            onCancel={() => setShowFinalizarDialog(false)}
            disabled={finalizando}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RegistroCardProps {
  registro: Registro;
  onSave: (id: string, descricao: string, observacoes?: string) => void;
  isReadOnly: boolean;
  saving: boolean;
}

function RegistroCard({ registro, onSave, isReadOnly, saving }: RegistroCardProps) {
  const [descricao, setDescricao] = useState(registro.descricao);
  const [observacoes, setObservacoes] = useState(registro.observacoes || '');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed = descricao !== registro.descricao || observacoes !== (registro.observacoes || '');
    setHasChanges(changed);
  }, [descricao, observacoes, registro]);

  const handleSave = () => {
    onSave(registro.id, descricao, observacoes);
    setHasChanges(false);
  };

  const isPreenchido = registro.funcionario_id && registro.descricao.trim() !== '';

  // Renderizar dados JSON para prontuários encerrados
  const renderJsonData = (jsonData: any) => {
    return (
      <div className="space-y-4">
        {jsonData.medicacoes && jsonData.medicacoes.length > 0 && (
          <div className="bg-red-50 p-3 rounded-md">
            <h4 className="font-medium text-red-800 mb-2">Medicações</h4>
            {jsonData.medicacoes.map((med: any, index: number) => (
              <div key={index} className="text-sm text-red-700">
                {med.nome && (
                  <p><strong>Nome:</strong> {med.nome}</p>
                )}
                {med.dosagem && (
                  <p><strong>Dosagem:</strong> {med.dosagem}</p>
                )}
                {med.horarios && med.horarios.length > 0 && (
                  <p><strong>Horários:</strong> {med.horarios.join(', ')}</p>
                )}
                {med.observacoes && (
                  <p><strong>Observações:</strong> {med.observacoes}</p>
                )}
              </div>
            ))}
          </div>
        )}
        
        {jsonData.dor && jsonData.dor.length > 0 && (
          <div className="bg-orange-50 p-3 rounded-md">
            <h4 className="font-medium text-orange-800 mb-2">Nível de Dor</h4>
            <p className="text-sm text-orange-700">Escala: {jsonData.dor.join(', ')}</p>
          </div>
        )}
        
        {jsonData.atividades_realizadas && jsonData.atividades_realizadas.length > 0 && (
          <div className="bg-green-50 p-3 rounded-md">
            <h4 className="font-medium text-green-800 mb-2">Atividades Realizadas</h4>
            <ul className="text-sm text-green-700 list-disc list-inside">
              {jsonData.atividades_realizadas.map((ativ: string, index: number) => (
                <li key={index}>{ativ}</li>
              ))}
            </ul>
          </div>
        )}
        
        {jsonData.doencas_cronicas && jsonData.doencas_cronicas.length > 0 && (
          <div className="bg-yellow-50 p-3 rounded-md">
            <h4 className="font-medium text-yellow-800 mb-2">Doenças Crônicas</h4>
            <ul className="text-sm text-yellow-700 list-disc list-inside">
              {jsonData.doencas_cronicas.map((doenca: string, index: number) => (
                <li key={index}>{doenca}</li>
              ))}
            </ul>
          </div>
        )}
        
        {jsonData.ocorrencias && jsonData.ocorrencias.length > 0 && (
          <div className="bg-red-50 p-3 rounded-md">
            <h4 className="font-medium text-red-800 mb-2">Ocorrências</h4>
            <ul className="text-sm text-red-700 list-disc list-inside">
              {jsonData.ocorrencias.map((ocor: string, index: number) => (
                <li key={index}>{ocor}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Campos dinâmicos */}
        {Object.entries(jsonData).map(([key, value]) => {
          if (key.startsWith('campo_') && value) {
            const fieldName = key.replace('campo_', '').replace(/-/g, ' ');
            return (
              <div key={key} className="bg-blue-50 p-3 rounded-md">
                <h4 className="font-medium text-blue-800 mb-1 capitalize">{fieldName}</h4>
                <p className="text-sm text-blue-700">{String(value)}</p>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <Card className={isPreenchido ? 'border-green-200 bg-green-50' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{registro.titulo}</CardTitle>
          <div className="flex items-center gap-2">
            {isPreenchido && (
              <Badge variant="outline" className="text-green-700 border-green-300">
                Finalizado
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {registro.horario_registro}
            </span>
          </div>
        </div>
        {registro.funcionarios?.nome_completo && (
          <p className="text-sm text-muted-foreground">
            Registrado por: {registro.funcionarios.nome_completo}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Mostrar dados JSON se existirem (prontuários finalizados) */}
        {registro.jsonData ? (
          renderJsonData(registro.jsonData)
        ) : (
          <>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Descrição do Atendimento *
              </label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o atendimento realizado..."
                disabled={isReadOnly}
                rows={3}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Observações Adicionais
              </label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações complementares (opcional)..."
                disabled={isReadOnly}
                rows={2}
              />
            </div>
          </>
        )}
        
        {!isReadOnly && !registro.jsonData && (
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || !descricao.trim() || saving}
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Registro'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}