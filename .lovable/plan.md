## Contexto

Hoje o botão "Desligar" na página `/funcionarios` apenas marca `ativo = false`. Não há registro do motivo (CLT), data efetiva, aviso prévio nem ajustes nos cálculos de folha de ponto, faltas e vale-transporte. Precisamos transformar isso em um processo formal de rescisão que reflita corretamente na contabilização.

## Estrutura da solução

### 1. Banco de dados (migration)

Novas colunas em `public.funcionarios`:

- `data_desligamento` (date)
- `motivo_desligamento` (text) — enum livre validado no app:
  - `pedido_demissao` (demissão a pedido)
  - `sem_justa_causa` (dispensa sem justa causa)
  - `com_justa_causa` (dispensa com justa causa)
  - `acordo_mutuo` (rescisão por acordo - Art. 484-A)
  - `termino_contrato` (término de contrato determinado/experiência)
  - `aposentadoria`
  - `falecimento`
- `aviso_previo` (boolean, default false)
- `tipo_aviso_previo` (text) — `trabalhado` | `indenizado` | `dispensado`
- `modalidade_reducao_aviso` (text, nullable) — só quando `tipo_aviso_previo='trabalhado'`:
  - `reducao_2h_entrada` (entra 2h depois)
  - `reducao_2h_saida` (sai 2h antes)
  - `reducao_7_dias_corridos` (folga 7 dias corridos ao final)
- `data_inicio_aviso` (date, nullable)
- `data_fim_aviso` (date, nullable)
- `observacoes_desligamento` (text, nullable)
- `desligado_por` (uuid, nullable) — auditoria

Nova tabela `public.desligamentos_historico` para auditoria (snapshot completo da rescisão), com RLS de admin.

### 2. Ajustes nos cálculos (DB functions)

- `gerar_folha_ponto_mensal` / `calcular_totais_folha_ponto`: ignorar dias **posteriores** a `data_desligamento` (não contar como falta).
- Durante o aviso prévio trabalhado com redução de 7 dias corridos: gerar abonos automáticos em `afastamentos` (tipo "Aviso Prévio - Redução 7 dias") para os 7 últimos dias.
- Para redução 2h entrada/saída: ajustar a escala efetiva do funcionário no período de aviso (campo informativo + observação em folha; o ponto real já reflete a redução porque o funcionário não bate o horário cheio — não gera falta de 2h).

### 3. Vale-transporte

`src/utils/valeTransporteCalculator.ts` — aceitar `dataDesligamento` e parar de contar dias após esta data. Atualizar `ModalValeTransporte` para passar o novo parâmetro.

### 4. UI

Novo componente `src/components/funcionarios/DesligamentoDialog.tsx`:

- Campos: data desligamento, motivo (Select CLT), switch aviso prévio, tipo aviso (radio), modalidade de redução (radio condicional), observações.
- Auto-cálculo `data_fim_aviso = data_inicio_aviso + 30 dias` (com indicação visual).
- Validações: data desligamento não pode ser anterior à admissão.
- Ao confirmar: registra na `desligamentos_historico`, atualiza `funcionarios`, e, se `reducao_7_dias_corridos`, cria os afastamentos automaticamente.

Substituir o botão atual de desligar em `src/pages/Funcionarios.tsx` por este Dialog. Adicionar coluna/badge mostrando motivo quando desligado e tooltip com data efetiva.

### 5. Ficha do funcionário

Em `src/pages/FichaFuncionario.tsx`, exibir bloco "Desligamento" com todos os dados quando aplicável.

## Detalhes técnicos

- Manter compatibilidade: `ativo = false` continua sendo a flag mestre. Funcionário com aviso trabalhado em curso permanece `ativo = true` até `data_desligamento`; o cron/edge não precisa mudar.
- Migration cria índice em `data_desligamento` para queries de relatório.
- Tipos TS gerados automaticamente após migration.

## Fora de escopo (proposta futura)

- Cálculo de verbas rescisórias (saldo de salário, férias proporcionais, 13º, multa FGTS) — sugiro tratar em módulo financeiro separado, pois envolve regras tributárias.
- Geração de TRCT (Termo de Rescisão) em PDF.

Confirma para eu seguir com a migration e a implementação?
