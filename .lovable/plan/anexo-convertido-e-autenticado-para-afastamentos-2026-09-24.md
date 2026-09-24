# Anexo convertido e autenticado para afastamentos

## Objetivo
Permitir anexar PDF, imagens ou documentos editáveis ao lançar ou editar um afastamento, converter o material para PDF, preservar sua integridade digital e incluir na planilha da folha de ponto um link duradouro para consulta pela contabilidade.

## Fluxo da solução
1. O gestor seleciona um PDF, uma imagem ou um documento do Word/OpenDocument no cadastro do afastamento.
2. O sistema valida o conteúdo real do arquivo, converte imagens e documentos editáveis para PDF e elimina o arquivo temporário de origem.
3. Após o afastamento ser salvo, somente o PDF final é enviado para uma área privada e recebe hash SHA-256, código público aleatório e registro de auditoria.
4. A lista de afastamentos passa a indicar o documento anexado, com ações para consultar, substituir ou remover conforme as permissões administrativas.
5. O link abre uma página pública protegida pelo código não previsível, mostra os dados mínimos de autenticidade e permite visualizar ou baixar o PDF.
6. A exportação Excel individual e consolidada inclui o tipo de afastamento e um hyperlink clicável para o documento correspondente.

## Implementação

### Armazenamento e segurança
- Criar um bucket privado exclusivo para os PDFs finais dos afastamentos, com limite de tamanho e regras de acesso somente para administradores autenticados.
- Criar uma tabela de anexos vinculada ao afastamento, funcionário e instituição, contendo nome e formato originais, caminho privado do PDF, tamanhos, hash SHA-256 do original e do PDF final, código público duradouro, estado de conversão/revogação e dados de auditoria.
- Conceder acesso à tabela somente a administradores e ao serviço seguro; não expor caminhos internos do armazenamento.
- Criar uma função segura para consultar o código público, validar revogação e entregar o PDF sem tornar o bucket público.
- Registrar acessos ao link e alterações do anexo para rastreabilidade.

### Autenticidade
- Calcular o hash SHA-256 do arquivo recebido e, separadamente, dos bytes exatos do PDF convertido que será armazenado e disponibilizado.
- Registrar o documento no padrão existente de documentos emitidos, adicionando o tipo “documento de afastamento” e vinculando-o ao afastamento.
- Exibir no link público o status de autenticidade, nome mascarado do funcionário, tipo/período do afastamento, hash e data de emissão.
- Manter o endereço estável enquanto o documento estiver válido e permitir revogação quando o afastamento ou anexo for excluído/substituído.

### Conversão para PDF
- Aceitar PDF; imagens JPG/JPEG, PNG, WebP, GIF, BMP, TIFF, HEIC/HEIF e SVG seguro; documentos DOC, DOCX e ODT.
- Normalizar orientação, dimensões e margens das imagens, preservando todas as páginas de arquivos multipágina.
- Converter Word e OpenDocument no serviço seguro, sem expor credenciais no navegador, preservando texto, imagens, tabelas e paginação sempre que o formato permitir.
- Validar o PDF resultante antes de armazená-lo; arquivos corrompidos, protegidos por senha ou incompatíveis serão recusados com mensagem clara.
- Apagar imediatamente os arquivos temporários após sucesso ou falha, mantendo apenas o PDF final autenticado.

### Cadastro e gestão
- Adicionar ao formulário um seletor com os formatos permitidos, validação de conteúdo e tamanho, nome do arquivo, opção de remover antes do envio e indicadores separados de conversão e upload.
- Salvar afastamento e anexo de forma compensada: se o upload ou registro de autenticidade falhar, remover o arquivo incompleto e informar o gestor claramente.
- Adicionar o mesmo gerenciamento na edição e um botão de acesso ao documento na listagem.
- Completar a auditoria do cadastro, que atualmente existe apenas para edição e exclusão.

### Planilha para contabilidade
- Buscar os afastamentos do funcionário no mês exportado, incluindo períodos que atravessam o início ou o fim do mês.
- Na planilha individual, adicionar uma seção “Afastamentos” com tipo, início, fim/duração, observação e link clicável do documento.
- Na planilha consolidada, incluir a mesma seção em cada aba de funcionário e uma indicação resumida na aba geral.
- Exibir “Sem documento anexado” para afastamentos antigos ou sem arquivo, sem criar links inválidos.
- Manter as exportações PDF existentes sem alteração, pois o pedido especifica a planilha enviada à contabilidade.

## Detalhes técnicos
- O arquivo permanecerá privado; o link público usará um token aleatório persistente, consultado por uma Edge Function com validação de entrada.
- A conversão será orquestrada por uma Edge Function e executada por um conversor de documentos isolado; imagens compatíveis poderão ser normalizadas localmente antes do envio para reduzir tempo e consumo.
- A entrega do PDF será feita pelo serviço seguro, com cabeçalhos adequados para visualização/download e sem expor credenciais ou URLs administrativas.
- O vínculo será preparado para um documento atual por afastamento, mantendo histórico de substituição e revogação para auditoria.
- As datas seguirão o padrão do projeto em `America/Sao_Paulo` e o isolamento por instituição será preservado.

## Testes e validação
- Testar cada família de formato, detecção de MIME real, tamanho, conversão, hashes de origem/destino, geração/revogação do link e tratamento de falhas parciais.
- Comparar amostras convertidas de imagem, DOC, DOCX e ODT, conferindo páginas, orientação, legibilidade e ausência de cortes.
- Testar afastamentos dentro do mês e atravessando competências, com e sem documento.
- Testar hyperlinks nas exportações individual e consolidada e conferir o arquivo XLSX gerado.
- Testar permissões: administrador gerencia; link válido consulta; token inválido ou revogado não entrega o PDF.
- Validar o fluxo completo: cadastrar afastamento com PDF, abrir o link, exportar a planilha e acessar o mesmo documento pela célula clicável.
