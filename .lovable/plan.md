# Contracheques dos Funcionários

Novo módulo para o gestor subir **um único PDF contendo todos os contracheques do mês** e o sistema separar as páginas por funcionário automaticamente, disponibilizando cada holerite na área do funcionário (acesso por PIN).

## Fluxo do Gestor

1. Nova página `/contracheques` no painel admin (menu lateral, na seção Funcionários).
2. Formulário simples:
   - **Mês/Ano de referência** (ex.: 10/2026)
   - **Arquivo PDF consolidado** (drag & drop)
3. Ao enviar:
   - O PDF é processado no navegador (extração de texto por página com `pdfjs-dist`).
   - Para cada página, o sistema procura o nome de um funcionário ativo do tenant (match case-insensitive, ignora acentos).
   - Páginas consecutivas do mesmo funcionário são agrupadas em um único holerite.
   - Cada holerite é recortado em um PDF individual (`pdf-lib`) e salvo em Storage.
   - É criado um registro em `contracheques` vinculando funcionário + mês + arquivo.
4. Tela mostra o resultado: quantos foram distribuídos, quantas páginas não identificadas (listadas para reprocessar/atribuir manualmente).
5. Ações extras: reenviar (substitui o do mesmo mês), excluir holerite individual, atribuir página órfã manualmente a um funcionário.

## Fluxo do Funcionário

1. Novo botão **"Meus Contracheques"** no portal do funcionário (rota `/meus-contracheques`, acesso por PIN, sessão de 2h já existente).
2. Lista dos contracheques do funcionário logado, ordenados por mês (mais recente primeiro).
3. Cada linha: mês de referência, data de disponibilização, botão **Visualizar** (abre PDF em nova aba via signed URL) e **Baixar**.

## Estrutura Técnica

### Banco (migration)

Tabela `contracheques`:
- `funcionario_id` (FK funcionarios)
- `mes` (int 1–12), `ano` (int)
- `path` (caminho no Storage)
- `tamanho_bytes`, `paginas`
- `enviado_por` (uuid do gestor)
- unique (`tenant_id`, `funcionario_id`, `mes`, `ano`)

RLS:
- Gestor autenticado (mesmo tenant) faz tudo.
- Função `get_meus_contracheques(p_funcionario_id uuid)` `SECURITY DEFINER` retorna somente os do funcionário — chamada da área pública com o `funcionario_id` da sessão PIN (padrão já usado no projeto).

### Storage

Bucket privado `contracheques`, layout `{tenant_id}/{funcionario_id}/{ano}-{mes}.pdf`. Políticas RLS em `storage.objects` restringindo por bucket + tenant. URLs sempre assinadas (5 min).

### Frontend

- `src/pages/Contracheques.tsx` — página admin (upload + resultado).
- `src/components/contracheques/UploadContrachequesForm.tsx` — processa PDF no cliente.
- `src/pages/MeusContracheques.tsx` — página pública do funcionário.
- `src/hooks/useContracheques.ts` — queries/mutations.
- Bibliotecas: `pdfjs-dist` (extrair texto), `pdf-lib` (recortar páginas).
- Rota admin registrada em `AdminLayout` / `App.tsx`; rota pública registrada em `PublicLayout`; botão no `FuncionarioAccess`.

### Matching de nomes

- Normaliza (lowercase, remove acentos, colapsa espaços) o nome do funcionário e o texto da página.
- Considera match quando o nome completo aparece na página; empate resolvido pelo nome mais longo (mais específico).
- Páginas sem match viram "órfãs" e podem ser atribuídas manualmente.

## Observações

- Processamento roda no navegador do gestor (sem edge function), então PDFs grandes (>50 MB) podem ser lentos — mostro barra de progresso.
- Se o layout do holerite mudar e o nome não aparecer no texto (PDF escaneado), o funcionário não será identificado; nesse caso a UI oferece atribuição manual.
