
import React, { useState, useEffect } from "react";
import { Clock, Search, Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import FolhaPontoTable from "@/components/apropriacao/FolhaPontoTable";
import AssistenteRHChat from "@/components/apropriacao/AssistenteRHChat";
import { toast } from "@/components/ui/use-toast";

interface Funcionario {
  id: string;
  nome_completo: string;
}

function getUltimos7Dias() {
  const hoje = new Date();
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(hoje.getDate() - 6);
  return {
    inicio: seteDiasAtras.toISOString().split("T")[0],
    fim: hoje.toISOString().split("T")[0],
  };
}

export default function ApropriacaoHoras() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>("");
  const { inicio, fim } = getUltimos7Dias();
  const [dataInicio, setDataInicio] = useState<string>(inicio);
  const [dataFim, setDataFim] = useState<string>(fim);
  const [carregando, setCarregando] = useState(false);
  const [mostrarTabela, setMostrarTabela] = useState(false);
  const [mostrarAssistente, setMostrarAssistente] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  useEffect(() => {
    carregarFuncionarios();
  }, []);

  // Auto-selecionar o primeiro funcionário e exibir a tabela
  useEffect(() => {
    if (funcionarios.length > 0 && !funcionarioSelecionado && !autoLoaded) {
      setFuncionarioSelecionado(funcionarios[0].id);
      setMostrarTabela(true);
      setAutoLoaded(true);
    }
  }, [funcionarios]);

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

  const handleBuscar = () => {
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

    setMostrarTabela(false);
    setTimeout(() => setMostrarTabela(true), 50);
  };

  const handleFuncionarioChange = (value: string) => {
    setFuncionarioSelecionado(value);
    setMostrarTabela(false);
    setTimeout(() => setMostrarTabela(true), 50);
  };

  return (
    <div className="container mx-auto max-w-6xl pt-12 font-heebo">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-3xl font-bold text-primary">Apropriação de Horas</h2>
        <Button
          variant={mostrarAssistente ? "default" : "outline"}
          onClick={() => setMostrarAssistente(!mostrarAssistente)}
          className="gap-2"
        >
          {mostrarAssistente ? <X className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
          {mostrarAssistente ? "Fechar Assistente" : "Assistente RH"}
        </Button>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-primary" />
              <div>
                <h3 className="text-xl font-semibold">Visualizar e Editar Registros de Ponto</h3>
                <p className="text-muted-foreground">
                  Exibindo os últimos 7 dias por padrão
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <Label htmlFor="funcionario">Funcionário</Label>
                <Select value={funcionarioSelecionado} onValueChange={handleFuncionarioChange}>
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
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="data-fim">Data Fim</Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={dataFim}
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

        {mostrarAssistente && (
          <div className="w-96 flex-shrink-0">
            <AssistenteRHChat />
          </div>
        )}
      </div>
    </div>
  );
}
