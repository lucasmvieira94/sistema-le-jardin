import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormularioTemperatura } from "@/components/temperatura/FormularioTemperatura";
import { useNavigate } from "react-router-dom";

const ControleTemperaturaPublico = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    // Voltar para página inicial após 2 segundos
    setTimeout(() => {
      navigate("/");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
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
};

export default ControleTemperaturaPublico;