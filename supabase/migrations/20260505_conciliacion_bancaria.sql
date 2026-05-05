-- ============================================================
-- Migración: Conciliación bancaria
-- Fecha: 2026-05-05
-- Incluye:
-- - Campos de conciliación en banco_importacion_filas
-- - Función de conciliación manual
-- - Función de reversa de conciliación
-- - Vista de sugerencias automáticas
-- - Función de conciliación automática exacta
-- ============================================================


-- ============================================================
-- 1. Campos de conciliación en líneas bancarias importadas
-- ============================================================

alter table public.banco_importacion_filas
add column if not exists conciliado_at timestamptz null;

alter table public.banco_importacion_filas
add column if not exists conciliado_by uuid null;

alter table public.banco_importacion_filas
add column if not exists conciliacion_tipo text null;

alter table public.banco_importacion_filas
add column if not exists diferencia_conciliacion numeric(14,2) not null default 0;


-- ============================================================
-- 2. Función: conciliar movimiento bancario manualmente
-- ============================================================

create or replace function public.conciliar_movimiento_bancario(
  p_fila_id uuid,
  p_movimiento_id uuid,
  p_observacion text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid;
  v_usuario uuid;
  v_empresa_id uuid;
  v_cuenta_bancaria_id uuid;
  v_importacion_id uuid;
  v_fila_estado text;
  v_fila_movimiento_id uuid;
  v_importacion_created_by uuid;
  v_cargo numeric(14,2);
  v_abono numeric(14,2);
  v_monto_banco numeric(14,2);
  v_tipo_banco text;
  v_mov_empresa_id uuid;
  v_mov_cuenta_bancaria_id uuid;
  v_mov_tipo text;
  v_mov_monto numeric(14,2);
  v_mov_estado text;
  v_diferencia numeric(14,2);
begin
  v_auth_uid := auth.uid();

  select
    f.empresa_id,
    f.cuenta_bancaria_id,
    f.importacion_id,
    f.estado,
    f.movimiento_id,
    f.cargo,
    f.abono
  into
    v_empresa_id,
    v_cuenta_bancaria_id,
    v_importacion_id,
    v_fila_estado,
    v_fila_movimiento_id,
    v_cargo,
    v_abono
  from public.banco_importacion_filas f
  where f.id = p_fila_id
  for update;

  if v_empresa_id is null then
    raise exception 'No se encontró la línea bancaria indicada';
  end if;

  select i.created_by
  into v_importacion_created_by
  from public.banco_importaciones i
  where i.id = v_importacion_id;

  v_usuario := coalesce(v_auth_uid, v_importacion_created_by);

  if v_usuario is null then
    select ue.usuario_id
    into v_usuario
    from public.usuario_empresas ue
    where ue.empresa_id = v_empresa_id
      and ue.activo = true
      and ue.rol in ('admin', 'administracion_financiera', 'gerencia')
    limit 1;
  end if;

  if v_fila_estado = 'omitida' then
    raise exception 'No se puede conciliar una línea bancaria omitida';
  end if;

  if v_fila_movimiento_id is not null then
    raise exception 'Esta línea bancaria ya tiene un movimiento conciliado';
  end if;

  if coalesce(v_cargo, 0) > 0 and coalesce(v_abono, 0) > 0 then
    raise exception 'La línea bancaria tiene cargo y abono simultáneamente';
  end if;

  if coalesce(v_cargo, 0) <= 0 and coalesce(v_abono, 0) <= 0 then
    raise exception 'La línea bancaria no tiene monto válido';
  end if;

  v_tipo_banco := case
    when coalesce(v_cargo, 0) > 0 then 'egreso'
    else 'ingreso'
  end;

  v_monto_banco := case
    when coalesce(v_cargo, 0) > 0 then v_cargo
    else v_abono
  end;

  if v_auth_uid is not null and not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_auth_uid
        and ue.empresa_id = v_empresa_id
        and ue.activo = true
        and ue.rol in ('admin', 'administracion_financiera', 'gerencia')
    )
  ) then
    raise exception 'No tiene permisos para conciliar esta empresa';
  end if;

  select
    m.empresa_id,
    m.cuenta_bancaria_id,
    m.tipo_movimiento,
    m.monto_total,
    m.estado
  into
    v_mov_empresa_id,
    v_mov_cuenta_bancaria_id,
    v_mov_tipo,
    v_mov_monto,
    v_mov_estado
  from public.movimientos m
  where m.id = p_movimiento_id
    and m.activo = true
    and m.deleted_at is null;

  if v_mov_empresa_id is null then
    raise exception 'No se encontró el movimiento interno indicado';
  end if;

  if v_mov_empresa_id <> v_empresa_id then
    raise exception 'El movimiento interno pertenece a otra empresa';
  end if;

  if v_mov_cuenta_bancaria_id <> v_cuenta_bancaria_id then
    raise exception 'El movimiento interno pertenece a otra cuenta bancaria';
  end if;

  if v_mov_tipo <> v_tipo_banco then
    raise exception 'El tipo no coincide. La cartola indica %, pero el movimiento es %',
      v_tipo_banco,
      v_mov_tipo;
  end if;

  if v_mov_estado <> 'pagado' then
    raise exception 'Solo se pueden conciliar movimientos internos en estado pagado';
  end if;

  v_diferencia := coalesce(v_monto_banco, 0) - coalesce(v_mov_monto, 0);

  if abs(v_diferencia) > 0.49 then
    raise exception 'El monto no coincide. Banco: %, Auren: %, diferencia: %',
      v_monto_banco,
      v_mov_monto,
      v_diferencia;
  end if;

  if exists (
    select 1
    from public.banco_importacion_filas f
    where f.movimiento_id = p_movimiento_id
      and f.id <> p_fila_id
      and f.estado <> 'omitida'
  ) then
    raise exception 'Este movimiento interno ya está conciliado con otra línea bancaria';
  end if;

  update public.banco_importacion_filas
  set
    movimiento_id = p_movimiento_id,
    estado = 'conciliada',
    conciliado_at = now(),
    conciliado_by = v_usuario,
    conciliacion_tipo = 'manual',
    diferencia_conciliacion = v_diferencia,
    observacion = coalesce(p_observacion, observacion),
    updated_at = now()
  where id = p_fila_id;
end;
$$;

grant execute on function public.conciliar_movimiento_bancario(
  uuid,
  uuid,
  text
) to authenticated;


-- ============================================================
-- 3. Función: reversar conciliación bancaria
-- ============================================================

create or replace function public.reversar_conciliacion_bancaria(
  p_fila_id uuid,
  p_observacion text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid;
  v_usuario uuid;
  v_empresa_id uuid;
  v_importacion_id uuid;
  v_estado text;
  v_movimiento_id uuid;
  v_importacion_created_by uuid;
begin
  v_auth_uid := auth.uid();

  select
    f.empresa_id,
    f.importacion_id,
    f.estado,
    f.movimiento_id
  into
    v_empresa_id,
    v_importacion_id,
    v_estado,
    v_movimiento_id
  from public.banco_importacion_filas f
  where f.id = p_fila_id
  for update;

  if v_empresa_id is null then
    raise exception 'No se encontró la línea bancaria indicada';
  end if;

  select i.created_by
  into v_importacion_created_by
  from public.banco_importaciones i
  where i.id = v_importacion_id;

  v_usuario := coalesce(v_auth_uid, v_importacion_created_by);

  if v_usuario is null then
    select ue.usuario_id
    into v_usuario
    from public.usuario_empresas ue
    where ue.empresa_id = v_empresa_id
      and ue.activo = true
      and ue.rol in ('admin', 'administracion_financiera', 'gerencia')
    limit 1;
  end if;

  if v_movimiento_id is null then
    raise exception 'La línea bancaria no tiene movimiento conciliado';
  end if;

  if v_auth_uid is not null and not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_auth_uid
        and ue.empresa_id = v_empresa_id
        and ue.activo = true
        and ue.rol in ('admin', 'administracion_financiera', 'gerencia')
    )
  ) then
    raise exception 'No tiene permisos para reversar conciliaciones en esta empresa';
  end if;

  update public.banco_importacion_filas
  set
    movimiento_id = null,
    estado = 'pendiente',
    conciliado_at = null,
    conciliado_by = null,
    conciliacion_tipo = null,
    diferencia_conciliacion = 0,
    observacion = coalesce(
      p_observacion,
      case
        when observacion is null then 'Conciliación reversada'
        else observacion || ' | Conciliación reversada'
      end
    ),
    updated_at = now()
  where id = p_fila_id;
end;
$$;

grant execute on function public.reversar_conciliacion_bancaria(
  uuid,
  text
) to authenticated;


-- ============================================================
-- 4. Vista: sugerencias automáticas de conciliación
-- ============================================================

create or replace view public.v_conciliacion_bancaria_sugerencias as
select
  f.id as fila_banco_id,
  f.empresa_id,
  f.cuenta_bancaria_id,
  f.fecha as fecha_banco,
  f.descripcion_original,
  f.numero_documento as documento_banco,
  f.cargo,
  f.abono,
  case
    when f.cargo > 0 then 'egreso'
    else 'ingreso'
  end as tipo_banco,
  case
    when f.cargo > 0 then f.cargo
    else f.abono
  end as monto_banco,

  m.id as movimiento_id,
  m.fecha as fecha_movimiento,
  m.tipo_movimiento,
  m.numero_documento as documento_movimiento,
  m.descripcion as descripcion_movimiento,
  m.monto_total,
  abs(f.fecha - m.fecha) as dias_diferencia,
  (
    case
      when abs(f.fecha - m.fecha) = 0 then 50
      else 30
    end
    + case
        when lower(coalesce(m.descripcion, '')) ilike '%' || lower(left(f.descripcion_original, 12)) || '%'
        then 20
        else 0
      end
  ) as puntaje
from public.banco_importacion_filas f
join public.movimientos m
  on m.empresa_id = f.empresa_id
 and m.cuenta_bancaria_id = f.cuenta_bancaria_id
 and m.activo = true
 and m.deleted_at is null
 and m.estado = 'pagado'
 and m.tipo_movimiento = case
    when f.cargo > 0 then 'egreso'
    else 'ingreso'
  end
 and abs(
    m.monto_total - case
      when f.cargo > 0 then f.cargo
      else f.abono
    end
  ) <= 0.49
 and abs(f.fecha - m.fecha) <= 3
where f.movimiento_id is null
  and f.estado <> 'omitida'
  and f.es_duplicado = false
  and f.tipo_registro = 'movimiento'
  and not exists (
    select 1
    from public.banco_importacion_filas fx
    where fx.movimiento_id = m.id
      and fx.estado <> 'omitida'
  );

grant select on public.v_conciliacion_bancaria_sugerencias to authenticated;


-- ============================================================
-- 5. Función: conciliación automática exacta
-- ============================================================

create or replace function public.conciliar_sugerencias_bancarias_exactas(
  p_empresa_id uuid default null,
  p_cuenta_bancaria_id uuid default null,
  p_limite integer default 50
)
returns table (
  fila_banco_id uuid,
  movimiento_id uuid,
  resultado text,
  mensaje text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    with sugerencias_exactas as (
      select
        s.*,
        count(*) over (partition by s.fila_banco_id) as opciones_por_fila,
        count(*) over (partition by s.movimiento_id) as opciones_por_movimiento
      from public.v_conciliacion_bancaria_sugerencias s
      where s.dias_diferencia = 0
        and s.puntaje >= 50
        and (p_empresa_id is null or s.empresa_id = p_empresa_id)
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
$$;

grant execute on function public.conciliar_sugerencias_bancarias_exactas(
  uuid,
  uuid,
  integer
) to authenticated;
crear_movimiento_simple_desde_fila_bancaria



