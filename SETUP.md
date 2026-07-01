# Minhas Finanças — Setup

## 1. Instalar Node.js
Baixe e instale em: https://nodejs.org (versão LTS)

## 2. Criar projeto no Supabase
1. Acesse https://supabase.com e crie uma conta gratuita
2. Crie um novo projeto
3. No menu lateral, vá em **SQL Editor**
4. Cole e execute o conteúdo do arquivo `supabase/migrations.sql`
5. Vá em **Project Settings > API** e copie:
   - **Project URL**
   - **anon public key**

## 3. Configurar variáveis de ambiente
```bash
# Na pasta do projeto, copie o arquivo de exemplo:
copy .env.example .env

# Edite o .env com os valores do Supabase:
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 4. Instalar dependências e rodar
```bash
cd financas-app
npm install
npm run dev
```

Abra http://localhost:5173 no navegador.

## 5. Instalar como PWA
No Chrome/Edge, clique no ícone de instalação na barra de endereço.
No celular, use "Adicionar à tela inicial" no menu do navegador.

## Estrutura das páginas
| Página | Rota | Descrição |
|--------|------|-----------|
| Dashboard | / | Visão geral: saldo, cofrinho, próximas contas |
| Transações | /transacoes | Histórico de entradas/saídas |
| Contas | /contas | Contas a pagar com vencimentos |
| Resumo | /resumo | Gráficos por mês e categoria |
| Categorias | /categorias | Gerenciar categorias |
| Configurações | ícone ⚙️ no dashboard | Saldos iniciais |
