create schema if not exists package;
revoke all on schema package from public;
grant usage on schema package to authenticated, service_role;

create table package.box_projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  document jsonb not null,
  schema_version smallint not null default 1,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint box_projects_owner_key unique (id, user_id),
  constraint box_projects_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint box_projects_schema_version check (schema_version = 1 and document ->> 'schemaVersion' = '1'),
  constraint box_projects_document_size check (octet_length(document::text) <= 1048576),
  constraint box_projects_revision_positive check (revision > 0)
);

create table package.box_assets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  aspect_ratio double precision not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint box_assets_owner_key unique (id, user_id),
  constraint box_assets_file_name_length check (char_length(file_name) between 1 and 255),
  constraint box_assets_mime_type check (mime_type in ('image/png', 'image/svg+xml')),
  constraint box_assets_size check (byte_size between 1 and 10485760),
  constraint box_assets_aspect_ratio check (aspect_ratio > 0 and aspect_ratio <= 1000),
  constraint box_assets_status check (status in ('pending', 'ready'))
);

create table package.box_project_assets (
  project_id uuid not null,
  asset_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (project_id, asset_id),
  constraint box_project_assets_project_owner_fk
    foreign key (project_id, user_id) references package.box_projects(id, user_id) on delete cascade,
  constraint box_project_assets_asset_owner_fk
    foreign key (asset_id, user_id) references package.box_assets(id, user_id) on delete cascade
);

create index box_projects_user_updated_idx on package.box_projects (user_id, updated_at desc);
create index box_assets_user_status_idx on package.box_assets (user_id, status, created_at);
create index box_project_assets_asset_idx on package.box_project_assets (asset_id);

alter table package.box_projects enable row level security;
alter table package.box_assets enable row level security;
alter table package.box_project_assets enable row level security;

create policy "Users read their box projects"
on package.box_projects for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read their box assets"
on package.box_assets for select to authenticated
using ((select auth.uid()) = user_id and status = 'ready');

create policy "Users read their project asset links"
on package.box_project_assets for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on package.box_projects from anon, authenticated;
revoke all on package.box_assets from anon, authenticated;
revoke all on package.box_project_assets from anon, authenticated;
grant select on package.box_projects to authenticated;
grant select on package.box_assets to authenticated;
grant select on package.box_project_assets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('package-box-assets', 'package-box-assets', false, 10485760, array['image/png', 'image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Package users read only their box asset folder"
on storage.objects for select to authenticated
using (
  bucket_id = 'package-box-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function package.save_box_project(
  p_id uuid,
  p_name text,
  p_document jsonb,
  p_expected_revision bigint default null,
  p_asset_ids uuid[] default array[]::uuid[]
)
returns package.box_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_project package.box_projects;
  v_asset_ids uuid[];
  v_document_asset_ids uuid[];
  v_asset_count integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'INVALID_PROJECT_NAME' using errcode = '22023'; end if;
  if p_document ->> 'schemaVersion' <> '1' or octet_length(p_document::text) > 1048576 then
    raise exception 'INVALID_PROJECT_DOCUMENT' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  select coalesce(array_agg(distinct asset_id order by asset_id), array[]::uuid[])
  into v_asset_ids
  from unnest(coalesce(p_asset_ids, array[]::uuid[])) as u(asset_id);

  select coalesce(array_agg(distinct asset_id order by asset_id), array[]::uuid[])
  into v_document_asset_ids
  from (
    select (item #>> '{assetRef,assetId}')::uuid as asset_id
    from jsonb_array_elements(p_document #> '{design,artworkLayers}') as a(item)
    where item #>> '{assetRef,kind}' = 'user'
    union all
    select (item #>> '{assetRef,assetId}')::uuid as asset_id
    from jsonb_array_elements(p_document #> '{design,stamps}') as s(item)
    where item #>> '{assetRef,kind}' = 'user'
  ) document_assets;
  if v_document_asset_ids <> v_asset_ids then
    raise exception 'INVALID_PROJECT_ASSET_REFERENCES' using errcode = '22023';
  end if;

  select count(*) into v_asset_count
  from package.box_assets
  where user_id = v_user_id and status = 'ready' and id = any(v_asset_ids);
  if v_asset_count <> cardinality(v_asset_ids) then
    raise exception 'INVALID_PROJECT_ASSET' using errcode = '42501';
  end if;

  select * into v_project from package.box_projects where id = p_id and user_id = v_user_id for update;
  if not found then
    if exists (select 1 from package.box_projects where id = p_id) then
      raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
    end if;
    if (select count(*) from package.box_projects where user_id = v_user_id) >= 20 then
      raise exception 'PROJECT_LIMIT_REACHED' using errcode = 'P0001';
    end if;
    insert into package.box_projects (id, user_id, name, document)
    values (p_id, v_user_id, v_name, p_document)
    returning * into v_project;
  else
    if p_expected_revision is null or p_expected_revision <> v_project.revision then
      raise exception 'BOX_PROJECT_CONFLICT' using errcode = '40001';
    end if;
    update package.box_projects
    set name = v_name, document = p_document, revision = revision + 1, updated_at = now()
    where id = p_id and user_id = v_user_id
    returning * into v_project;
  end if;

  delete from package.box_project_assets
  where project_id = p_id and user_id = v_user_id and not (asset_id = any(v_asset_ids));

  insert into package.box_project_assets (project_id, asset_id, user_id)
  select p_id, asset_id, v_user_id from unnest(v_asset_ids) as u(asset_id)
  on conflict (project_id, asset_id) do nothing;

  return v_project;
end;
$$;

create or replace function package.rename_box_project(p_id uuid, p_name text, p_expected_revision bigint)
returns package.box_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_project package.box_projects;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'INVALID_PROJECT_NAME' using errcode = '22023'; end if;
  update package.box_projects
  set name = v_name, revision = revision + 1, updated_at = now()
  where id = p_id and user_id = v_user_id and revision = p_expected_revision
  returning * into v_project;
  if found then return v_project; end if;
  if exists (select 1 from package.box_projects where id = p_id and user_id = v_user_id) then
    raise exception 'BOX_PROJECT_CONFLICT' using errcode = '40001';
  end if;
  raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
end;
$$;

create or replace function package.duplicate_box_project(p_source_id uuid, p_name text)
returns package.box_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_source package.box_projects;
  v_copy package.box_projects;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'INVALID_PROJECT_NAME' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  if (select count(*) from package.box_projects where user_id = v_user_id) >= 20 then
    raise exception 'PROJECT_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  select * into strict v_source from package.box_projects where id = p_source_id and user_id = v_user_id;
  insert into package.box_projects (id, user_id, name, document)
  values (gen_random_uuid(), v_user_id, v_name, v_source.document)
  returning * into v_copy;
  insert into package.box_project_assets (project_id, asset_id, user_id)
  select v_copy.id, asset_id, v_user_id
  from package.box_project_assets where project_id = p_source_id and user_id = v_user_id;
  return v_copy;
exception when no_data_found then
  raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
end;
$$;

create or replace function package.delete_box_project(p_id uuid)
returns table (asset_id uuid, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  delete from package.box_projects where id = p_id and user_id = v_user_id;
  if not found then raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002'; end if;
  return query
  select a.id, a.storage_path
  from package.box_assets a
  where a.user_id = v_user_id
    and not exists (select 1 from package.box_project_assets pa where pa.asset_id = a.id);
end;
$$;

create or replace function package.reserve_box_asset_upload(
  p_user_id uuid,
  p_asset_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_byte_size bigint,
  p_aspect_ratio double precision
)
returns package.box_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset package.box_assets;
  v_total bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 1));
  select * into v_asset from package.box_assets where id = p_asset_id and user_id = p_user_id;
  if found then return v_asset; end if;
  select coalesce(sum(byte_size), 0) into v_total from package.box_assets where user_id = p_user_id;
  if v_total + p_byte_size > 104857600 then
    raise exception 'STORAGE_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  insert into package.box_assets (id, user_id, storage_path, file_name, mime_type, byte_size, aspect_ratio)
  values (p_asset_id, p_user_id, p_storage_path, p_file_name, p_mime_type, p_byte_size, p_aspect_ratio)
  returning * into v_asset;
  return v_asset;
end;
$$;

revoke all on function package.save_box_project(uuid, text, jsonb, bigint, uuid[]) from public;
revoke all on function package.rename_box_project(uuid, text, bigint) from public;
revoke all on function package.duplicate_box_project(uuid, text) from public;
revoke all on function package.delete_box_project(uuid) from public;
revoke all on function package.reserve_box_asset_upload(uuid, uuid, text, text, text, bigint, double precision) from public;
grant execute on function package.save_box_project(uuid, text, jsonb, bigint, uuid[]) to authenticated;
grant execute on function package.rename_box_project(uuid, text, bigint) to authenticated;
grant execute on function package.duplicate_box_project(uuid, text) to authenticated;
grant execute on function package.delete_box_project(uuid) to authenticated;
grant execute on function package.reserve_box_asset_upload(uuid, uuid, text, text, text, bigint, double precision) to service_role;
