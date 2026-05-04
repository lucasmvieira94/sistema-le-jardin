import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  exportarFichaPDF,
  exportarFichaExcel,
  type FiltroExport,
} from "@/utils/exportFichaFuncional";

interface ExportarFuncionariosProps {
  /** IDs selecionados na lista (opcional). Quando informado, habilita exportar apenas selecionados. */
  selecionados?: string[];
}

const ExportarFuncionarios: React.FC<ExportarFuncionariosProps> = ({ selecionados = [] }) => {
  const [exportando, setExportando] = useState(false);

  async function handleExport(formato: "pdf" | "excel", filtro: FiltroExport) {
    setExportando(true);
    try {
      const ids = filtro === "selecionados" ? selecionados : undefined;
      if (formato === "pdf") await exportarFichaPDF(filtro, ids);
      else await exportarFichaExcel(filtro, ids);

      toast({
        title: "Exportação concluída",
        description: `Ficha funcional exportada em ${formato.toUpperCase()}.`,
      });
    } catch (err: any) {
      console.error("Erro na exportação:", err);
      toast({
        variant: "destructive",
        title: "Erro na exportação",
        description: err?.message || "Não foi possível gerar o arquivo",
      });
    } finally {
      setExportando(false);
    }
  }

  const temSelecao = selecionados.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exportando}>
          {exportando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Exportar Ficha
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <FileText className="h-4 w-4" /> PDF
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleExport("pdf", "ativos")} disabled={exportando}>
          Ativos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf", "inativos")} disabled={exportando}>
          Desligados
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf", "todos")} disabled={exportando}>
          Todos
        </DropdownMenuItem>
        {temSelecao && (
          <DropdownMenuItem
            onClick={() => handleExport("pdf", "selecionados")}
            disabled={exportando}
          >
            Apenas selecionados ({selecionados.length})
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleExport("excel", "ativos")} disabled={exportando}>
          Ativos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel", "inativos")} disabled={exportando}>
          Desligados
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel", "todos")} disabled={exportando}>
          Todos
        </DropdownMenuItem>
        {temSelecao && (
          <DropdownMenuItem
            onClick={() => handleExport("excel", "selecionados")}
            disabled={exportando}
          >
            Apenas selecionados ({selecionados.length})
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportarFuncionarios;
