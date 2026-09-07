-- Security hardening phase 1
-- Prepared in feature branch only. Do not apply to production until regression tests pass.
-- Goal: reduce anonymous RPC exposure without changing legitimate authenticated workflows.

begin;

-- Keep the intentionally public PTS verification RPC available to anon.
-- All functions below are intended for authenticated/admin/internal use.

revoke execute on function public.actualizar_rol_usuario_empresa(uuid, text) from anon;
revoke execute on function public.admin_listar_usuarios_empresa(uuid) from anon;
revoke execute on function public.agregar_o_invitar_usuario_empresa(uuid, text, text) from anon;
revoke execute on function public.cambiar_estado_usuario_empresa(uuid, boolean) from anon;
revoke execute on function public.crear_empresa_con_estructura_base(text, text, text, text, text, text, text, text, uuid) from anon;
revoke execute on function public.eliminar_cliente_admin(uuid, text) from anon;
revoke execute on function public.eliminar_cotizacion_admin(uuid, text) from anon;
revoke execute on function public.eliminar_ot_admin(uuid, text) from anon;
revoke execute on function public.eliminar_ot_equipo_admin(uuid, text) from anon;
revoke execute on function public.eliminar_proveedor_admin(uuid, text) from anon;
revoke execute on function public.ot_autorizar_correccion_tecnica(uuid, text) from anon;
revoke execute on function public.ot_bloquear_edicion_tecnica(uuid, text) from anon;
revoke execute on function public.usuario_puede_acceder_caso_asistente(uuid, text, uuid) from anon;
revoke execute on function public.usuario_tiene_acceso_asistente(uuid, text) from anon;

-- Make intended authenticated access explicit so current signed-in flows remain available.
grant execute on function public.actualizar_rol_usuario_empresa(uuid, text) to authenticated;
grant execute on function public.admin_listar_usuarios_empresa(uuid) to authenticated;
grant execute on function public.agregar_o_invitar_usuario_empresa(uuid, text, text) to authenticated;
grant execute on function public.cambiar_estado_usuario_empresa(uuid, boolean) to authenticated;
grant execute on function public.crear_empresa_con_estructura_base(text, text, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.eliminar_cliente_admin(uuid, text) to authenticated;
grant execute on function public.eliminar_cotizacion_admin(uuid, text) to authenticated;
grant execute on function public.eliminar_ot_admin(uuid, text) to authenticated;
grant execute on function public.eliminar_ot_equipo_admin(uuid, text) to authenticated;
grant execute on function public.eliminar_proveedor_admin(uuid, text) to authenticated;
grant execute on function public.ot_autorizar_correccion_tecnica(uuid, text) to authenticated;
grant execute on function public.ot_bloquear_edicion_tecnica(uuid, text) to authenticated;
grant execute on function public.usuario_puede_acceder_caso_asistente(uuid, text, uuid) to authenticated;
grant execute on function public.usuario_tiene_acceso_asistente(uuid, text) to authenticated;

-- Harden mutable search_path warnings on the two OT administration functions.
alter function public.ot_autorizar_correccion_tecnica(uuid, text) set search_path = public;
alter function public.ot_bloquear_edicion_tecnica(uuid, text) set search_path = public;

commit;
