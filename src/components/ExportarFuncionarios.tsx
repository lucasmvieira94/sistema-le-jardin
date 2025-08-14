import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

type FiltroExportacao = 'todos' | 'ativos' | 'inativos';

const ExportarFuncionarios = () => {
  const [exportando, setExportando] = useState(false);

  const exportarFuncionarios = async (filtro: FiltroExportacao) => {
    setExportando(true);
    
    try {
      console.log('🚀 Iniciando exportação com filtro:', filtro);
      
      const { data, error } = await supabase.functions.invoke('exportar-funcionarios', {
        body: { filtro }
      });

      if (error) {
        console.error('❌ Erro na exportação:', error);
        toast({
          variant: "destructive",
          title: "Erro na exportação",
          description: error.message || "Não foi possível exportar os funcionários"
        });
        return;
      }

      // If we get here, the function should have returned CSV data
      // We need to handle the response as a blob for file download
      const response = await fetch(
        `https://kvjgmqicictxxfnvhuwl.supabase.co/functions/v1/exportar-funcionarios`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filtro })
        }
      );

      if (!response.ok) {
        throw new Error('Falha na exportação');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `funcionarios_${filtro}_${new Date().toISOString().split('T')[0]}.csv`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Exportação concluída",
        description: `Arquivo ${filename} baixado com sucesso`
      });

    } catch (error) {
      console.error('❌ Erro na exportação:', error);
      toast({
        variant: "destructive",
        title: "Erro na exportação",
        description: "Não foi possível exportar os funcionários"
      });
    } finally {
      setExportando(false);
    }
  };

  const getLabelFiltro = (filtro: FiltroExportacao): string => {
    switch (filtro) {
      case 'todos':
        return 'Todos os Funcionários';
      case 'ativos':
        return 'Funcionários Ativos';
      case 'inativos':
        return 'Funcionários Inativos';
      default:
        return 'Funcionários';
    }
  };

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
              Exportar
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => exportarFuncionarios('todos')}
          disabled={exportando}
        >
          <Download className="mr-2 h-4 w-4" />
          {getLabelFiltro('todos')}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => exportarFuncionarios('ativos')}
          disabled={exportando}
        >
          <Download className="mr-2 h-4 w-4" />
          {getLabelFiltro('ativos')}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => exportarFuncionarios('inativos')}
          disabled={exportando}
        >
          <Download className="mr-2 h-4 w-4" />
          {getLabelFiltro('inativos')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportarFuncionarios;