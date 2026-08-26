create table public.theme_pack_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_pack_id text not null,
  source text not null default 'passphrase',
  unlocked_at timestamptz not null default now(),
  primary key (user_id, theme_pack_id),
  constraint theme_pack_entitlements_pack_length check (char_length(theme_pack_id) between 1 and 80),
  constraint theme_pack_entitlements_source check (source in ('passphrase', 'legacy-project', 'individual-code', 'admin'))
);

create table public.theme_pack_redemption_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_pack_id text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index theme_pack_attempts_user_time_idx
on public.theme_pack_redemption_attempts (user_id, theme_pack_id, attempted_at desc);

alter table public.theme_pack_entitlements enable row level security;
alter table public.theme_pack_redemption_attempts enable row level security;

create policy "Users read their theme pack entitlements"
on public.theme_pack_entitlements for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.theme_pack_entitlements from anon, authenticated;
revoke all on public.theme_pack_redemption_attempts from anon, authenticated;
grant select on public.theme_pack_entitlements to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('theme-pack-assets', 'theme-pack-assets', false, 10485760, array['image/png', 'image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Entitled users read theme pack assets"
on storage.objects for select to authenticated
using (
  bucket_id = 'theme-pack-assets'
  and exists (
    select 1
    from public.theme_pack_entitlements entitlement
    where entitlement.user_id = (select auth.uid())
      and entitlement.theme_pack_id = (storage.foldername(name))[1]
  )
);

-- 公開期間中に秋スタンプを含む作品を保存した利用者は、その作品を壊さないよう自動移行する。
insert into public.theme_pack_entitlements (user_id, theme_pack_id, source)
select distinct user_id, 'autumn-letter-set', 'legacy-project'
from public.box_projects
where document::text like '%autumn-rabbit-%'
on conflict (user_id, theme_pack_id) do nothing;
