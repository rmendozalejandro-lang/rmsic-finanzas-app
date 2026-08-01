-- P8B-04: amplía las plantillas de protocolos veterinarios del dominio Haras.
-- Migración additive-only: conserva las tablas, datos, claves y políticas existentes.

alter table public.vet_protocolos
  add column if not exists tipo text not null default 'tratamiento',
  add column if not exists categoria_aplicable text,
  add column if not exists evento_base text,
  add column if not exists dias_desde_evento integer,
  add column if not exists instrucciones text;

alter table public.vet_protocolos_items
  add column if not exists obligatorio boolean not null default true,
  add column if not exists observaciones text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vet_protocolos'::regclass
      and conname = 'vet_protocolos_tipo_check'
  ) then
    alter table public.vet_protocolos
      add constraint vet_protocolos_tipo_check
      check (tipo in ('vacuna', 'vulvoplastia', 'curacion', 'tratamiento', 'desparasitacion', 'otro'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vet_protocolos'::regclass
      and conname = 'vet_protocolos_dias_desde_evento_check'
  ) then
    alter table public.vet_protocolos
      add constraint vet_protocolos_dias_desde_evento_check
      check (dias_desde_evento is null or dias_desde_evento >= 0);
  end if;
end $$;

comment on column public.vet_protocolos.tipo is 'Tipo técnico de la plantilla veterinaria.';
comment on column public.vet_protocolos_items.obligatorio is 'Indica si el insumo o acción es obligatorio en la plantilla.';
