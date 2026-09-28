// Supabase Edge Function: the Becoming AI coach.
// Deploy:  supabase functions deploy coach
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SYSTEM = `You are the coach inside "Becoming", a personal growth app. The user's loop is:
Vision → 90-day direction → weekly plan → daily action → evidence → reflection → adjustment → growth.
Their guiding line: "I am not trying to become a different person overnight. I am building evidence every day that I am becoming the person I said I would be."

Your roles: planner, reflection assistant, pattern identifier, accountability partner, progress summarizer, behavioral coach.

Boundaries:
- The user defines their values, identity, goals and direction. Never tell them who they are or what they should want, and never make major life decisions for them. When a choice is theirs, offer options or a question.
- Obstacles are observed behavioral patterns, never medical or psychological diagnoses. Do not use clinical language or suggest conditions. If something the user writes suggests they may be in crisis, gently suggest talking to someone they trust or a professional.
- Ground everything in the data provided. Cite concrete evidence (counts, dates, their own words). Don't invent facts.
- Be calm, direct and warm. No hype, no emojis, no exclamation marks, no generic motivational filler. Short sentences. Plain text only, no markdown headings.`;

const list = (desc: string) => ({ type: 'array', items: { type: 'string' }, description: desc });

const TASKS: Record<string, { instructions: string; schema?: Record<string, unknown> }> = {
  plan_outcome: {
    instructions: `Translate this 90-day outcome into a practical plan. Propose 3–6 milestones in order (concrete, checkable, spread across the 90 days), 2–4 weekly actions with a realistic times-per-week, 1–3 measurements worth tracking, and up to 2 clarifying questions if something important is ambiguous. Use the user's own language where possible.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['milestones', 'weeklyActions', 'measures', 'questions'],
      properties: {
        milestones: list('Ordered milestone titles'),
        weeklyActions: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['title', 'perWeek'],
            properties: { title: { type: 'string' }, perWeek: { type: 'integer' } },
          },
        },
        measures: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['name', 'unit'],
            properties: { name: { type: 'string' }, unit: { type: 'string' } },
          },
        },
        questions: list('Clarifying questions, may be empty'),
      },
    },
  },
  evening: {
    instructions: `The user just finished their evening review. In at most 90 words: reflect back one piece of evidence of who they are becoming from today, name (without judgment) any gap between what they committed to and what happened, and end with exactly one short question that helps them make tomorrow's change concrete.`,
  },
  weekly: {
    instructions: `Summarize the user's week for their weekly review. Be specific and brief.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'observations', 'questions', 'changeIdeas'],
      properties: {
        summary: { type: 'string', description: 'At most 80 words: what happened, grounded in counts and evidence.' },
        observations: list('2–4 observed patterns in behavior this week (not diagnoses)'),
        questions: list('2–3 reflection questions for the review'),
        changeIdeas: list('2–3 candidate "one change" options for next week, each a single concrete behavior. The user chooses.'),
      },
    },
  },
  patterns: {
    instructions: `Look at the user's logged obstacles and describe what you observe: when they tend to show up, what they coincide with, and whether anything is shifting. At most 110 words. Frame everything as observed behavior, never as traits or diagnoses. End with one small experiment they could try this week.`,
  },
  progress: {
    instructions: `Write a short progress note (at most 110 words) showing the evidence that the user's behavior is changing, using the counts provided. Point to one area where evidence is thin, without judgment. Don't grade them.`,
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Only signed-in users of this project can spend API credits.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Not signed in' }, 401);

  let task: string, context: unknown;
  try {
    ({ task, context } = await req.json());
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const spec = TASKS[task];
  if (!spec) return json({ error: `Unknown task: ${task}` }, 400);

  try {
    const params = {
      model: 'claude-opus-5',
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        ...(spec.schema ? { format: { type: 'json_schema', schema: spec.schema } } : {}),
      },
      system: `${SYSTEM}\n\nTask: ${spec.instructions}`,
      messages: [{ role: 'user', content: `Here is my data as JSON:\n${JSON.stringify(context)}` }],
    };
    // `fallbacks: "default"` is newer than the SDK's published types.
    const res = await anthropic.beta.messages.create(params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (res.stop_reason === 'refusal') return json({ error: 'The coach could not help with that one.' }, 422);
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    return json(spec.schema ? JSON.parse(text) : { text });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The coach is busy. Try again in a minute.' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'Coach API key is missing or invalid.' }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: `Coach error (${e.status})` }, 502);
    return json({ error: 'The coach is unavailable right now.' }, 500);
  }
});
