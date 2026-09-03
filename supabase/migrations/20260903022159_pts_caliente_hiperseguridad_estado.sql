begin;

alter table public.pts_checklist_respuestas
  drop constraint if exists pts_checklist_caliente_na_hiperseguridad_check;

alter table public.pts_checklist_respuestas
  add constraint pts_checklist_caliente_na_hiperseguridad_check
  check (
    not (
      codigo_item like 'CAL-%'
      and respuesta = 'na'
      and (
        codigo_item not in (
          'CAL-CHK-04','CAL-CHK-05','CAL-CHK-08','CAL-CHK-11','CAL-CHK-12','CAL-CHK-13','CAL-CHK-16',
          'CAL-EPP-01','CAL-EPP-02','CAL-EPP-03','CAL-EPP-04','CAL-EPP-05','CAL-EPP-06','CAL-EPP-07','CAL-EPP-08'
        )
        or nullif(trim(observacion), '') is null
      )
    )
  );

create or replace function public.pts_validar_caliente_completo(p_complementario_id uuid, p_empresa_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tipo text;
  v_requerido boolean;
  v_datos jsonb;
  v_total integer;
  v_pendientes integer;
  v_no integer;
  v_na_invalidos integer;
begin
  select tipo, requerido, datos_especificos into v_tipo, v_requerido, v_datos
  from public.pts_permisos_complementarios
  where id = p_complementario_id and empresa_id = p_empresa_id;

  if v_tipo is distinct from 'caliente' or v_requerido is distinct from true then return false; end if;

  if jsonb_typeof(coalesce(v_datos->'tipos_trabajo','[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(v_datos->'tipos_trabajo','[]'::jsonb)) = 0
     or char_length(trim(coalesce(v_datos->>'vigia_incendios_nombre',''))) < 3
     or (coalesce(v_datos->'tipos_trabajo','[]'::jsonb) ? 'otro' and char_length(trim(coalesce(v_datos->>'otro_tipo',''))) < 3) then
    return false;
  end if;

  select
    count(*) filter (where codigo_item = any (array['CAL-CHK-01','CAL-CHK-02','CAL-CHK-03','CAL-CHK-04','CAL-CHK-05','CAL-CHK-06','CAL-CHK-07','CAL-CHK-08','CAL-CHK-09','CAL-CHK-10','CAL-CHK-11','CAL-CHK-12','CAL-CHK-13','CAL-CHK-14','CAL-CHK-15','CAL-CHK-16','CAL-CHK-17','CAL-CHK-18','CAL-CHK-19','CAL-CHK-20','CAL-EPP-01','CAL-EPP-02','CAL-EPP-03','CAL-EPP-04','CAL-EPP-05','CAL-EPP-06','CAL-EPP-07','CAL-EPP-08']::text[])),
    count(*) filter (where codigo_item = any (array['CAL-CHK-01','CAL-CHK-02','CAL-CHK-03','CAL-CHK-04','CAL-CHK-05','CAL-CHK-06','CAL-CHK-07','CAL-CHK-08','CAL-CHK-09','CAL-CHK-10','CAL-CHK-11','CAL-CHK-12','CAL-CHK-13','CAL-CHK-14','CAL-CHK-15','CAL-CHK-16','CAL-CHK-17','CAL-CHK-18','CAL-CHK-19','CAL-CHK-20','CAL-EPP-01','CAL-EPP-02','CAL-EPP-03','CAL-EPP-04','CAL-EPP-05','CAL-EPP-06','CAL-EPP-07','CAL-EPP-08']::text[]) and respuesta is null),
    count(*) filter (where codigo_item = any (array['CAL-CHK-01','CAL-CHK-02','CAL-CHK-03','CAL-CHK-04','CAL-CHK-05','CAL-CHK-06','CAL-CHK-07','CAL-CHK-08','CAL-CHK-09','CAL-CHK-10','CAL-CHK-11','CAL-CHK-12','CAL-CHK-13','CAL-CHK-14','CAL-CHK-15','CAL-CHK-16','CAL-CHK-17','CAL-CHK-18','CAL-CHK-19','CAL-CHK-20','CAL-EPP-01','CAL-EPP-02','CAL-EPP-03','CAL-EPP-04','CAL-EPP-05','CAL-EPP-06','CAL-EPP-07','CAL-EPP-08']::text[]) and respuesta='no'),
    count(*) filter (where respuesta='na' and (codigo_item not in ('CAL-CHK-04','CAL-CHK-05','CAL-CHK-08','CAL-CHK-11','CAL-CHK-12','CAL-CHK-13','CAL-CHK-16','CAL-EPP-01','CAL-EPP-02','CAL-EPP-03','CAL-EPP-04','CAL-EPP-05','CAL-EPP-06','CAL-EPP-07','CAL-EPP-08') or nullif(trim(observacion),'') is null))
    into v_total,v_pendientes,v_no,v_na_invalidos
  from public.pts_checklist_respuestas
  where permiso_complementario_id=p_complementario_id and empresa_id=p_empresa_id;

  return v_total=28 and v_pendientes=0 and v_no=0 and v_na_invalidos=0;
end;
$function$;

revoke all on function public.pts_validar_caliente_completo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pts_validar_caliente_completo(uuid, uuid) to service_role;

create or replace function public.pts_caliente_proteger_estado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.tipo='caliente' and new.requerido=true and new.estado='completo'
     and not public.pts_validar_caliente_completo(new.id,new.empresa_id) then
    raise exception 'El Permiso de Trabajo en Caliente no puede marcarse completo: debe tener 28 controles conformes, tipo de trabajo y Vigia de Incendios identificado';
  end if;
  return new;
end;
$function$;

revoke all on function public.pts_caliente_proteger_estado() from public, anon, authenticated;
grant execute on function public.pts_caliente_proteger_estado() to service_role;

drop trigger if exists pts_caliente_proteger_estado_trg on public.pts_permisos_complementarios;
create trigger pts_caliente_proteger_estado_trg
before insert or update of estado, requerido, tipo, datos_especificos
on public.pts_permisos_complementarios
for each row execute function public.pts_caliente_proteger_estado();

commit;
