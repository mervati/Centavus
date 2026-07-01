# Centavus 💛

PWA de finanças pessoais com saldo, cofrinho, contas a pagar, transações recorrentes, notificações push e gráficos — construído com React + Vite + TailwindCSS + Supabase.

🌐 **Produção:** [centavus.vercel.app](https://centavus.vercel.app)

---

## Funcionalidades

- **Dashboard** — Saldo Total (banco + cofrinho), Saldo Banco, Cofrinho, contas próximas, transações recentes e projeção de fim do mês
- **Transações** — Receitas, despesas, depósitos e retiradas do cofrinho com filtro por mês, tipo e busca por descrição
- **Contas a pagar** — Com vencimento, recorrência, marcação de pago (gera transação automaticamente) e busca
- **Transações recorrentes** — Receitas e despesas fixas geradas automaticamente todo mês no dia configurado
- **Resumo mensal** — Gráfico de barras dos últimos 6 meses, pizza de despesas por categoria e pizza de receitas por categoria
- **Categorias** — Gerenciamento de categorias com ícone emoji e cor personalizada
- **Configurações** — Rebalanço de saldo (gera transação de ajuste), notificações push e dark mode
- **Dark Mode** — Tema escuro completo, persistido no dispositivo
- **Notificações Push** — Lembrete 1 dia antes do vencimento de contas via Web Push API
- **PWA** — Instalável na tela inicial do iPhone e Android, funciona offline

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite |
| Estilo | TailwindCSS |
| Roteamento | React Router v6 |
| Gráficos | Recharts |
| Ícones | Lucide React |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| Auth | Google OAuth + email/senha |
| Push | Web Push API + VAPID |
| Deploy | Vercel |

---

## Estrutura do Projeto

```
src/
├── components/
│   ├── BottomNav.jsx          # Navegação inferior
│   ├── BillForm.jsx           # Formulário de contas
│   ├── CategorySelect.jsx     # Dropdown customizado de categorias
│   ├── Layout.jsx             # Layout base com header e nav
│   ├── Modal.jsx              # Modal reutilizável
│   ├── RecurringForm.jsx      # Formulário de transações recorrentes
│   └── TransactionForm.jsx    # Formulário de transações
├── contexts/
│   ├── AuthContext.jsx        # Contexto de autenticação
│   └── ThemeContext.jsx       # Contexto de dark mode
├── hooks/
│   ├── usePushNotifications.js    # Subscribe/unsubscribe push
│   └── useRecurringTransactions.js # Geração automática de recorrentes
├── lib/
│   └── supabase.js            # Cliente Supabase
├── pages/
│   ├── Auth.jsx               # Login / cadastro
│   ├── Bills.jsx              # Contas a pagar
│   ├── Categories.jsx         # Categorias
│   ├── Dashboard.jsx          # Tela inicial
│   ├── Recurring.jsx          # Transações recorrentes
│   ├── Settings.jsx           # Configurações
│   ├── Summary.jsx            # Resumo / gráficos
│   └── Transactions.jsx       # Histórico de transações
├── utils/
│   └── format.js              # Formatação de moeda e data
└── sw.js                      # Service Worker (push notifications)
```

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz com:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
VITE_VAPID_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxx
```

> Veja `.env.example` para o template.

---

## Banco de Dados (Supabase)

Execute o arquivo `supabase/migrations.sql` no **SQL Editor** do Supabase para criar todas as tabelas.

### Tabelas

#### `user_settings`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID do usuário (auth.users) |
| initial_balance | numeric | Saldo banco inicial |
| savings_initial | numeric | Cofrinho inicial |

#### `categories`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| name | text | Nome da categoria |
| type | text | `income` ou `expense` |
| color | text | Cor hex |
| icon | text | Emoji |

#### `transactions`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| category_id | uuid | FK categories |
| amount | numeric | Valor |
| type | text | `income`, `expense`, `savings_deposit`, `savings_withdrawal` |
| description | text | Descrição |
| date | date | Data da transação |
| recurring_transaction_id | uuid | FK recurring_transactions (se gerada automaticamente) |

#### `bills`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| category_id | uuid | FK categories |
| description | text | Descrição |
| amount | numeric | Valor |
| due_date | date | Vencimento |
| paid | boolean | Se foi paga |
| paid_at | timestamptz | Quando foi paga |
| transaction_id | uuid | FK transactions (gerada ao pagar) |
| recurring | boolean | Se é recorrente |
| recurring_type | text | Tipo de recorrência |
| recurrence_count | integer | Quantidade de repetições |
| recurrence_end_date | date | Data fim da recorrência |

#### `recurring_transactions`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| description | text | Descrição |
| amount | numeric | Valor |
| type | text | `income` ou `expense` |
| category_id | uuid | FK categories |
| day_of_month | integer | Dia do mês (1–28) |
| active | boolean | Se está ativa |
| start_date | date | A partir de qual mês |
| end_date | date | Até qual mês (opcional) |

#### `push_subscriptions`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| endpoint | text | URL do push service |
| p256dh | text | Chave pública |
| auth | text | Chave de autenticação |

---

## Lógica de Saldo

Os saldos são sempre calculados dinamicamente (nunca armazenados):

```
Saldo Banco = initial_balance + SUM(income) - SUM(expense) - SUM(savings_deposit) + SUM(savings_withdrawal)

Cofrinho = savings_initial + SUM(savings_deposit) - SUM(savings_withdrawal)

Saldo Total = Saldo Banco + Cofrinho
```

### Rebalanço
Quando o saldo real diverge do calculado, o usuário pode fazer um rebalanço em **Configurações**. O app calcula a diferença e cria uma transação de ajuste chamada **"Re-balanço"** que aparece no histórico.

---

## Notificações Push

### Configuração das chaves VAPID

Gere um par de chaves VAPID:
```bash
npx web-push generate-vapid-keys
```

- A chave **pública** vai em `VITE_VAPID_PUBLIC_KEY` (`.env` local e variável de ambiente no Vercel)
- A chave **privada** vai como secret na Edge Function do Supabase: `VAPID_PRIVATE_KEY`
- Configure também: `VAPID_SUBJECT=mailto:seu@email.com`

### Edge Function

A função `supabase/functions/notify-bills/index.ts` é disparada diariamente pelo **pg_cron** às 8h e envia notificações push para contas que vencem no dia seguinte.

```sql
-- Habilitar pg_cron e agendar
SELECT cron.schedule('notify-bills-daily', '0 8 * * *', $$
  SELECT net.http_post(
    url := 'https://xxxx.supabase.co/functions/v1/notify-bills',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
  );
$$);
```

### Deploy da Edge Function
```bash
npx supabase login
npx supabase functions deploy notify-bills --project-ref xxxxxxxxxxxxxxxxxxxx
```

---

## Transações Recorrentes

Ao abrir o app, o hook `useRecurringTransactions` verifica automaticamente se há transações recorrentes que deveriam ter sido geradas (desde o mês de início até o mês atual) e cria as faltantes. Cada transação gerada fica vinculada ao template via `recurring_transaction_id`.

---

## Instalação Local

```bash
# Clone o repositório
git clone https://github.com/mervati/Centavus.git
cd Centavus

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas chaves do Supabase e VAPID

# Execute em desenvolvimento
npm run dev
```

Acesse `http://localhost:5173`

---

## Deploy no Vercel

1. Importe o repositório no [Vercel](https://vercel.com)
2. Configure o preset como **Vite**
3. Adicione as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_VAPID_PUBLIC_KEY`
4. Em **Supabase → Authentication → URL Configuration**, adicione `https://centavus.vercel.app/**` como Redirect URL
5. No **Google Cloud Console**, adicione `https://centavus.vercel.app` como origem autorizada

O `vercel.json` já está configurado para roteamento SPA:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

---

## Autenticação Google OAuth

1. Crie um projeto no [Google Cloud Console](https://console.cloud.google.com)
2. Habilite a API Google+ / OAuth 2.0
3. Configure as origens autorizadas e URIs de redirecionamento
4. Cole o Client ID e Secret em **Supabase → Authentication → Providers → Google**

---

## PWA

O app é uma PWA completa:
- Instalável na tela inicial (iOS e Android)
- Service Worker com estratégia `injectManifest`
- Ícone e splash screen configurados
- Funciona offline para dados em cache

---

## Licença

Projeto pessoal — uso livre.
