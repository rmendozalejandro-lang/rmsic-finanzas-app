begin;

alter table public.pts_checklist_respuestas
  drop constraint if exists pts_checklist_excavacion_na_hiperseguridad_check;

alter table public.pts_checklist_respuestas
  add constraint pts_checklist_excavacion_na_hiperseguridad_check
  check (
    not (
      codigo_item like 'EXC-%'
      and respuesta = 'na'
      and (
        codigo_item not in (
          'EXC-CHK-08','EXC-CHK-09','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
          'EXC-EPP-04','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
        )
        or nullif(trim(observacion), '') is null
      )
    )
  );

create or replace function public.pts_validar_excavacion_completa(p_complementario_id uuid, p_empresa_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tipo text;
  v_requerido boolean;
  v_total integer;
  v_pendientes integer;
  v_no integer;
  v_na_invalidos integer;
begin
  select tipo, requerido
    into v_tipo, v_requerido
  from public.pts_permisos_complementarios
  where id = p_complementario_id
    and empresa_id = p_empresa_id;

  if v_tipo is distinct from 'excavacion' or v_requerido is distinct from true then
    return false;
  end if;

  select
    count(*) filter (where codigo_item = any (array[
      'EXC-CHK-01','EXC-CHK-02','EXC-CHK-03','EXC-CHK-04','EXC-CHK-05','EXC-CHK-06','EXC-CHK-07','EXC-CHK-08','EXC-CHK-09','EXC-CHK-10','EXC-CHK-11','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
      'EXC-EPP-01','EXC-EPP-02','EXC-EPP-03','EXC-EPP-04','EXC-EPP-05','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
    ]::text[])),
    count(*) filter (where codigo_item = any (array[
      'EXC-CHK-01','EXC-CHK-02','EXC-CHK-03','EXC-CHK-04','EXC-CHK-05','EXC-CHK-06','EXC-CHK-07','EXC-CHK-08','EXC-CHK-09','EXC-CHK-10','EXC-CHK-11','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
      'EXC-EPP-01','EXC-EPP-02','EXC-EPP-03','EXC-EPP-04','EXC-EPP-05','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
    ]::text[]) and respuesta is null),
    count(*) filter (where codigo_item = any (array[
      'EXC-CHK-01','EXC-CHK-02','EXC-CHK-03','EXC-CHK-04','EXC-CHK-05','EXC-CHK-06','EXC-CHK-07','EXC-CHK-08','EXC-CHK-09','EXC-CHK-10','EXC-CHK-11','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
      'EXC-EPP-01','EXC-EPP-02','EXC-EPP-03','EXC-EPP-04','EXC-EPP-05','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
    ]::text[]) and respuesta = 'no'),
    count(*) filter (
      where codigo_item = any (array[
        'EXC-CHK-01','EXC-CHK-02','EXC-CHK-03','EXC-CHK-04','EXC-CHK-05','EXC-CHK-06','EXC-CHK-07','EXC-CHK-08','EXC-CHK-09','EXC-CHK-10','EXC-CHK-11','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
        'EXC-EPP-01','EXC-EPP-02','EXC-EPP-03','EXC-EPP-04','EXC-EPP-05','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
      ]::text[])
      and respuesta = 'na'
      and (
        codigo_item not in (
          'EXC-CHK-08','EXC-CHK-09','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
          'EXC-EPP-04','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
        )
        or nullif(trim(observacion), '') is null
      )
    )
    into v_total, v_pendientes, v_no, v_na_invalidos
  from public.pts_checklist_respuestas
  where permiso_complementario_id = p_complementario_id
    and empresa_id = p_empresa_id;

  return v_total = 22
    and v_pendientes = 0
    and v_no = 0
    and v_na_invalidos = 0;
end;
$function$;

revoke all on function public.pts_validar_excavacion_completa(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pts_validar_excavacion_completa(uuid, uuid) to service_role;

create or replace function public.pts_excavacion_proteger_estado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.tipo = 'excavacion'
     and new.requerido = true
     and new.estado = 'completo'
     and not public.pts_validar_excavacion_completa(new.id, new.empresa_id) then
    raise exception 'El Permiso de Excavacion no puede marcarse completo: debe tener sus 22 controles esperados, sin pendientes, sin respuestas NO y con todo N/A permitido debidamente justificado';
  end if;

  return new;
end;
$function$;

revoke all on function public.pts_excavacion_proteger_estado() from public, anon, authenticated;
grant execute on function public.pts_excavacion_proteger_estado() to service_role;

drop trigger if exists pts_excavacion_proteger_estado_trg on public.pts_permisos_complementarios;
create trigger pts_excavacion_proteger_estado_trg
before insert or update of estado, requerido, tipo
on public.pts_permisos_complementarios
for each row
execute function public.pts_excavacion_proteger_estado();

create or replace function public.pts_excavacion_sincronizar_estado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_complementario_id uuid;
  v_empresa_id uuid;
  v_tipo text;
  v_requerido boolean;
  v_no integer;
  v_invalidos integer;
  v_total integer;
  v_pendientes integer;
begin
  v_complementario_id := coalesce(new.permiso_complementario_id, old.permiso_complementario_id);
  v_empresa_id := coalesce(new.empresa_id, old.empresa_id);

  select tipo, requerido
    into v_tipo, v_requerido
  from public.pts_permisos_complementarios
  where id = v_complementario_id
    and empresa_id = v_empresa_id;

  if v_tipo is distinct from 'excavacion' or v_requerido is distinct from true then
    return coalesce(new, old);
  end if;

  select
    count(*) filter (where codigo_item = any (array[
      'EXC-CHK-01','EXC-CHK-02','EXC-CHK-03','EXC-CHK-04','EXC-CHK-05','EXC-CHK-06','EXC-CHK-07','EXC-CHK-08','EXC-CHK-09','EXC-CHK-10','EXC-CHK-11','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
      'EXC-EPP-01','EXC-EPP-02','EXC-EPP-03','EXC-EPP-04','EXC-EPP-05','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
    ]::text[])),
    count(*) filter (where codigo_item = any (array[
      'EXC-CHK-01','EXC-CHK-02','EXC-CHK-03','EXC-CHK-04','EXC-CHK-05','EXC-CHK-06','EXC-CHK-07','EXC-CHK-08','EXC-CHK-09','EXC-CHK-10','EXC-CHK-11','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
      'EXC-EPP-01','EXC-EPP-02','EXC-EPP-03','EXC-EPP-04','EXC-EPP-05','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
    ]::text[]) and respuesta is null),
    count(*) filter (where codigo_item = any (array[
      'EXC-CHK-01','EXC-CHK-02','EXC-CHK-03','EXC-CHK-04','EXC-CHK-05','EXC-CHK-06','EXC-CHK-07','EXC-CHK-08','EXC-CHK-09','EXC-CHK-10','EXC-CHK-11','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
      'EXC-EPP-01','EXC-EPP-02','EXC-EPP-03','EXC-EPP-04','EXC-EPP-05','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
    ]::text[]) and respuesta = 'no'),
    count(*) filter (
      where codigo_item = any (array[
        'EXC-CHK-01','EXC-CHK-02','EXC-CHK-03','EXC-CHK-04','EXC-CHK-05','EXC-CHK-06','EXC-CHK-07','EXC-CHK-08','EXC-CHK-09','EXC-CHK-10','EXC-CHK-11','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
        'EXC-EPP-01','EXC-EPP-02','EXC-EPP-03','EXC-EPP-04','EXC-EPP-05','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
      ]::text[])
      and respuesta = 'na'
      and (
        codigo_item not in (
          'EXC-CHK-08','EXC-CHK-09','EXC-CHK-12','EXC-CHK-13','EXC-CHK-14',
          'EXC-EPP-04','EXC-EPP-06','EXC-EPP-07','EXC-EPP-08'
        )
        or nullif(trim(observacion), '') is null
      )
    )
    into v_total, v_pendientes, v_no, v_invalidos
  from public.pts_checklist_respuestas
  where permiso_complementario_id = v_complementario_id
    and empresa_id = v_empresa_id;

  update public.pts_permisos_complementarios
  set estado = case
    when v_total = 22 and v_pendientes = 0 and v_no = 0 and v_invalidos = 0 then 'completo'
    when v_no > 0 or v_invalidos > 0 then 'observado'
    else 'borrador'
  end
  where id = v_complementario_id
    and empresa_id = v_empresa_id;

  return coalesce(new, old);
end;
$function$;

revoke all on function public.pts_excavacion_sincronizar_estado() from public, anon, authenticated;
grant execute on function public.pts_excavacion_sincronizar_estado() to service_role;

drop trigger if exists pts_excavacion_sincronizar_estado_trg on public.pts_checklist_respuestas;
create trigger pts_excavacion_sincronizar_estado_trg
after insert or update or delete
on public.pts_checklist_respuestas
for each row
execute function public.pts_excavacion_sincronizar_estado();

commit;
