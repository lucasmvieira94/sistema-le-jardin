# Anexo autenticado para afastamentos

## Objetivo
Permitir anexar um PDF ao lançar ou editar um afastamento, preservar sua integridade digital e incluir na planilha da folha de ponto um link duradouro para consulta pela contabilidade.

## Fluxo da solução
1. O gestor seleciona um PDF no cadastro do afastamento.
2. Após o afastamento ser salvo, o arquivo é enviado para uma área privada e recebe hash SHA-256, código público aleatório e registro de auditoria.
3. A lista de afastamentos passa a indicar o documento anexado, com ações para consultar, substituir ou remover conforme as permissões administrativas.
4. O link abre uma página pública protegida pelo código não previsível, mostra os dados mínimos de autenticidade e permite visualizar ou baixar o PDF.
5. A exportação Excel individual e consolidada inclui o tipo de afastamento e um hyperlink clicável para o documento correspondente.

## Implementação

### Armazenamento e segurança
- Criar um bucket privado exclusivo para PDFs de afastamentos, com limite de tamanho e regras de acesso somente para administradores autenticados.
- Criar uma tabela de anexos vinculada ao afastamento, funcionário e instituição, contendo caminho privado, nome, tamanho, tipo MIME, hash SHA-256, código público duradouro, estado de revogação e dados de auditoria.
- Conceder acesso à tabela somente a administradores e ao serviço seguro; não expor caminhos internos do armazenamento.
- Criar uma função segura para consultar o código público, validar revogação e entregar o PDF sem tornar o bucket público.
- Registrar acessos ao link e alterações do anexo para rastreabilidade.

### Autenticidade
- Calcular o hash SHA-256 a partir dos bytes exatos do PDF antes do armazenamento.
- Registrar o documento no padrão existente de documentos emitidos, adicionando o tipo “documento de afastamento” e vinculando-o ao afastamento.
- Exibir no link público o status de autenticidade, nome mascarado do funcionário, tipo/período do afastamento, hash e data de emissão.
- Manter o endereço estável enquanto o documento estiver válido e permitir revogação quando o afastamento ou anexo for excluído/substituído.

### Cadastro e gestão
- Adicionar ao formulário um seletor de arquivo com validação de PDF e tamanho, nome do arquivo, opção de remover antes do envio e indicador de progresso.
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
- A entrega do PDF será feita pelo serviço seguro, com cabeçalhos adequados para visualização/download e sem expor credenciais ou URLs administrativas.
- O vínculo será preparado para um documento atual por afastamento, mantendo histórico de substituição e revogação para auditoria.
- As datas seguirão o padrão do projeto em `America/Sao_Paulo` e o isolamento por instituição será preservado.

## Testes e validação
- Testar validação de formato, tamanho, hash, geração/revogação do link e tratamento de falhas parciais.
- Testar afastamentos dentro do mês e atravessando competências, com e sem documento.
- Testar hyperlinks nas exportações individual e consolidada e conferir o arquivo XLSX gerado.
- Testar permissões: administrador gerencia; link válido consulta; token inválido ou revogado não entrega o PDF.
- Validar o fluxo completo: cadastrar afastamento com PDF, abrir o link, exportar a planilha e acessar o mesmo documento pela célula clicável.
