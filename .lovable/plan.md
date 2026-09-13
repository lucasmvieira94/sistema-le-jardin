# Auditoria de envio de recibos

## Objetivo
Registrar cada tentativa de envio de recibo para permitir rastrear quando, para quem e qual arquivo foi enviado.

## Implementação
- Criar um histórico protegido com recibo, documento autenticado, destinatário, hash SHA-256 do PDF, data, resultado e identificação do envio.
- Calcular o hash no próprio arquivo PDF recebido pelo serviço de e-mail.
- Registrar tanto envios concluídos quanto falhas do provedor, sem armazenar o conteúdo do PDF.
- Associar o histórico ao usuário autenticado e guardar informações técnicas mínimas para auditoria.

## Segurança e validação
- Permitir consulta do histórico apenas para administradores; gravações serão feitas somente pelo serviço seguro de envio.
- Validar a sessão sem aceitar credenciais administrativas vindas do navegador.
- Executar testes e validação de tipos, implantar o envio atualizado e conferir um registro de teste quando houver sessão disponível.
