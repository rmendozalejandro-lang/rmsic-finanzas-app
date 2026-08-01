-- P8B-06 - Gestaciones, partos, nacimientos y calendario reproductivo.
-- Migración incremental: conserva el modelo original, sus datos y sus políticas RLS.

alter table public.vet_partos
  add column if not exists padre_id uuid,
  add column if not exists fecha_ultima_monta date,
  add column if not exists fecha_probable_parto date,
  add column if not exists fecha_parto_real date,
  add column if not exists dias_gestacion_real integer,
  add column if not exists estado_reproductivo text not null default 'en_gestacion',
  add column if not exists sexo_cria text,
  add column if not exists nombre_cria text,
  add column if not exists peso_cria numeric(10,2),
  add column if not exists peso_placenta numeric(10,2),
  add column if not exists hora_inicio_parto time,
  add column if not exists hora_expulsion_cria time,
  add column if not exists hora_parada_yegua time,
  add column if not exists hora_corte_cordon time,
  add column if not exists hora_parada_potrillo time,
  add column if not exists hora_expulsion_placenta time,
  add column if not exists hora_primera_mamada time;

update public.vet_partos
set fecha_probable_parto = coalesce(fecha_probable_parto, fecha_probable),
    fecha_parto_real = coalesce(fecha_parto_real, fecha_parto::date),
    dias_gestacion_real = coalesce(
      dias_gestacion_real,
      case when fecha_parto is not null and fecha_ultima_monta is not null
        then fecha_parto::date - fecha_ultima_monta end
    ),
    estado_reproductivo = case
      when estado = 'ocurrido' or fecha_parto is not null then 'parto_registrado'
      when estado = 'cancelado' then 'anulado'
      when fecha_ultima_monta is null then 'sin_monta'
      else estado_reproductivo
    end;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vet_partos_padre_empresa_fk') then
    alter table public.vet_partos
      add constraint vet_partos_padre_empresa_fk
      foreign key (empresa_id, padre_id) references public.vet_animales(empresa_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vet_partos_estado_reproductivo_check') then
    alter table public.vet_partos
      add constraint vet_partos_estado_reproductivo_check
      check (estado_reproductivo in ('en_gestacion', 'proxima_a_parto', 'parto_registrado', 'parto_atrasado', 'sin_monta', 'anulado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vet_partos_sexo_cria_check') then
    alter table public.vet_partos
      add constraint vet_partos_sexo_cria_check
      check (sexo_cria is null or sexo_cria in ('macho', 'hembra', 'no_definido'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vet_partos_pesos_no_negativos_check') then
    alter table public.vet_partos
      add constraint vet_partos_pesos_no_negativos_check
      check ((peso_cria is null or peso_cria >= 0) and (peso_placenta is null or peso_placenta >= 0));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vet_partos_fechas_reproductivas_check') then
    alter table public.vet_partos
      add constraint vet_partos_fechas_reproductivas_check
      check (
        (fecha_probable_parto is null or fecha_ultima_monta is null or fecha_probable_parto > fecha_ultima_monta)
        and (fecha_parto_real is null or fecha_ultima_monta is null or fecha_parto_real >= fecha_ultima_monta)
      );
  end if;
end
$$;

create index if not exists vet_partos_empresa_estado_reproductivo_idx
  on public.vet_partos (empresa_id, estado_reproductivo, fecha_probable_parto);

-- La tabla ya tiene RLS; se reafirma sin reemplazar la política multiempresa existente.
alter table public.vet_partos enable row level security;
