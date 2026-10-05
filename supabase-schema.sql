-- ============================================================
-- نظام إدارة الجودة — مخطط قاعدة بيانات Supabase (Postgres)
-- نفّذي هذا الملف كاملاً مرة واحدة من Supabase SQL Editor.
-- الوصول للبيانات يتطلب إلزامياً تسجيل دخول عبر Supabase Auth
-- (لا يوجد تسجيل عام ذاتي داخل النظام — الحساب يُنشأ من لوحة Supabase فقط).
-- الجداول مطابقة تماماً لبنية البيانات المستخدمة في script.js
-- (employees / evaluations / activities / config) لتسهيل الربط.
-- ============================================================

-- جدول الموظفين
create table if not exists public.employees (
  id text primary key,
  name text not null,
  role text,
  active boolean not null default true,
  avatar_color text,
  updated_at timestamptz not null default now()
);

-- جدول التقييمات
create table if not exists public.evaluations (
  id text primary key,
  employee_id text not null references public.employees(id) on delete restrict,
  date date not null,
  calls integer not null default 0,
  quality numeric not null default 0,
  fcr numeric not null default 0,
  adherence numeric not null default 0,
  csat numeric not null default 0,
  complaints integer not null default 0,
  break_min numeric,
  note text,
  updated_at timestamptz not null default now()
);
create index if not exists evaluations_employee_idx on public.evaluations(employee_id);
create index if not exists evaluations_date_idx on public.evaluations(date);

-- سجل النشاط
create table if not exists public.activities (
  id text primary key,
  at timestamptz not null default now(),
  uid text,
  "user" text,
  action text not null,
  detail text
);

-- الإعدادات (سجل واحد فقط، id ثابت = 'default')
create table if not exists public.config (
  id text primary key default 'default',
  weights jsonb not null,
  targets jsonb not null,
  thresholds jsonb not null,
  breaks jsonb not null,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security — مفعّلة إلزامياً. لا قراءة ولا كتابة لأي
-- جدول إلا لطلب يحمل جلسة Supabase Auth صالحة (مستخدم مسجّل دخول).
-- مفتاح anon العام بمفرده لا يكفي للوصول إلى أي صف بعد الآن.
-- ============================================================
alter table public.employees enable row level security;
alter table public.evaluations enable row level security;
alter table public.activities enable row level security;
alter table public.config enable row level security;

drop policy if exists "allow all - employees" on public.employees;
drop policy if exists "authenticated only - employees" on public.employees;
create policy "authenticated only - employees" on public.employees for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "allow all - evaluations" on public.evaluations;
drop policy if exists "authenticated only - evaluations" on public.evaluations;
create policy "authenticated only - evaluations" on public.evaluations for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "allow all - activities" on public.activities;
drop policy if exists "authenticated only - activities" on public.activities;
create policy "authenticated only - activities" on public.activities for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "allow all - config" on public.config;
drop policy if exists "authenticated only - config" on public.config;
create policy "authenticated only - config" on public.config for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- صف إعدادات افتراضي (يُستخدم فقط إن كانت قاعدة البيانات فارغة)
insert into public.config (id, weights, targets, thresholds, breaks)
values (
  'default',
  '{"quality":40,"fcr":20,"adherence":20,"csat":20}',
  '{"quality":90,"fcr":85,"adherence":94,"csat":4.5}',
  '{"excellent":90,"needs":80}',
  '{"limit":60}'
)
on conflict (id) do nothing;
