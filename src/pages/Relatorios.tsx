
import { FileBarChart2 } from "lucide-react";

export default function Relatorios() {
  return (
    <div className="container mx-auto max-w-2xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary">Relatórios Mensais</h2>
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <p className="mb-3 text-muted-foreground">
          Gere relatórios mensais detalhados por colaborador, exporte para PDF ou CSV.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button className="bg-primary hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg flex items-center gap-2 shadow transition">
            <FileBarChart2 className="w-5 h-5" /> Gerar Relatório
          </button>
        </div>
        <div className="mt-8 text-center text-muted-foreground">
          Nenhum relatório gerado recentemente.
        </div>
      </div>
    </div>
  );
}
