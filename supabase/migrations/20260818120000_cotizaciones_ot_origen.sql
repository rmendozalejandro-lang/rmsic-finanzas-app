alter table public.cotizaciones
  add column if not exists ot_origen_id uuid null;

alter table public.ot_ordenes_trabajo
  add constraint ot_ordenes_trabajo_empresa_id_id_key
  unique (empresa_id, id);

alter table public.cotizaciones
  add constraint cotizaciones_ot_origen_id_fkey
  foreign key (empresa_id, ot_origen_id)
  references public.ot_ordenes_trabajo (empresa_id, id)
  on update no action
  on delete set null (ot_origen_id);

create index if not exists idx_cotizaciones_ot_origen_id
  on public.cotizaciones (ot_origen_id)
  where ot_origen_id is not null;
