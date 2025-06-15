import { CalendarRange, Plus } from "lucide-react";
import EscalaCadastroForm from "@/components/escalas/EscalaCadastroForm";
import EscalasList from "@/components/escalas/EscalasList";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function Escalas() {
  const [showForm, setShowForm] = useState(false);
  // Flag para forçar atualização na lista após cadastro:
  const [refreshFlag, setRefreshFlag] = useState(0);

  // Ao cadastrar uma nova escala, fechamos o form e atualizamos a lista:
  const handleEscalaCreated = () => {
    setShowForm(false);
    setRefreshFlag(flag => flag + 1);
  };

  return (
    <div className="container mx-auto max-w-2xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary flex items-center gap-2">
        <CalendarRange className="w-8 h-8" /> Gestão de Escalas
      </h2>
      <p className="mb-5 text-muted-foreground">
        Visualize, crie, edite ou exclua escalas de trabalho personalizadas dos colaboradores conforme a CLT.
      </p>
      
      {/* Lista de Escalas */}
      <EscalasList refreshFlag={refreshFlag} />

      {/* Botão Nova Escala e Form */}
      {!showForm ? (
        <Button
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg transition"
          onClick={() => setShowForm(true)}
        >
          <Plus /> Nova Escala
        </Button>
      ) : (
        <EscalaCadastroForm onCreated={handleEscalaCreated} onCancel={() => setShowForm(false)} />
      )}
    </div>
  );
}
