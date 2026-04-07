-- ============================================================
-- True Star CRM — Supabase Schema
-- Run this in your Supabase SQL editor to set up the database.
-- ============================================================

-- ── Property Managers ──────────────────────────────────────
create table if not exists property_managers (
  id           text primary key,
  first_name   text not null,
  last_name    text not null,
  company_name text not null default '',
  email        text not null default '',
  phone        text not null default '',
  title        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Properties ─────────────────────────────────────────────
create table if not exists properties (
  id                  text primary key,
  name                text not null,
  address             text not null default '',
  property_manager_id text references property_managers(id) on delete set null,
  deal_stage          text not null default 'prospecting',
  value               numeric not null default 0,
  last_stage_change_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists properties_property_manager_id_idx on properties(property_manager_id);
create index if not exists properties_deal_stage_idx on properties(deal_stage);

-- ── Notes ──────────────────────────────────────────────────
create table if not exists notes (
  id                  text primary key,
  property_manager_id text not null references property_managers(id) on delete cascade,
  content             text not null,
  created_by          text not null default '',
  created_at          timestamptz not null default now()
);

create index if not exists notes_property_manager_id_idx on notes(property_manager_id);

-- ── Estimates ──────────────────────────────────────────────
create table if not exists estimates (
  id                   text primary key,
  proposal_number      text not null,
  property_id          text references properties(id) on delete set null,
  property_manager_id  text references property_managers(id) on delete set null,
  status               text not null default 'draft',
  contract_start_date  timestamptz,
  contract_end_date    timestamptz,
  services             jsonb not null default '[]',
  subtotal_fixed       numeric not null default 0,
  subtotal_optional    numeric not null default 0,
  annual_total         numeric not null default 0,
  sales_tax            numeric not null default 0,
  total_with_tax       numeric not null default 0,
  monthly_payment      numeric not null default 0,
  version              integer not null default 1,
  version_history      jsonb not null default '[]',
  approval_note        text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists estimates_property_id_idx on estimates(property_id);
create index if not exists estimates_status_idx on estimates(status);

-- ── Estimator Model (V6 spreadsheet state) ─────────────────
create table if not exists estimator_models (
  id         text primary key,
  model_data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ── Work Tickets ───────────────────────────────────────────
create table if not exists work_tickets (
  id               text primary key,
  estimate_id      text references estimates(id) on delete cascade,
  estimate_number  text not null default '',
  section_id       text not null default '',
  section_name     text not null default '',
  sequence_number  integer not null default 1,
  total_visits     integer not null default 1,
  property_id      text not null default '',
  property_name    text not null default '',
  property_address text not null default '',
  scope_of_work    text not null default '',
  work_description text not null default '',
  estimated_hours  numeric not null default 0,
  estimated_price  numeric not null default 0,
  crew_id          text,
  scheduled_date   date,
  status           text not null default 'unscheduled',
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists work_tickets_estimate_id_idx on work_tickets(estimate_id);
create index if not exists work_tickets_status_idx on work_tickets(status);

-- ── Crews ──────────────────────────────────────────────────
create table if not exists crews (
  id         text primary key,
  name       text not null,
  color      text not null default '#4A90D9',
  created_at timestamptz not null default now()
);

-- ── App Settings (single-row) ──────────────────────────────
create table if not exists app_settings (
  id       text primary key default 'singleton',
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ── Row Level Security (permissive for internal tool) ──────
alter table property_managers enable row level security;
alter table properties enable row level security;
alter table notes enable row level security;
alter table estimates enable row level security;
alter table estimator_models enable row level security;
alter table work_tickets enable row level security;
alter table crews enable row level security;
alter table app_settings enable row level security;

create policy "allow_all_property_managers" on property_managers for all using (true) with check (true);
create policy "allow_all_properties"        on properties        for all using (true) with check (true);
create policy "allow_all_notes"             on notes             for all using (true) with check (true);
create policy "allow_all_estimates"         on estimates         for all using (true) with check (true);
create policy "allow_all_estimator_models"  on estimator_models  for all using (true) with check (true);
create policy "allow_all_work_tickets"      on work_tickets      for all using (true) with check (true);
create policy "allow_all_crews"             on crews             for all using (true) with check (true);
create policy "allow_all_app_settings"      on app_settings      for all using (true) with check (true);

-- ── Seed Data ──────────────────────────────────────────────
insert into property_managers (id, first_name, last_name, company_name, email, phone, title, created_at) values
  ('pm-1','Avery','Chen','Northgate Holdings','avery.chen@northgate.com','(206) 555-0144','Regional Property Manager','2025-12-18T16:20:00.000Z'),
  ('pm-2','Jordan','Lee','Acme Property Group','jordan.lee@acme.com','(206) 555-0101','Senior Property Manager','2025-11-05T10:05:00.000Z'),
  ('pm-3','Taylor','Brooks','Harborview Health','taylor.brooks@harborview.org','(206) 555-0197','Facilities Director','2025-10-12T13:45:00.000Z'),
  ('pm-4','Morgan','Rivera','Pinecrest Commercial','morgan.rivera@pinecrest.com','(425) 555-0213','Portfolio Manager','2025-09-08T08:30:00.000Z'),
  ('pm-5','Casey','Nguyen','Union Station Ventures','casey.nguyen@usv.com','(206) 555-0158','Director of Operations','2025-08-22T11:15:00.000Z')
on conflict (id) do nothing;

insert into properties (id, name, address, property_manager_id, deal_stage, value) values
  ('prop-1','Northgate Campus','1200 Northgate Way, Seattle, WA','pm-1','prospecting',22000),
  ('prop-2','Northgate Plaza','881 Northgate Blvd, Seattle, WA','pm-1','proposal',34000),
  ('prop-3','Northgate Logistics Park','75 Meridian Ave N, Seattle, WA','pm-1','negotiation',41000),
  ('prop-16','Paloma Creek','1880 Paloma Creek Dr, Dallas, TX','pm-1','proposal',38000),
  ('prop-4','Riverside Plaza','1200 Riverside Dr, Seattle, WA','pm-2','prospecting',26000),
  ('prop-5','Cascade Business Center','455 Cascade Ave, Seattle, WA','pm-2','proposal',30000),
  ('prop-6','Harborview Medical','201 Harborview Ln, Seattle, WA','pm-3','negotiation',45000),
  ('prop-7','Harborview Annex','19 Denny Way, Seattle, WA','pm-3','won',38000),
  ('prop-8','Pinecrest Commerce Park','900 Pinecrest Rd, Bellevue, WA','pm-4','prospecting',19000),
  ('prop-9','Pinecrest West','615 Westlake Ave, Seattle, WA','pm-4','proposal',24000),
  ('prop-10','Pinecrest Heights','450 Hilltop Dr, Bellevue, WA','pm-4','negotiation',28000),
  ('prop-11','Pinecrest East','712 Eastlake Ave, Seattle, WA','pm-4','lost',17000),
  ('prop-12','Union Station Plaza','100 Union Station Sq, Seattle, WA','pm-5','won',50000),
  ('prop-13','Union Station South','225 Station Way, Seattle, WA','pm-5','proposal',32000),
  ('prop-14','Union Station East','311 Rail Ave, Seattle, WA','pm-5','prospecting',21000),
  ('prop-15','Union Station Annex','42 Rail Spur Rd, Seattle, WA','pm-5','negotiation',36000)
on conflict (id) do nothing;

insert into notes (id, property_manager_id, content, created_by, created_at) values
  ('note-1','pm-1','Completed site walk for Northgate Campus. Need irrigation map before final pricing.','Cameron Davis','2026-01-12T18:30:00.000Z'),
  ('note-2','pm-2','Riverside Plaza requested weekly bed edging add-on. Update proposal draft.','Jordan Price','2026-01-22T15:10:00.000Z'),
  ('note-3','pm-4','Pinecrest portfolio reviewing vendor list next Tuesday. Prepare references.','Sam Torres','2026-01-30T19:05:00.000Z')
on conflict (id) do nothing;

insert into estimates (id, proposal_number, property_id, property_manager_id, status, contract_start_date, contract_end_date, services, created_at, updated_at) values
  ('est-blank','EST-10420','prop-1','pm-1','draft','2026-03-01T00:00:00.000Z','2027-02-28T00:00:00.000Z','[]','2026-02-01T10:00:00.000Z','2026-02-01T10:00:00.000Z')
on conflict (id) do nothing;

insert into crews (id, name, color) values
  ('crew-1','Crew Alpha','#4A90D9'),
  ('crew-2','Crew Bravo','#D9534F')
on conflict (id) do nothing;
