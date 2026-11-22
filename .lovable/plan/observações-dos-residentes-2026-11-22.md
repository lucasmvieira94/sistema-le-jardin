# Observações dos residentes

## O que muda para quem usa

**Portal de Cuidados (cuidadoras)**
- A ficha do residente ganha a aba **Observações**, com as observações válidas, as mais recentes primeiro. Cada uma mostra o texto, quem escreveu, quando e até quando vale ("Sem prazo" ou "Vale até DD/MM/AAAA").
- O botão **Nova observação** pede o texto (até 1000 letras) e a validade: **Sem prazo** (padrão) ou **Até uma data**.
- Quando a data passa, a observação some sozinha da ficha. Ela não é apagada e continua no histórico do gestor.
- **Lixeira com justificativa:** igual ao estoque de remédios. A observação sai da ficha na hora e fica esperando o gestor. Se ele recusar, ela volta. Se aprovar, sai de vez.
- No resumo da ficha, um aviso mostra quantas observações ativas o residente tem, para que cuidadoras novas ou de outro plantão vejam logo.
- A Rosa passa a conhecer esse recurso. Ela também pode ler as observações ativas quando a cuidadora perguntar sobre um residente.

**Painel do gestor**
- Na tela do residente, o gestor também pode criar observações. Quando o gestor exclui, a observação sai direto, sem precisar de aprovação, mas o motivo continua obrigatório e fica registrado.
- A tela **Remoções de Medicamentos** vira **Aprovações de Remoção**, com duas abas: Medicamentos e Observações. Na aba Observações, o gestor aprova ou recusa da mesma forma que faz com os remédios.

## Regras
- Ninguém edita uma observação depois de criada. Para corrigir, crie uma nova e peça a exclusão da antiga. Assim tudo fica registrado.
- Sem prazo é o padrão. A data de validade não pode ser anterior a hoje (horário de Brasília).
- Só pode haver um pedido de exclusão aguardando por observação.
- Só cuidadoras com o Portal de Cuidados liberado veem e escrevem observações.

## Detalhes técnicos
- Tabela `residentes_observacoes`: residente, texto, `valida_ate` (pode ficar vazio = sem prazo), autor (funcionário ou gestor), status (`ativa` / `remocao_pendente` / `removida`), motivo da remoção, quem pediu, quem revisou, data da revisão e observação do gestor. Só o servidor grava; o gestor pode ler pelas regras de acesso (RLS) do tenant.
- Funções do portal (validam o passe do PIN e o módulo `portal_cuidados`): `portal_observacoes_residente`, `portal_criar_observacao` e `portal_solicitar_remocao_observacao`.
- Funções do gestor (verificação de gestor que bloqueia em caso de dúvida): `gestor_criar_observacao`, `gestor_remover_observacao`, `gestor_observacoes_pendentes` e `gestor_revisar_remocao_observacao`.
- As observações vencidas são filtradas no momento da consulta. Não há rotina agendada nem nada é apagado.
- Arquivos: componente novo `ObservacoesResidente.tsx` (portal e gestor), aba nova em `FichaCuidadoResidente.tsx`, seção em `Residentes.tsx`, abas em `RemocoesMedicamentos.tsx`, ferramenta `observacoes` na Rosa e atualização de `conhecimento.ts`.
- Testes SQL em PGlite com a migration real: justificativa obrigatória, remoção temporária, recusa devolvendo a observação, aprovação, observação vencida escondida, bloqueio sem passe e só gestor decide. Também vou registrar no histórico de correções.
