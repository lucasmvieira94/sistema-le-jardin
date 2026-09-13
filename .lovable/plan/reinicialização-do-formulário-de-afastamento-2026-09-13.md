# Reinicialização do formulário de afastamento

## Objetivo
Após registrar um afastamento, deixar o formulário limpo, válido e pronto para uma nova inclusão sem recarregar a página.

## Implementação
- Definir valores iniciais explícitos para todos os campos do formulário.
- Após o sucesso, restaurar esses valores, mantendo “Dias” como período padrão.
- Remover valores ocultos do modo anterior ao alternar entre dias e horas, evitando reaproveitamento indevido.
- Atualizar a lista de afastamentos e posicionar o foco no primeiro campo para facilitar o próximo cadastro.
- Adicionar teste para garantir a reinicialização correta.

## Validação
- Executar os testes relacionados ao formulário.
- Confirmar que um segundo afastamento pode ser preenchido e enviado sem atualizar a página.
