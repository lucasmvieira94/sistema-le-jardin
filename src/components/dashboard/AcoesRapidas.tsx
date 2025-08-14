import { Link } from "react-router-dom";
import { Clock, UserPlus, FileText, Settings, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AcoesRapidas() {
  const acoes = [
    {
      titulo: "Registro de Ponto",
      descricao: "Marcar ponto ou consultar registros",
      icon: <Clock className="h-5 w-5" />,
      link: "/",
      cor: "bg-primary/10 hover:bg-primary/20"
    },
    {
      titulo: "Novo Funcionário",
      descricao: "Cadastrar novo colaborador",
      icon: <UserPlus className="h-5 w-5" />,
      link: "/funcionarios/novo",
      cor: "bg-accent/10 hover:bg-accent/20"
    },
    {
      titulo: "Gerenciar Funcionários",
      descricao: "Ver lista e editar funcionários",
      icon: <Users className="h-5 w-5" />,
      link: "/funcionarios",
      cor: "bg-secondary/10 hover:bg-secondary/20"
    },
    {
      titulo: "Escalas",
      descricao: "Configurar horários de trabalho",
      icon: <Calendar className="h-5 w-5" />,
      link: "/escalas",
      cor: "bg-muted/10 hover:bg-muted/20"
    },
    {
      titulo: "Relatórios",
      descricao: "Gerar relatórios de ponto",
      icon: <FileText className="h-5 w-5" />,
      link: "/relatorios",
      cor: "bg-primary/10 hover:bg-primary/20"
    },
    {
      titulo: "Configurações",
      descricao: "Ajustar configurações do sistema",
      icon: <Settings className="h-5 w-5" />,
      link: "/configuracoes",
      cor: "bg-muted/10 hover:bg-muted/20"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {acoes.map((acao, index) => (
            <Link key={index} to={acao.link}>
              <Button 
                variant="ghost" 
                className={`h-auto p-4 flex flex-col items-center gap-2 text-center w-full ${acao.cor}`}
              >
                <div className="text-primary">
                  {acao.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{acao.titulo}</p>
                  <p className="text-xs text-muted-foreground">{acao.descricao}</p>
                </div>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}