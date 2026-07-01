-- =============================================
-- MINHAS FINANÇAS — Supabase SQL Migrations
-- Execute no SQL Editor do seu projeto Supabase
-- =============================================

-- Configurações do usuário (1 por usuário)
create table if not exists user_settings (
  id uuid references auth.users primary key,
  name text,
  initial_balance decimal(12,2) default 0,
  savings_initial decimal(12,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Categorias
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text check (type in ('income', 'expense')) not null,
  color text default '#6366f1',
  icon text default '💰',
  created_at timestamptz default now()
);

-- Transações
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category_id uuid references categories(id) on delete set null,
  amount decimal(12,2) not null check (amount > 0),
  type text check (type in ('income', 'expense', 'savings_deposit', 'savings_withdrawal')) not null,
  description text not null,
  date date not null,
  created_at timestamptz default now()
);

-- Contas a pagar
create table if not exists bills (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category_id uuid references categories(id) on delete set null,
  description text not null,
  amount decimal(12,2) not null check (amount > 0),
  due_date date not null,
  paid boolean default false,
  paid_at timestamptz,
  recurring boolean default false,
  recurring_type text check (recurring_type in ('monthly', 'weekly', 'yearly')),
  created_at timestamptz default now()
);

-- Habilitar Row Level Security
alter table user_settings enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table bills enable row level security;

-- Políticas RLS: cada usuário só vê e altera seus próprios dados
create policy "settings_own" on user_settings for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "categories_own" on categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_own" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bills_own" on bills for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Índices para performance
create index if not exists idx_transactions_user_date on transactions(user_id, date desc);
create index if not exists idx_transactions_type on transactions(user_id, type);
create index if not exists idx_bills_user_due on bills(user_id, due_date);
create index if not exists idx_bills_paid on bills(user_id, paid);
create index if not exists idx_categories_user on categories(user_id, type);
