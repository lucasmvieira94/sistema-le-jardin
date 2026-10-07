# Decisões técnicas

- Anexos de afastamentos são convertidos a PDF antes de ir ao armazenamento privado; a consulta pública verifica o SHA-256 e audita cada acesso, preservando integridade e rastreabilidade.
- Links de afastamento usam token opaco revogável em vez de URL direta do armazenamento, para permitir revogação e auditoria sem expor o bucket.
- A conversão de DOCX/ODT/TXT/RTF extrai o texto no navegador (mammoth/fflate) e o rediagrama em PDF com jsPDF; o conversor LibreOffice WASM foi descartado por exigir ~250 MB de download e isolamento entre sites.
- Quadros do painel ficam no catálogo `src/components/dashboard/registroQuadros.ts` com ids estáveis, porque as preferências por usuário e as sugestões do agente de IA apontam para esses ids.
- As regras de monitoramento do ponto ficam em funções puras (`src/utils/monitoramentoPonto.ts`), separadas da busca de dados, para que possam ser testadas sem acesso ao banco.
- A escala de cada dia vem de `funcionarios_escalas_historico` (períodos sem sobreposição, alterados só por RPCs auditadas); `funcionarios.escala_id` é apenas cache da escala atual, para que trocas não reescrevam dias anteriores.
- Assinaturas de documentos internos ficam em `documentos_internos_assinaturas` (imutável, uma por colaborador/documento) e são gravadas só pela RPC `assinar_documento_interno`, que compara no servidor o rosto capturado com o cadastro (ou exige motivo de recusa); o navegador só extrai o vetor facial, então a decisão não pode ser burlada no aparelho.
- O autocadastro facial pelo portal só é aceito quando não há biometria cadastrada; trocar uma biometria existente é exclusivo do gestor, para impedir que alguém com o código substitua o rosto de outra pessoa.
- Todas as folhas de ponto em PDF usam layout compartilhado A4 retrato; documentos novos usam o rodapé compartilhado SenexCare para não divergir entre PDF e impressão.
- A autenticidade documental usa código público de 8 dígitos e SHA-256 em caixa alta; UUIDs permanecem aceitos apenas para verificar emissões antigas.
- Signed document downloads use the shared footer without evidence manifests; original PDF pages are retained through pdf-lib and the source hash is checked before merging, to avoid issuing incomplete or altered copies.
- Signature verification codes are persisted in a service-only registry for envelopes and internal signatures; the public edge function requires a matching code and hash and audits access, keeping signing tokens out of printed links.
