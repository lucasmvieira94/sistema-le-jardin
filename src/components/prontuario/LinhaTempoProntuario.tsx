import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, Lock, Moon, PencilLine, Sun, UserRound } from "lucide-react";
import {
  horaFormatada,
  turnoDoHorario,
  type LancamentoComRetificacoes,
} from "@/utils/prontuarioLancamentos";

interface LinhaTempoProntuarioProps {
  lancamentos: LancamentoComRetificacoes[];
  /** Rótulos dos campos configurados, por chave `campo_<id>`. */
  rotulos?: Record<string, string>;
  /** Quando falso, a ação de retificar não é exibida (dias encerrados / leitura). */
  permitirRetificacao?: boolean;
  onRetificar?: (registroId: string, texto: string, justificativa: string) => Promise<void>;
}

function formatarValor(valor: unknown): string {
  if (Array.isArray(valor)) return valor.map((v) => formatarValor(v)).join(", ");
  if (valor && typeof valor === "object") {
    return Object.entries(valor as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${formatarValor(v)}`)
      .join(" | ");
  }
  return String(valor ?? "");
}

function ConteudoLancamento({
  conteudo,
  rotulos,
}: {
  conteudo: Record<string, unknown>;
  rotulos?: Record<string, string>;
}) {
  const entradas = Object.entries(conteudo).filter(
    ([, valor]) => valor !== undefined && valor !== null && formatarValor(valor).trim() !== "",
  );

  if (entradas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem conteúdo registrado.</p>;
  }

  return (
    <dl className="space-y-1.5">
      {entradas.map(([chave, valor]) => (
        <div key={chave} className="text-sm">
          <dt className="font-medium text-foreground">{rotulos?.[chave] || chave}</dt>
          <dd className="text-muted-foreground break-words whitespace-pre-wrap">
            {formatarValor(valor)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function LinhaTempoProntuario({
  lancamentos,
  rotulos,
  permitirRetificacao = false,
  onRetificar,
}: LinhaTempoProntuarioProps) {
  const [alvo, setAlvo] = useState<LancamentoComRetificacoes | null>(null);
  const [texto, setTexto] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);

  const abrirRetificacao = (item: LancamentoComRetificacoes) => {
    setAlvo(item);
    setTexto("");
    setJustificativa("");
  };

  const confirmar = async () => {
    if (!alvo || !onRetificar) return;
    setEnviando(true);
    try {
      await onRetificar(alvo.id, texto, justificativa);
      setAlvo(null);
    } finally {
      setEnviando(false);
    }
  };

  if (lancamentos.length === 0) {
    return (
      <Card className="mx-2 sm:mx-0">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma informação registrada neste dia até o momento.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mx-2 sm:mx-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            Registros do dia ({lancamentos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lancamentos.map((item) => {
            const turno = turnoDoHorario(item.created_at);
            return (
              <div key={item.id} className="border-l-2 border-primary/40 pl-3 sm:pl-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {horaFormatada(item.created_at)}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    {turno === "diurno" ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                    {turno === "diurno" ? "Turno diurno" : "Turno noturno"}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="w-3 h-3" />
                    {item.funcionario_nome || "Autoria não identificada"}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="w-3 h-3" />
                    Registro bloqueado
                  </span>
                </div>

                <ConteudoLancamento conteudo={item.conteudo} rotulos={rotulos} />

                {item.retificacoes.map((ret) => (
                  <div
                    key={ret.id}
                    className="ml-3 sm:ml-6 border-l-2 border-amber-400 pl-3 py-2 bg-amber-50/60 rounded-r-md space-y-1"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge className="bg-amber-500 text-white flex items-center gap-1">
                        <PencilLine className="w-3 h-3" />
                        Retificação
                      </Badge>
                      <span className="text-muted-foreground">
                        {horaFormatada(ret.created_at)} · {ret.funcionario_nome || "—"}
                      </span>
                    </div>
                    {ret.justificativa_retificacao && (
                      <p className="text-xs text-muted-foreground">
                        <strong>Motivo:</strong> {ret.justificativa_retificacao}
                      </p>
                    )}
                    <ConteudoLancamento conteudo={ret.conteudo} rotulos={rotulos} />
                  </div>
                ))}

                {permitirRetificacao && onRetificar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => abrirRetificacao(item)}
                  >
                    <PencilLine className="w-3 h-3 mr-1" />
                    Retificar
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!alvo} onOpenChange={(aberto) => !aberto && setAlvo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Retificar registro</DialogTitle>
            <DialogDescription>
              O registro original permanece no prontuário. A correção é adicionada logo abaixo dele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="retificacao-texto">Informação correta</Label>
              <Textarea
                id="retificacao-texto"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                placeholder="Descreva a informação correta"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="retificacao-motivo">Motivo da correção</Label>
              <Textarea
                id="retificacao-motivo"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={2}
                placeholder="Ex.: valor da pressão digitado errado"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlvo(null)} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={enviando || !texto.trim() || !justificativa.trim()}
            >
              {enviando ? "Enviando..." : "Registrar retificação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
