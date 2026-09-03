create or replace function public.pts_resolver_revision(
  p_permiso_id uuid,
  p_decision text,
  p_observacion text default null::text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_usuario_id uuid := auth.uid();
  v_empresa_id uuid;
  v_estado text;
  v_nuevo_estado text;
  v_evento text;
  v_nombre_firmante text;
  v_filas integer;
begin
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesion para resolver la revision del PTS';
  end if;

  select p.empresa_id, p.estado
    into v_empresa_id, v_estado
  from public.pts_permisos p
  where p.id = p_permiso_id;

  if v_empresa_id is null then
    raise exception 'PTS no encontrado';
  end if;

  if not public.usuario_tiene_acceso_pts(v_empresa_id) then
    raise exception 'Sin permisos para este PTS';
  end if;

  select nullif(trim(pf.nombre_completo), '')
    into v_nombre_firmante
  from public.perfiles pf
  where pf.id = v_usuario_id
    and coalesce(pf.activo, true) = true;

  if v_nombre_firmante is null then
    raise exception 'No se pudo identificar al firmante activo de la revision';
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
      nombre_firmante = v_nombre_firmante,
      cargo_firmante = 'Prevención de Riesgos',
      observacion = nullif(trim(coalesce(p_observacion, '')), ''),
      usuario_id = v_usuario_id,
      firmado_at = now()
  where permiso_id = p_permiso_id
    and empresa_id = v_empresa_id
    and etapa = 'seguridad';

  get diagnostics v_filas = row_count;
  if v_filas <> 1 then
    raise exception 'No se encontro una aprobacion unica de Seguridad para el PTS';
  end if;

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
      when nullif(trim(coalesce(p_observacion, '')), '') is null then
        'Revision resuelta por Seguridad por ' || v_nombre_firmante || '.'
      else trim(p_observacion)
    end,
    v_usuario_id
  );

  return p_permiso_id;
end;
$function$;

revoke execute on function public.pts_resolver_revision(uuid, text, text) from public;
revoke execute on function public.pts_resolver_revision(uuid, text, text) from anon;
grant execute on function public.pts_resolver_revision(uuid, text, text) to authenticated;
grant execute on function public.pts_resolver_revision(uuid, text, text) to service_role;
