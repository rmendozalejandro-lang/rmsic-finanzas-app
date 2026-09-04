-- OT Viva / Asistente Tecnico RMSIC
-- Correccion preventiva de claves foraneas compuestas.
--
-- La migracion base definio ON DELETE SET NULL en referencias opcionales
-- compuestas que tambien incluyen empresa_id y ot_id (ambas NOT NULL).
-- PostgreSQL intentaria poner en NULL todas las columnas de la FK al borrar
-- el padre, lo que chocaria con esas restricciones NOT NULL.
--
-- Para preservar trazabilidad tecnica, estas referencias pasan a NO ACTION:
-- no se permite borrar fisicamente un padre mientras exista informacion
-- tecnica dependiente. El flujo OT Viva debe usar estados logicos
-- (finalizada, cancelada, corregido, anulado, ejecutada, etc.).

begin;

-- Helper local: elimina la FK existente entre una tabla hija y una tabla padre.
-- Se identifica por catalogo para no depender del nombre automatico que haya
-- generado PostgreSQL en la migracion base.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_namespace ns on ns.oid = child.relnamespace
    where ns.nspname = 'public'
      and child.relname = 'ot_recomendaciones_tecnicas'
      and c.contype = 'f'
      and c.confrelid = 'public.ot_sesiones_terreno'::regclass
  loop
    execute format(
      'alter table public.ot_recomendaciones_tecnicas drop constraint %I',
      r.conname
    );
  end loop;

  for r in
    select c.conname
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_namespace ns on ns.oid = child.relnamespace
    where ns.nspname = 'public'
      and child.relname = 'ot_recomendaciones_tecnicas'
      and c.contype = 'f'
      and c.confrelid = 'public.ot_eventos_tecnicos'::regclass
  loop
    execute format(
      'alter table public.ot_recomendaciones_tecnicas drop constraint %I',
      r.conname
    );
  end loop;

  for r in
    select c.conname
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_namespace ns on ns.oid = child.relnamespace
    where ns.nspname = 'public'
      and child.relname = 'ot_decisiones_cliente'
      and c.contype = 'f'
      and c.confrelid = 'public.ot_sesiones_terreno'::regclass
  loop
    execute format(
      'alter table public.ot_decisiones_cliente drop constraint %I',
      r.conname
    );
  end loop;

  for r in
    select c.conname
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_namespace ns on ns.oid = child.relnamespace
    where ns.nspname = 'public'
      and child.relname = 'ot_decisiones_cliente'
      and c.contype = 'f'
      and c.confrelid = 'public.ot_recomendaciones_tecnicas'::regclass
  loop
    execute format(
      'alter table public.ot_decisiones_cliente drop constraint %I',
      r.conname
    );
  end loop;

  for r in
    select c.conname
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_namespace ns on ns.oid = child.relnamespace
    where ns.nspname = 'public'
      and child.relname = 'ot_decisiones_cliente'
      and c.contype = 'f'
      and c.confrelid = 'public.ot_eventos_tecnicos'::regclass
  loop
    execute format(
      'alter table public.ot_decisiones_cliente drop constraint %I',
      r.conname
    );
  end loop;
end;
$$;

alter table public.ot_recomendaciones_tecnicas
  add constraint ot_recomendaciones_tecnicas_sesion_fk
  foreign key (sesion_id, empresa_id, ot_id)
  references public.ot_sesiones_terreno(id, empresa_id, ot_id)
  on delete no action;

alter table public.ot_recomendaciones_tecnicas
  add constraint ot_recomendaciones_tecnicas_evento_origen_fk
  foreign key (evento_origen_id, empresa_id, ot_id)
  references public.ot_eventos_tecnicos(id, empresa_id, ot_id)
  on delete no action;

alter table public.ot_decisiones_cliente
  add constraint ot_decisiones_cliente_sesion_fk
  foreign key (sesion_id, empresa_id, ot_id)
  references public.ot_sesiones_terreno(id, empresa_id, ot_id)
  on delete no action;

alter table public.ot_decisiones_cliente
  add constraint ot_decisiones_cliente_recomendacion_fk
  foreign key (recomendacion_id, empresa_id, ot_id)
  references public.ot_recomendaciones_tecnicas(id, empresa_id, ot_id)
  on delete no action;

alter table public.ot_decisiones_cliente
  add constraint ot_decisiones_cliente_evento_fk
  foreign key (evento_id, empresa_id, ot_id)
  references public.ot_eventos_tecnicos(id, empresa_id, ot_id)
  on delete no action;

comment on constraint ot_recomendaciones_tecnicas_sesion_fk
  on public.ot_recomendaciones_tecnicas
  is 'Preserva trazabilidad: una sesion referenciada no se elimina fisicamente.';

comment on constraint ot_recomendaciones_tecnicas_evento_origen_fk
  on public.ot_recomendaciones_tecnicas
  is 'Preserva trazabilidad: el evento que origina una recomendacion no se elimina fisicamente.';

comment on constraint ot_decisiones_cliente_sesion_fk
  on public.ot_decisiones_cliente
  is 'Preserva trazabilidad de la sesion en que se registro la decision del cliente.';

comment on constraint ot_decisiones_cliente_recomendacion_fk
  on public.ot_decisiones_cliente
  is 'Preserva trazabilidad entre una decision del cliente y su recomendacion tecnica.';

comment on constraint ot_decisiones_cliente_evento_fk
  on public.ot_decisiones_cliente
  is 'Preserva trazabilidad entre la decision del cliente y el evento tecnico asociado.';

commit;
