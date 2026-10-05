# Rodapé eletrônico SenexCare

## Objetivo
Criar um rodapé reutilizável de assinatura e autenticidade, inspirado na organização visual do SEI, com identidade própria SXCare/SenexCare e dados reais do documento.

## Implementação
- Criar um componente responsivo em duas faixas: signatário no bloco superior; QR Code e verificação no bloco inferior.
- Usar o logotipo SXCare enviado, com alternativa segura para renderização em PDF.
- Gerar no backend um código verificador único de 8 dígitos para cada documento novo.
- Manter o SHA-256 integral em caixa alta e registrar ambos no Supabase.
- Atualizar a página pública para consultar por código verificador + hash, preservando compatibilidade com documentos antigos que usam UUID.
- Fazer o hook e os geradores compartilhados consumirem código, hash, URL, signatário, cargo e horário retornados pelo backend.
- Manter a distinção jurídica: documentos sem assinatura mostram somente autenticidade; documentos assinados identificam signatário e método.

## Validação
- Testar geração/normalização dos códigos, conteúdo e escape do rodapé.
- Verificar visualmente o componente em tela e em amostra PDF A4.
- Conferir compilação, testes e consulta pública sem expor dados pessoais além do necessário.

## Detalhes técnicos
- A alteração do banco adicionará `codigo_verificador` único em `documentos_emitidos`, com preenchimento dos registros existentes.
- Novas emissões recebem um número de 8 dígitos gerado no banco; o hash continua SHA-256 de 64 caracteres.
- A URL do QR apontará para `/verificar-documento?id=<codigo>&hash=<sha256>`.
