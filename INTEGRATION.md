# 🔗 Integração Supabase: Centavus + PontoAPP + Preço Certo

Todos os 3 apps agora compartilham o **mesmo projeto Supabase**!

## 📊 Estrutura do Banco

```
PROJETO SUPABASE: lyunxbgqodhbqrvdqmqz
│
├─ Centavus (Finanças Pessoais)
│  ├── user_settings
│  ├── categories
│  ├── transactions
│  ├── bills
│  ├── push_subscriptions
│  ├── credit_cards
│  └── ...
│
├─ PontoAPP (Registro de Pontos)
│  ├── ponto_users
│  └── pontos
│
└─ Preço Certo (Lista de Compras)
   ├── preco_products
   ├── preco_purchases
   ├── preco_nfe_items
   └── preco_price_history
```

## 🔐 Isolamento de Dados

Cada tabela tem **Row Level Security (RLS)** habilitado, garantindo:
- ✅ Usuário só vê seus próprios dados
- ✅ Um app não consegue acessar dados do outro
- ✅ Dados completamente isolados por `user_id`

## 📝 Passos para Configurar

### 1️⃣ Adicionar as Tabelas ao Supabase

1. Acesse: https://app.supabase.com
2. Selecione o projeto `Centavus` (lyunxbgqodhbqrvdqmqz)
3. Vá para **SQL Editor**
4. Copie e execute o SQL do arquivo:
   ```
   D:\GitHub\Centavus\supabase\migrations_pontoapp_precocapixaba.sql
   ```

### 2️⃣ Verificar as Tabelas Criadas

Após executar o SQL, você verá:
- `ponto_users` e `pontos`
- `preco_products`, `preco_purchases`, `preco_nfe_items`, `preco_price_history`

### 3️⃣ Configurar os Apps

**PontoAPP** (já feito):
```env
# D:\GitHub\PontoAPP\.env.local
VITE_SUPABASE_URL=https://lyunxbgqodhbqrvdqmqz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_l8QAPbi-ioY-gAdsofDs4A_HuQOqIwe
```

**PrecoCapixaba** (se ainda não tiver):
```env
# D:\GitHub\PrecoCapixaba\.env.local
VITE_SUPABASE_URL=https://lyunxbgqodhbqrvdqmqz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_l8QAPbi-ioY-gAdsofDs4A_HuQOqIwe
```

**Centavus** (já tem):
```env
# D:\GitHub\Centavus\.env
VITE_SUPABASE_URL=https://lyunxbgqodhbqrvdqmqz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_l8QAPbi-ioY-gAdsofDs4A_HuQOqIwe
```

## 💰 Benefícios

| Benefício | Descrição |
|-----------|-----------|
| 💰 **Mais Barato** | 1 plano ao invés de 3 |
| 🔒 **Mais Seguro** | RLS garante isolamento |
| 🔌 **Fácil Integração** | Potencial para combinar dados no futuro |
| 📊 **Um Backup** | Backup centralizado de todos os dados |
| 🚀 **Melhor Performance** | Conexão única para todos |

## ⚠️ Regras Importantes

1. **Nunca remova a coluna `user_id`** das tabelas
2. **RLS está sempre ativo** — um usuário nunca vê dados de outro
3. **Cada app usa seu prefixo**:
   - `ponto_*` → PontoAPP
   - `preco_*` → Preço Certo
   - Sem prefixo → Centavus

## 🔄 Futuros Cruzamentos (Opcional)

Agora que os dados estão integrados, é possível:
- Sincronizar despesas do PrecoCapixaba com Centavus
- Criar relatórios combinados de gastos + horas trabalhadas
- Integrar alertas de ponto com notificações de gastos

Exemplo de query cruzada (respeitando RLS):
```sql
-- Gastos do dia que trabalhou
SELECT 
  DATE(preco.created_at) as data,
  SUM(preco.unit_price * preco.quantity) as gasto_dia,
  COUNT(ponto.id) as pontos_registrados
FROM preco_purchases preco
LEFT JOIN pontos ponto ON DATE(preco.created_at) = DATE(ponto.created_at)
WHERE preco.user_id = auth.uid()
  AND ponto.user_id = auth.uid()
GROUP BY DATE(preco.created_at)
```

## 📞 Suporte

Se precisar resetar tudo:
1. Delete as novas tabelas
2. Execute o SQL novamente
3. Reload os apps

Dúvidas? Consulte a documentação do Supabase: https://supabase.com/docs
