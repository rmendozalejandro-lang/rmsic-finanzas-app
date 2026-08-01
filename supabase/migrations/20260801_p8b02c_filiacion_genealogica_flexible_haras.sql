-- P8B-02C: permite registrar progenitores externos sin alterar la filiación existente.
alter table public.vet_animales
  add column if not exists madre_nombre_externo text,
  add column if not exists padre_nombre_externo text;

comment on column public.vet_animales.madre_nombre_externo is
  'Nombre genealógico de la madre cuando no está registrada como ejemplar del sistema.';

comment on column public.vet_animales.padre_nombre_externo is
  'Nombre genealógico del padre cuando no está registrado como ejemplar del sistema.';
