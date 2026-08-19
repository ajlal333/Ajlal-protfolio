-- LogicFolds blog storage.
--
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: everything is idempotent.
--
-- Row Level Security is what makes it safe to ship the anon key in the browser
-- for the homepage's "latest posts" strip. Anonymous readers can only ever see
-- rows that are published and dated today or earlier. Drafts and future-dated
-- posts are invisible without the service role key, which stays server side.

create extension if not exists "pgcrypto";

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  excerpt     text not null,
  category    text not null,
  published   date not null,
  read_time   text not null,
  author      text not null default 'LogicFolds',
  standfirst  text not null,
  cta         text not null,
  takeaways   jsonb not null default '[]'::jsonb,
  sections    jsonb not null default '[]'::jsonb,
  sources     jsonb not null default '[]'::jsonb,
  image       text,
  image_alt   text,
  status      text not null default 'draft',
  updated     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint posts_status_check check (status in ('draft', 'published')),
  constraint posts_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- Mirrors scripts/validate-blog.mjs so bad content cannot reach the site even
  -- if it is written straight into the table by hand.
  constraint posts_title_length check (char_length(title) <= 70),
  constraint posts_excerpt_length check (char_length(excerpt) <= 165),
  constraint posts_takeaways_min check (jsonb_array_length(takeaways) >= 2),
  constraint posts_sections_min check (jsonb_array_length(sections) >= 3),
  constraint posts_sources_min check (jsonb_array_length(sources) >= 1),
  constraint posts_image_alt check (image is null or coalesce(image_alt, '') <> '')
);

create index if not exists posts_published_idx
  on public.posts (status, published desc);

-- Keep updated_at honest without relying on the writer to set it.
-- search_path is pinned empty so the function cannot be hijacked by objects in
-- a schema that happens to sit earlier in the caller's search path.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

alter table public.posts enable row level security;

drop policy if exists "published posts are world readable" on public.posts;
create policy "published posts are world readable"
  on public.posts
  for select
  to anon, authenticated
  using (status = 'published' and published <= current_date);

-- No insert/update/delete policies: writes require the service role key, which
-- bypasses RLS and is only ever used server side by the publishing job.
