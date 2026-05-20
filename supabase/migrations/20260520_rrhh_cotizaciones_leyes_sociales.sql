-- Migración: módulo RRHH / Cotizaciones y leyes sociales
-- Fecha: 2026-05-20
-- Descripción:
-- Crea tablas, vista, función y políticas RLS para registrar pagos previsionales
-- como egresos no afectos vinculados a cuenta bancaria.

create table if not exists public.rrhh_pagos_previsionales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,

  periodo date not null,
  fecha_pago date not null,

  tipo_pago text not null check (
    tipo_pago in (
      'previred',
      'afp',
      'fonasa',
      'isapre',
      'afc',
      'achs_mutual',
      'caja_compensacion',
      'otro'
    )
  ),

  institucion_nombre text,
  descripcion text,

  monto_total numeric(14,2) not null default 0 check (monto_total >= 0),

  cuenta_bancaria_id uuid references public.cuentas_bancarias(id),
  movimiento_id uuid references public.movimientos(id),

  estado text not null default 'pagado' check (
    estado in ('pendiente', 'pagado', 'anulado')
  ),

  comprobante_url text,
  observacion text,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rrhh_pagos_previsionales_detalle (
  id uuid primary key default gen_random_uuid(),
  pago_previsional_id uuid not null references public.rrhh_pagos_previsionales(id) on delete cascade,

  tipo_concepto text not null check (
    tipo_concepto in (
      'afp_trabajador',
      'salud_trabajador',
      'isapre_trabajador',
      'fonasa_trabajador',
      'afc_trabajador',
      'afc_empleador',
      'sis_empleador',
      'achs_mutual_empleador',
      'caja_compensacion',
      'otro'
    )
  ),

  institucion_nombre text,
  monto numeric(14,2) not null default 0 check (monto >= 0),
  observacion text,

  created_at timestamptz not null default now()
);

create index if not exists idx_rrhh_pagos_previsionales_empresa
on public.rrhh_pagos_previsionales(empresa_id);

create index if not exists idx_rrhh_pagos_previsionales_periodo
on public.rrhh_pagos_previsionales(periodo);

create index if not exists idx_rrhh_pagos_previsionales_movimiento
on public.rrhh_pagos_previsionales(movimiento_id);

create index if not exists idx_rrhh_pagos_previsionales_detalle_pago
on public.rrhh_pagos_previsionales_detalle(pago_previsional_id);

drop view if exists public.v_rrhh_pagos_previsionales_resumen;

create or replace view public.v_rrhh_pagos_previsionales_resumen as
select
  p.id,
  p.empresa_id,
  p.periodo,
  p.fecha_pago,
  p.tipo_pago,
  p.institucion_nombre,
  p.descripcion,
  p.monto_total,
  p.estado,
  p.cuenta_bancaria_id,
  trim(
    concat_ws(
      ' - ',
      cb.banco,
      cb.nombre_cuenta,
      cb.numero_cuenta
    )
  ) as cuenta_bancaria_nombre,
  p.movimiento_id,
  p.comprobante_url,
  p.observacion,
  p.created_by,
  p.created_at,
  p.updated_at,
  coalesce((
    select count(*)
    from public.rrhh_pagos_previsionales_detalle d
    where d.pago_previsional_id = p.id
  ), 0) as cantidad_detalles
from public.rrhh_pagos_previsionales p
left join public.cuentas_bancarias cb
  on cb.id = p.cuenta_bancaria_id;

create or replace function public.registrar_pago_previsional(
  p_empresa_id uuid,
  p_periodo date,
  p_fecha_pago date,
  p_tipo_pago text,
  p_institucion_nombre text,
  p_descripcion text,
  p_monto_total numeric,
  p_cuenta_bancaria_id uuid default null,
  p_categoria_id uuid default null,
  p_cuenta_contable_id uuid default null,
  p_observacion text default null,
  p_comprobante_url text default null,
  p_numero_documento text default null,
  p_crear_movimiento boolean default true
)
returns table (
  pago_previsional_id uuid,
  movimiento_id uuid
)
language plpgsql
security invoker
as $$
declare
  v_pago_id uuid;
  v_movimiento_id uuid;
  v_cuenta_contable_id uuid;
  v_descripcion text;
  v_numero_documento text;
  v_estado_pago text;
begin
  if p_empresa_id is null then
    raise exception 'Debe indicar empresa_id';
  end if;

  if p_periodo is null then
    raise exception 'Debe indicar período';
  end if;

  if p_fecha_pago is null then
    raise exception 'Debe indicar fecha de pago';
  end if;

  if p_monto_total is null or p_monto_total <= 0 then
    raise exception 'El monto total debe ser mayor a cero';
  end if;

  if p_tipo_pago not in (
    'previred',
    'afp',
    'fonasa',
    'isapre',
    'afc',
    'achs_mutual',
    'caja_compensacion',
    'otro'
  ) then
    raise exception 'Tipo de pago previsional no válido: %', p_tipo_pago;
  end if;

  if p_cuenta_bancaria_id is not null and not exists (
    select 1
    from public.cuentas_bancarias cb
    where cb.id = p_cuenta_bancaria_id
      and cb.empresa_id = p_empresa_id
      and coalesce(cb.activa, true) = true
      and cb.deleted_at is null
  ) then
    raise exception 'La cuenta bancaria no pertenece a la empresa o no está activa';
  end if;

  if p_categoria_id is not null and not exists (
    select 1
    from public.categorias c
    where c.id = p_categoria_id
      and c.empresa_id = p_empresa_id
      and coalesce(c.activa, true) = true
      and c.deleted_at is null
  ) then
    raise exception 'La categoría no pertenece a la empresa o no está activa';
  end if;

  if p_cuenta_contable_id is not null and not exists (
    select 1
    from public.cuentas_contables cc
    where cc.id = p_cuenta_contable_id
      and cc.empresa_id = p_empresa_id
      and coalesce(cc.activa, true) = true
      and cc.deleted_at is null
  ) then
    raise exception 'La cuenta contable no pertenece a la empresa o no está activa';
  end if;

  if p_categoria_id is not null then
    select c.cuenta_contable_id
    into v_cuenta_contable_id
    from public.categorias c
    where c.id = p_categoria_id;
  end if;

  v_cuenta_contable_id := coalesce(p_cuenta_contable_id, v_cuenta_contable_id);

  v_descripcion := coalesce(
    nullif(trim(p_descripcion), ''),
    'Pago previsional / leyes sociales ' || to_char(p_periodo, 'MM-YYYY')
  );

  v_numero_documento := coalesce(
    nullif(trim(p_numero_documento), ''),
    upper(p_tipo_pago) || '-' || to_char(p_periodo, 'YYYYMM')
  );

  v_estado_pago := case
    when p_crear_movimiento then 'pagado'
    else 'pendiente'
  end;

  insert into public.rrhh_pagos_previsionales (
    empresa_id,
    periodo,
    fecha_pago,
    tipo_pago,
    institucion_nombre,
    descripcion,
    monto_total,
    cuenta_bancaria_id,
    estado,
    comprobante_url,
    observacion,
    created_by,
    updated_at
  )
  values (
    p_empresa_id,
    p_periodo,
    p_fecha_pago,
    p_tipo_pago,
    p_institucion_nombre,
    v_descripcion,
    p_monto_total,
    p_cuenta_bancaria_id,
    v_estado_pago,
    p_comprobante_url,
    p_observacion,
    auth.uid(),
    now()
  )
  returning id into v_pago_id;

  if p_crear_movimiento then
    insert into public.movimientos (
      empresa_id,
      tipo_movimiento,
      fecha,
      fecha_vencimiento,
      tercero_tipo,
      categoria_id,
      cuenta_contable_id,
      cuenta_bancaria_id,
      tipo_documento,
      numero_documento,
      descripcion,
      monto_neto,
      monto_iva,
      monto_exento,
      impuesto_especifico,
      monto_total,
      estado,
      medio_pago,
      observaciones,
      tratamiento_tributario,
      activo,
      created_by,
      created_at,
      updated_at
    )
    values (
      p_empresa_id,
      'egreso',
      p_fecha_pago,
      p_fecha_pago,
      'otro',
      p_categoria_id,
      v_cuenta_contable_id,
      p_cuenta_bancaria_id,
      'comprobante',
      v_numero_documento,
      v_descripcion,
      0,
      0,
      p_monto_total,
      0,
      p_monto_total,
      'pagado',
      'transferencia',
      coalesce(p_observacion, '') || ' | Registro previsional: ' || p_tipo_pago,
      'no_afecto',
      true,
      auth.uid(),
      now(),
      now()
    )
    returning id into v_movimiento_id;

    update public.rrhh_pagos_previsionales
    set
      movimiento_id = v_movimiento_id,
      updated_at = now()
    where id = v_pago_id;
  end if;

  return query
  select v_pago_id, v_movimiento_id;
end;
$$;

alter table public.rrhh_pagos_previsionales enable row level security;
alter table public.rrhh_pagos_previsionales_detalle enable row level security;

drop policy if exists "rrhh_pagos_previsionales_select_empresa" on public.rrhh_pagos_previsionales;
drop policy if exists "rrhh_pagos_previsionales_insert_empresa" on public.rrhh_pagos_previsionales;
drop policy if exists "rrhh_pagos_previsionales_update_empresa" on public.rrhh_pagos_previsionales;

create policy "rrhh_pagos_previsionales_select_empresa"
on public.rrhh_pagos_previsionales
for select
to authenticated
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = rrhh_pagos_previsionales.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
);

create policy "rrhh_pagos_previsionales_insert_empresa"
on public.rrhh_pagos_previsionales
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = rrhh_pagos_previsionales.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
);

create policy "rrhh_pagos_previsionales_update_empresa"
on public.rrhh_pagos_previsionales
for update
to authenticated
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = rrhh_pagos_previsionales.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
)
with check (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = rrhh_pagos_previsionales.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
);

drop policy if exists "rrhh_pagos_previsionales_detalle_select_empresa" on public.rrhh_pagos_previsionales_detalle;
drop policy if exists "rrhh_pagos_previsionales_detalle_insert_empresa" on public.rrhh_pagos_previsionales_detalle;
drop policy if exists "rrhh_pagos_previsionales_detalle_update_empresa" on public.rrhh_pagos_previsionales_detalle;

create policy "rrhh_pagos_previsionales_detalle_select_empresa"
on public.rrhh_pagos_previsionales_detalle
for select
to authenticated
using (
  exists (
    select 1
    from public.rrhh_pagos_previsionales p
    join public.usuario_empresas ue
      on ue.empresa_id = p.empresa_id
    where p.id = rrhh_pagos_previsionales_detalle.pago_previsional_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
);

create policy "rrhh_pagos_previsionales_detalle_insert_empresa"
on public.rrhh_pagos_previsionales_detalle
for insert
to authenticated
with check (
  exists (
    select 1
    from public.rrhh_pagos_previsionales p
    join public.usuario_empresas ue
      on ue.empresa_id = p.empresa_id
    where p.id = rrhh_pagos_previsionales_detalle.pago_previsional_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
);

create policy "rrhh_pagos_previsionales_detalle_update_empresa"
on public.rrhh_pagos_previsionales_detalle
for update
to authenticated
using (
  exists (
    select 1
    from public.rrhh_pagos_previsionales p
    join public.usuario_empresas ue
      on ue.empresa_id = p.empresa_id
    where p.id = rrhh_pagos_previsionales_detalle.pago_previsional_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
)
with check (
  exists (
    select 1
    from public.rrhh_pagos_previsionales p
    join public.usuario_empresas ue
      on ue.empresa_id = p.empresa_id
    where p.id = rrhh_pagos_previsionales_detalle.pago_previsional_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  )
);