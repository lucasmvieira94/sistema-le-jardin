# Distrato de contrato de residente

## O que o usuário verá
Na lista de contratos do residente, novo item **"Cancelar contrato"** no menu de ações. Ele abre um formulário de distrato:

1. **Motivo da rescisão** (baseado na Cláusula Sexta do contrato):
   - **Rescisão por qualquer das partes com aviso prévio (Cl. 6)** — informa a data do distrato; o sistema soma 30 dias e mostra a data efetiva de encerramento e a mensalidade proporcional devida até lá.
   - **Rescisão sem cumprimento do aviso prévio (Cl. 6.1)** — encerramento na data informada; calcula a indenização de 1 mensalidade e indica qual parte paga (Contratante ou Contratada).
   - **Rescisão unilateral imediata (Cl. 6.2)** — escolher o inciso: I (atraso superior a 30 dias), II (descumprimento de cláusula) ou III (nova AGDI / mudança do grau de dependência). Encerramento imediato; nos casos I e II sem devolução da garantia (Cl. 2.10).
   - **Falecimento (Cl. 6.3)** — data do óbito; cobra o mês do falecimento integral.
   - **Durante o período de adaptação (10 dias)** — aplica a taxa de R$ 250/dia pelos dias utilizados, conforme regra já existente.
   - **Condição acordada entre as partes** — campo de texto livre para a condição, valor a pagar/devolver (opcional) e data de encerramento.
2. Campos comuns: data do distrato, observações, pendências financeiras em aberto (puxadas automaticamente das mensalidades não pagas, com opção de incluir ou não).
3. Prévia do cálculo antes de confirmar.

Ao confirmar, o distrato é gerado com os mesmos dados do contrato (partes, residente, número do contrato) e o contrato passa a **Encerrado** na data efetiva (fica "Ativo — em aviso prévio" até lá). O distrato aparece numa nova coluna/ícone na lista e abre na mesma janela dos contratos, com **Imprimir**, **Enviar para assinatura** e **Baixar PDF**, com certificado de autenticidade e rodapé SXCare.

## Etapas
1. Regras de cálculo em funções puras com testes (datas sempre no fuso de Brasília).
2. Registro do distrato no banco (somente administradores).
3. Formulário "Cancelar contrato" com prévia do cálculo.
4. Documento do distrato (mesmo padrão visual Times New Roman do contrato) reutilizando impressão, assinatura e PDF certificado.
5. Atualização do status do contrato e da lista.

## Detalhes técnicos
- Nova tabela `contratos_distratos`: contrato_id (FK), residente_id, tenant_id, numero_distrato, tipo_rescisao (`aviso_previo`, `sem_aviso`, `unilateral_I/II/III`, `falecimento`, `adaptacao`, `acordo`), parte_iniciadora, data_distrato, data_efetiva, valor_proporcional, valor_indenizacao, retem_garantia, condicao_livre, valores_pendentes jsonb, observacoes, status, created_by, timestamps. GRANT para authenticated/service_role, RLS só `eh_gestor`/admin do tenant.
- `src/utils/distratoContrato.ts`: `calcularDistrato(contrato, tipo, datas, opções)` → data efetiva (+30 dias em aviso prévio), proporcional por dias do mês, indenização = 1 mensalidade, garantia retida, taxa de adaptação. Testes em `src/utils/__tests__/distratoContrato.test.ts` (ex.: distrato em 17/10 → efetivo 16/11; sem aviso = 1 mensalidade; falecimento = mês integral; adaptação 4 dias = R$ 1.000).
- `useDistratos.ts`, `DistratoForm.tsx`, `DistratoPDFGenerator.tsx` (espelha `ContratoPDFGenerator`: `certificarPDF`, tipo de documento novo `distrato_residente` no enum `documento_tipo`, `EnviarParaAssinaturaButton`).
- `ContratosLista.tsx`: item "Cancelar contrato" (oculto em contratos já encerrados) e acesso ao distrato gerado.
- Dados da empresa reutilizam os mesmos usados no contrato.

## Pontos a confirmar
- Valores proporcionais calculados por dias corridos do mês (30/31). Se preferir outra base, ajustamos.
