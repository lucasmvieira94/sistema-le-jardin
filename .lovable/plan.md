# Estoque de fraldas sem duplicidade

## Problema
Cada cadastro de estoque cria um novo registro, mesmo quando o residente já tem fralda do mesmo tipo, marca e tamanho. O uso desconta de apenas um registro, e registros zerados continuam aparecendo — o total fica errado.

## O que muda
1. **Somar ao existente**: ao cadastrar fraldas para um residente com mesmo tipo + marca + tamanho já em estoque, a quantidade é somada ao registro existente (aviso: "Adicionadas X unidades ao estoque existente").
2. **Remover ao acabar**: quando a quantidade chega a 0, o registro sai do estoque ativo automaticamente (fica inativo para preservar o histórico de uso).
3. **Nunca negativo**: o uso não pode ultrapassar o saldo; mensagem clara se tentar.
4. **Limpeza dos dados atuais**: unificar registros duplicados já existentes (somando saldos e movendo o histórico de uso para o registro que fica) e inativar os zerados.

## Detalhes técnicos
- Nova função segura `adicionar_estoque_fralda(...)` (SECURITY DEFINER, acessível pelo PIN) com lock, que faz "upsert" por tenant + residente + tipo + marca(normalizada) + tamanho entre registros ativos; usada em `CadastroEstoquePublico.tsx` e `useFraldas.ts`.
- Índice único parcial nessa chave para `ativo = true` (após a unificação).
- Trigger `atualizar_estoque_fralda` passa a validar saldo, usar `GREATEST(...,0)` e definir `ativo = false` quando zerar; reativação acontece ao somar novamente.
- Script de dados: merge dos duplicados, re-aponta `uso_fraldas.estoque_fralda_id`, inativa zerados.
- Testes unitários da regra de chave/normalização e verificação no navegador do fluxo cadastrar → usar → zerar.
