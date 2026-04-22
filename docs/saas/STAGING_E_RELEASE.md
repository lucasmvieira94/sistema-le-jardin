# 🚀 Estratégia de Release: Homologação → Produção

Este documento descreve o fluxo recomendado para evoluir o sistema com segurança, agora que ele atende múltiplas empresas em produção.

## 1. Dois ambientes separados

| Ambiente | URL | Banco (Supabase) | Origem |
|----------|-----|------------------|--------|
| **Produção** | `senexcare.com.br` | Projeto atual | branch `main` |
| **Homologação (Staging)** | `senex-staging.lovable.app` | Projeto novo de staging | branch `develop` (ou clone do projeto) |

### Como criar o ambiente de staging
1. **No Lovable**: duplicar este projeto via "Remix" ou criar um novo apontando para o mesmo repositório.
2. **No Supabase**: criar um segundo projeto Supabase exclusivo para staging.
3. Atualizar `.env` do projeto staging com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` do novo projeto.
4. Aplicar todas as migrations da pasta `supabase/migrations/` no Supabase de staging (ordem cronológica).
5. Cadastrar 1-2 tenants de teste em staging para QA.

## 2. Fluxo de release recomendado

```
 desenvolvimento ──► STAGING ──► QA + cliente piloto ──► PRODUÇÃO
      (Lovable)      (testes)      (aprovação)         (publish)
```

### Passos
1. **Toda nova feature** é construída e testada primeiro no projeto **staging**.
2. Migrations SQL são aplicadas em staging e validadas (sem dados reais sensíveis).
3. Um cliente-piloto (ou super-admin) faz UAT por 24-72h.
4. Após aprovação:
   - Publicar o código no projeto de produção (Lovable → Publish).
   - Aplicar as mesmas migrations no Supabase de produção (mesmas SQL na ordem).
5. Rodar smoke tests em produção (fluxos críticos: ponto, prontuário, login).
6. Monitorar logs de Edge Functions e console por 30min após o release.

## 3. Versionamento

- Adotar **SemVer**: `MAJOR.MINOR.PATCH` (ex.: `2.3.1`).
- Manter um arquivo `CHANGELOG.md` na raiz, atualizado a cada release.
- Exibir versão no rodapé do app (`/configuracoes`).

## 4. Checklist de release

- [ ] Migrations testadas em staging (incluindo backfill).
- [ ] RLS validado: usuário do tenant A não vê dados do tenant B.
- [ ] Edge Functions deployadas e logs sem erros.
- [ ] Versão atualizada e changelog publicado.
- [ ] Backup do Supabase de produção antes do release (Supabase faz diariamente, mas validar).
- [ ] Notificar clientes (e-mail/banner in-app) se houver mudanças visíveis.

## 5. Rollback

- **Frontend**: republicar a versão anterior no Lovable.
- **Banco**: nunca rodar `DROP` em produção. Para reverter migrations destrutivas, usar restore via Supabase Dashboard → Database → Backups.
- **Edge Functions**: redeploy da versão anterior via histórico do Lovable.

## 6. Boas práticas adicionais

- **Feature flags**: para liberar features só para alguns tenants, criar tabela `feature_flags(tenant_id, flag_key, enabled)` e consultar no front.
- **Monitoramento**: integrar Sentry para erros em produção.
- **Auditoria**: a tabela `audit_log` já existe — manter retenção mínima de 90 dias.
- **LGPD**: implementar exportação/exclusão de dados sob demanda por tenant.
- **Status page**: considerar um `status.senexcare.com.br` para comunicar incidentes.

## 7. Como tornar alguém super-admin

No SQL Editor do Supabase:

```sql
-- Substituir pelo user_id real (auth.users)
INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES ('SEU_USER_ID', 'super_admin', NULL);
```

O super-admin tem acesso a `/admin-saas` e pode gerenciar todas as empresas, planos, assinaturas e faturas.

## 8. Como cadastrar uma nova empresa-cliente

1. Acessar `/admin-saas/empresas`.
2. Clicar em "Nova empresa", informar nome, CNPJ e código de acesso (mínimo 6 caracteres).
3. O sistema gera automaticamente:
   - Hash seguro do código.
   - Assinatura em trial de 14 dias no plano Starter.
   - Módulos básicos habilitados (ponto, escala, prontuário, residentes).
4. Anotar o código gerado — ele será usado pelos colaboradores no portal `/funcionario-access`.
5. Para liberar mais módulos ou mudar plano, ir em `/admin-saas/assinaturas`.

---

**Última revisão:** abril/2026
**Responsável:** equipe de plataforma