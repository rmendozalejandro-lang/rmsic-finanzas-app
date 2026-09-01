begin;

alter table public.pts_permisos
  add column if not exists iniciado_by uuid references public.perfiles(id),
  add column if not exists cerrado_by uuid references public.perfiles(id),
  add column if not exists iniciado_por_nombre text,
  add column if not exists cerrado_por_nombre text,
  add column if not exists cierre_observaciones text;

create or replace function public.pts_iniciar_ejecucion(p_permiso_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_estado text;
  v_seguridad_estado text;
  v_nombre text;
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

  if v_estado <> 'aprobado' then
    raise exception 'Solo se puede iniciar un PTS aprobado';
  end if;

  select estado into v_seguridad_estado
  from public.pts_aprobaciones
  where permiso_id = p_permiso_id
    and empresa_id = v_empresa_id
    and etapa = 'seguridad';

  if coalesce(v_seguridad_estado, '') <> 'aprobado' then
    raise exception 'El PTS requiere aprobacion vigente de Seguridad';
  end if;

  select nullif(trim(nombre_completo), '') into v_nombre
  from public.perfiles
  where id = auth.uid();

  update public.pts_permisos
  set estado = 'en_ejecucion',
      iniciado_at = now(),
      iniciado_by = auth.uid(),
      iniciado_por_nombre = coalesce(v_nombre, 'Usuario autorizado')
  where id = p_permiso_id
    and empresa_id = v_empresa_id;

  insert into public.pts_historial (
    permiso_id, empresa_id, evento, detalle, usuario_id
  ) values (
    p_permiso_id,
    v_empresa_id,
    'trabajo_iniciado',
    'Inicio de ejecución registrado por ' || coalesce(v_nombre, 'usuario autorizado') || '.',
    auth.uid()
  );

  return p_permiso_id;
end;
$$;

create or replace function public.pts_cerrar_trabajo(
  p_permiso_id uuid,
  p_observacion_cierre text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_estado text;
  v_nombre text;
  v_detalle text;
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

  if v_estado <> 'en_ejecucion' then
    raise exception 'Solo se puede cerrar un PTS en ejecucion';
  end if;

  v_detalle := trim(coalesce(p_observacion_cierre, ''));
  if char_length(v_detalle) < 10 then
    raise exception 'El cierre debe incluir una observacion final de al menos 10 caracteres';
  end if;

  select nullif(trim(nombre_completo), '') into v_nombre
  from public.perfiles
  where id = auth.uid();

  update public.pts_permisos
  set estado = 'cerrado',
      cerrado_at = now(),
      cerrado_by = auth.uid(),
      cerrado_por_nombre = coalesce(v_nombre, 'Usuario autorizado'),
      cierre_observaciones = v_detalle
  where id = p_permiso_id
    and empresa_id = v_empresa_id;

  insert into public.pts_historial (
    permiso_id, empresa_id, evento, detalle, usuario_id
  ) values (
    p_permiso_id,
    v_empresa_id,
    'trabajo_cerrado',
    v_detalle,
    auth.uid()
  );

  return p_permiso_id;
end;
$$;

grant execute on function public.pts_iniciar_ejecucion(uuid) to authenticated;
grant execute on function public.pts_cerrar_trabajo(uuid, text) to authenticated;

commit;
