import DashboardHeader from "@/components/dashboard/DashboardHeader";
import RegistrosHoje from "@/components/dashboard/RegistrosHoje";
import AlertasEscalas from "@/components/dashboard/AlertasEscalas";
import AcoesRapidas from "@/components/dashboard/AcoesRapidas";

export default function Index() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <DashboardHeader />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RegistrosHoje />
        <AlertasEscalas />
      </div>
      
      <AcoesRapidas />
    </div>
  );
}
