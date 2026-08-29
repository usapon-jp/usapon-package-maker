-- Package Maker UI Editor: admin-only drafts and atomic published/previous versions.
-- Administrator rows are enrolled separately by Auth UID. No email address is stored here.

create table if not exists package.ui_editor_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists package.ui_editor_configs (
  app_id text primary key check (app_id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  draft jsonb not null,
  published jsonb not null,
  previous jsonb,
  revision integer not null default 0 check (revision >= 0),
  published_revision integer not null default 0 check (published_revision >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint ui_editor_draft_shape check (jsonb_typeof(draft) = 'object' and draft @> '{"schemaVersion":1}'::jsonb and octet_length(draft::text) <= 262144),
  constraint ui_editor_published_shape check (jsonb_typeof(published) = 'object' and published @> '{"schemaVersion":1}'::jsonb and octet_length(published::text) <= 262144),
  constraint ui_editor_previous_shape check (previous is null or (jsonb_typeof(previous) = 'object' and previous @> '{"schemaVersion":1}'::jsonb and octet_length(previous::text) <= 262144))
);

alter table package.ui_editor_admins enable row level security;
alter table package.ui_editor_configs enable row level security;

revoke all on table package.ui_editor_admins from public, anon, authenticated;
revoke all on table package.ui_editor_configs from public, anon, authenticated;
grant all on table package.ui_editor_admins to service_role;
grant all on table package.ui_editor_configs to service_role;

create or replace function package.ui_editor_empty_config(p_app_id text)
returns jsonb
language sql
immutable
set search_path = pg_catalog, package
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'appId', p_app_id,
    'tokens', '{}'::jsonb,
    'components', '{}'::jsonb
  );
$$;

create or replace function package.ui_editor_is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, package
as $$
  select auth.uid() is not null
    and exists (select 1 from package.ui_editor_admins where user_id = auth.uid());
$$;

create or replace function package.get_ui_editor_state(p_app_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, package
as $$
declare
  v_row package.ui_editor_configs%rowtype;
begin
  if not package.ui_editor_is_admin() then
    raise exception 'UI editor administrator access required' using errcode = '42501';
  end if;

  insert into package.ui_editor_configs (app_id, draft, published, updated_by)
  values (p_app_id, package.ui_editor_empty_config(p_app_id), package.ui_editor_empty_config(p_app_id), auth.uid())
  on conflict (app_id) do nothing;

  select * into strict v_row from package.ui_editor_configs where app_id = p_app_id;
  return jsonb_build_object(
    'draft', v_row.draft,
    'published', v_row.published,
    'previous', v_row.previous,
    'revision', v_row.revision,
    'published_revision', v_row.published_revision,
    'updated_at', v_row.updated_at,
    'published_at', v_row.published_at
  );
end;
$$;

create or replace function package.save_ui_editor_draft(p_app_id text, p_payload jsonb, p_expected_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, package
as $$
declare
  v_row package.ui_editor_configs%rowtype;
begin
  if not package.ui_editor_is_admin() then
    raise exception 'UI editor administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
    or not (p_payload @> '{"schemaVersion":1}'::jsonb)
    or p_payload->>'appId' <> p_app_id
    or octet_length(p_payload::text) > 262144 then
    raise exception 'Invalid UI editor configuration' using errcode = '22023';
  end if;

  update package.ui_editor_configs
  set draft = p_payload,
      revision = revision + 1,
      updated_by = auth.uid(),
      updated_at = now()
  where app_id = p_app_id and revision = p_expected_revision
  returning * into v_row;
  if not found then
    raise exception 'UI editor configuration was updated on another device' using errcode = '40001';
  end if;
  return package.get_ui_editor_state(p_app_id);
end;
$$;

create or replace function package.publish_ui_editor_draft(p_app_id text, p_expected_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, package
as $$
declare
  v_row package.ui_editor_configs%rowtype;
begin
  if not package.ui_editor_is_admin() then
    raise exception 'UI editor administrator access required' using errcode = '42501';
  end if;
  update package.ui_editor_configs
  set previous = published,
      published = draft,
      published_revision = published_revision + 1,
      revision = revision + 1,
      updated_by = auth.uid(),
      published_by = auth.uid(),
      published_at = now(),
      updated_at = now()
  where app_id = p_app_id and revision = p_expected_revision
  returning * into v_row;
  if not found then
    raise exception 'UI editor configuration was updated on another device' using errcode = '40001';
  end if;
  return package.get_ui_editor_state(p_app_id);
end;
$$;

create or replace function package.rollback_ui_editor_published(p_app_id text, p_expected_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, package
as $$
declare
  v_row package.ui_editor_configs%rowtype;
begin
  if not package.ui_editor_is_admin() then
    raise exception 'UI editor administrator access required' using errcode = '42501';
  end if;
  update package.ui_editor_configs
  set draft = previous,
      published = previous,
      previous = published,
      published_revision = published_revision + 1,
      revision = revision + 1,
      updated_by = auth.uid(),
      published_by = auth.uid(),
      published_at = now(),
      updated_at = now()
  where app_id = p_app_id and revision = p_expected_revision and previous is not null
  returning * into v_row;
  if not found then
    raise exception 'No previous UI configuration is available, or it was updated on another device' using errcode = '40001';
  end if;
  return package.get_ui_editor_state(p_app_id);
end;
$$;

create or replace function package.get_published_ui_config(p_app_id text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, package
as $$
  select jsonb_build_object('payload', published, 'revision', published_revision)
  from package.ui_editor_configs
  where app_id = p_app_id;
$$;

revoke all on function package.ui_editor_empty_config(text) from public, anon, authenticated;
revoke all on function package.ui_editor_is_admin() from public, anon, authenticated;
revoke all on function package.get_ui_editor_state(text) from public, anon, authenticated;
revoke all on function package.save_ui_editor_draft(text, jsonb, integer) from public, anon, authenticated;
revoke all on function package.publish_ui_editor_draft(text, integer) from public, anon, authenticated;
revoke all on function package.rollback_ui_editor_published(text, integer) from public, anon, authenticated;
revoke all on function package.get_published_ui_config(text) from public, anon, authenticated;

grant execute on function package.ui_editor_is_admin() to authenticated, service_role;
grant execute on function package.get_ui_editor_state(text) to authenticated, service_role;
grant execute on function package.save_ui_editor_draft(text, jsonb, integer) to authenticated, service_role;
grant execute on function package.publish_ui_editor_draft(text, integer) to authenticated, service_role;
grant execute on function package.rollback_ui_editor_published(text, integer) to authenticated, service_role;
grant execute on function package.get_published_ui_config(text) to anon, authenticated, service_role;

comment on table package.ui_editor_admins is 'Server-side allowlist for the reusable UI Editor. Enroll by Auth UID only.';
comment on table package.ui_editor_configs is 'Draft, published, and previous UI-only configuration. No app data or business logic.';
