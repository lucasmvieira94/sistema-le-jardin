import DashboardHeader from "@/components/dashboard/DashboardHeader";
import RegistrosHoje from "@/components/dashboard/RegistrosHoje";
import AlertasEscalas from "@/components/dashboard/AlertasEscalas";
import AlertasProntuarios from "@/components/dashboard/AlertasProntuarios";
import AlertasProntuariosAtraso from "@/components/dashboard/AlertasProntuariosAtraso";
import AlertasMedicamentos from "@/components/dashboard/AlertasMedicamentos";
import { AlertasFraldas } from "@/components/dashboard/AlertasFraldas";
import AcoesRapidas from "@/components/dashboard/AcoesRapidas";
import AssistenteSupervisoraIA from "@/components/dashboard/AssistenteSupervisoraIA";

export default function Index() {
  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <DashboardHeader />
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <RegistrosHoje />
        <AlertasProntuarios />
        <AlertasMedicamentos />
        <AlertasFraldas />
      </div>
      
      {/* Alertas de Prontuários em Atraso */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <AlertasProntuariosAtraso />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <AlertasEscalas />
      </div>
      
      <AcoesRapidas />
      <AssistenteSupervisoraIA />
    </div>
  );
}
