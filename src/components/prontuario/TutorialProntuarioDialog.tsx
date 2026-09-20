import React, { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, ListChecks, Lock, PencilLine, ShieldCheck } from "lucide-react";

/**
 * Versão do tutorial. Ao alterar o conteúdo, incremente a versão
 * para que o aviso volte a ser exibido uma única vez para cada usuário.
 */
const TUTORIAL_VERSAO = "v2";

const storageKey = (funcionarioId: string) =>
  `tutorial-prontuario-${TUTORIAL_VERSAO}-${funcionarioId}`;

interface TutorialProntuarioDialogProps {
  /** Identificador do funcionário logado (chave de exibição única). */
  funcionarioId: string;
}

/**
 * Exibe, uma única vez por funcionário, o tutorial do novo prontuário
 * eletrônico em ciclo de 24 horas com lançamentos imutáveis.
 */
export default function TutorialProntuarioDialog({
  funcionarioId,
}: TutorialProntuarioDialogProps) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!funcionarioId) return;
    try {
      if (!localStorage.getItem(storageKey(funcionarioId))) {
        setAberto(true);
      }
    } catch {
      // localStorage indisponível: não bloqueia o uso da tela
    }
  }, [funcionarioId]);

  const confirmar = () => {
    try {
      localStorage.setItem(storageKey(funcionarioId), new Date().toISOString());
    } catch {
      // ignora falha de persistência
    }
    setAberto(false);
  };

  return (
    <AlertDialog open={aberto}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Orientações para preencher o prontuário</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left text-sm text-muted-foreground">
              <p>
                O prontuário agora acompanha o ciclo de 24 horas do residente, das
                00h00 às 23h59. Leia as orientações abaixo antes de começar.
              </p>

              <ul className="space-y-3">
                <li className="flex gap-3">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">Ciclo diário:</strong> o prontuário
                    fica aberto das 00h00 às 23h59 e é encerrado automaticamente à meia-noite.
                  </span>
                </li>
                <li className="flex gap-3">
                  <ListChecks className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">Histórico identificado:</strong> cada
                    envio fica registrado com data, hora e o seu nome na linha do tempo do
                    residente.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">Registro definitivo:</strong> depois
                    de salvo, o lançamento não pode ser editado nem excluído.
                  </span>
                </li>
                <li className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">Uma resposta por pergunta:</strong>{" "}
                    após responder uma pergunta, ela fica bloqueada durante o ciclo. Não é
                    possível preencher por cima nem criar outra resposta para a mesma informação.
                  </span>
                </li>
                <li className="flex gap-3">
                  <PencilLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">Precisa corrigir?</strong> Use
                    exclusivamente a opção <strong className="text-foreground">Retificar</strong>{" "}
                    na linha do tempo. A justificativa é obrigatória, e o registro original
                    permanece preservado junto da correção.
                  </span>
                </li>
              </ul>

              <p className="font-medium text-foreground">
                Revise cuidadosamente as respostas antes de salvar. Após o envio, qualquer
                correção deverá ser registrada como retificação.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={confirmar}>Li e entendi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
