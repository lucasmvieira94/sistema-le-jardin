
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Edit, UserPlus, UserMinus, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuditLog } from "@/hooks/useAuditLog";

type Funcionario = {
  id: string;
  nome_completo: string;
  email: string;
  cpf: string;
  funcao: string;
  escala_id: number;
  ativo: boolean;
};

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [desligandoId, setDesligandoId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { logEvent } = useAuditLog();

  async function fetchFuncionarios() {
    setLoading(true);
    const { data, error } = await supabase
      .from("funcionarios")
      .select("id, nome_completo, email, cpf, funcao, escala_id, ativo")
      .order("nome_completo");
    if (!error) setFuncionarios(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchFuncionarios();
  }, []);

  async function desligarFuncionario(id: string) {
    if (!isAdmin) {
      toast({ 
        variant: "destructive", 
        title: "Acesso negado",
        description: "Apenas administradores podem desligar funcionários" 
      });
      return;
    }

    setDesligandoId(id);
    
    // Get current funcionario data for audit
    const { data: funcionarioAtual } = await supabase
      .from("funcionarios")
      .select("*")
      .eq("id", id)
      .single();
    
    const { error } = await supabase
      .from("funcionarios")
      .update({ ativo: false })
      .eq("id", id);

    if (!error) {
      await logEvent('funcionarios', 'UPDATE', funcionarioAtual, { ativo: false });
      toast({ title: "Funcionário desligado com sucesso." });
      fetchFuncionarios();
    } else {
      toast({ variant: "destructive", title: "Erro ao desligar funcionário" });
    }
    setDesligandoId(null);
  }

  if (roleLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-10">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" /> Verificando permissões...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-4xl py-10">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas administradores podem acessar o gerenciamento de funcionários.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Funcionários</h2>
        <Link to="/funcionarios/novo">
          <Button><UserPlus className="w-4 h-4 mr-2" /> Novo Funcionário</Button>
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="overflow-auto rounded shadow-sm">
          <table className="min-w-full bg-white rounded">
            <thead>
              <tr className="bg-green-50 text-muted-foreground">
                <th className="py-2 px-3 text-left">Nome</th>
                <th className="py-2 px-3 text-left hidden md:table-cell">Email</th>
                <th className="py-2 px-3 text-left hidden md:table-cell">Função</th>
                <th className="py-2 px-3 text-left hidden md:table-cell">CPF</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((func) => (
                <tr key={func.id} className="border-b last:border-b-0">
                  <td className="py-2 px-3">{func.nome_completo}</td>
                  <td className="py-2 px-3 hidden md:table-cell">{func.email}</td>
                  <td className="py-2 px-3 hidden md:table-cell">{func.funcao}</td>
                  <td className="py-2 px-3 hidden md:table-cell">{func.cpf}</td>
                  <td className="py-2 px-3 font-semibold">
                    {func.ativo ? (
                      <span className="text-green-600">Ativo</span>
                    ) : (
                      <span className="text-red-500">Desligado</span>
                    )}
                  </td>
                  <td className="py-2 px-3 flex gap-2 justify-center">
                    <Button
                      asChild
                      size="icon"
                      variant="outline"
                      className="w-8 h-8"
                      title="Editar"
                      onClick={() => navigate(`/funcionarios/${func.id}/editar`)}
                      disabled={!func.ativo}
                    >
                      <span>
                        <Edit className="w-4 h-4" />
                      </span>
                    </Button>
                    {func.ativo ? (
                      <Button
                        size="icon"
                        variant="destructive"
                        className="w-8 h-8"
                        title="Desligar"
                        onClick={() => desligarFuncionario(func.id)}
                        disabled={desligandoId === func.id}
                      >
                        {desligandoId === func.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserMinus className="w-4 h-4" />
                        )}
                      </Button>
                    ) : (
                      <span className="w-8 h-8 inline-flex items-center justify-center opacity-50">
                        <UserMinus className="w-4 h-4" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {funcionarios.length === 0 && (
                <tr>
                  <td className="py-6 px-3 text-center text-muted-foreground" colSpan={6}>
                    Nenhum funcionário cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

