-- Asistente Tralixia - preflight de solo lectura
-- Ejecutar antes de aplicar migraciones del nucleo en una base objetivo.
-- No crea, modifica ni elimina objetos.

with required_tables(table_name) as (
  values
    ('empresas'),
    ('perfiles'),
    ('usuario_empresas'),
    ('empresa_modulos'),
    ('clientes'),
    ('ot_ordenes_trabajo'),
    ('ot_equipos'),
    ('pts_permisos'),
    ('vet_animales'),
    ('vet_partos'),
    ('vet_procedimientos')
), present_tables as (
  select table_name
  from information_schema.tables
  where table_schema = 'public'
)
select
  r.table_name,
  case when p.table_name is not null then 'OK' else 'FALTA' end as estado
from required_tables r
left join present_tables p using (table_name)
order by r.table_name;

select
  to_regprocedure('public.es_super_admin()') is not null as es_super_admin_ok,
  to_regprocedure('public.usuario_tiene_acceso_pts(uuid)') is not null as acceso_pts_ok,
  to_regprocedure('public.usuario_tiene_acceso_haras(uuid)') is not null as acceso_haras_ok,
  to_regprocedure('gen_random_uuid()') is not null as gen_random_uuid_ok;

select
  c.table_name,
  bool_and(c.data_type = 'uuid') filter (where c.column_name in ('id','empresa_id')) as ids_uuid_ok,
  count(*) filter (where c.column_name = 'id') as tiene_id,
  count(*) filter (where c.column_name = 'empresa_id') as tiene_empresa_id
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'clientes','ot_ordenes_trabajo','ot_equipos','pts_permisos',
    'vet_animales','vet_partos','vet_procedimientos'
  )
  and c.column_name in ('id','empresa_id')
group by c.table_name
order by c.table_name;

select
  exists(select 1 from public.empresa_modulos where modulo = 'operacional') as modulo_operacional_ok,
  exists(select 1 from public.empresa_modulos where modulo = 'seguridad') as modulo_seguridad_ok,
  exists(select 1 from public.empresa_modulos where modulo = 'haras') as modulo_haras_ok;

select
  count(*) as objetos_asistente_existentes
from information_schema.tables
where table_schema = 'public'
  and table_name like 'asistente_%';
