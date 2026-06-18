-- =========================================================
-- Auren - Logo configurable por empresa para cotizaciones
-- DyF
-- =========================================================

alter table public.empresas
add column if not exists logo_url text;

alter table public.cotizaciones
add column if not exists empresa_logo_url text;

update public.empresas
set logo_url = '/logos/dyf-logo-transparente.png',
    updated_at = now()
where id = '73dd5543-2bf7-4d44-9982-4a641c8658f5'::uuid
   or rut = '76778948-3'
   or lower(nombre) like '%dyf%'
   or lower(razon_social) like '%dyf%';

update public.cotizaciones c
set empresa_logo_url = '/logos/dyf-logo-transparente.png',
    updated_at = now()
from public.empresas e
where e.id = c.empresa_id
  and (
    e.id = '73dd5543-2bf7-4d44-9982-4a641c8658f5'::uuid
    or e.rut = '76778948-3'
    or lower(e.nombre) like '%dyf%'
    or lower(e.razon_social) like '%dyf%'
  );
