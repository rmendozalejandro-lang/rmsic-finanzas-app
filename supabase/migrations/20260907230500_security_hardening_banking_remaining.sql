-- Security hardening: remaining banking / transfer RPCs
-- Prepared in feature branch only. Do not apply to production until regression tests pass.
--
-- This phase removes anonymous execution from remaining banking mutations and tightens
-- the automatic exact-reconciliation helper so authenticated users cannot enumerate or
-- operate across companies by passing NULL company filters.

begin;

create or replace function public.conciliar_sugerencias_bancarias_exactas(
  p_empresa_id uuid,
  p_cuenta_bancaria_id uuid default null::uuid,
  p_limite integer default 50
)
returns table(
  fila_banco_id uuid,
  movimiento_id uuid,
  resultado text,
  mensaje text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid;
  r record;
begin
  v_usuario := auth.uid();

  if v_usuario is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_empresa_id is null then
    raise exception 'Debe indicar la empresa para conciliar sugerencias bancarias';
  end if;

  if p_limite is null or p_limite < 1 or p_limite > 200 then
    raise exception 'El límite debe estar entre 1 y 200';
  end if;

  if not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_usuario
        and ue.empresa_id = p_empresa_id
        and coalesce(ue.activo, true) = true
        and ue.rol in ('admin', 'administracion_financiera', 'gerencia')
    )
  ) then
    raise exception 'No tiene permisos para conciliar movimientos en esta empresa';
  end if;

  if p_cuenta_bancaria_id is not null and not exists (
    select 1
    from public.cuentas_bancarias cb
    where cb.id = p_cuenta_bancaria_id
      and cb.empresa_id = p_empresa_id
      and cb.activa = true
      and cb.deleted_at is null
  ) then
    raise exception 'La cuenta bancaria no pertenece a la empresa o no está disponible';
  end if;

  for r in
    with sugerencias_exactas as (
      select
        s.*,
        count(*) over (partition by s.fila_banco_id) as opciones_por_fila,
        count(*) over (partition by s.movimiento_id) as opciones_por_movimiento
      from public.v_conciliacion_bancaria_sugerencias s
      where s.empresa_id = p_empresa_id
        and s.dias_diferencia = 0
        and s.puntaje >= 50
        and (p_cuenta_bancaria_id is null or s.cuenta_bancaria_id = p_cuenta_bancaria_id)
    )
    select *
    from sugerencias_exactas
    where opciones_por_fila = 1
      and opciones_por_movimiento = 1
    order by fecha_banco desc, monto_banco desc
    limit p_limite
  loop
    begin
      perform public.conciliar_movimiento_bancario(
        r.fila_banco_id,
        r.movimiento_id,
        'Conciliación automática exacta'
      );

      fila_banco_id := r.fila_banco_id;
      movimiento_id := r.movimiento_id;
      resultado := 'conciliada';
      mensaje := 'Conciliación automática exacta realizada correctamente';
      return next;
    exception when others then
      fila_banco_id := r.fila_banco_id;
      movimiento_id := r.movimiento_id;
      resultado := 'error';
      mensaje := sqlerrm;
      return next;
    end;
  end loop;
end;
$function$;

-- Remaining RPCs already contain authenticated company/role checks, but they were still
-- executable by anon. Remove that public entry point.
revoke execute on function public.registrar_abono_prestamo_transferencia(uuid, numeric, uuid, date) from anon;
revoke execute on function public.registrar_pago_cuota_prestamo_transferencia(uuid, uuid, date) from anon;
revoke execute on function public.reversar_conciliacion_bancaria(uuid, text) from anon;
revoke execute on function public.reversar_pago_prestamo_transferencia(uuid) from anon;
revoke execute on function public.vincular_transferencia_existente_a_fila_bancaria(uuid, uuid, text) from anon;
revoke execute on function public.conciliar_sugerencias_bancarias_exactas(uuid, uuid, integer) from anon;

-- Keep current authenticated application flows explicit.
grant execute on function public.registrar_abono_prestamo_transferencia(uuid, numeric, uuid, date) to authenticated;
grant execute on function public.registrar_pago_cuota_prestamo_transferencia(uuid, uuid, date) to authenticated;
grant execute on function public.reversar_conciliacion_bancaria(uuid, text) to authenticated;
grant execute on function public.reversar_pago_prestamo_transferencia(uuid) to authenticated;
grant execute on function public.vincular_transferencia_existente_a_fila_bancaria(uuid, uuid, text) to authenticated;
grant execute on function public.conciliar_sugerencias_bancarias_exactas(uuid, uuid, integer) to authenticated;

commit;
