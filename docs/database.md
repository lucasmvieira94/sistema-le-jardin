# Banco de Dados

## Visão Geral

O sistema utiliza PostgreSQL através do Supabase.

O modelo de dados foi projetado para suportar os principais processos administrativos da instituição.

---

## Principais Tabelas

### usuarios

Armazena informações dos usuários do sistema.

Campos principais:

- id
- nome
- cargo
- pin
- status

---

### funcionarios

Armazena informações da equipe institucional.

Campos principais:

- id
- nome
- cargo
- data_admissao

---

### registros_ponto

Registros de entrada e saída dos funcionários.

Campos principais:

- id
- funcionario_id
- tipo
- data_hora

---

### residentes

Armazena dados básicos dos residentes.

Campos principais:

- id
- nome
- data_nascimento
- observacoes

---

### feedback_sistema

Armazena respostas dos questionários de feedback.

Campos principais:

- id
- usuario_id
- respostas
- data_resposta
