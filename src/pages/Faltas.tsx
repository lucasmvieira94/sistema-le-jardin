
import { FileCheck2, Upload } from "lucide-react";

export default function Faltas() {
  return (
    <div className="container mx-auto max-w-2xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary">Faltas & Abonos</h2>
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <p className="mb-3 text-muted-foreground">
          Registre faltas justificadas, atestados médicos ou envie comprovantes (imagem ou PDF).
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button className="bg-primary hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg flex items-center gap-2 shadow transition">
            <Upload className="w-5 h-5" /> Nova Justificativa
          </button>
        </div>
        <div className="mt-8 text-center text-muted-foreground">
          Nenhuma falta/abono registrado até o momento.
        </div>
      </div>
    </div>
  );
}
