-- P8B-02A - Identificación física y señas particulares de los ejemplares.
-- Migración incremental; no modifica ni elimina datos existentes.

alter table public.vet_animales
  add column if not exists color_pelaje text,
  add column if not exists senales_cabeza text,
  add column if not exists senales_mano_izquierda text,
  add column if not exists senales_mano_derecha text,
  add column if not exists senales_pata_izquierda text,
  add column if not exists senales_pata_derecha text,
  add column if not exists observaciones_marcas text;

alter table public.vet_animales
  drop constraint if exists vet_animales_color_pelaje_check;

alter table public.vet_animales
  add constraint vet_animales_color_pelaje_check
  check (color_pelaje is null or color_pelaje in
    ('alazan', 'colorado', 'mulato', 'negro', 'rosillo', 'tordillo', 'otro'));

create table public.vet_animal_marcas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  animal_id uuid not null,
  vista text not null check (vista in (
    'lateral_izquierda', 'lateral_derecha', 'cabeza_frontal',
    'cabeza_perfil', 'manos_posterior', 'patas_posterior'
  )),
  tipo_marca text not null check (tipo_marca in (
    'remolino', 'mancha_blanca', 'mancha_negra', 'cicatriz', 'marca_piel', 'otro'
  )),
  x numeric(6,3) not null check (x between 0 and 1),
  y numeric(6,3) not null check (y between 0 and 1),
  descripcion text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, animal_id)
    references public.vet_animales(empresa_id, id) on delete cascade
);

create table public.vet_animal_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  animal_id uuid not null,
  storage_path text not null,
  descripcion text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, animal_id)
    references public.vet_animales(empresa_id, id) on delete cascade
);

create index vet_animal_marcas_empresa_animal_idx
  on public.vet_animal_marcas (empresa_id, animal_id);
create index vet_animal_fotos_empresa_animal_idx
  on public.vet_animal_fotos (empresa_id, animal_id);

alter table public.vet_animal_marcas enable row level security;
alter table public.vet_animal_fotos enable row level security;

create policy vet_animal_marcas_empresa_access
  on public.vet_animal_marcas for all to authenticated
  using (public.usuario_tiene_acceso_haras(empresa_id))
  with check (public.usuario_tiene_acceso_haras(empresa_id));

create policy vet_animal_fotos_empresa_access
  on public.vet_animal_fotos for all to authenticated
  using (public.usuario_tiene_acceso_haras(empresa_id))
  with check (public.usuario_tiene_acceso_haras(empresa_id));

