-- P9A-04 - Roles y usos del maestro transversal de contactos.
-- Agrega indicadores no destructivos; observaciones se conserva como campo de notas.

alter table public.contactos
  add column if not exists es_principal boolean not null default false,
  add column if not exists recibe_cotizaciones boolean not null default false,
  add column if not exists recibe_oc boolean not null default false,
  add column if not exists recibe_informes_ot boolean not null default false,
  add column if not exists recibe_cobranza boolean not null default false,
  add column if not exists recibe_comunicaciones_generales boolean not null default true;

-- Amplía, sin relajar, los valores funcionales admitidos por P9A-02.
alter table public.contactos
  drop constraint if exists contactos_tipo_contacto_check;

alter table public.contactos
  add constraint contactos_tipo_contacto_check
  check (tipo_contacto in (
    'comercial', 'tecnico', 'administrativo', 'cobranza', 'compras',
    'operaciones', 'gerencia', 'otro'
  ));
