# Cargos e funções com módulos liberados por cargo

## Objetivo
Trocar o campo de texto livre "Função" por um cadastro de cargos. Cada cargo define quais módulos do portal do colaborador ficam disponíveis. Ao cadastrar um funcionário, o gestor escolhe o cargo e o funcionário recebe esses acessos automaticamente.

## O que o gestor verá
1. **Nova tela "Cargos e Funções"** (em Configurações ou no menu Funcionários):
   - Lista de cargos com nome, descrição, CBO (opcional), salário base sugerido, carga horária e situação (ativo/inativo).
   - Ao criar ou editar, uma lista de módulos com caixas de marcar, por exemplo: Registro de ponto, Prontuário, Medicamentos, Fraldas, Intercorrências, Temperatura, Vacinas, Painel do supervisor, Meus documentos, Contracheques, Folhas de ponto, Escala.
   - Já vem com cargos prontos (Cuidador(a), Técnico(a) de Enfermagem, Enfermeiro(a), Supervisor(a), Administrativo, Serviços Gerais, Cozinha), que podem ser editados.
   - Um cargo só pode ser apagado se não tiver funcionários. Caso tenha, pode ser inativado.
2. **Cadastro/edição de funcionário**:
   - "Função" vira uma lista de seleção com os cargos ativos, e mostra os módulos que o cargo libera.
   - Opção "Personalizar acessos deste funcionário" para liberar ou bloquear módulos só para essa pessoa, sem mudar o cargo.
   - A opção "Acesso de supervisor" passa a ser o módulo "Painel do supervisor".
3. **Portal do colaborador (PIN)**: só aparecem os módulos liberados. Quem tentar abrir um módulo bloqueado pelo link volta ao início.
4. **Lista de funcionários**: filtro por cargo.

## Migração dos dados atuais
- Para cada função digitada hoje, é criado um cargo com esse nome (as variações de maiúsculas e espaços são unificadas) e o funcionário é vinculado a ele.
- Os cargos criados assim começam com os módulos que já funcionam hoje, para que ninguém perca acesso. Quem já tem acesso de supervisor ganha esse módulo como exceção individual.
- O texto da função continua salvo para documentos antigos (contratos, advertências, ficha funcional).

## Detalhes técnicos
- Tabela `cargos` (tenant_id, nome único por empresa, descricao, cbo, salario_base, carga_horaria_semanal, modulos text[], ativo, timestamps), com GRANT e RLS: administradores da empresa gerenciam e usuários autenticados da mesma empresa leem.
- `funcionarios`: novas colunas `cargo_id` (FK) e `modulos_extras` / `modulos_bloqueados` text[]. `funcao` continua como texto, sincronizado com o nome do cargo por trigger.
- Catálogo fixo de módulos em `src/utils/modulosCargo.ts`, com ids estáveis. Ele inclui a função pura `modulosEfetivos(cargo, funcionario)`, testada com vitest (herança do cargo, extras, bloqueios, cargo inativo).
- RPC SECURITY DEFINER `modulos_funcionario(codigo)` para o portal PIN (que entra sem login), seguindo o padrão de acesso anônimo.
- `acesso_supervisor` é mantido em sincronia durante a transição, para não quebrar as telas atuais.
- O que for decidido sobre a estrutura será registrado no AGENTS.md.

## Fora do escopo (pode virar próximo passo)
- Permissões finas para gestores do painel administrativo (isso continua em Gestão de Permissões).
- Histórico de promoções e mudanças de cargo.
