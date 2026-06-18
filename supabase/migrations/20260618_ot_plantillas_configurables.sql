-- =========================================================
-- Auren OT - Plantillas configurables por empresa
-- RMSIC estándar / DyF Softys
-- =========================================================

create table if not exists public.ot_plantillas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  vista_principal text not null default 'detalle'
    check (vista_principal in ('detalle', 'informe_softys', 'informe_custom')),
  ruta_principal text not null default '/ot/{id}',
  ruta_base text not null default '/ot/{id}',
  ruta_pdf text,
  requiere_equipo boolean not null default false,
  usa_checklist boolean not null default false,
  checklist_plantilla_codigo text,
  informe_codigo text,
  es_predeterminada boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint ux_ot_plantillas_empresa_codigo unique (empresa_id, codigo)
);

create index if not exists idx_ot_plantillas_empresa
  on public.ot_plantillas (empresa_id);

create index if not exists idx_ot_plantillas_empresa_activo
  on public.ot_plantillas (empresa_id, activo);

create unique index if not exists ux_ot_plantillas_predeterminada_empresa
  on public.ot_plantillas (empresa_id)
  where es_predeterminada = true and activo = true;

drop trigger if exists trg_ot_plantillas_updated_at on public.ot_plantillas;

create trigger trg_ot_plantillas_updated_at
before update on public.ot_plantillas
for each row
execute function public.ot_set_updated_at();

alter table public.ot_ordenes_trabajo
add column if not exists plantilla_id uuid references public.ot_plantillas(id);

create index if not exists idx_ot_ordenes_trabajo_plantilla
  on public.ot_ordenes_trabajo (plantilla_id);

alter table public.ot_plantillas enable row level security;

drop policy if exists "ot_plantillas_select_empresa" on public.ot_plantillas;
create policy "ot_plantillas_select_empresa"
on public.ot_plantillas
for select
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = ot_plantillas.empresa_id
      and ue.usuario_id = auth.uid()
      and ue.activo = true
  )
);

drop policy if exists "ot_plantillas_insert_empresa" on public.ot_plantillas;
create policy "ot_plantillas_insert_empresa"
on public.ot_plantillas
for insert
with check (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = ot_plantillas.empresa_id
      and ue.usuario_id = auth.uid()
      and ue.activo = true
  )
);

drop policy if exists "ot_plantillas_update_empresa" on public.ot_plantillas;
create policy "ot_plantillas_update_empresa"
on public.ot_plantillas
for update
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = ot_plantillas.empresa_id
      and ue.usuario_id = auth.uid()
      and ue.activo = true
  )
)
with check (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = ot_plantillas.empresa_id
      and ue.usuario_id = auth.uid()
      and ue.activo = true
  )
);

drop policy if exists "ot_plantillas_delete_empresa" on public.ot_plantillas;
create policy "ot_plantillas_delete_empresa"
on public.ot_plantillas
for delete
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = ot_plantillas.empresa_id
      and ue.usuario_id = auth.uid()
      and ue.activo = true
  )
);

-- Evitar conflicto si ya existía una plantilla predeterminada distinta
update public.ot_plantillas p
set es_predeterminada = false,
    updated_at = now()
from public.empresas e
where e.id = p.empresa_id
  and (
    lower(e.nombre) like '%rmsic%'
    or lower(e.razon_social) like '%rm servicios%'
  )
  and p.codigo <> 'rmsic_estandar';

insert into public.ot_plantillas (
  empresa_id,
  codigo,
  nombre,
  descripcion,
  vista_principal,
  ruta_principal,
  ruta_base,
  ruta_pdf,
  requiere_equipo,
  usa_checklist,
  checklist_plantilla_codigo,
  informe_codigo,
  es_predeterminada,
  activo
)
select
  e.id,
  'rmsic_estandar',
  'OT estándar RMSIC',
  'Plantilla estándar para informes de servicio en terreno RMSIC.',
  'detalle',
  '/ot/{id}',
  '/ot/{id}',
  '/ot/{id}/pdf',
  false,
  false,
  null,
  'rmsic_estandar',
  true,
  true
from public.empresas e
where lower(e.nombre) like '%rmsic%'
   or lower(e.razon_social) like '%rm servicios%'
on conflict (empresa_id, codigo)
do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  vista_principal = excluded.vista_principal,
  ruta_principal = excluded.ruta_principal,
  ruta_base = excluded.ruta_base,
  ruta_pdf = excluded.ruta_pdf,
  requiere_equipo = excluded.requiere_equipo,
  usa_checklist = excluded.usa_checklist,
  checklist_plantilla_codigo = excluded.checklist_plantilla_codigo,
  informe_codigo = excluded.informe_codigo,
  es_predeterminada = excluded.es_predeterminada,
  activo = true,
  updated_at = now();

update public.ot_plantillas p
set es_predeterminada = false,
    updated_at = now()
from public.empresas e
where e.id = p.empresa_id
  and (
    lower(e.nombre) like '%dyf%'
    or lower(e.razon_social) like '%dyf%'
    or e.rut = '76778948-3'
  )
  and p.codigo <> 'softys_om';

insert into public.ot_plantillas (
  empresa_id,
  codigo,
  nombre,
  descripcion,
  vista_principal,
  ruta_principal,
  ruta_base,
  ruta_pdf,
  requiere_equipo,
  usa_checklist,
  checklist_plantilla_codigo,
  informe_codigo,
  es_predeterminada,
  activo
)
select
  e.id,
  'softys_om',
  'Informe OM Softys',
  'Plantilla de informe técnico DyF / Softys con equipo, checklist técnico y PDF.',
  'informe_softys',
  '/ot/{id}/informe-softys',
  '/ot/{id}/base',
  '/ot/{id}/informe-softys',
  true,
  true,
  'motor_mt_post_mantencion',
  'softys_om',
  true,
  true
from public.empresas e
where lower(e.nombre) like '%dyf%'
   or lower(e.razon_social) like '%dyf%'
   or e.rut = '76778948-3'
on conflict (empresa_id, codigo)
do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  vista_principal = excluded.vista_principal,
  ruta_principal = excluded.ruta_principal,
  ruta_base = excluded.ruta_base,
  ruta_pdf = excluded.ruta_pdf,
  requiere_equipo = excluded.requiere_equipo,
  usa_checklist = excluded.usa_checklist,
  checklist_plantilla_codigo = excluded.checklist_plantilla_codigo,
  informe_codigo = excluded.informe_codigo,
  es_predeterminada = excluded.es_predeterminada,
  activo = true,
  updated_at = now();

update public.ot_ordenes_trabajo ot
set plantilla_id = p.id,
    updated_at = now()
from public.ot_plantillas p
join public.empresas e on e.id = p.empresa_id
where p.empresa_id = ot.empresa_id
  and p.codigo = 'rmsic_estandar'
  and ot.plantilla_id is null
  and (
    lower(e.nombre) like '%rmsic%'
    or lower(e.razon_social) like '%rm servicios%'
  );

update public.ot_ordenes_trabajo ot
set plantilla_id = p.id,
    updated_at = now()
from public.ot_plantillas p
join public.empresas e on e.id = p.empresa_id
where p.empresa_id = ot.empresa_id
  and p.codigo = 'softys_om'
  and ot.plantilla_id is null
  and (
    lower(e.nombre) like '%dyf%'
    or lower(e.razon_social) like '%dyf%'
    or e.rut = '76778948-3'
  );
