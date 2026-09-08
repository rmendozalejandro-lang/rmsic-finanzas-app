-- Security hardening: helper, veterinary and trigger function exposure
-- Prepared in feature branch only. Do not apply to production until regression tests pass.
--
-- Findings:
-- - Several SECURITY DEFINER helper functions return permission booleans and are callable by anon.
--   They do not currently expose protected rows by themselves, but anonymous RPC exposure is unnecessary.
-- - Veterinary write RPCs already delegate authorization to usuario_tiene_acceso_haras(), which
--   restricts access to active company users with the Haras module and roles admin/gerencia.
-- - pts_verificar_publico(uuid) is intentionally public and remains unchanged.
-- - rls_auto_enable() is an event-trigger function and should not be exposed as a client RPC.

begin;

-- Generic auth/company helpers: keep for authenticated application/RLS use, remove anon entry points.
revoke execute on function public.es_super_admin() from anon;
revoke execute on function public.puede_administrar_empresa(uuid) from anon;
revoke execute on function public.puede_gestionar_sii_empresa(uuid) from anon;
revoke execute on function public.user_can_manage_empresa(uuid) from anon;
revoke execute on function public.usuario_tiene_empresa(uuid) from anon;
revoke execute on function public.usuario_tiene_rol_empresa(uuid, text) from anon;
revoke execute on function public.usuario_tiene_algun_rol_empresa(uuid, text[]) from anon;
revoke execute on function public.usuario_tiene_acceso_haras(uuid) from anon;
revoke execute on function public.usuario_puede_acceder_caso_asistente(uuid, text, uuid) from anon;
revoke execute on function public.usuario_tiene_acceso_asistente(uuid, text) from anon;

-- Veterinary mutations: authenticated users keep access, but company/module/role checks remain inside the RPCs.
revoke execute on function public.vet_anular_procedimiento(uuid, uuid) from anon;
revoke execute on function public.vet_registrar_procedimiento_con_insumos(uuid, uuid, uuid, timestamptz, text, text, text, text, date, text, text, jsonb) from anon;

grant execute on function public.vet_anular_procedimiento(uuid, uuid) to authenticated;
grant execute on function public.vet_registrar_procedimiento_con_insumos(uuid, uuid, uuid, timestamptz, text, text, text, text, date, text, text, jsonb) to authenticated;

-- Permission helpers remain available to authenticated because RLS and server-side code depend on them.
grant execute on function public.es_super_admin() to authenticated;
grant execute on function public.puede_administrar_empresa(uuid) to authenticated;
grant execute on function public.puede_gestionar_sii_empresa(uuid) to authenticated;
grant execute on function public.user_can_manage_empresa(uuid) to authenticated;
grant execute on function public.usuario_tiene_empresa(uuid) to authenticated;
grant execute on function public.usuario_tiene_rol_empresa(uuid, text) to authenticated;
grant execute on function public.usuario_tiene_algun_rol_empresa(uuid, text[]) to authenticated;
grant execute on function public.usuario_tiene_acceso_haras(uuid) to authenticated;
grant execute on function public.usuario_puede_acceder_caso_asistente(uuid, text, uuid) to authenticated;
grant execute on function public.usuario_tiene_acceso_asistente(uuid, text) to authenticated;

-- Internal event-trigger function: no client role should invoke it directly.
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- Intentionally public PTS verification endpoint remains unchanged:
-- public.pts_verificar_publico(uuid)

commit;
