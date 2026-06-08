# Sistema de Controle de Gastos

## Visão geral
Novo módulo "Controle de Gastos" integrado ao Financeiro, permitindo cadastrar contas a pagar, receber lembretes no dashboard, dar baixa em pagamentos, e visualizar lucro líquido e insights do negócio (receitas — vindas das mensalidades + extras — menos despesas).

## Estrutura

### 1. Banco de dados (migração Supabase)

**Tabela `contas_pagar`** (multi-tenant, RLS por tenant):
- `descricao` (texto)
- `categoria` (enum: `fornecedor`, `folha_pagamento`, `agua`, `luz`, `internet`, `aluguel`, `manutencao`, `alimentacao`, `medicamentos`, `impostos`, `servicos`, `outros`)
- `valor` (numeric)
- `data_vencimento` (date)
- `data_pagamento` (date, nullable)
- `status` (enum: `pendente`, `pago`, `atrasado`, `cancelado`)
- `forma_pagamento` (texto, nullable)
- `recorrente` (bool) + `frequencia_recorrencia` (mensal/semanal, nullable)
- `fornecedor` (texto)
- `observacoes` (texto)
- `anexo_url` (texto, nullable — comprovante)
- `criado_por` (uuid)

**Função `gerar_proxima_recorrencia()`**: trigger que ao dar baixa numa conta recorrente, cria automaticamente a próxima ocorrência.

**View `v_resumo_financeiro_mensal`**: agrega receitas (mensalidades + extras) e despesas (contas pagas) por mês, calculando lucro bruto e líquido.

RLS: PERMISSIVE para `authenticated` com isolamento por tenant.

### 2. Frontend — Nova aba no `/financeiro`

Adicionar 3 novas abas na página `Financeiro.tsx`:
- **Receitas** (atual, renomeado)
- **Contas a Pagar** (novo)
- **Lucratividade** (novo, com insights)

### 3. Componentes novos

`src/components/financeiro/`:
- `ContasPagarLista.tsx` — Tabela com filtros (status, categoria, mês), badges de status, ações: pagar, editar, cancelar
- `ContaPagarForm.tsx` — Dialog para cadastro/edição
- `BaixaPagamentoDialog.tsx` — Dialog para dar baixa (data, forma de pagamento, anexo)
- `LucratividadeDashboard.tsx` — Cards de KPIs + gráficos
- `InsightsNegocio.tsx` — Análises automáticas

### 4. Lembretes no dashboard

Novo componente `src/components/dashboard/AlertasContasPagar.tsx`:
- Lista contas que vencem nos próximos 7 dias
- Destaque visual para atrasadas (vermelho) e vencendo hoje (amarelo)
- Link direto para `/financeiro?tab=contas-pagar`
- Integrar no `src/pages/Index.tsx` (dashboard do gestor)

### 5. Lucro Líquido e Insights

**KPIs do mês corrente:**
- Receita Bruta (mensalidades + extras recebidos)
- Despesas Totais (contas pagas)
- Lucro Líquido (receita - despesas)
- Margem de Lucro (%)
- Contas a Vencer (próx. 30 dias)
- Inadimplência (mensalidades em aberto)

**Gráficos (recharts já instalado):**
- Linha: evolução de receita vs despesa nos últimos 6 meses
- Pizza: distribuição de despesas por categoria
- Barras: lucro líquido mensal (últimos 12 meses)

**Insights automáticos (regras locais, sem IA):**
- Maior categoria de despesa do mês
- Variação % vs mês anterior (receita, despesa, lucro)
- Alerta se margem < 10%
- Projeção de fechamento do mês baseado nos dias decorridos
- Top 3 fornecedores por gasto
- Sugestões: "Despesa de X aumentou Y% — revisar fornecedor"

## Detalhes técnicos

### Cálculo de Lucro Líquido
```text
Receita Mês = soma(mensalidades_residentes.valor_total) WHERE status='pago' E mes_referencia = mês
Despesa Mês = soma(contas_pagar.valor) WHERE status='pago' E EXTRACT(MONTH FROM data_pagamento) = mês
Lucro Líquido = Receita - Despesa
Margem (%) = (Lucro / Receita) * 100
```

### Recorrência
Trigger PG after-update em `contas_pagar`: quando `status` muda para `pago` e `recorrente=true`, inserir nova linha com `data_vencimento` somada do intervalo da `frequencia_recorrencia`.

### Rota / Navegação
Reutiliza `/financeiro` existente — adiciona `<Tabs>` no topo. Sidebar mantém um único item "Financeiro".

### Permissões
Apenas perfis `admin` e `gestor_financeiro` (via `has_role`). Demais usuários não veem a aba nem o alerta no dashboard.

## Etapas de entrega
1. Migração: tabela `contas_pagar`, enums, view, trigger de recorrência, RLS + GRANTs
2. Tipos + hook `useContasPagar.ts`
3. Componentes da aba Contas a Pagar (lista, form, baixa)
4. Componente Lucratividade + Insights
5. Integração no `Financeiro.tsx` com Tabs
6. Alerta de vencimento no Dashboard
7. QA: cadastrar conta, dar baixa, verificar recorrência, validar lucro líquido

## Confirmações antes de implementar
- Categorias de despesa: a lista proposta atende, ou quer customizar?
- Upload de comprovante de pagamento: incluir nesta versão ou deixar para depois?
- Insights: regras locais (sem custo) atendem, ou prefere IA via Gemini (como nos outros assistentes)?
