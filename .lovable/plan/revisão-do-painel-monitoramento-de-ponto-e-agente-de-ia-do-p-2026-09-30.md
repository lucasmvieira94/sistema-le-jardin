# Revisão do painel, monitoramento de ponto e agente de IA do painel

## Contexto

O painel ainda mostra quadros criados antes das mudanças recentes: ciclo de 24h do prontuário, estoque de fraldas unificado, contas a pagar e análise de condutas. Também não existe um quadro que acompanhe falhas no ponto. A lógica de detecção já existe na tela Análise de Condutas, mas não aparece no painel.

## O que será feito

### 1. Revisão do painel (organização por prioridade)
```text
[Cabeçalho + indicadores do dia]
[Pendências críticas: Ponto | Prontuários | Medicamentos]      <- ação imediata
[Operação: Registros de hoje | Fraldas | Escalas]
[Gestão: Contas a pagar | Contratos de residentes]
[Sugestões do agente de IA]  [Assistente da supervisora]
```
- Cada quadro mostra só o que exige ação e traz o botão "Ver" para a tela correspondente.
- Quadros sem pendência ficam compactos ("Tudo em dia"), para não ocupar espaço.
- Quadros de prontuário: mantêm "Prontuários de hoje" e "Pendências do dia" (já atualizados).
- Remoção de restos do modelo antigo (textos de "atraso por tempo limite" e similares).
- Botão "Personalizar painel": a gestão pode ocultar/mostrar e reordenar quadros. A preferência fica salva por usuário.

### 2. Novo quadro "Monitoramento do ponto" (últimos 7 dias, com filtro)
Detecta, por funcionário e por dia com escala:
- Entrada não registrada (tinha escala, sem registro e sem afastamento): falta não justificada.
- Saída não registrada (entrada sem saída após o fim do turno + 2h).
- Intervalo não registrado, incompleto ou insuficiente (regras atuais).
- Atraso sem justificativa enviada.
- Registro fora da escala.
- Afastamento sem anexo (atestado) quando o tipo exige comprovante.
- Folha de ponto do mês anterior não publicada ou não confirmada pelo funcionário.

Exibe contadores por tipo, lista por funcionário com a data e botão para abrir a apropriação de horas daquele funcionário.

### 3. Agente de IA "Consultor do painel"
- O sistema registra de forma anônima e leve o uso: páginas visitadas, quadros vistos/clicados e botões "Ver" usados, por tenant.
- Uma vez por semana (e sob demanda, pelo botão "Analisar agora"), a IA cruza o uso com as pendências existentes e sugere:
  - adicionar um quadro (ex.: "o ponto tem 12 falhas e ninguém abre Análise de Condutas");
  - retirar/ocultar um quadro pouco usado e sem pendências;
  - reordenar quadros.
- Cada sugestão aparece com o motivo e os botões "Aplicar" (altera a personalização do painel) ou "Dispensar". Nada muda sem confirmação.
- Histórico das sugestões e decisões fica salvo para auditoria.

## Detalhes técnicos

- Utilitário puro `src/utils/monitoramentoPonto.ts` (detecção a partir de escalas, registros, afastamentos, justificativas e folhas), reaproveitando as regras de `useAnaliseCondutas`, com testes TDD (virada UTC-3, turno noturno, afastamento cobre falta, tolerância da saída).
- Hook `useMonitoramentoPonto(dias)` + componente `dashboard/MonitoramentoPonto.tsx`.
- Tabelas (com GRANTs + RLS por tenant/admin):
  - `dashboard_preferencias` (user_id, quadros ordenados/ocultos);
  - `uso_sistema_eventos` (tenant, user, tipo, alvo, created_at), com retenção de 90 dias;
  - `dashboard_sugestoes_ia` (tipo adicionar/remover/reordenar, quadro, motivo, status pendente/aplicada/dispensada, analisado_em).
- Registro de uso: hook `useRegistrarUso` com lote em memória enviado a cada 30s (sem dados pessoais nem conteúdo).
- Edge Function `consultor-painel`: agrega 30 dias de uso + contagem de pendências, chama a IA (Lovable AI, `openai/gpt-6-astra`, saída estruturada) e grava sugestões. Cron semanal com trava de execução única, limite por tenant e pausa em erros de crédito (402/403).
- Registro dos quadros em `src/components/dashboard/registroQuadros.ts` (id, título, grupo, componente) para permitir personalização e sugestões por id.
- `Index.tsx` passa a montar o painel a partir do registro + preferências.
