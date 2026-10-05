# Padronização de assinaturas e folhas de ponto em retrato

## Contexto do problema
A alteração anterior atingiu apenas alguns rodapés e o espelho individual. Ainda existem documentos assinados com apresentações diferentes e a exportação consolidada das folhas continua em paisagem.

## Estrutura ou fluxo da solução
1. Criar um único modelo visual de assinatura eletrônica para novas emissões, com identificação do signatário, data/hora de Brasília, método utilizado e faixa separada de validação por hash e QR Code quando houver URL verificável.
2. Aplicar esse modelo aos documentos que já possuem assinatura eletrônica: contratos, advertências/suspensões, documentos da central de assinaturas e recibos oficiais.
3. Manter documentos sem assinatura apenas com “autenticidade/integridade”, sem declarar que foram assinados.
4. Alterar todas as novas folhas de ponto em PDF — individual, publicação no portal e relatório consolidado — para A4 retrato, ajustando o resumo e cada folha para caber corretamente.
5. Não modificar arquivos já emitidos ou assinados; a mudança valerá somente para documentos gerados após a atualização.

## Código ou configuração necessária
- Consolidar os blocos HTML e PDF no utilitário compartilhado de assinatura/autenticidade.
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
