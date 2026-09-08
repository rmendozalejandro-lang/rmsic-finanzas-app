-- Final SECURITY DEFINER cleanup based on full production audit.
-- Prepared in feature branch only. Do not apply to production until regression testing is complete.

begin;

-- Public verification endpoint intentionally remains anonymous:
-- public.pts_verificar_publico(uuid)

-- Remaining application RPCs/helpers that should never be anonymous.
revoke execute on function public.aceptar_mis_invitaciones_empresa() from anon;
revoke execute on function public.cancelar_invitacion_empresa(uuid) from anon;
revoke execute on function public.crear_prestamo_trabajador(uuid, text, text, date, numeric, integer, date, uuid, text, text, text, uuid, text) from anon;
revoke execute on function public.marcar_cuota_prestamo_descontada(uuid) from anon;
revoke execute on function public.revertir_cuota_prestamo_descontada(uuid) from anon;
revoke execute on function public.recalculate_cotizacion_totals(uuid) from anon;
revoke execute on function public.validar_centro_costo_empresa(uuid, uuid) from anon;

-- Test-only helpers should not be callable by client roles in production.
revoke execute on function public.usuario_tiene_algun_rol_empresa_test(uuid, uuid, text[]) from anon;
revoke execute on function public.usuario_tiene_algun_rol_empresa_test(uuid, uuid, text[]) from authenticated;
revoke execute on function public.usuario_tiene_rol_empresa_test(uuid, uuid, text) from anon;
revoke execute on function public.usuario_tiene_rol_empresa_test(uuid, uuid, text) from authenticated;

-- Audit writer is an internal mechanism. Direct client execution would allow forged audit entries.
revoke execute on function public.registrar_auditoria_admin(uuid, text, text, uuid, jsonb) from anon;
revoke execute on function public.registrar_auditoria_admin(uuid, text, text, uuid, jsonb) from authenticated;

-- Trigger/event-trigger functions are internal database mechanisms, not client RPCs.
revoke execute on function public.aceptar_invitaciones_pendientes_por_perfil() from anon;
revoke execute on function public.aceptar_invitaciones_pendientes_por_perfil() from authenticated;
revoke execute on function public.crear_modulos_default_empresa() from anon;
revoke execute on function public.crear_modulos_default_empresa() from authenticated;
revoke execute on function public.crear_perfil_desde_auth_user() from anon;
revoke execute on function public.crear_perfil_desde_auth_user() from authenticated;
revoke execute on function public.fn_movimientos_set_cuenta_contable() from anon;
revoke execute on function public.fn_movimientos_set_cuenta_contable() from authenticated;
revoke execute on function public.ot_aplicar_tipo_servicio_config() from anon;
revoke execute on function public.ot_aplicar_tipo_servicio_config() from authenticated;
revoke execute on function public.ot_asignar_checklist_dyf_por_plantilla() from anon;
revoke execute on function public.ot_asignar_checklist_dyf_por_plantilla() from authenticated;
revoke execute on function public.ot_generar_folio() from anon;
revoke execute on function public.ot_generar_folio() from authenticated;
revoke execute on function public.trg_auditoria_empresa_modulos() from anon;
revoke execute on function public.trg_auditoria_empresa_modulos() from authenticated;
revoke execute on function public.trg_auditoria_empresas() from anon;
revoke execute on function public.trg_auditoria_empresas() from authenticated;
revoke execute on function public.trg_auditoria_invitaciones_empresa() from anon;
revoke execute on function public.trg_auditoria_invitaciones_empresa() from authenticated;
revoke execute on function public.trg_auditoria_usuario_empresas() from anon;
revoke execute on function public.trg_auditoria_usuario_empresas() from authenticated;
revoke execute on function public.trg_crear_asiento_borrador_movimiento_tributario_cartola() from anon;
revoke execute on function public.trg_crear_asiento_borrador_movimiento_tributario_cartola() from authenticated;
revoke execute on function public.trg_crear_asiento_prestamo_trabajador() from anon;
revoke execute on function public.trg_crear_asiento_prestamo_trabajador() from authenticated;
revoke execute on function public.validar_contacto_empresa() from anon;
revoke execute on function public.validar_contacto_empresa() from authenticated;
revoke execute on function public.validar_cotizacion_contacto_destinatario() from anon;
revoke execute on function public.validar_cotizacion_contacto_destinatario() from authenticated;

-- recalculate_cotizacion_totals is still an application RPC, but it now enforces tenant membership
-- before performing SECURITY DEFINER writes.
create or replace function public.recalculate_cotizacion_totals(_cotizacion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_empresa_id uuid;
  v_usuario uuid;
  v_subtotal_items_neto numeric := 0;
  v_subtotal_items_exento numeric := 0;
  v_descuento_tipo text;
  v_descuento_valor numeric := 0;
  v_porcentaje_iva numeric := 19;
  v_descuento_global_neto numeric := 0;
  v_descuento_global_exento numeric := 0;
  v_descuento_global_total numeric := 0;
  v_subtotal_neto numeric := 0;
  v_subtotal_exento numeric := 0;
  v_monto_iva numeric := 0;
  v_total numeric := 0;
  v_base_total numeric := 0;
begin
  v_usuario := auth.uid();
  if v_usuario is null then
    raise exception 'Usuario no autenticado';
  end if;

  select empresa_id,
         coalesce(descuento_global_tipo, ''),
         coalesce(descuento_global_valor, 0),
         coalesce(porcentaje_iva, 19)
  into v_empresa_id, v_descuento_tipo, v_descuento_valor, v_porcentaje_iva
  from public.cotizaciones
  where id = _cotizacion_id
    and coalesce(activo, true) = true
    and deleted_at is null;

  if v_empresa_id is null then
    raise exception 'Cotización no encontrada';
  end if;

  if not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_usuario
        and ue.empresa_id = v_empresa_id
        and coalesce(ue.activo, true) = true
    )
  ) then
    raise exception 'No tiene acceso a esta cotización';
  end if;

  select
    coalesce(sum(case when afecto_iva = true then coalesce(subtotal, bruto, cantidad * precio_unitario, 0) else 0 end), 0),
    coalesce(sum(case when afecto_iva = false then coalesce(subtotal, bruto, cantidad * precio_unitario, 0) else 0 end), 0)
  into v_subtotal_items_neto, v_subtotal_items_exento
  from public.cotizacion_items
  where cotizacion_id = _cotizacion_id
    and activo = true
    and deleted_at is null;

  v_base_total := v_subtotal_items_neto + v_subtotal_items_exento;

  if lower(v_descuento_tipo) in ('porcentaje', 'percent', '%') and v_descuento_valor > 0 then
    v_descuento_global_neto := round(v_subtotal_items_neto * v_descuento_valor / 100, 2);
    v_descuento_global_exento := round(v_subtotal_items_exento * v_descuento_valor / 100, 2);
  elsif lower(v_descuento_tipo) in ('monto', 'valor', 'fijo') and v_descuento_valor > 0 and v_base_total > 0 then
    v_descuento_global_neto := round(v_descuento_valor * (v_subtotal_items_neto / v_base_total), 2);
    v_descuento_global_exento := round(v_descuento_valor * (v_subtotal_items_exento / v_base_total), 2);
  end if;

  v_descuento_global_total := v_descuento_global_neto + v_descuento_global_exento;
  v_subtotal_neto := greatest(v_subtotal_items_neto - v_descuento_global_neto, 0);
  v_subtotal_exento := greatest(v_subtotal_items_exento - v_descuento_global_exento, 0);
  v_monto_iva := round(v_subtotal_neto * v_porcentaje_iva / 100, 2);
  v_total := v_subtotal_neto + v_subtotal_exento + v_monto_iva;

  update public.cotizaciones
  set
    subtotal_items_neto = v_subtotal_items_neto,
    subtotal_items_exento = v_subtotal_items_exento,
    descuento_global_neto = v_descuento_global_neto,
    descuento_global_exento = v_descuento_global_exento,
    descuento_global_total = v_descuento_global_total,
    subtotal_neto = v_subtotal_neto,
    subtotal_exento = v_subtotal_exento,
    monto_iva = v_monto_iva,
    total = v_total,
    updated_at = now()
  where id = _cotizacion_id
    and empresa_id = v_empresa_id;
end;
$function$;

grant execute on function public.recalculate_cotizacion_totals(uuid) to authenticated;

commit;
