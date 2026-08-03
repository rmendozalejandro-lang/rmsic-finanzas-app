-- P9A-02 - Maestro transversal de contactos

create table if not exists public.contactos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  nombre text not null check (btrim(nombre) <> ''),
  cargo text,
  email text,
  telefono text,
  tipo_contacto text not null default 'otro'
    check (tipo_contacto in ('comercial', 'administrativo', 'tecnico', 'cobranza', 'otro')),
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contactos_empresa_id on public.contactos (empresa_id);
create index if not exists idx_contactos_cliente_id on public.contactos (cliente_id);
create index if not exists idx_contactos_proveedor_id on public.contactos (proveedor_id);
create index if not exists idx_contactos_activo on public.contactos (activo);

create or replace function public.validar_contacto_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cliente_id is not null and not exists (
    select 1 from public.clientes
    where id = new.cliente_id and empresa_id = new.empresa_id
  ) then
    raise exception 'El cliente del contacto no pertenece a la empresa indicada.';
  end if;

  if new.proveedor_id is not null and not exists (
    select 1 from public.proveedores
    where id = new.proveedor_id and empresa_id = new.empresa_id
  ) then
    raise exception 'El proveedor del contacto no pertenece a la empresa indicada.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contactos_validar_empresa on public.contactos;
create trigger trg_contactos_validar_empresa
before insert or update on public.contactos
for each row execute function public.validar_contacto_empresa();

alter table public.contactos enable row level security;

create policy "contactos_select_empresa" on public.contactos
for select to authenticated
using (public.usuario_tiene_empresa(empresa_id));

create policy "contactos_insert_empresa" on public.contactos
for insert to authenticated
with check (public.usuario_tiene_empresa(empresa_id));

create policy "contactos_update_empresa" on public.contactos
for update to authenticated
using (public.usuario_tiene_empresa(empresa_id))
with check (public.usuario_tiene_empresa(empresa_id));
