import { useEmbutidoPortal, TituloTarefa } from "@/components/cuidados/PortalCuidadosContexto";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormularioTemperatura } from "@/components/temperatura/FormularioTemperatura";
import { useNavigate, useSearchParams } from "react-router-dom";

const ControleTemperaturaPublico = () => {
  const emb = useEmbutidoPortal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const funcionarioId = searchParams.get('funcionario_id');
  const funcionarioNome = searchParams.get('funcionario_nome');

  const handleSuccess = () => {
    // Voltar para página inicial após 2 segundos
    if (emb) return; // dentro do portal, permanece na tarefa
    setTimeout(() => {
      navigate("/");
    }, 2000);
  };

  return (
    <div className={emb ? "px-3 py-4 sm:px-4" : "min-h-screen bg-gradient-to-br from-blue-50 to-white p-4"}>
      <div className="container mx-auto max-w-4xl">
        {emb && <TituloTarefa icone={Thermometer} titulo="Temperatura" descricao="Registro de aferição" />}
        <div className={emb ? "hidden" : "flex items-center gap-4 mb-6"}>
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
          <FormularioTemperatura 
            onSuccess={handleSuccess} 
            funcionarioId={funcionarioId}
            funcionarioNome={funcionarioNome}
          />
        </Card>
      </div>
    </div>
  );
};

export default ControleTemperaturaPublico;