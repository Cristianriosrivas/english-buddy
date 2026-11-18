-- Fase 5: lecciones y progreso (las lecciones están en supabase/seed.sql)

create table public.lessons (
  id text primary key check (id ~ '^[a-z0-9-]+$'),     -- slug, por ejemplo 'a1-to-be'
  level public.cefr_level not null,
  kind text not null default 'grammar' check (kind in ('grammar', 'vocabulary')),
  title text not null,                                  -- en español
  explanation text not null,                            -- explicación corta en español
  examples jsonb not null default '[]'::jsonb,          -- [{ "en": "...", "es": "..." }]
  exercises jsonb not null default '[]'::jsonb,         -- [{ "type": "fill" | "choice", ... }]
  writing_prompt text not null,                         -- consigna del ejercicio de escritura
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index lessons_level_order_idx on public.lessons (level, sort_order);

alter table public.lessons enable row level security;

-- Solo lectura para las usuarias (se editan desde el SQL Editor o el futuro panel de admin)
grant select on public.lessons to authenticated;

create policy lessons_select_all on public.lessons
  for select to authenticated using (true);

create table public.lesson_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id text not null references public.lessons (id) on update cascade on delete cascade,
  score int check (score between 0 and 100),             -- % de ejercicios correctos
  writing_score int check (writing_score between 1 and 10), -- nota de la IA a la escritura
  completed boolean generated always as (score is not null and writing_score is not null) stored,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

alter table public.lesson_progress enable row level security;

grant select, insert on public.lesson_progress to authenticated;
grant update (lesson_id, score, writing_score) on public.lesson_progress to authenticated;

create policy lesson_progress_select_own on public.lesson_progress
  for select to authenticated using ((select auth.uid()) = user_id);

create policy lesson_progress_insert_own on public.lesson_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy lesson_progress_update_own on public.lesson_progress
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger lesson_progress_touch_updated_at
  before update on public.lesson_progress
  for each row execute function public.touch_updated_at();
