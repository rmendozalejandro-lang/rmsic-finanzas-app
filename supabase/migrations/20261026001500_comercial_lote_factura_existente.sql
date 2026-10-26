-- PR #84: vínculo exclusivamente documental entre lote comercial y una factura YA registrada.
-- No inserta movimientos, no emite DTE y no crea cuentas por cobrar.
create table public.comercial_facturacion_lote_facturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  lote_id uuid not null references public.comercial_facturacion_lotes(id),
  movimiento_id uuid not null references public.movimientos(id),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  constraint comercial_lote_facturas_lote_unico unique (lote_id),
  constraint comercial_lote_facturas_movimiento_unico unique (movimiento_id)
);

create or replace function public.validar_factura_agrupada()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_lote public.comercial_facturacion_lotes%rowtype;
  v_mov public.movimientos%rowtype;
  v_cantidad integer;
  v_total numeric(18,2);
begin
  select * into v_lote from public.comercial_facturacion_lotes where id=new.lote_id for update;
  if not found or v_lote.activo is distinct from true or v_lote.estado not in ('listo_facturar','facturado') then
    raise exception 'El lote debe estar activo y listo para facturar.';
  end if;
  select * into v_mov from public.movimientos where id=new.movimiento_id for update;
  if not found or v_mov.activo is distinct from true or v_mov.deleted_at is not null
    or v_mov.tipo_movimiento <> 'ingreso' or v_mov.estado = 'anulado'
    or v_mov.tipo_documento not in ('factura','factura_exenta')
    or nullif(trim(coalesce(v_mov.numero_documento,'')),'') is null then
    raise exception 'Seleccione un ingreso existente con factura válida.';
  end if;
  if new.empresa_id <> v_lote.empresa_id or v_mov.empresa_id <> v_lote.empresa_id
     or v_mov.cliente_id is distinct from v_lote.cliente_id then
    raise exception 'Empresa o cliente distintos entre lote y factura.';
  end if;
  if v_mov.origen_tipo is not null or v_mov.origen_id is not null then
    raise exception 'El ingreso ya tiene otro documento de origen. Revise la trazabilidad antes de vincular.';
  end if;
  select count(*), coalesce(sum(c.total),0)
    into v_cantidad,v_total
    from public.comercial_facturacion_lote_items i
    join public.cotizaciones c on c.id=i.cotizacion_id
    where i.lote_id=v_lote.id and i.activo=true and i.tipo_item='cotizacion'
      and c.activo=true and c.deleted_at is null and c.estado='aprobada'
      and c.ingreso_generado_id is null and c.empresa_id=v_lote.empresa_id
      and c.cliente_id=v_lote.cliente_id and coalesce(c.moneda,'CLP')=v_lote.moneda;
  if v_cantidad < 2 or v_cantidad <> (
    select count(*) from public.comercial_facturacion_lote_items
    where lote_id=v_lote.id and activo=true
  ) then
    raise exception 'El lote requiere al menos dos cotizaciones aprobadas, válidas y sin ingreso previo.';
  end if;
  if round(v_total,2) <> round(v_mov.monto_total,2) then
    raise exception 'La factura y el total de cotizaciones no coinciden.';
  end if;
  if exists (
    select 1 from public.comercial_facturacion_lote_items i
    join public.comercial_facturacion_lote_facturas f on f.lote_id=i.lote_id
    where i.activo=true and i.cotizacion_id in (
      select cotizacion_id from public.comercial_facturacion_lote_items
      where lote_id=v_lote.id and activo=true and cotizacion_id is not null
    ) and f.lote_id <> v_lote.id
  ) then
    raise exception 'Al menos una cotización ya está asociada a otra factura agrupada.';
  end if;
  if exists (
    select 1 from public.cuentas_por_cobrar c
    where c.movimiento_id=v_mov.id and c.activo=true and c.deleted_at is null
    having count(*) > 1
  ) then
    raise exception 'El ingreso tiene más de una cuenta por cobrar activa; revisar antes de vincular.';
  end if;
  return new;
end $$;

create trigger comercial_facturacion_lote_facturas_validar
before insert or update on public.comercial_facturacion_lote_facturas
for each row execute function public.validar_factura_agrupada();

alter table public.comercial_facturacion_lote_facturas enable row level security;
create policy comercial_lote_facturas_ver
on public.comercial_facturacion_lote_facturas for select to authenticated
using (public.usuario_tiene_empresa(empresa_id));
create policy comercial_lote_facturas_crear
on public.comercial_facturacion_lote_facturas for insert to authenticated
with check (
  public.puede_administrar_empresa(empresa_id)
  and created_by=auth.uid()
);
-- No se permite editar ni borrar el vínculo sin un flujo controlado de reversión.

comment on table public.comercial_facturacion_lote_facturas is
  'Vincula una agrupación comercial con un ingreso de factura previamente registrado; no crea efectos financieros.';
