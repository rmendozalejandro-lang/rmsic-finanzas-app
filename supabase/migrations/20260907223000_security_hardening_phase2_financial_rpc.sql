-- Security hardening phase 2: high-risk financial/admin RPC exposure
-- Corrected after production validation: revoke PUBLIC as well as anon, otherwise
-- anon may retain EXECUTE through the implicit PUBLIC role.

begin;

-- Application RPCs/helpers: remove PUBLIC/anon inheritance, preserve authenticated explicitly.
revoke execute on function public.conciliar_movimiento_bancario(uuid, uuid, text) from public, anon;
revoke execute on function public.conciliar_multiples_movimientos_bancarios(uuid, uuid[], text) from public, anon;
revoke execute on function public.conciliar_sugerencias_bancarias_exactas(uuid, uuid, integer) from public, anon;
revoke execute on function public.crear_movimiento_simple_desde_fila_bancaria(uuid, text) from public, anon;
revoke execute on function public.crear_movimiento_tributario_desde_fila_bancaria(uuid, text, text, uuid, text, uuid, uuid, numeric, numeric, numeric, numeric, text, text, uuid) from public, anon;
revoke execute on function public.crear_prestamo_trabajador(uuid, text, text, date, numeric, integer, date, uuid, text, text, text, uuid, text) from public, anon;
revoke execute on function public.marcar_cuota_prestamo_descontada(uuid) from public, anon;
revoke execute on function public.crear_asiento_movimiento_prestamo_trabajador(uuid, text) from public, anon;
revoke execute on function public.generar_depreciaciones_activo_fijo(uuid, date) from public, anon;
revoke execute on function public.generar_depreciaciones_empresa(uuid, date) from public, anon;
revoke execute on function public.crear_asiento_depreciacion_activo_fijo(uuid) from public, anon;
revoke execute on function public.crear_asientos_depreciacion_periodo(uuid, date) from public, anon;
revoke execute on function public.next_cotizacion_folio(uuid) from public, anon;
revoke execute on function public.aceptar_mis_invitaciones_empresa() from public, anon;
revoke execute on function public.es_super_admin() from public, anon;
revoke execute on function public.puede_administrar_empresa(uuid) from public, anon;
revoke execute on function public.puede_gestionar_sii_empresa(uuid) from public, anon;
revoke execute on function public.ot_asegurar_plantilla_motor_mt(uuid) from public, anon;
revoke execute on function public.ot_generar_checklist_motor_mt_ot(uuid) from public, anon;

grant execute on function public.conciliar_movimiento_bancario(uuid, uuid, text) to authenticated;
grant execute on function public.conciliar_multiples_movimientos_bancarios(uuid, uuid[], text) to authenticated;
grant execute on function public.conciliar_sugerencias_bancarias_exactas(uuid, uuid, integer) to authenticated;
grant execute on function public.crear_movimiento_simple_desde_fila_bancaria(uuid, text) to authenticated;
grant execute on function public.crear_movimiento_tributario_desde_fila_bancaria(uuid, text, text, uuid, text, uuid, uuid, numeric, numeric, numeric, numeric, text, text, uuid) to authenticated;
grant execute on function public.crear_prestamo_trabajador(uuid, text, text, date, numeric, integer, date, uuid, text, text, text, uuid, text) to authenticated;
grant execute on function public.marcar_cuota_prestamo_descontada(uuid) to authenticated;
grant execute on function public.crear_asiento_movimiento_prestamo_trabajador(uuid, text) to authenticated;
grant execute on function public.generar_depreciaciones_activo_fijo(uuid, date) to authenticated;
grant execute on function public.generar_depreciaciones_empresa(uuid, date) to authenticated;
grant execute on function public.crear_asiento_depreciacion_activo_fijo(uuid) to authenticated;
grant execute on function public.crear_asientos_depreciacion_periodo(uuid, date) to authenticated;
grant execute on function public.next_cotizacion_folio(uuid) to authenticated;
grant execute on function public.aceptar_mis_invitaciones_empresa() to authenticated;
grant execute on function public.es_super_admin() to authenticated;
grant execute on function public.puede_administrar_empresa(uuid) to authenticated;
grant execute on function public.puede_gestionar_sii_empresa(uuid) to authenticated;
grant execute on function public.ot_asegurar_plantilla_motor_mt(uuid) to authenticated;
grant execute on function public.ot_generar_checklist_motor_mt_ot(uuid) to authenticated;

-- Trigger functions are internal database mechanisms, not client RPCs.
revoke execute on function public.aceptar_invitaciones_pendientes_por_perfil() from public, anon, authenticated;
revoke execute on function public.crear_perfil_desde_auth_user() from public, anon, authenticated;
revoke execute on function public.crear_modulos_default_empresa() from public, anon, authenticated;
revoke execute on function public.fn_movimientos_set_cuenta_contable() from public, anon, authenticated;
revoke execute on function public.ot_aplicar_tipo_servicio_config() from public, anon, authenticated;
revoke execute on function public.ot_asignar_checklist_dyf_por_plantilla() from public, anon, authenticated;
revoke execute on function public.ot_generar_folio() from public, anon, authenticated;

-- pts_verificar_publico(uuid) intentionally remains executable by anon because its
-- purpose is token-based public verification of approved/in-progress/closed PTS.

commit;
