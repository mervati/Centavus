-- =============================================
-- RESET: Remover e Recriar Tabelas
-- Execute no SQL Editor do seu projeto Supabase
-- =============================================

-- DROPA as tabelas antigas (se existirem)
DROP TABLE IF EXISTS pontos CASCADE;
DROP TABLE IF EXISTS ponto_users CASCADE;
DROP TABLE IF EXISTS preco_price_history CASCADE;
DROP TABLE IF EXISTS preco_nfe_items CASCADE;
DROP TABLE IF EXISTS preco_purchases CASCADE;
DROP TABLE IF EXISTS preco_products CASCADE;

-- ===== RECRIANDO PONTOAPP =====

-- Tabela de usuários PontoAPP
CREATE TABLE ponto_users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de registros de ponto
CREATE TABLE pontos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES ponto_users(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada_trabalho', 'entrada_almoco', 'saida_almoco', 'saida_trabalho')),
  hora TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS para PontoAPP
ALTER TABLE ponto_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para PontoAPP
CREATE POLICY "ponto_users_own" ON ponto_users FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "pontos_own" ON pontos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Índices para PontoAPP
CREATE INDEX idx_pontos_user_id ON pontos(user_id);
CREATE INDEX idx_pontos_created_at ON pontos(created_at DESC);
CREATE INDEX idx_pontos_user_data ON pontos(user_id, created_at DESC);

-- ===== RECRIANDO PREÇO CERTO =====

-- Tabela de produtos
CREATE TABLE preco_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de compras (lista de compras)
CREATE TABLE preco_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES preco_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price > 0),
  store TEXT,
  purchase_date DATE NOT NULL,
  nfe_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de items da NFC-e (recibos)
CREATE TABLE preco_nfe_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nfe_key TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de histórico de preços
CREATE TABLE preco_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES preco_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  store TEXT,
  recorded_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS para Preço Certo
ALTER TABLE preco_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE preco_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE preco_nfe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE preco_price_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para Preço Certo
CREATE POLICY "preco_products_own" ON preco_products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "preco_purchases_own" ON preco_purchases FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "preco_nfe_items_own" ON preco_nfe_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "preco_price_history_own" ON preco_price_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Índices para Preço Certo
CREATE INDEX idx_preco_products_user ON preco_products(user_id);
CREATE INDEX idx_preco_purchases_user_date ON preco_purchases(user_id, purchase_date DESC);
CREATE INDEX idx_preco_nfe_items_user ON preco_nfe_items(user_id);
CREATE INDEX idx_preco_price_history_user ON preco_price_history(user_id, product_id, recorded_date DESC);

-- ✅ CONCLUÍDO
-- Você pode agora usar PontoAPP, Preço Certo e Centavus no mesmo Supabase!
