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
import { Clock, ListChecks, Lock, PencilLine } from "lucide-react";

/**
 * Versão do tutorial. Ao alterar o conteúdo, incremente a versão
 * para que o aviso volte a ser exibido uma única vez para cada usuário.
 */
const TUTORIAL_VERSAO = "v1";

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
          <AlertDialogTitle>Como usar o novo prontuário eletrônico</AlertDialogTitle>
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
                    <strong className="text-foreground">Aberto o dia todo:</strong> você
                    pode registrar informações a qualquer momento do seu turno, quantas
                    vezes forem necessárias.
                  </span>
                </li>
                <li className="flex gap-3">
                  <ListChecks className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">Linha do tempo:</strong> cada envio
                    vira um registro com data, hora e o seu nome, formando o histórico do
                    residente no dia.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">Registro não se apaga:</strong>{" "}
                    depois de salvo, o registro não pode ser excluído nem alterado, para
                    garantir a segurança da informação.
                  </span>
                </li>
                <li className="flex gap-3">
                  <PencilLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">Precisa corrigir?</strong> Use a
                    opção de retificação: você escreve a informação correta e a
                    justificativa, e as duas ficam visíveis no histórico.
                  </span>
                </li>
              </ul>

              <p>
                À meia-noite o prontuário do dia é encerrado automaticamente e passa a
                ficar disponível somente para leitura.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={confirmar}>Entendi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
