# Guia de Multi-Tenancy - Sistema Le Jardin

## 📋 Visão Geral

Este documento descreve a implementação completa de multi-tenancy no Sistema Le Jardin, permitindo que múltiplas instituições usem a mesma URL mas vejam apenas seus dados.

## 🏗️ Arquitetura

### Estrutura de Tenants

- **Tabela Central**: `tenants` - armazena informações das empresas
- **Autenticação**: `employer_code` com hash SHA-256
- **Isolamento**: Coluna `tenant_id` em todas as tabelas sensíveis
- **Segurança**: RLS (Row Level Security) em todas as tabelas

### Código do Empregador (Employer Code)

**⚠️ CRÍTICO**: O `employer_code` NUNCA é armazenado em texto puro no banco!

- Armazenado como hash SHA-256 na coluna `employer_code_hash`
- Exemplo: código "LEJARDIN2025" → hash `8a7f2c...` (64 caracteres hex)
- Validação via função `validate_employer_code(p_employer_code TEXT)`
- Rotação segura via função `rotate_employer_code()`

## 🔐 Segurança

### Princípios

1. **Hashing obrigatório**: Sempre usar `encode(digest(code, 'sha256'), 'hex')`
2. **RLS ativo**: Todas as tabelas devem ter RLS habilitado
3. **Isolamento garantido**: Queries sempre filtradas por `tenant_id`
4. **Cache expirável**: Cliente armazena apenas `tenant_id`, não código sensível

### Exemplo de RLS Policy

```sql
-- Padrão para todas as tabelas multi-tenant
CREATE POLICY "Isolar dados por tenant"
  ON public.nome_tabela
  FOR ALL
  USING (tenant_id = (SELECT id FROM tenants WHERE id = current_setting('app.current_tenant_id', true)::uuid))
  WITH CHECK (tenant_id = (SELECT id FROM tenants WHERE id = current_setting('app.current_tenant_id', true)::uuid));
```

## 📊 Migration: Adicionar tenant_id às Tabelas Existentes

### Processo Não-Destrutivo (5 Passos)

```sql
-- ========================================
-- PASSO 1: Adicionar coluna NULLABLE
-- ========================================
ALTER TABLE public.nome_tabela 
  ADD COLUMN tenant_id UUID;

-- ========================================
-- PASSO 2: Backfill com tenant padrão
-- ========================================
-- Buscar ID do tenant padrão
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  SELECT id INTO default_tenant_id 
  FROM public.tenants 
  WHERE employer_code_hash = encode(digest('LEJARDIN2025', 'sha256'), 'hex')
  LIMIT 1;
  
  -- Atualizar todos os registros existentes
  UPDATE public.nome_tabela 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id IS NULL;
END $$;

-- ========================================
-- PASSO 3: Tornar coluna NOT NULL
-- ========================================
ALTER TABLE public.nome_tabela 
  ALTER COLUMN tenant_id SET NOT NULL;

-- ========================================
-- PASSO 4: Adicionar FK e Índice
-- ========================================
ALTER TABLE public.nome_tabela 
  ADD CONSTRAINT fk_nome_tabela_tenant 
  FOREIGN KEY (tenant_id) 
  REFERENCES public.tenants(id) 
  ON DELETE CASCADE;

CREATE INDEX idx_nome_tabela_tenant_id 
  ON public.nome_tabela(tenant_id);

-- ========================================
-- PASSO 5: Atualizar Políticas RLS
-- ========================================
-- Remover políticas antigas (se houver)
DROP POLICY IF EXISTS "policy_antiga" ON public.nome_tabela;

-- Criar política nova isolada por tenant
CREATE POLICY "Usuários veem apenas dados do seu tenant"
  ON public.nome_tabela
  FOR ALL
  USING (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE id = current_setting('app.current_tenant_id', true)::uuid
      AND ativo = true
    )
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- Admins podem ver todos os dados (opcional)
CREATE POLICY "Admins podem gerenciar todos os dados"
  ON public.nome_tabela
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

### Lista de Tabelas a Atualizar

**Prioridade ALTA** (dados sensíveis):
- [ ] `funcionarios` - dados de funcionários
- [ ] `residentes` - dados de residentes
- [ ] `registros_ponto` - registros de ponto
- [ ] `prontuario_ciclos` - ciclos de prontuário
- [ ] `prontuario_registros` - registros de prontuário
- [ ] `medicamentos` - medicamentos
- [ ] `estoque_medicamentos` - estoque
- [ ] `administracao_medicamentos` - administrações
- [ ] `residentes_medicamentos` - prescrições

**Prioridade MÉDIA**:
- [ ] `escalas` - escalas de trabalho
- [ ] `afastamentos` - afastamentos
- [ ] `controle_temperatura_medicamentos` - controle temperatura
- [ ] `configuracoes_empresa` - configurações (já é única por tenant)

**Prioridade BAIXA**:
- [ ] `alertas_whatsapp` - alertas WhatsApp
- [ ] `conversas_whatsapp` - conversas
- [ ] `mensagens_whatsapp` - mensagens

## 🔧 Frontend: Uso do Hook useTenant

### Hook useTenant

```typescript
import { useTenantContext } from '@/contexts/TenantContext';

function MyComponent() {
  const { tenantId, tenantName, isAuthenticated } = useTenantContext();
  
  // tenantId está disponível para queries
  const { data } = useQuery({
    queryKey: ['dados', tenantId],
    queryFn: () => fetchData(tenantId),
    enabled: !!tenantId
  });
}
```

### Queries Automáticas com Tenant

```typescript
// Supabase Query com tenant_id automático
const { data, error } = await supabase
  .from('nome_tabela')
  .select('*')
  .eq('tenant_id', tenantId); // Sempre incluir!

// Insert com tenant_id
const { error } = await supabase
  .from('nome_tabela')
  .insert({
    ...dados,
    tenant_id: tenantId // Obrigatório!
  });
```

## 🚀 Fluxo de Uso

1. **Usuário acessa o sistema**: Vê tela de seleção de empresa
2. **Insere employer_code**: Sistema valida via `validate_employer_code()`
3. **Código válido**: `tenant_id` salvo em cache (24h)
4. **Navegação**: Todas as queries filtradas por `tenant_id`
5. **Trocar empresa**: Usuário pode clicar em "Trocar Empresa" no TenantSwitcher

## 🔄 Rotação de Código

### Quando Rotacionar

- Suspeita de vazamento do código
- Troca de gestão/administração
- Política de segurança (rotação periódica)
- Ex-funcionários com acesso ao código

### Como Rotacionar (apenas Admins)

```typescript
// Frontend
const { data, error } = await supabase
  .rpc('rotate_employer_code', {
    p_tenant_id: tenantId,
    p_old_code: 'CODIGO_ANTIGO',
    p_new_code: 'CODIGO_NOVO_SEGURO'
  });

// Resposta: { success: true, message: "..." }
```

### Impacto

- ✅ Código antigo **IMEDIATAMENTE** invalidado
- ✅ Registro de auditoria criado
- ⚠️ Todos os usuários precisam usar o novo código
- ⚠️ Cache de 24h é invalidado na próxima revalidação

## 📝 Checklist de Implementação

### Backend
- [x] Tabela `tenants` criada
- [x] Funções de validação e rotação
- [x] RLS habilitado em `tenants`
- [ ] `tenant_id` adicionado em todas as tabelas sensíveis
- [ ] RLS atualizado em todas as tabelas
- [ ] Índices criados em `tenant_id`
- [ ] Edge functions atualizadas para multi-tenancy

### Frontend
- [x] Hook `useTenant` criado
- [x] Contexto `TenantContext` criado
- [x] Componente `TenantSelector` criado
- [x] Componente `TenantGuard` criado
- [x] Componente `TenantSwitcher` criado
- [x] Integração com `App.tsx`
- [ ] Atualizar queries para incluir `tenant_id`
- [ ] Atualizar inserts para incluir `tenant_id`

### Testes
- [ ] Teste de isolamento de dados entre tenants
- [ ] Teste de validação de código inválido
- [ ] Teste de rotação de código
- [ ] Teste de expiração de cache
- [ ] Teste de RLS policies

## 🛡️ Boas Práticas

1. **NUNCA** fazer query sem `tenant_id` em tabelas multi-tenant
2. **SEMPRE** validar `tenantId` antes de queries
3. **SEMPRE** usar RLS - não confiar apenas no frontend
4. **NUNCA** armazenar `employer_code` em texto puro
5. **SEMPRE** usar funções `security definer` para operações sensíveis
6. **SEMPRE** fazer backup antes de migrations
7. **SEMPRE** testar migrations em ambiente de desenvolvimento
8. **SEMPRE** ter plano de rollback documentado

## 📖 Referências

- Documentação Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Documentação pgcrypto: https://www.postgresql.org/docs/current/pgcrypto.html
- Pattern Multi-Tenancy: https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-isolation.html

---

**Última atualização**: 2025-01-02
**Versão**: 1.0.0
**Autor**: Sistema Le Jardin Development Team
