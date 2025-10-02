# 🏢 Sistema Multi-Tenancy - Le Jardin

## ✅ Status da Implementação

### CONCLUÍDO ✓

#### Backend
- ✅ Tabela `tenants` criada com segurança de hashing
- ✅ Função `validate_employer_code()` para autenticação
- ✅ Função `rotate_employer_code()` para rotação segura
- ✅ RLS habilitado em `tenants`
- ✅ Tenant padrão criado: `LEJARDIN2025`

#### Frontend
- ✅ Hook `useTenant` para gerenciamento de estado
- ✅ Contexto `TenantContext` para acesso global
- ✅ Componente `TenantSelector` (tela de seleção)
- ✅ Componente `TenantGuard` (proteção de rotas)
- ✅ Componente `TenantSwitcher` (trocar empresa)
- ✅ Integração com `App.tsx`
- ✅ Cache de 24 horas implementado
- ✅ Helpers para queries com tenant

### 🚧 PENDENTE (Próximos Passos)

1. **Adicionar `tenant_id` às tabelas existentes** (Ver seção "Migrations Pendentes")
2. **Atualizar queries existentes** para incluir `tenant_id`
3. **Atualizar edge functions** para multi-tenancy
4. **Criar testes E2E** de isolamento de dados

---

## 🚀 Como Usar AGORA

### 1. Acesso ao Sistema

Quando você acessar o sistema, verá uma tela pedindo o **Código da Empresa**:

```
Código padrão para teste: LEJARDIN2025
```

Este código foi criado automaticamente na migration.

### 2. Criar um Novo Tenant (Admin)

Para adicionar uma nova empresa ao sistema:

```sql
-- 1. Gerar um código seguro (exemplo: EMPRESA2025)
-- 2. Executar no SQL Editor do Supabase:

INSERT INTO public.tenants (
  employer_code_hash,
  nome,
  cnpj,
  ativo
) VALUES (
  encode(digest('EMPRESA2025', 'sha256'), 'hex'),
  'Nome da Nova Empresa',
  '12345678901234', -- CNPJ (opcional)
  true
);
```

**⚠️ IMPORTANTE**: Guarde o código original (`EMPRESA2025`) em local seguro! O hash no banco não pode ser revertido.

### 3. Rotacionar Código (se necessário)

Se o código vazou ou por política de segurança:

```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.rpc('rotate_employer_code', {
  p_tenant_id: 'uuid-do-tenant',
  p_old_code: 'CODIGO_ANTIGO',
  p_new_code: 'CODIGO_NOVO_SEGURO'
});
```

---

## 📋 Migrations Pendentes

As seguintes tabelas **DEVEM** receber a coluna `tenant_id`:

### Prioridade 1 - CRÍTICO 🔴
```bash
# Dados sensíveis que PRECISAM de isolamento imediato
- funcionarios
- residentes  
- registros_ponto
- prontuario_ciclos
- prontuario_registros
- medicamentos
- estoque_medicamentos
- administracao_medicamentos
- residentes_medicamentos
```

### Prioridade 2 - IMPORTANTE 🟡
```bash
- escalas
- afastamentos
- controle_temperatura_medicamentos
- convites
```

### Prioridade 3 - SECUNDÁRIO 🟢
```bash
- alertas_whatsapp
- conversas_whatsapp
- mensagens_whatsapp
- configuracoes_empresa (pode ser 1:1 com tenant)
```

### Exemplo de Migration

Ver arquivo completo em: `docs/MULTI_TENANCY_GUIDE.md`

```sql
-- Resumo do processo para cada tabela:

-- 1. Adicionar coluna nullable
ALTER TABLE public.nome_tabela ADD COLUMN tenant_id UUID;

-- 2. Backfill com tenant padrão
UPDATE public.nome_tabela 
SET tenant_id = (
  SELECT id FROM tenants 
  WHERE employer_code_hash = encode(digest('LEJARDIN2025', 'sha256'), 'hex')
  LIMIT 1
)
WHERE tenant_id IS NULL;

-- 3. Tornar NOT NULL
ALTER TABLE public.nome_tabela ALTER COLUMN tenant_id SET NOT NULL;

-- 4. Adicionar FK e Índice
ALTER TABLE public.nome_tabela 
  ADD CONSTRAINT fk_nome_tabela_tenant 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX idx_nome_tabela_tenant_id ON public.nome_tabela(tenant_id);

-- 5. Atualizar RLS (ver guia completo)
```

---

## 💻 Uso no Código Frontend

### Obter tenant_id atual

```typescript
import { useTenantContext } from '@/contexts/TenantContext';

function MeuComponente() {
  const { tenantId, tenantName } = useTenantContext();
  
  // tenantId está disponível para usar em queries
  console.log('Tenant atual:', tenantName);
}
```

### Queries com Tenant

```typescript
import { useTenantContext } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';

// SELECT
const { data } = await supabase
  .from('residentes')
  .select('*')
  .eq('tenant_id', tenantId); // Sempre filtrar!

// INSERT
const { error } = await supabase
  .from('residentes')
  .insert({
    nome_completo: 'João Silva',
    tenant_id: tenantId, // Obrigatório!
    // ... outros campos
  });

// UPDATE
const { error } = await supabase
  .from('residentes')
  .update({ nome_completo: 'João Silva Atualizado' })
  .eq('id', residenteId)
  .eq('tenant_id', tenantId); // Validar tenant!

// DELETE
const { error } = await supabase
  .from('residentes')
  .delete()
  .eq('id', residenteId)
  .eq('tenant_id', tenantId); // Validar tenant!
```

### Usando Helpers (Recomendado)

```typescript
import { 
  selectWithTenant, 
  insertWithTenant, 
  updateWithTenant, 
  deleteWithTenant 
} from '@/utils/supabaseHelpers';
import { useTenantContext } from '@/contexts/TenantContext';

function MeuComponente() {
  const { tenantId } = useTenantContext();
  
  // SELECT automático
  const query = selectWithTenant('residentes', tenantId);
  
  // INSERT automático
  await insertWithTenant('residentes', {
    nome_completo: 'João Silva'
  }, tenantId);
  
  // UPDATE automático
  await updateWithTenant('residentes', residenteId, {
    nome_completo: 'João Silva Atualizado'
  }, tenantId);
  
  // DELETE automático
  await deleteWithTenant('residentes', residenteId, tenantId);
}
```

---

## 🧪 Como Testar

### Teste Manual 1: Isolamento de Dados

1. Crie 2 tenants diferentes no banco
2. Faça login com tenant A
3. Crie alguns residentes
4. Troque para tenant B (TenantSwitcher)
5. Verifique que os residentes do tenant A NÃO aparecem
6. Crie residentes diferentes para tenant B
7. Troque de volta para tenant A
8. Confirme que apenas residentes de A aparecem

### Teste Manual 2: Expiração de Cache

1. Faça login com um tenant
2. Aguarde 24 horas OU limpe cache do navegador
3. Recarregue a página
4. Sistema deve pedir o código novamente

### Teste Manual 3: Código Inválido

1. Acesse o sistema
2. Digite um código que não existe: `TESTE123`
3. Sistema deve mostrar erro: "Código da empresa inválido ou inativo"

---

## 📚 Documentação Completa

- **Guia Técnico Completo**: `docs/MULTI_TENANCY_GUIDE.md`
- **Este README**: `docs/MULTI_TENANCY_README.md`

---

## ⚠️ ATENÇÃO - Segurança

### ❌ NUNCA FAÇA

```typescript
// ❌ ERRADO: Query sem tenant_id
const { data } = await supabase.from('residentes').select('*');

// ❌ ERRADO: Armazenar employer_code em texto puro
const code = "EMPRESA2025";
localStorage.setItem('employer_code', code);

// ❌ ERRADO: Inserir sem tenant_id
await supabase.from('residentes').insert({ nome: 'João' });
```

### ✅ SEMPRE FAÇA

```typescript
// ✅ CORRETO: Query com tenant_id
const { data } = await supabase
  .from('residentes')
  .select('*')
  .eq('tenant_id', tenantId);

// ✅ CORRETO: Apenas armazenar tenant_id em cache
localStorage.setItem('le_jardin_tenant', JSON.stringify({
  tenantId: 'uuid...',
  tenantName: 'Empresa',
  timestamp: Date.now()
}));

// ✅ CORRETO: Inserir com tenant_id
await supabase.from('residentes').insert({ 
  nome: 'João',
  tenant_id: tenantId 
});
```

---

## 🆘 Troubleshooting

### "Não consigo ver os dados"
- Verifique se o `tenant_id` foi adicionado na tabela
- Verifique se as políticas RLS estão corretas
- Use o SQL Editor para conferir: `SELECT * FROM nome_tabela WHERE tenant_id = 'seu-uuid';`

### "Código inválido mas tenho certeza que está correto"
- Verifique se o tenant está ativo: `SELECT * FROM tenants WHERE ativo = true;`
- Verifique o hash: `SELECT encode(digest('SEU_CODIGO', 'sha256'), 'hex');`
- Compare com `employer_code_hash` no banco

### "Cache não expira"
- Limpe manualmente: `localStorage.clear();`
- Verifique `TENANT_EXPIRY_KEY` no código

---

## 📞 Suporte

Em caso de dúvidas:
1. Consulte `docs/MULTI_TENANCY_GUIDE.md`
2. Revise os logs do Supabase
3. Verifique as políticas RLS

---

**Última Atualização**: 2025-01-02  
**Versão**: 1.0.0  
**Status**: ✅ Infraestrutura completa / 🚧 Migrations de tabelas pendentes
