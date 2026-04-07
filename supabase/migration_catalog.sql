-- ============================================================
-- True Star CRM — Service Catalog Migration
-- Run this in the Supabase SQL editor to add catalog tables.
-- ============================================================

-- ── Service Catalog Items ───────────────────────────────────
create table if not exists catalog_items (
  id                   text primary key,
  item_number          text not null default '',
  source               text not null default 'custom',
  trade                text not null default 'general',
  type                 text not null default 'materials',
  name                 text not null,
  description          text not null default '',
  unit                 text not null default 'ea',
  default_qty          numeric not null default 1,
  default_unit_cost    numeric not null default 0,
  default_hours        numeric not null default 0,
  labor_category       text,
  default_gm_pct       numeric not null default 0,
  default_overhead_pct numeric not null default 0,
  default_frequency    integer not null default 1,
  is_optional          boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists catalog_items_trade_idx  on catalog_items(trade);
create index if not exists catalog_items_source_idx on catalog_items(source);
create index if not exists catalog_items_name_idx   on catalog_items(name);

-- ── Service Catalog Templates ───────────────────────────────
create table if not exists catalog_templates (
  id           text primary key,
  name         text not null,
  description  text not null default '',
  billing_type text not null default 'fixed_price',
  sections     jsonb not null default '[]',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────
alter table catalog_items     enable row level security;
alter table catalog_templates enable row level security;

create policy "allow_all_catalog_items"
  on catalog_items for all using (true) with check (true);

create policy "allow_all_catalog_templates"
  on catalog_templates for all using (true) with check (true);
