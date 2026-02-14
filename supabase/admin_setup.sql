-- AOA content platform (mid/long-term architecture)
-- Includes: draft/published workflow, revision rollback, edge-function write path, audit logs.
-- Run in Supabase SQL Editor.

alter table if exists public.profiles
  add column if not exists role text not null default 'member';

create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.site_content (
  key text primary key,
  payload_draft jsonb not null default '{}'::jsonb,
  payload_published jsonb,
  current_revision integer not null default 0,
  published_revision integer,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- Compatibility: migrate old payload column if it exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='site_content' AND column_name='payload'
  ) THEN
    EXECUTE 'update public.site_content set payload_draft = coalesce(payload_draft, payload), payload_published = coalesce(payload_published, payload) where payload is not null';
  END IF;
END $$;

create table if not exists public.site_content_public (
  key text primary key,
  payload jsonb not null,
  published_revision integer,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_content_revisions (
  id bigserial primary key,
  content_key text not null references public.site_content(key) on delete cascade,
  revision_no integer not null,
  action text not null,
  payload jsonb not null,
  note text,
  actor_id uuid references auth.users(id),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(content_key, revision_no)
);

create table if not exists public.content_audit_logs (
  id bigserial primary key,
  content_key text not null,
  action text not null,
  revision_no integer,
  actor_id uuid references auth.users(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.site_content enable row level security;
alter table public.site_content_public enable row level security;
alter table public.site_content_revisions enable row level security;
alter table public.content_audit_logs enable row level security;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='site_content' AND policyname='site_content_admin_select') THEN
    DROP POLICY site_content_admin_select ON public.site_content;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='site_content' AND policyname='site_content_admin_insert') THEN
    DROP POLICY site_content_admin_insert ON public.site_content;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='site_content' AND policyname='site_content_admin_update') THEN
    DROP POLICY site_content_admin_update ON public.site_content;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='site_content_public' AND policyname='site_content_public_read') THEN
    DROP POLICY site_content_public_read ON public.site_content_public;
  END IF;
END $$;

create policy site_content_admin_select
  on public.site_content
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy site_content_admin_insert
  on public.site_content
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy site_content_admin_update
  on public.site_content
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy site_content_public_read
  on public.site_content_public
  for select
  to anon, authenticated
  using (true);

insert into public.site_content (key, payload_draft, payload_published, current_revision, published_revision)
values (
  'homepage',
  jsonb_build_object(
    'site', jsonb_build_object(
      'name', '亞洲眼整形醫師聯盟培訓機構',
      'tagline', '國際眼整形醫學教育平台',
      'topline', '學術教育 · 醫師資格審核 · 合規管理'
    ),
    'hero', jsonb_build_object(
      'label', '國際級眼整形醫學教育平台',
      'title', '建立可信任的眼整形教育體系',
      'description', '面向全球整形外科與眼科醫師，提供修復手術培訓、臨床策略與標準化教學。',
      'primaryCta', '查看課程',
      'secondaryCta', '會員申請'
    ),
    'stats', jsonb_build_array(
      jsonb_build_object('value', '500+', 'label', '手術影片'),
      jsonb_build_object('value', '2000+', 'label', '註冊會員'),
      jsonb_build_object('value', '50歲以上', 'label', '臨床專家'),
      jsonb_build_object('value', '15年以上', 'label', '國際教學經驗')
    ),
    'events', jsonb_build_array(
      jsonb_build_object('date', '2026 / 03 / 15', 'title', '眼整形修復策略研討會（線上）'),
      jsonb_build_object('date', '2026 / 04 / 10', 'title', '高難度併發症處理專題'),
      jsonb_build_object('date', '2026 / 05 / 05', 'title', '國際專家手術觀摩直播')
    ),
    'faculty', jsonb_build_object(
      'name', '潘貳 博士',
      'role', '核心講師',
      'credential', '副主任醫師｜南方醫科大學整形外科學博士',
      'org', '廣州研媄薈醫療美容門診部'
    )
  ),
  jsonb_build_object(
    'site', jsonb_build_object(
      'name', '亞洲眼整形醫師聯盟培訓機構',
      'tagline', '國際眼整形醫學教育平台',
      'topline', '學術教育 · 醫師資格審核 · 合規管理'
    ),
    'hero', jsonb_build_object(
      'label', '國際級眼整形醫學教育平台',
      'title', '建立可信任的眼整形教育體系',
      'description', '面向全球整形外科與眼科醫師，提供修復手術培訓、臨床策略與標準化教學。',
      'primaryCta', '查看課程',
      'secondaryCta', '會員申請'
    ),
    'stats', jsonb_build_array(
      jsonb_build_object('value', '500+', 'label', '手術影片'),
      jsonb_build_object('value', '2000+', 'label', '註冊會員'),
      jsonb_build_object('value', '50歲以上', 'label', '臨床專家'),
      jsonb_build_object('value', '15年以上', 'label', '國際教學經驗')
    ),
    'events', jsonb_build_array(
      jsonb_build_object('date', '2026 / 03 / 15', 'title', '眼整形修復策略研討會（線上）'),
      jsonb_build_object('date', '2026 / 04 / 10', 'title', '高難度併發症處理專題'),
      jsonb_build_object('date', '2026 / 05 / 05', 'title', '國際專家手術觀摩直播')
    ),
    'faculty', jsonb_build_object(
      'name', '潘貳 博士',
      'role', '核心講師',
      'credential', '副主任醫師｜南方醫科大學整形外科學博士',
      'org', '廣州研媄薈醫療美容門診部'
    )
  ),
  1,
  1
)
on conflict (key) do nothing;

insert into public.site_content_public (key, payload, published_revision, published_at, updated_at)
select key, coalesce(payload_published, payload_draft), coalesce(published_revision, 1), published_at, now()
from public.site_content
where key = 'homepage'
on conflict (key) do update
set payload = excluded.payload,
    published_revision = excluded.published_revision,
    published_at = excluded.published_at,
    updated_at = now();

insert into public.site_content_revisions (content_key, revision_no, action, payload, note, meta)
select key, 1, 'bootstrap', coalesce(payload_published, payload_draft), 'Initial bootstrap revision', '{}'::jsonb
from public.site_content
where key = 'homepage'
  and not exists (
    select 1 from public.site_content_revisions r
    where r.content_key = public.site_content.key
      and r.revision_no = 1
  );

-- Set one email as admin (replace with your email).
-- insert into public.profiles (id, email, role)
-- select id, email, 'admin' from auth.users where email = 'you@example.com'
-- on conflict (id) do update set role = 'admin', email = excluded.email;
