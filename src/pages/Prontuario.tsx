import { useState } from "react";
import { useLocation } from "react-router-dom";
import { FileHeart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import NovoFormularioProntuario from "@/components/prontuario/NovoFormularioProntuario";
import GerenciamentoResidentes from "@/components/prontuario/GerenciamentoResidentes";
import ResidentesList from "@/components/prontuario/ResidentesList";
import CodigoFuncionarioInput from "@/components/CodigoFuncionarioInput";

export default function Prontuario() {
  const location = useLocation();
  const { toast } = useToast();
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcionarioNome, setFuncionarioNome] = useState<string>("");
  const [selectedResidente, setSelectedResidente] = useState<string | null>(null);
  const [residentes, setResidentes] = useState<any[]>([]);

  // Verificar se já tem dados do funcionário na URL (vindos do registro de ponto)
  useState(() => {
    const searchParams = new URLSearchParams(location.search);
    const funcId = searchParams.get('funcionario_id');
    const funcNome = searchParams.get('funcionario_nome');
    
    if (funcId && funcNome) {
      setFuncionarioId(funcId);
      setFuncionarioNome(decodeURIComponent(funcNome));
    }
  });

  const handleFuncionarioValidado = async (id: string, nome: string) => {
    setFuncionarioId(id);
    setFuncionarioNome(nome);
    
    // Carregar residentes
    const { data } = await supabase
      .from('residentes')
      .select('*')
      .eq('ativo', true);
    
    if (data) {
      setResidentes(data);
    }
  };

  const handleLogout = () => {
    setFuncionarioId(null);
    setFuncionarioNome("");
    setSelectedResidente(null);
    setResidentes([]);
  };

  if (!funcionarioId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <FileHeart className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Sistema de Prontuário Eletrônico
            </h1>
            <p className="text-gray-600">
              Registre atividades e observações dos residentes
            </p>
          </div>
          
          <CodigoFuncionarioInput onFuncionarioValidado={handleFuncionarioValidado} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileHeart className="w-6 h-6 text-primary" />
                Prontuário Eletrônico
              </h1>
              <p className="text-sm text-muted-foreground">
                {funcionarioNome}
              </p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
            >
              Trocar usuário
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="prontuario" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="prontuario">Prontuário Diário</TabsTrigger>
            <TabsTrigger value="residentes">Gerenciar Residentes</TabsTrigger>
          </TabsList>

          <TabsContent value="prontuario" className="space-y-6">
            {!selectedResidente ? (
              <div className="space-y-6">
                <div className="text-center">
                  <UserPlus className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">Selecione um residente</h2>
                  <p className="text-muted-foreground">
                    Escolha o residente para preencher o prontuário diário
                  </p>
                </div>
                
                <div className="max-w-md mx-auto">
                  <Select onValueChange={setSelectedResidente}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecione um residente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {residentes.map((residente) => (
                        <SelectItem key={residente.id} value={residente.id}>
                          {residente.nome_completo} - Quarto {residente.quarto || 'N/A'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {residentes.length === 0 && (
                  <div className="text-center mt-8">
                    <Button variant="outline" onClick={() => window.location.reload()}>
                      Recarregar residentes
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <NovoFormularioProntuario 
                funcionarioId={funcionarioId} 
                residenteId={selectedResidente}
              />
            )}
          </TabsContent>

          <TabsContent value="residentes">
            <GerenciamentoResidentes />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}