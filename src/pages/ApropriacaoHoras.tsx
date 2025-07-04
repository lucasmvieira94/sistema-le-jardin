
import React, { useState, useEffect } from "react";
import { Clock, Search, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import FolhaPontoTable from "@/components/apropriacao/FolhaPontoTable";
import { toast } from "@/components/ui/use-toast";

interface Funcionario {
  id: string;
  nome_completo: string;
}

export default function ApropriacaoHoras() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [carregando, setCarregando] = useState(false);
  const [mostrarTabela, setMostrarTabela] = useState(false);

  useEffect(() => {
    carregarFuncionarios();
  }, []);

  const carregarFuncionarios = async () => {
    const { data, error } = await supabase
      .from("funcionarios")
      .select("id, nome_completo")
      .eq("ativo", true)
      .order("nome_completo");

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar funcionários",
        description: error.message
      });
      return;
    }

    setFuncionarios(data || []);
  };

  const handleBuscar = async () => {
    if (!funcionarioSelecionado || !dataInicio || !dataFim) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Selecione um funcionário e defina o período"
      });
      return;
    }

    if (new Date(dataInicio) > new Date(dataFim)) {
      toast({
        variant: "destructive",
        title: "Período inválido",
        description: "A data inicial deve ser menor que a data final"
      });
      return;
    }

    setCarregando(true);
    setMostrarTabela(true);
    setCarregando(false);
  };

  const hoje = new Date().toISOString().split('T')[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  return (
    <div className="container mx-auto max-w-6xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary">Apropriação de Horas</h2>
      
      <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-6 h-6 text-primary" />
          <div>
            <h3 className="text-xl font-semibold">Visualizar e Editar Registros de Ponto</h3>
            <p className="text-muted-foreground">
              Consulte e faça correções nos registros de ponto dos funcionários
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <Label htmlFor="funcionario">Funcionário</Label>
            <Select value={funcionarioSelecionado} onValueChange={setFuncionarioSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um funcionário" />
              </SelectTrigger>
              <SelectContent>
                {funcionarios.map((func) => (
                  <SelectItem key={func.id} value={func.id}>
                    {func.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="data-inicio">Data Início</Label>
            <Input
              id="data-inicio"
              type="date"
              value={dataInicio || inicioMes}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="data-fim">Data Fim</Label>
            <Input
              id="data-fim"
              type="date"
              value={dataFim || hoje}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button 
              onClick={handleBuscar}
              disabled={carregando}
              className="w-full"
            >
              <Search className="w-4 h-4 mr-2" />
              {carregando ? "Carregando..." : "Buscar"}
            </Button>
          </div>
        </div>
      </div>

      {mostrarTabela && funcionarioSelecionado && dataInicio && dataFim && (
        <FolhaPontoTable
          funcionarioId={funcionarioSelecionado}
          dataInicio={dataInicio}
          dataFim={dataFim}
        />
      )}
    </div>
  );
}
