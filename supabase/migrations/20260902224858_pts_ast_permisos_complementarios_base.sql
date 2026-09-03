begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.pts_ast (
  id uuid primary key default gen_random_uuid(),
  permiso_id uuid not null,
  empresa_id uuid not null,
  area_trabajo text,
  supervisor_responsable text,
  peligros_entorno jsonb not null default '[]'::jsonb
    check (jsonb_typeof(peligros_entorno) = 'array'),
  controles_entorno jsonb not null default '[]'::jsonb
    check (jsonb_typeof(controles_entorno) = 'array'),
  protecciones_colectivas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(protecciones_colectivas) = 'array'),
  antecedentes_adicionales jsonb not null default '{}'::jsonb
    check (jsonb_typeof(antecedentes_adicionales) = 'object'),
  observaciones text,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (permiso_id, empresa_id)
    references public.pts_permisos(id, empresa_id) on delete cascade,
  unique (permiso_id, empresa_id),
  unique (id, empresa_id)
);

create index pts_ast_empresa_permiso_idx
  on public.pts_ast (empresa_id, permiso_id);

create table public.pts_permisos_complementarios (
  id uuid primary key default gen_random_uuid(),
  permiso_id uuid not null,
  empresa_id uuid not null,
  tipo text not null
    check (tipo in ('general','altura','izaje','excavacion','caliente','otro')),
  nombre text not null,
  codigo_fuente text,
  version_fuente text,
  estado text not null default 'borrador'
    check (estado in ('borrador','completo','observado','aprobado','rechazado','cerrado')),
  requerido boolean not null default true,
  motivo_seleccion text,
  datos_especificos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(datos_especificos) = 'object'),
  observaciones text,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (permiso_id, empresa_id)
    references public.pts_permisos(id, empresa_id) on delete cascade,
  unique (permiso_id, empresa_id, tipo),
  unique (id, empresa_id)
);

create index pts_permisos_complementarios_empresa_permiso_idx
  on public.pts_permisos_complementarios (empresa_id, permiso_id, tipo);

create table public.pts_checklist_respuestas (
  id uuid primary key default gen_random_uuid(),
  permiso_complementario_id uuid not null,
  empresa_id uuid not null,
  codigo_item text not null,
  seccion text,
  pregunta text not null,
  respuesta text
    check (respuesta is null or respuesta in ('si','no','na')),
  bloqueante_si_no boolean not null default false,
  observacion text,
  orden integer not null default 0,
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (permiso_complementario_id, empresa_id)
    references public.pts_permisos_complementarios(id, empresa_id) on delete cascade,
  unique (permiso_complementario_id, codigo_item)
);

create index pts_checklist_respuestas_empresa_permiso_idx
  on public.pts_checklist_respuestas (empresa_id, permiso_complementario_id, orden);

create table public.pts_vigilancia_post_trabajo (
  id uuid primary key default gen_random_uuid(),
  permiso_complementario_id uuid not null,
  empresa_id uuid not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','en_curso','completa','observada')),
  iniciado_at timestamptz,
  finalizado_at timestamptz,
  minutos_minimos integer not null default 60 check (minutos_minimos > 0),
  verificaciones jsonb not null default '[]'::jsonb
    check (jsonb_typeof(verificaciones) = 'array'),
  vigia_incendios_nombre text,
  emisor_notificado_nombre text,
  incidencias text,
  conclusion text
    check (conclusion is null or conclusion in ('cumple','requiere_acciones')),
  acciones_correctivas text,
  responsable_mantencion text,
  responsable_prevencion text,
  evidencias jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidencias) = 'array'),
  created_by uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (permiso_complementario_id, empresa_id)
    references public.pts_permisos_complementarios(id, empresa_id) on delete cascade,
  unique (permiso_complementario_id, empresa_id),
  check (finalizado_at is null or iniciado_at is null or finalizado_at >= iniciado_at)
);

create index pts_vigilancia_post_empresa_permiso_idx
  on public.pts_vigilancia_post_trabajo (empresa_id, permiso_complementario_id);

create trigger pts_ast_set_updated_at
before update on public.pts_ast
for each row execute function public.pts_set_updated_at();

create trigger pts_permisos_complementarios_set_updated_at
before update on public.pts_permisos_complementarios
for each row execute function public.pts_set_updated_at();

create trigger pts_checklist_respuestas_set_updated_at
before update on public.pts_checklist_respuestas
for each row execute function public.pts_set_updated_at();

create trigger pts_vigilancia_post_set_updated_at
before update on public.pts_vigilancia_post_trabajo
for each row execute function public.pts_set_updated_at();

alter table public.pts_ast enable row level security;
alter table public.pts_permisos_complementarios enable row level security;
alter table public.pts_checklist_respuestas enable row level security;
alter table public.pts_vigilancia_post_trabajo enable row level security;

revoke all on table public.pts_ast from public, anon;
revoke all on table public.pts_permisos_complementarios from public, anon;
revoke all on table public.pts_checklist_respuestas from public, anon;
revoke all on table public.pts_vigilancia_post_trabajo from public, anon;

grant select, insert, update, delete on table public.pts_ast to authenticated, service_role;
grant select, insert, update, delete on table public.pts_permisos_complementarios to authenticated, service_role;
grant select, insert, update, delete on table public.pts_checklist_respuestas to authenticated, service_role;
grant select, insert, update, delete on table public.pts_vigilancia_post_trabajo to authenticated, service_role;

create policy pts_ast_empresa_access
on public.pts_ast
for all
to authenticated
using ((select public.usuario_tiene_acceso_pts(empresa_id)))
with check ((select public.usuario_tiene_acceso_pts(empresa_id)));

create policy pts_permisos_complementarios_empresa_access
on public.pts_permisos_complementarios
for all
to authenticated
using ((select public.usuario_tiene_acceso_pts(empresa_id)))
with check ((select public.usuario_tiene_acceso_pts(empresa_id)));

create policy pts_checklist_respuestas_empresa_access
on public.pts_checklist_respuestas
for all
to authenticated
using ((select public.usuario_tiene_acceso_pts(empresa_id)))
with check ((select public.usuario_tiene_acceso_pts(empresa_id)));

create policy pts_vigilancia_post_empresa_access
on public.pts_vigilancia_post_trabajo
for all
to authenticated
using ((select public.usuario_tiene_acceso_pts(empresa_id)))
with check ((select public.usuario_tiene_acceso_pts(empresa_id)));

commit;
