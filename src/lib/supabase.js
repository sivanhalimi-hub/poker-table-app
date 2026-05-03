import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/* =====================================================
   SUPABASE SQL - הרץ את זה ב-Supabase SQL Editor
   =====================================================

-- Tables
create table tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id),
  created_at timestamptz default now(),
  is_live boolean default false
);

create table players (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables(id) on delete cascade,
  name text not null,
  color text not null default '#e74c3c',
  avatar_url text,
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  date date not null default current_date,
  buy_in numeric default 0,
  cash_out numeric default 0,
  profit numeric generated always as (cash_out - buy_in) stored,
  hours numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables(id) on delete cascade,
  description text not null,
  amount numeric not null,
  paid_by uuid references players(id),
  date date default current_date,
  created_at timestamptz default now()
);

-- Enable RLS
alter table tables enable row level security;
alter table players enable row level security;
alter table sessions enable row level security;
alter table expenses enable row level security;

-- Policies: owner can edit, anyone can view
create policy "Anyone can view tables" on tables for select using (true);
create policy "Owner can insert tables" on tables for insert with check (auth.uid() = owner_id);
create policy "Owner can update tables" on tables for update using (auth.uid() = owner_id);
create policy "Owner can delete tables" on tables for delete using (auth.uid() = owner_id);

create policy "Anyone can view players" on players for select using (true);
create policy "Owner can manage players" on players for all using (
  auth.uid() = (select owner_id from tables where id = table_id)
);

create policy "Anyone can view sessions" on sessions for select using (true);
create policy "Owner can manage sessions" on sessions for all using (
  auth.uid() = (select owner_id from tables where id = table_id)
);

create policy "Anyone can view expenses" on expenses for select using (true);
create policy "Owner can manage expenses" on expenses for all using (
  auth.uid() = (select owner_id from tables where id = table_id)
);

-- Enable realtime
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table tables;

=====================================================*/
