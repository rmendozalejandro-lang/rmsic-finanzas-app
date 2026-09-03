drop policy if exists pts_personal_insert_editable on public.pts_personal;
drop policy if exists pts_personal_update_editable on public.pts_personal;
drop policy if exists pts_personal_delete_editable on public.pts_personal;

create policy pts_personal_insert_editable
on public.pts_personal
for insert
to authenticated
with check (
  public.usuario_tiene_acceso_pts(pts_personal.empresa_id)
  and exists (
    select 1
    from public.pts_permisos p
    where p.id = pts_personal.permiso_id
      and p.empresa_id = pts_personal.empresa_id
      and p.estado in ('borrador', 'observado')
  )
);

create policy pts_personal_update_editable
on public.pts_personal
for update
to authenticated
using (
  public.usuario_tiene_acceso_pts(pts_personal.empresa_id)
  and exists (
    select 1
    from public.pts_permisos p
    where p.id = pts_personal.permiso_id
      and p.empresa_id = pts_personal.empresa_id
      and p.estado in ('borrador', 'observado')
  )
)
with check (
  public.usuario_tiene_acceso_pts(pts_personal.empresa_id)
  and exists (
    select 1
    from public.pts_permisos p
    where p.id = pts_personal.permiso_id
      and p.empresa_id = pts_personal.empresa_id
      and p.estado in ('borrador', 'observado')
  )
);

create policy pts_personal_delete_editable
on public.pts_personal
for delete
to authenticated
using (
  public.usuario_tiene_acceso_pts(pts_personal.empresa_id)
  and exists (
    select 1
    from public.pts_permisos p
    where p.id = pts_personal.permiso_id
      and p.empresa_id = pts_personal.empresa_id
      and p.estado in ('borrador', 'observado')
  )
);

create or replace function public.pts_firmar_participante(
  p_permiso_id uuid,
  p_personal_id uuid,
  p_firma_trazos jsonb
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
  v_seguridad_estado text;
  v_nombre text;
  v_rut text;
  v_capturado_por text;
  v_firma_id uuid;
  v_invalidos integer;
  v_declaracion constant text := 'Declaro haber leído y comprendido los riesgos, controles y condiciones de este PTS, y me comprometo a cumplirlos durante la ejecución del trabajo.';
begin
  if v_usuario_id is null then raise exception 'Debes iniciar sesión para registrar una firma'; end if;

  select p.empresa_id, p.estado into v_empresa_id, v_estado
  from public.pts_permisos p where p.id = p_permiso_id for update;

  if v_empresa_id is null then raise exception 'PTS no encontrado'; end if;
  if not public.usuario_tiene_acceso_pts(v_empresa_id) then raise exception 'Sin permisos para este PTS'; end if;
  if v_estado <> 'aprobado' then raise exception 'Las firmas de participantes se registran después de la aprobación y antes del inicio del trabajo'; end if;

  select a.estado into v_seguridad_estado
  from public.pts_aprobaciones a
  where a.permiso_id = p_permiso_id and a.empresa_id = v_empresa_id and a.etapa = 'seguridad';
  if coalesce(v_seguridad_estado, '') <> 'aprobado' then raise exception 'El PTS requiere aprobación vigente de Seguridad antes de firmar'; end if;

  select pe.nombre_apellido, pe.rut into v_nombre, v_rut
  from public.pts_personal pe
  where pe.id = p_personal_id and pe.permiso_id = p_permiso_id and pe.empresa_id = v_empresa_id;
  if v_nombre is null or v_rut is null then raise exception 'El participante no pertenece a este PTS'; end if;

  if exists (
    select 1 from public.pts_firmas_participantes f
    where f.permiso_id = p_permiso_id and f.empresa_id = v_empresa_id and f.personal_id = p_personal_id
  ) then raise exception 'Este participante ya registró su firma'; end if;

  if jsonb_typeof(coalesce(p_firma_trazos, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_firma_trazos) < 1
     or jsonb_array_length(p_firma_trazos) > 20
     or char_length(p_firma_trazos::text) > 50000 then
    raise exception 'La firma registrada no es válida';
  end if;

  select count(*) into v_invalidos
  from jsonb_array_elements(p_firma_trazos) stroke
  where jsonb_typeof(stroke) <> 'array'
     or case when jsonb_typeof(stroke) = 'array' then jsonb_array_length(stroke) not between 2 and 500 else false end;
  if v_invalidos > 0 then raise exception 'La firma contiene trazos inválidos'; end if;

  select count(*) into v_invalidos
  from jsonb_array_elements(p_firma_trazos) stroke
  cross join lateral jsonb_array_elements(case when jsonb_typeof(stroke) = 'array' then stroke else '[]'::jsonb end) punto
  where jsonb_typeof(punto) <> 'object'
     or jsonb_typeof(punto->'x') <> 'number'
     or jsonb_typeof(punto->'y') <> 'number'
     or (punto->>'x')::numeric < 0
     or (punto->>'x')::numeric > 1000
     or (punto->>'y')::numeric < 0
     or (punto->>'y')::numeric > 300;
  if v_invalidos > 0 then raise exception 'La firma contiene puntos inválidos'; end if;

  select nullif(trim(pf.nombre_completo), '') into v_capturado_por
  from public.perfiles pf
  where pf.id = v_usuario_id and coalesce(pf.activo, true) = true;
  if v_capturado_por is null then raise exception 'No se pudo identificar al usuario que captura la firma'; end if;

  insert into public.pts_firmas_participantes (
    permiso_id, empresa_id, personal_id, nombre_firmante, rut_firmante, declaracion,
    declaracion_version, firma_trazos, metodo, capturado_por_usuario_id, capturado_por_nombre, firmado_at
  ) values (
    p_permiso_id, v_empresa_id, p_personal_id, trim(v_nombre), trim(v_rut), v_declaracion,
    1, p_firma_trazos, 'trazo_en_dispositivo', v_usuario_id, v_capturado_por, now()
  ) returning id into v_firma_id;

  insert into public.pts_historial (permiso_id, empresa_id, evento, detalle, usuario_id)
  values (p_permiso_id, v_empresa_id, 'participante_firmado', 'Firma previa al inicio registrada para ' || trim(v_nombre) || ' (' || trim(v_rut) || ').', v_usuario_id);

  return v_firma_id;
end;
$function$;

revoke execute on function public.pts_firmar_participante(uuid, uuid, jsonb) from public;
revoke execute on function public.pts_firmar_participante(uuid, uuid, jsonb) from anon;
grant execute on function public.pts_firmar_participante(uuid, uuid, jsonb) to authenticated;
grant execute on function public.pts_firmar_participante(uuid, uuid, jsonb) to service_role;
