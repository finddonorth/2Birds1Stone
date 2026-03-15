create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = excluded.public;

create table if not exists workspaces (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_memberships (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  title text not null,
  priority_rank integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists goals_workspace_title_idx on goals (workspace_id, title);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  title text not null,
  priority_rank integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists projects_workspace_title_idx on projects (workspace_id, title);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  title text not null,
  priority_rank integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists topics_workspace_title_idx on topics (workspace_id, title);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists tags_workspace_label_idx on tags (workspace_id, label);

create table if not exists workspace_settings (
  workspace_id text primary key references workspaces(id) on delete cascade,
  priority_guidance text not null default '',
  p1_label text not null default 'Today',
  p2_label text not null default 'End of Day',
  p3_label text not null default 'End of Week',
  p4_label text not null default 'Parking Lot',
  gentle_lock_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists inbox_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('idea', 'task')),
  status text not null default 'open' check (status in ('open', 'done', 'archived')),
  title text not null,
  notes text not null default '',
  tags text[] not null default '{}',
  relative_priority text not null check (relative_priority in ('p1', 'p2', 'p3', 'p4')),
  ordering_mode text not null default 'ai' check (ordering_mode in ('ai', 'manual')),
  manual_rank integer,
  ai_rank numeric,
  project_id uuid references projects(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  is_multi_day boolean not null default false,
  start_at timestamptz,
  due_at timestamptz,
  follow_up_contact jsonb,
  attachments jsonb not null default '[]'::jsonb,
  ai_summary jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notification_deliveries (
  reminder_id text not null,
  workspace_id text not null references workspaces(id) on delete cascade,
  item_id text not null,
  recipient_email text not null,
  scheduled_for timestamptz not null,
  reason text not null,
  sent_at timestamptz not null default now(),
  primary key (reminder_id, recipient_email)
);

alter table if exists inbox_items
  add column if not exists status text not null default 'open';

alter table if exists inbox_items
  add column if not exists follow_up_contact jsonb;

alter table if exists inbox_items
  add column if not exists attachments jsonb not null default '[]'::jsonb;

insert into workspaces (id, name)
values ('demo-workspace', '2Birds1Stone Demo')
on conflict (id) do nothing;

insert into workspace_settings (workspace_id, priority_guidance)
values (
  'demo-workspace',
  'Favor top-goal work, urgent commitments, and items that unblock momentum. Keep lower-value ideas visible but not distracting.'
)
on conflict (workspace_id) do nothing;
