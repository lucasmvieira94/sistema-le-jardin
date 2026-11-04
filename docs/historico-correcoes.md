# Histórico de correções e prevenção

## Consulta obrigatória antes de atualizar

1. Ler este histórico e consultar `erros_envio_suporte` (origem, erro, situação e observação de resolução) para os módulos afetados.
2. Conferir a causa e os testes associados; não reaplicar soluções de outro problema apenas porque a mensagem é semelhante.
3. Executar os testes de regressão dos módulos afetados antes de concluir; registrar novas causas, soluções e limites de validação aqui.
4. Marcar como solucionado somente com evidência. Uma recorrência gera novo erro aberto, nunca é encerrada automaticamente.
5. Não colocar dados de residentes, denúncias, credenciais ou documentos neste arquivo. Evidências operacionais permanecem no histórico administrativo protegido.

## Correções verificadas

### REC-001 — Identificador do recibo no envio por e-mail
- Causa: o código verificador de oito dígitos era enviado como identificador do documento; o servidor exige o UUID do registro.
- Correção: `src/utils/reciboPDF.ts` separa UUID do código público. Rodapé e QR continuam usando o código público; reenvios preservam PDF e pagamento original.
- Testes: `src/utils/__tests__/reciboPDF.test.ts`, `reenvioRecibo.test.ts`; reexecutados em 04/11/2026, 10 testes aprovados.
- Limite: recebimento real por e-mail não confirmado com login; não confundir isso com falha na validação do identificador.

### MED-001 — Medicamentos sem acesso ao Portal de Cuidados
- Causa: a autorização do módulo Medicamentos exigia indevidamente também o módulo do hub de Cuidados.
- Correção: `portal_med_funcionario()` consulta o passe válido e o módulo Medicamentos; mantém restrições de supervisor no estoque institucional.
- Teste: `src/utils/__tests__/portalMedicamentosPermissoes.test.ts`; sete testes SQL aprovados em 04/11/2026.
- Prevenção: nunca restaurar inserções diretas no navegador nem conceder acesso a fichas clínicas para contornar o bloqueio.

### PAINEL-001 — Retorno RPC não possui `.catch()`
- Causa: `marcar_contas_atrasadas` retorna objeto aguardável do cliente, não uma Promise com `.catch()`.
- Correção conferida em 04/11/2026: `AlertasContasPagar.tsx` e `useContasPagar.ts` usam `await` e verificam `error`.
- Prevenção: não encadear `.catch()` em RPCs; conferir erros do resultado e preservar carregamento dos alertas.

### PAINEL-002 — RPC sem vínculo com o cliente
- Causa: chamada de `supabase.rpc` extraída do cliente perde `this`, falhando ao acessar `this.rest`.
- Correção conferida em 04/11/2026: `AlertasProntuariosAtraso.tsx` usa `supabase.rpc.bind(supabase)`.
- Prevenção: chamar RPC pelo cliente ou manter vínculo explícito ao armazenar a função.

## Não encerrados por falta de evidência

### HOOKS-001 — `useState` / `useEffect` nulos
- Proteção adicionada: `resolve.dedupe` para React/React DOM no Vite.
- Não há prova de que duplicação seja a causa; tela pública sem erros não valida o Painel autenticado.
- Manter os seis registros em aberto até reproduzir e validar com sessão de gestor.

### TESTE-001 — Violação de RLS do prontuário com prefixo `TESTE:`
- Registro de simulação; não prova defeito nem correção do acesso real.
- Não encerrar automaticamente nem flexibilizar políticas para ocultá-lo.

## Histórico administrativo

Em **Histórico de erros**, selecionar **Resolvidos** para consultar correção, data e observação; selecionar **Em aberto** para pendências. A reabertura mantém a observação anterior. Novas resoluções exigem descrição do que foi corrigido e verificado.