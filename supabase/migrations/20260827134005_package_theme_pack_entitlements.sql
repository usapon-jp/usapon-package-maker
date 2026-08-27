create table package.theme_pack_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_pack_id text not null,
  source text not null default 'passphrase',
  unlocked_at timestamptz not null default now(),
  primary key (user_id, theme_pack_id),
  constraint theme_pack_entitlements_pack_length check (char_length(theme_pack_id) between 1 and 80),
  constraint theme_pack_entitlements_source check (source in ('passphrase', 'legacy-project', 'individual-code', 'admin'))
);

create table package.theme_pack_redemption_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_pack_id text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index theme_pack_attempts_user_time_idx
on package.theme_pack_redemption_attempts (user_id, theme_pack_id, attempted_at desc);

alter table package.theme_pack_entitlements enable row level security;
alter table package.theme_pack_redemption_attempts enable row level security;

create policy "Users read their theme pack entitlements"
on package.theme_pack_entitlements for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on package.theme_pack_entitlements from anon, authenticated;
revoke all on package.theme_pack_redemption_attempts from anon, authenticated;
grant select on package.theme_pack_entitlements to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('package-theme-pack-assets', 'package-theme-pack-assets', false, 10485760, array['image/png', 'image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Package entitled users read theme pack assets"
on storage.objects for select to authenticated
using (
  bucket_id = 'package-theme-pack-assets'
  and exists (
    select 1
    from package.theme_pack_entitlements entitlement
    where entitlement.user_id = (select auth.uid())
      and entitlement.theme_pack_id = (storage.foldername(name))[1]
  )
);

-- 公開期間中に秋スタンプを含む作品を保存した利用者は、その作品を壊さないよう自動移行する。
insert into package.theme_pack_entitlements (user_id, theme_pack_id, source)
select distinct user_id, 'autumn-letter-set', 'legacy-project'
from package.box_projects
where document::text like '%autumn-rabbit-%'
on conflict (user_id, theme_pack_id) do nothing;

create or replace function package.delete_package_cloud_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  delete from package.theme_pack_redemption_attempts where user_id = v_user_id;
  delete from package.theme_pack_entitlements where user_id = v_user_id;
  delete from package.box_projects where user_id = v_user_id;
  delete from package.box_assets where user_id = v_user_id;
end;
$$;

revoke all on function package.delete_package_cloud_data() from public;
grant execute on function package.delete_package_cloud_data() to authenticated;
