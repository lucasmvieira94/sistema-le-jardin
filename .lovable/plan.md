## Objetivo

Refatorar a geração, armazenamento e validação de documentos (contratos de residentes, contratos temporários e advertências/suspensões — que já usam jsPDF/html2canvas) para garantir autenticidade (hash + QR Code), conformidade arquivística (PDF/A-like), trilha de auditoria e controle de acesso LGPD.

## Escopo dos documentos cobertos

1. Contratos de residentes (`ContratoPDFGenerator.tsx`)
2. Contratos temporários (`ContratosTemporarios.tsx`)
3. Advertências/Suspensões (`ImpressaoAdvertencia.tsx`)

Documentos puramente operacionais (folha de ponto, relatórios) ficam fora desta refatoração — escopo limitado a documentos legais.

## Arquitetura

```text
Geração ──► hash SHA-256 ──► persiste em `documentos_emitidos` ──► QR Code no rodapé
                                       │
                                       ├──► log em `documentos_auditoria` (user, IP, timestamp)
                                       │
Verificação pública ──► /verificar-documento?id=...&hash=... ──► Edge Function (anon)
                                       │
                                       └──► retorna apenas: tipo, número, data, status, hash match
```

### 1. Banco de dados (migration)

Tabela `documentos_emitidos`:
- `id` (uuid), `tipo` (enum: contrato_residente, contrato_temporario, advertencia)
- `referencia_id` (uuid do registro original), `referencia_tabela` (text)
- `numero_documento` (text), `titular_nome` (text, mínimo necessário para conferência visual)
- `hash_sha256` (text, unique), `dados_estruturais` (jsonb — campos canônicos usados no hash)
- `emitido_por` (uuid → auth.users), `emitido_em` (timestamptz)
- `tenant_id` (uuid)

Tabela `documentos_auditoria`:
- `id`, `documento_id` → documentos_emitidos
- `acao` (gerado, reemitido, visualizado, verificado_publico)
- `user_id` (nullable — anon na verificação pública), `ip_origem` (inet), `user_agent` (text)
- `criado_em` (timestamptz)

RLS:
- `documentos_emitidos`: SELECT/INSERT para `authenticated` com tenant match; sem acesso `anon` direto
- `documentos_auditoria`: INSERT amplo (via Edge Function service_role), SELECT só para admin via `has_role`
- GRANTs explícitos para `authenticated` e `service_role` (anon nunca)

### 2. Edge Functions

- `registrar-documento` (verify_jwt=false, valida JWT em código): recebe payload canônico, calcula hash server-side via `crypto.subtle`, grava em `documentos_emitidos`, registra auditoria com IP de `x-forwarded-for`. Retorna `{ id, hash, qr_url }`.
- `verificar-documento` (público, anon): recebe `id` + `hash`, retorna `{ autentico: bool, tipo, numero, titular_mascarado, emitido_em }`. Registra auditoria de verificação pública. **Nunca** devolve conteúdo completo.

### 3. Frontend

- Hook `useDocumentoAutenticidade.ts`: chama `registrar-documento`, devolve `{ id, hash, qrUrl }` para injetar no PDF.
- Componente `RodapeAutenticidade.tsx`: renderiza QR (lib `qrcode` ou `react-qr-code` — adicionar via `bun add react-qr-code`) + hash em texto + instruções de verificação. Injetado nos três geradores de PDF.
- Página pública `/verificar-documento` (rota em `App.tsx`, fora do `ProtectedRoute`, dentro do `PublicLayout`): formulário com `id` + `hash` (preenchidos via query string), chama edge function, mostra badge verde "Documento Autêntico" ou vermelho "Documento Inválido/Alterado" + dados mínimos.
- Geração: antes de chamar `html2canvas`/`jsPDF`, calcular hash canônico no client (apenas para exibição imediata) e em paralelo registrar via edge function; usar o hash retornado pelo servidor como fonte de verdade no PDF.

### 4. PDF/A (preservação)

jsPDF não emite PDF/A nativo, mas aplicaremos as restrições viáveis:
- Setar metadados (`setDocumentProperties`: title, author, subject, keywords, creator)
- Embutir fonte padrão (Times) e evitar JS embutido
- Aplicar `setEncryption` com permissões: `print` permitido, `modify`/`copy`/`annot-forms` bloqueados, owner password aleatório (não exposto)
- Marcar no rodapé "Documento conforme padrão de arquivamento (PDF/A-like)"

Observação ao usuário: PDF/A estrito exige biblioteca server-side (ex: pdf-lib + conversor). Caso queira conformidade ISO 19005 completa, propor edge function com `pdf-lib` numa segunda etapa.

### 5. LGPD / RBAC

- Reemissão e listagem de documentos: somente `authenticated` com role `admin` ou `gestor` (via `has_role`)
- Logs de auditoria: somente `admin`
- Verificação pública: expõe apenas tipo, número, data, primeiro nome + iniciais do titular, status — nunca CPF, endereço ou valores
- Toda chamada de geração registra IP e user_id; toda verificação pública registra IP (sem user)

## Entregas, em ordem

1. Migration: tabelas, RLS, GRANTs, índices em `hash_sha256` e `referencia_id`
2. Edge functions `registrar-documento` e `verificar-documento`
3. Hook + componente de rodapé com QR
4. Integração nos três geradores de PDF existentes + metadados/encryption
5. Página pública `/verificar-documento` + rota
6. Tela admin de auditoria (lista filtrada de `documentos_auditoria` por documento) — opcional na primeira entrega; confirme se deve já incluir

## Pontos a confirmar antes de implementar

1. Confirma os 3 documentos no escopo (contrato residente, contrato temporário, advertência)? Quer incluir mais algum?
2. Para PDF/A: aceita a abordagem "PDF/A-like" com jsPDF (metadados + encryption) agora, e migração para pdf-lib server-side depois — ou já quer pdf-lib server-side desde já?
3. Tela admin de auditoria entra nesta entrega ou fica para a próxima?
