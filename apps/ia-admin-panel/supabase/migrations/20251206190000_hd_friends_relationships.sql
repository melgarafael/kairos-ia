-- Human Design Friends & Relationships Tables
-- Allows users to store designs of other people and generate relationship charts

-- =============================================================================
-- HD Friends: Store designs of other people (friends, family, colleagues)
-- =============================================================================
create table if not exists public.hd_friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Basic info
  name text not null,
  relationship_type text, -- friend, family, partner, colleague, etc.
  notes text,
  -- Birth info (required for HD calculation)
  birth_date date not null,
  birth_time time not null,
  birth_location text,
  timezone text not null default 'America/Sao_Paulo',
  latitude text,
  longitude text,
  -- Human Design data (same structure as user profiles)
  tipo text,
  estrategia text,
  autoridade text,
  perfil text,
  cruz_incarnacao text,
  definicao text,
  assinatura text,
  tema_nao_self text,
  -- Advanced properties
  digestao text,
  sentido text,
  sentido_design text,
  motivacao text,
  perspectiva text,
  ambiente text,
  -- Arrays
  centros_definidos jsonb,
  centros_abertos jsonb,
  canais jsonb,
  portas jsonb,
  -- Complex data
  variaveis jsonb,
  planetas_personalidade jsonb,
  planetas_design jsonb,
  -- Dates from API
  data_nascimento_utc text,
  data_design_utc text,
  -- Chart visualization
  chart_url text,
  bodygraph_svg text,
  -- Raw API response
  raw_data jsonb,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_hd_friends_user_id on public.hd_friends(user_id);
create index if not exists idx_hd_friends_name on public.hd_friends(user_id, name);
create index if not exists idx_hd_friends_relationship_type on public.hd_friends(user_id, relationship_type);

-- RLS
alter table public.hd_friends enable row level security;

create policy "hd_friends_owner_all"
  on public.hd_friends
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "hd_friends_service_role_all"
  on public.hd_friends
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- =============================================================================
-- HD Relationships: Store relationship charts between user and friends
-- =============================================================================
create table if not exists public.hd_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references public.hd_friends(id) on delete cascade,
  -- Relationship Analysis Data
  composite_type text, -- The combined type of the relationship
  definition_type text, -- How the two designs connect
  -- Composite channels (formed when both have half of a channel)
  composite_channels jsonb,
  -- Electromagnetic connections (attractions)
  electromagnetic_connections jsonb,
  -- Dominance/compromise areas
  dominance_areas jsonb,
  compromise_areas jsonb,
  -- Key dynamics summary
  key_themes jsonb,
  -- Generated SVG for relationship chart
  relationship_svg text,
  -- Raw API response
  raw_data jsonb,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Unique constraint: one relationship per user-friend pair
  unique(user_id, friend_id)
);

-- Indexes
create index if not exists idx_hd_relationships_user_id on public.hd_relationships(user_id);
create index if not exists idx_hd_relationships_friend_id on public.hd_relationships(friend_id);

-- RLS
alter table public.hd_relationships enable row level security;

create policy "hd_relationships_owner_all"
  on public.hd_relationships
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "hd_relationships_service_role_all"
  on public.hd_relationships
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- =============================================================================
-- Comments
-- =============================================================================
comment on table public.hd_friends is 'Kairos IA: Human Design profiles for friends/family/contacts';
comment on table public.hd_relationships is 'Kairos IA: Relationship analysis between user and their friends';
comment on column public.hd_friends.relationship_type is 'Type of relationship: friend, family, partner, colleague, client, etc.';
comment on column public.hd_relationships.composite_channels is 'Channels formed by the combination of both designs';
comment on column public.hd_relationships.electromagnetic_connections is 'Attractions/connections between the two designs';

