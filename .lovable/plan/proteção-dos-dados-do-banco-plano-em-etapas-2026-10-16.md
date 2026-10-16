# Proteção dos dados do banco — plano em etapas

## Contexto
A última verificação encontrou 66 avisos (35 críticos). Eles se dividem em três grupos:

1. **Acesso de qualquer pessoa sem login (anon)** — cerca de 15 tabelas e 5 pastas de arquivos. Ex.: registros de ponto, prontuário, residentes, contracheques, folhas de ponto, intercorrências, medicamentos, lembretes, convites, contratos temporários, documentos internos.
   Causa: o portal do colaborador (acesso por PIN de 4 dígitos) lê e grava direto nessas tabelas sem login, então o banco precisa liberar "todos".
2. **Qualquer usuário logado vê tudo** — cerca de 20 tabelas (funcionários, financeiro, contas a pagar, mensalidades, cargos, folhas de ponto, contracheques, logs de biometria, WhatsApp etc.) e arquivos de contracheques, folhas de ponto e comprovantes.
3. **Ajustes técnicos simples** — 3 funções sem caminho fixo de busca e proteção contra senhas vazadas desligada.

## Etapa 1 — Corrige sem mudar o funcionamento (recomendado já)
- Fixar o caminho de busca das 3 funções sinalizadas.
- Tabelas do grupo 2: trocar "qualquer logado" por "administrador da mesma empresa" (já é como o sistema é usado: só gestores fazem login). Colaboradores entram por PIN, então não são afetados.
- Arquivos de contracheques, folhas de ponto e comprovantes: escrita/exclusão só para administradores.
- Imagens de intercorrências: remover alterar/excluir por anônimos (só envio continua).
- Ativar proteção contra senhas vazadas (exige plano Pro do Supabase; feito por você no painel).
- Antes de aplicar, conferir no código cada tela de gestor que usa essas tabelas, para que nada pare de funcionar.

Resultado esperado: some cerca de metade dos avisos, sem mudança perceptível.

## Etapa 2 — Exige mudar como o portal por PIN funciona (sua decisão)
Enquanto o portal acessar as tabelas sem login, os avisos do grupo 1 não podem ser resolvidos de verdade: qualquer pessoa com o endereço do site pode ler prontuários, pontos e contracheques.

Sugestões:
- **A (recomendada) — Sessão do portal no servidor:** ao digitar o PIN, o servidor devolve um "passe" temporário (2 h, como hoje). Cada ação do portal (bater ponto, prontuário, fraldas, medicamentos, documentos) passa a usar funções do servidor que conferem esse passe e só mostram os dados daquele colaborador/empresa. Para o colaborador, nada muda na tela. Trabalho maior, feito módulo por módulo.
- **B — Login real para colaboradores:** cada um ganha conta com e-mail/senha ou link. Mais seguro e padrão, mas muda a rotina de entrada.
- **C — Manter como está e aceitar o risco** apenas para dados não sensíveis (ex.: módulos da empresa, configurações de alerta), corrigindo só os sensíveis.

Casos públicos legítimos (contrato temporário por link, convites, verificação de documentos) passam a usar funções que exigem o token exato, em vez de abrir a tabela inteira.

## Detalhes técnicos
- Etapa 1: migração única — `ALTER FUNCTION ... SET search_path = public`; recriar políticas USING(true) para `authenticated` como `has_tenant_access(tenant_id) AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))`; políticas de storage restritas por `has_role`. Revisar `rg` de `.from('<tabela>')` em telas autenticadas e funções de borda (service role não é afetado).
- Etapa 2 (opção A): tabela `portal_sessoes` (token opaco, funcionario_id, tenant_id, expira_em); RPCs SECURITY DEFINER `portal_*` validando o token; remover políticas `anon` tabela a tabela conforme cada módulo migra; arquivos servidos por URL assinada.
- Validação: rodar verificação de segurança e testar portal PIN e telas de gestor após cada etapa.
