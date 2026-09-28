-- Run once in Supabase → SQL Editor AFTER deploying the `remind` function.
-- Calls it every 15 minutes. Replace the two placeholders first:
--   <project-ref>   from Project Settings → General
--   <cron-secret>   the same value you set with: supabase secrets set CRON_SECRET=...
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'becoming-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/remind',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<cron-secret>'),
    body := '{}'::jsonb
  );
  $$
);
