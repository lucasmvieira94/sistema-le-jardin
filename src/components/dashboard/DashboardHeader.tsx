import { Calendar, Users, AlertTriangle, Clock } from "lucide-react";

export default function DashboardHeader() {
  const hoje = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Centro de Controle</h1>
          <p className="text-muted-foreground capitalize">{hoje}</p>
        </div>
        <Calendar className="h-8 w-8 text-primary" />
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-primary/10 rounded-lg p-3 text-center">
          <Users className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-sm font-medium text-foreground">Funcionários Ativos</p>
        </div>
        <div className="bg-accent/10 rounded-lg p-3 text-center">
          <Clock className="h-5 w-5 text-accent-foreground mx-auto mb-1" />
          <p className="text-sm font-medium text-foreground">Registros Hoje</p>
        </div>
        <div className="bg-destructive/10 rounded-lg p-3 text-center">
          <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
          <p className="text-sm font-medium text-foreground">Pendências</p>
        </div>
      </div>
    </div>
  );
}