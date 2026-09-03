-- Piloto PTS: prevalidacion y flujo de revision controlado desde base de datos.

begin;

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
    'PTS enviado a revision de Seguridad.',
    auth.uid()
  );

  return p_permiso_id;
end;
$$;

create or replace function public.pts_resolver_revision(
  p_permiso_id uuid,
  p_decision text,
  p_observacion text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_estado text;
  v_nuevo_estado text;
  v_evento text;
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

  if v_estado <> 'en_revision' then
    raise exception 'Solo se puede resolver un PTS en revision';
  end if;

  if p_decision not in ('aprobar', 'observar', 'rechazar') then
    raise exception 'Decision no valida';
  end if;

  if p_decision in ('observar', 'rechazar')
     and nullif(trim(coalesce(p_observacion, '')), '') is null then
    raise exception 'Debes registrar una observacion para esta decision';
  end if;

  v_nuevo_estado := case p_decision
    when 'aprobar' then 'aprobado'
    when 'observar' then 'observado'
    else 'rechazado'
  end;

  v_evento := case p_decision
    when 'aprobar' then 'revision_aprobada'
    when 'observar' then 'revision_observada'
    else 'revision_rechazada'
  end;

  update public.pts_aprobaciones
  set estado = case p_decision
        when 'aprobar' then 'aprobado'
        when 'observar' then 'observado'
        else 'rechazado'
      end,
      observacion = nullif(trim(coalesce(p_observacion, '')), ''),
      usuario_id = auth.uid(),
      firmado_at = now()
  where permiso_id = p_permiso_id
    and empresa_id = v_empresa_id
    and etapa = 'seguridad';

  update public.pts_permisos
  set estado = v_nuevo_estado,
      aprobado_at = case when p_decision = 'aprobar' then now() else aprobado_at end
  where id = p_permiso_id
    and empresa_id = v_empresa_id;

  insert into public.pts_historial (
    permiso_id,
    empresa_id,
    evento,
    detalle,
    usuario_id
  ) values (
    p_permiso_id,
    v_empresa_id,
    v_evento,
    case
      when nullif(trim(coalesce(p_observacion, '')), '') is null then 'Revision resuelta por Seguridad.'
      else trim(p_observacion)
    end,
    auth.uid()
  );

  return p_permiso_id;
end;
$$;

grant execute on function public.pts_enviar_revision(uuid) to authenticated;
grant execute on function public.pts_resolver_revision(uuid, text, text) to authenticated;

commit;
