import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EscalasList from "@/components/escalas/EscalasList";
import EscalaCadastroForm from "@/components/escalas/EscalaCadastroForm";
import GeradorEscala from "@/components/escalas/GeradorEscala";

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
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Escalas</h1>
        <p className="text-muted-foreground">
          Gerencie as escalas de trabalho personalizadas e crie novas escalas seguindo as normas da CLT.
        </p>
      </div>

      <Tabs defaultValue="gerador" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gerador">Gerador de Escala</TabsTrigger>
          <TabsTrigger value="gestao">Gestão de Escalas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="gerador" className="space-y-6">
          <GeradorEscala />
        </TabsContent>
        
        <TabsContent value="gestao" className="space-y-6">
          <EscalasList refreshFlag={refreshFlag} onEdit={handleEditEscala} />
          
          {!showForm ? (
            <Button onClick={() => setShowForm(true)}>
              Nova Escala
            </Button>
          ) : (
            <EscalaCadastroForm
              escala={editingEscala}
              onCreated={handleEscalaCreated}
              onCancel={handleCancel}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
