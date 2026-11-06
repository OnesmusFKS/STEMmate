create extension if not exists pgcrypto;

create table if not exists public.categories (
  slug text primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.categories (slug, name) values
  ('science', 'Science'),
  ('technology', 'Technology'),
  ('engineering', 'Engineering'),
  ('mathematics', 'Mathematics'),
  ('integrated-stem', 'Integrated STEM')
on conflict (slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  avatar_url text,
  institution text,
  location text,
  role text not null default 'facilitator'
    check (role in ('facilitator', 'administrator')),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id text primary key,
  title text not null check (length(trim(title)) between 1 and 150),
  description text not null default '',
  category text not null references public.categories(slug),
  age_group text not null default '',
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  difficulty text not null default 'Beginner'
    check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  participants text not null default '',
  learning_objectives text[] not null default '{}',
  materials text[] not null default '{}',
  instructions text[] not null default '{}',
  safety_considerations text not null default '',
  expected_outcomes text[] not null default '{}',
  image_url text,
  created_by uuid references auth.users(id) on delete set null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create table if not exists public.downloaded_activities (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create table if not exists public.activity_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id) on delete cascade,
  status text not null default 'completed'
    check (status in ('not_started', 'in_progress', 'completed')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create table if not exists public.sync_metadata (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_synced_at timestamptz,
  pending_count integer not null default 0 check (pending_count >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.is_stemmate_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'administrator'
  );
$$;

create or replace function public.create_stemmate_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_stemmate_user_created on auth.users;
create trigger on_stemmate_user_created
  after insert on auth.users
  for each row execute procedure public.create_stemmate_profile();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    and not public.is_stemmate_admin() then
    raise exception 'Only administrators may change account roles';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists protect_stemmate_profile_role on public.profiles;
create trigger protect_stemmate_profile_role
  before update on public.profiles
  for each row execute procedure public.protect_profile_role();

create or replace function public.touch_stemmate_activity()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_stemmate_activity_updated_at on public.activities;
create trigger touch_stemmate_activity_updated_at
  before update on public.activities
  for each row execute procedure public.touch_stemmate_activity();

alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.favorites enable row level security;
alter table public.downloaded_activities enable row level security;
alter table public.activity_progress enable row level security;
alter table public.sync_metadata enable row level security;

drop policy if exists "Categories are readable" on public.categories;
create policy "Categories are readable"
  on public.categories for select to authenticated, anon using (true);
drop policy if exists "Administrators manage categories" on public.categories;
create policy "Administrators manage categories"
  on public.categories for all to authenticated
  using (public.is_stemmate_admin())
  with check (public.is_stemmate_admin());

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_stemmate_admin());
drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) or public.is_stemmate_admin());
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_stemmate_admin())
  with check (id = (select auth.uid()) or public.is_stemmate_admin());
drop policy if exists "Administrators delete profiles" on public.profiles;
create policy "Administrators delete profiles"
  on public.profiles for delete to authenticated
  using (public.is_stemmate_admin());

drop policy if exists "Read public or owned activities" on public.activities;
create policy "Read public or owned activities"
  on public.activities for select to authenticated, anon
  using (
    is_public
    or created_by = (select auth.uid())
    or public.is_stemmate_admin()
  );
drop policy if exists "Facilitators create private activities" on public.activities;
create policy "Facilitators create private activities"
  on public.activities for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (not is_public or public.is_stemmate_admin())
  );
drop policy if exists "Owners update activities" on public.activities;
create policy "Owners update activities"
  on public.activities for update to authenticated
  using (created_by = (select auth.uid()) or public.is_stemmate_admin())
  with check (
    (created_by = (select auth.uid()) and not is_public)
    or public.is_stemmate_admin()
  );
drop policy if exists "Owners delete activities" on public.activities;
create policy "Owners delete activities"
  on public.activities for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_stemmate_admin());

drop policy if exists "Users manage own favorites" on public.favorites;
create policy "Users manage own favorites"
  on public.favorites for all to authenticated
  using (user_id = (select auth.uid()) or public.is_stemmate_admin())
  with check (user_id = (select auth.uid()) or public.is_stemmate_admin());
drop policy if exists "Users manage own downloads" on public.downloaded_activities;
create policy "Users manage own downloads"
  on public.downloaded_activities for all to authenticated
  using (user_id = (select auth.uid()) or public.is_stemmate_admin())
  with check (user_id = (select auth.uid()) or public.is_stemmate_admin());
drop policy if exists "Users manage own progress" on public.activity_progress;
create policy "Users manage own progress"
  on public.activity_progress for all to authenticated
  using (user_id = (select auth.uid()) or public.is_stemmate_admin())
  with check (user_id = (select auth.uid()) or public.is_stemmate_admin());
drop policy if exists "Users manage own sync metadata" on public.sync_metadata;
create policy "Users manage own sync metadata"
  on public.sync_metadata for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into public.activities (
  id, title, description, category, age_group, duration_minutes,
  difficulty, participants, materials, instructions, image_url, is_public
) values
  ('1', 'Build a Bottle Rocket', 'Explore propulsion, pressure, and aerodynamics by designing and launching a water-powered rocket.', 'engineering', '8–12 years', 45, 'Beginner', 'Small groups', array['Empty 2L plastic bottle', 'Cardboard and tape', 'Cork and bicycle pump', 'Water and safety goggles'], array['Create fins from cardboard and tape them evenly around the bottle.', 'Decorate your rocket and add a lightweight paper nose cone.', 'Fill the bottle one-third with water, then securely fit the cork.', 'Take the rocket outside, connect the pump, stand back, and launch.'], 'https://images.unsplash.com/photo-1598389118600-9a83ceb4ebe6?auto=format&fit=crop&w=1200&q=85', true),
  ('2', 'Code a Tiny Maze', 'Turn directions into algorithms and guide a character through a handmade maze using block-based coding.', 'technology', '10–14 years', 60, 'Intermediate', 'Pairs or small groups', array['Laptop or tablet', 'Scratch account', 'Grid paper', 'Pencils and markers'], array['Sketch a simple maze on grid paper and mark a start and finish.', 'Recreate the maze as a backdrop in Scratch.', 'Use motion and sensing blocks to move a sprite through the maze.', 'Test, debug, and swap mazes with another team.'], 'https://images.unsplash.com/photo-1771765764892-91f2ed4ddbf4?auto=format&fit=crop&w=1200&q=85', true),
  ('3', 'Rainbow Density Lab', 'Layer colorful liquids to discover why different densities stack instead of mixing together.', 'science', '6–10 years', 30, 'Beginner', 'Small groups', array['Clear tall glass', 'Honey, oil, and water', 'Food coloring', 'Spoon or dropper'], array['Color the water and pour honey into the bottom of the glass.', 'Slowly add the colored water over the back of a spoon.', 'Pour oil on top and observe the three distinct layers.', 'Predict where small objects will settle, then test your ideas.'], 'https://images.unsplash.com/photo-1758685734034-54e1da4ac7c2?auto=format&fit=crop&w=1200&q=85', true),
  ('4', 'Marshmallow Towers', 'Work in teams to build the tallest free-standing structure while learning what makes a design stable.', 'engineering', '7–12 years', 40, 'Beginner', 'Teams', array['20 sticks of spaghetti', '1 metre of tape', '1 metre of string', 'One large marshmallow'], array['Divide materials evenly and discuss possible tower shapes.', 'Build a strong base before adding height.', 'Place the marshmallow at the very top of the structure.', 'Measure each tower and reflect on what made it stable.'], 'https://images.unsplash.com/photo-1770096679844-57ca92c2b64b?auto=format&fit=crop&w=1200&q=85', true),
  ('5', 'Maths in Motion', 'Measure movement, chart results, and use averages to compare how objects travel down a ramp.', 'mathematics', '9–13 years', 50, 'Intermediate', 'Small groups', array['Toy cars', 'Cardboard ramp', 'Tape measure', 'Stopwatch and worksheet'], array['Build a ramp and mark a clear starting line.', 'Predict which car will travel farthest and explain why.', 'Run three trials per car and record time and distance.', 'Calculate averages and make a bar chart of the results.'], 'https://images.unsplash.com/photo-1788882681164-dbb55962857d?auto=format&fit=crop&w=1200&q=85', true),
  ('6', 'Make a Scribble Bot', 'Build a simple vibrating robot that creates surprising geometric art as it travels across paper.', 'technology', '9–14 years', 75, 'Advanced', 'Small groups', array['Small hobby motor', 'Battery and tape', 'Paper cup', 'Three felt-tip markers'], array['Tape three markers evenly around the outside of the cup.', 'Attach the motor to the top and add an off-centre weight.', 'Connect the battery, place the bot on paper, and let it move.', 'Adjust the legs and weight to create different patterns.'], 'https://images.unsplash.com/photo-1680634658502-78e57b1eec50?auto=format&fit=crop&w=1200&q=85', true)
on conflict (id) do nothing;
