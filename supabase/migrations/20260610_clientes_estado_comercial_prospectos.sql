alter table public.clientes
add column if not exists estado_comercial text not null default 'cliente_activo';

alter table public.clientes
drop constraint if exists clientes_estado_comercial_check;

alter table public.clientes
add constraint clientes_estado_comercial_check
check (
  estado_comercial in (
    'prospecto',
    'cliente_activo',
    'inactivo'
  )
);

update public.clientes
set estado_comercial = 'cliente_activo'
where estado_comercial is null;

create index if not exists idx_clientes_empresa_estado_comercial
on public.clientes (empresa_id, estado_comercial);

comment on column public.clientes.estado_comercial is
'Estado comercial del cliente: prospecto, cliente_activo o inactivo. Prospecto puede usarse para cotizaciones sin considerarse cliente real.';
