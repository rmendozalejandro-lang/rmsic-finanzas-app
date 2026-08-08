-- Capa comercial para preparar trabajos para facturacion.
-- Esta migracion no crea documentos tributarios ni efectos financieros.

create table public.comercial_facturacion_lotes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  cliente_id uuid not null,
  nombre text not null,
  estado text not null default 'borrador',
  fecha_desde date,
  fecha_hasta date,
  moneda text not null default 'CLP',
  numero_oc text,
  fecha_oc date,
  observacion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint comercial_facturacion_lotes_empresa_fk
    foreign key (empresa_id) references public.empresas (id) on delete restrict,
  constraint comercial_facturacion_lotes_cliente_fk
    foreign key (cliente_id) references public.clientes (id) on delete restrict,
  constraint comercial_facturacion_lotes_estado_check
    check (estado in ('borrador', 'esperando_oc', 'listo_facturar', 'facturado', 'anulado'))
);

comment on table public.comercial_facturacion_lotes is
  'Agrupaciones comerciales en preparacion para facturacion; no representan documentos tributarios ni movimientos financieros.';

create table public.comercial_facturacion_lote_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  lote_id uuid not null,
  tipo_item text not null,
  ot_id uuid,
  cotizacion_id uuid,
  monto_referencia numeric(18,2),
  observacion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint comercial_facturacion_lote_items_empresa_fk
    foreign key (empresa_id) references public.empresas (id) on delete restrict,
  constraint comercial_facturacion_lote_items_lote_fk
    foreign key (lote_id) references public.comercial_facturacion_lotes (id) on delete restrict,
  constraint comercial_facturacion_lote_items_ot_fk
    foreign key (ot_id) references public.ot_ordenes_trabajo (id) on delete restrict,
  constraint comercial_facturacion_lote_items_cotizacion_fk
    foreign key (cotizacion_id) references public.cotizaciones (id) on delete restrict,
  constraint comercial_facturacion_lote_items_tipo_check
    check (tipo_item in ('ot', 'cotizacion')),
  constraint comercial_facturacion_lote_items_origen_check
    check (
      (tipo_item = 'ot' and ot_id is not null and cotizacion_id is null)
      or
      (tipo_item = 'cotizacion' and cotizacion_id is not null and ot_id is null)
    ),
  constraint comercial_facturacion_lote_items_monto_check
    check (monto_referencia is null or monto_referencia >= 0)
);

comment on column public.comercial_facturacion_lote_items.monto_referencia is
  'Referencia comercial para agrupacion o facturacion parcial; no es un monto financiero ni tributario definitivo.';

create index comercial_facturacion_lotes_empresa_activo_idx
  on public.comercial_facturacion_lotes (empresa_id, activo);
create index comercial_facturacion_lotes_cliente_activo_idx
  on public.comercial_facturacion_lotes (cliente_id, activo);
create index comercial_facturacion_lotes_estado_activo_idx
  on public.comercial_facturacion_lotes (estado, activo);

create index comercial_facturacion_lote_items_empresa_activo_idx
  on public.comercial_facturacion_lote_items (empresa_id, activo);
create index comercial_facturacion_lote_items_lote_activo_idx
  on public.comercial_facturacion_lote_items (lote_id, activo);
create index comercial_facturacion_lote_items_ot_idx
  on public.comercial_facturacion_lote_items (ot_id)
  where ot_id is not null;
create index comercial_facturacion_lote_items_cotizacion_idx
  on public.comercial_facturacion_lote_items (cotizacion_id)
  where cotizacion_id is not null;

create unique index comercial_facturacion_lote_items_lote_ot_activo_ux
  on public.comercial_facturacion_lote_items (lote_id, ot_id)
  where activo = true and ot_id is not null;
create unique index comercial_facturacion_lote_items_lote_cotizacion_activo_ux
  on public.comercial_facturacion_lote_items (lote_id, cotizacion_id)
  where activo = true and cotizacion_id is not null;

create function public.validar_comercial_facturacion_lote()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.empresa_id is distinct from old.empresa_id
        or new.cliente_id is distinct from old.cliente_id)
       and exists (
         select 1
           from public.comercial_facturacion_lote_items
          where lote_id = old.id
            and activo = true
       ) then
      raise exception 'No se puede cambiar la empresa o el cliente de un lote que contiene items activos. Quite o desactive primero los items asociados.'
        using errcode = '23514';
    end if;
  end if;

  if not exists (
    select 1
      from public.empresas
     where id = new.empresa_id
  ) then
    raise exception 'La empresa % no existe', new.empresa_id
      using errcode = '23503';
  end if;

  if not exists (
    select 1
      from public.clientes
     where id = new.cliente_id
       and empresa_id = new.empresa_id
       and activo = true
       and deleted_at is null
  ) then
    raise exception 'El cliente % no existe, esta inactivo, esta eliminado o no pertenece a la empresa %', new.cliente_id, new.empresa_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger comercial_facturacion_lotes_validar_trg
before insert or update of empresa_id, cliente_id
on public.comercial_facturacion_lotes
for each row execute function public.validar_comercial_facturacion_lote();

create function public.validar_comercial_facturacion_lote_item()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lote public.comercial_facturacion_lotes%rowtype;
  v_origen_empresa_id uuid;
  v_origen_cliente_id uuid;
begin
  select *
    into v_lote
    from public.comercial_facturacion_lotes
   where id = new.lote_id;

  if not found then
    raise exception 'El lote de facturacion % no existe', new.lote_id
      using errcode = '23503';
  end if;

  if new.empresa_id <> v_lote.empresa_id then
    raise exception 'La empresa del item debe coincidir con la empresa del lote'
      using errcode = '23514';
  end if;

  if new.tipo_item = 'ot' then
    select empresa_id, cliente_id
      into v_origen_empresa_id, v_origen_cliente_id
      from public.ot_ordenes_trabajo
     where id = new.ot_id
       and activo = true
       and deleted_at is null;

    if not found then
      raise exception 'La OT % no existe, esta inactiva o esta eliminada', new.ot_id
        using errcode = '23503';
    end if;
  elsif new.tipo_item = 'cotizacion' then
    select empresa_id, cliente_id
      into v_origen_empresa_id, v_origen_cliente_id
      from public.cotizaciones
     where id = new.cotizacion_id
       and activo = true
       and deleted_at is null;

    if not found then
      raise exception 'La cotizacion % no existe, esta inactiva o esta eliminada', new.cotizacion_id
        using errcode = '23503';
    end if;

    if v_origen_cliente_id is null then
      raise exception 'La cotizacion % no tiene cliente', new.cotizacion_id
        using errcode = '23514';
    end if;
  end if;

  if v_origen_empresa_id <> v_lote.empresa_id then
    raise exception 'La empresa del documento debe coincidir con la empresa del lote'
      using errcode = '23514';
  end if;

  if v_origen_cliente_id is distinct from v_lote.cliente_id then
    raise exception 'El cliente del documento debe coincidir con el cliente del lote'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger comercial_facturacion_lote_items_validar_trg
before insert or update on public.comercial_facturacion_lote_items
for each row execute function public.validar_comercial_facturacion_lote_item();

create function public.proteger_cotizacion_facturacion_lote()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (new.empresa_id is distinct from old.empresa_id
      or new.cliente_id is distinct from old.cliente_id)
     and exists (
       select 1
         from public.comercial_facturacion_lote_items
        where cotizacion_id = old.id
          and activo = true
     ) then
    raise exception 'No se puede cambiar la empresa o el cliente de una cotizacion asociada a un lote de facturacion activo. Quite o desactive primero la relacion de facturacion.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger cotizaciones_proteger_facturacion_lote_trg
before update of empresa_id, cliente_id
on public.cotizaciones
for each row execute function public.proteger_cotizacion_facturacion_lote();

create function public.proteger_ot_facturacion_lote()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (new.empresa_id is distinct from old.empresa_id
      or new.cliente_id is distinct from old.cliente_id)
     and exists (
       select 1
         from public.comercial_facturacion_lote_items
        where ot_id = old.id
          and activo = true
     ) then
    raise exception 'No se puede cambiar la empresa o el cliente de una OT asociada a un lote de facturacion activo. Quite o desactive primero la relacion de facturacion.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger ot_ordenes_trabajo_proteger_facturacion_lote_trg
before update of empresa_id, cliente_id
on public.ot_ordenes_trabajo
for each row execute function public.proteger_ot_facturacion_lote();

create trigger comercial_facturacion_lotes_updated_at_trg
before update on public.comercial_facturacion_lotes
for each row execute function public.set_updated_at();

create trigger comercial_facturacion_lote_items_updated_at_trg
before update on public.comercial_facturacion_lote_items
for each row execute function public.set_updated_at();

alter table public.comercial_facturacion_lotes enable row level security;
alter table public.comercial_facturacion_lote_items enable row level security;

create policy comercial_facturacion_lotes_select_empresa
on public.comercial_facturacion_lotes
for select to authenticated
using ((select public.usuario_tiene_empresa(empresa_id)));

create policy comercial_facturacion_lotes_insert_empresa
on public.comercial_facturacion_lotes
for insert to authenticated
with check ((select public.puede_administrar_empresa(empresa_id)));

create policy comercial_facturacion_lotes_update_empresa
on public.comercial_facturacion_lotes
for update to authenticated
using ((select public.puede_administrar_empresa(empresa_id)))
with check ((select public.puede_administrar_empresa(empresa_id)));

create policy comercial_facturacion_lote_items_select_empresa
on public.comercial_facturacion_lote_items
for select to authenticated
using ((select public.usuario_tiene_empresa(empresa_id)));

create policy comercial_facturacion_lote_items_insert_empresa
on public.comercial_facturacion_lote_items
for insert to authenticated
with check ((select public.puede_administrar_empresa(empresa_id)));

create policy comercial_facturacion_lote_items_update_empresa
on public.comercial_facturacion_lote_items
for update to authenticated
using ((select public.puede_administrar_empresa(empresa_id)))
with check ((select public.puede_administrar_empresa(empresa_id)));

create view public.v_comercial_facturacion_lotes_resumen
with (security_invoker = true)
as
select
  l.id as lote_id,
  l.empresa_id,
  l.cliente_id,
  c.nombre as cliente_nombre,
  l.nombre as lote_nombre,
  l.estado,
  l.fecha_desde,
  l.fecha_hasta,
  l.moneda,
  l.numero_oc,
  l.fecha_oc,
  l.observacion,
  l.activo,
  l.created_at,
  l.updated_at,
  count(i.id) filter (where i.activo) as cantidad_items,
  count(i.id) filter (where i.activo and i.tipo_item = 'ot') as cantidad_ot,
  count(i.id) filter (where i.activo and i.tipo_item = 'cotizacion') as cantidad_cotizaciones,
  coalesce(sum(i.monto_referencia) filter (where i.activo), 0::numeric) as suma_monto_referencia
from public.comercial_facturacion_lotes l
join public.clientes c on c.id = l.cliente_id
left join public.comercial_facturacion_lote_items i on i.lote_id = l.id
group by l.id, c.id, c.nombre;

create view public.v_comercial_facturacion_lote_items_detalle
with (security_invoker = true)
as
select
  i.id as item_id,
  i.empresa_id,
  i.lote_id,
  i.tipo_item,
  i.ot_id,
  ot.folio as ot_folio,
  ot.titulo as ot_titulo,
  ot.fecha_ot,
  oe.nombre as ot_estado,
  otc.id as ot_cliente_id,
  otc.nombre as ot_cliente_nombre,
  i.cotizacion_id,
  cot.codigo as cotizacion_codigo,
  cot.titulo as cotizacion_titulo,
  cot.estado as cotizacion_estado,
  cot.fecha_emision as cotizacion_fecha_emision,
  cot.total as cotizacion_total,
  cot.moneda as cotizacion_moneda,
  cc.id as cotizacion_cliente_id,
  cc.nombre as cotizacion_cliente_nombre,
  i.monto_referencia,
  i.observacion,
  i.activo,
  i.created_at,
  i.updated_at
from public.comercial_facturacion_lote_items i
left join public.ot_ordenes_trabajo ot on ot.id = i.ot_id
left join public.ot_estados oe on oe.id = ot.estado_id
left join public.clientes otc on otc.id = ot.cliente_id
left join public.cotizaciones cot on cot.id = i.cotizacion_id
left join public.clientes cc on cc.id = cot.cliente_id;

grant select, insert, update on public.comercial_facturacion_lotes to authenticated;
grant select, insert, update on public.comercial_facturacion_lote_items to authenticated;
grant select on public.v_comercial_facturacion_lotes_resumen to authenticated;
grant select on public.v_comercial_facturacion_lote_items_detalle to authenticated;
