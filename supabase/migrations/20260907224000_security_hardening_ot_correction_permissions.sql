-- Security hardening: OT technical correction authorization
-- Prepared in feature branch only. Do not apply to production until regression tests pass.
--
-- Current production behavior allows ANY active company member to authorize or block
-- technical correction of an OT. These actions are administrative controls and should
-- be limited to super_admin or company admin.

begin;

create or replace function public.ot_autorizar_correccion_tecnica(
  p_ot_id uuid,
  p_motivo text default null::text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_empresa_id uuid;
  v_usuario_id uuid;
begin
  v_usuario_id := auth.uid();

  if v_usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select empresa_id
  into v_empresa_id
  from public.ot_ordenes_trabajo
  where id = p_ot_id
    and coalesce(activo, true) = true
    and deleted_at is null;

  if v_empresa_id is null then
    raise exception 'OT no encontrada';
  end if;

  if not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_usuario_id
        and ue.empresa_id = v_empresa_id
        and coalesce(ue.activo, true) = true
        and ue.rol = 'admin'
    )
  ) then
    raise exception 'Solo un administrador puede autorizar correcciones técnicas de esta OT';
  end if;

  update public.ot_ordenes_trabajo
  set
    edicion_tecnica_autorizada = true,
    edicion_tecnica_autorizada_por = v_usuario_id,
    edicion_tecnica_autorizada_at = now(),
    edicion_tecnica_motivo = p_motivo,
    bloqueada_para_tecnico = false,
    updated_at = now()
  where id = p_ot_id;

  insert into public.ot_historial_cambios (
    empresa_id,
    ot_id,
    usuario_id,
    tipo_evento,
    descripcion,
    datos_despues
  )
  values (
    v_empresa_id,
    p_ot_id,
    v_usuario_id,
    'autorizar_correccion_tecnica',
    coalesce(nullif(trim(p_motivo), ''), 'Corrección técnica autorizada por administrador'),
    jsonb_build_object(
      'edicion_tecnica_autorizada', true,
      'autorizada_por', v_usuario_id
    )
  );
end;
$function$;

create or replace function public.ot_bloquear_edicion_tecnica(
  p_ot_id uuid,
  p_motivo text default null::text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_empresa_id uuid;
  v_usuario_id uuid;
begin
  v_usuario_id := auth.uid();

  if v_usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select empresa_id
  into v_empresa_id
  from public.ot_ordenes_trabajo
  where id = p_ot_id
    and coalesce(activo, true) = true
    and deleted_at is null;

  if v_empresa_id is null then
    raise exception 'OT no encontrada';
  end if;

  if not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_usuario_id
        and ue.empresa_id = v_empresa_id
        and coalesce(ue.activo, true) = true
        and ue.rol = 'admin'
    )
  ) then
    raise exception 'Solo un administrador puede bloquear la edición técnica de esta OT';
  end if;

  update public.ot_ordenes_trabajo
  set
    edicion_tecnica_autorizada = false,
    bloqueada_para_tecnico = true,
    updated_at = now()
  where id = p_ot_id;

  insert into public.ot_historial_cambios (
    empresa_id,
    ot_id,
    usuario_id,
    tipo_evento,
    descripcion,
    datos_despues
  )
  values (
    v_empresa_id,
    p_ot_id,
    v_usuario_id,
    'bloquear_edicion_tecnica',
    coalesce(nullif(trim(p_motivo), ''), 'Edición técnica bloqueada por administrador'),
    jsonb_build_object(
      'bloqueada_para_tecnico', true,
      'bloqueada_por', v_usuario_id
    )
  );
end;
$function$;

revoke execute on function public.ot_autorizar_correccion_tecnica(uuid, text) from anon;
revoke execute on function public.ot_bloquear_edicion_tecnica(uuid, text) from anon;

grant execute on function public.ot_autorizar_correccion_tecnica(uuid, text) to authenticated;
grant execute on function public.ot_bloquear_edicion_tecnica(uuid, text) to authenticated;

commit;
