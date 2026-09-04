-- OT Viva / Asistente Tecnico RMSIC
-- Base de sesiones de terreno, eventos tecnicos, relaciones, evidencias,
-- recomendaciones y decisiones del cliente.
--
-- Principio de diseno:
--   * public.ot_ordenes_trabajo sigue siendo la OT formal.
--   * Los eventos tecnicos son la fuente cronologica de verdad del trabajo.
--   * La OT final se redacta/resume posteriormente desde estos eventos.
--   * Se preserva separacion entre informacion interna y visible al cliente.

begin;

-- Indices unicos auxiliares para claves foraneas multiempresa sin alterar
-- las claves primarias existentes.
create unique index if not exists ot_ordenes_trabajo_id_empresa_uidx
  on public.ot_ordenes_trabajo (id, empresa_id);

create unique index if not exists ot_equipos_id_empresa_uidx
  on public.ot_equipos (id, empresa_id);

create unique index if not exists ot_orden_equipos_id_empresa_ot_uidx
  on public.ot_orden_equipos (id, empresa_id, ot_id);

create unique index if not exists ot_evidencias_id_ot_uidx
  on public.ot_evidencias (id, ot_id);

create table if not exists public.ot_sesiones_terreno (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  ot_id uuid not null,
  iniciado_por uuid references public.perfiles(id),
  finalizado_por uuid references public.perfiles(id),
  iniciado_at timestamptz not null default now(),
  finalizado_at timestamptz,
  estado text not null default 'en_curso'
    check (estado in ('en_curso','pausada','finalizada','cancelada')),
  origen text not null default 'web'
    check (origen in ('web','movil','voz','lentes','ia','offline_sync')),
  observacion_inicio text,
  observacion_cierre text,
  datos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ot_id, empresa_id)
    references public.ot_ordenes_trabajo(id, empresa_id)
    on delete cascade,
  unique (id, empresa_id, ot_id),
  check (finalizado_at is null or finalizado_at >= iniciado_at)
);

create index if not exists ot_sesiones_terreno_ot_idx
  on public.ot_sesiones_terreno (empresa_id, ot_id, iniciado_at desc);

create index if not exists ot_sesiones_terreno_estado_idx
  on public.ot_sesiones_terreno (empresa_id, estado, iniciado_at desc);

create table if not exists public.ot_eventos_tecnicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  ot_id uuid not null,
  sesion_id uuid,
  usuario_id uuid references public.perfiles(id),
  equipo_id uuid,
  ot_orden_equipo_id uuid,
  tipo_evento text not null
    check (tipo_evento in (
      'hallazgo','medicion','hipotesis','prueba','accion','resultado',
      'recomendacion','pendiente','decision_cliente','observacion'
    )),
  nivel_certeza text not null default 'observado'
    check (nivel_certeza in (
      'informado','observado','medido','hipotesis','confirmado','descartado'
    )),
  texto_original text not null,
  descripcion_tecnica text,
  componente text,
  prioridad text
    check (prioridad is null or prioridad in ('baja','media','alta','critica')),
  origen text not null default 'web'
    check (origen in ('web','movil','voz','lentes','ia','offline_sync')),
  ocurrido_at timestamptz not null default now(),
  visible_cliente boolean not null default false,
  incluir_ot boolean not null default true,
  estado text not null default 'activo'
    check (estado in ('activo','corregido','anulado')),
  datos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.perfiles(id),
  updated_by uuid references public.perfiles(id),
  foreign key (ot_id, empresa_id)
    references public.ot_ordenes_trabajo(id, empresa_id)
    on delete cascade,
  foreign key (sesion_id, empresa_id, ot_id)
    references public.ot_sesiones_terreno(id, empresa_id, ot_id)
    on delete cascade,
  foreign key (equipo_id, empresa_id)
    references public.ot_equipos(id, empresa_id),
  foreign key (ot_orden_equipo_id, empresa_id, ot_id)
    references public.ot_orden_equipos(id, empresa_id, ot_id),
  unique (id, empresa_id, ot_id)
);

create index if not exists ot_eventos_tecnicos_timeline_idx
  on public.ot_eventos_tecnicos (empresa_id, ot_id, ocurrido_at, created_at);

create index if not exists ot_eventos_tecnicos_tipo_idx
  on public.ot_eventos_tecnicos (empresa_id, ot_id, tipo_evento, nivel_certeza);

create index if not exists ot_eventos_tecnicos_equipo_idx
  on public.ot_eventos_tecnicos (empresa_id, equipo_id, ocurrido_at desc)
  where equipo_id is not null;

create table if not exists public.ot_evento_relaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  ot_id uuid not null,
  evento_origen_id uuid not null,
  evento_destino_id uuid not null,
  tipo_relacion text not null
    check (tipo_relacion in (
      'origina','confirma','descarta','resultado_de','causa_de',
      'recomendacion_de','decision_sobre','relacionado_con'
    )),
  observacion text,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (evento_origen_id, empresa_id, ot_id)
    references public.ot_eventos_tecnicos(id, empresa_id, ot_id)
    on delete cascade,
  foreign key (evento_destino_id, empresa_id, ot_id)
    references public.ot_eventos_tecnicos(id, empresa_id, ot_id)
    on delete cascade,
  unique (evento_origen_id, evento_destino_id, tipo_relacion),
  check (evento_origen_id <> evento_destino_id)
);

create index if not exists ot_evento_relaciones_ot_idx
  on public.ot_evento_relaciones (empresa_id, ot_id, created_at);

create table if not exists public.ot_evento_evidencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  ot_id uuid not null,
  evento_id uuid not null,
  evidencia_id uuid not null,
  descripcion text,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (evento_id, empresa_id, ot_id)
    references public.ot_eventos_tecnicos(id, empresa_id, ot_id)
    on delete cascade,
  foreign key (evidencia_id, ot_id)
    references public.ot_evidencias(id, ot_id)
    on delete cascade,
  unique (evento_id, evidencia_id)
);

create index if not exists ot_evento_evidencias_ot_idx
  on public.ot_evento_evidencias (empresa_id, ot_id, created_at);

create table if not exists public.ot_recomendaciones_tecnicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  ot_id uuid not null,
  sesion_id uuid,
  evento_origen_id uuid,
  equipo_id uuid,
  componente text,
  descripcion text not null,
  motivo text,
  riesgo_no_intervenir text,
  prioridad text not null default 'media'
    check (prioridad in ('baja','media','alta','critica')),
  estado text not null default 'pendiente'
    check (estado in (
      'pendiente','informada','aceptada','rechazada','postergada',
      'ejecutada','no_aplica'
    )),
  visible_cliente boolean not null default true,
  informado_cliente_at timestamptz,
  fecha_objetivo date,
  ejecutada_at timestamptz,
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
    on delete set null,
  foreign key (evento_origen_id, empresa_id, ot_id)
    references public.ot_eventos_tecnicos(id, empresa_id, ot_id)
    on delete set null,
  foreign key (equipo_id, empresa_id)
    references public.ot_equipos(id, empresa_id),
  unique (id, empresa_id, ot_id),
  check (ejecutada_at is null or estado = 'ejecutada')
);

create index if not exists ot_recomendaciones_tecnicas_pendientes_idx
  on public.ot_recomendaciones_tecnicas (empresa_id, estado, prioridad, created_at desc)
  where estado in ('pendiente','informada','aceptada','postergada');

create index if not exists ot_recomendaciones_tecnicas_equipo_idx
  on public.ot_recomendaciones_tecnicas (empresa_id, equipo_id, created_at desc)
  where equipo_id is not null;

create table if not exists public.ot_decisiones_cliente (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  ot_id uuid not null,
  sesion_id uuid,
  recomendacion_id uuid,
  evento_id uuid,
  decision text not null
    check (decision in ('aceptada','rechazada','postergada','no_autorizada','informada')),
  motivo text,
  cliente_contacto_id uuid references public.cliente_contactos(id),
  nombre_snapshot text,
  cargo_snapshot text,
  observacion text,
  decidido_at timestamptz not null default now(),
  visible_cliente boolean not null default true,
  datos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos) = 'object'),
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (ot_id, empresa_id)
    references public.ot_ordenes_trabajo(id, empresa_id)
    on delete cascade,
  foreign key (sesion_id, empresa_id, ot_id)
    references public.ot_sesiones_terreno(id, empresa_id, ot_id)
    on delete set null,
  foreign key (recomendacion_id, empresa_id, ot_id)
    references public.ot_recomendaciones_tecnicas(id, empresa_id, ot_id)
    on delete set null,
  foreign key (evento_id, empresa_id, ot_id)
    references public.ot_eventos_tecnicos(id, empresa_id, ot_id)
    on delete set null,
  check (recomendacion_id is not null or evento_id is not null)
);

create index if not exists ot_decisiones_cliente_ot_idx
  on public.ot_decisiones_cliente (empresa_id, ot_id, decidido_at desc);

-- updated_at comun de las entidades editables de OT Viva.
create or replace function public.ot_viva_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ot_sesiones_terreno_set_updated_at on public.ot_sesiones_terreno;
create trigger ot_sesiones_terreno_set_updated_at
before update on public.ot_sesiones_terreno
for each row execute function public.ot_viva_set_updated_at();

drop trigger if exists ot_eventos_tecnicos_set_updated_at on public.ot_eventos_tecnicos;
create trigger ot_eventos_tecnicos_set_updated_at
before update on public.ot_eventos_tecnicos
for each row execute function public.ot_viva_set_updated_at();

drop trigger if exists ot_recomendaciones_tecnicas_set_updated_at on public.ot_recomendaciones_tecnicas;
create trigger ot_recomendaciones_tecnicas_set_updated_at
before update on public.ot_recomendaciones_tecnicas
for each row execute function public.ot_viva_set_updated_at();

-- RLS: mismo criterio multiempresa usado por las OTs actuales.
alter table public.ot_sesiones_terreno enable row level security;
alter table public.ot_eventos_tecnicos enable row level security;
alter table public.ot_evento_relaciones enable row level security;
alter table public.ot_evento_evidencias enable row level security;
alter table public.ot_recomendaciones_tecnicas enable row level security;
alter table public.ot_decisiones_cliente enable row level security;

drop policy if exists ot_sesiones_terreno_empresa_access on public.ot_sesiones_terreno;
create policy ot_sesiones_terreno_empresa_access
on public.ot_sesiones_terreno
for all to authenticated
using (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_sesiones_terreno.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
)
with check (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_sesiones_terreno.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
);

drop policy if exists ot_eventos_tecnicos_empresa_access on public.ot_eventos_tecnicos;
create policy ot_eventos_tecnicos_empresa_access
on public.ot_eventos_tecnicos
for all to authenticated
using (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_eventos_tecnicos.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
)
with check (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_eventos_tecnicos.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
);

drop policy if exists ot_evento_relaciones_empresa_access on public.ot_evento_relaciones;
create policy ot_evento_relaciones_empresa_access
on public.ot_evento_relaciones
for all to authenticated
using (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_evento_relaciones.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
)
with check (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_evento_relaciones.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
);

drop policy if exists ot_evento_evidencias_empresa_access on public.ot_evento_evidencias;
create policy ot_evento_evidencias_empresa_access
on public.ot_evento_evidencias
for all to authenticated
using (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_evento_evidencias.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
)
with check (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_evento_evidencias.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
);

drop policy if exists ot_recomendaciones_tecnicas_empresa_access on public.ot_recomendaciones_tecnicas;
create policy ot_recomendaciones_tecnicas_empresa_access
on public.ot_recomendaciones_tecnicas
for all to authenticated
using (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_recomendaciones_tecnicas.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
)
with check (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_recomendaciones_tecnicas.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
);

drop policy if exists ot_decisiones_cliente_empresa_access on public.ot_decisiones_cliente;
create policy ot_decisiones_cliente_empresa_access
on public.ot_decisiones_cliente
for all to authenticated
using (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_decisiones_cliente.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
)
with check (
  exists (
    select 1 from public.usuario_empresas ue
    where ue.empresa_id = ot_decisiones_cliente.empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true)
  )
);

grant select, insert, update, delete on
  public.ot_sesiones_terreno,
  public.ot_eventos_tecnicos,
  public.ot_evento_relaciones,
  public.ot_evento_evidencias,
  public.ot_recomendaciones_tecnicas,
  public.ot_decisiones_cliente
to authenticated;

comment on table public.ot_sesiones_terreno is
  'Sesiones reales de trabajo en terreno asociadas a una OT; una OT puede tener varias sesiones.';
comment on table public.ot_eventos_tecnicos is
  'Fuente cronologica de verdad de OT Viva: hallazgos, mediciones, hipotesis, pruebas, acciones y resultados.';
comment on table public.ot_evento_relaciones is
  'Relaciones logicas entre eventos tecnicos para reconstruir cadenas de diagnostico.';
comment on table public.ot_evento_evidencias is
  'Vincula eventos tecnicos de OT Viva con evidencias ya almacenadas en public.ot_evidencias.';
comment on table public.ot_recomendaciones_tecnicas is
  'Recomendaciones tecnicas estructuradas y trazables, incluyendo estado y riesgo de no intervenir.';
comment on table public.ot_decisiones_cliente is
  'Decisiones del cliente sobre recomendaciones, pendientes o condiciones informadas durante la intervencion.';

commit;
