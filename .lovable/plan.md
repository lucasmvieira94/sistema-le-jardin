# Agenda finalizada + Procedimentos e rotinas do residente

## O que já existe
- Agenda: tabela de compromissos e funções para listar, criar e marcar como visto já estão no banco. Faltam a tela, o aviso ao entrar e edição/cancelamento.
- Mapa de Medicamentos: já cuida de remédios com horários. Prontuário diário: já registra o dia do residente.

## 1. Finalizar a agenda
- Card "Compromissos de hoje" no topo do Portal de Cuidados, com aviso ao entrar listando os compromissos ainda não vistos e botão "Marcar como visto" (quem marcou some o aviso para todos; fica na lista como "Feito por Fulana às 10:15").
- Nova aba "Agenda" no portal: navegação por dia (hoje, próximos dias, calendário), filtro por residente, botão "Novo compromisso" (residente, título, data, horário, observações).
- Editar e cancelar compromisso futuro, com motivo; nada é apagado (fica registrado quem e quando).
- Na ficha do residente (aba Resumo): próximos compromissos.

## 2. Procedimentos e rotinas (novo, sem duplicar)
Um único cadastro flexível, "Rotina de cuidado", cobrindo os exemplos:

| Exemplo | Como fica |
|---|---|
| Produto no banho | Tipo: Orientação ligada ao momento "Banho", sem horário, sem fim |
| Curativo no pé esquerdo | Tipo: Procedimento, instruções detalhadas, 1x ao dia às 09:00, por 10 dias |
| Pressão arterial 3x ao dia por 7 dias | Tipo: Aferição (pressão), horários 08:00/14:00/20:00, de/até |

Campos: residente, título, tipo (Procedimento, Aferição, Orientação), instruções, frequência (horários fixos do dia; ou "a cada momento": banho, refeição, troca; ou "uma vez por plantão"), dias da semana opcionais, início e fim (ou duração em dias).

Na rotina diária:
- Aba "Rotinas do dia" no portal, agrupada por horário como o Mapa de Medicamentos (atrasado, agora, próximo, feito).
- Botão "Feito" registra quem e quando, com observação opcional; para aferição, pede o valor (ex.: 13x8, glicemia, temperatura) e guarda no histórico.
- Orientações sem horário aparecem como lembrete fixo no card do residente (ex.: "No banho: usar sabonete X").
- Rotinas vencidas encerram sozinhas; encerrar antes exige motivo.
- Ficha do residente ganha aba "Rotinas" com ativas, encerradas e histórico de aferições.

Sem redundância:
- Remédios continuam somente no Mapa de Medicamentos; o formulário de rotina não aceita medicação e orienta a usar o Mapa.
- As execuções e aferições do dia aparecem no prontuário de 24h como leitura, sem precisar digitar de novo.

## Quem pode o quê
- Ver e marcar como feito: quem tem acesso ao Portal de Cuidados.
- Criar, editar e encerrar rotinas e compromissos: também quem tem acesso ao portal (como hoje na agenda). Pode ser restrito a supervisores, se preferir.

## Detalhes técnicos
- Agenda: adicionar `cancelado_em/motivo` e RPCs `portal_cuidados_agenda_periodo`, `portal_cuidados_editar_evento`, `portal_cuidados_cancelar_evento` (passe PIN + módulo `portal_cuidados`, tenant).
- Novas tabelas `cuidados_rotinas` (tipo, instrucoes, horarios time[], momento, por_plantao, dias_semana int[], inicio, fim, encerrada_em/motivo, criado_por) e `cuidados_rotinas_execucoes` (rotina_id, data, horario_previsto, feito_por, feito_em, valor, observacao; único por rotina+data+horário). Só service_role + RPCs SECURITY DEFINER, sem políticas anon, seguindo o modelo do portal.
- RPCs: `portal_rotinas_dia`, `portal_rotina_criar/editar/encerrar`, `portal_rotina_executar`, `portal_rotinas_residente`.
- Regras puras em `src/utils/rotinasCuidados.ts` (geração de ocorrências do dia, vigência, status atrasado/agora/próximo, validação), com testes; horário de Brasília via `dateUtils`.
- Telas: `AgendaCuidados.tsx`, `AvisosAgendaDialog`, `RotinasDia.tsx`, `RotinaDialog.tsx`, aba Rotinas em `FichaCuidadoResidente.tsx`; rotas aninhadas `/cuidados/agenda` e `/cuidados/rotinas`.
- Testes SQL em PGlite para autorização, tenant e "feito uma vez por ocorrência". Registrar regra no `AGENTS.md` e consultar `docs/historico-correcoes.md`.
