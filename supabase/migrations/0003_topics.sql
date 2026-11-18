-- Fase 4: temas guiados (los datos están en supabase/seed.sql)

create table public.topics (
  id text primary key check (id ~ '^[a-z0-9-]+$'),   -- slug, por ejemplo 'travel'
  name text not null,                                 -- nombre en español
  description text not null,                          -- descripción en español
  min_level public.cefr_level not null default 'A1',  -- nivel mínimo para practicarlo
  emoji text not null default '💬',
  scenario text not null,                             -- instrucciones en inglés para la agente
  opener text not null,                               -- primer mensaje de la agente ({name} = nombre)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.topics enable row level security;

-- Las usuarias solo leen los temas; se crean y editan desde el SQL Editor (o el futuro panel de admin)
grant select on public.topics to authenticated;

create policy topics_select_all on public.topics
  for select to authenticated using (true);

-- Cada conversación guiada apunta a su tema
alter table public.conversations
  add constraint conversations_topic_fkey foreign key (topic)
  references public.topics (id) on update cascade on delete set null;

create index conversations_topic_idx on public.conversations (topic);
