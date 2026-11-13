-- Supabase → SQL Editor дээр нэг удаа ажиллуулна.
-- Google-ээр нэвтэрсэн хэрэглэгч бүрийг public.users хүснэгтэд хадгална.

create table if not exists public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  google_sub    text unique,
  email         text,
  name          text,
  picture       text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  login_count   integer     not null default 1
);

alter table public.users enable row level security;

-- Хэрэглэгч зөвхөн өөрийн мөрийг уншина. Бичих эрх шууд олгохгүй:
-- мөрийг зөвхөн доорх record_login() функц үүсгэж, шинэчилнэ.
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

-- Нэвтрэх бүрд дуудагдана. Өгөгдлийг browser-оос биш, Supabase-ийн
-- баталгаажуулсан Google ID token-оос (auth.users) авдаг тул хуурамчаар бичих боломжгүй.
create or replace function public.record_login()
returns public.users
language sql
security definer
set search_path = ''
as $$
  insert into public.users (id, google_sub, email, name, picture)
  select u.id,
         coalesce(u.raw_user_meta_data ->> 'sub', u.raw_user_meta_data ->> 'provider_id'),
         u.email,
         coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name'),
         coalesce(u.raw_user_meta_data ->> 'picture', u.raw_user_meta_data ->> 'avatar_url')
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do update
    set email         = excluded.email,
        name          = excluded.name,
        picture       = excluded.picture,
        last_login_at = now(),
        login_count   = public.users.login_count + 1
  returning *;
$$;

revoke all on function public.record_login() from public, anon;
grant execute on function public.record_login() to authenticated;
