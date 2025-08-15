import { useState } from "react";
import { useLocation } from "react-router-dom";
import { FileHeart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResidentesList from "@/components/prontuario/ResidentesList";
import RegistrosProntuario from "@/components/prontuario/RegistrosProntuario";
import CodigoFuncionarioInput from "@/components/CodigoFuncionarioInput";

export default function Prontuario() {
  const location = useLocation();
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcionarioNome, setFuncionarioNome] = useState<string>("");
  const [selectedResidente, setSelectedResidente] = useState<string | null>(null);

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

  const handleFuncionarioValidado = (id: string, nome: string) => {
    setFuncionarioId(id);
    setFuncionarioNome(nome);
  };

  const handleLogout = () => {
    setFuncionarioId(null);
    setFuncionarioNome("");
    setSelectedResidente(null);
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileHeart className="w-8 h-8 text-primary" />
            Prontuário Eletrônico
          </h1>
          <p className="text-muted-foreground">
            Registros de atividades e observações dos residentes
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Logado como: <span className="font-medium">{funcionarioNome}</span>
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
          >
            Usar outro código
          </Button>
        </div>
      </div>

      <Tabs defaultValue="registros" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="registros">Registros do Dia</TabsTrigger>
          <TabsTrigger value="residentes">Gerenciar Residentes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="registros" className="space-y-4">
          <RegistrosProntuario 
            funcionarioId={funcionarioId}
            selectedResidente={selectedResidente}
            onSelectResidente={setSelectedResidente}
          />
        </TabsContent>
        
        <TabsContent value="residentes" className="space-y-4">
          <ResidentesList />
        </TabsContent>
      </Tabs>
    </div>
  );
}