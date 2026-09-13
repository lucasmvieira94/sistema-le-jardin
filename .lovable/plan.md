# Recibo oficial por e-mail

## Objetivo
Garantir que o PDF anexado ao e-mail seja exatamente o recibo oficial gerado pelo sistema, com QR Code, hash de autenticidade e assinatura eletrônica institucional.

## Implementação
- Carregar a rubrica, nome, cargo e CPF do representante configurado para a empresa.
- Incorporar esses dados ao conteúdo protegido pelo hash do recibo.
- Aplicar a rubrica e a identificação do representante no próprio PDF, com indicação da base legal da assinatura eletrônica.
- Manter um único PDF em memória: o mesmo arquivo autenticado e assinado será anexado ao e-mail; somente a ação manual poderá baixá-lo.
- Interromper a emissão com uma mensagem clara se a assinatura institucional não estiver configurada, evitando enviar recibos incompletos.

## Validação
- Adicionar testes para a exigência da assinatura institucional e para a regra de download somente manual.
- Executar os testes direcionados e a verificação de tipos.
- Validar visualmente uma amostra do PDF para conferir rubrica, identificação, QR Code, margens e ausência de sobreposição.
