-- P8B-01 - Base independiente del módulo Tralixia Haras.
-- Todas las entidades quedan aisladas por empresa y protegidas por RLS.

create or replace function public.usuario_tiene_acceso_haras(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuario_empresas ue
    join public.empresa_modulos em
      on em.empresa_id = ue.empresa_id
     and em.modulo = 'haras'
     and em.habilitado = true
    where ue.empresa_id = p_empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
      and ue.rol in ('admin', 'gerencia')
  );
$$;

revoke all on function public.usuario_tiene_acceso_haras(uuid) from public;
grant execute on function public.usuario_tiene_acceso_haras(uuid) to authenticated;

create table public.vet_animales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  identificador text,
  especie text not null default 'equino',
  sexo text check (sexo in ('hembra', 'macho', 'desconocido')),
  fecha_nacimiento date,
  madre_id uuid,
  padre_id uuid,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo', 'fallecido', 'vendido')),
  observaciones text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, identificador),
  foreign key (empresa_id, madre_id) references public.vet_animales(empresa_id, id),
  foreign key (empresa_id, padre_id) references public.vet_animales(empresa_id, id)
);

create table public.vet_proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  identificacion_fiscal text,
  contacto text,
  email text,
  telefono text,
  activo boolean not null default true,
  observaciones text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);

create table public.vet_insumos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text,
  nombre text not null,
  tipo text not null default 'insumo' check (tipo in ('medicamento', 'vacuna', 'insumo', 'alimento', 'otro')),
  unidad_medida text not null,
  stock_minimo numeric(14,3) not null default 0 check (stock_minimo >= 0),
  activo boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, codigo)
);

create table public.vet_lotes_insumo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  insumo_id uuid not null,
  proveedor_id uuid,
  numero_lote text not null,
  fecha_ingreso date not null default current_date,
  fecha_vencimiento date,
  cantidad_inicial numeric(14,3) not null check (cantidad_inicial >= 0),
  cantidad_actual numeric(14,3) not null check (cantidad_actual >= 0),
  costo_unitario numeric(14,2) check (costo_unitario >= 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, insumo_id, numero_lote),
  foreign key (empresa_id, insumo_id) references public.vet_insumos(empresa_id, id),
  foreign key (empresa_id, proveedor_id) references public.vet_proveedores(empresa_id, id)
);

create table public.vet_protocolos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  periodicidad_dias integer check (periodicidad_dias > 0),
  activo boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);

create table public.vet_protocolos_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  protocolo_id uuid not null,
  insumo_id uuid,
  orden integer not null default 1 check (orden > 0),
  descripcion text not null,
  dosis numeric(14,3) check (dosis >= 0),
  unidad text,
  created_at timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, protocolo_id) references public.vet_protocolos(empresa_id, id) on delete cascade,
  foreign key (empresa_id, insumo_id) references public.vet_insumos(empresa_id, id)
);

create table public.vet_procedimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  animal_id uuid not null,
  protocolo_id uuid,
  fecha timestamptz not null default now(),
  tipo text not null,
  profesional text,
  diagnostico text,
  detalle text,
  proximo_control date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, animal_id) references public.vet_animales(empresa_id, id),
  foreign key (empresa_id, protocolo_id) references public.vet_protocolos(empresa_id, id)
);

create table public.vet_procedimiento_insumos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  procedimiento_id uuid not null,
  insumo_id uuid not null,
  lote_insumo_id uuid,
  cantidad numeric(14,3) not null check (cantidad > 0),
  created_at timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, procedimiento_id) references public.vet_procedimientos(empresa_id, id) on delete cascade,
  foreign key (empresa_id, insumo_id) references public.vet_insumos(empresa_id, id),
  foreign key (empresa_id, lote_insumo_id) references public.vet_lotes_insumo(empresa_id, id)
);

create table public.vet_partos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  madre_id uuid not null,
  cria_id uuid,
  fecha_probable date,
  fecha_parto timestamptz,
  estado text not null default 'seguimiento' check (estado in ('seguimiento', 'ocurrido', 'cancelado')),
  resultado text,
  observaciones text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, madre_id) references public.vet_animales(empresa_id, id),
  foreign key (empresa_id, cria_id) references public.vet_animales(empresa_id, id)
);

create index vet_animales_empresa_idx on public.vet_animales (empresa_id, estado);
create index vet_proveedores_empresa_idx on public.vet_proveedores (empresa_id, activo);
create index vet_insumos_empresa_idx on public.vet_insumos (empresa_id, activo);
create index vet_lotes_insumo_empresa_idx on public.vet_lotes_insumo (empresa_id, insumo_id, fecha_vencimiento);
create index vet_protocolos_empresa_idx on public.vet_protocolos (empresa_id, activo);
create index vet_protocolos_items_empresa_idx on public.vet_protocolos_items (empresa_id, protocolo_id);
create index vet_procedimientos_empresa_idx on public.vet_procedimientos (empresa_id, animal_id, fecha desc);
create index vet_procedimiento_insumos_empresa_idx on public.vet_procedimiento_insumos (empresa_id, procedimiento_id);
create index vet_partos_empresa_idx on public.vet_partos (empresa_id, madre_id, fecha_probable);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'vet_animales', 'vet_proveedores', 'vet_insumos', 'vet_lotes_insumo',
    'vet_protocolos', 'vet_protocolos_items', 'vet_procedimientos',
    'vet_procedimiento_insumos', 'vet_partos'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.usuario_tiene_acceso_haras(empresa_id)) with check (public.usuario_tiene_acceso_haras(empresa_id))',
      table_name || '_empresa_access', table_name
    );
  end loop;
end $$;

comment on function public.usuario_tiene_acceso_haras(uuid) is
  'Permiso base de Tralixia Haras: módulo habilitado, membresía activa y rol admin o gerencia.';
