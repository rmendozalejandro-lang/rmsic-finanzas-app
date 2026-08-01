-- P8B-03 - Datos adicionales para insumos, proveedores y lotes de Tralixia Haras.
-- Migracion additive-only: conserva las entidades, llaves y politicas de P8B-01.

alter table public.vet_proveedores
  add column if not exists direccion text;

alter table public.vet_insumos
  add column if not exists presentacion text,
  add column if not exists costo_referencial numeric(14,2),
  add column if not exists observaciones text;

alter table public.vet_insumos drop constraint if exists vet_insumos_tipo_check;
update public.vet_insumos set tipo = 'material' where tipo = 'insumo';
update public.vet_insumos set tipo = 'suplemento' where tipo = 'alimento';
alter table public.vet_insumos alter column tipo set default 'medicamento';
alter table public.vet_insumos add constraint vet_insumos_tipo_check
  check (tipo in ('medicamento', 'vacuna', 'material', 'suplemento', 'equipo', 'otro'));

alter table public.vet_insumos add constraint vet_insumos_costo_referencial_check
  check (costo_referencial is null or costo_referencial >= 0) not valid;

alter table public.vet_lotes_insumo
  add column if not exists fecha_compra date,
  add column if not exists unidad text,
  add column if not exists costo_total numeric(14,2),
  add column if not exists observaciones text,
  add column if not exists activo boolean not null default true;

update public.vet_lotes_insumo
set fecha_compra = fecha_ingreso
where fecha_compra is null;

alter table public.vet_lotes_insumo alter column fecha_compra set default current_date;
alter table public.vet_lotes_insumo alter column fecha_compra set not null;
alter table public.vet_lotes_insumo drop constraint if exists vet_lotes_insumo_cantidad_inicial_check;
alter table public.vet_lotes_insumo add constraint vet_lotes_insumo_cantidad_inicial_check
  check (cantidad_inicial > 0);
alter table public.vet_lotes_insumo add constraint vet_lotes_insumo_costo_total_check
  check (costo_total is null or costo_total >= 0) not valid;

create or replace function public.vet_calcular_costo_lote()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- cc y ml comparten la misma magnitud en stock; se normalizan a ml.
  if lower(coalesce(new.unidad, '')) = 'cc' then
    new.unidad := 'ml';
  end if;
  if new.costo_total is not null and new.cantidad_inicial > 0 then
    new.costo_unitario := round(new.costo_total / new.cantidad_inicial, 2);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vet_lotes_insumo_calcular_costo on public.vet_lotes_insumo;
create trigger vet_lotes_insumo_calcular_costo
before insert or update of costo_total, cantidad_inicial, unidad
on public.vet_lotes_insumo
for each row execute function public.vet_calcular_costo_lote();

create index if not exists vet_lotes_insumo_alertas_idx
  on public.vet_lotes_insumo (empresa_id, activo, fecha_vencimiento);

comment on column public.vet_lotes_insumo.cantidad_actual is
  'Saldo real del lote; preparado para descuentos trazables por procedimientos futuros.';
