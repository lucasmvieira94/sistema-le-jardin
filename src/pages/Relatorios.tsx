
import React, { useState, useEffect } from "react";
import { FileBarChart2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ModalFolhaPonto from "@/components/relatorios/ModalFolhaPonto";

interface Funcionario {
  id: string;
  nome_completo: string;
}

export default function Relatorios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [modalFolhaPontoOpen, setModalFolhaPontoOpen] = useState(false);

  useEffect(() => {
    fetchFuncionarios();
  }, []);

  async function fetchFuncionarios() {
    const { data } = await supabase
      .from("funcionarios")
      .select("id, nome_completo")
      .eq("ativo", true)
      .order("nome_completo");
    
    if (data) setFuncionarios(data);
  }

  return (
    <div className="container mx-auto max-w-2xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary">Relatórios Mensais</h2>
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <p className="mb-6 text-muted-foreground">
          Gere relatórios mensais detalhados por colaborador, exporte para PDF ou Excel.
        </p>
        
        <div className="grid gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">Folha de Ponto Mensal</h3>
                <p className="text-sm text-muted-foreground">
                  Relatório completo com registros diários, horas trabalhadas, extras e faltas
                </p>
              </div>
            </div>
            <Button onClick={() => setModalFolhaPontoOpen(true)}>
              <FileBarChart2 className="w-4 h-4 mr-2" />
              Gerar Folha de Ponto
            </Button>
          </div>

          <div className="border rounded-lg p-4 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <FileBarChart2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-muted-foreground">Relatório de Horas Extras</h3>
                <p className="text-sm text-muted-foreground">
                  Relatório detalhado de horas extras por período (em breve)
                </p>
              </div>
            </div>
            <Button disabled variant="outline">
              Em breve
            </Button>
          </div>

          <div className="border rounded-lg p-4 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <FileBarChart2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-muted-foreground">Relatório de Faltas</h3>
                <p className="text-sm text-muted-foreground">
                  Consolidado de faltas e abonos por funcionário (em breve)
                </p>
              </div>
            </div>
            <Button disabled variant="outline">
              Em breve
            </Button>
          </div>
        </div>
      </div>

      <ModalFolhaPonto 
        open={modalFolhaPontoOpen}
        onOpenChange={setModalFolhaPontoOpen}
        funcionarios={funcionarios}
      />
    </div>
  );
}
