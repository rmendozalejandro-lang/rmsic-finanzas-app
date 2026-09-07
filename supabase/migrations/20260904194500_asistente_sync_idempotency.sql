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

-- No se crean indices adicionales sobre estas mismas tres columnas:
-- las restricciones UNIQUE anteriores ya generan los indices necesarios
-- para los upsert idempotentes y evitamos costo de escritura duplicado.

comment on column public.asistente_casos.clave_externa is
  'Clave estable del origen para reintentos idempotentes de sincronizacion.';
comment on column public.asistente_sesiones.clave_externa is
  'Clave estable del origen para reintentos idempotentes de sincronizacion.';
comment on column public.asistente_eventos.clave_externa is
  'Clave estable del origen para reintentos idempotentes de sincronizacion.';

commit;
