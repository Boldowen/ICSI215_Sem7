-- Supabase → SQL Editor эсвэл psql дээр ажиллуулна (дахин ажиллуулахад аюулгүй).
-- Хэрэглэгч бүр (имэйл/нууц үгээр бүртгүүлсэн эсвэл Google-ээр нэвтэрсэн) public.users-д нэг мөртэй.
-- Нууц үг: Supabase Auth нь auth.users.encrypted_password баганад bcrypt hash хэлбэрээр хадгална.
-- Ил нууц үг хаана ч хадгалагдахгүй тул public.users-д нууц үгийн багана байхгүй.

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

alter table public.users
  add column if not exists last_name  text,   -- овог
  add column if not exists first_name text,   -- нэр
  add column if not exists provider   text;   -- анх бүртгүүлсэн арга: email | google

alter table public.users enable row level security;

-- Хэрэглэгч зөвхөн өөрийн мөрийг уншина. Бичих эрх шууд олгохгүй:
-- мөрийг зөвхөн доорх record_login() функц үүсгэж, шинэчилнэ.
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

-- Нэвтрэх бүрд дуудагдана. Өгөгдлийг Supabase Auth-ийн баталгаажуулсан
-- хэрэглэгчээс (auth.users) авдаг тул өөр хүний мөрийг бичих боломжгүй.
create or replace function public.record_login()
returns public.users
language sql
security definer
set search_path = ''
as $$
  insert into public.users (id, google_sub, email, name, picture, last_name, first_name, provider)
  select u.id,
         case when u.raw_user_meta_data ->> 'iss' like '%accounts.google.com%'
              then coalesce(u.raw_user_meta_data ->> 'sub', u.raw_user_meta_data ->> 'provider_id') end,
         u.email,
         n.full_name,
         coalesce(u.raw_user_meta_data ->> 'picture', u.raw_user_meta_data ->> 'avatar_url'),
         coalesce(u.raw_user_meta_data ->> 'last_name', u.raw_user_meta_data ->> 'family_name',
                  nullif(btrim(substr(n.full_name, length(split_part(n.full_name, ' ', 1)) + 1)), '')),
         coalesce(u.raw_user_meta_data ->> 'first_name', u.raw_user_meta_data ->> 'given_name',
                  nullif(split_part(n.full_name, ' ', 1), '')),
         u.raw_app_meta_data ->> 'provider'
  from auth.users u
  cross join lateral (
    select coalesce(
      u.raw_user_meta_data ->> 'name',
      u.raw_user_meta_data ->> 'full_name',
      nullif(btrim(concat_ws(' ', u.raw_user_meta_data ->> 'last_name', u.raw_user_meta_data ->> 'first_name')), '')
    ) as full_name
  ) n
  where u.id = auth.uid()
  on conflict (id) do update
    set google_sub    = coalesce(excluded.google_sub, public.users.google_sub),
        email         = excluded.email,
        name          = excluded.name,
        picture       = excluded.picture,
        last_name     = excluded.last_name,
        first_name    = excluded.first_name,
        last_login_at = now(),
        login_count   = public.users.login_count + 1
  returning *;
$$;

revoke all on function public.record_login() from public, anon;
grant execute on function public.record_login() to authenticated;
