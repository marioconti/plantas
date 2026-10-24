-- Fixes from the 2026-10-24 audit (docs/plantas/auditoria-2026-10-24.md, findings 5, 6 and 10).
--
-- HOW TO APPLY: supabase.com -> project `el-anotador` -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again. schema.sql already carries the same changes, so a fresh install needs only that.
--
-- 1. A guest or a visitor may take out only what they wrote, and only within a day (the undo).
--    Taking out anyone's entry needs a pass that can edit.
-- 2. An entry cannot be dated more than a year back.
-- 3. At most 10 new gardens a day, for everybody together: creating stays open, flooding does not.

alter table public.plants_events add column if not exists by_pass uuid; -- the pass that wrote it; null = a visitor

-- Same as before, plus the pass id, so the journal can tell whose entry is whose.
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
  return json_build_object('role', r, 'name', who, 'pass', ps.id);
end $$;

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
  if (select count(*) from plants_gardens where created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many gardens today' using errcode = '22023';
  end if;
  insert into plants_gardens (key, name) values (p_key, coalesce(nullif(left(trim(p_name), 40), ''), 'Mis plantas'))
  returning * into g;
  insert into plants_passes (garden, token_hash, name, role, created_by)
  values (p_key, plants_hash(tok), coalesce(nullif(left(trim(p_owner), 40), ''), 'Dueño'), 'owner', 'creación');
  return json_build_object('garden', row_to_json(g), 'pass', tok);
end $$;

create or replace function public.plants_log(
  p_key text, p_pass text, p_id uuid, p_plant text, p_type text, p_at timestamptz, p_note text, p_photo text
) returns public.plants_events
language plpgsql security definer set search_path = public as $$
declare
  me json := plants_auth(p_key, p_pass, 'log');
  r plants_events;
begin
  insert into plants_events (id, garden, plant, type, at, note, photo, by_name, by_pass)
  values (p_id, p_key, p_plant, p_type,
          greatest(least(coalesce(p_at, now()), now() + interval '5 minutes'), now() - interval '1 year'),
          left(coalesce(p_note, ''), 600), nullif(left(p_photo, 200), ''), me->>'name', (me->>'pass')::uuid)
  on conflict (id) do nothing;
  select * into r from plants_events where id = p_id and garden = p_key;
  return r;
end $$;

-- Undo, or taking an entry out of the journal. Owners and members take out anything; guests and
-- visitors only their own, written in the last day.
create or replace function public.plants_unlog(p_key text, p_pass text, p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me json := plants_auth(p_key, p_pass, 'log');
begin
  if me->>'role' in ('owner', 'member') then
    delete from plants_events where garden = p_key and id = p_id;
  else
    delete from plants_events
     where garden = p_key and id = p_id and created_at > now() - interval '1 day'
       and by_pass is not distinct from (me->>'pass')::uuid
       and (by_pass is not null or by_name = 'Visita');
  end if;
end $$;
