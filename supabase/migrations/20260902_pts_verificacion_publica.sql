begin;

alter table public.pts_permisos
  add column if not exists verificacion_token uuid not null default gen_random_uuid();

create unique index if not exists pts_permisos_verificacion_token_uidx
  on public.pts_permisos (verificacion_token);

create or replace function public.pts_bloquear_cambio_verificacion_token()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.verificacion_token is distinct from old.verificacion_token then
    raise exception 'El token de verificacion del PTS es inmutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pts_bloquear_cambio_verificacion_token on public.pts_permisos;
create trigger trg_pts_bloquear_cambio_verificacion_token
before update on public.pts_permisos
for each row
execute function public.pts_bloquear_cambio_verificacion_token();

create or replace function public.pts_verificar_publico(p_token uuid)
returns table (
  folio bigint,
  estado text,
  trabajo_a_realizar text,
  tipo_actividad text,
  lugar_ejecucion text,
  empresa_contratista text,
  fecha_inicio date,
  fecha_termino date,
  aprobado_at timestamptz,
  iniciado_at timestamptz,
  cerrado_at timestamptz,
  empresa_nombre text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.folio,
    p.estado,
    p.trabajo_a_realizar,
    p.tipo_actividad,
    p.lugar_ejecucion,
    p.empresa_contratista,
    p.fecha_inicio,
    p.fecha_termino,
    p.aprobado_at,
    p.iniciado_at,
    p.cerrado_at,
    e.nombre as empresa_nombre
  from public.pts_permisos p
  join public.empresas e on e.id = p.empresa_id
  where p.verificacion_token = p_token
    and p.estado in ('aprobado', 'en_ejecucion', 'cerrado')
  limit 1;
$$;

revoke all on function public.pts_verificar_publico(uuid) from public;
grant execute on function public.pts_verificar_publico(uuid) to anon, authenticated;

comment on function public.pts_verificar_publico(uuid) is
  'Verificacion publica limitada de autenticidad PTS mediante token opaco. No expone datos personales ni expediente completo.';

commit;
