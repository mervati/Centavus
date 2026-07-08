-- =============================================
-- PONTOAPP + PREÇO CERTO — Adicionar ao Centavus
-- Execute no SQL Editor do seu projeto Supabase
-- =============================================

-- ===== PONTOAPP =====

-- Tabela de usuários PontoAPP
create table if not exists ponto_users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text,
  created_at timestamptz default now()
);

-- Tabela de registros de ponto
create table if not exists pontos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references ponto_users(id) on delete cascade not null,
  tipo text not null check (tipo in ('entrada_trabalho', 'entrada_almoco', 'saida_almoco', 'saida_trabalho')),
  hora timestamptz not null,
  created_at timestamptz default now()
);

-- Habilitar RLS para PontoAPP
alter table ponto_users enable row level security;
alter table pontos enable row level security;

-- Políticas RLS para PontoAPP
create policy "ponto_users_own" on ponto_users for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "pontos_own" on pontos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Índices para PontoAPP
create index if not exists idx_pontos_user_id on pontos(user_id);
create index if not exists idx_pontos_created_at on pontos(created_at desc);
create index if not exists idx_pontos_user_data on pontos(user_id, created_at desc);

-- ===== PREÇO CERTO =====

-- Tabela de produtos
create table if not exists preco_products (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  barcode text,
  category text,
  created_at timestamptz default now()
);

-- Tabela de compras (lista de compras)
create table if not exists preco_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references preco_products(id) on delete set null,
  product_name text not null,
  quantity decimal(10,2) not null check (quantity > 0),
  unit_price decimal(12,2) not null check (unit_price > 0),
  store text,
  purchase_date date not null,
  nfe_key text,
  created_at timestamptz default now()
);

-- Tabela de items da NFC-e (recibos)
create table if not exists preco_nfe_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  nfe_key text not null,
  product_name text not null,
  quantity decimal(10,2) not null,
  unit_price decimal(12,2) not null,
  total_price decimal(12,2) not null,
  created_at timestamptz default now()
);

-- Tabela de histórico de preços
create table if not exists preco_price_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references preco_products(id) on delete set null,
  product_name text not null,
  price decimal(12,2) not null,
  store text,
  recorded_date date not null,
  created_at timestamptz default now()
);

-- Habilitar RLS para Preço Certo
alter table preco_products enable row level security;
alter table preco_purchases enable row level security;
alter table preco_nfe_items enable row level security;
alter table preco_price_history enable row level security;

-- Políticas RLS para Preço Certo
create policy "preco_products_own" on preco_products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "preco_purchases_own" on preco_purchases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "preco_nfe_items_own" on preco_nfe_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "preco_price_history_own" on preco_price_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Índices para Preço Certo
create index if not exists idx_preco_products_user on preco_products(user_id);
create index if not exists idx_preco_purchases_user_date on preco_purchases(user_id, purchase_date desc);
create index if not exists idx_preco_nfe_items_user on preco_nfe_items(user_id);
create index if not exists idx_preco_price_history_user on preco_price_history(user_id, product_id, recorded_date desc);
