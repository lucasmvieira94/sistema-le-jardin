import { Component, ReactNode } from "react";
import { reportarErro, ResultadoDiagnostico } from "@/utils/monitorErros";
import { Button } from "@/components/ui/button";

interface Estado { erro: Error | null; diag: ResultadoDiagnostico | null }

/** Evita tela branca: mostra aviso amigável e envia o erro ao agente de suporte. */
export class ErroBoundary extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null, diag: null };
  static getDerivedStateFromError(erro: Error) { return { erro, diag: null }; }
  componentDidCatch(erro: Error, info: { componentStack?: string | null }) {
    reportarErro(erro, { tipo: "falha de tela", contexto: { componentes: info.componentStack?.slice(0, 1500) } })
      .then((diag) => this.setState({ diag }));
  }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold text-foreground">Algo deu errado nesta tela</h1>
          <p className="text-sm text-muted-foreground">O suporte já foi avisado automaticamente.</p>
          {this.state.diag?.sugestao && (
            <p className="text-sm rounded-md border border-border bg-muted p-3 text-left text-foreground">
              <b>Sugestão:</b> {this.state.diag.sugestao}
            </p>
          )}
          <Button onClick={() => window.location.reload()}>Recarregar</Button>
        </div>
      </div>
    );
  }
}
