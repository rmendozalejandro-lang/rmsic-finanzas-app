drop policy if exists "cotizacion_ot_relaciones_insert_empresa"
on public.cotizacion_ot_relaciones;

create policy "cotizacion_ot_relaciones_insert_empresa"
on public.cotizacion_ot_relaciones
for insert
to authenticated
with check (
  (select public.puede_administrar_empresa(empresa_id))
);

drop policy if exists "cotizacion_ot_relaciones_update_empresa"
on public.cotizacion_ot_relaciones;

create policy "cotizacion_ot_relaciones_update_empresa"
on public.cotizacion_ot_relaciones
for update
to authenticated
using (
  (select public.puede_administrar_empresa(empresa_id))
)
with check (
  (select public.puede_administrar_empresa(empresa_id))
);
