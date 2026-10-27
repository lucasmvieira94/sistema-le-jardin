# Mapa de Medicamentos ligado ao estoque + dose de emergência

## Como vai funcionar (para a equipe)

**1. Estoque do residente primeiro** (cuidadoras com acesso a Medicamentos)
- Nova aba "Estoque" dentro de Medicamentos no Portal de Cuidados.
- Escolhe o residente, o remédio, a quantidade, o lote e a validade (opcionais), e salva.
- Se o remédio já existir no estoque daquele residente, a quantidade é somada.

**2. Colocar no mapa a partir do estoque**
- O botão "Cadastrar no mapa" passa a mostrar só os remédios que o residente tem em estoque (quantidade maior que 0).
- Depois a pessoa informa a dose, os horários, a via, o médico, as datas e as observações.
- Não é mais possível digitar um remédio livre.

**3. O mapa fica protegido**
- Se o estoque acabar, o remédio continua no mapa com o selo "Sem estoque".
- O botão "Dar" continua funcionando e registra a dose, mas mostra o aviso "estoque zerado — avise a supervisão".
- Para retirar um remédio do mapa: Portal de Cuidados > Residentes > ficha > aba Remédios > "Excluir do mapa".
- A exclusão exige um motivo (ex.: "suspenso pelo médico") e fica registrada com quem fez e quando. O registro não é apagado, só sai do mapa.

**4. Dose de emergência**
- Botão "Dose de emergência" no topo de Medicamentos.
- A pessoa escolhe o residente e a origem do remédio:
  - estoque do próprio residente;
  - estoque de emergência da instituição.
- Depois informa o remédio, a dose, a via e o motivo (obrigatório).
- Vale para uma única aplicação, não entra no mapa e desconta 1 unidade do estoque escolhido.
- Aparece no mapa do dia como "Emergência" no horário em que foi dada, e no histórico.

**5. Estoque de emergência da instituição**
- Supervisores no portal (e o gestor no painel) dão entrada, com lote e validade obrigatórios.
- Cada saída fica registrada: residente, quem deu, motivo, data e hora.
- Alertas no portal e no painel:
  - quantidade abaixo do mínimo;
  - validade vencendo em até 30 dias;
  - remédio vencido, que fica bloqueado para uso.
- Com mais de um lote, o sistema usa primeiro o que vence antes.
- Lista "Movimentações do estoque de emergência" para conferência (entradas e saídas), visível ao supervisor e ao gestor.

## Detalhes técnicos

**Banco (uma migração)**
- `prescricoes_medicamentos`: novas colunas `estoque_medicamento_id`, `excluida_em`, `excluida_por`, `motivo_exclusao`. Prescrições do portal sempre ligadas a um estoque do residente.
- `administracao_medicamentos`: novas colunas `tipo` (`rotina` | `emergencia`) e `motivo`.
- Usar `estoque_medicamentos.tipo_estoque` já existente (`residente` / `urgencia`) para o estoque de emergência; saídas e entradas registradas em `entrada_medicamentos` / `administracao_medicamentos`.
- RPCs SECURITY DEFINER, todas validando o passe do PIN + módulo `medicamentos` (e `portal_eh_supervisor()` para o estoque de emergência):
  - `portal_entrada_estoque_residente`
  - `portal_estoque_residente(p_residente_id)`
  - `portal_cadastrar_medicamento` (refeita: recebe `p_estoque_id`, recusa estoque de outro residente ou zerado)
  - `portal_excluir_do_mapa(p_prescricao_id, p_motivo)`
  - `portal_dose_emergencia(...)`: baixa por lote de validade mais próxima; recusa se vencido ou sem saldo
  - `portal_entrada_estoque_emergencia`
  - `portal_estoque_emergencia()` (com alertas)
- Remover a criação livre de remédio pela RPC atual.

**Frontend**
- `src/utils/mapaMedicamentos.ts`: tipo "emergencia" no mapa, selo "sem estoque", escolha de lote (FEFO); testes novos.
- `src/components/cuidados/`:
  - `EstoqueResidentePortal`
  - `CadastrarMedicamentoDialog` (refeito: lista o estoque)
  - `DoseEmergenciaDialog`
  - `EstoqueEmergenciaPortal`
- `AdministracaoMedicamentosPublico.tsx`: abas Mapa / Por residente / Estoque / Emergência (esta só para supervisores).
- `FichaCuidadoResidente.tsx`: aba Remédios com "Excluir do mapa" e motivo.
- O painel do gestor continua como está (já tem estoque de urgência). Ele passa a mostrar as exclusões e as doses de emergência no histórico.

**Testes:** regras puras (FEFO, vencido bloqueado, sem estoque mantém no mapa, emergência não repete no mapa) + teste por curl das RPCs com o PIN 9312.
