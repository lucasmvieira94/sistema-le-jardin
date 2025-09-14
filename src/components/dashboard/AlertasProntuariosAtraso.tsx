import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock, ShieldCheck, Calendar, User } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

interface ProntuarioAtraso {
  ciclo_id: string;
  residente_id: string;
  residente_nome: string;
  data_ciclo: string;
  data_inicio_efetivo: string | null;
  horas_atraso: number;
  funcionario_iniciou: string | null;
}

export default function AlertasProntuariosAtraso() {
  const [prontuariosAtraso, setProntuariosAtraso] = useState<ProntuarioAtraso[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [selectedCiclo, setSelectedCiclo] = useState<ProntuarioAtraso | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const fetchProntuariosAtraso = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .rpc('buscar_prontuarios_em_atraso');

      if (error) {
        console.error('Erro ao buscar prontuários em atraso:', error);
        throw error;
      }

      setProntuariosAtraso(data || []);
    } catch (error) {
      console.error('Erro ao carregar prontuários em atraso:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os prontuários em atraso",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProntuariosAtraso();
    
    // Atualizar a cada 5 minutos
    const interval = setInterval(fetchProntuariosAtraso, 300000);
    return () => clearInterval(interval);
  }, []);

  const handleFinalizarClick = (prontuario: ProntuarioAtraso) => {
    setSelectedCiclo(prontuario);
    setJustificativa("");
    setShowFinalizarDialog(true);
  };

  const handleConfirmFinalizar = async () => {
    if (!selectedCiclo || !justificativa.trim()) {
      toast({
        title: "Erro",
        description: "Justificativa é obrigatória",
        variant: "destructive",
      });
      return;
    }

    setFinalizando(true);
    try {
      const { data, error } = await supabase
        .rpc('finalizar_prontuario_atraso_gestor', {
          p_ciclo_id: selectedCiclo.ciclo_id,
          p_gestor_id: null, // Será preenchido automaticamente pela função
          p_justificativa: justificativa
        });

      if (error) throw error;

      const result = data?.[0];
      
      if (result?.success) {
        toast({
          title: "Sucesso",
          description: result.message,
        });
        
        setShowFinalizarDialog(false);
        setSelectedCiclo(null);
        setJustificativa("");
        
        // Recarregar lista
        fetchProntuariosAtraso();
      } else {
        toast({
          title: "Erro",
          description: result?.message || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao finalizar prontuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível finalizar o prontuário",
        variant: "destructive",
      });
    } finally {
      setFinalizando(false);
    }
  };

  const getAtrasoSeverity = (horas: number) => {
    if (horas < 24) return "warning";
    if (horas < 48) return "error";
    return "critical";
  };

  const getAtrasoColor = (horas: number) => {
    if (horas < 24) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (horas < 48) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  if (roleLoading || loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <CardTitle className="text-lg">Prontuários em Atraso</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <CardTitle className="text-lg">Prontuários em Atraso</CardTitle>
            </div>
            {prontuariosAtraso.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {prontuariosAtraso.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {prontuariosAtraso.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-muted-foreground">
                Todos os prontuários estão em dia! 
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {prontuariosAtraso.map((prontuario) => (
                <div 
                  key={prontuario.ciclo_id}
                  className={`p-3 rounded-lg border ${getAtrasoColor(prontuario.horas_atraso)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 flex-shrink-0" />
                        <h4 className="font-medium truncate">
                          {prontuario.residente_nome}
                        </h4>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {format(new Date(prontuario.data_ciclo + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">
                          {prontuario.horas_atraso}h de atraso
                          {prontuario.data_inicio_efetivo && (
                            <span className="ml-1 text-muted-foreground">
                              (iniciado {formatDistanceToNow(new Date(prontuario.data_inicio_efetivo), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })})
                            </span>
                          )}
                        </span>
                      </div>

                      {prontuario.funcionario_iniciou && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Iniciado por: {prontuario.funcionario_iniciou}
                        </p>
                      )}
                    </div>

                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFinalizarClick(prontuario)}
                        className="flex-shrink-0"
                      >
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Finalizar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Finalização */}
      <Dialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-orange-500" />
              Finalizar Prontuário em Atraso
            </DialogTitle>
          </DialogHeader>
          
          {selectedCiclo && (
            <div className="space-y-4">
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <p className="text-sm">
                  <strong>Residente:</strong> {selectedCiclo.residente_nome}
                </p>
                <p className="text-sm">
                  <strong>Data:</strong> {format(new Date(selectedCiclo.data_ciclo + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                </p>
                <p className="text-sm">
                  <strong>Atraso:</strong> {selectedCiclo.horas_atraso} horas
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="justificativa">
                  Justificativa (obrigatória para auditoria)
                </Label>
                <Textarea
                  id="justificativa"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Descreva o motivo da finalização administrativa deste prontuário em atraso..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFinalizarDialog(false)}
                  disabled={finalizando}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmFinalizar}
                  disabled={!justificativa.trim() || finalizando}
                  className="flex-1"
                >
                  {finalizando ? "Finalizando..." : "Finalizar Prontuário"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}