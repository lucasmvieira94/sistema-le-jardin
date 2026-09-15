# Tratamento automático da imagem de assinatura

## Objetivo
Ao enviar uma foto ou imagem da assinatura, preparar automaticamente uma versão limpa e adequada aos documentos oficiais.

## Implementação
- Remover o fundo branco ou claro e convertê-lo em transparência, preservando os traços da assinatura.
- Detectar os limites reais dos traços, eliminar margens vazias e aplicar uma pequena margem de segurança.
- Redimensionar proporcionalmente para um formato padronizado, sem distorção, com espessura e contraste preservados.
- Mostrar a pré-visualização do resultado tratado antes de salvar, com opção de descartar e enviar outra imagem.
- Aplicar o mesmo tratamento à assinatura desenhada no sistema.
- Manter validações de formato e tamanho e apresentar erro quando nenhuma assinatura legível for encontrada.

## Qualidade e validação
- Isolar o processamento em uma função reutilizável e testável.
- Adicionar testes para remoção de fundo, recorte, margem, redimensionamento e imagem vazia.
- Validar o upload e a pré-visualização em tela, inclusive em celular.

## Detalhes técnicos
O processamento será feito localmente no navegador por canvas, sem enviar a imagem a serviços externos. A saída será PNG transparente, limitada a 900 × 300 px e centralizada com margem interna proporcional, mantendo compatibilidade com os documentos existentes.
