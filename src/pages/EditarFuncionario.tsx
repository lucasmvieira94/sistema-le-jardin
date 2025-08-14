import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuditLog } from "@/hooks/useAuditLog";
import CadastroFuncionarioForm from "@/components/CadastroFuncionarioForm";

export default function EditarFuncionario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { logEvent } = useAuditLog();
  const [funcionario, setFuncionario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate("/funcionarios");
      return;
    }

    const fetchFuncionario = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar funcionário",
          description: error.message,
        });
        navigate("/funcionarios");
      } else {
        setFuncionario(data);
      }
      setLoading(false);
    };

    fetchFuncionario();
  }, [id, navigate]);

  const handleSuccess = async (dadosAtualizados: any) => {
    await logEvent('funcionarios', 'UPDATE', funcionario, dadosAtualizados);
    toast({
      title: "Funcionário atualizado com sucesso!",
    });
    navigate("/funcionarios");
  };

  if (roleLoading || loading) {
    return (
      <div className="container mx-auto max-w-4xl py-10">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" /> Carregando...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/funcionarios");
    return null;
  }

  if (!funcionario) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/funcionarios")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">Editar Funcionário</h1>
      </div>

      <CadastroFuncionarioForm
        funcionarioData={funcionario}
        onSuccess={handleSuccess}
        isEditing={true}
      />
    </div>
  );
}