-- Asistente Tralixia
-- Idempotencia para sincronizacion offline/local -> nucleo transversal.
--
-- Permite reintentar una sincronizacion sin duplicar casos, sesiones o eventos.
-- Las claves quedan separadas por empresa y por origen externo.

begin;

alter table public.asistente_casos
  add column if not exists origen_externo text,
  add column if not exists clave_externa text;

alter table public.asistente_sesiones
  add column if not exists origen_externo text,
  add column if not exists clave_externa text;

alter table public.asistente_eventos
  add column if not exists origen_externo text,
  add column if not exists clave_externa text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'asistente_casos_empresa_origen_clave_uk'
      and conrelid = 'public.asistente_casos'::regclass
  ) then
    alter table public.asistente_casos
      add constraint asistente_casos_empresa_origen_clave_uk
      unique (empresa_id, origen_externo, clave_externa);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'asistente_sesiones_empresa_origen_clave_uk'
      and conrelid = 'public.asistente_sesiones'::regclass
  ) then
    alter table public.asistente_sesiones
      add constraint asistente_sesiones_empresa_origen_clave_uk
      unique (empresa_id, origen_externo, clave_externa);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'asistente_eventos_empresa_origen_clave_uk'
      and conrelid = 'public.asistente_eventos'::regclass
  ) then
    alter table public.asistente_eventos
      add constraint asistente_eventos_empresa_origen_clave_uk
      unique (empresa_id, origen_externo, clave_externa);
  end if;
end;
$$;

create index if not exists asistente_casos_clave_externa_idx
  on public.asistente_casos (empresa_id, origen_externo, clave_externa)
  where clave_externa is not null;

create index if not exists asistente_sesiones_clave_externa_idx
  on public.asistente_sesiones (empresa_id, origen_externo, clave_externa)
  where clave_externa is not null;

create index if not exists asistente_eventos_clave_externa_idx
  on public.asistente_eventos (empresa_id, origen_externo, clave_externa)
  where clave_externa is not null;

comment on column public.asistente_casos.clave_externa is
  'Clave estable del origen para reintentos idempotentes de sincronizacion.';
comment on column public.asistente_sesiones.clave_externa is
  'Clave estable del origen para reintentos idempotentes de sincronizacion.';
comment on column public.asistente_eventos.clave_externa is
  'Clave estable del origen para reintentos idempotentes de sincronizacion.';

commit;
