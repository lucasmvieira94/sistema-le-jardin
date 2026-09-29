# Reabrir prontuários de hoje e adaptar encerramento/monitoramento ao ciclo de 24h

## O que aconteceu

Hoje às 12h51, o botão "Finalizar todos os prontuários" foi usado (justificativa "ATT DO SISTEMA."). Ele encerrou 555 prontuários abertos, **incluindo os 17 de hoje (29/09)**, que ainda não tinham nenhum lançamento. Esse botão, o alerta de "atraso" e a finalização por gestor ainda seguem a regra antiga ("finalizar o formulário"), que não faz mais sentido com o ciclo de 00h00 a 23h59.

## O que será feito

1. **Reabrir os 17 prontuários de hoje**: voltam para "Aberto até 23h59", limpando a data de encerramento, com registro na auditoria ("reabertura por encerramento indevido"). Dias anteriores continuam encerrados.
2. **Encerramento só pode atingir dias passados**:
   - "Finalizar todos" passa a encerrar apenas dias anteriores a hoje; o dia corrente nunca é trancado manualmente.
   - A finalização individual pela gestão também recusa o dia de hoje.
   - Uma proteção no banco impede qualquer encerramento do dia corrente, venha de onde vier.
3. **Encerramento automático à meia-noite**: agendamento às 00h05 (Brasília) fecha os ciclos do dia anterior e cria os de hoje. Os agendamentos antigos de 07h/08h, que usam a lógica de "redefinir status", são substituídos.
4. **Novo monitoramento (painel e alertas)**:
   - Sai a ideia de "atraso por tempo limite" e o progresso por campos.
   - Passa a mostrar, para o dia de hoje: residentes **sem nenhum lançamento**, **sem lançamento no turno diurno** (após 20h) ou **no noturno** (após 08h do dia seguinte, referente ao dia anterior), e o total de lançamentos e retificações.
   - O card "Prontuários em atraso" vira "Pendências do dia", sem botão de finalizar.
5. **Texto do botão "Finalizar todos"** explica que só afeta dias anteriores.

## Detalhes técnicos

- Reabertura (dados, via SQL): `UPDATE prontuario_ciclos SET status='em_andamento', data_encerramento=NULL, funcionario_encerrou=NULL WHERE data_ciclo = hoje_BR AND status='encerrado'` + insert em `audit_log` (`REABERTURA_ENCERRAMENTO_INDEVIDO`).
- Migração:
  - `finalizar_todos_prontuarios_abertos`: filtro `data_ciclo < hoje_BR`.
  - `finalizar_prontuario_atraso_gestor`: rejeita `data_ciclo >= hoje_BR`.
  - Trigger `BEFORE UPDATE` em `prontuario_ciclos`: bloqueia `status -> 'encerrado'` quando `data_ciclo >= hoje_BR`.
  - Trigger `atualizar_status_ciclo` (marca "completo" por campos) removido.
  - Nova RPC `monitorar_prontuarios_dia(p_data date)`: por residente ativo, contagem de lançamentos, retificações, diurno/noturno, último lançamento e autora.
  - `cron`: remove `redefinir-prontuarios-diarios`, `redefinir-prontuarios-diario`, `gerar-prontuario-diario`; cria `fechar-e-abrir-ciclos` `5 3 * * *` (UTC) chamando `redefinir_prontuarios_com_horario()` + `criar_ciclo_prontuario_diario()`.
- Frontend: `AlertasProntuariosAtraso.tsx` e `AlertasProntuarios.tsx` passam a usar a nova RPC; `FinalizarTodosProntuarios.tsx` com novo texto; `ControleProntuarios.tsx` com filtros "Sem lançamento / Turno pendente".
- Regras de turno em `src/utils/prontuarioLancamentos.ts` (nova `resumoPendenciasDia`), com testes unitários (dia atual nunca encerrável, pendência por turno, virada UTC-3).
