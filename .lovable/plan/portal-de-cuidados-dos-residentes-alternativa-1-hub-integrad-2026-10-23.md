# Portal de Cuidados dos Residentes (Alternativa 1 — Hub Integrado)

## O que muda para a equipe
- Nova entrada **Portal de Cuidados** (`/cuidados`), com o mesmo PIN de 4 dígitos.
- Só quem tem cargo com o módulo **"Portal de Cuidados"** marcado entra (ex.: cuidadora, técnica de enfermagem, enfermeira, supervisora, gerente). Os demais recebem um aviso e voltam ao Meu RH.
- Tela única:
  - **Topo:** saudação, hora de Brasília, atalho "Meu RH" (ponto, escala, documentos).
  - **Rotina rápida:** Prontuário, Medicamentos, Fraldas, Temperatura, Vacinas, Intercorrências (as telas atuais, sem mudanças).
  - **Lista de residentes ativos:** busca por nome ou quarto.
- **Ficha do residente** (abre ao tocar no idoso), com abas:
  - Resumo e emergência: idade, quarto, condições médicas, alergias, observações, **nome e telefone do responsável** (botão de ligar).
  - Prontuários: histórico dos registros recentes.
  - Ficha de acolhimento: dados de saúde e hábitos (sem dados financeiros ou documentos do responsável).
  - Medicamentos e vacinas do residente.
- No portal do colaborador, os botões assistenciais são trocados por um único botão "Portal de Cuidados" (só para quem tem acesso). O Meu RH fica só com assuntos de RH.
- Em **Cargos e Funções**, o gestor marca/desmarca "Portal de Cuidados" por cargo; cargos assistenciais já vêm marcados.

## O que nunca aparece no portal
CPF, endereço e e-mail do responsável, contratos, distratos, mensalidades, faturas e valores.

## Detalhes técnicos
- `modulosCargo.ts` + `calcular_modulos_funcionario`: novo módulo `portal_cuidados`; migração marca o módulo nos cargos que hoje têm `prontuario`/`medicamentos`/`fraldas` (ninguém perde acesso). Módulos assistenciais antigos continuam valendo dentro do portal.
- RPCs SECURITY DEFINER exigindo `portal_funcionario_atual()` válido e o módulo `portal_cuidados`:
  - `portal_cuidados_residentes()` — lista ativos do tenant com campos assistenciais apenas.
  - `portal_cuidados_ficha(p_residente_id)` — resumo + emergência, últimos prontuários, campos de saúde da ficha de acolhimento (lista branca de campos), medicamentos e vacinas.
  - Nenhuma política `anon` nova em `residentes`/`fichas_acolhimento`; o acesso passa só pelas RPCs.
- Frontend: `src/pages/PortalCuidados.tsx`, `src/components/cuidados/FichaCuidadoResidente.tsx`, rota em `App.tsx`, ajuste dos atalhos em `FuncionarioAccess.tsx`; login reaproveita `CodigoFuncionarioInput` e `portalSessao.ts`.
- Rotas assistenciais existentes (`/prontuario`, `/administracao-medicamentos`, etc.) passam a checar o módulo, impedindo acesso por link direto sem permissão.
- Testes (vitest): regra de acesso ao portal por cargo/exceções e filtro de campos permitidos da ficha (garante que campos financeiros nunca saem).
- AGENTS.md: registrar a regra do portal de cuidados via RPCs com lista branca.
