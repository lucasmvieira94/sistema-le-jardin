# Arquitetura do Sistema

## Visão Geral

O SENEXCARE utiliza arquitetura baseada em **Single Page Application (SPA)**.

A aplicação é composta por três camadas principais:

1. Interface de Usuário (Frontend)
2. Backend como Serviço
3. Banco de Dados

---

## Frontend

Tecnologias utilizadas:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn-ui

Responsabilidades:

- interface do usuário
- navegação
- validação de formulários
- comunicação com backend

---

## Backend

O backend é baseado em **Supabase**, que fornece:

- autenticação
- banco de dados
- API automática
- armazenamento de dados

---

## Banco de Dados

O banco de dados utiliza **PostgreSQL**, gerenciado pelo Supabase.

Responsabilidades:

- persistência de dados
- integridade das informações
- consultas e relatórios

---

## Fluxo da Aplicação

Usuário acessa sistema  
↓  
Autenticação  
↓  
Acesso aos módulos  
↓  
Registro de dados  
↓  
Armazenamento no banco  
↓  
Consulta e geração de relatórios
