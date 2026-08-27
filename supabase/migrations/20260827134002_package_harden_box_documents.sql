create or replace function package.is_box_document_v1(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
return
  jsonb_typeof(value) = 'object'
  and value -> 'schemaVersion' = '1'::jsonb
  and jsonb_typeof(value -> 'box') = 'object'
  and value #>> '{box,type}' in (
    'straight-tuck-carton-v1',
    'gift-box-v1',
    'n-style-gift-box-v1',
    'two-piece-gift-box-v1'
  )
  and jsonb_typeof(value #> '{box,widthMm}') = 'number'
  and jsonb_typeof(value #> '{box,depthMm}') = 'number'
  and jsonb_typeof(value #> '{box,heightMm}') = 'number'
  and jsonb_typeof(value #> '{box,paperThicknessMm}') = 'number'
  and jsonb_typeof(value #> '{box,glueFlapMm}') = 'number'
  and jsonb_typeof(value -> 'design') = 'object'
  and jsonb_typeof(value #> '{design,backgroundColors}') = 'object'
  and jsonb_typeof(value #> '{design,artworkLayers}') = 'array'
  and jsonb_typeof(value #> '{design,stamps}') = 'array'
  and jsonb_typeof(value #> '{design,texts}') = 'array'
  and jsonb_typeof(value #> '{design,lineColors}') = 'object'
  and jsonb_typeof(value #> '{design,includeCalibrationPage}') = 'boolean';

revoke all on function package.is_box_document_v1(jsonb) from public;

alter table package.box_projects
  add constraint box_projects_document_shape
  check (package.is_box_document_v1(document));

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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  delete from package.box_projects where id = p_id and user_id = v_user_id;
  if not found then raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002'; end if;
  return query
  select a.id, a.storage_path
  from package.box_assets a
  where a.user_id = v_user_id
    and not exists (select 1 from package.box_project_assets pa where pa.asset_id = a.id);
end;
$$;

revoke all on function package.delete_box_project(uuid) from public;
grant execute on function package.delete_box_project(uuid) to authenticated;
