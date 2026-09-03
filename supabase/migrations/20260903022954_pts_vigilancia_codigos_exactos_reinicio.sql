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
    verificaciones,vigia_incendios_nombre,emisor_notificado_nombre,incidencias,conclusion,
    acciones_correctivas,responsable_mantencion,responsable_prevencion,evidencias
  ) values (
    v_complementario_id,v_empresa_id,'en_curso',now(),null,60,'[]'::jsonb,v_vigia,null,null,null,null,null,null,'[]'::jsonb
  )
  on conflict (permiso_complementario_id,empresa_id) do update set
    estado=case when public.pts_vigilancia_post_trabajo.estado='completa' then 'completa' else 'en_curso' end,
    iniciado_at=case
      when public.pts_vigilancia_post_trabajo.estado='completa' then public.pts_vigilancia_post_trabajo.iniciado_at
      when public.pts_vigilancia_post_trabajo.estado='observada' then now()
      else coalesce(public.pts_vigilancia_post_trabajo.iniciado_at,now())
    end,
    finalizado_at=case when public.pts_vigilancia_post_trabajo.estado='observada' then null else public.pts_vigilancia_post_trabajo.finalizado_at end,
    verificaciones=case when public.pts_vigilancia_post_trabajo.estado='observada' then '[]'::jsonb else public.pts_vigilancia_post_trabajo.verificaciones end,
    emisor_notificado_nombre=case when public.pts_vigilancia_post_trabajo.estado='observada' then null else public.pts_vigilancia_post_trabajo.emisor_notificado_nombre end,
    incidencias=case when public.pts_vigilancia_post_trabajo.estado='observada' then null else public.pts_vigilancia_post_trabajo.incidencias end,
    conclusion=case when public.pts_vigilancia_post_trabajo.estado='observada' then null else public.pts_vigilancia_post_trabajo.conclusion end,
    acciones_correctivas=case when public.pts_vigilancia_post_trabajo.estado='observada' then null else public.pts_vigilancia_post_trabajo.acciones_correctivas end,
    responsable_mantencion=case when public.pts_vigilancia_post_trabajo.estado='observada' then null else public.pts_vigilancia_post_trabajo.responsable_mantencion end,
    responsable_prevencion=case when public.pts_vigilancia_post_trabajo.estado='observada' then null else public.pts_vigilancia_post_trabajo.responsable_prevencion end,
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
  v_distintos integer;
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
  where permiso_complementario_id=v_complementario_id and empresa_id=v_empresa_id and estado='en_curso' for update;
  if v_vigilancia_id is null or v_iniciado is null then raise exception 'Debes iniciar una vigilancia post trabajo vigente antes de finalizarla'; end if;
  if now() < v_iniciado + make_interval(mins => greatest(v_minutos,60)) then raise exception 'La vigilancia post trabajo debe mantenerse durante al menos 60 minutos reales'; end if;
  if jsonb_typeof(coalesce(p_verificaciones,'[]'::jsonb)) <> 'array' then raise exception 'Formato de verificaciones invalido'; end if;

  select
    count(*) filter (where elem->>'codigo'=any(array['VIG-CAL-01','VIG-CAL-02','VIG-CAL-03','VIG-CAL-04']::text[])),
    count(distinct elem->>'codigo') filter (where elem->>'codigo'=any(array['VIG-CAL-01','VIG-CAL-02','VIG-CAL-03','VIG-CAL-04']::text[])),
    count(*) filter (where elem->>'codigo'=any(array['VIG-CAL-01','VIG-CAL-02','VIG-CAL-03','VIG-CAL-04']::text[]) and elem->>'respuesta'='no'),
    count(*) filter (where elem->>'codigo'=any(array['VIG-CAL-01','VIG-CAL-02','VIG-CAL-03','VIG-CAL-04']::text[]) and coalesce(elem->>'respuesta','') not in ('si','no'))
    into v_total,v_distintos,v_no,v_invalidas
  from jsonb_array_elements(p_verificaciones) elem;

  if jsonb_array_length(p_verificaciones) <> 4 or v_total <> 4 or v_distintos <> 4 then
    raise exception 'La vigilancia debe contener exactamente los 4 controles esperados, sin duplicados ni controles adicionales';
  end if;
  if v_invalidas > 0 then raise exception 'Existen verificaciones de vigilancia pendientes o invalidas'; end if;
  if v_no > 0 and nullif(trim(coalesce(p_incidencias,'')),'') is null then raise exception 'Toda desviacion durante la vigilancia debe registrar incidencias'; end if;
  if nullif(trim(coalesce(p_emisor_notificado_nombre,'')),'') is null then raise exception 'Debes registrar la notificacion al emisor del permiso'; end if;
  if p_conclusion not in ('cumple','requiere_acciones') then raise exception 'Conclusion de vigilancia invalida'; end if;
  if v_no > 0 and p_conclusion='cumple' then raise exception 'La vigilancia no puede concluir como cumple si existe una verificacion NO'; end if;
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

revoke all on function public.pts_iniciar_vigilancia_post_trabajo(uuid) from public, anon;
revoke all on function public.pts_finalizar_vigilancia_post_trabajo(uuid,jsonb,text,text,text,text,text,text) from public, anon;
grant execute on function public.pts_iniciar_vigilancia_post_trabajo(uuid) to authenticated, service_role;
grant execute on function public.pts_finalizar_vigilancia_post_trabajo(uuid,jsonb,text,text,text,text,text,text) to authenticated, service_role;

commit;
