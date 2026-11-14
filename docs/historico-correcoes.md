# Histórico de correções e prevenção

## Consulta obrigatória antes de atualizar

1. Ler este histórico e consultar `erros_envio_suporte` (origem, erro, situação e observação de resolução) para os módulos afetados.
2. Conferir a causa e os testes associados; não reaplicar soluções de outro problema apenas porque a mensagem é semelhante.
3. Executar os testes de regressão dos módulos afetados antes de concluir; registrar novas causas, soluções e limites de validação aqui.
4. Marcar como solucionado somente com evidência. Uma recorrência gera novo erro aberto, nunca é encerrada automaticamente.
5. Não colocar dados de residentes, denúncias, credenciais ou documentos neste arquivo. Evidências operacionais permanecem no histórico administrativo protegido.

## Correções verificadas

### CUIDADOS-002 — Contatos da área protegida
- Inclusão em 14/11/2026: telefones Vitalmed/Constat e código do contratante destacados na página de residentes; atalho Urgência no cabeçalho disponível também durante as tarefas do portal.
- Evidência: 10 testes aprovados (três valores de contato e sete regressões do portal); navegador conferiu os dois links `tel:`, o código e a abertura da janela no celular com sessão fictícia. Compilação sem erros.
- Limite: nenhuma chamada efetuada; não confirma atendimento ou cobertura do prestador. Nenhuma permissão ou fluxo clínico alterado.

### CUIDADOS-001 — Resumo diário sem substituir o prontuário original
- Implementação em 14/11/2026: cards por data mostram somente análise de IA; toque consulta todos os registros daquela data, incluindo observações e justificativas de retificação. A consulta diária não usa o limite de 60 registros da ficha.
- Segurança: RPC reutiliza `portal_cuidados_ficha` para validar passe, módulo e acesso ao residente antes de consultar registros; a função de IA usa o cliente anon com passe, nunca service role. Avisos genéricos de função SECURITY DEFINER acessível a anon/authenticated são intencionais para o PIN e foram revisados, não são autorização irrestrita. Não flexibilizar políticas para eliminar esses avisos. Os 276 avisos anteriores não foram alterados.
- Evidências: 14 testes aprovados, incluindo execução da migração real em PGlite com bloqueio sem passe/módulo/residente autorizado; RPC real sem passe retorna 401, assim como o resumo. Geração real de IA com entrada fictícia concluída; cards e abertura do prontuário inspecionados em desktop e celular com respostas simuladas. Verificação Deno aprovada e aplicação sem erros na compilação.
- Ajuste de compatibilidade: payload de desligamento passou a usar o tipo Update da tabela, sem alteração de valores ou comportamento, após atualização das declarações Supabase.
- Limite: consulta/resumo com passe real de cuidador não verificados; acesso externo não permite criar sessão de teste. Nenhum erro administrativo marcado como resolvido.

### REC-002 — Recibo com assinatura exclusivamente no rodapé digital
- Ajuste solicitado: retirar campo e imagem de assinatura do sócio, preservando o rodapé SXCare com signatário, horário de Brasília, QR, link, código e SHA-256.
- Correção: emissão exige a identidade institucional, mas não uma imagem de rubrica; removidos o bloco duplicado de assinatura e a linha adicional de geração. UUID do registro e certificação obrigatória permanecem inalterados.
- Evidência em 06/11/2026: 10 testes de emissão/reenvio aprovados; PDF sintético gerado no navegador com rodapé real, sem rubrica, inspecionado visualmente em A4.
- Limite: amostra sem persistência e sem envio; emissão com pagamento real e recebimento por e-mail não verificados nesta alteração.

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