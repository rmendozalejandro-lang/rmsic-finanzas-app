-- Asistente Tralixia - rollback controlado
--
-- NO ejecutar como migracion normal.
-- Usar solo si el despliegue inicial del nucleo asistente_* debe revertirse.
-- Este script se detiene si detecta datos en tablas asistente_* para evitar
-- perdida accidental de informacion real.

begin;

do $$
declare
  total_rows bigint := 0;
  t text;
  n bigint;
begin
  foreach t in array array[
    'asistente_decisiones',
    'asistente_recomendaciones',
    'asistente_evento_fuentes',
    'asistente_fuentes',
    'asistente_evento_evidencias',
    'asistente_evidencias',
    'asistente_evento_relaciones',
    'asistente_eventos',
    'asistente_sesiones',
    'asistente_caso_procedimientos_vet',
    'asistente_caso_partos',
    'asistente_caso_animales',
    'asistente_caso_equipos',
    'asistente_caso_pts',
    'asistente_caso_ots',
    'asistente_casos'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      total_rows := total_rows + coalesce(n, 0);
    end if;
  end loop;

  if total_rows > 0 then
    raise exception
      'Rollback cancelado: existen % filas en tablas asistente_*. Respaldar/revisar datos antes de eliminar objetos.',
      total_rows;
  end if;
end;
$$;

-- Tablas hijas primero para no depender de CASCADE global.
drop table if exists public.asistente_decisiones;
drop table if exists public.asistente_recomendaciones;
drop table if exists public.asistente_evento_fuentes;
drop table if exists public.asistente_fuentes;
drop table if exists public.asistente_evento_evidencias;
drop table if exists public.asistente_evidencias;
drop table if exists public.asistente_evento_relaciones;
drop table if exists public.asistente_eventos;
drop table if exists public.asistente_sesiones;
drop table if exists public.asistente_caso_procedimientos_vet;
drop table if exists public.asistente_caso_partos;
drop table if exists public.asistente_caso_animales;
drop table if exists public.asistente_caso_equipos;
drop table if exists public.asistente_caso_pts;
drop table if exists public.asistente_caso_ots;
drop table if exists public.asistente_casos;

-- Funciones exclusivas del nucleo asistente.
drop function if exists public.usuario_puede_acceder_caso_asistente(uuid, text, uuid);
drop function if exists public.usuario_tiene_acceso_asistente(uuid, text);
drop function if exists public.asistente_set_updated_at();

-- Indices auxiliares agregados sobre tablas existentes.
drop index if exists public.clientes_id_empresa_uidx;
drop index if exists public.ot_ordenes_trabajo_id_empresa_uidx;
drop index if exists public.ot_equipos_id_empresa_uidx;
drop index if exists public.pts_permisos_id_empresa_uidx;
drop index if exists public.vet_animales_id_empresa_uidx;
drop index if exists public.vet_partos_id_empresa_uidx;
drop index if exists public.vet_procedimientos_id_empresa_uidx;

commit;
