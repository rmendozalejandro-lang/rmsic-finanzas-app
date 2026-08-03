-- P9A-05 - Destinatario del maestro Contactos en cotizaciones.
-- Los snapshots preservan los datos históricos aunque cambie el contacto maestro.

alter table public.cotizaciones
  add column if not exists contacto_id uuid null,
  add column if not exists contacto_nombre_snapshot text null,
  add column if not exists contacto_email_snapshot text null,
  add column if not exists contacto_telefono_snapshot text null,
  add column if not exists contacto_cargo_snapshot text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cotizaciones_contacto_id_fkey'
      and conrelid = 'public.cotizaciones'::regclass
  ) then
    alter table public.cotizaciones
      add constraint cotizaciones_contacto_id_fkey
      foreign key (contacto_id) references public.contactos(id) on delete set null;
  end if;
end
$$;

create or replace function public.validar_cotizacion_contacto_destinatario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contacto_id is not null then
    if not exists (
      select 1 from public.contactos contacto
      where contacto.id = new.contacto_id
        and contacto.empresa_id = new.empresa_id
        and contacto.cliente_id = new.cliente_id
        and contacto.activo = true
    ) then
      raise exception 'El contacto destinatario no pertenece al cliente y empresa de la cotización.';
    end if;

    if tg_op = 'INSERT' or new.contacto_id is distinct from old.contacto_id then
      select contacto.nombre, contacto.email, contacto.telefono, contacto.cargo
      into new.contacto_nombre_snapshot, new.contacto_email_snapshot,
        new.contacto_telefono_snapshot, new.contacto_cargo_snapshot
      from public.contactos contacto
      where contacto.id = new.contacto_id;
    end if;
  elsif tg_op = 'INSERT' or old.contacto_id is not null then
    new.contacto_nombre_snapshot = null;
    new.contacto_email_snapshot = null;
    new.contacto_telefono_snapshot = null;
    new.contacto_cargo_snapshot = null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cotizaciones_validar_contacto_destinatario on public.cotizaciones;
create trigger trg_cotizaciones_validar_contacto_destinatario
before insert or update of contacto_id, cliente_id, empresa_id on public.cotizaciones
for each row execute function public.validar_cotizacion_contacto_destinatario();

comment on column public.cotizaciones.contacto_id is 'Contacto destinatario asociado al cliente de la cotización.';
comment on column public.cotizaciones.contacto_nombre_snapshot is 'Nombre histórico del contacto destinatario.';
comment on column public.cotizaciones.contacto_email_snapshot is 'Email histórico del contacto destinatario.';
comment on column public.cotizaciones.contacto_telefono_snapshot is 'Teléfono histórico del contacto destinatario.';
comment on column public.cotizaciones.contacto_cargo_snapshot is 'Cargo histórico del contacto destinatario.';
