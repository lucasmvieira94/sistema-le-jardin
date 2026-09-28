# Decisões técnicas

- Anexos de afastamentos são convertidos a PDF antes de ir ao armazenamento privado; a consulta pública verifica o SHA-256 e audita cada acesso, preservando integridade e rastreabilidade.
- Links de afastamento usam token opaco revogável em vez de URL direta do armazenamento, para permitir revogação e auditoria sem expor o bucket.
- A conversão de DOCX/ODT/TXT/RTF extrai o texto no navegador (mammoth/fflate) e o rediagrama em PDF com jsPDF; o conversor LibreOffice WASM foi descartado por exigir ~250 MB de download e isolamento entre sites.
