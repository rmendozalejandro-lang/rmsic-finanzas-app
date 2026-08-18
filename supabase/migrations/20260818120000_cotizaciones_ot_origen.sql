alter table public.cotizaciones
  add column if not exists ot_origen_id uuid null;

alter table public.cotizaciones
  add constraint cotizaciones_ot_origen_id_fkey
  foreign key (ot_origen_id)
  references public.ot_ordenes_trabajo (id)
  on update cascade
  on delete set null;

create index if not exists idx_cotizaciones_ot_origen_id
  on public.cotizaciones (ot_origen_id)
  where ot_origen_id is not null;
