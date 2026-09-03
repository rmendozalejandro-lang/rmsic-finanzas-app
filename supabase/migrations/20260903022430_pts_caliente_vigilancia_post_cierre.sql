begin;

create or replace function public.pts_iniciar_vigilancia_post_trabajo(p_permiso_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
  v_estado text;
  v_complementario_id uuid;
  v_vigia text;
  v_id uuid;
begin
  select empresa_id, estado into v_empresa_id, v_estado
  from public.pts_permisos where id=p_permiso_id for update;
  if v_empresa_id is null then raise exception 'PTS no encontrado'; end if;
  if not public.usuario_tiene_acceso_pts(v_empresa_id) then raise exception 'Sin permisos para este PTS'; end if;
  if v_estado <> 'en_ejecucion' then raise exception 'La vigilancia post trabajo solo puede iniciarse con el PTS en ejecucion'; end if;

  select id, nullif(trim(datos_especificos->>'vigia_incendios_nombre'),'')
    into v_complementario_id, v_vigia
  from public.pts_permisos_complementarios
  where permiso_id=p_permiso_id and empresa_id=v_empresa_id and tipo='caliente' and requerido=true and estado='completo';
  if v_complementario_id is null then raise exception 'No existe un Permiso de Trabajo en Caliente completo para iniciar la vigilancia'; end if;

  insert into public.pts_vigilancia_post_trabajo (
    permiso_complementario_id,empresa_id,estado,iniciado_at,finalizado_at,minutos_minimos,
    verificaciones,vigia_incendios_nombre,incidencias,conclusion,acciones_correctivas,
    responsable_mantencion,responsable_prevencion,evidencias
  ) values (
    v_complementario_id,v_empresa_id,'en_curso',now(),null,60,'[]'::jsonb,v_vigia,null,null,null,null,null,'[]'::jsonb
  )
  on conflict (permiso_complementario_id,empresa_id) do update set
    estado=case when public.pts_vigilancia_post_trabajo.estado='completa' then 'completa' else 'en_curso' end,
    iniciado_at=case when public.pts_vigilancia_post_trabajo.estado='completa' then public.pts_vigilancia_post_trabajo.iniciado_at else coalesce(public.pts_vigilancia_post_trabajo.iniciado_at,now()) end,
    vigia_incendios_nombre=coalesce(public.pts_vigilancia_post_trabajo.vigia_incendios_nombre,excluded.vigia_incendios_nombre)
  returning id into v_id;

  insert into public.pts_historial (permiso_id,empresa_id,evento,detalle,usuario_id)
  values (p_permiso_id,v_empresa_id,'vigilancia_post_iniciada','Vigilancia post trabajo en caliente iniciada. Duracion minima obligatoria: 60 minutos.',auth.uid());
  return v_id;
end;
$function$;

create or replace function public.pts_finalizar_vigilancia_post_trabajo(
  p_permiso_id uuid,
  p_verificaciones jsonb,
  p_incidencias text,
  p_emisor_notificado_nombre text,
  p_conclusion text,
  p_acciones_correctivas text,
  p_responsable_mantencion text,
  p_responsable_prevencion text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
  v_estado text;
  v_complementario_id uuid;
  v_vigilancia_id uuid;
  v_iniciado timestamptz;
  v_minutos integer;
  v_total integer;
  v_no integer;
  v_invalidas integer;
begin
  select empresa_id,estado into v_empresa_id,v_estado from public.pts_permisos where id=p_permiso_id;
  if v_empresa_id is null then raise exception 'PTS no encontrado'; end if;
  if not public.usuario_tiene_acceso_pts(v_empresa_id) then raise exception 'Sin permisos para este PTS'; end if;
  if v_estado <> 'en_ejecucion' then raise exception 'El PTS debe permanecer en ejecucion durante la vigilancia post trabajo'; end if;

  select id into v_complementario_id from public.pts_permisos_complementarios
  where permiso_id=p_permiso_id and empresa_id=v_empresa_id and tipo='caliente' and requerido=true;
  if v_complementario_id is null then raise exception 'No existe Permiso de Trabajo en Caliente requerido'; end if;

  select id,iniciado_at,minutos_minimos into v_vigilancia_id,v_iniciado,v_minutos
  from public.pts_vigilancia_post_trabajo
  where permiso_complementario_id=v_complementario_id and empresa_id=v_empresa_id for update;
  if v_vigilancia_id is null or v_iniciado is null then raise exception 'Debes iniciar la vigilancia post trabajo antes de finalizarla'; end if;
  if now() < v_iniciado + make_interval(mins => greatest(v_minutos,60)) then raise exception 'La vigilancia post trabajo debe mantenerse durante al menos 60 minutos reales'; end if;
  if jsonb_typeof(coalesce(p_verificaciones,'[]'::jsonb)) <> 'array' then raise exception 'Formato de verificaciones invalido'; end if;

  select
    count(*) filter (where elem->>'codigo'=any(array['VIG-CAL-01','VIG-CAL-02','VIG-CAL-03','VIG-CAL-04']::text[])),
    count(*) filter (where elem->>'codigo'=any(array['VIG-CAL-01','VIG-CAL-02','VIG-CAL-03','VIG-CAL-04']::text[]) and elem->>'respuesta'='no'),
    count(*) filter (where elem->>'codigo'=any(array['VIG-CAL-01','VIG-CAL-02','VIG-CAL-03','VIG-CAL-04']::text[]) and coalesce(elem->>'respuesta','') not in ('si','no'))
    into v_total,v_no,v_invalidas
  from jsonb_array_elements(p_verificaciones) elem;

  if v_total <> 4 then raise exception 'La vigilancia debe contener sus 4 verificaciones esperadas'; end if;
  if v_invalidas > 0 then raise exception 'Existen verificaciones de vigilancia pendientes o invalidas'; end if;
  if v_no > 0 and nullif(trim(coalesce(p_incidencias,'')),'') is null then raise exception 'Toda desviacion durante la vigilancia debe registrar incidencias'; end if;
  if nullif(trim(coalesce(p_emisor_notificado_nombre,'')),'') is null then raise exception 'Debes registrar la notificacion al emisor del permiso'; end if;
  if p_conclusion not in ('cumple','requiere_acciones') then raise exception 'Conclusion de vigilancia invalida'; end if;
  if (v_no>0 or p_conclusion='requiere_acciones') and char_length(trim(coalesce(p_acciones_correctivas,'')))<10 then raise exception 'Las desviaciones requieren acciones correctivas detalladas'; end if;
  if nullif(trim(coalesce(p_responsable_mantencion,'')),'') is null then raise exception 'Debes identificar al responsable de mantencion'; end if;
  if nullif(trim(coalesce(p_responsable_prevencion,'')),'') is null then raise exception 'Debes identificar al responsable de prevencion'; end if;

  update public.pts_vigilancia_post_trabajo set
    estado=case when v_no=0 and p_conclusion='cumple' then 'completa' else 'observada' end,
    finalizado_at=now(), verificaciones=p_verificaciones,
    emisor_notificado_nombre=trim(p_emisor_notificado_nombre),
    incidencias=nullif(trim(coalesce(p_incidencias,'')),''), conclusion=p_conclusion,
    acciones_correctivas=nullif(trim(coalesce(p_acciones_correctivas,'')),''),
    responsable_mantencion=trim(p_responsable_mantencion), responsable_prevencion=trim(p_responsable_prevencion)
  where id=v_vigilancia_id and empresa_id=v_empresa_id;

  insert into public.pts_historial (permiso_id,empresa_id,evento,detalle,usuario_id)
  values (p_permiso_id,v_empresa_id,
    case when v_no=0 and p_conclusion='cumple' then 'vigilancia_post_completa' else 'vigilancia_post_observada' end,
    case when v_no=0 and p_conclusion='cumple' then 'Vigilancia post trabajo completada con area segura y controlada.' else 'Vigilancia post trabajo finalizada con desviaciones o acciones correctivas pendientes.' end,
    auth.uid());
  return v_vigilancia_id;
end;
$function$;

create or replace function public.pts_cerrar_trabajo(p_permiso_id uuid, p_observacion_cierre text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid; v_estado text; v_nombre text; v_detalle text; v_caliente_id uuid;
  v_vigilancia_estado text; v_vigilancia_inicio timestamptz; v_vigilancia_fin timestamptz; v_minutos integer;
begin
  select empresa_id,estado into v_empresa_id,v_estado from public.pts_permisos where id=p_permiso_id for update;
  if v_empresa_id is null then raise exception 'PTS no encontrado'; end if;
  if not public.usuario_tiene_acceso_pts(v_empresa_id) then raise exception 'Sin permisos para este PTS'; end if;
  if v_estado <> 'en_ejecucion' then raise exception 'Solo se puede cerrar un PTS en ejecucion'; end if;
  v_detalle:=trim(coalesce(p_observacion_cierre,''));
  if char_length(v_detalle)<10 then raise exception 'El cierre debe incluir una observacion final de al menos 10 caracteres'; end if;

  select id into v_caliente_id from public.pts_permisos_complementarios
  where permiso_id=p_permiso_id and empresa_id=v_empresa_id and tipo='caliente' and requerido=true;
  if v_caliente_id is not null then
    select estado,iniciado_at,finalizado_at,minutos_minimos
      into v_vigilancia_estado,v_vigilancia_inicio,v_vigilancia_fin,v_minutos
    from public.pts_vigilancia_post_trabajo
    where permiso_complementario_id=v_caliente_id and empresa_id=v_empresa_id;
    if coalesce(v_vigilancia_estado,'') <> 'completa' then raise exception 'No puedes cerrar el PTS: la vigilancia post trabajo en caliente debe estar completa'; end if;
    if v_vigilancia_inicio is null or v_vigilancia_fin is null or v_vigilancia_fin < v_vigilancia_inicio + make_interval(mins=>greatest(coalesce(v_minutos,60),60)) then
      raise exception 'No puedes cerrar el PTS: la vigilancia post trabajo debe acreditar al menos 60 minutos reales';
    end if;
  end if;

  select nullif(trim(nombre_completo),'') into v_nombre from public.perfiles where id=auth.uid();
  update public.pts_permisos set estado='cerrado',cerrado_at=now(),cerrado_by=auth.uid(),cerrado_por_nombre=coalesce(v_nombre,'Usuario autorizado'),cierre_observaciones=v_detalle
  where id=p_permiso_id and empresa_id=v_empresa_id;
  insert into public.pts_historial (permiso_id,empresa_id,evento,detalle,usuario_id)
  values (p_permiso_id,v_empresa_id,'trabajo_cerrado',v_detalle,auth.uid());
  return p_permiso_id;
end;
$function$;

revoke all on function public.pts_iniciar_vigilancia_post_trabajo(uuid) from public, anon;
revoke all on function public.pts_finalizar_vigilancia_post_trabajo(uuid,jsonb,text,text,text,text,text,text) from public, anon;
revoke all on function public.pts_cerrar_trabajo(uuid,text) from public, anon;
grant execute on function public.pts_iniciar_vigilancia_post_trabajo(uuid) to authenticated, service_role;
grant execute on function public.pts_finalizar_vigilancia_post_trabajo(uuid,jsonb,text,text,text,text,text,text) to authenticated, service_role;
grant execute on function public.pts_cerrar_trabajo(uuid,text) to authenticated, service_role;

commit;
