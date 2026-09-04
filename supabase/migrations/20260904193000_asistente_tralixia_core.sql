-- Asistente Tralixia / Motor transversal de casos y eventos
--
-- Este nucleo NO pertenece a un solo modulo. Sirve como memoria estructurada
-- para OT/casos tecnicos, Seguridad-PTS, Veterinaria y futuros dominios.
--
-- Principios:
--   * El caso es el contenedor de contexto; una OT/PTS/parto puede vincularse
--     despues y no es requisito para comenzar a registrar informacion.
--   * Las sesiones conservan continuidad y checkpoint ante pausas/interrupciones.
--   * Los eventos son la fuente cronologica de verdad.
--   * IA, usuario, sensores y fuentes externas conservan procedencia separada.
--   * Lo propuesto por IA requiere validacion humana antes de considerarse hecho.
--   * Las fuentes externas orientan/sustentan, pero no reemplazan evidencia real.

begin;

-- Claves multiempresa auxiliares para referencias fuertes a modulos existentes.
create unique index if not exists clientes_id_empresa_uidx
  on public.clientes (id, empresa_id);
create unique index if not exists ot_ordenes_trabajo_id_empresa_uidx
  on public.ot_ordenes_trabajo (id, empresa_id);
create unique index if not exists ot_equipos_id_empresa_uidx
  on public.ot_equipos (id, empresa_id);
create unique index if not exists pts_permisos_id_empresa_uidx
  on public.pts_permisos (id, empresa_id);
create unique index if not exists vet_animales_id_empresa_uidx
  on public.vet_animales (id, empresa_id);
create unique index if not exists vet_partos_id_empresa_uidx
  on public.vet_partos (id, empresa_id);
create unique index if not exists vet_procedimientos_id_empresa_uidx
  on public.vet_procedimientos (id, empresa_id);

create or replace function public.asistente_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) Caso transversal.
create table if not exists public.asistente_casos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  cliente_id uuid,
  codigo text,
  dominio text not null
    check (dominio in ('tecnico','seguridad','veterinaria','activos','general','otro')),
  tipo_caso text not null,
  titulo text not null,
  descripcion_inicial text,
  estado text not null default 'abierto'
    check (estado in ('abierto','en_analisis','en_ejecucion','pausado','cerrado','cancelado')),
  prioridad text not null default 'media'
    check (prioridad in ('baja','media','alta','critica')),
  origen text not null default 'manual'
    check (origen in ('manual','ot','pts','veterinaria','asistente','integracion','otro')),
  responsable_id uuid references public.perfiles(id),
  iniciado_at timestamptz not null default now(),
  cerrado_at timestamptz,
  resumen_actual text,
  datos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos) = 'object'),
  created_by uuid default auth.uid() references public.perfiles(id),
  updated_by uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (cliente_id, empresa_id)
    references public.clientes(id, empresa_id)
    on delete no action,
  unique (id, empresa_id),
  check (cerrado_at is null or cerrado_at >= iniciado_at)
);

create index if not exists asistente_casos_empresa_estado_idx
  on public.asistente_casos (empresa_id, estado, dominio, iniciado_at desc);
create index if not exists asistente_casos_cliente_idx
  on public.asistente_casos (empresa_id, cliente_id, iniciado_at desc)
  where cliente_id is not null;

-- 2) Adaptadores fuertes a modulos existentes. Un caso puede existir antes de
-- cualquiera de estas entidades y vincularse despues sin copiar su contenido.
create table if not exists public.asistente_caso_ots (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  ot_id uuid not null,
  rol text not null default 'relacionada'
    check (rol in ('origen','principal','relacionada','resultado')),
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (ot_id, empresa_id)
    references public.ot_ordenes_trabajo(id, empresa_id)
    on delete no action,
  unique (caso_id, ot_id)
);

create table if not exists public.asistente_caso_pts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  permiso_id uuid not null,
  rol text not null default 'relacionado'
    check (rol in ('origen','principal','relacionado','resultado')),
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (permiso_id, empresa_id)
    references public.pts_permisos(id, empresa_id)
    on delete no action,
  unique (caso_id, permiso_id)
);

create table if not exists public.asistente_caso_equipos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  equipo_id uuid not null,
  rol text not null default 'relacionado'
    check (rol in ('principal','relacionado')),
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (equipo_id, empresa_id)
    references public.ot_equipos(id, empresa_id)
    on delete no action,
  unique (caso_id, equipo_id)
);

create table if not exists public.asistente_caso_animales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  animal_id uuid not null,
  rol text not null default 'principal'
    check (rol in ('principal','madre','cria','relacionado')),
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (animal_id, empresa_id)
    references public.vet_animales(id, empresa_id)
    on delete no action,
  unique (caso_id, animal_id, rol)
);

create table if not exists public.asistente_caso_partos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  parto_id uuid not null,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (parto_id, empresa_id)
    references public.vet_partos(id, empresa_id)
    on delete no action,
  unique (caso_id, parto_id)
);

create table if not exists public.asistente_caso_procedimientos_vet (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  procedimiento_id uuid not null,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (procedimiento_id, empresa_id)
    references public.vet_procedimientos(id, empresa_id)
    on delete no action,
  unique (caso_id, procedimiento_id)
);

-- 3) Sesiones. checkpoint mantiene continuidad de voz/lentes y permite retomar
-- luego de llamadas, perdida de red o pausas sin depender de memoria conversacional.
create table if not exists public.asistente_sesiones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  modo text not null default 'general',
  estado text not null default 'en_curso'
    check (estado in ('en_curso','pausada','interrumpida','finalizada','cancelada')),
  origen_interfaz text not null default 'web'
    check (origen_interfaz in ('web','movil','voz','lentes','ia','offline_sync','integracion')),
  iniciado_por uuid references public.perfiles(id),
  finalizado_por uuid references public.perfiles(id),
  iniciado_at timestamptz not null default now(),
  ultima_actividad_at timestamptz not null default now(),
  finalizado_at timestamptz,
  motivo_pausa text,
  checkpoint jsonb not null default '{}'::jsonb
    check (jsonb_typeof(checkpoint) = 'object'),
  datos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  unique (id, empresa_id, caso_id),
  check (finalizado_at is null or finalizado_at >= iniciado_at)
);

create index if not exists asistente_sesiones_caso_idx
  on public.asistente_sesiones (empresa_id, caso_id, iniciado_at desc);
create index if not exists asistente_sesiones_estado_idx
  on public.asistente_sesiones (empresa_id, estado, ultima_actividad_at desc);

-- 4) Eventos. tipo_evento es deliberadamente extensible por dominio.
create table if not exists public.asistente_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  sesion_id uuid,
  tipo_evento text not null check (length(trim(tipo_evento)) > 0),
  nivel_certeza text not null
    check (nivel_certeza in (
      'informado','observado','medido','hipotesis','propuesto','confirmado','descartado'
    )),
  autor_tipo text not null default 'persona'
    check (autor_tipo in ('persona','asistente','sensor','sistema','externo')),
  origen_captura text not null default 'web'
    check (origen_captura in ('web','movil','voz','lentes','ia','sensor','offline_sync','integracion')),
  usuario_id uuid references public.perfiles(id),
  texto_original text not null,
  descripcion_normalizada text,
  contexto_etiqueta text,
  prioridad text
    check (prioridad is null or prioridad in ('baja','media','alta','critica')),
  ocurrido_at timestamptz not null default now(),
  visible_externo boolean not null default false,
  incluir_resumen boolean not null default true,
  estado text not null default 'activo'
    check (estado in ('activo','corregido','anulado')),
  estado_validacion text not null default 'no_requiere'
    check (estado_validacion in ('no_requiere','pendiente','validado','rechazado')),
  validado_por uuid references public.perfiles(id),
  validado_at timestamptz,
  datos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos) = 'object'),
  created_by uuid default auth.uid() references public.perfiles(id),
  updated_by uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (sesion_id, empresa_id, caso_id)
    references public.asistente_sesiones(id, empresa_id, caso_id)
    on delete no action,
  unique (id, empresa_id, caso_id),
  check (
    nivel_certeza <> 'propuesto'
    or estado_validacion in ('pendiente','validado','rechazado')
  ),
  check (
    tipo_evento <> 'hipotesis' or nivel_certeza = 'hipotesis'
  ),
  check (
    tipo_evento <> 'medicion' or nivel_certeza = 'medido'
  ),
  check (
    tipo_evento <> 'decision_cliente' or nivel_certeza = 'informado'
  )
);

create index if not exists asistente_eventos_timeline_idx
  on public.asistente_eventos (empresa_id, caso_id, ocurrido_at, created_at);
create index if not exists asistente_eventos_tipo_idx
  on public.asistente_eventos (empresa_id, caso_id, tipo_evento, nivel_certeza);
create index if not exists asistente_eventos_validacion_idx
  on public.asistente_eventos (empresa_id, estado_validacion, ocurrido_at desc)
  where estado_validacion = 'pendiente';

-- 5) Relaciones entre eventos: permiten cadenas de razonamiento sin borrar historia.
create table if not exists public.asistente_evento_relaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  evento_origen_id uuid not null,
  evento_destino_id uuid not null,
  tipo_relacion text not null
    check (tipo_relacion in (
      'origina','sustenta','confirma','descarta','contradice','resultado_de',
      'causa_de','recomendacion_de','decision_sobre','seguimiento_de','valida',
      'relacionado_con','otro'
    )),
  observacion text,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (evento_origen_id, empresa_id, caso_id)
    references public.asistente_eventos(id, empresa_id, caso_id)
    on delete cascade,
  foreign key (evento_destino_id, empresa_id, caso_id)
    references public.asistente_eventos(id, empresa_id, caso_id)
    on delete cascade,
  unique (evento_origen_id, evento_destino_id, tipo_relacion),
  check (evento_origen_id <> evento_destino_id)
);

create index if not exists asistente_evento_relaciones_caso_idx
  on public.asistente_evento_relaciones (empresa_id, caso_id, created_at);

-- 6) Evidencias propias del asistente. Solo se almacena metadata/referencia;
-- el archivo binario vive en Storage. Esto evita localStorage para fotos/video.
create table if not exists public.asistente_evidencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  sesion_id uuid,
  tipo_evidencia text not null
    check (tipo_evidencia in ('foto','video','audio','documento','captura','sensor','otro')),
  origen_captura text not null default 'movil'
    check (origen_captura in ('web','movil','voz','lentes','sensor','importado','otro')),
  storage_bucket text,
  storage_path text,
  url_externa text,
  archivo_nombre text,
  mime_type text,
  descripcion text,
  capturado_at timestamptz not null default now(),
  hash_sha256 text,
  datos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos) = 'object'),
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (sesion_id, empresa_id, caso_id)
    references public.asistente_sesiones(id, empresa_id, caso_id)
    on delete no action,
  unique (id, empresa_id, caso_id),
  check (storage_path is not null or url_externa is not null)
);

create table if not exists public.asistente_evento_evidencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  evento_id uuid not null,
  evidencia_id uuid not null,
  tipo_uso text not null default 'evidencia'
    check (tipo_uso in ('evidencia','contexto','antes','despues','validacion','otro')),
  observacion text,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (evento_id, empresa_id, caso_id)
    references public.asistente_eventos(id, empresa_id, caso_id)
    on delete cascade,
  foreign key (evidencia_id, empresa_id, caso_id)
    references public.asistente_evidencias(id, empresa_id, caso_id)
    on delete no action,
  unique (evento_id, evidencia_id, tipo_uso)
);

-- 7) Fuentes externas verificables: manuales, normas, protocolos, articulos, web.
create table if not exists public.asistente_fuentes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  sesion_id uuid,
  registrado_por uuid references public.perfiles(id),
  origen_registro text not null default 'persona'
    check (origen_registro in ('persona','asistente','importado','integracion')),
  tipo_fuente text not null
    check (tipo_fuente in (
      'manual_oficial','datasheet_oficial','boletin_servicio','web_oficial',
      'norma','protocolo','publicacion_cientifica','documentacion_tecnica',
      'distribuidor_tecnico','comunidad','video_tecnico','otro'
    )),
  nivel_autoridad text not null default 'desconocida'
    check (nivel_autoridad in (
      'oficial_fabricante','oficial_normativa','protocolo_organizacion',
      'cientifica','distribuidor_autorizado','tecnica_secundaria',
      'comunidad','desconocida'
    )),
  estado_aplicabilidad text not null default 'encontrada'
    check (estado_aplicabilidad in (
      'encontrada','revisada','aplicable','validada_terreno','descartada'
    )),
  titulo text not null,
  autor_entidad text,
  codigo_documento text,
  revision text,
  url text,
  dominio_web text,
  fecha_documento date,
  consultado_at timestamptz not null default now(),
  referencia_relevante text,
  conclusion text,
  motivo_aplicabilidad text,
  datos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos) = 'object'),
  created_by uuid default auth.uid() references public.perfiles(id),
  updated_by uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (sesion_id, empresa_id, caso_id)
    references public.asistente_sesiones(id, empresa_id, caso_id)
    on delete no action,
  unique (id, empresa_id, caso_id)
);

create index if not exists asistente_fuentes_caso_idx
  on public.asistente_fuentes (empresa_id, caso_id, consultado_at desc);
create index if not exists asistente_fuentes_aplicabilidad_idx
  on public.asistente_fuentes (empresa_id, estado_aplicabilidad, nivel_autoridad, consultado_at desc);

create table if not exists public.asistente_evento_fuentes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  evento_id uuid not null,
  fuente_id uuid not null,
  tipo_uso text not null default 'contexto'
    check (tipo_uso in ('contexto','sustenta','contradice','orienta_prueba','resultado_validacion','otro')),
  observacion text,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (evento_id, empresa_id, caso_id)
    references public.asistente_eventos(id, empresa_id, caso_id)
    on delete cascade,
  foreign key (fuente_id, empresa_id, caso_id)
    references public.asistente_fuentes(id, empresa_id, caso_id)
    on delete no action,
  unique (evento_id, fuente_id, tipo_uso)
);

-- 8) Recomendaciones y decisiones estructuradas, reutilizables por dominio.
create table if not exists public.asistente_recomendaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  sesion_id uuid,
  evento_origen_id uuid,
  descripcion text not null,
  motivo text,
  riesgo_no_atender text,
  prioridad text not null default 'media'
    check (prioridad in ('baja','media','alta','critica')),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','informada','aceptada','rechazada','postergada','ejecutada','no_aplica')),
  visible_externo boolean not null default true,
  fecha_objetivo date,
  ejecutada_at timestamptz,
  contexto jsonb not null default '{}'::jsonb
    check (jsonb_typeof(contexto) = 'object'),
  created_by uuid default auth.uid() references public.perfiles(id),
  updated_by uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (sesion_id, empresa_id, caso_id)
    references public.asistente_sesiones(id, empresa_id, caso_id)
    on delete no action,
  foreign key (evento_origen_id, empresa_id, caso_id)
    references public.asistente_eventos(id, empresa_id, caso_id)
    on delete no action,
  unique (id, empresa_id, caso_id),
  check (ejecutada_at is null or estado = 'ejecutada')
);

create table if not exists public.asistente_decisiones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  caso_id uuid not null,
  sesion_id uuid,
  evento_id uuid,
  recomendacion_id uuid,
  actor_tipo text not null default 'cliente'
    check (actor_tipo in ('cliente','supervisor','veterinario','responsable','tecnico','otro')),
  actor_nombre_snapshot text,
  actor_cargo_snapshot text,
  decision text not null,
  motivo text,
  decidido_at timestamptz not null default now(),
  visible_externo boolean not null default true,
  datos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos) = 'object'),
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (caso_id, empresa_id)
    references public.asistente_casos(id, empresa_id)
    on delete cascade,
  foreign key (sesion_id, empresa_id, caso_id)
    references public.asistente_sesiones(id, empresa_id, caso_id)
    on delete no action,
  foreign key (evento_id, empresa_id, caso_id)
    references public.asistente_eventos(id, empresa_id, caso_id)
    on delete no action,
  foreign key (recomendacion_id, empresa_id, caso_id)
    references public.asistente_recomendaciones(id, empresa_id, caso_id)
    on delete no action,
  check (evento_id is not null or recomendacion_id is not null)
);

-- Triggers updated_at.
drop trigger if exists asistente_casos_set_updated_at on public.asistente_casos;
create trigger asistente_casos_set_updated_at before update on public.asistente_casos
for each row execute function public.asistente_set_updated_at();

drop trigger if exists asistente_sesiones_set_updated_at on public.asistente_sesiones;
create trigger asistente_sesiones_set_updated_at before update on public.asistente_sesiones
for each row execute function public.asistente_set_updated_at();

drop trigger if exists asistente_eventos_set_updated_at on public.asistente_eventos;
create trigger asistente_eventos_set_updated_at before update on public.asistente_eventos
for each row execute function public.asistente_set_updated_at();

drop trigger if exists asistente_fuentes_set_updated_at on public.asistente_fuentes;
create trigger asistente_fuentes_set_updated_at before update on public.asistente_fuentes
for each row execute function public.asistente_set_updated_at();

drop trigger if exists asistente_recomendaciones_set_updated_at on public.asistente_recomendaciones;
create trigger asistente_recomendaciones_set_updated_at before update on public.asistente_recomendaciones
for each row execute function public.asistente_set_updated_at();

-- RLS multiempresa.
alter table public.asistente_casos enable row level security;
alter table public.asistente_caso_ots enable row level security;
alter table public.asistente_caso_pts enable row level security;
alter table public.asistente_caso_equipos enable row level security;
alter table public.asistente_caso_animales enable row level security;
alter table public.asistente_caso_partos enable row level security;
alter table public.asistente_caso_procedimientos_vet enable row level security;
alter table public.asistente_sesiones enable row level security;
alter table public.asistente_eventos enable row level security;
alter table public.asistente_evento_relaciones enable row level security;
alter table public.asistente_evidencias enable row level security;
alter table public.asistente_evento_evidencias enable row level security;
alter table public.asistente_fuentes enable row level security;
alter table public.asistente_evento_fuentes enable row level security;
alter table public.asistente_recomendaciones enable row level security;
alter table public.asistente_decisiones enable row level security;

-- Cada tabla usa el mismo criterio: pertenencia activa a empresa.
do $$
declare
  t text;
  policy_name text;
begin
  foreach t in array array[
    'asistente_casos','asistente_caso_ots','asistente_caso_pts','asistente_caso_equipos',
    'asistente_caso_animales','asistente_caso_partos','asistente_caso_procedimientos_vet',
    'asistente_sesiones','asistente_eventos','asistente_evento_relaciones',
    'asistente_evidencias','asistente_evento_evidencias','asistente_fuentes',
    'asistente_evento_fuentes','asistente_recomendaciones','asistente_decisiones'
  ]
  loop
    policy_name := t || '_empresa_access';
    execute format('drop policy if exists %I on public.%I', policy_name, t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (exists (select 1 from public.usuario_empresas ue '
      || 'where ue.empresa_id = %I.empresa_id and ue.usuario_id = auth.uid() '
      || 'and coalesce(ue.activo, true))) '
      || 'with check (exists (select 1 from public.usuario_empresas ue '
      || 'where ue.empresa_id = %I.empresa_id and ue.usuario_id = auth.uid() '
      || 'and coalesce(ue.activo, true)))',
      policy_name, t, t, t
    );
  end loop;
end;
$$;

grant select, insert, update, delete on public.asistente_casos to authenticated;
grant select, insert, update, delete on public.asistente_caso_ots to authenticated;
grant select, insert, update, delete on public.asistente_caso_pts to authenticated;
grant select, insert, update, delete on public.asistente_caso_equipos to authenticated;
grant select, insert, update, delete on public.asistente_caso_animales to authenticated;
grant select, insert, update, delete on public.asistente_caso_partos to authenticated;
grant select, insert, update, delete on public.asistente_caso_procedimientos_vet to authenticated;
grant select, insert, update, delete on public.asistente_sesiones to authenticated;
grant select, insert, update, delete on public.asistente_eventos to authenticated;
grant select, insert, update, delete on public.asistente_evento_relaciones to authenticated;
grant select, insert, update, delete on public.asistente_evidencias to authenticated;
grant select, insert, update, delete on public.asistente_evento_evidencias to authenticated;
grant select, insert, update, delete on public.asistente_fuentes to authenticated;
grant select, insert, update, delete on public.asistente_evento_fuentes to authenticated;
grant select, insert, update, delete on public.asistente_recomendaciones to authenticated;
grant select, insert, update, delete on public.asistente_decisiones to authenticated;

comment on table public.asistente_casos is
  'Contenedor transversal del Asistente Tralixia. Puede existir sin OT, PTS, animal o parto y vincularse posteriormente.';
comment on table public.asistente_sesiones is
  'Sesiones continuas de trabajo/observacion. checkpoint permite retomar contexto despues de interrupciones.';
comment on table public.asistente_eventos is
  'Eventos estructurados y cronologicos del caso. La procedencia y validacion separan hechos, hipotesis y propuestas IA.';
comment on column public.asistente_eventos.estado_validacion is
  'Las propuestas IA o inferencias que requieren revision humana permanecen pendientes hasta validar o rechazar.';
comment on table public.asistente_fuentes is
  'Fuentes externas consultadas: manuales, normas, protocolos, publicaciones y otras referencias con autoridad/aplicabilidad trazable.';
comment on table public.asistente_evidencias is
  'Metadata de evidencias capturadas por el asistente; los binarios se almacenan fuera de PostgreSQL, por ejemplo en Supabase Storage.';

commit;
