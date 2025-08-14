import { useState } from "react";
import { Button } from "@/components/ui/button";
import EscalasList from "@/components/escalas/EscalasList";
import EscalaCadastroForm from "@/components/escalas/EscalaCadastroForm";

export interface EscalaData {
  id?: number;
  nome: string;
  jornada_trabalho: string;
  entrada: string;
  saida: string;
  intervalo_inicio?: string;
  intervalo_fim?: string;
  observacoes?: string;
}

export default function Escalas() {
  const [showForm, setShowForm] = useState(false);
  const [editingEscala, setEditingEscala] = useState<EscalaData | null>(null);
  // Flag para forçar atualização na lista após cadastro:
  const [refreshFlag, setRefreshFlag] = useState(0);

  // Ao cadastrar uma nova escala, fechamos o form e atualizamos a lista:
  const handleEscalaCreated = () => {
    setShowForm(false);
    setEditingEscala(null);
    setRefreshFlag(flag => flag + 1);
  };

  const handleEditEscala = (escala: EscalaData) => {
    setEditingEscala(escala);
    setShowForm(true);
  };

  // Função para cancelar edição/criação
  const handleCancel = () => {
    setShowForm(false);
    setEditingEscala(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Templates de Escalas</h1>
        <p className="text-muted-foreground">
          Crie e gerencie templates de escalas reutilizáveis que seguem as normas da CLT.
        </p>
      </div>

      <EscalasList refreshFlag={refreshFlag} onEdit={handleEditEscala} />
      
      {!showForm ? (
        <Button onClick={() => setShowForm(true)}>
          Novo Template de Escala
        </Button>
      ) : (
        <EscalaCadastroForm
          escala={editingEscala}
          onCreated={handleEscalaCreated}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
