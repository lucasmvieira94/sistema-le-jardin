import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CodigoFuncionarioInput from "@/components/CodigoFuncionarioInput";
import { Clock, FileText, LogOut } from "lucide-react";

export default function Index() {
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [funcionarioNome, setFuncionarioNome] = useState<string>("");
  const navigate = useNavigate();

  const handleFuncionarioValidado = (id: string, nome: string) => {
    setFuncionarioId(id);
    setFuncionarioNome(nome);
  };

  const handleLogout = () => {
    setFuncionarioId("");
    setFuncionarioNome("");
  };

  const navigateToRegistroPonto = () => {
    navigate(`/registro-ponto?funcionarioId=${funcionarioId}&funcionarioNome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToProntuario = () => {
    navigate(`/prontuario?funcionarioId=${funcionarioId}&funcionarioNome=${encodeURIComponent(funcionarioNome)}`);
  };

  if (!funcionarioId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto shadow-lg">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-primary">Bem-vindo</h1>
                <p className="text-lg text-muted-foreground">Sistema de Cuidadores</p>
              </div>
              
              <CodigoFuncionarioInput onFuncionarioValidado={handleFuncionarioValidado} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="container max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 pt-8">
          <h1 className="text-4xl font-bold text-primary">Olá, {funcionarioNome}!</h1>
          <p className="text-lg text-muted-foreground">Escolha uma opção para continuar</p>
        </div>

        {/* Main Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={navigateToRegistroPonto}>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Registrar Ponto</h3>
              <p className="text-muted-foreground">Registre sua entrada, saída e intervalos</p>
              <Button className="w-full" size="lg">
                Acessar
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={navigateToProntuario}>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Prontuário</h3>
              <p className="text-muted-foreground">Acesse e gerencie prontuários dos residentes</p>
              <Button className="w-full" size="lg">
                Acessar
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Logout Button */}
        <div className="text-center">
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
