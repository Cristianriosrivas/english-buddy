-- Fase 1: perfiles de usuaria
-- Ejecutar en Supabase > SQL Editor (o con `supabase db push`).

create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  level public.cefr_level,                          -- null hasta elegir nivel o hacer la prueba
  explanation_lang text not null default 'es',      -- idioma de las explicaciones (es primero)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Acceso desde la API (supabase-js); RLS decide qué filas ve cada una
grant select, update on public.profiles to authenticated;

-- Cada usuaria solo ve y edita su propio perfil
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Crear el perfil automáticamente al registrarse (toma el nombre del formulario)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'name'), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Solo la usa el trigger: nadie debe poder llamarla desde la API
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Mantener updated_at al día
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
