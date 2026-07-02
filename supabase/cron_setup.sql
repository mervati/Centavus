-- =============================================
-- CENTAVUS — Agendamento da Edge Function daily-yield
-- =============================================
-- Pré-requisitos (fazer no painel do Supabase):
--   1. Database > Extensions > habilitar "pg_cron"
--   2. Database > Extensions > habilitar "pg_net"
--   3. Deploy da Edge Function: supabase functions deploy daily-yield
--   4. Substituir <SERVICE_ROLE_KEY> abaixo pela sua chave
--      (Supabase > Settings > API > service_role key)
-- =============================================

select cron.schedule(
  'centavus-daily-yield',
  '0 3 * * 1-5',   -- 03:00 UTC = meia-noite BRT (UTC-3), segunda a sexta
  $$
  select net.http_post(
    url     := 'https://lyunxbgqodhbqrvdqmqz.supabase.co/functions/v1/daily-yield',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  ) as request_id;
  $$
);

-- Para verificar se o cron foi criado:
-- select * from cron.job;

-- Para remover o cron (se precisar recriar):
-- select cron.unschedule('centavus-daily-yield');

-- =============================================
-- Notificações Telegram — 08:00 BRT (11:00 UTC)
-- Pré-requisito: deploy das funções:
--   supabase functions deploy telegram-webhook
--   supabase functions deploy telegram-notify
-- Adicionar secret no Supabase:
--   supabase secrets set TELEGRAM_BOT_TOKEN=<TOKEN>
-- =============================================

-- Roda a cada hora; a Edge Function decide quem notificar com base no horário configurado
select cron.schedule(
  'centavus-telegram-notify',
  '0 * * * *',   -- a cada hora (a função filtra por horário do usuário)
  $$
  select net.http_post(
    url     := 'https://lyunxbgqodhbqrvdqmqz.supabase.co/functions/v1/telegram-notify',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  ) as request_id;
  $$
);

-- Para remover:
-- select cron.unschedule('centavus-telegram-notify');
