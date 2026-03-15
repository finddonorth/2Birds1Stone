create table workspaces (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table goals (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  description text not null default '',
  priority_rank integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  priority_rank integer not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table topics (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  priority_rank integer not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tags (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  label text not null,
  color text,
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table inbox_items (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('idea', 'task')),
  title text not null,
  notes text not null default '',
  relative_priority text not null check (relative_priority in ('p1', 'p2', 'p3', 'p4')),
  ordering_mode text not null default 'ai' check (ordering_mode in ('ai', 'manual')),
  manual_rank integer,
  ai_rank numeric,
  status text not null default 'open' check (status in ('open', 'done', 'archived')),
  project_id uuid references projects(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  follow_up_contact_id uuid references contacts(id) on delete set null,
  is_multi_day boolean not null default false,
  start_at timestamptz,
  due_at timestamptz,
  ai_summary jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inbox_item_tags (
  inbox_item_id uuid not null references inbox_items(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (inbox_item_id, tag_id)
);

create table attachments (
  id uuid primary key,
  inbox_item_id uuid not null references inbox_items(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create table workspace_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  priority_guidance text not null default '',
  p1_label text not null default 'Today',
  p2_label text not null default 'End of Day',
  p3_label text not null default 'End of Week',
  p4_label text not null default 'Parking Lot',
  gentle_lock_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
