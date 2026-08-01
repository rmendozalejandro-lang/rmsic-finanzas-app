-- P8B-05 - Procedimientos veterinarios realizados en Tralixia Haras.
-- Migracion additive-only: amplia las tablas del dominio Haras y conserva sus RLS.

alter table public.vet_procedimientos
  add column if not exists estado text not null default 'registrado',
  add column if not exists costo_total numeric(14,2) not null default 0,
  add column if not exists observaciones text;

alter table public.vet_procedimientos drop constraint if exists vet_procedimientos_estado_check;
alter table public.vet_procedimientos add constraint vet_procedimientos_estado_check
  check (estado in ('borrador', 'registrado', 'anulado'));
alter table public.vet_procedimientos add constraint vet_procedimientos_costo_total_check
  check (costo_total >= 0) not valid;

alter table public.vet_procedimiento_insumos
  add column if not exists descripcion text,
  add column if not exists unidad text,
  add column if not exists costo_unitario numeric(14,2),
  add column if not exists costo_total numeric(14,2),
  add column if not exists observaciones text;

-- Un item manual no referencia stock; los items con lote siguen validados por las FK compuestas.
alter table public.vet_procedimiento_insumos alter column insumo_id drop not null;
alter table public.vet_procedimiento_insumos add constraint vet_procedimiento_insumos_costo_check
  check (costo_unitario is null or costo_unitario >= 0) not valid;
alter table public.vet_procedimiento_insumos add constraint vet_procedimiento_insumos_total_check
  check (costo_total is null or costo_total >= 0) not valid;

create index if not exists vet_procedimientos_empresa_estado_fecha_idx
  on public.vet_procedimientos (empresa_id, estado, fecha desc);

create or replace function public.vet_registrar_procedimiento_con_insumos(
  p_empresa_id uuid,
  p_animal_id uuid,
  p_protocolo_id uuid,
  p_fecha timestamptz,
  p_tipo text,
  p_profesional text,
  p_diagnostico text,
  p_detalle text,
  p_proximo_control date,
  p_observaciones text,
  p_estado text,
  p_insumos jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_procedimiento_id uuid;
  v_item jsonb;
  v_insumo_id uuid;
  v_lote_id uuid;
  v_cantidad numeric(14,3);
  v_unidad text;
  v_costo_unitario numeric(14,2);
  v_costo_item numeric(14,2);
  v_total numeric(14,2) := 0;
  v_lote public.vet_lotes_insumo%rowtype;
begin
  if not public.usuario_tiene_acceso_haras(p_empresa_id) then raise exception 'Acceso denegado a la empresa'; end if;
  if p_animal_id is null or coalesce(trim(p_tipo), '') = '' or p_fecha is null then raise exception 'Animal, fecha y tipo son obligatorios'; end if;
  if p_estado not in ('borrador', 'registrado') then raise exception 'Estado inicial invalido'; end if;
  if not exists (select 1 from public.vet_animales where empresa_id=p_empresa_id and id=p_animal_id) then raise exception 'Animal no disponible'; end if;
  if p_protocolo_id is not null and not exists (select 1 from public.vet_protocolos where empresa_id=p_empresa_id and id=p_protocolo_id) then raise exception 'Protocolo no disponible'; end if;

  insert into public.vet_procedimientos (empresa_id,animal_id,protocolo_id,fecha,tipo,profesional,diagnostico,detalle,proximo_control,observaciones,estado,created_by)
  values (p_empresa_id,p_animal_id,p_protocolo_id,p_fecha,trim(p_tipo),nullif(trim(p_profesional),''),nullif(trim(p_diagnostico),''),nullif(trim(p_detalle),''),p_proximo_control,nullif(trim(p_observaciones),''),p_estado,auth.uid())
  returning id into v_procedimiento_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_insumos,'[]'::jsonb)) loop
    v_insumo_id := nullif(v_item->>'insumo_id','')::uuid;
    v_lote_id := nullif(v_item->>'lote_insumo_id','')::uuid;
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_unidad := case when lower(coalesce(v_item->>'unidad',''))='cc' then 'ml' else nullif(trim(v_item->>'unidad'),'') end;
    if v_cantidad is null or v_cantidad <= 0 then raise exception 'Cada cantidad debe ser mayor a cero'; end if;
    if v_lote_id is not null and v_insumo_id is null then raise exception 'Un lote requiere un insumo'; end if;
    if v_insumo_id is not null and not exists (select 1 from public.vet_insumos where empresa_id=p_empresa_id and id=v_insumo_id) then raise exception 'Insumo no disponible'; end if;
    v_costo_unitario := null; v_costo_item := 0;
    if v_lote_id is not null then
      select * into v_lote from public.vet_lotes_insumo where empresa_id=p_empresa_id and id=v_lote_id and insumo_id=v_insumo_id and activo = true for update;
      if not found then raise exception 'Lote activo no disponible para el insumo'; end if;
      if v_lote.fecha_vencimiento is not null and v_lote.fecha_vencimiento < p_fecha::date then raise exception 'No se permite consumir un lote vencido'; end if;
      if p_estado='registrado' and v_lote.cantidad_actual < v_cantidad then raise exception 'Stock insuficiente en lote %', v_lote.numero_lote; end if;
      v_costo_unitario := coalesce(v_lote.costo_unitario,0);
      v_costo_item := round(v_cantidad*v_costo_unitario,2);
      if p_estado='registrado' then update public.vet_lotes_insumo set cantidad_actual=cantidad_actual-v_cantidad,updated_at=now() where empresa_id=p_empresa_id and id=v_lote_id; end if;
    end if;
    insert into public.vet_procedimiento_insumos (empresa_id,procedimiento_id,insumo_id,lote_insumo_id,descripcion,cantidad,unidad,costo_unitario,costo_total,observaciones)
    values (p_empresa_id,v_procedimiento_id,v_insumo_id,v_lote_id,nullif(trim(v_item->>'descripcion'),''),v_cantidad,v_unidad,v_costo_unitario,v_costo_item,nullif(trim(v_item->>'observaciones'),''));
    v_total := v_total+v_costo_item;
  end loop;
  update public.vet_procedimientos set costo_total=v_total,updated_at=now() where id=v_procedimiento_id;
  return v_procedimiento_id;
end;
$$;

create or replace function public.vet_anular_procedimiento(p_empresa_id uuid,p_procedimiento_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item record;
begin
  if not public.usuario_tiene_acceso_haras(p_empresa_id) then raise exception 'Acceso denegado a la empresa'; end if;
  if not exists(select 1 from public.vet_procedimientos where empresa_id=p_empresa_id and id=p_procedimiento_id and estado='registrado' for update) then raise exception 'El procedimiento no esta registrado o no existe'; end if;
  for v_item in select lote_insumo_id,cantidad from public.vet_procedimiento_insumos where empresa_id=p_empresa_id and procedimiento_id=p_procedimiento_id and lote_insumo_id is not null loop
    update public.vet_lotes_insumo set cantidad_actual=cantidad_actual+v_item.cantidad,updated_at=now() where empresa_id=p_empresa_id and id=v_item.lote_insumo_id;
  end loop;
  update public.vet_procedimientos set estado='anulado',updated_at=now() where empresa_id=p_empresa_id and id=p_procedimiento_id;
end;
$$;

revoke all on function public.vet_registrar_procedimiento_con_insumos(uuid,uuid,uuid,timestamptz,text,text,text,text,date,text,text,jsonb) from public;
grant execute on function public.vet_registrar_procedimiento_con_insumos(uuid,uuid,uuid,timestamptz,text,text,text,text,date,text,text,jsonb) to authenticated;
revoke all on function public.vet_anular_procedimiento(uuid,uuid) from public;
grant execute on function public.vet_anular_procedimiento(uuid,uuid) to authenticated;
