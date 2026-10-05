
import React from "react";
import { useNavigate } from "react-router-dom";
import CadastroFuncionarioForm from "@/components/CadastroFuncionarioForm";

export default function NovoFuncionario() {
  const navigate = useNavigate();

  /** Ao cadastrar, abre a ficha do funcionário recém-criado. */
  const handleSuccess = (data: { id: string }) => {
    if (data?.id) {
      navigate(`/funcionarios/${data.id}/ficha`);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary">Novo Funcionário</h2>
      <div className="bg-white rounded-xl p-6 shadow-lg flex flex-col gap-3">
        <CadastroFuncionarioForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
