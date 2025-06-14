
import { CalendarRange } from "lucide-react";

export default function Escalas() {
  return (
    <div className="container mx-auto max-w-2xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary">Gestão de Escalas</h2>
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <p className="mb-3 text-muted-foreground">
          Visualize, crie, edite ou exclua escalas de trabalho personalizadas dos colaboradores.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button className="bg-primary hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg flex items-center gap-2 shadow transition">
            <CalendarRange className="w-5 h-5" /> Nova Escala
          </button>
        </div>
        <div className="mt-8 text-center text-muted-foreground">
          Nenhuma escala cadastrada ainda.
        </div>
      </div>
    </div>
  );
}
