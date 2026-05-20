-- Migración: conciliación parcial bancaria
-- Fecha: 2026-05-20
-- Descripción:
-- Permite conciliar una factura/movimiento existente con dos o más líneas bancarias,
-- incluso desde cuentas distintas, sin duplicar factura, IVA ni gasto.

create table if not exists public.banco_conciliacion_pagos_parciales (
  id uuid primary key default gen_random_uuid(),

  empresa_id uuid not null references public.empresas(id) on delete cascade,
  movimiento_id uuid not null references public.movimientos(id) on delete cascade,
  banco_importacion_fila_id uuid not null references public.banco_importacion_filas(id) on delete cascade,

  monto_aplicado numeric(14,2) not null check (monto_aplicado > 0),

  estado text not null default 'activo' check (
    estado in ('activo', 'reversado')
  ),

  observacion text,

  created_by uuid,
  created_at timestamptz not null default now(),
  reversado_by uuid,
  reversado_at timestamptz
);

create index if not exists idx_banco_pagos_parciales_empresa
on public.banco_conciliacion_pagos_parciales(empresa_id);

create index if not exists idx_banco_pagos_parciales_movimiento
on public.banco_conciliacion_pagos_parciales(movimiento_id);

create index if not exists idx_banco_pagos_parciales_fila
on public.banco_conciliacion_pagos_parciales(banco_importacion_fila_id);

create unique index if not exists uq_banco_pago_parcial_fila_activa
on public.banco_conciliacion_pagos_parciales(banco_importacion_fila_id)
where estado = 'activo';

create or replace view public.v_conciliacion_pago_parcial_resumen as
select
  m.id as movimiento_id,
  m.empresa_id,
  m.tipo_movimiento,
  m.fecha,
  m.tipo_documento,
  m.numero_documento,
  m.descripcion,
  m.monto_total as total_documento,

  coalesce(sum(p.monto_aplicado) filter (where p.estado = 'activo'), 0) as total_pagado_parcial,

  greatest(
    m.monto_total - coalesce(sum(p.monto_aplicado) filter (where p.estado = 'activo'), 0),
    0
  ) as saldo_pendiente,

  count(p.id) filter (where p.estado = 'activo') as cantidad_pagos,

  case
    when coalesce(sum(p.monto_aplicado) filter (where p.estado = 'activo'), 0) = 0
      then 'sin_pagos'
    when coalesce(sum(p.monto_aplicado) filter (where p.estado = 'activo'), 0) < m.monto_total
      then 'parcial'
    else 'pagado'
  end as estado_pago_calculado

from public.movimientos m
left join public.banco_conciliacion_pagos_parciales p
  on p.movimiento_id = m.id
group by
  m.id,
  m.empresa_id,
  m.tipo_movimiento,
  m.fecha,
  m.tipo_documento,
  m.numero_documento,
  m.descripcion,
  m.monto_total;

create or replace function public.conciliar_pago_parcial_bancario(
  p_banco_importacion_fila_id uuid,
  p_movimiento_id uuid,
  p_observacion text default null
)
returns table (
  pago_parcial_id uuid,
  movimiento_id uuid,
  total_documento numeric,
  total_pagado numeric,
  saldo_pendiente numeric,
  estado_pago text
)
language plpgsql
security invoker
as $$
declare
  v_mov public.movimientos%rowtype;
  v_fila public.banco_importacion_filas%rowtype;
  v_importacion_empresa_id uuid;
  v_monto_fila numeric;
  v_total_pagado_anterior numeric;
  v_total_pagado_nuevo numeric;
  v_saldo numeric;
  v_pago_id uuid;
  v_estado_pago text;
begin
  select m.*
  into v_mov
  from public.movimientos m
  where m.id = p_movimiento_id
    and coalesce(m.activo, true) = true
    and m.deleted_at is null
  for update;

  if not found then
    raise exception 'No se encontró el movimiento/factura indicado o está eliminado';
  end if;

  select bif.*
  into v_fila
  from public.banco_importacion_filas bif
  where bif.id = p_banco_importacion_fila_id
  for update;

  if not found then
    raise exception 'No se encontró la línea bancaria indicada';
  end if;

  select bi.empresa_id
  into v_importacion_empresa_id
  from public.banco_importaciones bi
  where bi.id = v_fila.importacion_id;

  if v_importacion_empresa_id is null then
    raise exception 'No se pudo determinar la empresa de la importación bancaria';
  end if;

  if v_importacion_empresa_id <> v_mov.empresa_id then
    raise exception 'La línea bancaria y la factura pertenecen a empresas distintas';
  end if;

  if coalesce(v_fila.estado, 'pendiente') <> 'pendiente' then
    raise exception 'La línea bancaria no está pendiente. Estado actual: %', v_fila.estado;
  end if;

  if v_fila.movimiento_id is not null or v_fila.transferencia_bancaria_id is not null then
    raise exception 'La línea bancaria ya está vinculada a otro movimiento o transferencia';
  end if;

  v_monto_fila := case
    when coalesce(v_fila.cargo, 0) > 0 then coalesce(v_fila.cargo, 0)
    when coalesce(v_fila.abono, 0) > 0 then coalesce(v_fila.abono, 0)
    else 0
  end;

  if v_monto_fila <= 0 then
    raise exception 'La línea bancaria no tiene monto válido';
  end if;

  if v_mov.tipo_movimiento = 'egreso' and coalesce(v_fila.cargo, 0) <= 0 then
    raise exception 'Un egreso debe conciliarse con un cargo bancario';
  end if;

  if v_mov.tipo_movimiento = 'ingreso' and coalesce(v_fila.abono, 0) <= 0 then
    raise exception 'Un ingreso debe conciliarse con un abono bancario';
  end if;

  select coalesce(sum(pp.monto_aplicado), 0)
  into v_total_pagado_anterior
  from public.banco_conciliacion_pagos_parciales pp
  where pp.movimiento_id = p_movimiento_id
    and pp.estado = 'activo';

  if v_total_pagado_anterior + v_monto_fila > v_mov.monto_total + 0.01 then
    raise exception
      'El pago excede el saldo pendiente. Total documento: %, ya pagado: %, intento aplicar: %',
      v_mov.monto_total,
      v_total_pagado_anterior,
      v_monto_fila;
  end if;

  insert into public.banco_conciliacion_pagos_parciales (
    empresa_id,
    movimiento_id,
    banco_importacion_fila_id,
    monto_aplicado,
    estado,
    observacion,
    created_by
  )
  values (
    v_mov.empresa_id,
    p_movimiento_id,
    p_banco_importacion_fila_id,
    v_monto_fila,
    'activo',
    p_observacion,
    auth.uid()
  )
  returning id into v_pago_id;

  update public.banco_importacion_filas bif
  set
    estado = 'conciliada',
    movimiento_id = p_movimiento_id,
    transferencia_bancaria_id = null,
    conciliacion_tipo = 'manual_parcial',
    diferencia_conciliacion = 0,
    conciliado_at = now(),
    conciliado_by = auth.uid(),
    observacion = coalesce(bif.observacion, '') ||
      ' | Conciliación parcial aplicada por $' || v_monto_fila::text || '.'
  where bif.id = p_banco_importacion_fila_id;

  v_total_pagado_nuevo := v_total_pagado_anterior + v_monto_fila;
  v_saldo := greatest(v_mov.monto_total - v_total_pagado_nuevo, 0);

  v_estado_pago := case
    when v_saldo <= 0.01 then 'pagado'
    else 'parcial'
  end;

  if v_estado_pago = 'pagado' then
    update public.movimientos m
    set
      estado = 'pagado',
      observaciones = coalesce(m.observaciones, '') ||
        ' | Factura pagada completamente mediante conciliación parcial.',
      updated_at = now()
    where m.id = p_movimiento_id;
  else
    update public.movimientos m
    set
      observaciones = coalesce(m.observaciones, '') ||
        ' | Pago parcial registrado por $' || v_monto_fila::text ||
        '. Saldo pendiente: $' || v_saldo::text || '.',
      updated_at = now()
    where m.id = p_movimiento_id;
  end if;

  return query
  select
    v_pago_id as pago_parcial_id,
    p_movimiento_id as movimiento_id,
    v_mov.monto_total as total_documento,
    v_total_pagado_nuevo as total_pagado,
    v_saldo as saldo_pendiente,
    v_estado_pago as estado_pago;
end;
$$;

create or replace function public.reversar_pago_parcial_bancario(
  p_pago_parcial_id uuid,
  p_observacion text default null
)
returns table (
  pago_parcial_id uuid,
  movimiento_id uuid,
  total_documento numeric,
  total_pagado numeric,
  saldo_pendiente numeric,
  estado_pago text
)
language plpgsql
security invoker
as $$
declare
  v_pago public.banco_conciliacion_pagos_parciales%rowtype;
  v_mov public.movimientos%rowtype;
  v_total_pagado_nuevo numeric;
  v_saldo numeric;
  v_estado_pago text;
begin
  select pp.*
  into v_pago
  from public.banco_conciliacion_pagos_parciales pp
  where pp.id = p_pago_parcial_id
    and pp.estado = 'activo'
  for update;

  if not found then
    raise exception 'No se encontró un pago parcial activo con ese ID';
  end if;

  select m.*
  into v_mov
  from public.movimientos m
  where m.id = v_pago.movimiento_id
  for update;

  if not found then
    raise exception 'No se encontró el movimiento asociado al pago parcial';
  end if;

  update public.banco_conciliacion_pagos_parciales pp
  set
    estado = 'reversado',
    reversado_by = auth.uid(),
    reversado_at = now(),
    observacion = coalesce(pp.observacion, '') ||
      ' | Reversado. ' || coalesce(p_observacion, '')
  where pp.id = p_pago_parcial_id;

  update public.banco_importacion_filas bif
  set
    estado = 'pendiente',
    movimiento_id = null,
    transferencia_bancaria_id = null,
    conciliacion_tipo = null,
    diferencia_conciliacion = null,
    conciliado_at = null,
    conciliado_by = null,
    observacion = coalesce(bif.observacion, '') ||
      ' | Reversa de conciliación parcial.'
  where bif.id = v_pago.banco_importacion_fila_id;

  select coalesce(sum(pp.monto_aplicado), 0)
  into v_total_pagado_nuevo
  from public.banco_conciliacion_pagos_parciales pp
  where pp.movimiento_id = v_pago.movimiento_id
    and pp.estado = 'activo';

  v_saldo := greatest(v_mov.monto_total - v_total_pagado_nuevo, 0);

  v_estado_pago := case
    when v_total_pagado_nuevo = 0 then 'sin_pagos'
    when v_saldo <= 0.01 then 'pagado'
    else 'parcial'
  end;

  update public.movimientos m
  set
    estado = case
      when v_estado_pago = 'pagado' then 'pagado'
      else m.estado
    end,
    observaciones = coalesce(m.observaciones, '') ||
      ' | Reversado pago parcial por $' || v_pago.monto_aplicado::text ||
      '. Saldo actual: $' || v_saldo::text || '.',
    updated_at = now()
  where m.id = v_pago.movimiento_id;

  return query
  select
    p_pago_parcial_id as pago_parcial_id,
    v_pago.movimiento_id as movimiento_id,
    v_mov.monto_total as total_documento,
    v_total_pagado_nuevo as total_pagado,
    v_saldo as saldo_pendiente,
    v_estado_pago as estado_pago;
end;
$$;

alter table public.banco_conciliacion_pagos_parciales enable row level security;

drop policy if exists "banco_pagos_parciales_select_empresa" on public.banco_conciliacion_pagos_parciales;
drop policy if exists "banco_pagos_parciales_insert_empresa" on public.banco_conciliacion_pagos_parciales;
drop policy if exists "banco_pagos_parciales_update_empresa" on public.banco_conciliacion_pagos_parciales;

create policy "banco_pagos_parciales_select_empresa"
on public.banco_conciliacion_pagos_parciales
for select
to authenticated
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = banco_conciliacion_pagos_parciales.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
);

create policy "banco_pagos_parciales_insert_empresa"
on public.banco_conciliacion_pagos_parciales
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = banco_conciliacion_pagos_parciales.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
);

create policy "banco_pagos_parciales_update_empresa"
on public.banco_conciliacion_pagos_parciales
for update
to authenticated
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = banco_conciliacion_pagos_parciales.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
)
with check (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = banco_conciliacion_pagos_parciales.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
);