-- P8B-02 - Categorías controladas para el maestro de animales.
-- Migración incremental: conserva todos los registros y políticas RLS de P8B-01.

alter table public.vet_animales
  add column if not exists categoria text;

update public.vet_animales
set categoria = 'otro'
where categoria is null;

alter table public.vet_animales
  alter column categoria set default 'otro',
  alter column categoria set not null;

alter table public.vet_animales
  drop constraint if exists vet_animales_categoria_check;

alter table public.vet_animales
  add constraint vet_animales_categoria_check
  check (categoria in ('yegua', 'cria', 'año', 'potro', 'chileno', 'otro'));

create index if not exists vet_animales_empresa_categoria_idx
  on public.vet_animales (empresa_id, categoria);
