-- Reemplaza la firma anterior para añadir parámetros opcionales sin dejar una
-- sobrecarga ambigua para PostgREST. Las llamadas que omiten factura conservan
-- exactamente el comportamiento anterior gracias a los DEFAULT del final.
drop function if exists public.generar_ingreso_financiero_cotizacion(
  uuid, text, date, boolean, text, text
);

create or replace function public.generar_ingreso_financiero_cotizacion(
  p_cotizacion_id uuid,
  p_numero_oc text,
  p_fecha_oc date,
  p_aprobacion_sin_oc boolean,
  p_tipo_respaldo_aprobacion text,
  p_referencia_aprobacion text,
  p_factura_emitida boolean default false,
  p_numero_factura text default null,
  p_fecha_factura date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cotizacion public.cotizaciones%rowtype;
  v_movimiento_id uuid;
  v_cxc_id uuid;
  v_auth_uid uuid := auth.uid();
  v_numero_oc text := nullif(trim(coalesce(p_numero_oc, '')), '');
  v_numero_factura text := nullif(trim(coalesce(p_numero_factura, '')), '');
  v_tipo_respaldo text := nullif(trim(coalesce(p_tipo_respaldo_aprobacion, '')), '');
  v_referencia text := nullif(trim(coalesce(p_referencia_aprobacion, '')), '');
  v_fecha_base date;
  v_fecha_vencimiento date;
  v_dias_credito integer := 0;
  v_tipo_documento text;
  v_numero_documento text;
  v_respaldo_tipo text;
  v_respaldo_numero text;
  v_observaciones text;
begin
  select c.*
    into v_cotizacion
    from public.cotizaciones c
   where c.id = p_cotizacion_id
     and c.activo = true
     and c.deleted_at is null
   for update;

  if not found then
    raise exception 'No se encontró la cotización activa indicada.';
  end if;

  -- SECURITY DEFINER no debe saltarse el aislamiento multiempresa del usuario.
  if v_auth_uid is not null
     and not public.es_super_admin()
     and not exists (
       select 1
         from public.usuario_empresas ue
        where ue.usuario_id = v_auth_uid
          and ue.empresa_id = v_cotizacion.empresa_id
          and ue.activo = true
     ) then
    raise exception 'No tiene permisos para generar ingresos en esta empresa.';
  end if;

  if v_cotizacion.estado <> 'aprobada' then
    raise exception 'La cotización debe estar aprobada para generar el ingreso financiero.';
  end if;

  -- La relación genérica es la fuente de verdad. El bloqueo de la cotización
  -- serializa llamadas simultáneas y hace idempotente la búsqueda + inserción.
  select m.id
    into v_movimiento_id
    from public.movimientos m
   where m.empresa_id = v_cotizacion.empresa_id
     and m.tipo_movimiento = 'ingreso'
     and (
       (m.origen_tipo = 'cotizacion' and m.origen_id = p_cotizacion_id)
       or (
         m.id = v_cotizacion.ingreso_generado_id
         and m.origen_tipo is null
         and m.origen_id is null
       )
     )
     and m.activo = true
     and m.deleted_at is null
     and m.estado <> 'anulado'
   order by m.created_at
   limit 1;

  if v_movimiento_id is not null then
    -- Los ingresos históricos enlazados solo por ingreso_generado_id se
    -- normalizan a la relación genérica antes de retornarlos.
    update public.movimientos
       set origen_tipo = 'cotizacion',
           origen_id = v_cotizacion.id
     where id = v_movimiento_id
       and origen_tipo is null
       and origen_id is null;

    select cxc.id
      into v_cxc_id
      from public.cuentas_por_cobrar cxc
     where cxc.movimiento_id = v_movimiento_id
     limit 1;

    if v_cotizacion.ingreso_generado_id is distinct from v_movimiento_id then
      update public.cotizaciones
         set ingreso_generado_id = v_movimiento_id,
             ingreso_generado_at = coalesce(ingreso_generado_at, now()),
             ingreso_generado_por = coalesce(ingreso_generado_por, v_auth_uid)
       where id = v_cotizacion.id;
    end if;

    raise notice 'La cotización ya tenía un ingreso financiero activo.';
    return v_movimiento_id;
  end if;

  if v_numero_oc is null
     and not (
       coalesce(p_aprobacion_sin_oc, false)
       and v_tipo_respaldo is not null
       and v_referencia is not null
     ) then
    raise exception 'Debe ingresar una OC o indicar el respaldo de aprobación sin OC.';
  end if;

  if coalesce(p_factura_emitida, false) and v_numero_factura is null then
    raise exception 'Debe ingresar el número de factura.';
  end if;

  if coalesce(p_factura_emitida, false) and p_fecha_factura is null then
    raise exception 'Debe ingresar la fecha de la factura.';
  end if;

  if v_numero_oc is not null then
    v_respaldo_tipo := 'orden_compra';
    v_respaldo_numero := v_numero_oc;
  else
    v_respaldo_tipo := v_tipo_respaldo;
    v_respaldo_numero := v_referencia;
  end if;

  if coalesce(p_factura_emitida, false) then
    v_fecha_base := p_fecha_factura;
    v_tipo_documento := 'factura';
    v_numero_documento := v_numero_factura;
  else
    v_fecha_base := coalesce(p_fecha_oc, v_cotizacion.fecha_oc, current_date);
    v_tipo_documento := 'otro';
    v_numero_documento := coalesce(
      v_numero_oc,
      'SIN-OC-' || coalesce(v_cotizacion.codigo, v_cotizacion.id::text)
    );
  end if;

  select case coalesce(cl.condicion_pago, 'contado')
           when '7_dias' then 7
           when '15_dias' then 15
           when '30_dias' then 30
           when '45_dias' then 45
           when '60_dias' then 60
           when 'personalizado' then greatest(0, coalesce(cl.dias_credito, 0))
           else 0
         end
    into v_dias_credito
    from public.clientes cl
   where cl.id = v_cotizacion.cliente_id
     and cl.empresa_id = v_cotizacion.empresa_id;

  v_fecha_vencimiento := v_fecha_base + coalesce(v_dias_credito, 0);
  v_observaciones := concat_ws(E'\n',
    nullif(trim(coalesce(v_cotizacion.observaciones, '')), ''),
    'Ingreso generado desde cotización ' || coalesce(v_cotizacion.codigo, v_cotizacion.id::text),
    case when v_numero_oc is not null then 'OC: ' || v_numero_oc end,
    case when v_numero_oc is null then 'Respaldo: ' || v_respaldo_tipo || ' - ' || v_respaldo_numero end,
    case when coalesce(p_factura_emitida, false) then 'Factura emitida: Sí' end,
    case when coalesce(p_factura_emitida, false) then 'Factura: ' || v_numero_factura end,
    case when coalesce(p_factura_emitida, false) then 'Fecha factura: ' || p_fecha_factura::text end
  );

  insert into public.movimientos (
    empresa_id, tipo_movimiento, fecha, fecha_vencimiento,
    tercero_tipo, cliente_id, tipo_documento, numero_documento,
    descripcion, monto_neto, monto_iva, monto_exento, monto_total,
    estado, observaciones, created_by, activo, deleted_at,
    origen_tipo, origen_id,
    documento_tributario_tipo, documento_tributario_numero,
    documento_tributario_fecha,
    respaldo_comercial_tipo, respaldo_comercial_numero
  ) values (
    v_cotizacion.empresa_id, 'ingreso', v_fecha_base, v_fecha_vencimiento,
    'cliente', v_cotizacion.cliente_id, v_tipo_documento, v_numero_documento,
    'Ingreso por cotización ' || coalesce(v_cotizacion.codigo, v_cotizacion.id::text),
    coalesce(v_cotizacion.subtotal_neto, 0),
    coalesce(v_cotizacion.monto_iva, 0),
    coalesce(v_cotizacion.subtotal_exento, 0),
    coalesce(v_cotizacion.total, 0),
    'pendiente', v_observaciones, v_auth_uid, true, null,
    'cotizacion', v_cotizacion.id,
    case when coalesce(p_factura_emitida, false) then 'factura' else null end,
    case when coalesce(p_factura_emitida, false) then v_numero_factura else null end,
    case when coalesce(p_factura_emitida, false) then p_fecha_factura else null end,
    v_respaldo_tipo, v_respaldo_numero
  )
  returning id into v_movimiento_id;

  -- El trigger existente crea la CxC con ON CONFLICT (movimiento_id). Esta
  -- lectura confirma/reutiliza esa única cuenta sin insertar una segunda.
  select cxc.id
    into v_cxc_id
    from public.cuentas_por_cobrar cxc
   where cxc.movimiento_id = v_movimiento_id
   limit 1;

  update public.cotizaciones
     set numero_oc = v_numero_oc,
         fecha_oc = coalesce(p_fecha_oc, fecha_oc),
         aprobacion_sin_oc = coalesce(p_aprobacion_sin_oc, false),
         tipo_respaldo_aprobacion = v_tipo_respaldo,
         referencia_aprobacion = v_referencia,
         ingreso_generado_id = v_movimiento_id,
         ingreso_generado_at = now(),
         ingreso_generado_por = v_auth_uid
   where id = v_cotizacion.id;

  return v_movimiento_id;
end;
$$;

revoke all on function public.generar_ingreso_financiero_cotizacion(
  uuid, text, date, boolean, text, text, boolean, text, date
) from public, anon;

grant execute on function public.generar_ingreso_financiero_cotizacion(
  uuid, text, date, boolean, text, text, boolean, text, date
) to authenticated, service_role;
