-- Piloto PTS: correccion controlada de permisos observados.

begin;

create or replace function public.pts_guardar_correccion(
  p_permiso_id uuid,
  p_identificacion jsonb,
  p_riesgos jsonb,
  p_personal jsonb,
  p_epp jsonb,
  p_correccion text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_estado text;
  v_item jsonb;
  v_orden integer;
begin
  select empresa_id, estado
    into v_empresa_id, v_estado
  from public.pts_permisos
  where id = p_permiso_id
  for update;

  if v_empresa_id is null then
    raise exception 'PTS no encontrado';
  end if;

  if not public.usuario_tiene_acceso_pts(v_empresa_id) then
    raise exception 'Sin permisos para este PTS';
  end if;

  if v_estado <> 'observado' then
    raise exception 'Solo se puede corregir un PTS observado';
  end if;

  if nullif(trim(coalesce(p_correccion, '')), '') is null then
    raise exception 'Debes describir la correccion realizada';
  end if;

  if nullif(trim(coalesce(p_identificacion->>'trabajo_a_realizar', '')), '') is null
     or nullif(trim(coalesce(p_identificacion->>'tipo_actividad', '')), '') is null
     or nullif(trim(coalesce(p_identificacion->>'lugar_ejecucion', '')), '') is null
     or nullif(trim(coalesce(p_identificacion->>'empresa_contratista', '')), '') is null
     or nullif(trim(coalesce(p_identificacion->>'fecha_inicio', '')), '') is null then
    raise exception 'Completa los datos obligatorios de identificacion';
  end if;

  if coalesce(jsonb_typeof(p_riesgos), '') <> 'array' or jsonb_array_length(p_riesgos) = 0 then
    raise exception 'Debes registrar al menos un paso del analisis de riesgos';
  end if;

  for v_item in select value from jsonb_array_elements(p_riesgos)
  loop
    if nullif(trim(coalesce(v_item->>'actividad', '')), '') is null
       or nullif(trim(coalesce(v_item->>'peligros', '')), '') is null
       or nullif(trim(coalesce(v_item->>'riesgos', '')), '') is null
       or nullif(trim(coalesce(v_item->>'medidas_preventivas', '')), '') is null then
      raise exception 'Todos los pasos del analisis de riesgos deben estar completos';
    end if;
  end loop;

  if coalesce(jsonb_typeof(p_personal), '') <> 'array' or jsonb_array_length(p_personal) = 0 then
    raise exception 'Debes registrar al menos una persona participante';
  end if;

  for v_item in select value from jsonb_array_elements(p_personal)
  loop
    if nullif(trim(coalesce(v_item->>'nombre_apellido', '')), '') is null
       or nullif(trim(coalesce(v_item->>'rut', '')), '') is null then
      raise exception 'Nombre y RUT son obligatorios para todo el personal';
    end if;
  end loop;

  if coalesce(jsonb_typeof(p_epp), '') <> 'array' or jsonb_array_length(p_epp) = 0 then
    raise exception 'Debes seleccionar al menos un EPP o elemento de seguridad';
  end if;

  update public.pts_permisos
  set trabajo_a_realizar = trim(p_identificacion->>'trabajo_a_realizar'),
      tipo_actividad = trim(p_identificacion->>'tipo_actividad'),
      lugar_ejecucion = trim(p_identificacion->>'lugar_ejecucion'),
      empresa_contratista = trim(p_identificacion->>'empresa_contratista'),
      fecha_inicio = (p_identificacion->>'fecha_inicio')::date,
      fecha_termino = nullif(p_identificacion->>'fecha_termino', '')::date,
      hora_inicio = nullif(p_identificacion->>'hora_inicio', '')::time,
      hora_termino = nullif(p_identificacion->>'hora_termino', '')::time,
      observaciones = nullif(trim(coalesce(p_identificacion->>'observaciones', '')), '')
  where id = p_permiso_id
    and empresa_id = v_empresa_id;

  delete from public.pts_analisis_riesgos
  where permiso_id = p_permiso_id and empresa_id = v_empresa_id;

  v_orden := 0;
  for v_item in select value from jsonb_array_elements(p_riesgos)
  loop
    v_orden := v_orden + 1;
    insert into public.pts_analisis_riesgos (
      permiso_id, empresa_id, paso, actividad, peligros, riesgos, medidas_preventivas, orden
    ) values (
      p_permiso_id,
      v_empresa_id,
      v_orden,
      trim(v_item->>'actividad'),
      trim(v_item->>'peligros'),
      trim(v_item->>'riesgos'),
      trim(v_item->>'medidas_preventivas'),
      v_orden
    );
  end loop;

  delete from public.pts_personal
  where permiso_id = p_permiso_id and empresa_id = v_empresa_id;

  v_orden := 0;
  for v_item in select value from jsonb_array_elements(p_personal)
  loop
    v_orden := v_orden + 1;
    insert into public.pts_personal (
      permiso_id,
      empresa_id,
      nombre_apellido,
      rut,
      induccion_ingreso_ok,
      charla_5_min_ok,
      examen_altura_vigente_hasta,
      orden
    ) values (
      p_permiso_id,
      v_empresa_id,
      trim(v_item->>'nombre_apellido'),
      trim(v_item->>'rut'),
      coalesce((v_item->>'induccion_ingreso_ok')::boolean, false),
      coalesce((v_item->>'charla_5_min_ok')::boolean, false),
      nullif(v_item->>'examen_altura_vigente_hasta', '')::date,
      v_orden
    );
  end loop;

  delete from public.pts_epp
  where permiso_id = p_permiso_id and empresa_id = v_empresa_id;

  insert into public.pts_epp (
    permiso_id, empresa_id, codigo, nombre, requerido, orden
  )
  select
    p_permiso_id,
    v_empresa_id,
    'EPP-' || lpad(ordinality::text, 2, '0'),
    trim(value),
    true,
    ordinality::integer
  from jsonb_array_elements_text(p_epp) with ordinality;

  insert into public.pts_historial (
    permiso_id,
    empresa_id,
    evento,
    detalle,
    usuario_id
  ) values (
    p_permiso_id,
    v_empresa_id,
    'correccion_guardada',
    trim(p_correccion),
    auth.uid()
  );

  return p_permiso_id;
end;
$$;

create or replace function public.pts_enviar_revision(p_permiso_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_estado text;
  v_riesgos integer;
  v_personal integer;
  v_epp integer;
  v_ultima_observacion timestamptz;
  v_ultima_correccion timestamptz;
begin
  select empresa_id, estado
    into v_empresa_id, v_estado
  from public.pts_permisos
  where id = p_permiso_id;

  if v_empresa_id is null then
    raise exception 'PTS no encontrado';
  end if;

  if not public.usuario_tiene_acceso_pts(v_empresa_id) then
    raise exception 'Sin permisos para este PTS';
  end if;

  if v_estado not in ('borrador', 'observado') then
    raise exception 'El PTS no se puede enviar a revision desde el estado %', v_estado;
  end if;

  if v_estado = 'observado' then
    select max(created_at) into v_ultima_observacion
    from public.pts_historial
    where permiso_id = p_permiso_id
      and empresa_id = v_empresa_id
      and evento = 'revision_observada';

    select max(created_at) into v_ultima_correccion
    from public.pts_historial
    where permiso_id = p_permiso_id
      and empresa_id = v_empresa_id
      and evento = 'correccion_guardada';

    if v_ultima_correccion is null
       or (v_ultima_observacion is not null and v_ultima_correccion <= v_ultima_observacion) then
      raise exception 'Debes guardar una correccion antes de reenviar el PTS';
    end if;
  end if;

  select count(*) into v_riesgos
  from public.pts_analisis_riesgos
  where permiso_id = p_permiso_id
    and empresa_id = v_empresa_id
    and nullif(trim(actividad), '') is not null
    and nullif(trim(peligros), '') is not null
    and nullif(trim(riesgos), '') is not null
    and nullif(trim(medidas_preventivas), '') is not null;

  select count(*) into v_personal
  from public.pts_personal
  where permiso_id = p_permiso_id
    and empresa_id = v_empresa_id
    and nullif(trim(nombre_apellido), '') is not null
    and nullif(trim(rut), '') is not null;

  select count(*) into v_epp
  from public.pts_epp
  where permiso_id = p_permiso_id
    and empresa_id = v_empresa_id
    and requerido = true;

  if v_riesgos = 0 then
    raise exception 'Debes registrar al menos un paso completo del analisis de riesgos';
  end if;

  if v_personal = 0 then
    raise exception 'Debes registrar al menos una persona participante';
  end if;

  if v_epp = 0 then
    raise exception 'Debes seleccionar al menos un EPP o elemento de seguridad';
  end if;

  update public.pts_permisos
  set estado = 'en_revision',
      enviado_revision_at = now()
  where id = p_permiso_id
    and empresa_id = v_empresa_id;

  update public.pts_aprobaciones
  set estado = 'pendiente',
      observacion = null,
      firmado_at = null,
      usuario_id = null
  where permiso_id = p_permiso_id
    and empresa_id = v_empresa_id
    and etapa = 'seguridad';

  insert into public.pts_historial (
    permiso_id,
    empresa_id,
    evento,
    detalle,
    usuario_id
  ) values (
    p_permiso_id,
    v_empresa_id,
    'enviado_revision',
    case when v_estado = 'observado'
      then 'PTS corregido y reenviado a revision de Seguridad.'
      else 'PTS enviado a revision de Seguridad.'
    end,
    auth.uid()
  );

  return p_permiso_id;
end;
$$;

grant execute on function public.pts_guardar_correccion(uuid, jsonb, jsonb, jsonb, jsonb, text) to authenticated;
grant execute on function public.pts_enviar_revision(uuid) to authenticated;

commit;
