-- Security hardening: accounting/fixed-assets RPCs and cotizacion folios
-- Prepared in feature branch only. Do not apply to production until regression tests pass.
--
-- Goal:
-- 1) Prevent authenticated cross-company execution of SECURITY DEFINER accounting RPCs.
-- 2) Require explicit finance/admin role checks for accounting mutations.
-- 3) Restrict cotizacion folio generation to users who belong to the company and have
--    an appropriate commercial/admin role.

begin;

create or replace function public.next_cotizacion_folio(_empresa_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid;
  v_next bigint;
begin
  v_usuario := auth.uid();

  if v_usuario is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_usuario
        and ue.empresa_id = _empresa_id
        and coalesce(ue.activo, true) = true
        and ue.rol in ('admin', 'comercial')
    )
  ) then
    raise exception 'No tienes permisos para generar folios de cotización en esta empresa';
  end if;

  insert into public.cotizaciones_folios as cf (empresa_id, ultimo_folio, updated_at)
  values (_empresa_id, 1, now())
  on conflict (empresa_id)
  do update
    set ultimo_folio = cf.ultimo_folio + 1,
        updated_at = now()
  returning ultimo_folio into v_next;

  return v_next;
end;
$function$;

create or replace function public.generar_depreciaciones_activo_fijo(
  p_activo_fijo_id uuid,
  p_hasta_periodo date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid;
  v_activo record;
  v_base_depreciable numeric(14,2);
  v_monto_mensual numeric(14,2);
  v_periodo_inicio date;
  v_periodo_hasta date;
  v_periodo date;
  v_meses_a_generar integer;
  v_i integer;
  v_depreciado_prev numeric(14,2);
  v_monto_periodo numeric(14,2);
  v_valor_libro_antes numeric(14,2);
  v_valor_libro_despues numeric(14,2);
  v_insertados integer := 0;
begin
  v_usuario := auth.uid();

  if v_usuario is null then
    raise exception 'Usuario no autenticado';
  end if;

  select af.*
  into v_activo
  from public.activos_fijos af
  where af.id = p_activo_fijo_id
    and af.deleted_at is null
  for update;

  if v_activo.id is null then
    raise exception 'No se encontró el activo fijo indicado';
  end if;

  if not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_usuario
        and ue.empresa_id = v_activo.empresa_id
        and coalesce(ue.activo, true) = true
        and ue.rol in ('admin', 'administracion_financiera', 'gerencia')
    )
  ) then
    raise exception 'No tiene permisos para generar depreciaciones en esta empresa';
  end if;

  if v_activo.estado not in ('activo', 'depreciado') then
    raise exception 'El activo fijo no está disponible para depreciación. Estado actual: %', v_activo.estado;
  end if;

  if v_activo.metodo <> 'lineal' then
    raise exception 'Método de depreciación no soportado: %', v_activo.metodo;
  end if;

  v_base_depreciable := greatest(
    coalesce(v_activo.valor_compra, 0) - coalesce(v_activo.valor_residual, 0),
    0
  );

  if v_base_depreciable <= 0 then
    raise exception 'El activo fijo no tiene base depreciable válida';
  end if;

  v_monto_mensual := round(v_base_depreciable / v_activo.vida_util_meses);
  v_periodo_inicio := date_trunc('month', v_activo.fecha_inicio_depreciacion)::date;
  v_periodo_hasta := date_trunc('month', coalesce(p_hasta_periodo, current_date))::date;

  if v_periodo_hasta < v_periodo_inicio then
    raise exception 'El periodo hasta no puede ser anterior al inicio de depreciación';
  end if;

  v_meses_a_generar := (
    (extract(year from age(v_periodo_hasta, v_periodo_inicio))::integer * 12)
    + extract(month from age(v_periodo_hasta, v_periodo_inicio))::integer
    + 1
  );

  v_meses_a_generar := least(v_meses_a_generar, v_activo.vida_util_meses);

  for v_i in 0..(v_meses_a_generar - 1) loop
    v_periodo := (v_periodo_inicio + (v_i || ' months')::interval)::date;

    if exists (
      select 1
      from public.activo_fijo_depreciaciones afd
      where afd.activo_fijo_id = p_activo_fijo_id
        and afd.periodo = v_periodo
        and afd.deleted_at is null
        and afd.estado <> 'anulada'
    ) then
      continue;
    end if;

    select coalesce(sum(afd.monto_depreciacion), 0)
    into v_depreciado_prev
    from public.activo_fijo_depreciaciones afd
    where afd.activo_fijo_id = p_activo_fijo_id
      and afd.deleted_at is null
      and afd.estado <> 'anulada';

    if v_depreciado_prev >= v_base_depreciable then
      exit;
    end if;

    v_monto_periodo := least(v_monto_mensual, v_base_depreciable - v_depreciado_prev);

    if v_i = v_activo.vida_util_meses - 1 then
      v_monto_periodo := v_base_depreciable - v_depreciado_prev;
    end if;

    v_valor_libro_antes := v_activo.valor_compra - v_depreciado_prev;
    v_valor_libro_despues := v_valor_libro_antes - v_monto_periodo;

    insert into public.activo_fijo_depreciaciones (
      empresa_id,
      activo_fijo_id,
      periodo,
      monto_depreciacion,
      valor_libro_antes,
      valor_libro_despues,
      estado,
      observacion,
      created_by
    )
    values (
      v_activo.empresa_id,
      p_activo_fijo_id,
      v_periodo,
      v_monto_periodo,
      v_valor_libro_antes,
      v_valor_libro_despues,
      'borrador',
      'Depreciación mensual generada automáticamente',
      v_usuario
    );

    v_insertados := v_insertados + 1;
  end loop;

  update public.activos_fijos
  set
    estado = case
      when (
        select coalesce(sum(afd.monto_depreciacion), 0)
        from public.activo_fijo_depreciaciones afd
        where afd.activo_fijo_id = p_activo_fijo_id
          and afd.deleted_at is null
          and afd.estado <> 'anulada'
      ) >= v_base_depreciable
      then 'depreciado'
      else estado
    end,
    updated_at = now(),
    updated_by = v_usuario
  where id = p_activo_fijo_id;

  return v_insertados;
end;
$function$;

create or replace function public.generar_depreciaciones_empresa(
  p_empresa_id uuid,
  p_hasta_periodo date default current_date
)
returns table(
  activo_fijo_id uuid,
  codigo text,
  nombre text,
  depreciaciones_generadas integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid;
  v_activo record;
  v_generadas integer;
begin
  v_usuario := auth.uid();

  if v_usuario is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_usuario
        and ue.empresa_id = p_empresa_id
        and coalesce(ue.activo, true) = true
        and ue.rol in ('admin', 'administracion_financiera', 'gerencia')
    )
  ) then
    raise exception 'No tiene permisos para generar depreciaciones en esta empresa';
  end if;

  for v_activo in
    select af.id, af.codigo, af.nombre
    from public.activos_fijos af
    where af.empresa_id = p_empresa_id
      and af.deleted_at is null
      and af.estado in ('activo', 'depreciado')
    order by af.fecha_inicio_depreciacion, af.nombre
  loop
    v_generadas := public.generar_depreciaciones_activo_fijo(
      v_activo.id,
      p_hasta_periodo
    );

    activo_fijo_id := v_activo.id;
    codigo := v_activo.codigo;
    nombre := v_activo.nombre;
    depreciaciones_generadas := v_generadas;
    return next;
  end loop;
end;
$function$;

create or replace function public.crear_asiento_depreciacion_activo_fijo(
  p_depreciacion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_dep record;
  v_activo record;
  v_categoria record;
  v_asiento_id uuid;
  v_periodo_texto text;
  v_usuario uuid;
  v_numero text;
begin
  v_usuario := auth.uid();

  if v_usuario is null then
    raise exception 'Usuario no autenticado';
  end if;

  select afd.*
  into v_dep
  from public.activo_fijo_depreciaciones afd
  where afd.id = p_depreciacion_id
    and afd.deleted_at is null
  for update;

  if v_dep.id is null then
    raise exception 'No se encontró la depreciación indicada';
  end if;

  if not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_usuario
        and ue.empresa_id = v_dep.empresa_id
        and coalesce(ue.activo, true) = true
        and ue.rol in ('admin', 'administracion_financiera', 'gerencia')
    )
  ) then
    raise exception 'No tiene permisos para contabilizar depreciaciones en esta empresa';
  end if;

  if v_dep.estado <> 'borrador' then
    raise exception 'La depreciación no está en estado borrador. Estado actual: %', v_dep.estado;
  end if;

  if v_dep.asiento_id is not null then
    raise exception 'La depreciación ya tiene asiento asociado';
  end if;

  select af.* into v_activo
  from public.activos_fijos af
  where af.id = v_dep.activo_fijo_id
    and af.empresa_id = v_dep.empresa_id
    and af.deleted_at is null;

  if v_activo.id is null then
    raise exception 'No se encontró el activo fijo asociado';
  end if;

  select afc.* into v_categoria
  from public.activo_fijo_categorias afc
  where afc.id = v_activo.categoria_id
    and afc.empresa_id = v_dep.empresa_id
    and afc.deleted_at is null;

  if v_categoria.id is null then
    raise exception 'No se encontró la categoría del activo fijo';
  end if;

  v_periodo_texto := to_char(v_dep.periodo, 'YYYY-MM');
  v_asiento_id := gen_random_uuid();
  v_numero := 'DEP-' || v_periodo_texto || '-' || left(v_dep.id::text, 8);

  insert into public.asientos_contables (
    id, empresa_id, fecha, numero, glosa, origen_tipo, origen_id,
    estado, activo, created_by, updated_by, created_at, updated_at
  )
  values (
    v_asiento_id,
    v_dep.empresa_id,
    v_dep.periodo,
    v_numero,
    'Depreciación mensual activo fijo: ' || coalesce(v_activo.nombre, 'Activo fijo') || ' periodo ' || v_periodo_texto,
    'activo_fijo_depreciacion',
    v_dep.id,
    'borrador',
    true,
    v_usuario,
    v_usuario,
    now(),
    now()
  );

  insert into public.asiento_detalles (
    id, asiento_id, empresa_id, cuenta_contable_id, descripcion,
    debe, haber, activo, created_by, updated_by, created_at, updated_at
  )
  values
  (
    gen_random_uuid(), v_asiento_id, v_dep.empresa_id,
    v_categoria.cuenta_gasto_depreciacion_id,
    'Gasto por depreciación - ' || coalesce(v_activo.nombre, 'Activo fijo'),
    v_dep.monto_depreciacion, 0, true, v_usuario, v_usuario, now(), now()
  ),
  (
    gen_random_uuid(), v_asiento_id, v_dep.empresa_id,
    v_categoria.cuenta_depreciacion_acumulada_id,
    'Depreciación acumulada - ' || coalesce(v_activo.nombre, 'Activo fijo'),
    0, v_dep.monto_depreciacion, true, v_usuario, v_usuario, now(), now()
  );

  update public.activo_fijo_depreciaciones
  set
    asiento_id = v_asiento_id,
    estado = 'contabilizada',
    updated_at = now(),
    updated_by = v_usuario
  where id = p_depreciacion_id
    and empresa_id = v_dep.empresa_id;

  return v_asiento_id;
end;
$function$;

create or replace function public.crear_asientos_depreciacion_periodo(
  p_empresa_id uuid,
  p_periodo date
)
returns table(
  depreciacion_id uuid,
  activo_fijo_id uuid,
  activo_nombre text,
  periodo date,
  monto_depreciacion numeric,
  asiento_id uuid
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid;
  v_dep record;
  v_asiento_id uuid;
  v_periodo_normalizado date;
begin
  v_usuario := auth.uid();

  if v_usuario is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_usuario
        and ue.empresa_id = p_empresa_id
        and coalesce(ue.activo, true) = true
        and ue.rol in ('admin', 'administracion_financiera', 'gerencia')
    )
  ) then
    raise exception 'No tiene permisos para contabilizar depreciaciones en esta empresa';
  end if;

  v_periodo_normalizado := date_trunc('month', p_periodo)::date;

  for v_dep in
    select afd.id, afd.activo_fijo_id, af.nombre as activo_nombre,
           afd.periodo, afd.monto_depreciacion
    from public.activo_fijo_depreciaciones afd
    join public.activos_fijos af
      on af.id = afd.activo_fijo_id
     and af.empresa_id = afd.empresa_id
    where afd.empresa_id = p_empresa_id
      and afd.periodo = v_periodo_normalizado
      and afd.estado = 'borrador'
      and afd.asiento_id is null
      and afd.deleted_at is null
      and af.deleted_at is null
    order by af.nombre
  loop
    v_asiento_id := public.crear_asiento_depreciacion_activo_fijo(v_dep.id);

    depreciacion_id := v_dep.id;
    activo_fijo_id := v_dep.activo_fijo_id;
    activo_nombre := v_dep.activo_nombre;
    periodo := v_dep.periodo;
    monto_depreciacion := v_dep.monto_depreciacion;
    asiento_id := v_asiento_id;
    return next;
  end loop;
end;
$function$;

create or replace function public.crear_asiento_movimiento_prestamo_trabajador(
  p_movimiento_id uuid,
  p_operacion text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid;
  v_asiento_id uuid;
  v_empresa_id uuid;
  v_fecha date;
  v_monto numeric(14,2);
  v_glosa text;
  v_cuenta_bancaria_id uuid;
  v_cuenta_banco_id uuid;
  v_cuenta_prestamo_id uuid;
  v_estado_asiento text;
  v_numero_asiento text;
begin
  v_usuario := auth.uid();

  if v_usuario is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_operacion not in ('entrega', 'abono', 'reversa_abono') then
    raise exception 'Operación inválida. Use entrega, abono o reversa_abono';
  end if;

  select m.empresa_id, m.fecha, m.monto_total, m.descripcion, m.cuenta_bancaria_id
  into v_empresa_id, v_fecha, v_monto, v_glosa, v_cuenta_bancaria_id
  from public.movimientos m
  where m.id = p_movimiento_id
    and m.activo = true
    and m.deleted_at is null;

  if v_empresa_id is null then
    raise exception 'No se encontró el movimiento bancario indicado';
  end if;

  if not (
    public.es_super_admin()
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_usuario
        and ue.empresa_id = v_empresa_id
        and coalesce(ue.activo, true) = true
        and ue.rol in ('admin', 'administracion_financiera', 'gerencia')
    )
  ) then
    raise exception 'No tiene permisos para crear asientos de préstamos en esta empresa';
  end if;

  if v_monto is null or v_monto <= 0 then
    raise exception 'El movimiento no tiene monto válido para asiento';
  end if;

  select cb.cuenta_contable_id
  into v_cuenta_banco_id
  from public.cuentas_bancarias cb
  where cb.id = v_cuenta_bancaria_id
    and cb.empresa_id = v_empresa_id
    and cb.activa = true
    and cb.deleted_at is null;

  if v_cuenta_banco_id is null then
    raise exception 'La cuenta bancaria del movimiento no tiene cuenta_contable_id asociada';
  end if;

  select cc.id
  into v_cuenta_prestamo_id
  from public.cuentas_contables cc
  where cc.empresa_id = v_empresa_id
    and cc.deleted_at is null
    and cc.activa = true
    and cc.acepta_movimientos = true
    and lower(cc.nombre) = 'préstamos al personal'
  limit 1;

  if v_cuenta_prestamo_id is null then
    raise exception 'No existe cuenta contable activa "Préstamos al personal" para esta empresa';
  end if;

  select ac.id
  into v_asiento_id
  from public.asientos_contables ac
  where ac.origen_id = p_movimiento_id
    and ac.origen_tipo = 'prestamo_trabajador_' || p_operacion
    and ac.empresa_id = v_empresa_id
    and ac.deleted_at is null
  limit 1;

  if v_asiento_id is not null then
    return v_asiento_id;
  end if;

  v_estado_asiento := 'contabilizado';
  v_asiento_id := gen_random_uuid();
  v_numero_asiento := 'ASI-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || left(v_asiento_id::text, 4);

  insert into public.asientos_contables (
    id, empresa_id, fecha, numero, glosa, origen_tipo, origen_id,
    estado, activo, created_by, updated_by
  )
  values (
    v_asiento_id, v_empresa_id, v_fecha, v_numero_asiento,
    coalesce(v_glosa, 'Asiento préstamo trabajador'),
    'prestamo_trabajador_' || p_operacion,
    p_movimiento_id, v_estado_asiento, true, v_usuario, v_usuario
  );

  if p_operacion = 'entrega' then
    insert into public.asiento_detalles (
      asiento_id, empresa_id, cuenta_contable_id, descripcion,
      debe, haber, activo, created_by, updated_by
    )
    values
      (v_asiento_id, v_empresa_id, v_cuenta_prestamo_id,
       'Préstamo al personal - cuenta por cobrar', v_monto, 0, true, v_usuario, v_usuario),
      (v_asiento_id, v_empresa_id, v_cuenta_banco_id,
       'Salida bancaria por préstamo al trabajador', 0, v_monto, true, v_usuario, v_usuario);
  elsif p_operacion = 'abono' then
    insert into public.asiento_detalles (
      asiento_id, empresa_id, cuenta_contable_id, descripcion,
      debe, haber, activo, created_by, updated_by
    )
    values
      (v_asiento_id, v_empresa_id, v_cuenta_banco_id,
       'Ingreso bancario por abono de préstamo', v_monto, 0, true, v_usuario, v_usuario),
      (v_asiento_id, v_empresa_id, v_cuenta_prestamo_id,
       'Disminución cuenta por cobrar préstamo al personal', 0, v_monto, true, v_usuario, v_usuario);
  else
    insert into public.asiento_detalles (
      asiento_id, empresa_id, cuenta_contable_id, descripcion,
      debe, haber, activo, created_by, updated_by
    )
    values
      (v_asiento_id, v_empresa_id, v_cuenta_prestamo_id,
       'Reversa abono préstamo al personal', v_monto, 0, true, v_usuario, v_usuario),
      (v_asiento_id, v_empresa_id, v_cuenta_banco_id,
       'Salida bancaria por reversa de abono', 0, v_monto, true, v_usuario, v_usuario);
  end if;

  update public.movimientos
  set
    cuenta_contable_id = v_cuenta_prestamo_id,
    updated_by = v_usuario,
    updated_at = now()
  where id = p_movimiento_id
    and empresa_id = v_empresa_id;

  return v_asiento_id;
end;
$function$;

-- Remove anonymous access and keep authenticated access explicit.
revoke execute on function public.next_cotizacion_folio(uuid) from anon;
revoke execute on function public.generar_depreciaciones_activo_fijo(uuid, date) from anon;
revoke execute on function public.generar_depreciaciones_empresa(uuid, date) from anon;
revoke execute on function public.crear_asiento_depreciacion_activo_fijo(uuid) from anon;
revoke execute on function public.crear_asientos_depreciacion_periodo(uuid, date) from anon;
revoke execute on function public.crear_asiento_movimiento_prestamo_trabajador(uuid, text) from anon;

grant execute on function public.next_cotizacion_folio(uuid) to authenticated;
grant execute on function public.generar_depreciaciones_activo_fijo(uuid, date) to authenticated;
grant execute on function public.generar_depreciaciones_empresa(uuid, date) to authenticated;
grant execute on function public.crear_asiento_depreciacion_activo_fijo(uuid) to authenticated;
grant execute on function public.crear_asientos_depreciacion_periodo(uuid, date) to authenticated;
grant execute on function public.crear_asiento_movimiento_prestamo_trabajador(uuid, text) to authenticated;

commit;
