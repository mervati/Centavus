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

-- Adição: duração de recorrência (execute no SQL Editor do Supabase)
alter table bills add column if not exists recurrence_count integer;
alter table bills add column if not exists recurrence_end_date date;

-- Integração contas x transações: ao pagar uma conta, cria transação automaticamente
alter table bills add column if not exists transaction_id uuid references transactions(id) on delete set null;

-- Assinaturas de push notification
create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);
alter table push_subscriptions enable row level security;
create policy "push_own" on push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rendimento CDI
alter table user_settings add column if not exists yield_type text default 'none' check (yield_type in ('mercado_pago', 'mercado_pago_meli', 'none'));
alter table user_settings add column if not exists yield_start_date date;
alter table user_settings add column if not exists yield_start_balance decimal(12,2) default 0;
alter table user_settings add column if not exists yield_start_savings decimal(12,2) default 0;
alter table user_settings add column if not exists last_yield_update date;

-- Cartões de crédito
create table if not exists credit_cards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  closing_day integer not null check (closing_day between 1 and 31),
  color text default '#6366f1',
  created_at timestamptz default now()
);
alter table credit_cards enable row level security;
create policy "credit_cards_own" on credit_cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Novas colunas em transactions para cartão de crédito e carteiras
alter table transactions drop constraint if exists transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('income','expense','savings_deposit','savings_withdrawal','cofrinho_income','cofrinho_expense','credit_expense'));
alter table transactions add column if not exists payment_method text default 'pix' check (payment_method in ('pix','credit'));
alter table transactions add column if not exists wallet text check (wallet in ('banco','cofrinho'));
alter table transactions add column if not exists card_id uuid references credit_cards(id) on delete set null;
alter table transactions add column if not exists installments integer default 1;
alter table transactions add column if not exists installment_number integer default 1;
alter table transactions add column if not exists bill_month date;
alter table transactions add column if not exists bill_paid boolean default false;
alter table transactions add column if not exists total_amount decimal(12,2);
alter table transactions add column if not exists bill_due_date date;

-- Integração Telegram
alter table user_settings add column if not exists telegram_chat_id text;
alter table user_settings add column if not exists telegram_notify_days integer default 3;
alter table user_settings add column if not exists telegram_notify_days_1 integer default 1;
alter table user_settings add column if not exists telegram_notify_days_2 integer;
alter table user_settings add column if not exists telegram_notify_hour integer default 8;
