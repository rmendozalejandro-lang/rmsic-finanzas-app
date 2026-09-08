-- Security hardening phase 2: high-risk financial/admin RPC exposure
-- Prepared in feature branch only. Do not apply to production until regression tests pass.
--
-- Findings from read-only production audit:
-- Several SECURITY DEFINER functions are executable by anon. Some contain checks that
-- only enforce company/role permissions when auth.uid() is NOT NULL. Under anon,
-- auth.uid() is NULL, so those functions can fall through and perform privileged writes
-- using fallback users such as import creators/admins. Anonymous EXECUTE must therefore
-- be removed before broader exposure of Tralixia.

begin;

-- Banking / reconciliation
revoke execute on function public.conciliar_movimiento_bancario(uuid, uuid, text) from anon;
revoke execute on function public.conciliar_multiples_movimientos_bancarios(uuid, uuid[], text) from anon;
revoke execute on function public.conciliar_sugerencias_bancarias_exactas(uuid, uuid, integer) from anon;
revoke execute on function public.crear_movimiento_simple_desde_fila_bancaria(uuid, text) from anon;
revoke execute on function public.crear_movimiento_tributario_desde_fila_bancaria(uuid, text, text, uuid, text, uuid, uuid, numeric, numeric, numeric, numeric, text, text, uuid) from anon;

-- Loans / payroll-adjacent finance
revoke execute on function public.crear_prestamo_trabajador(uuid, text, text, date, numeric, integer, date, uuid, text, text, text, uuid, text) from anon;
revoke execute on function public.marcar_cuota_prestamo_descontada(uuid) from anon;
revoke execute on function public.crear_asiento_movimiento_prestamo_trabajador(uuid, text) from anon;

-- Fixed assets / accounting
revoke execute on function public.generar_depreciaciones_activo_fijo(uuid, date) from anon;
revoke execute on function public.generar_depreciaciones_empresa(uuid, date) from anon;
revoke execute on function public.crear_asiento_depreciacion_activo_fijo(uuid) from anon;
revoke execute on function public.crear_asientos_depreciacion_periodo(uuid, date) from anon;

-- Folio mutation should never be callable anonymously.
revoke execute on function public.next_cotizacion_folio(uuid) from anon;

-- Invitation/account helpers require an authenticated user context.
revoke execute on function public.aceptar_mis_invitaciones_empresa() from anon;
revoke execute on function public.es_super_admin() from anon;
revoke execute on function public.puede_administrar_empresa(uuid) from anon;
revoke execute on function public.puede_gestionar_sii_empresa(uuid) from anon;

-- OT helpers / generators. Keep authenticated access unchanged for now.
revoke execute on function public.ot_asegurar_plantilla_motor_mt(uuid) from anon;
revoke execute on function public.ot_generar_checklist_motor_mt_ot(uuid) from anon;

-- Trigger functions are internal database mechanisms, not public RPCs.
-- Removing anon direct EXECUTE does not remove their trigger definitions.
revoke execute on function public.aceptar_invitaciones_pendientes_por_perfil() from anon;
revoke execute on function public.crear_perfil_desde_auth_user() from anon;
revoke execute on function public.crear_modulos_default_empresa() from anon;
revoke execute on function public.fn_movimientos_set_cuenta_contable() from anon;
revoke execute on function public.ot_aplicar_tipo_servicio_config() from anon;
revoke execute on function public.ot_asignar_checklist_dyf_por_plantilla() from anon;
revoke execute on function public.ot_generar_folio() from anon;

-- pts_verificar_publico(uuid) intentionally remains executable by anon because its
-- purpose is token-based public verification of approved/in-progress/closed PTS.

commit;
