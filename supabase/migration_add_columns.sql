-- ============================================================
-- Migration: add missing columns
-- Run in Supabase dashboard → SQL Editor
-- ============================================================

-- Properties: sales rep assignment
alter table properties add column if not exists assigned_to text not null default '';

-- Estimates: opportunity grouping, follow-up workflow, job type
alter table estimates add column if not exists opportunity_id     text;
alter table estimates add column if not exists parent_estimate_id text;
alter table estimates add column if not exists follow_up_date     date;
alter table estimates add column if not exists sent_at            timestamptz;
alter table estimates add column if not exists job_type           text not null default 'maintenance_contract';

-- Work tickets: time tracking stored as JSON blobs
alter table work_tickets add column if not exists time_entries          jsonb not null default '[]';
alter table work_tickets add column if not exists active_time_entry_id  text;
alter table work_tickets add column if not exists active_lunch_start_at timestamptz;
