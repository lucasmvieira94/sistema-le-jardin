
## Plano de Implementação — Sistema Gamificado de Desempenho

### Etapa 1: Banco de Dados (Migração)
Criar as tabelas necessárias com RLS:
- **`gamification_profiles`**: `funcionario_id`, `xp_total`, `moedas`, `streak_plantoes`, `nivel` (bronze/prata/ouro/diamante)
- **`gamification_transactions`**: Histórico de todas as transações (ganho/gasto de XP e moedas), com `tipo` (plantao, micro_tarefa, falta, advertencia, resgate, etc.), `xp_delta`, `moedas_delta`, `descricao`
- **`gamification_rewards`**: Catálogo de prêmios configuráveis — `nome`, `descricao`, `custo_moedas`, `nivel_minimo`, `ativo`, `tipo` (folga, voucher, dinheiro, etc.)
- **`gamification_resgates`**: Registro de resgates — `funcionario_id`, `reward_id`, `status` (pendente/aprovado/rejeitado), `aprovado_por`

### Etapa 2: Lógica de Backend (Edge Function)
- **`processar-gamificacao`**: Edge function que calcula XP/moedas baseado em:
  - Plantões trabalhados (registros_ponto com escala 12x36)
  - Streak progressivo (+1 por plantão consecutivo, máx 20pts)
  - Micro-tarefas (ponto correto +2, prontuários completos +3)
  - Penalidades (faltas, advertências, suspensões)
  - Congelamento por atestado médico

### Etapa 3: Frontend — Dashboard do Funcionário
- Nova página **`/gamificacao`** no portal público (acesso pelo código do funcionário)
- Card com nível atual, barra de progresso XP, saldo de moedas
- Histórico de transações recentes
- Loja de prêmios com botão de resgate

### Etapa 4: Frontend — Painel Admin
- Nova página **`/gestao-gamificacao`** (protegida)
- Visão geral de todos os funcionários (ranking)
- Gestão do catálogo de prêmios (CRUD)
- Aprovação/rejeição de resgates pendentes
- Lançamento manual de penalidades/bonificações

### Etapa 5: Integrações Automáticas
- Ao registrar ponto → calcular XP/moedas automaticamente
- Ao registrar advertência/suspensão → aplicar penalidade
- Ao registrar afastamento médico → congelar streak

### Tecnologias
- Supabase (tabelas + RLS + edge functions)
- React + Tailwind + shadcn/ui (consistente com o projeto)
- Recharts para gráficos de progresso
