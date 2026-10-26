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

-- Validación en BD para no confiar únicamente en comprobaciones del navegador.
create or replace function public.validar_estado_lote_facturacion()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_count integer;
  v_valid integer;
begin
  if new.estado is not distinct from old.estado then return new; end if;
  if old.estado = 'facturado' or old.estado = 'anulado' then
    raise exception 'No se puede reabrir un lote facturado o anulado.';
  end if;
  if new.estado = 'listo_facturar' then
    if old.estado not in ('borrador', 'esperando_oc') then
      raise exception 'Transición no permitida hacia listo para facturar.';
    end if;
    select count(*), count(*) filter (where
      i.tipo_item = 'cotizacion'
      and c.estado = 'aprobada'
      and c.activo = true and c.deleted_at is null
      and c.ingreso_generado_id is null
      and c.empresa_id = new.empresa_id and c.cliente_id = new.cliente_id
      and coalesce(c.moneda,'CLP') = new.moneda
      and c.folio >= 31)
      into v_count, v_valid
      from public.comercial_facturacion_lote_items i
      left join public.cotizaciones c on c.id = i.cotizacion_id
      where i.lote_id = new.id and i.activo = true;
    if v_count < 2 or v_valid <> v_count then
      raise exception 'El lote necesita al menos dos cotizaciones aprobadas y elegibles.';
    end if;
  elsif new.estado = 'facturado' then
    if old.estado <> 'listo_facturar' or not exists (
      select 1 from public.comercial_facturacion_lote_facturas where lote_id = new.id
    ) then
      raise exception 'Para marcar facturado debe existir vínculo a factura.';
    end if;
  elsif new.estado not in ('borrador','esperando_oc') then
    raise exception 'Transición no permitida para el lote.';
  end if;
  return new;
end $$;

create trigger comercial_facturacion_estado_validar
before update of estado on public.comercial_facturacion_lotes
for each row execute function public.validar_estado_lote_facturacion();

-- Creación atómica de lote y cotizaciones, sin riesgo de lotes parciales.
create or replace function public.crear_lote_cotizaciones_piloto(
  p_empresa_id uuid,
  p_cotizaciones uuid[],
  p_nombre text,
  p_estado text default 'borrador',
  p_numero_oc text default null,
  p_revision_tributaria boolean default false
)
returns uuid language plpgsql security invoker set search_path=public as $$
declare
  v_cliente uuid;
  v_moneda text;
  v_lote_id uuid;
  v_total_ids integer;
  v_validos integer;
  v_distintos integer;
  v_cliente_distintos integer;
  v_moneda_distintos integer;
begin
  if auth.uid() is null or not public.puede_administrar_empresa(p_empresa_id) then
    raise exception 'Sin permiso para preparar facturación.';
  end if;
  if p_revision_tributaria is distinct from true then
    raise exception 'Debe confirmar la revisión tributaria.';
  end if;
  if p_estado not in ('borrador','esperando_oc') or nullif(trim(p_nombre),'') is null then
    raise exception 'Nombre o estado del lote inválido.';
  end if;
  v_total_ids := coalesce(array_length(p_cotizaciones,1),0);
  if v_total_ids < 2 then raise exception 'Seleccione al menos dos cotizaciones.'; end if;
  select count(distinct x) into v_distintos from unnest(p_cotizaciones) x;
  if v_distintos <> v_total_ids then raise exception 'Hay cotizaciones repetidas.'; end if;
  -- Bloquear todas las filas en orden determinista hasta que termine la transacción.
  perform 1 from public.cotizaciones c where c.id=any(p_cotizaciones) order by c.id for update;
  select count(*),count(distinct c.cliente_id),count(distinct coalesce(c.moneda,'CLP')),
         min(c.cliente_id),min(coalesce(c.moneda,'CLP'))
    into v_validos,v_cliente_distintos,v_moneda_distintos,v_cliente,v_moneda
    from public.cotizaciones c
    where c.id=any(p_cotizaciones)
      and c.empresa_id=p_empresa_id and c.estado='aprobada'
      and c.activo=true and c.deleted_at is null
      and c.folio>=31 and c.cliente_id is not null and c.ingreso_generado_id is null
      and not exists (
        select 1 from public.comercial_facturacion_lote_items i
        where i.cotizacion_id=c.id and i.activo=true
      );
  if v_validos <> v_total_ids or v_cliente_distintos <> 1 or v_moneda_distintos <> 1 then
    raise exception 'Las cotizaciones no son elegibles o pertenecen a distintos clientes/monedas.';
  end if;
  insert into public.comercial_facturacion_lotes(empresa_id,cliente_id,nombre,estado,moneda,numero_oc,created_by)
  values (p_empresa_id,v_cliente,trim(p_nombre),p_estado,v_moneda,nullif(trim(coalesce(p_numero_oc,'')),''),auth.uid())
  returning id into v_lote_id;
  insert into public.comercial_facturacion_lote_items(
    empresa_id,lote_id,tipo_item,cotizacion_id,monto_referencia,created_by
  )
  select p_empresa_id,v_lote_id,'cotizacion',c.id,c.total,auth.uid()
  from public.cotizaciones c where c.id=any(p_cotizaciones);
  return v_lote_id;
end $$;

revoke all on function public.crear_lote_cotizaciones_piloto(uuid,uuid[],text,text,text,boolean) from public;
grant execute on function public.crear_lote_cotizaciones_piloto(uuid,uuid[],text,text,text,boolean) to authenticated;
