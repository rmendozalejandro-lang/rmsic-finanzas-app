-- =========================================================
-- Auren OT - Checklist oficial Softys / Motor MT post mantención
-- =========================================================

alter table public.ot_checklist_plantillas
add column if not exists config jsonb not null default '{}'::jsonb;

alter table public.ot_checklist_items
add column if not exists config jsonb not null default '{}'::jsonb;

create unique index if not exists ux_ot_checklist_plantillas_empresa_codigo
  on public.ot_checklist_plantillas (empresa_id, codigo);

create unique index if not exists ux_ot_checklist_items_plantilla_codigo
  on public.ot_checklist_items (plantilla_id, codigo);

with empresas_objetivo as (
  select distinct empresa_id
  from public.ot_plantillas
  where checklist_plantilla_codigo = 'motor_mt_post_mantencion'
    and activo = true
)
insert into public.ot_checklist_plantillas (
  empresa_id,
  codigo,
  nombre,
  descripcion,
  grupo_equipo,
  tipo_equipo,
  activo,
  config
)
select
  eo.empresa_id,
  'motor_mt_post_mantencion',
  'Motores MT post mantención',
  'Checklist oficial mandante para motores MT post mantención.',
  'Motores',
  'Motor MT',
  true,
  '{
    "formato": "softys_motor_mt_post_mantencion",
    "encabezado": [
      "fecha",
      "nombre",
      "sistema",
      "sub_sistema",
      "equipo",
      "sub_equipo",
      "tag",
      "ubicacion",
      "criticidad",
      "frecuencia",
      "codigo_sap"
    ],
    "columnas": {
      "encontrado": ["muy_bueno", "bueno", "malo", "muy_malo"],
      "acciones": ["limpieza", "reparacion", "cambio", "aviso_sap"],
      "pt100": ["pt100_1", "pt100_2", "pt100_3", "pt100_4"],
      "observaciones": true
    }
  }'::jsonb
from empresas_objetivo eo
on conflict (empresa_id, codigo)
do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  grupo_equipo = excluded.grupo_equipo,
  tipo_equipo = excluded.tipo_equipo,
  activo = true,
  config = excluded.config,
  updated_at = now();

with empresas_objetivo as (
  select distinct empresa_id
  from public.ot_plantillas
  where checklist_plantilla_codigo = 'motor_mt_post_mantencion'
    and activo = true
)
update public.ot_checklist_items i
set activo = false,
    updated_at = now()
from public.ot_checklist_plantillas p
join empresas_objetivo eo on eo.empresa_id = p.empresa_id
where p.id = i.plantilla_id
  and p.codigo = 'motor_mt_post_mantencion';

with empresas_objetivo as (
  select distinct empresa_id
  from public.ot_plantillas
  where checklist_plantilla_codigo = 'motor_mt_post_mantencion'
    and activo = true
),
plantillas as (
  select p.id, p.empresa_id
  from public.ot_checklist_plantillas p
  join empresas_objetivo eo on eo.empresa_id = p.empresa_id
  where p.codigo = 'motor_mt_post_mantencion'
),
items as (
  select *
  from (
    values
      ('1.1', '1.0 Requerimientos de seguridad', 101, 'Orden de mantención', 'estado', null, true,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),
      ('1.2', '1.0 Requerimientos de seguridad', 102, 'Uso de elementos de protección personal', 'estado', null, true,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),
      ('1.3', '1.0 Requerimientos de seguridad', 103, 'Casco, protectores auditivos, lentes y guantes', 'estado', null, true,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),
      ('1.4', '1.0 Requerimientos de seguridad', 104, 'Multitester', 'estado', null, false,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),
      ('1.5', '1.0 Requerimientos de seguridad', 105, 'Juego de destornilladores', 'estado', null, false,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),
      ('1.6', '1.0 Requerimientos de seguridad', 106, 'Juego llaves punta corona y llaves Allen', 'estado', null, false,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),

      ('2.1', '2.0 Requerimientos de insumos y/o herramientas', 201, 'Multitester', 'estado', null, true,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),
      ('2.2', '2.0 Requerimientos de insumos y/o herramientas', 202, 'Juego de destornilladores', 'estado', null, true,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),
      ('2.3', '2.0 Requerimientos de insumos y/o herramientas', 203, 'Juego llaves punta corona', 'estado', null, true,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),
      ('2.4', '2.0 Requerimientos de insumos y/o herramientas', 204, 'Tabla comparativa de PT-100', 'estado', null, true,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),
      ('2.5', '2.0 Requerimientos de insumos y/o herramientas', 205, 'Juego llaves Allen', 'estado', null, true,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),
      ('2.6', '2.0 Requerimientos de insumos y/o herramientas', 206, 'Juego de dados milimétrico', 'estado', null, true,
       '{"usa_cumplimiento":true,"usa_observacion":true}'::jsonb),

      ('3.1', '3.0 Inspección mecánica', 301, 'Limpieza exterior del motor', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),
      ('3.2', '3.0 Inspección mecánica', 302, 'Limpieza interior tapa trasera del motor', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),
      ('3.3', '3.0 Inspección mecánica', 303, 'Limpieza e inspección de aspas de ventilación', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),
      ('3.4', '3.0 Inspección mecánica', 304, 'Revisión de pernos motor', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),
      ('3.5', '3.0 Inspección mecánica', 305, 'Revisión de fijación tapa trasera ventilador', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),

      ('4.1', '4.0 Inspección eléctrica', 401, 'Revisión de caja de conexiones principal de motor', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),
      ('4.2', '4.0 Inspección eléctrica', 402, 'Revisión de conexiones caja principal PT-100', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),
      ('4.3', '4.0 Inspección eléctrica', 403, 'Revisión conexiones PT-100 rodamientos', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),
      ('4.4', '4.0 Inspección eléctrica', 404, 'Revisión de sello de hermeticidad caja de conexiones', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),
      ('4.5', '4.0 Inspección eléctrica', 405, 'Limpieza interior de la caja de conexiones', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),
      ('4.6', '4.0 Inspección eléctrica', 406, 'Medición de PT-100 interna de motor', 'estado', 'ohm', true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_pt100":true,"usa_observacion":true}'::jsonb),
      ('4.7', '4.0 Inspección eléctrica', 407, 'Temperatura según tabla adjunta', 'estado', '°C', true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_valor_texto":true,"usa_observacion":true}'::jsonb),
      ('4.8', '4.0 Inspección eléctrica', 408, 'Conexión de PT-100 internas', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),
      ('4.9', '4.0 Inspección eléctrica', 409, 'Medición de PT-100 rodamientos de motor', 'estado', 'ohm', true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_pt100":true,"usa_observacion":true}'::jsonb),
      ('4.10', '4.0 Inspección eléctrica', 410, 'Temperatura según tabla adjunta', 'estado', '°C', true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_valor_texto":true,"usa_observacion":true}'::jsonb),
      ('4.11', '4.0 Inspección eléctrica', 411, 'Conexión de PT-100 de rodamiento de motor', 'estado', null, true,
       '{"usa_encontrado":true,"usa_acciones":true,"usa_observacion":true}'::jsonb),

      ('5.1', '5.0 Relatorio resumen', 501, 'Relatorio resumen', 'estado', null, true,
       '{"usa_texto_largo":true,"usa_observacion":true}'::jsonb)
  ) as t(codigo, seccion, orden, actividad, tipo_respuesta, unidad, requerido, config)
)
insert into public.ot_checklist_items (
  empresa_id,
  plantilla_id,
  codigo,
  seccion,
  orden,
  actividad,
  tipo_respuesta,
  unidad,
  requerido,
  ayuda,
  activo,
  config
)
select
  p.empresa_id,
  p.id,
  i.codigo,
  i.seccion,
  i.orden,
  i.actividad,
  i.tipo_respuesta,
  i.unidad,
  i.requerido,
  null,
  true,
  i.config
from plantillas p
cross join items i
on conflict (plantilla_id, codigo)
do update set
  seccion = excluded.seccion,
  orden = excluded.orden,
  actividad = excluded.actividad,
  tipo_respuesta = excluded.tipo_respuesta,
  unidad = excluded.unidad,
  requerido = excluded.requerido,
  activo = true,
  config = excluded.config,
  updated_at = now();

create or replace view public.ot_vw_checklist_resultados as
select
  r.id,
  r.empresa_id,
  r.ot_id,
  r.plantilla_id,
  p.codigo as plantilla_codigo,
  p.nombre as plantilla_nombre,
  r.item_id,
  i.codigo as item_codigo,
  i.seccion,
  i.orden,
  i.actividad,
  i.tipo_respuesta,
  i.unidad as item_unidad,
  i.requerido,
  i.ayuda,
  r.estado,
  r.valor_texto,
  r.valor_numero,
  r.unidad,
  r.observacion,
  r.datos,
  r.created_at,
  r.updated_at,
  coalesce(i.config, '{}'::jsonb) as item_config,
  coalesce(p.config, '{}'::jsonb) as plantilla_config,
  i.activo as item_activo
from public.ot_checklist_resultados r
join public.ot_checklist_plantillas p on p.id = r.plantilla_id
join public.ot_checklist_items i on i.id = r.item_id
where i.activo = true;

create or replace function public.ot_generar_checklist_motor_mt_ot(p_ot_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ot record;
  v_plantilla_id uuid;
  v_insertados integer := 0;
begin
  select ot.id, ot.empresa_id, ot.plantilla_id
  into v_ot
  from public.ot_ordenes_trabajo ot
  where ot.id = p_ot_id
    and coalesce(ot.activo, true) = true
    and ot.deleted_at is null;

  if not found then
    raise exception 'No se encontró la OT indicada.';
  end if;

  if auth.uid() is not null and not exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = v_ot.empresa_id
      and ue.usuario_id = auth.uid()
      and ue.activo = true
  ) then
    raise exception 'Usuario no autorizado para esta OT.';
  end if;

  select cp.id
  into v_plantilla_id
  from public.ot_plantillas op
  join public.ot_checklist_plantillas cp
    on cp.empresa_id = v_ot.empresa_id
   and cp.codigo = op.checklist_plantilla_codigo
   and cp.activo = true
  where op.id = v_ot.plantilla_id
    and op.checklist_plantilla_codigo = 'motor_mt_post_mantencion'
  limit 1;

  if v_plantilla_id is null then
    select cp.id
    into v_plantilla_id
    from public.ot_checklist_plantillas cp
    where cp.empresa_id = v_ot.empresa_id
      and cp.codigo = 'motor_mt_post_mantencion'
      and cp.activo = true
    limit 1;
  end if;

  if v_plantilla_id is null then
    raise exception 'No existe plantilla activa motor_mt_post_mantencion para esta empresa.';
  end if;

  insert into public.ot_checklist_resultados (
    empresa_id,
    ot_id,
    plantilla_id,
    item_id,
    estado,
    datos
  )
  select
    v_ot.empresa_id,
    v_ot.id,
    v_plantilla_id,
    i.id,
    'pendiente',
    '{}'::jsonb
  from public.ot_checklist_items i
  where i.plantilla_id = v_plantilla_id
    and i.activo = true
    and not exists (
      select 1
      from public.ot_checklist_resultados r
      where r.ot_id = v_ot.id
        and r.item_id = i.id
    );

  get diagnostics v_insertados = row_count;

  return v_insertados;
end;
$$;

grant execute on function public.ot_generar_checklist_motor_mt_ot(uuid) to authenticated;

insert into public.ot_checklist_resultados (
  empresa_id,
  ot_id,
  plantilla_id,
  item_id,
  estado,
  datos
)
select
  ot.empresa_id,
  ot.id,
  cp.id,
  ci.id,
  'pendiente',
  '{}'::jsonb
from public.ot_ordenes_trabajo ot
join public.ot_plantillas op on op.id = ot.plantilla_id
join public.ot_checklist_plantillas cp
  on cp.empresa_id = ot.empresa_id
 and cp.codigo = op.checklist_plantilla_codigo
 and cp.activo = true
join public.ot_checklist_items ci
  on ci.plantilla_id = cp.id
 and ci.activo = true
where op.checklist_plantilla_codigo = 'motor_mt_post_mantencion'
  and coalesce(ot.activo, true) = true
  and ot.deleted_at is null
  and not exists (
    select 1
    from public.ot_checklist_resultados r
    where r.ot_id = ot.id
      and r.item_id = ci.id
  );
