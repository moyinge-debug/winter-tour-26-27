create table if not exists public.tournament_state (
  id text primary key check (id = 'winter-tour-26-27'),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.tournament_state enable row level security;

grant select, insert, update on public.tournament_state to anon, authenticated;

drop policy if exists "Anyone can read the tournament" on public.tournament_state;
create policy "Anyone can read the tournament"
  on public.tournament_state for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can create the tournament" on public.tournament_state;
create policy "Anyone can create the tournament"
  on public.tournament_state for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can update the tournament" on public.tournament_state;
create policy "Anyone can update the tournament"
  on public.tournament_state for update
  to anon, authenticated
  using (true)
  with check (true);
