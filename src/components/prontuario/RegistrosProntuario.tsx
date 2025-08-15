import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Calendar, Clock, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NovoRegistroForm from "./NovoRegistroForm";

interface Residente {
  id: string;
  nome_completo: string;
  numero_prontuario: string;
  quarto?: string;
}

interface RegistroProntuario {
  id: string;
  residente_id: string;
  funcionario_id: string;
  data_registro: string;
  horario_registro: string;
  tipo_registro: string;
  titulo: string;
  descricao: string;
  observacoes?: string;
  residentes?: {
    nome_completo: string;
    numero_prontuario: string;
    quarto?: string;
  };
  funcionarios?: {
    nome_completo: string;
  };
}

interface RegistrosProntuarioProps {
  funcionarioId: string;
  selectedResidente: string | null;
  onSelectResidente: (residenteId: string | null) => void;
}

export default function RegistrosProntuario({ 
  funcionarioId, 
  selectedResidente, 
  onSelectResidente 
}: RegistrosProntuarioProps) {
  const [residentes, setResidentes] = useState<Residente[]>([]);
  const [registros, setRegistros] = useState<RegistroProntuario[]>([]);
  const [showNovoRegistro, setShowNovoRegistro] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchResidentes = async () => {
    try {
      const { data, error } = await supabase
        .from('residentes')
        .select('id, nome_completo, numero_prontuario, quarto')
        .eq('ativo', true)
        .order('nome_completo');

      if (error) throw error;
      setResidentes(data || []);
    } catch (error) {
      console.error('Erro ao carregar residentes:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de residentes",
        variant: "destructive",
      });
    }
  };

  const fetchRegistros = async () => {
    try {
      setLoading(true);
      const hoje = format(new Date(), 'yyyy-MM-dd');
      
      let query = supabase
        .from('prontuario_registros')
        .select(`
          *,
          residentes (
            nome_completo,
            numero_prontuario,
            quarto
          ),
          funcionarios (
            nome_completo
          )
        `)
        .eq('data_registro', hoje)
        .order('horario_registro', { ascending: false });

      if (selectedResidente) {
        query = query.eq('residente_id', selectedResidente);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRegistros(data || []);
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
    fetchResidentes();
  }, []);

  useEffect(() => {
    fetchRegistros();
  }, [selectedResidente]);

  const handleRegistroCriado = () => {
    setShowNovoRegistro(false);
    fetchRegistros();
    toast({
      title: "Sucesso",
      description: "Registro adicionado ao prontuário com sucesso!",
    });
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

  if (showNovoRegistro) {
    return (
      <NovoRegistroForm
        funcionarioId={funcionarioId}
        residentes={residentes}
        onSuccess={handleRegistroCriado}
        onCancel={() => setShowNovoRegistro(false)}
        preSelectedResidente={selectedResidente}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedResidente || "todos"} onValueChange={(value) => onSelectResidente(value === "todos" ? null : value)}>
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Selecione um residente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os residentes</SelectItem>
              {residentes.map((residente) => (
                <SelectItem key={residente.id} value={residente.id}>
                  {residente.nome_completo} - {residente.numero_prontuario}
                  {residente.quarto && ` (Quarto ${residente.quarto})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button onClick={() => setShowNovoRegistro(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Registro
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="w-4 h-4" />
        <span>Registros de hoje - {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Carregando registros...</p>
          </div>
        </div>
      ) : registros.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhum registro encontrado
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {selectedResidente 
                  ? "Este residente ainda não possui registros hoje"
                  : "Nenhum registro foi feito hoje"
                }
              </p>
              <Button onClick={() => setShowNovoRegistro(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar primeiro registro
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {registros.map((registro) => (
            <Card key={registro.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getTipoColor(registro.tipo_registro)}>
                        {getTipoLabel(registro.tipo_registro)}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {registro.horario_registro}
                      </div>
                    </div>
                    <CardTitle className="text-lg">{registro.titulo}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {registro.residentes?.nome_completo} - {registro.residentes?.numero_prontuario}
                    </span>
                    {registro.residentes?.quarto && (
                      <Badge variant="outline" className="text-xs">
                        Quarto {registro.residentes.quarto}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm text-gray-700">{registro.descricao}</p>
                  </div>
                  
                  {registro.observacoes && (
                    <div className="bg-blue-50 p-3 rounded-md">
                      <p className="text-xs font-medium text-blue-800 mb-1">Observações:</p>
                      <p className="text-sm text-blue-700">{registro.observacoes}</p>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Registrado por: {registro.funcionarios?.nome_completo}</span>
                    <span>{format(new Date(registro.data_registro), "dd/MM/yyyy")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}