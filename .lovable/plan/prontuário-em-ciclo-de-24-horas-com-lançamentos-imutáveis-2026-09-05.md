# Prontuário em ciclo de 24 horas com lançamentos imutáveis

## O que muda na prática

Hoje o prontuário do dia é um formulário único que qualquer cuidadora pode reescrever, e quem clica em "Finalizar" tranca o dia inteiro — inclusive para o turno da noite. Isso quebra a auditoria: não dá para saber quem escreveu o quê, e o turno noturno pode ficar sem espaço para registrar.

Nova forma de trabalho:

- O prontuário de cada residente fica aberto das 00h00 às 23h59 do dia.
- As cuidadoras dos dois turnos (08h-20h e 20h-08h) adicionam quantos lançamentos quiserem ao longo do dia.
- Cada lançamento enviado fica gravado com data, hora e nome da autora, e não pode mais ser apagado nem alterado.
- Se algo saiu errado, a cuidadora adiciona uma **retificação** ligada ao lançamento original. O texto original continua visível, com a correção logo abaixo.
- Ninguém tranca o dia manualmente. À meia-noite o dia anterior é fechado automaticamente e passa a ser somente leitura.

## Como fica a tela da cuidadora

1. Escolhe o residente (a lista passa a mostrar "Aberto até 23h59" e quantos lançamentos já existem no dia, em vez de "Não iniciado / Finalizado").
2. Vê a linha do tempo do dia: cada lançamento com hora, autora e conteúdo; retificações aparecem recuadas sob o registro corrigido.
3. Preenche o formulário de campos configurados e envia. Após enviar, aquele lançamento aparece na linha do tempo já bloqueado, e o formulário volta em branco para o próximo.
4. Em cada lançamento próprio do dia há a ação "Retificar", que abre um campo de correção com justificativa obrigatória.
5. Dias anteriores aparecem apenas para leitura, com aviso de prontuário encerrado.

O botão "Finalizar prontuário" e o código de 4 dígitos de finalização deixam de existir no fluxo da cuidadora. A gestão continua vendo tudo em Controle de Prontuários e Supervisor de Prontuários, agora em formato de linha do tempo por dia.

## Detalhes técnicos

Banco (migração):
- `prontuario_registros`: novas colunas `imutavel boolean default true`, `retifica_registro_id uuid` (auto-referência), `justificativa_retificacao text`, `funcionario_nome text` (carimbo do autor no momento do envio).
- Trigger `impedir_alteracao_registro_prontuario`: bloqueia `UPDATE`/`DELETE` em registros com `imutavel = true`, exceto pela rotina de sistema; grava tentativa em `audit_log`.
- Trigger de escrita: rejeita `INSERT` em ciclo com `status = 'encerrado'` ou `data_ciclo <> data atual (America/Sao_Paulo)`.
- Nova função `registrar_lancamento_prontuario(p_residente_id, p_funcionario_id, p_conteudo jsonb, p_retifica_id, p_justificativa)` — `SECURITY DEFINER`, cria o ciclo do dia se faltar (`status = 'em_andamento'`), insere o lançamento e devolve o id. Mantém compatibilidade com o acesso anônimo via PIN.
- `redefinir_prontuarios_com_horario()`: reescrita para fechar (`encerrado`) todos os ciclos com `data_ciclo < hoje`, marcando `data_encerramento` e o motivo `fechamento_automatico`; permanece acionada pelo cron de `cronometro-prontuarios`.
- `finalizar_prontuario_diario` e `salvar_prontuario_simples` deixam de ser usadas pelo app; ficam apenas para o fechamento em massa da gestão (`finalizar_todos_prontuarios_abertos`).
- Migração de dados: os registros existentes de `tipo_registro = 'prontuario_completo'` continuam válidos e são exibidos como o primeiro lançamento do respectivo dia.

Frontend:
- `NovoFormularioProntuario.tsx`: remove o auto-save que sobrescreve o registro único e a finalização por código; passa a enviar lançamentos via a nova função. Rascunho local (`localStorage`) para não perder digitação antes do envio.
- Novo `LinhaTempoProntuario.tsx`: lista de lançamentos do ciclo com hora, autora, badge de turno (diurno/noturno) e retificações aninhadas; ação "Retificar" com justificativa.
- `Prontuario.tsx` / `ResidentesList.tsx`: status por residente passa a ser "Aberto (N lançamentos)" ou "Encerrado"; some a barra de progresso por campos obrigatórios e o bloqueio do botão por finalização.
- `ControleProntuarios.tsx`, `SupervisorProntuarios.tsx`, `MeusProntuarios.tsx`, `ProntuarioDetalhado.tsx`, `CicloDetalhado.tsx`: leitura em linha do tempo; impressão/PDF do dia lista os lançamentos em ordem cronológica com autoria.
- `AssistenteProntuarioIA.tsx` e `analisar-prontuarios`: passam a consolidar todos os lançamentos do período, não só o último registro.

Testes:
- Testes unitários da consolidação de lançamentos e da regra de janela do ciclo (dia atual aberto, dias anteriores bloqueados, virada de meia-noite em UTC-3).
