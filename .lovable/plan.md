# Bloqueio de perguntas já respondidas no prontuário

## Objetivo
Impedir que uma pergunta já respondida no ciclo diário seja preenchida novamente como um novo registro. A correção continuará disponível somente pela retificação, com justificativa e histórico preservado.

## Implementação
1. Identificar, nos lançamentos do ciclo atual, quais perguntas já possuem resposta válida.
2. Exibir essas perguntas bloqueadas no formulário, indicando que já foram respondidas e que alterações devem ser feitas pela linha do tempo.
3. Remover respostas bloqueadas de rascunhos antigos e da carga enviada pelo formulário.
4. Reforçar a regra na função do banco: rejeitar novos lançamentos que contenham perguntas já respondidas no mesmo ciclo, inclusive em envios simultâneos; retificações permanecem permitidas.
5. Manter o registro original imutável e a justificativa obrigatória na retificação.

## Testes e validação
- Testar a identificação de perguntas preenchidas, incluindo valores válidos como `0` e `false`.
- Testar que retificações não criam uma nova resposta independente.
- Executar os testes do prontuário e validar o formulário no navegador.

## Detalhes técnicos
- A chave estável de cada pergunta continuará sendo `campo_<id>`.
- O bloqueio no banco será transacional para evitar duplicidade entre duas cuidadoras salvando ao mesmo tempo.
- Registros antigos continuarão preservados; a nova regra valerá para os próximos envios.
