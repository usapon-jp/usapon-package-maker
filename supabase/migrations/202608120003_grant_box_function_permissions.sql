-- Edge Functions use the service role for Storage coordination and cleanup.
-- Bypassing RLS does not implicitly grant table privileges, so grant only the
-- operations performed directly by those server-side functions.
grant select, update, delete on public.box_assets to service_role;
grant select on public.box_project_assets to service_role;
