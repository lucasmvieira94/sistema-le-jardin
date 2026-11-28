# Roadmap

- [ ] Criar aditivos de prorrogação para contratos e distratos, com histórico preservado e nova data determinada
- [ ] Integrar PDF certificado, assinatura e prazo vigente; testar autorização e datas

- [x] Corrigir erros recentes: inicialização PWA na prévia, consulta do supervisor e rotina noturna após meia-noite
- [x] Validar correções (43 testes) e registrar oito erros resolvidos e duas falhas do Project monitoring corrigidas
- [ ] Confirmar dez erros antigos restantes — oito hooks, QueryClient e teste RLS; sessão externa autenticada indisponível e falhas não reproduzidas

- [x] Atualizar dashboard do supervisor: cuidados do dia, pendências, equipe e insights com atualização automática protegida por passe PIN
- [x] Testar permissões e indicadores; conferir celular/tablet/desktop e documentar limites de validação real (39 testes aprovados)
- [ ] Validar supervisão com passe PIN real — sessão externa indisponível; consultas e telas verificadas em ambiente isolado/simulado

- [x] Rosa: conversa privada contínua por cuidadora, consultas autorizadas e orientação de uso
- [x] Rosa: sugestões de aprendizado com revisão/revogação pelo gestor
- [x] Rosa: testes SQL de isolamento/aprovação e conversa celular/desktop simulada
- [ ] Rosa: validar conversa real e revisão do gestor — sessão externa indisponível no ambiente

- [x] Destacar contatos e código da área protegida no Portal de Cuidados; links de chamada e celular conferidos com sessão fictícia, 10 testes aprovados

- [x] Resumo de IA por dia na ficha do residente, com abertura do prontuário completo ao tocar
- [x] Testar separação por dia, acesso protegido e visualização celular/desktop com dados fictícios (14 testes aprovados)
- [ ] Validar resumo com prontuário real e passe de cuidador: sessão externa indisponível no ambiente

- [ ] Criar agenda do Portal de Cuidados com compromissos por residente, data, horário e observações
- [ ] Avisar compromissos do dia e confirmar ciência compartilhada com status Feito
- [ ] Testar autorização, confirmação única e apresentação celular/tablet

- [x] Simplificar recibo: remover campo e imagem de assinatura do sócio, mantendo somente rodapé digital e autenticidade

- [x] Revisar erros corrigidos e encerrar dois registros antigos do Painel com evidências, preservando os não confirmados
- [x] Criar histórico preventivo obrigatório antes das atualizações e consulta automática de correções no diagnóstico
- [x] Exigir descrição da resolução e preservar observação ao reabrir; testar histórico e regressões
- [ ] Validar tela administrativa autenticada do histórico: sessão externa indisponível no ambiente de testes

- [x] Corrigir bloqueio de medicamentos para colaboradores com o módulo autorizado, sem exigir Portal de Cuidados, e testar as permissões
- [x] Corrigir identificador no envio de recibos, testar geração/reenvio e registrar resolução no histórico
- [x] Investigar falhas de hooks do Painel e adicionar proteção de identidade única do React; tela pública sem erros
- [ ] Confirmar envio real de recibo e operação de medicamentos com login: sessão externa indisponível para testes autenticados
- [ ] Confirmar erro intermitente do Painel com gestor autenticado: não reproduzido na tela pública; sessão externa indisponível

- [x] Corrigir PDF final de assinaturas externas: armazenamento privado, download do gestor e anexo real por e-mail
- [x] Testar integridade, conteúdo, anexo idêntico ao PDF armazenado e conferir visualmente as páginas
- [ ] Validar download autenticado e recebimento real do PDF final: sessão externa do gestor indisponível (401)

- [x] Adicionar reenvio de recibos por e-mail sem registrar novo pagamento e testar preservação do PDF após falha

- [x] Enviar fichas de acolhimento preenchidas existentes ao e-mail do residencial (8 aceitas pelo serviço de e-mail)
- [x] Automatizar envio de futuras fichas preenchidas com PDF certificado e auditoria

- [x] Certificar todas as novas emissões de documentos e padronizar o rodapé conforme o PDF enviado
- [x] Testar certificados e inspecionar os PDFs gerados
- [ ] Validar emissão autenticada ponta a ponta: sessão externa indisponível no ambiente de testes

- [x] Criar armazenamento privado e estrutura auditável para anexos de afastamentos
- [x] Converter imagens, DOCX, ODT, TXT e RTF para PDF antes do armazenamento
- [x] Integrar anexos no cadastro, edição e lista de afastamentos
- [x] Criar consulta pública por link duradouro e revogável
- [x] Incluir afastamentos e hyperlinks nas planilhas individual e consolidada
- [x] Adicionar testes e validar a conversão no navegador
- [x] Exibir o espelho individual de ponto em uma página A4 retrato
- [x] Padronizar a apresentação de assinaturas e autenticação dos documentos com referência visual ao SEI, sem atribuir assinaturas não realizadas
- [x] Aplicar o novo modelo de assinatura a todas as novas emissões de documentos
- [x] Criar um ícone próprio do SenexCare para o bloco de assinatura eletrônica
- [x] Garantir todas as novas folhas de ponto em A4 retrato, inclusive a exportação consolidada
- [x] Disponibilizar rodapé eletrônico reutilizável com logo SXCare, QR, código verificador de 8 dígitos e SHA-256
- [x] Corrigir assinatura: evidências somente na verificação online, QR/link reais e download do documento integral
- [x] Testar geração integral e inspecionar rodapé em PDF
- [ ] Validar nova assinatura biométrica no portal: depende de captura real do colaborador; consulta de assinatura existente e geração de PDF verificadas

- [x] Enviar toda medida disciplinar, folha de ponto, contracheque e comunicado para a Central de Documentos
- [x] Retirar papel, envelopes e testemunhas digitadas do fluxo de advertências
- [x] Indicar testemunhas de advertência dentro do sistema, só após recusa ou prazo vencido
- [x] Publicar o frontend no site
- [ ] Revisar as 35 regras de acesso do banco apontadas pela varredura de segurança
- [x] Opção A — base do passe do portal + módulo Ponto
- [ ] Opção A — próximos módulos: prontuário, intercorrências, medicamentos/temperatura, fraldas, lembretes/push, contracheques/folhas (arquivos), residentes, configurações
- [ ] Validação biométrica do portal no servidor (hoje o passe sai antes do rosto)

- [x] Distrato de contrato de residente (Cancelar contrato, cálculo pela Cláusula Sexta, PDF certificado)
- [x] Agenda de cuidados finalizada (aviso, ver, editar, cancelar) e rotinas/procedimentos do residente
