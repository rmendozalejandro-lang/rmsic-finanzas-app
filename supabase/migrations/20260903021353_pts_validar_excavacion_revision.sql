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
  v_altura_requerido integer;
  v_altura_respuestas integer;
  v_altura_pendientes integer;
  v_altura_no integer;
  v_izaje_requerido integer;
  v_izaje_respuestas integer;
  v_izaje_pendientes integer;
  v_izaje_no integer;
  v_excavacion_requerido integer;
  v_excavacion_respuestas integer;
  v_excavacion_pendientes integer;
  v_excavacion_no integer;
  v_excavacion_na_invalidos integer;
  v_otros_pendientes integer;
  v_ultima_observacion timestamptz;
  v_ultima_correccion timestamptz;
begin
  select empresa_id, estado into v_empresa_id, v_estado
  from public.pts_permisos where id = p_permiso_id;

  if v_empresa_id is null then raise exception 'PTS no encontrado'; end if;
  if not public.usuario_tiene_acceso_pts(v_empresa_id) then raise exception 'Sin permisos para este PTS'; end if;
  if v_estado not in ('borrador', 'observado') then raise exception 'El PTS no se puede enviar a revision desde el estado %', v_estado; end if;

  if v_estado = 'observado' then
    select max(created_at) into v_ultima_observacion from public.pts_historial
    where permiso_id = p_permiso_id and empresa_id = v_empresa_id and evento = 'revision_observada';
    select max(created_at) into v_ultima_correccion from public.pts_historial
    where permiso_id = p_permiso_id and empresa_id = v_empresa_id and evento = 'correccion_guardada';
    if v_ultima_correccion is null or (v_ultima_observacion is not null and v_ultima_correccion <= v_ultima_observacion) then
      raise exception 'Debes guardar una correccion antes de reenviar el PTS';
    end if;
  end if;

  select count(*) into v_ast from public.pts_ast
  where permiso_id = p_permiso_id and empresa_id = v_empresa_id
    and nullif(trim(area_trabajo), '') is not null
    and nullif(trim(supervisor_responsable), '') is not null;
  if v_ast = 0 then raise exception 'Debes completar el AST antes de enviar el expediente a revision'; end if;

  select count(*) into v_riesgos from public.pts_analisis_riesgos
  where permiso_id = p_permiso_id and empresa_id = v_empresa_id
    and nullif(trim(actividad), '') is not null and nullif(trim(peligros), '') is not null
    and nullif(trim(riesgos), '') is not null and nullif(trim(medidas_preventivas), '') is not null;
  select count(*) into v_personal from public.pts_personal
  where permiso_id = p_permiso_id and empresa_id = v_empresa_id
    and nullif(trim(nombre_apellido), '') is not null and nullif(trim(rut), '') is not null;
  select count(*) into v_epp from public.pts_epp
  where permiso_id = p_permiso_id and empresa_id = v_empresa_id and requerido = true;
  if v_riesgos = 0 then raise exception 'Debes registrar al menos un paso completo del analisis de riesgos'; end if;
  if v_personal = 0 then raise exception 'Debes registrar al menos una persona participante'; end if;
  if v_epp = 0 then raise exception 'Debes seleccionar al menos un EPP o elemento de seguridad'; end if;

  select count(*) into v_general_requerido from public.pts_permisos_complementarios
  where permiso_id=p_permiso_id and empresa_id=v_empresa_id and tipo='general' and requerido=true;
  if v_general_requerido > 0 then
    select count(*) filter (where c.codigo_item = any (array[
      'GEN-EPP-01','GEN-EPP-02','GEN-EPP-03','GEN-EPP-04','GEN-EPP-05','GEN-EPP-06','GEN-EPP-07','GEN-EPP-08','GEN-EPP-09',
      'GEN-CHK-01','GEN-CHK-02','GEN-CHK-03','GEN-CHK-04','GEN-CHK-05','GEN-CHK-06','GEN-CHK-07','GEN-CHK-08','GEN-CHK-09','GEN-CHK-10','GEN-CHK-11','GEN-CHK-12','GEN-CHK-13','GEN-CHK-14','GEN-CHK-15']::text[])),
      count(*) filter (where c.respuesta is null), count(*) filter (where c.respuesta='no')
      into v_general_respuestas,v_general_pendientes,v_general_no
    from public.pts_checklist_respuestas c join public.pts_permisos_complementarios pc
      on pc.id=c.permiso_complementario_id and pc.empresa_id=c.empresa_id
    where pc.permiso_id=p_permiso_id and pc.empresa_id=v_empresa_id and pc.tipo='general' and pc.requerido=true;
    if v_general_respuestas <> 24 then raise exception 'El Permiso de Trabajo General debe tener sus 24 controles esperados registrados antes de revision'; end if;
    if v_general_pendientes > 0 then raise exception 'El Permiso de Trabajo General tiene respuestas pendientes'; end if;
    if v_general_no > 0 then raise exception 'El Permiso de Trabajo General contiene respuestas NO y no puede aprobarse'; end if;
  end if;

  select count(*) into v_altura_requerido from public.pts_permisos_complementarios
  where permiso_id=p_permiso_id and empresa_id=v_empresa_id and tipo='altura' and requerido=true;
  if v_altura_requerido > 0 then
    select count(*) filter (where c.codigo_item = any (array[
      'ALT-CHK-01','ALT-CHK-02','ALT-CHK-03','ALT-CHK-04','ALT-CHK-05','ALT-CHK-06','ALT-CHK-07','ALT-CHK-08','ALT-CHK-09','ALT-CHK-10','ALT-CHK-11','ALT-CHK-12','ALT-CHK-13','ALT-CHK-14',
      'ALT-EPP-01','ALT-EPP-02','ALT-EPP-03','ALT-EPP-04','ALT-EPP-05','ALT-EPP-06','ALT-EPP-07','ALT-EPP-08']::text[])),
      count(*) filter (where c.respuesta is null), count(*) filter (where c.respuesta='no')
      into v_altura_respuestas,v_altura_pendientes,v_altura_no
    from public.pts_checklist_respuestas c join public.pts_permisos_complementarios pc
      on pc.id=c.permiso_complementario_id and pc.empresa_id=c.empresa_id
    where pc.permiso_id=p_permiso_id and pc.empresa_id=v_empresa_id and pc.tipo='altura' and pc.requerido=true;
    if v_altura_respuestas <> 22 then raise exception 'El Permiso de Trabajo en Altura debe tener sus 22 controles esperados registrados antes de revision'; end if;
    if v_altura_pendientes > 0 then raise exception 'El Permiso de Trabajo en Altura tiene respuestas pendientes'; end if;
    if v_altura_no > 0 then raise exception 'El Permiso de Trabajo en Altura contiene respuestas NO y no puede aprobarse'; end if;
  end if;

  select count(*) into v_izaje_requerido from public.pts_permisos_complementarios
  where permiso_id=p_permiso_id and empresa_id=v_empresa_id and tipo='izaje' and requerido=true;
  if v_izaje_requerido > 0 then
    select count(*) filter (where c.codigo_item = any (array[
      'IZA-CHK-01','IZA-CHK-02','IZA-CHK-03','IZA-CHK-04','IZA-CHK-05','IZA-CHK-06','IZA-CHK-07','IZA-CHK-08','IZA-CHK-09','IZA-CHK-10','IZA-CHK-11','IZA-CHK-12','IZA-CHK-13']::text[])),
      count(*) filter (where c.respuesta is null), count(*) filter (where c.respuesta='no')
      into v_izaje_respuestas,v_izaje_pendientes,v_izaje_no
    from public.pts_checklist_respuestas c join public.pts_permisos_complementarios pc
      on pc.id=c.permiso_complementario_id and pc.empresa_id=c.empresa_id
    where pc.permiso_id=p_permiso_id and pc.empresa_id=v_empresa_id and pc.tipo='izaje' and pc.requerido=true;
    if v_izaje_respuestas <> 13 then raise exception 'El Permiso de Maniobras de Izaje debe tener sus 13 controles esperados registrados antes de revision'; end if;
    if v_izaje_pendientes > 0 then raise exception 'El Permiso de Maniobras de Izaje tiene respuestas pendientes'; end if;
    if v_izaje_no > 0 then raise exception 'El Permiso de Maniobras de Izaje contiene respuestas NO y no puede aprobarse'; end if;
  end if;

  select count(*) into v_excavacion_requerido from public.pts_permisos_complementarios
  where permiso_id=p_permiso_id and empresa_id=v_empresa_id and tipo='excavacion' and requerido=true;
  if v_excavacion_requerido > 0 then
    select
      count(*) filter (where c.codigo_item = any (array[
        'EXC-CHK-01','EXC-CHK-02','EXC-CHK-03','EXC-CHK-04','EXC-CHK-05','EXC-CHK-06','EXC-CHK-07','EXC-CHK-08','EXC-CHK-09','EXC-CHK-10','EXC-CHK-11','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
        'EXC-EPP-01','EXC-EPP-02','EXC-EPP-03','EXC-EPP-04','EXC-EPP-05','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08']::text[])),
      count(*) filter (where c.respuesta is null),
      count(*) filter (where c.respuesta='no'),
      count(*) filter (where c.respuesta='na' and (
        c.codigo_item not in ('EXC-CHK-08','EXC-CHK-09','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14','EXC-EPP-04','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08')
        or nullif(trim(c.observacion),'') is null))
      into v_excavacion_respuestas,v_excavacion_pendientes,v_excavacion_no,v_excavacion_na_invalidos
    from public.pts_checklist_respuestas c join public.pts_permisos_complementarios pc
      on pc.id=c.permiso_complementario_id and pc.empresa_id=c.empresa_id
    where pc.permiso_id=p_permiso_id and pc.empresa_id=v_empresa_id and pc.tipo='excavacion' and pc.requerido=true;
    if v_excavacion_respuestas <> 22 then raise exception 'El Permiso de Excavacion debe tener sus 22 controles esperados registrados antes de revision'; end if;
    if v_excavacion_pendientes > 0 then raise exception 'El Permiso de Excavacion tiene respuestas pendientes'; end if;
    if v_excavacion_no > 0 then raise exception 'El Permiso de Excavacion contiene respuestas NO y no puede aprobarse'; end if;
    if v_excavacion_na_invalidos > 0 then raise exception 'El Permiso de Excavacion contiene respuestas N/A no permitidas o sin justificacion'; end if;
  end if;

  select count(*) into v_otros_pendientes from public.pts_permisos_complementarios
  where permiso_id=p_permiso_id and empresa_id=v_empresa_id and requerido=true
    and tipo not in ('general','altura','izaje','excavacion') and estado <> 'completo';
  if v_otros_pendientes > 0 then raise exception 'Existen permisos complementarios requeridos que aun no estan completos'; end if;

  update public.pts_permisos set estado='en_revision', enviado_revision_at=now()
  where id=p_permiso_id and empresa_id=v_empresa_id;
  update public.pts_aprobaciones set estado='pendiente', observacion=null, firmado_at=null, usuario_id=null
  where permiso_id=p_permiso_id and empresa_id=v_empresa_id and etapa='seguridad';
  insert into public.pts_historial (permiso_id,empresa_id,evento,detalle,usuario_id)
  values (p_permiso_id,v_empresa_id,'enviado_revision',
    case when v_estado='observado' then 'PTS corregido y reenviado a revision de Seguridad.' else 'PTS enviado a revision de Seguridad.' end,
    auth.uid());
  return p_permiso_id;
end;
$function$;

revoke all on function public.pts_enviar_revision(uuid) from public, anon;
grant execute on function public.pts_enviar_revision(uuid) to authenticated, service_role;
