# Download da Ficha de Acolhimento

## Objetivo
Disponibilizar, na ficha administrativa do residente, um botão para baixar em PDF a ficha de acolhimento já preenchida.

## Implementação
- Criar um gerador de PDF com identificação do residente, responsável pelo preenchimento, datas, aceite LGPD, histórico de saúde, hábitos e observações da equipe.
- Organizar o conteúdo em páginas A4, evitando cortes de perguntas e respostas extensas.
- Exibir o botão **Baixar PDF** somente nas fichas preenchidas ou aprovadas.
- Mostrar indicador durante a geração e mensagem clara de sucesso ou erro.
- Sanitizar o nome do arquivo para download seguro.

## Qualidade
- Adicionar testes para as regras de disponibilidade do download e nome do arquivo.
- Executar os testes direcionados e a verificação de tipos do projeto.

## Resultado esperado
A gestão poderá baixar cada ficha concluída diretamente no cadastro do residente, em um documento legível e pronto para arquivamento.
