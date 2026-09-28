// Supabase Edge Function: sends due reminder notifications. Called by pg_cron every 15 minutes.
// Deploy:  supabase functions deploy remind --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com), CRON_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

interface Prefs {
  morning: { on: boolean; time: string };
  evening: { on: boolean; time: string };
  weekly: { on: boolean; day: number; time: string };
}
interface Row {
  endpoint: string;
  user_id: string;
  subscription: webpush.PushSubscription;
  time_zone: string;
  prefs: Prefs;
  last_sent: Record<string, string>;
}

const WINDOW_MIN = 60; // send within an hour of the chosen time, never later

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** Local date, weekday and minutes-since-midnight in a time zone. */
function localNow(timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const inWindow = (now: number, time: string) => now >= toMinutes(time) && now < toMinutes(time) + WINDOW_MIN;

function mondayOf(date: string, weekday: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((weekday + 6) % 7));
  return d.toISOString().slice(0, 10);
}

async function record(userId: string, collection: string, id: string) {
  const { data } = await db.from('records').select('data').eq('user_id', userId).eq('collection', collection).eq('id', id).maybeSingle();
  return (data?.data ?? null) as Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('Forbidden', { status: 403 });

  const { data: rows, error } = await db.from('push_subscriptions').select('*');
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const row of rows as Row[]) {
    let now;
    try {
      now = localNow(row.time_zone);
    } catch {
      now = localNow('UTC');
    }
    const due: { kind: string; title: string; body: string; url: string }[] = [];
    const p = row.prefs;

    if (p.morning?.on && inWindow(now.minutes, p.morning.time) && row.last_sent.morning !== now.date) {
      const day = await record(row.user_id, 'days', now.date);
      if (!day?.morning) due.push({ kind: 'morning', title: 'Morning check-in', body: 'Five questions. What would make today successful?', url: '?open=morning' });
    }
    if (p.evening?.on && inWindow(now.minutes, p.evening.time) && row.last_sent.evening !== now.date) {
      const day = await record(row.user_id, 'days', now.date);
      if (!day?.evening) due.push({ kind: 'evening', title: 'Close the day', body: 'What went well? Where did you break your word?', url: '?open=evening' });
    }
    if (p.weekly?.on && now.weekday === p.weekly.day && inWindow(now.minutes, p.weekly.time) && row.last_sent.weekly !== now.date) {
      const week = await record(row.user_id, 'weeks', mondayOf(now.date, now.weekday));
      if (!week?.review) due.push({ kind: 'weekly', title: 'Weekly review', body: 'What is the one change that would make next week better?', url: '?open=weekly' });
    }

    for (const r of due) {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: r.kind }));
        row.last_sent[r.kind] = now.date;
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // The browser dropped this subscription; clean it up.
        if (status === 404 || status === 410) {
          await db.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
          break;
        }
      }
    }
    if (due.length) await db.from('push_subscriptions').update({ last_sent: row.last_sent }).eq('endpoint', row.endpoint);
  }
  return new Response(JSON.stringify({ checked: rows.length, sent }), { headers: { 'Content-Type': 'application/json' } });
});
