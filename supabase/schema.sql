-- Plantas (Regué): a care journal for the plants of one home.
--
-- HOW TO APPLY: supabase.com -> project `el-anotador` -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again: every statement replaces or guards what it creates.
--
-- THE SECURITY MODEL
-- Nobody logs in with an email. There are two secrets, and they do different jobs:
--
--   1. The GARDEN KEY (128 random bits) is in every link and on every NFC tag, after the "#",
--      so it never reaches GitHub Pages. It says WHICH garden. On its own it opens nothing
--      while the garden is private, because anyone who reads a tag at the door has it.
--   2. A PASS is a second random token that lives on one phone. It says WHO: "Mario", "Juan",
--      "Laura (cuida las plantas en enero)". The database keeps only its SHA-256, so a leaked
--      table does not leak passes. Each pass has a role and may expire:
--        owner   everything, including passes and the access switch
--        member  reads, logs, adds and edits plants
--        guest   reads and logs; cannot edit or delete
--
-- THE SWITCH. A garden is `private` (only passes get in) or `open` (anyone with a tag link can
-- read and log, as role `visitor`), optionally until a date, after which it closes by itself.
-- Private is the default. Open is for the week someone else waters the plants.
--
-- The tables are closed: row-level security is on and there is no policy, so the publishable
-- key the page carries cannot touch a row directly. Every way in is a function below, and every
-- one of them checks the key, the pass and the role first.
--
-- Same database as Súper and El Anotador (projects/super, projects/generala). Prefix `plants_`.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table if not exists public.plants_gardens (
  key         text        primary key check (char_length(key) between 20 and 64),
  name        text        not null default 'Mis plantas' check (char_length(name) between 1 and 40),
  -- Months that use each plant's cold-season watering interval. Buenos Aires: May to September.
  cold_months int[]       not null default '{5,6,7,8,9}',
  access      text        not null default 'private' check (access in ('private', 'open')),
  open_until  timestamptz,                             -- with access = open: closes by itself after this
  created_at  timestamptz not null default now()
);

create table if not exists public.plants_passes (
  id           uuid        primary key default gen_random_uuid(),
  garden       text        not null references public.plants_gardens (key) on delete cascade,
  token_hash   text        not null unique,             -- sha256 of the token, hex
  name         text        not null check (char_length(name) between 1 and 40),
  role         text        not null check (role in ('owner', 'member', 'guest')),
  expires_at   timestamptz,
  revoked      boolean     not null default false,
  created_by   text        not null default '',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists plants_passes_by_garden on public.plants_passes (garden);

create table if not exists public.plants_plants (
  garden       text        not null references public.plants_gardens (key) on delete cascade,
  id           text        not null check (id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name         text        not null check (char_length(name) between 1 and 40),
  species      text        check (char_length(species) <= 60),          -- catalog id, or null
  species_text text        not null default '' check (char_length(species_text) <= 60), -- when it is not in the catalog
  location     text        not null default '' check (char_length(location) <= 40),
  water_warm   int         check (water_warm between 1 and 120),        -- days between waterings, warm months; null = not tracked
  water_cold   int         check (water_cold between 1 and 120),        -- cold months; null = same as warm
  mist_days    int         check (mist_days between 1 and 30),          -- null = this plant is not misted
  feed_days    int         check (feed_days between 7 and 365),         -- null = not fertilised on a schedule
  notes        text        not null default '' check (char_length(notes) <= 800),
  photo        text        check (char_length(photo) <= 200),           -- storage path of the cover photo
  acquired_on  date,
  archived     boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (garden, id)
);

create table if not exists public.plants_events (
  id         uuid        primary key,                 -- made by the phone: a retried send lands once
  garden     text        not null,
  plant      text        not null,
  type       text        not null check (type in ('water', 'mist', 'feed', 'repot', 'prune', 'turn', 'treat', 'clean', 'note', 'photo')),
  at         timestamptz not null default now(),
  note       text        not null default '' check (char_length(note) <= 600),
  photo      text        check (char_length(photo) <= 200),
  by_name    text        not null default '',         -- the pass that wrote it: "Juan", "Visita"
  created_at timestamptz not null default now(),
  foreign key (garden, plant) references public.plants_plants (garden, id) on delete cascade
);

create index if not exists plants_events_by_plant on public.plants_events (garden, plant, type, at desc);
create index if not exists plants_events_by_day   on public.plants_events (garden, at desc);

alter table public.plants_gardens enable row level security;
alter table public.plants_passes  enable row level security;
alter table public.plants_plants  enable row level security;
alter table public.plants_events  enable row level security;
revoke all on public.plants_gardens, public.plants_passes, public.plants_plants, public.plants_events from anon, authenticated;

-- ---------------------------------------------------------------- the door

create or replace function public.plants_hash(p_token text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(digest(p_token, 'sha256'), 'hex')
$$;

create or replace function public.plants_new_token()
returns text language sql volatile set search_path = public, extensions as $$
  select translate(rtrim(encode(gen_random_bytes(24), 'base64'), '='), '+/', '-_')
$$;

-- Who is asking, and may they do this? Raises unless allowed. Returns {role, name}.
--   p_need: 'read' | 'log' | 'edit' | 'owner'
create or replace function public.plants_auth(p_key text, p_pass text, p_need text)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  g plants_gardens;
  ps plants_passes;
  r text;
  who text;
begin
  select * into g from plants_gardens where key = p_key;
  if not found then
    raise exception 'unknown garden' using errcode = '22023';
  end if;

  if p_pass is not null and p_pass <> '' then
    select * into ps from plants_passes
     where garden = p_key and token_hash = plants_hash(p_pass) and not revoked
       and (expires_at is null or expires_at > now());
  end if;

  if ps.id is not null then
    r := ps.role;
    who := ps.name;
    update plants_passes set last_used_at = now() where id = ps.id and (last_used_at is null or last_used_at < now() - interval '1 hour');
  elsif g.access = 'open' and (g.open_until is null or g.open_until > now()) then
    r := 'visitor';
    who := 'Visita';
  else
    raise exception 'private garden' using errcode = '42501';
  end if;

  if (p_need = 'edit' and r not in ('owner', 'member')) or (p_need = 'owner' and r <> 'owner') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return json_build_object('role', r, 'name', who);
end $$;

-- Used by the storage policy: a photo may only go under the folder of a real garden.
create or replace function public.plants_garden_exists(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from plants_gardens where key = p_key)
$$;

-- A cheap call for the keep-alive job.
create or replace function public.plants_ping()
returns timestamptz language sql stable security definer set search_path = public as $$
  select now()
$$;

-- ---------------------------------------------------------------- gardens

-- Creates a private garden and the first owner pass. Returns {garden, pass}: the pass token is
-- shown this once and never again.
create or replace function public.plants_create_garden(p_key text, p_name text, p_owner text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  g plants_gardens;
  tok text := plants_new_token();
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9_-]{20,64}$' then
    raise exception 'invalid garden key' using errcode = '22023';
  end if;
  insert into plants_gardens (key, name) values (p_key, coalesce(nullif(left(trim(p_name), 40), ''), 'Mis plantas'))
  returning * into g;
  insert into plants_passes (garden, token_hash, name, role, created_by)
  values (p_key, plants_hash(tok), coalesce(nullif(left(trim(p_owner), 40), ''), 'Dueño'), 'owner', 'creación');
  return json_build_object('garden', row_to_json(g), 'pass', tok);
end $$;

create or replace function public.plants_update_garden(p_key text, p_pass text, p_name text, p_cold_months int[])
returns public.plants_gardens
language plpgsql security definer set search_path = public as $$
declare g plants_gardens;
begin
  perform plants_auth(p_key, p_pass, 'owner');
  update plants_gardens set
    name = coalesce(nullif(left(trim(p_name), 40), ''), name),
    cold_months = coalesce((select array_agg(distinct m order by m) from unnest(p_cold_months) m where m between 1 and 12), cold_months)
  where key = p_key
  returning * into g;
  return g;
end $$;

-- The switch: 'private', or 'open' until p_until (null = until it is closed by hand).
create or replace function public.plants_set_access(p_key text, p_pass text, p_access text, p_until timestamptz)
returns public.plants_gardens
language plpgsql security definer set search_path = public as $$
declare g plants_gardens;
begin
  perform plants_auth(p_key, p_pass, 'owner');
  if p_access not in ('private', 'open') then
    raise exception 'invalid access' using errcode = '22023';
  end if;
  update plants_gardens set access = p_access, open_until = case when p_access = 'open' then p_until end
  where key = p_key
  returning * into g;
  return g;
end $$;

-- ---------------------------------------------------------------- passes

create or replace function public.plants_passes_list(p_key text, p_pass text)
returns json
language plpgsql security definer set search_path = public as $$
declare me_hash text := plants_hash(coalesce(p_pass, ''));
begin
  perform plants_auth(p_key, p_pass, 'owner');
  return coalesce((
    select json_agg(json_build_object(
      'id', id, 'name', name, 'role', role, 'expires_at', expires_at, 'revoked', revoked,
      'created_at', created_at, 'last_used_at', last_used_at, 'mine', token_hash = me_hash
    ) order by revoked, created_at)
    from plants_passes where garden = p_key
  ), '[]'::json);
end $$;

-- Makes a pass and returns its token, once. The link to hand over is #/g/<key>/pase/<token>.
create or replace function public.plants_create_pass(p_key text, p_pass text, p_name text, p_role text, p_expires timestamptz)
returns json
language plpgsql security definer set search_path = public as $$
declare
  me json := plants_auth(p_key, p_pass, 'owner');
  tok text := plants_new_token();
  new_id uuid;
begin
  if p_role not in ('owner', 'member', 'guest') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  insert into plants_passes (garden, token_hash, name, role, expires_at, created_by)
  values (p_key, plants_hash(tok), coalesce(nullif(left(trim(p_name), 40), ''), 'Sin nombre'), p_role, p_expires, me->>'name')
  returning id into new_id;
  return json_build_object('id', new_id, 'token', tok);
end $$;

-- Revokes a pass. The last owner pass cannot be revoked: the garden would have no way back in.
create or replace function public.plants_revoke_pass(p_key text, p_pass text, p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform plants_auth(p_key, p_pass, 'owner');
  if (select role from plants_passes where id = p_id and garden = p_key) = 'owner'
     and (select count(*) from plants_passes where garden = p_key and role = 'owner' and not revoked
            and (expires_at is null or expires_at > now())) <= 1 then
    raise exception 'last owner' using errcode = '22023';
  end if;
  update plants_passes set revoked = true where id = p_id and garden = p_key;
end $$;

-- ---------------------------------------------------------------- reads

-- Everything the page needs in one call:
--   me      who the pass says you are, and your role
--   garden  the garden row
--   plants  every plant, archived included (the page hides them)
--   events  every entry since p_since, plus the latest of each type per plant however old
--           (the due dates need it), plus every photo ever (the progress timeline)
create or replace function public.plants_load(p_key text, p_pass text, p_since timestamptz)
returns json
language plpgsql security definer set search_path = public as $$
declare
  me json := plants_auth(p_key, p_pass, 'read');
  result json;
begin
  select json_build_object(
    'me', me,
    'garden', (select row_to_json(g) from plants_gardens g where g.key = p_key),
    'plants', coalesce((select json_agg(p order by p.name) from plants_plants p where p.garden = p_key), '[]'::json),
    'events', coalesce((
      select json_agg(e order by e.at desc) from (
        (select * from plants_events where garden = p_key and at >= coalesce(p_since, now() - interval '400 days'))
        union
        (select distinct on (plant, type) * from plants_events where garden = p_key order by plant, type, at desc)
        union
        (select * from plants_events where garden = p_key and photo is not null)
      ) e
    ), '[]'::json)
  ) into result;
  return result;
end $$;

-- Older entries of one plant's journal, newest first, for "ver más".
create or replace function public.plants_history(p_key text, p_pass text, p_plant text, p_before timestamptz, p_limit int)
returns setof public.plants_events
language plpgsql security definer set search_path = public as $$
begin
  perform plants_auth(p_key, p_pass, 'read');
  return query
    select * from plants_events
    where garden = p_key and plant = p_plant and at < coalesce(p_before, now() + interval '1 day')
    order by at desc
    limit greatest(1, least(200, coalesce(p_limit, 50)));
end $$;

-- ---------------------------------------------------------------- plants

-- Creates or updates a plant. The id never changes: it is written on the tag.
create or replace function public.plants_save_plant(p_key text, p_pass text, p json)
returns public.plants_plants
language plpgsql security definer set search_path = public as $$
declare r plants_plants;
begin
  perform plants_auth(p_key, p_pass, 'edit');
  insert into plants_plants as x (garden, id, name, species, species_text, location, water_warm, water_cold,
                                  mist_days, feed_days, notes, photo, acquired_on, archived, updated_at)
  values (
    p_key,
    lower(p->>'id'),
    left(trim(p->>'name'), 40),
    nullif(left(p->>'species', 60), ''),
    left(coalesce(p->>'species_text', ''), 60),
    left(coalesce(p->>'location', ''), 40),
    (p->>'water_warm')::int,
    (p->>'water_cold')::int,
    (p->>'mist_days')::int,
    (p->>'feed_days')::int,
    left(coalesce(p->>'notes', ''), 800),
    nullif(left(p->>'photo', 200), ''),
    nullif(p->>'acquired_on', '')::date,
    coalesce((p->>'archived')::boolean, false),
    now()
  )
  on conflict (garden, id) do update set
    name = excluded.name, species = excluded.species, species_text = excluded.species_text,
    location = excluded.location, water_warm = excluded.water_warm, water_cold = excluded.water_cold,
    mist_days = excluded.mist_days, feed_days = excluded.feed_days, notes = excluded.notes,
    photo = excluded.photo, acquired_on = excluded.acquired_on, archived = excluded.archived,
    updated_at = now()
  returning * into r;
  return r;
end $$;

-- Removes a plant and its whole journal. Owners only; the page asks twice.
create or replace function public.plants_delete_plant(p_key text, p_pass text, p_plant text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform plants_auth(p_key, p_pass, 'owner');
  delete from plants_plants where garden = p_key and id = p_plant;
end $$;

-- ---------------------------------------------------------------- the journal

-- Writes one entry, signed with the pass's name. The id comes from the phone, so sending the
-- same entry twice keeps one.
create or replace function public.plants_log(
  p_key text, p_pass text, p_id uuid, p_plant text, p_type text, p_at timestamptz, p_note text, p_photo text
) returns public.plants_events
language plpgsql security definer set search_path = public as $$
declare
  me json := plants_auth(p_key, p_pass, 'log');
  r plants_events;
begin
  insert into plants_events (id, garden, plant, type, at, note, photo, by_name)
  values (p_id, p_key, p_plant, p_type, least(coalesce(p_at, now()), now() + interval '5 minutes'),
          left(coalesce(p_note, ''), 600), nullif(left(p_photo, 200), ''), me->>'name')
  on conflict (id) do nothing;
  select * into r from plants_events where id = p_id and garden = p_key;
  return r;
end $$;

-- Undo, or taking an entry out of the journal.
create or replace function public.plants_unlog(p_key text, p_pass text, p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform plants_auth(p_key, p_pass, 'log');
  delete from plants_events where garden = p_key and id = p_id;
end $$;

-- Only the functions the page calls are reachable with the publishable key.
revoke execute on function public.plants_auth(text, text, text), public.plants_hash(text), public.plants_new_token() from public, anon, authenticated;
grant execute on function
  public.plants_ping(), public.plants_create_garden(text, text, text),
  public.plants_update_garden(text, text, text, int[]), public.plants_set_access(text, text, text, timestamptz),
  public.plants_passes_list(text, text), public.plants_create_pass(text, text, text, text, timestamptz),
  public.plants_revoke_pass(text, text, uuid),
  public.plants_load(text, text, timestamptz), public.plants_history(text, text, text, timestamptz, int),
  public.plants_save_plant(text, text, json), public.plants_delete_plant(text, text, text),
  public.plants_log(text, text, uuid, text, text, timestamptz, text, text), public.plants_unlog(text, text, uuid)
to anon;

-- ---------------------------------------------------------------- photos

-- Public bucket: a photo is readable by whoever has its URL (a random name under the garden key).
-- Nobody can list the bucket, and a photo can only be uploaded under the folder of a real garden.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plants', 'plants', true, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/webp', 'image/jpeg'];

drop policy if exists "plants: upload into a garden" on storage.objects;
create policy "plants: upload into a garden" on storage.objects
  for insert to anon
  with check (bucket_id = 'plants' and public.plants_garden_exists((storage.foldername(name))[1]));

-- No delete policy: a replaced or removed photo stays in the bucket. Deleting would need a
-- select policy too, and that would let anyone list the bucket.
