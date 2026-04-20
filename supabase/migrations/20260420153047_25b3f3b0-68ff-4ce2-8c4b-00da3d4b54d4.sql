
-- Tables
create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  platforms text[] default '{}',
  youtube_channel_id text,
  youtube_channel_url text,
  instagram_handle text,
  contact_email text,
  contact_person text,
  notes text,
  status text default 'active' check (status in ('active', 'paused', 'ended')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid references public.influencers(id) on delete cascade,
  campaign_name text,
  platform text not null check (platform in ('YouTube', 'Instagram', 'YB Shorts')),
  publish_date date,
  video_url text,
  video_id text,
  collaboration_type text check (collaboration_type in ('Barter', 'Paid')),
  campaign_cost decimal(10,2) default 0,
  utm_link text,
  managed_by text,
  views integer default 0,
  likes integer default 0,
  comments integer default 0,
  sessions integer default 0,
  engagement_rate decimal(5,2),
  purchase_revenue decimal(10,2) default 0,
  conversion_rate decimal(5,2),
  detected_automatically boolean default false,
  detection_source text,
  brand_mention_type text,
  last_stats_update timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  alert_type text not null,
  title text not null,
  message text,
  threshold_value decimal,
  actual_value decimal,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  metric text not null,
  condition text not null,
  threshold decimal not null,
  applies_to text default 'all',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.scan_log (
  id uuid primary key default gen_random_uuid(),
  scan_type text not null,
  status text not null,
  videos_found integer default 0,
  videos_new integer default 0,
  stats_updated integer default 0,
  error_message text,
  started_at timestamptz default now(),
  completed_at timestamptz
);

create table public.scan_settings (
  id uuid primary key default gen_random_uuid(),
  brand_keywords text[] default '{"REGALS", "regals", "Regals", "regals.cz", "www.regals.cz"}',
  scan_frequency_minutes integer default 60,
  platforms_to_scan text[] default '{"YouTube", "Instagram"}',
  auto_add_known_influencers boolean default false,
  stats_refresh_frequency_minutes integer default 360,
  youtube_api_key text,
  updated_at timestamptz default now()
);

insert into public.scan_settings (id) values (gen_random_uuid());

create table public.detected_videos (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid references public.influencers(id) on delete set null,
  platform text not null,
  video_id text not null unique,
  video_url text not null,
  video_title text,
  channel_name text,
  channel_id text,
  thumbnail_url text,
  mention_locations text[],
  views integer default 0,
  likes integer default 0,
  comments integer default 0,
  published_at timestamptz,
  status text default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.influencers enable row level security;
alter table public.campaigns enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_rules enable row level security;
alter table public.scan_log enable row level security;
alter table public.scan_settings enable row level security;
alter table public.detected_videos enable row level security;

-- Policies: allow all operations (single power-user app, no auth yet)
do $$
declare t text;
begin
  for t in select unnest(array['influencers','campaigns','alerts','alert_rules','scan_log','scan_settings','detected_videos'])
  loop
    execute format('create policy "Allow all select on %I" on public.%I for select using (true);', t, t);
    execute format('create policy "Allow all insert on %I" on public.%I for insert with check (true);', t, t);
    execute format('create policy "Allow all update on %I" on public.%I for update using (true) with check (true);', t, t);
    execute format('create policy "Allow all delete on %I" on public.%I for delete using (true);', t, t);
  end loop;
end $$;

-- Realtime
alter table public.alerts replica identity full;
alter table public.detected_videos replica identity full;
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.detected_videos;

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_influencers_updated before update on public.influencers
  for each row execute function public.set_updated_at();
create trigger trg_campaigns_updated before update on public.campaigns
  for each row execute function public.set_updated_at();
create trigger trg_scan_settings_updated before update on public.scan_settings
  for each row execute function public.set_updated_at();

-- Indexes
create index idx_campaigns_influencer on public.campaigns(influencer_id);
create index idx_influencers_country on public.influencers(country);
create index idx_detected_videos_status on public.detected_videos(status);
