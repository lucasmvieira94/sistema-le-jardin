# Histórico de correções e prevenção

## Consulta obrigatória antes de atualizar

1. Ler este histórico e consultar `erros_envio_suporte` (origem, erro, situação e observação de resolução) para os módulos afetados.
2. Conferir a causa e os testes associados; não reaplicar soluções de outro problema apenas porque a mensagem é semelhante.
3. Executar os testes de regressão dos módulos afetados antes de concluir; registrar novas causas, soluções e limites de validação aqui.
4. Marcar como solucionado somente com evidência. Uma recorrência gera novo erro aberto, nunca é encerrada automaticamente.
5. Não colocar dados de residentes, denúncias, credenciais ou documentos neste arquivo. Evidências operacionais permanecem no histórico administrativo protegido.

## Correções verificadas

### CUIDADOS-004 — Observações dos residentes
- Aba Observações na ficha do Portal de Cuidados e botão no painel do gestor. Sem prazo por padrão ou válida até uma data (Brasília); vencidas são filtradas na consulta, nunca apagadas. Sem edição.
- Exclusão pela cuidadora pede justificativa e deixa a observação pendente (fora da ficha) até o gestor aprovar/recusar em Aprovações de Remoção; gestor exclui direto com motivo registrado. Rosa ganhou consulta `observacoes`.
- Evidências: 5 testes SQL em PGlite com a migração real (sem passe, validade, vencida oculta, remoção temporária, só gestor decide, recusa/aprovação). Compilação OK; função da Rosa publicada.
- Limites: telas não testadas no navegador com passe PIN real nem com sessão de gestor. Testes com data usam `obs_hoje()` para não falhar perto da meia-noite UTC.

### MED-001 — Remoção de medicamento do estoque com aprovação do gestor
- Cuidadora pede remoção pela lixeira no estoque do residente, com justificativa (mín. 10 letras); o item fica inativo até o gestor decidir em Remoções de Medicamentos. Recusa reativa o mesmo registro (mesma quantidade); aprovação mantém inativo. Mapa não é alterado.
- Verificação de gestor usa `coalesce(eh_gestor(...), false)` para falhar fechado quando a resposta é nula (achado pelo teste).
- Evidências: 5 testes SQL em PGlite com as migrações reais + 7 regressões de permissões de medicamentos; compilação OK.
- Ampliação: lotes do estoque de emergência também, só por supervisores; o gestor vê "Estoque de emergência" com o lote. Teste SQL adicional aprovado (6 no total).
- Limites: fluxo com passe PIN real e tela do gestor não testados no navegador.

### CUIDADOS-003 — Rosa: conversa e consultas protegidas
- Conversa contínua privada por cuidadora, identificada pelo passe PIN no servidor; respostas gravadas somente pela função de IA. Ferramentas consultam RPCs existentes e a ficha é filtrada também por módulo.
- Aprendizado supervisionado: sugestões de funcionamento vão à revisão do gestor; aprovação/revogação afeta próximas respostas, não altera prescrição ou prontuário. Manual versionado acompanha atualizações futuras, sem promessa de treinamento automático.
- Evidências: 21 regressões aprovadas, incluindo 11 testes SQL executando as migrações reais; bloqueio sem passe, isolamento de histórico, pedido duplicado e aprovação/revogação. Navegador celular/desktop com sessão fictícia conferiu mensagem, resposta e foco; sem erros de execução. Função real sem passe retorna 401; verificação Deno aprovada.
- Limites: conversa de IA com passe real e revisão com gestor não verificadas neste ambiente externo. Verificação global de lint encontra dívidas anteriores; não encerrar erros do monitor sem validação real. Avisos SECURITY DEFINER revisados: PIN exige autorização e revisão exige gestor/tenant; tabelas de chat não têm acesso direto de cuidadoras/gestores.

### CUIDADOS-002 — Contatos da área protegida
- Inclusão em 14/11/2026: telefones Vitalmed/Constat e código do contratante destacados na página de residentes; atalho Urgência no cabeçalho disponível também durante as tarefas do portal.
- Evidência: 10 testes aprovados (três valores de contato e sete regressões do portal); navegador conferiu os dois links `tel:`, o código e a abertura da janela no celular com sessão fictícia. Compilação sem erros.
- Limite: nenhuma chamada efetuada; não confirma atendimento ou cobertura do prestador. Nenhuma permissão ou fluxo clínico alterado.
- Ajuste posterior em 14/11/2026: removido o bloco da página inicial a pedido do gestor; contatos permanecem somente na janela do atalho Urgência. Dez regressões aprovadas e navegador confirmou ausência dos links na página inicial e presença após abrir o atalho, com sessão fictícia.

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

### CUIDADOS-008 — Monitoramento operacional do supervisor
- Painel integra pendências de rotinas, doses, compromissos e registros do dia, com atividades da equipe, alertas de estoque, conservação e vacinas; atualização a cada 30 segundos enquanto a página está visível.
- Consultas de supervisão exigem passe PIN válido, funcionário ativo e módulo Supervisão no servidor; dados limitados à instituição e sem informações financeiras. A execução por anon é necessária ao portal PIN e não dispensa esses controles; não remover a autorização para silenciar avisos genéricos de SECURITY DEFINER.
- Evidências: 39 testes aprovados, incluindo migrações reais em PGlite, negativa sem passe/módulo, funcionário inativo, isolamento de instituição e consulta após nova atividade. Navegador com dados simulados verificou detalhes de rotina, observações do compromisso, atividades por cuidadora, busca e atualização da ciência compartilhada em computador/celular/tablet; compilação OK. Manual da Rosa atualizado e função publicada.
- Limites: passe PIN real e ações antigas de gestão de intercorrências não verificados neste ambiente externo; nenhum erro do monitor foi encerrado. O navegador detectou `reading 'on'` somente na entrada do plugin PWA de desenvolvimento, não no painel; não tratar isso como prova de resolução dos registros similares do monitor. Indicadores representam registros, não comprovação de desempenho ou atendimento clínico.

## Não encerrados por falta de evidência

### Revisão de 22/11/2026 — PWA, supervisão e plantão noturno
- PWA-001: o script de desenvolvimento chamava `import.meta.hot.on` sem contexto HMR. Desativada apenas a inscrição PWA em desenvolvimento, preservando o service worker publicado. Após aplicar configuração, navegador real na rota `/`: nenhuma exceção e nenhum pedido ao script defeituoso. Seis registros específicos marcados como resolvidos e relidos no banco.
- SUP-001: a consulta do supervisor referenciava `residentes_observacoes.criado_por`, campo inexistente. Corrigido para `autor_funcionario_id`, sem atribuir ao cuidador uma observação do gestor. Fixture SQL corrigida para os campos reais; regressão executa a migração de produção e verifica autoria/isolamento.
- ROT-001: confirmações noturnas após meia-noite eram salvas na noite seguinte. Ocorrências usam a data de início do plantão 19h–07h; servidor valida data, vigência, dia da semana e duplicidade. Portal e supervisor consultam também a noite anterior; formulário antigo não pode confirmar outro plantão. Registros históricos não foram movidos sem comprovação da intenção original.
- Evidências: 43 testes aprovados, incluindo RPCs de produção em PGlite às 02h, 06h59, 07h e 19h, consultas de leitura após registro, duplicidade e bloqueio sem passe/módulo. Duas falhas do Project monitoring encerradas como corrigidas. Manual da Rosa atualizado e função publicada. Compilação OK.
- REC-001: dois registros antigos com `documentoId: Invalid uuid` marcados resolvidos após confirmar a separação UUID/código público e reexecutar dez testes de emissão/reenvio; recebimento real do e-mail continua não verificado.
- Limites: acesso externo não fornece sessão real do gestor/cuidador para validar fluxos protegidos no navegador. Dez erros antigos permanecem abertos (oito de hooks, um QueryClient e um teste RLS) por falta de reprodução/verificação autenticada. Avisos genéricos de execução SECURITY DEFINER são necessários ao PIN e mantêm validação de passe/módulo/instituição; não flexibilizar autorização para silenciá-los. Avisos de segurança preexistentes não foram tratados nesta revisão.

### HOOKS-001 — `useState` / `useEffect` nulos
- Proteção adicionada: `resolve.dedupe` para React/React DOM no Vite.
- Não há prova de que duplicação seja a causa; tela pública sem erros não valida o Painel autenticado.
- Manter os seis registros em aberto até reproduzir e validar com sessão de gestor.

### TESTE-001 — Violação de RLS do prontuário com prefixo `TESTE:`
- Registro de simulação; não prova defeito nem correção do acesso real.
- Não encerrar automaticamente nem flexibilizar políticas para ocultá-lo.

## Histórico administrativo

Em **Histórico de erros**, selecionar **Resolvidos** para consultar correção, data e observação; selecionar **Em aberto** para pendências. A reabertura mantém a observação anterior. Novas resoluções exigem descrição do que foi corrigido e verificado.- ROSA-001: rosa_historico chamava calcular_modulos_funcionario(uuid) inexistente (42883), impedindo abrir conversa. Corrigido para modulos_funcionario(f). Evidência: chamada real com passe PIN de teste retornou 200 com resposta da Rosa.
