# Padronização de assinaturas e folhas de ponto em retrato

## Contexto do problema
A alteração anterior atingiu apenas alguns rodapés e o espelho individual. Ainda existem documentos assinados com apresentações diferentes e a exportação consolidada das folhas continua em paisagem.

## Estrutura ou fluxo da solução
1. Criar um único modelo visual de assinatura eletrônica para novas emissões, seguindo a composição da imagem: ícone à esquerda, identificação do signatário e horário oficial de Brasília na primeira faixa; QR Code, link e códigos de verificação na segunda faixa.
2. Criar um ícone documental exclusivo do SenexCare, com símbolo de documento protegido e o nome SenexCare, sem copiar a marca ou o ícone do SEI.
3. Aplicar esse modelo aos documentos que já possuem assinatura eletrônica: contratos, advertências/suspensões, documentos da central de assinaturas e recibos oficiais.
4. Manter documentos sem assinatura apenas com “autenticidade/integridade”, sem declarar que foram assinados.
5. Alterar todas as novas folhas de ponto em PDF — individual, publicação no portal e relatório consolidado — para A4 retrato, ajustando o resumo e cada folha para caber corretamente.
6. Não modificar arquivos já emitidos ou assinados; a mudança valerá somente para documentos gerados após a atualização.

## Código ou configuração necessária
- Consolidar os blocos HTML e PDF no utilitário compartilhado de assinatura/autenticidade.
- Incorporar o ícone vetorial do SenexCare diretamente no modelo compartilhado, garantindo nitidez na impressão sem depender de imagem externa.
- Substituir marcações locais duplicadas nos emissores existentes pelo modelo compartilhado.
- Alterar a exportação consolidada da folha para retrato e ajustar larguras da tabela de resumo.
- Preservar hash, QR Code, trilha de evidências e biometria já existentes.
- Atualizar testes para conferir orientação retrato e impedir alegação de assinatura sem evidência.

## Validação
- Executar os testes dos PDFs e do rodapé compartilhado.
- Gerar amostras de folha individual e consolidada, conferir orientação A4 retrato, paginação e ausência de cortes.
- Conferir visualmente um documento assinado e um documento apenas autenticado.
- Verificar a compilação final do projeto.

## Resultado esperado
Todo documento efetivamente assinado daqui em diante terá a mesma apresentação institucional de assinatura; toda nova folha de ponto será gerada em A4 retrato. Documentos históricos permanecerão inalterados.
