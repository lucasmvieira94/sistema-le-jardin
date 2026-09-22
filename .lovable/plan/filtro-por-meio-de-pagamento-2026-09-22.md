# Filtro por meio de pagamento

## Objetivo
Permitir filtrar as cobranças da área **Financeiro > Receitas** pelo meio usado no recebimento.

## Implementação
- Adicionar um seletor ao lado do filtro de status, com as opções **Todos os meios**, **PIX**, **Dinheiro**, **Transferência** e **Cartão**.
- Combinar o novo filtro com o filtro de status existente, exibindo somente os registros que atendam aos dois critérios.
- Manter cobranças ainda não pagas visíveis apenas quando **Todos os meios** estiver selecionado.
- Incluir **Transferência** e **Cartão** entre as opções disponíveis ao registrar um recebimento, para que esses meios possam ser gravados e filtrados.
- Ajustar a mensagem vazia para indicar quando nenhum pagamento corresponde aos filtros escolhidos.

## Validação
- Testar isoladamente cada meio de pagamento e sua combinação com os status.
- Confirmar que a seleção padrão continua exibindo todas as cobranças da competência.
- Executar os testes e a verificação de tipos do projeto.
