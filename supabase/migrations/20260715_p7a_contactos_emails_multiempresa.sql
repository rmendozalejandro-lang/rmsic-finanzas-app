-- =========================================================
-- P7A - Aislamiento multiempresa para contactos y emails
-- =========================================================
-- Refuerza que los contactos de cliente, el historial de emails de OT y la
-- configuración de correos solo sean visibles/modificables por usuarios con
-- membresía activa en la empresa de cada registro. Además, impide guardar un
-- contacto asociado a un cliente de otra empresa.

create or replace function public.usuario_tiene_empresa_activa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuario_empresas ue
    where ue.empresa_id = p_empresa_id
      and ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
  );
$$;

grant execute on function public.usuario_tiene_empresa_activa(uuid) to authenticated;

create or replace function public.validar_cliente_contacto_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.empresa_id is null then
    raise exception 'El contacto debe tener empresa_id.';
  end if;

  if new.cliente_id is null then
    raise exception 'El contacto debe tener cliente_id.';
  end if;

  if not exists (
    select 1
    from public.clientes c
    where c.id = new.cliente_id
      and c.empresa_id = new.empresa_id
  ) then
    raise exception 'El cliente del contacto no pertenece a la empresa indicada.';
  end if;

  return new;
end;
$$;


do $$
begin
  if to_regclass('public.clientes') is not null then
    alter table public.clientes enable row level security;

    drop policy if exists "clientes_admin_all" on public.clientes;
    drop policy if exists "clientes_select_empresa" on public.clientes;
    create policy "clientes_select_empresa"
    on public.clientes
    for select
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "clientes_insert_empresa" on public.clientes;
    create policy "clientes_insert_empresa"
    on public.clientes
    for insert
    to authenticated
    with check (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "clientes_update_empresa" on public.clientes;
    create policy "clientes_update_empresa"
    on public.clientes
    for update
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id))
    with check (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "clientes_delete_empresa" on public.clientes;
    create policy "clientes_delete_empresa"
    on public.clientes
    for delete
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id));

    create index if not exists idx_clientes_empresa_activo
      on public.clientes (empresa_id, activo);
  end if;
end $$;

do $$
begin
  if to_regclass('public.proveedores') is not null then
    alter table public.proveedores enable row level security;

    drop policy if exists "proveedores_admin_all" on public.proveedores;
    drop policy if exists "proveedores_select_empresa" on public.proveedores;
    create policy "proveedores_select_empresa"
    on public.proveedores
    for select
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "proveedores_insert_empresa" on public.proveedores;
    create policy "proveedores_insert_empresa"
    on public.proveedores
    for insert
    to authenticated
    with check (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "proveedores_update_empresa" on public.proveedores;
    create policy "proveedores_update_empresa"
    on public.proveedores
    for update
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id))
    with check (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "proveedores_delete_empresa" on public.proveedores;
    create policy "proveedores_delete_empresa"
    on public.proveedores
    for delete
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id));

    create index if not exists idx_proveedores_empresa_activo
      on public.proveedores (empresa_id, activo);
  end if;
end $$;

do $$
begin
  if to_regclass('public.cliente_contactos') is not null then
    alter table public.cliente_contactos enable row level security;

    drop trigger if exists trg_cliente_contactos_validar_empresa on public.cliente_contactos;
    create trigger trg_cliente_contactos_validar_empresa
    before insert or update of empresa_id, cliente_id
    on public.cliente_contactos
    for each row
    execute function public.validar_cliente_contacto_empresa();

    drop policy if exists "cliente_contactos_select_empresa" on public.cliente_contactos;
    create policy "cliente_contactos_select_empresa"
    on public.cliente_contactos
    for select
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "cliente_contactos_insert_empresa" on public.cliente_contactos;
    create policy "cliente_contactos_insert_empresa"
    on public.cliente_contactos
    for insert
    to authenticated
    with check (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "cliente_contactos_update_empresa" on public.cliente_contactos;
    create policy "cliente_contactos_update_empresa"
    on public.cliente_contactos
    for update
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id))
    with check (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "cliente_contactos_delete_empresa" on public.cliente_contactos;
    create policy "cliente_contactos_delete_empresa"
    on public.cliente_contactos
    for delete
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id));

    create index if not exists idx_cliente_contactos_empresa_cliente_activo
      on public.cliente_contactos (empresa_id, cliente_id, activo);
  end if;
end $$;

do $$
begin
  if to_regclass('public.ot_envios_email') is not null then
    alter table public.ot_envios_email enable row level security;

    drop policy if exists "ot_envios_email_select_empresa" on public.ot_envios_email;
    create policy "ot_envios_email_select_empresa"
    on public.ot_envios_email
    for select
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "ot_envios_email_insert_empresa" on public.ot_envios_email;
    create policy "ot_envios_email_insert_empresa"
    on public.ot_envios_email
    for insert
    to authenticated
    with check (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "ot_envios_email_update_empresa" on public.ot_envios_email;
    create policy "ot_envios_email_update_empresa"
    on public.ot_envios_email
    for update
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id))
    with check (public.usuario_tiene_empresa_activa(empresa_id));

    create index if not exists idx_ot_envios_email_empresa_ot_created
      on public.ot_envios_email (empresa_id, ot_id, created_at desc);
  end if;
end $$;

do $$
begin
  if to_regclass('public.empresa_config_correo') is not null then
    alter table public.empresa_config_correo enable row level security;

    drop policy if exists "empresa_config_correo_select_empresa" on public.empresa_config_correo;
    create policy "empresa_config_correo_select_empresa"
    on public.empresa_config_correo
    for select
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "empresa_config_correo_insert_empresa" on public.empresa_config_correo;
    create policy "empresa_config_correo_insert_empresa"
    on public.empresa_config_correo
    for insert
    to authenticated
    with check (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "empresa_config_correo_update_empresa" on public.empresa_config_correo;
    create policy "empresa_config_correo_update_empresa"
    on public.empresa_config_correo
    for update
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id))
    with check (public.usuario_tiene_empresa_activa(empresa_id));

    drop policy if exists "empresa_config_correo_delete_empresa" on public.empresa_config_correo;
    create policy "empresa_config_correo_delete_empresa"
    on public.empresa_config_correo
    for delete
    to authenticated
    using (public.usuario_tiene_empresa_activa(empresa_id));

    create index if not exists idx_empresa_config_correo_empresa_activo
      on public.empresa_config_correo (empresa_id, activo);
  end if;
end $$;
