-- Fase 2: conversaciones, mensajes y límite diario de mensajes

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null default 'free' check (mode in ('free', 'topic', 'roleplay')),
  topic text,                                   -- slug del tema (fase 4)
  level public.cefr_level not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  corrections jsonb not null default '[]'::jsonb,  -- correcciones del mensaje de la usuaria
  translation text,                                -- traducción guardada de la respuesta
  created_at timestamptz not null default clock_timestamp()  -- distinto en inserciones múltiples
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_user_idx on public.messages (user_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant update (translation) on public.messages to authenticated;  -- solo la traducción se puede editar

create policy conversations_own on public.conversations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy messages_select_own on public.messages
  for select to authenticated using ((select auth.uid()) = user_id);

create policy messages_insert_own on public.messages
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

create policy messages_update_own on public.messages
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- Contador diario (UTC). Aparte de messages para que borrar chats no reinicie el límite.
create table public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  messages int not null default 0,
  primary key (user_id, day)
);

alter table public.usage_daily enable row level security;
grant select on public.usage_daily to authenticated;

create policy usage_select_own on public.usage_daily
  for select to authenticated using ((select auth.uid()) = user_id);

-- Suma 1 al contador de hoy si no pasa del límite. Devuelve los mensajes restantes o -1.
-- security definer: la usuaria no puede escribir el contador directamente.
create function public.consume_message_quota(p_limit int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  used int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.usage_daily as u (user_id, day, messages)
  values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set messages = u.messages + 1
    where u.messages < p_limit
  returning messages into used;

  if used is null then
    return -1;
  end if;
  return greatest(p_limit - used, 0);
end;
$$;

revoke execute on function public.consume_message_quota(int) from public, anon;
grant execute on function public.consume_message_quota(int) to authenticated;
