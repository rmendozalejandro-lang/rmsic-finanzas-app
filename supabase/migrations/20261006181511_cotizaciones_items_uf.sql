alter table public.cotizacion_items
  add column if not exists moneda_item text not null default 'CLP',
  add column if not exists precio_uf numeric,
  add column if not exists fecha_valor_uf date,
  add column if not exists valor_uf_clp numeric,
  add column if not exists fuente_valor_uf text,
  add column if not exists uf_congelada_at timestamptz;

alter table public.cotizaciones
  add column if not exists fecha_envio timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cotizacion_items'::regclass
      and conname = 'cotizacion_items_moneda_item_check'
  ) then
    alter table public.cotizacion_items
      add constraint cotizacion_items_moneda_item_check
      check (moneda_item in ('CLP', 'UF'));
  end if;
end
$$;
