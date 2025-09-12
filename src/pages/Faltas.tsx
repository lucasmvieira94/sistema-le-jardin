
import { FileX } from "lucide-react";
import { useRef } from "react";
import AfastamentoForm from "@/components/afastamentos/AfastamentoForm";
import AfastamentosList, { AfastamentosListRef } from "@/components/afastamentos/AfastamentosList";

export default function Faltas() {
  const afastamentosListRef = useRef<AfastamentosListRef>(null);

  const handleAfastamentoAdded = () => {
    afastamentosListRef.current?.fetchAfastamentos();
  };

  return (
    <div className="container mx-auto max-w-4xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary">Afastamentos</h2>
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <FileX className="w-6 h-6 text-primary" />
          <div>
            <h3 className="text-xl font-semibold">Registro de Afastamentos</h3>
            <p className="text-muted-foreground">
              Registre afastamentos de funcionários por motivos previstos na CLT, abonos ou outros tipos.
              Os registros são automaticamente lançados na folha de ponto.
            </p>
          </div>
        </div>
        
        <AfastamentoForm onAfastamentoAdded={handleAfastamentoAdded} />
        <AfastamentosList ref={afastamentosListRef} />
      </div>
    </div>
  );
}
