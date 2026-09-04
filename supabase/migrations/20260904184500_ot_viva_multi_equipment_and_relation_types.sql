-- OT Viva / Asistente Tecnico RMSIC
-- Ajustes de integridad para OTs con multiples equipos y relaciones tecnicas.
--
-- Objetivos:
--   1) Permitir que una recomendacion apunte al registro exacto de equipo
--      asociado a la OT (ot_orden_equipos), no solo al equipo maestro.
--   2) Alinear el catalogo de relaciones con la UI de Memoria Tecnica,
--      incorporando 'seguimiento_de'.

begin;

-- Contexto exacto del equipo dentro de una OT.
alter table public.ot_recomendaciones_tecnicas
  add column if not exists ot_orden_equipo_id uuid;

-- La FK compuesta garantiza que el registro asociado pertenece a la misma
-- empresa y a la misma OT de la recomendacion.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'ot_recomendaciones_tecnicas'
      and c.conname = 'ot_recomendaciones_tecnicas_ot_orden_equipo_fk'
  ) then
    alter table public.ot_recomendaciones_tecnicas
      add constraint ot_recomendaciones_tecnicas_ot_orden_equipo_fk
      foreign key (ot_orden_equipo_id, empresa_id, ot_id)
      references public.ot_orden_equipos(id, empresa_id, ot_id)
      on delete no action;
  end if;
end;
$$;

create index if not exists ot_recomendaciones_tecnicas_orden_equipo_idx
  on public.ot_recomendaciones_tecnicas (
    empresa_id,
    ot_id,
    ot_orden_equipo_id,
    estado,
    prioridad,
    created_at desc
  )
  where ot_orden_equipo_id is not null;

comment on column public.ot_recomendaciones_tecnicas.ot_orden_equipo_id
  is 'Asociacion exacta al equipo dentro de la OT. Complementa equipo_id cuando una OT contiene multiples equipos.';

comment on constraint ot_recomendaciones_tecnicas_ot_orden_equipo_fk
  on public.ot_recomendaciones_tecnicas
  is 'Garantiza que la recomendacion pertenece a un equipo asociado a la misma empresa y OT.';

-- Alinear relaciones tecnicas con la interfaz local de Memoria Tecnica.
-- La migracion base creo un CHECK inline; se identifica por catalogo para no
-- depender del nombre automatico asignado por PostgreSQL.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'ot_evento_relaciones'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%tipo_relacion%'
  loop
    execute format(
      'alter table public.ot_evento_relaciones drop constraint %I',
      r.conname
    );
  end loop;
end;
$$;

alter table public.ot_evento_relaciones
  add constraint ot_evento_relaciones_tipo_relacion_check
  check (tipo_relacion in (
    'origina',
    'confirma',
    'descarta',
    'resultado_de',
    'causa_de',
    'recomendacion_de',
    'decision_sobre',
    'seguimiento_de',
    'relacionado_con'
  ));

comment on constraint ot_evento_relaciones_tipo_relacion_check
  on public.ot_evento_relaciones
  is 'Tipos de vinculo entre eventos tecnicos utilizados por OT Viva y Memoria Tecnica RMSIC.';

commit;
