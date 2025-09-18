import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Thermometer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormularioTemperatura } from "@/components/temperatura/FormularioTemperatura";
import { useNavigate } from "react-router-dom";

const ControleTemperaturaPublico = () => {
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const handleSuccess = () => {
    setShowForm(false);
    // Voltar para página inicial após 2 segundos
    setTimeout(() => {
      navigate("/");
    }, 2000);
  };

  if (showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-4 mb-6">
            <Button 
              variant="ghost" 
              onClick={() => setShowForm(false)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
          
          <Card className="w-full">
            <FormularioTemperatura onSuccess={handleSuccess} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
            <Thermometer className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Controle de Temperatura</CardTitle>
          <p className="text-muted-foreground">
            Registro de temperatura da sala de medicamentos
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Conforme normas ANVISA RDC 430/2020 e RDC 301/2019
            </p>
            <p className="text-sm font-medium">
              Faixa de conformidade: <span className="text-green-600">15°C a 30°C</span>
            </p>
          </div>
          
          <Button 
            onClick={() => setShowForm(true)} 
            className="w-full"
            size="lg"
          >
            <Thermometer className="h-5 w-5 mr-2" />
            Registrar Nova Medição
          </Button>
          
          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ControleTemperaturaPublico;