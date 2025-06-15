import { CalendarRange } from "lucide-react";
import EscalaCadastroForm from "@/components/escalas/EscalaCadastroForm";

export default function Escalas() {
  return (
    <div className="container mx-auto max-w-2xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary flex items-center gap-2">
        <CalendarRange className="w-8 h-8" /> Gestão de Escalas
      </h2>
      <p className="mb-5 text-muted-foreground">
        Visualize, crie, edite ou exclua escalas de trabalho personalizadas dos colaboradores conforme a CLT.
      </p>
      {/* Formulário de cadastro */}
      <EscalaCadastroForm />
      {/* Futuramente: listagem de escalas cadastradas abaixo do formulário */}
    </div>
  );
}
