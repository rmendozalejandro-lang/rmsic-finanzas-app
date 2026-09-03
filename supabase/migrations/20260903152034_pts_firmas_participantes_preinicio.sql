create table public.pts_firmas_participantes (
  id uuid primary key default gen_random_uuid(),
  permiso_id uuid not null,
  empresa_id uuid not null,
  personal_id uuid not null references public.pts_personal(id) on delete cascade,
  nombre_firmante text not null,
  rut_firmante text not null,
  declaracion text not null,
  declaracion_version integer not null default 1,
  firma_trazos jsonb not null,
  metodo text not null default 'trazo_en_dispositivo',
  capturado_por_usuario_id uuid not null,
  capturado_por_nombre text not null,
  firmado_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint pts_firmas_participantes_permiso_empresa_fk
    foreign key (permiso_id, empresa_id)
    references public.pts_permisos(id, empresa_id)
    on delete cascade,
  constraint pts_firmas_participantes_unica unique (permiso_id, personal_id),
  constraint pts_firmas_participantes_metodo_chk check (metodo = 'trazo_en_dispositivo'),
  constraint pts_firmas_participantes_declaracion_version_chk check (declaracion_version = 1)
);

create index pts_firmas_participantes_permiso_idx
  on public.pts_firmas_participantes (permiso_id, empresa_id);

alter table public.pts_firmas_participantes enable row level security;

create policy pts_firmas_participantes_select
on public.pts_firmas_participantes
for select
to authenticated
using (public.usuario_tiene_acceso_pts(empresa_id));

grant select on public.pts_firmas_participantes to authenticated;
revoke insert, update, delete on public.pts_firmas_participantes from authenticated;
revoke all on public.pts_firmas_participantes from anon;

drop policy if exists pts_personal_empresa_access on public.pts_personal;

create policy pts_personal_select_empresa
on public.pts_personal
for select
to authenticated
using (public.usuario_tiene_acceso_pts(empresa_id));

create policy pts_personal_insert_editable
on public.pts_personal
for insert
to authenticated
with check (
  public.usuario_tiene_acceso_pts(empresa_id)
  and exists (
    select 1
    from public.pts_permisos p
    where p.id = permiso_id
      and p.empresa_id = empresa_id
      and p.estado in ('borrador', 'observado')
  )
);

create policy pts_personal_update_editable
on public.pts_personal
for update
to authenticated
using (
  public.usuario_tiene_acceso_pts(empresa_id)
  and exists (
    select 1
    from public.pts_permisos p
    where p.id = permiso_id
      and p.empresa_id = empresa_id
      and p.estado in ('borrador', 'observado')
  )
)
with check (
  public.usuario_tiene_acceso_pts(empresa_id)
  and exists (
    select 1
    from public.pts_permisos p
    where p.id = permiso_id
      and p.empresa_id = empresa_id
      and p.estado in ('borrador', 'observado')
  )
);

create policy pts_personal_delete_editable
on public.pts_personal
for delete
to authenticated
using (
  public.usuario_tiene_acceso_pts(empresa_id)
  and exists (
    select 1
    from public.pts_permisos p
    where p.id = permiso_id
      and p.empresa_id = empresa_id
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
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para registrar una firma';
  end if;

  select p.empresa_id, p.estado
    into v_empresa_id, v_estado
  from public.pts_permisos p
  where p.id = p_permiso_id
  for update;

  if v_empresa_id is null then
    raise exception 'PTS no encontrado';
  end if;

  if not public.usuario_tiene_acceso_pts(v_empresa_id) then
    raise exception 'Sin permisos para este PTS';
  end if;

  if v_estado <> 'aprobado' then
    raise exception 'Las firmas de participantes se registran después de la aprobación y antes del inicio del trabajo';
  end if;

  select a.estado
    into v_seguridad_estado
  from public.pts_aprobaciones a
  where a.permiso_id = p_permiso_id
    and a.empresa_id = v_empresa_id
    and a.etapa = 'seguridad';

  if coalesce(v_seguridad_estado, '') <> 'aprobado' then
    raise exception 'El PTS requiere aprobación vigente de Seguridad antes de firmar';
  end if;

  select pe.nombre_apellido, pe.rut
    into v_nombre, v_rut
  from public.pts_personal pe
  where pe.id = p_personal_id
    and pe.permiso_id = p_permiso_id
    and pe.empresa_id = v_empresa_id;

  if v_nombre is null or v_rut is null then
    raise exception 'El participante no pertenece a este PTS';
  end if;

  if exists (
    select 1 from public.pts_firmas_participantes f
    where f.permiso_id = p_permiso_id
      and f.empresa_id = v_empresa_id
      and f.personal_id = p_personal_id
  ) then
    raise exception 'Este participante ya registró su firma';
  end if;

  if jsonb_typeof(coalesce(p_firma_trazos, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_firma_trazos) < 1
     or jsonb_array_length(p_firma_trazos) > 20
     or char_length(p_firma_trazos::text) > 50000 then
    raise exception 'La firma registrada no es válida';
  end if;

  select count(*)
    into v_invalidos
  from jsonb_array_elements(p_firma_trazos) stroke
  where jsonb_typeof(stroke) <> 'array'
     or case
          when jsonb_typeof(stroke) = 'array' then jsonb_array_length(stroke) not between 2 and 500
          else false
        end;

  if v_invalidos > 0 then
    raise exception 'La firma contiene trazos inválidos';
  end if;

  select count(*)
    into v_invalidos
  from jsonb_array_elements(p_firma_trazos) stroke
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(stroke) = 'array' then stroke else '[]'::jsonb end
  ) punto
  where jsonb_typeof(punto) <> 'object'
     or jsonb_typeof(punto->'x') <> 'number'
     or jsonb_typeof(punto->'y') <> 'number';

  if v_invalidos > 0 then
    raise exception 'La firma contiene puntos inválidos';
  end if;

  select nullif(trim(pf.nombre_completo), '')
    into v_capturado_por
  from public.perfiles pf
  where pf.id = v_usuario_id
    and coalesce(pf.activo, true) = true;

  if v_capturado_por is null then
    raise exception 'No se pudo identificar al usuario que captura la firma';
  end if;

  insert into public.pts_firmas_participantes (
    permiso_id,
    empresa_id,
    personal_id,
    nombre_firmante,
    rut_firmante,
    declaracion,
    declaracion_version,
    firma_trazos,
    metodo,
    capturado_por_usuario_id,
    capturado_por_nombre,
    firmado_at
  ) values (
    p_permiso_id,
    v_empresa_id,
    p_personal_id,
    trim(v_nombre),
    trim(v_rut),
    v_declaracion,
    1,
    p_firma_trazos,
    'trazo_en_dispositivo',
    v_usuario_id,
    v_capturado_por,
    now()
  )
  returning id into v_firma_id;

  insert into public.pts_historial (
    permiso_id, empresa_id, evento, detalle, usuario_id
  ) values (
    p_permiso_id,
    v_empresa_id,
    'participante_firmado',
    'Firma previa al inicio registrada para ' || trim(v_nombre) || ' (' || trim(v_rut) || ').',
    v_usuario_id
  );

  return v_firma_id;
end;
$function$;

revoke execute on function public.pts_firmar_participante(uuid, uuid, jsonb) from public;
revoke execute on function public.pts_firmar_participante(uuid, uuid, jsonb) from anon;
grant execute on function public.pts_firmar_participante(uuid, uuid, jsonb) to authenticated;
grant execute on function public.pts_firmar_participante(uuid, uuid, jsonb) to service_role;

create or replace function public.pts_iniciar_ejecucion(p_permiso_id uuid)
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
  v_personal_total integer;
  v_firmas_total integer;
begin
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para iniciar el PTS';
  end if;

  select p.empresa_id, p.estado
    into v_empresa_id, v_estado
  from public.pts_permisos p
  where p.id = p_permiso_id
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

  select a.estado into v_seguridad_estado
  from public.pts_aprobaciones a
  where a.permiso_id = p_permiso_id
    and a.empresa_id = v_empresa_id
    and a.etapa = 'seguridad';

  if coalesce(v_seguridad_estado, '') <> 'aprobado' then
    raise exception 'El PTS requiere aprobación vigente de Seguridad';
  end if;

  select count(*) into v_personal_total
  from public.pts_personal pe
  where pe.permiso_id = p_permiso_id
    and pe.empresa_id = v_empresa_id;

  select count(*) into v_firmas_total
  from public.pts_firmas_participantes f
  where f.permiso_id = p_permiso_id
    and f.empresa_id = v_empresa_id;

  if v_personal_total = 0 then
    raise exception 'El PTS no tiene participantes registrados';
  end if;

  if v_firmas_total <> v_personal_total then
    raise exception 'No puedes iniciar el trabajo: todos los participantes deben firmar el PTS antes del inicio (% de % firmas registradas)', v_firmas_total, v_personal_total;
  end if;

  select nullif(trim(pf.nombre_completo), '') into v_nombre
  from public.perfiles pf
  where pf.id = v_usuario_id
    and coalesce(pf.activo, true) = true;

  if v_nombre is null then
    raise exception 'No se pudo identificar al usuario que inicia el trabajo';
  end if;

  update public.pts_permisos
  set estado = 'en_ejecucion',
      iniciado_at = now(),
      iniciado_by = v_usuario_id,
      iniciado_por_nombre = v_nombre
  where id = p_permiso_id
    and empresa_id = v_empresa_id;

  insert into public.pts_historial (
    permiso_id, empresa_id, evento, detalle, usuario_id
  ) values (
    p_permiso_id,
    v_empresa_id,
    'trabajo_iniciado',
    'Inicio de ejecución registrado por ' || v_nombre || ' con ' || v_firmas_total || ' firma(s) de participantes verificadas.',
    v_usuario_id
  );

  return p_permiso_id;
end;
$function$;

revoke execute on function public.pts_iniciar_ejecucion(uuid) from public;
revoke execute on function public.pts_iniciar_ejecucion(uuid) from anon;
grant execute on function public.pts_iniciar_ejecucion(uuid) to authenticated;
grant execute on function public.pts_iniciar_ejecucion(uuid) to service_role;
