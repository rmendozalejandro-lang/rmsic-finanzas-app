-- =========================================================
-- Auren OT - Vista resumen con plantillas configurables
-- =========================================================

create or replace view public.ot_vw_resumen as
select
  ot.id,
  ot.empresa_id,
  e.nombre as empresa_nombre,
  ot.cliente_id,
  c.nombre as cliente_nombre,
  ot.folio,
  ot.fecha_ot,
  ot.fecha_programada,
  ot.fecha_cierre,
  ot.titulo,
  ot.prioridad,
  ot.hora_inicio,
  ot.hora_termino,
  ot.duracion_minutos,
  ot.tecnico_responsable_id,
  p.email as tecnico_nombre,
  ub.nombre as ubicacion_nombre,
  a.nombre as activo_nombre,
  ts.nombre as tipo_servicio_nombre,
  es.nombre as estado_nombre,
  ot.requiere_checklist,
  ot.created_at,
  ot.updated_at,

  ot.equipo_id,
  eq.tag as equipo_tag,
  eq.nombre as equipo_nombre,
  eq.descripcion as equipo_descripcion,
  eq.tipo_equipo as equipo_tipo,
  eq.planta as equipo_planta,
  eq.area as equipo_area,
  eq.linea as equipo_linea,
  eq.ubicacion as equipo_ubicacion,
  eq.marca as equipo_marca,
  eq.modelo as equipo_modelo,
  eq.serie as equipo_serie,
  eq.potencia as equipo_potencia,

  coalesce(tpl.id, tpl_default.id) as plantilla_id,
  coalesce(tpl.codigo, tpl_default.codigo) as plantilla_codigo,
  coalesce(tpl.nombre, tpl_default.nombre) as plantilla_nombre,
  coalesce(tpl.descripcion, tpl_default.descripcion) as plantilla_descripcion,
  coalesce(tpl.vista_principal, tpl_default.vista_principal) as plantilla_vista_principal,
  coalesce(tpl.ruta_principal, tpl_default.ruta_principal) as plantilla_ruta_principal,
  coalesce(tpl.ruta_base, tpl_default.ruta_base) as plantilla_ruta_base,
  coalesce(tpl.ruta_pdf, tpl_default.ruta_pdf) as plantilla_ruta_pdf,
  coalesce(tpl.requiere_equipo, tpl_default.requiere_equipo, false) as plantilla_requiere_equipo,
  coalesce(tpl.usa_checklist, tpl_default.usa_checklist, false) as plantilla_usa_checklist,
  coalesce(tpl.checklist_plantilla_codigo, tpl_default.checklist_plantilla_codigo) as plantilla_checklist_codigo,
  coalesce(tpl.informe_codigo, tpl_default.informe_codigo) as plantilla_informe_codigo

from public.ot_ordenes_trabajo ot
left join public.empresas e on e.id = ot.empresa_id
left join public.clientes c on c.id = ot.cliente_id
left join public.ot_ubicaciones_cliente ub on ub.id = ot.ubicacion_id
left join public.ot_activos a on a.id = ot.activo_id
left join public.ot_tipos_servicio ts on ts.id = ot.tipo_servicio_id
left join public.ot_estados es on es.id = ot.estado_id
left join public.perfiles p on p.id = ot.tecnico_responsable_id
left join public.ot_equipos eq on eq.id = ot.equipo_id
left join public.ot_plantillas tpl
  on tpl.id = ot.plantilla_id
 and tpl.activo = true
left join public.ot_plantillas tpl_default
  on tpl_default.empresa_id = ot.empresa_id
 and tpl_default.es_predeterminada = true
 and tpl_default.activo = true
where coalesce(ot.activo, true) = true
  and ot.deleted_at is null;
