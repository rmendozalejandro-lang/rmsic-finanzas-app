create or replace function public.pts_enviar_revision(p_permiso_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
  v_estado text;
  v_riesgos integer;
  v_personal integer;
  v_epp integer;
  v_ast integer;
  v_general_requerido integer;
  v_general_respuestas integer;
  v_general_pendientes integer;
  v_general_no integer;
  v_otros_pendientes integer;
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

  select count(*) into v_ast
  from public.pts_ast
  where permiso_id = p_permiso_id
    and empresa_id = v_empresa_id
    and nullif(trim(area_trabajo), '') is not null
    and nullif(trim(supervisor_responsable), '') is not null;

  if v_ast = 0 then
    raise exception 'Debes completar el AST antes de enviar el expediente a revision';
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

  select count(*) into v_general_requerido
  from public.pts_permisos_complementarios
  where permiso_id = p_permiso_id
    and empresa_id = v_empresa_id
    and tipo = 'general'
    and requerido = true;

  if v_general_requerido > 0 then
    select count(*),
           count(*) filter (where respuesta is null),
           count(*) filter (where bloqueante_si_no = true and respuesta = 'no')
      into v_general_respuestas, v_general_pendientes, v_general_no
    from public.pts_checklist_respuestas c
    join public.pts_permisos_complementarios pc
      on pc.id = c.permiso_complementario_id
     and pc.empresa_id = c.empresa_id
    where pc.permiso_id = p_permiso_id
      and pc.empresa_id = v_empresa_id
      and pc.tipo = 'general'
      and pc.requerido = true;

    if v_general_respuestas <> 24 then
      raise exception 'El Permiso de Trabajo General debe tener sus 24 controles registrados antes de revision';
    end if;

    if v_general_pendientes > 0 then
      raise exception 'El Permiso de Trabajo General tiene respuestas pendientes';
    end if;

    if v_general_no > 0 then
      raise exception 'El Permiso de Trabajo General contiene respuestas NO y no puede aprobarse';
    end if;
  end if;

  select count(*) into v_otros_pendientes
  from public.pts_permisos_complementarios
  where permiso_id = p_permiso_id
    and empresa_id = v_empresa_id
    and requerido = true
    and tipo <> 'general'
    and estado <> 'completo';

  if v_otros_pendientes > 0 then
    raise exception 'Existen permisos complementarios requeridos que aun no estan completos';
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
$function$;

revoke all on function public.pts_enviar_revision(uuid) from public, anon;
grant execute on function public.pts_enviar_revision(uuid) to authenticated, service_role;
