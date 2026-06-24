create table projects (
  id text primary key,
  name text not null,
  order_date text not null,
  shop text not null check (shop in ('Café Amazon', 'พันธุ์ไทย คอฟฟี่')),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create unique index only_one_open_project on projects(status) where status = 'open';

create table orders (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  client_token text not null,
  customer_name text not null,
  details text not null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique (project_id, client_token)
);

create table menu_images (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  object_key text not null unique,
  content_type text not null,
  created_at text not null default (datetime('now'))
);

create table login_attempts (
  ip text primary key,
  attempts integer not null,
  reset_at integer not null
);
