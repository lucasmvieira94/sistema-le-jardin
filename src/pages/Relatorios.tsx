
import React, { useState, useEffect } from "react";
import { FileBarChart2, FileText, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ModalFolhaPonto from "@/components/relatorios/ModalFolhaPonto";
import ModalFolhaPontoGeral from "@/components/relatorios/ModalFolhaPontoGeral";
import ModalEscalaMensal from "@/components/relatorios/ModalEscalaMensal";

interface Funcionario {
  id: string;
  nome_completo: string;
}

export default function Relatorios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [modalFolhaPontoOpen, setModalFolhaPontoOpen] = useState(false);
  const [modalFolhaPontoGeralOpen, setModalFolhaPontoGeralOpen] = useState(false);
  const [modalEscalaMensalOpen, setModalEscalaMensalOpen] = useState(false);

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
                <h3 className="font-semibold">Folha de Ponto Individual</h3>
                <p className="text-sm text-muted-foreground">
                  Relatório de um funcionário específico com registros diários, horas trabalhadas, extras e faltas
                </p>
              </div>
            </div>
            <Button onClick={() => setModalFolhaPontoOpen(true)}>
              <FileBarChart2 className="w-4 h-4 mr-2" />
              Gerar Folha Individual
            </Button>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">Folhas de Ponto - Todos os Funcionários</h3>
                <p className="text-sm text-muted-foreground">
                  Relatório consolidado com folhas de ponto de todos os funcionários ativos do período
                </p>
              </div>
            </div>
            <Button onClick={() => setModalFolhaPontoGeralOpen(true)} variant="secondary">
              <Users className="w-4 h-4 mr-2" />
              Gerar Folhas Completas
            </Button>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">Escala Mensal - Todos os Funcionários</h3>
                <p className="text-sm text-muted-foreground">
                  Grade visual com a escala de trabalho de todos os funcionários do mês
                </p>
              </div>
            </div>
            <Button onClick={() => setModalEscalaMensalOpen(true)} variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Gerar Escala Mensal
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

      <ModalFolhaPontoGeral 
        open={modalFolhaPontoGeralOpen}
        onOpenChange={setModalFolhaPontoGeralOpen}
        funcionarios={funcionarios}
      />

      <ModalEscalaMensal 
        open={modalEscalaMensalOpen}
        onOpenChange={setModalEscalaMensalOpen}
        funcionarios={funcionarios}
      />
    </div>
  );
}
