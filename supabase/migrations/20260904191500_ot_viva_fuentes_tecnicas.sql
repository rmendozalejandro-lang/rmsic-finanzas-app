-- OT Viva / Asistente Tecnico RMSIC
-- Fuentes tecnicas externas y su relacion con eventos de terreno.
--
-- Principio:
--   * Una fuente externa nunca reemplaza un hecho observado o medido.
--   * La fuente conserva procedencia, autoridad y aplicabilidad al caso.
--   * La validacion en terreno ocurre mediante eventos y relaciones trazables.

begin;

create table if not exists public.ot_fuentes_tecnicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  ot_id uuid not null,
  sesion_id uuid,
  equipo_id uuid,
  ot_orden_equipo_id uuid,
  registrado_por uuid references public.perfiles(id),
  origen_registro text not null default 'tecnico'
    check (origen_registro in ('tecnico','asistente','voz','importado')),
  tipo_fuente text not null
    check (tipo_fuente in (
      'manual_oficial',
      'datasheet_oficial',
      'boletin_servicio',
      'web_fabricante',
      'norma',
      'distribuidor_tecnico',
      'documentacion_tecnica',
      'comunidad',
      'video_tecnico',
      'otro'
    )),
  nivel_autoridad text not null default 'desconocida'
    check (nivel_autoridad in (
      'oficial_fabricante',
      'oficial_normativa',
      'distribuidor_autorizado',
      'tecnica_secundaria',
      'comunidad',
      'desconocida'
    )),
  estado_aplicabilidad text not null default 'encontrada'
    check (estado_aplicabilidad in (
      'encontrada',
      'revisada',
      'aplicable',
      'validada_terreno',
      'descartada'
    )),
  titulo text not null,
  fabricante text,
  codigo_documento text,
  revision text,
  url text,
  dominio text,
  fecha_documento date,
  consultado_at timestamptz not null default now(),
  referencia_relevante text,
  conclusion_tecnica text,
  motivo_aplicabilidad text,
  datos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos) = 'object'),
  created_by uuid default auth.uid() references public.perfiles(id),
  updated_by uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ot_id, empresa_id)
    references public.ot_ordenes_trabajo(id, empresa_id)
    on delete cascade,
  foreign key (sesion_id, empresa_id, ot_id)
    references public.ot_sesiones_terreno(id, empresa_id, ot_id)
    on delete no action,
  foreign key (equipo_id, empresa_id)
    references public.ot_equipos(id, empresa_id)
    on delete no action,
  foreign key (ot_orden_equipo_id, empresa_id, ot_id)
    references public.ot_orden_equipos(id, empresa_id, ot_id)
    on delete no action,
  unique (id, empresa_id, ot_id)
);

create index if not exists ot_fuentes_tecnicas_ot_idx
  on public.ot_fuentes_tecnicas (empresa_id, ot_id, consultado_at desc);

create index if not exists ot_fuentes_tecnicas_equipo_idx
  on public.ot_fuentes_tecnicas (empresa_id, equipo_id, consultado_at desc)
  where equipo_id is not null;

create index if not exists ot_fuentes_tecnicas_orden_equipo_idx
  on public.ot_fuentes_tecnicas (empresa_id, ot_id, ot_orden_equipo_id, consultado_at desc)
  where ot_orden_equipo_id is not null;

create index if not exists ot_fuentes_tecnicas_aplicabilidad_idx
  on public.ot_fuentes_tecnicas (empresa_id, estado_aplicabilidad, nivel_autoridad, consultado_at desc);

create table if not exists public.ot_evento_fuentes_tecnicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  ot_id uuid not null,
  evento_id uuid not null,
  fuente_tecnica_id uuid not null,
  tipo_uso text not null default 'contexto'
    check (tipo_uso in (
      'contexto',
      'sustenta',
      'contradice',
      'orienta_prueba',
      'resultado_validacion'
    )),
  observacion text,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (evento_id, empresa_id, ot_id)
    references public.ot_eventos_tecnicos(id, empresa_id, ot_id)
    on delete cascade,
  foreign key (fuente_tecnica_id, empresa_id, ot_id)
    references public.ot_fuentes_tecnicas(id, empresa_id, ot_id)
    on delete no action,
  unique (evento_id, fuente_tecnica_id, tipo_uso)
);

create index if not exists ot_evento_fuentes_tecnicas_ot_idx
  on public.ot_evento_fuentes_tecnicas (empresa_id, ot_id, created_at);

create index if not exists ot_evento_fuentes_tecnicas_fuente_idx
  on public.ot_evento_fuentes_tecnicas (empresa_id, fuente_tecnica_id, created_at);

-- updated_at para fuentes tecnicas.
drop trigger if exists ot_fuentes_tecnicas_set_updated_at on public.ot_fuentes_tecnicas;
create trigger ot_fuentes_tecnicas_set_updated_at
before update on public.ot_fuentes_tecnicas
for each row execute function public.ot_viva_set_updated_at();

-- RLS: mismo criterio multiempresa de OT Viva.
alter table public.ot_fuentes_tecnicas enable row level security;
alter table public.ot_evento_fuentes_tecnicas enable row level security;

drop policy if exists ot_fuentes_tecnicas_empresa_access on public.ot_fuentes_tecnicas;
create policy ot_fuentes_tecnicas_empresa_access
on public.ot_fuentes_tecnicas
for all to authenticated
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = ot_fuentes_tecnicas.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
)
with check (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = ot_fuentes_tecnicas.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
);

drop policy if exists ot_evento_fuentes_tecnicas_empresa_access on public.ot_evento_fuentes_tecnicas;
create policy ot_evento_fuentes_tecnicas_empresa_access
on public.ot_evento_fuentes_tecnicas
for all to authenticated
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = ot_evento_fuentes_tecnicas.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
)
with check (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = ot_evento_fuentes_tecnicas.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
);

grant select, insert, update, delete on public.ot_fuentes_tecnicas to authenticated;
grant select, insert, update, delete on public.ot_evento_fuentes_tecnicas to authenticated;

comment on table public.ot_fuentes_tecnicas is
  'Referencias tecnicas externas consultadas durante una OT. Su aplicabilidad al caso se conserva separada de los hechos observados y medidos.';

comment on column public.ot_fuentes_tecnicas.estado_aplicabilidad is
  'Ciclo de uso de la fuente en el caso: encontrada, revisada, aplicable, validada en terreno o descartada.';

comment on column public.ot_fuentes_tecnicas.nivel_autoridad is
  'Jerarquia de procedencia usada por el Asistente RMSIC para ponderar la fuente sin confundir autoridad con aplicabilidad al caso.';

comment on column public.ot_fuentes_tecnicas.referencia_relevante is
  'Referencia breve al contenido relevante. No pretende almacenar una copia completa del documento o pagina.';

comment on table public.ot_evento_fuentes_tecnicas is
  'Vincula una fuente tecnica con el evento que contextualiza, sustenta, contradice u orienta una prueba o validacion.';

commit;
