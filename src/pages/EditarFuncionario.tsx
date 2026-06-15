import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Camera, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuditLog } from "@/hooks/useAuditLog";
import CadastroFuncionarioForm from "@/components/CadastroFuncionarioForm";
import CadastroBiometriaDialog from "@/components/biometria/CadastroBiometriaDialog";
import { formatarTimestampDataHora } from "@/utils/formatTimestamp";

export default function EditarFuncionario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { logEvent } = useAuditLog();
  const [funcionario, setFuncionario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [biometriaOpen, setBiometriaOpen] = useState(false);

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

  const recarregarFuncionario = async () => {
    if (!id) return;
    const { data } = await supabase.from("funcionarios").select("*").eq("id", id).single();
    if (data) setFuncionario(data);
  };

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

      {/* Card de Biometria Facial */}
      <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Biometria Facial</p>
              {(funcionario as any)?.biometria_cadastrada_em ? (
                <p className="text-sm text-muted-foreground">
                  Cadastrada em {formatarTimestampDataHora((funcionario as any).biometria_cadastrada_em)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma biometria cadastrada ainda.</p>
              )}
            </div>
          </div>
          <Button onClick={() => setBiometriaOpen(true)} variant="outline">
            <Camera className="mr-2 h-4 w-4" />
            {(funcionario as any)?.biometria_facial ? "Atualizar Biometria" : "Cadastrar Biometria"}
          </Button>
        </div>
      </div>

      <CadastroFuncionarioForm
        funcionarioData={funcionario}
        onSuccess={handleSuccess}
        isEditing={true}
      />

      {funcionario && (
        <CadastroBiometriaDialog
          open={biometriaOpen}
          onOpenChange={setBiometriaOpen}
          funcionarioId={(funcionario as any).id}
          funcionarioNome={(funcionario as any).nome_completo}
          onCadastrado={recarregarFuncionario}
        />
      )}
    </div>
  );
}