begin;

create or replace function public.pts_validar_detalle_correccion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.evento = 'correccion_guardada' then
    if new.detalle is null or char_length(trim(new.detalle)) < 10 then
      raise exception 'La correccion debe describirse con al menos 10 caracteres';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pts_validar_detalle_correccion on public.pts_historial;
create trigger trg_pts_validar_detalle_correccion
before insert or update on public.pts_historial
for each row
execute function public.pts_validar_detalle_correccion();

commit;
