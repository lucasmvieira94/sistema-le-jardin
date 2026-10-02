# Escalas com vigência por período e histórico de escalas do funcionário

## Contexto

Hoje cada funcionário guarda só uma escala e uma data de início de vigência. Quando a escala muda, os dois campos são sobrescritos. Com isso, a folha de ponto, a apropriação de horas, a análise de condutas, o monitoramento do ponto, o vale-transporte e o bloqueio de ponto fora da escala passam a recalcular os dias anteriores com a regra nova. Também não existe registro das escalas pelas quais o funcionário já passou.

## Como vai funcionar

```text
Funcionário: Maria
 12x36 Diurno   01/01/2026 - 14/09/2026   (encerrada)
 5x2 Comercial  15/09/2026 - em vigor     (atual)

Dia 10/09 -> lido pela 12x36 (folga/trabalho/falta pela regra antiga)
Dia 20/09 -> lido pela 5x2
```

1. **Histórico de escalas**: cada troca cria um período com escala, data de início, data de fim, motivo, quem alterou e quando. O período anterior é encerrado no dia anterior ao início do novo.
2. **Trocar escala**: na ficha e na edição do funcionário, o botão "Alterar escala" pede a nova escala, a data de início (pode ser hoje, futura ou retroativa) e o motivo. O formulário de edição deixa de sobrescrever a escala direto.
3. **Leitura por data**: todas as contas de faltas, folgas, dias de trabalho, horários previstos, intervalos e vale-transporte usam a escala vigente **naquele dia**. O ciclo (ex.: 12x36) conta a partir do início daquele período.
4. **Dias sem escala**: dias anteriores ao primeiro período não geram falta nem folga e aparecem como "sem escala registrada".
5. **Correções**: o administrador pode lançar períodos antigos (para reconstruir o passado) e corrigir ou excluir um período, sempre com justificativa e auditoria. O sistema não permite períodos sobrepostos.
6. **Dados atuais**: cada funcionário com escala recebe um período inicial com a escala e a data de vigência atuais. Antes dessa data não há histórico, até alguém lançar os períodos antigos.
7. **Ficha do funcionário**: nova seção "Histórico de escalas", com a linha do tempo dos períodos. A escala atual continua aparecendo no topo.

## Detalhes técnicos

- Nova tabela `funcionarios_escalas_historico` (funcionario_id, escala_id, tenant_id, data_inicio, data_fim null = vigente, motivo, criado_por, timestamps), com GRANTs e RLS por empresa (admin edita, autenticado da empresa lê) e restrição de exclusão (`btree_gist`) contra sobreposição de períodos.
- RPC `alterar_escala_funcionario(p_funcionario_id, p_escala_id, p_data_inicio, p_motivo)` (SECURITY DEFINER, verifica se é admin): encerra o período vigente em `data_inicio - 1`, insere o novo e sincroniza `funcionarios.escala_id/data_inicio_vigencia` com o período vigente hoje (campos mantidos como cache para telas legadas). Registra em `audit_log`.
- RPCs `corrigir_periodo_escala` / `excluir_periodo_escala` com justificativa obrigatória e auditoria.
- Função SQL `escala_vigente_em(p_funcionario_id, p_data)` retorna a escala e o início do período naquele dia.
- Reescrita de `preencher_horarios_por_escala` e `gerar_folha_ponto_mensal` para resolver a escala dia a dia por `escala_vigente_em` (o ciclo conta a partir do `data_inicio` do período). `adicionar_intervalo_automatico` / `inserir_intervalo_automatico` usam a escala da data do registro.
- Migração de dados: um período inicial por funcionário com `escala_id` (início = `data_inicio_vigencia` ou `data_admissao`).
- Frontend:
  - util puro `src/utils/escalaVigente.ts` (`escalaNaData(historico, data)`, `validarNovoPeriodo`) com testes TDD: troca no meio do mês, 12x36 recontando o ciclo, dia antes do primeiro período, troca retroativa e futura, sobreposição rejeitada.
  - `monitoramentoPonto.ts`, `useAnaliseCondutas.ts` e `valeTransporteCalculator.ts` passam a receber o histórico e resolver a escala por dia (testes atualizados).
  - Novos `AlterarEscalaDialog.tsx` e `HistoricoEscalas.tsx` (ficha e edição do funcionário). `CadastroFuncionarioForm` usa a RPC na edição e cria o período inicial no cadastro.
  - Edge Functions que leem a escala (assistente de RH, supervisora, lembretes, exportação) passam a usar o período vigente.
- Registro da decisão no `AGENTS.md`: a escala do funcionário é resolvida por data a partir do histórico. `funcionarios.escala_id` é só um cache da escala atual.
