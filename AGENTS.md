# Decisões técnicas

- Anexos de afastamentos são convertidos a PDF antes de ir ao armazenamento privado; a consulta pública verifica o SHA-256 e audita cada acesso, preservando integridade e rastreabilidade.
- Links de afastamento usam token opaco revogável em vez de URL direta do armazenamento, para permitir revogação e auditoria sem expor o bucket.
- A conversão de Word/OpenDocument roda em trabalhador WASM isolado no navegador; requer COOP/COEP também no domínio de produção, pois SharedArrayBuffer não existe sem esses cabeçalhos.