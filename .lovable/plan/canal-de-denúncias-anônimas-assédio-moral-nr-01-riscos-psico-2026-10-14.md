# Canal de Denúncias Anônimas (Assédio Moral – NR-01 / Riscos Psicossociais)

## Objetivo
Criar um canal seguro onde qualquer colaborador possa relatar assédio moral ou outros riscos psicossociais, de forma anônima ou identificada, acompanhar o caso por protocolo e conversar com o comitê de apuração — sem alterar o funcionamento das telas existentes.

## O que o usuário verá

**1. Página pública "Canal de Denúncias"** (`senexcare.app/denuncia`, sem login)
- Também acessível por um botão discreto no Portal do Colaborador (o botão só abre a página pública; o código PIN não é enviado junto).
- Opção "Desejo reportar anonimamente" marcada por padrão; "Desejo me identificar" mostra nome e contato opcionais.
- Campos: categoria (assédio moral, assédio sexual, discriminação, sobrecarga/pressão excessiva, conflito interpessoal, outro), quando ocorreu, local/setor, pessoas envolvidas, testemunhas, relato, se ainda ocorre.
- Anexos: PDF, imagens e áudios (até 10 MB cada, até 5 arquivos). Imagens são redesenhadas no navegador para apagar metadados (EXIF/GPS); PDFs têm autor/título/datas removidos; áudios são aceitos com aviso de que a voz pode identificar.
- Ao enviar: tela com **protocolo** (ex.: `A5-B98-X2`) e **senha** exibidos uma única vez, com botão copiar e alerta para guardar.

**2. Página "Acompanhar denúncia"** (`/denuncia/acompanhar`)
- Protocolo + senha mostram situação, histórico e mensagens; o denunciante pode responder perguntas do comitê e anexar novos arquivos.
- Bloqueio após 5 tentativas erradas por protocolo.

**3. Painel do Comitê** (`/canal-denuncias`, item no menu visível só para quem tem o papel Compliance)
- Lista com protocolo, categoria, gravidade, situação e prazo; filtros por período, categoria e situação.
- Detalhe: relato, anexos, mensagens com o denunciante, anotações internas (não visíveis ao denunciante), classificação de risco (probabilidade x severidade, conforme o GRO da NR-01), medidas adotadas e conclusão.
- Situações: Recebida → Em análise → Em apuração → Aguardando informações → Concluída (procedente / improcedente / inconclusiva) → Arquivada.
- Relatório agregado (sem dados identificáveis) por categoria e mês, para alimentar o inventário de riscos psicossociais do PGR.
- Em Configurações, administradores apenas **designam** até 2 pessoas como Compliance; não conseguem ler as denúncias.

**4. Trilha de auditoria**
- Toda abertura, leitura de anexo, mudança de situação e mensagem gera registro imutável: "Fulano visualizou a denúncia A5-B98-X2 em 14/10/2026 às 01:20 (Brasília)". Visível no próprio painel do comitê.

## Privacidade e anonimato
- Envio e consulta feitos por função própria no servidor que **não grava IP, navegador, cookies nem sessão**; a página não usa o rastreador de erros do sistema nem relatórios automáticos (o monitor de erros passa a ignorar essas rotas).
- Relato, envolvidos, testemunhas, identificação, mensagens e anexos são criptografados (AES-256) com chave guardada como segredo do servidor; o banco só guarda dados cifrados.
- Protocolo aleatório e imprevisível; senha guardada apenas como hash (bcrypt).
- Nem administradores gerais, nem super administradores, nem o login do sistema enxergam as tabelas: todo acesso passa pela função do servidor, que exige o papel Compliance.
- Avisos ao comitê por e-mail dizem apenas "Nova denúncia recebida – protocolo X", sem conteúdo.

## Impacto no que já existe
- Nada é alterado em funcionários, ponto, prontuário, assinaturas ou financeiro.
- Acréscimos: um novo papel, duas páginas públicas, uma tela no menu, um botão no portal e um campo em Configurações.

## Detalhes técnicos
- Migração: `ALTER TYPE app_role ADD VALUE 'compliance'`; tabelas `denuncias` (protocolo, senha_hash, categoria, situacao, gravidade, probabilidade, severidade, prazo, campos `*_cifrado bytea`, tentativas_falhas, bloqueado_ate, tenant_id), `denuncias_mensagens` (autor 'denunciante'|'comite'|'interna', conteudo_cifrado), `denuncias_anexos` (path, nome_cifrado, mime, tamanho, sha256), `denuncias_auditoria` (append-only; gatilho bloqueia UPDATE/DELETE). RLS ligado sem políticas para anon/authenticated; GRANT apenas a service_role.
- Bucket privado `denuncias-anexos`; arquivos cifrados (AES-GCM) na função antes de gravar.
- Edge functions: `denuncia-publica` (actions: enviar, consultar, responder, anexar; sem log de headers; rate limit por protocolo) e `denuncia-comite` (valida JWT + `has_role(uid,'compliance')`, descriptografa, grava auditoria em cada leitura). Segredo `DENUNCIA_CHAVE` (32 bytes).
- Limite de 2 usuários compliance por empresa via gatilho em `user_roles`.
- Remoção de metadados: canvas re-encode (imagens), pdf-lib limpando Info/XMP (PDF).
- Utilitário puro `src/utils/canalDenuncias.ts` (formato do protocolo, validação zod, matriz de risco, transições de situação) com testes vitest.
- Registrar a decisão no AGENTS.md.

## Pontos para confirmar
- Prazo padrão de resposta ao denunciante: proposto 30 dias.
- Quem será o comitê inicial (posso deixar a designação em Configurações para você escolher).
