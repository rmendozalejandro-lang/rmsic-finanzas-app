begin;

-- Endurecimiento exclusivamente del modulo PTS.
-- Las funciones operativas solo pueden invocarse autenticado; se mantiene
-- la verificacion publica por token como unica RPC PTS accesible a anon.

revoke all on function public.usuario_tiene_acceso_pts(uuid) from public, anon;
grant execute on function public.usuario_tiene_acceso_pts(uuid) to authenticated, service_role;

revoke all on function public.pts_enviar_revision(uuid) from public, anon;
grant execute on function public.pts_enviar_revision(uuid) to authenticated, service_role;

revoke all on function public.pts_resolver_revision(uuid, text, text) from public, anon;
grant execute on function public.pts_resolver_revision(uuid, text, text) to authenticated, service_role;

revoke all on function public.pts_guardar_correccion(uuid, jsonb, jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.pts_guardar_correccion(uuid, jsonb, jsonb, jsonb, jsonb, text) to authenticated, service_role;

revoke all on function public.pts_iniciar_ejecucion(uuid) from public, anon;
grant execute on function public.pts_iniciar_ejecucion(uuid) to authenticated, service_role;

revoke all on function public.pts_cerrar_trabajo(uuid, text) from public, anon;
grant execute on function public.pts_cerrar_trabajo(uuid, text) to authenticated, service_role;

-- La verificacion QR es deliberadamente publica, pero no queda abierta a PUBLIC.
revoke all on function public.pts_verificar_publico(uuid) from public;
grant execute on function public.pts_verificar_publico(uuid) to anon, authenticated, service_role;

commit;
