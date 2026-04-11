


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."crear_cxc_desde_movimiento"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.tipo_movimiento = 'ingreso'
     and new.estado = 'pendiente' then

    insert into public.cuentas_por_cobrar (
      empresa_id,
      movimiento_id,
      cliente_id,
      fecha_emision,
      fecha_vencimiento,
      monto_total,
      monto_pagado,
      saldo_pendiente,
      estado
    )
    values (
      new.empresa_id,
      new.id,
      new.cliente_id,
      new.fecha,
      new.fecha_vencimiento,
      new.monto_total,
      0,
      new.monto_total,
      case
        when new.fecha_vencimiento is not null and new.fecha_vencimiento < current_date then 'vencido'
        else 'pendiente'
      end
    )
    on conflict (movimiento_id) do nothing;

  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."crear_cxc_desde_movimiento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_cxp_desde_movimiento"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.tipo_movimiento = 'egreso'
     and new.estado = 'pendiente' then

    insert into public.cuentas_por_pagar (
      empresa_id,
      movimiento_id,
      proveedor_id,
      fecha_emision,
      fecha_vencimiento,
      monto_total,
      monto_pagado,
      saldo_pendiente,
      estado
    )
    values (
      new.empresa_id,
      new.id,
      new.proveedor_id,
      new.fecha,
      new.fecha_vencimiento,
      new.monto_total,
      0,
      new.monto_total,
      case
        when new.fecha_vencimiento is not null and new.fecha_vencimiento < current_date then 'vencido'
        else 'pendiente'
      end
    )
    on conflict (movimiento_id) do nothing;

  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."crear_cxp_desde_movimiento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_admin_activo"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and p.rol = 'admin'
  );
$$;


ALTER FUNCTION "public"."es_admin_activo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_pago_cxc"("p_numero_factura" "text", "p_monto_pagado" numeric, "p_fecha_pago" "date" DEFAULT CURRENT_DATE) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_cxc_id uuid;
  v_movimiento_id uuid;
  v_saldo_actual numeric;
  v_monto_pagado_actual numeric;
  v_nuevo_monto_pagado numeric;
  v_nuevo_saldo numeric;
  v_nuevo_estado text;
begin
  select
    cxc.id,
    cxc.movimiento_id,
    cxc.saldo_pendiente,
    cxc.monto_pagado
  into
    v_cxc_id,
    v_movimiento_id,
    v_saldo_actual,
    v_monto_pagado_actual
  from public.cuentas_por_cobrar cxc
  join public.movimientos m on m.id = cxc.movimiento_id
  where m.numero_documento = p_numero_factura
  limit 1;

  if v_cxc_id is null then
    raise exception 'No se encontró una cuenta por cobrar para la factura %', p_numero_factura;
  end if;

  if p_monto_pagado <= 0 then
    raise exception 'El monto pagado debe ser mayor a 0';
  end if;

  if p_monto_pagado > v_saldo_actual then
    raise exception 'El monto pagado (%) no puede ser mayor al saldo pendiente (%)', p_monto_pagado, v_saldo_actual;
  end if;

  v_nuevo_monto_pagado := v_monto_pagado_actual + p_monto_pagado;
  v_nuevo_saldo := v_saldo_actual - p_monto_pagado;

  if v_nuevo_saldo = 0 then
    v_nuevo_estado := 'pagado';
  elsif v_nuevo_monto_pagado > 0 then
    v_nuevo_estado := 'parcial';
  else
    v_nuevo_estado := 'pendiente';
  end if;

  update public.cuentas_por_cobrar
  set
    monto_pagado = v_nuevo_monto_pagado,
    saldo_pendiente = v_nuevo_saldo,
    estado = v_nuevo_estado
  where id = v_cxc_id;

  update public.movimientos
  set
    estado = case
      when v_nuevo_estado = 'pagado' then 'pagado'
      when v_nuevo_estado = 'parcial' then 'parcial'
      else 'pendiente'
    end
  where id = v_movimiento_id;
end;
$$;


ALTER FUNCTION "public"."registrar_pago_cxc"("p_numero_factura" "text", "p_monto_pagado" numeric, "p_fecha_pago" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "descripcion" "text",
    "activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "categorias_tipo_check" CHECK (("tipo" = ANY (ARRAY['ingreso'::"text", 'egreso'::"text"])))
);


ALTER TABLE "public"."categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."centros_costo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "codigo" "text",
    "descripcion" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."centros_costo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "rut" "text",
    "contacto" "text",
    "email" "text",
    "telefono" "text",
    "direccion" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cuentas_bancarias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "banco" "text" NOT NULL,
    "nombre_cuenta" "text" NOT NULL,
    "numero_cuenta" "text",
    "tipo_cuenta" "text",
    "moneda" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "saldo_inicial" numeric(18,2) DEFAULT 0 NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cuentas_bancarias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cuentas_contables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "acepta_movimientos" boolean DEFAULT true NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cuentas_contables_tipo_check" CHECK (("tipo" = ANY (ARRAY['activo'::"text", 'pasivo'::"text", 'patrimonio'::"text", 'ingreso'::"text", 'gasto'::"text"])))
);


ALTER TABLE "public"."cuentas_contables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cuentas_por_cobrar" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "movimiento_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "fecha_emision" "date" NOT NULL,
    "fecha_vencimiento" "date",
    "monto_total" numeric(18,2) DEFAULT 0 NOT NULL,
    "monto_pagado" numeric(18,2) DEFAULT 0 NOT NULL,
    "saldo_pendiente" numeric(18,2) DEFAULT 0 NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cuentas_por_cobrar_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'parcial'::"text", 'pagado'::"text", 'vencido'::"text"])))
);


ALTER TABLE "public"."cuentas_por_cobrar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cuentas_por_pagar" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "movimiento_id" "uuid" NOT NULL,
    "proveedor_id" "uuid",
    "fecha_emision" "date" NOT NULL,
    "fecha_vencimiento" "date",
    "monto_total" numeric(18,2) DEFAULT 0 NOT NULL,
    "monto_pagado" numeric(18,2) DEFAULT 0 NOT NULL,
    "saldo_pendiente" numeric(18,2) DEFAULT 0 NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cuentas_por_pagar_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'parcial'::"text", 'pagado'::"text", 'vencido'::"text"])))
);


ALTER TABLE "public"."cuentas_por_pagar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "movimiento_id" "uuid",
    "nombre_archivo" "text" NOT NULL,
    "ruta_storage" "text" NOT NULL,
    "tipo_archivo" "text",
    "tamano_bytes" bigint,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "razon_social" "text",
    "rut" "text",
    "giro" "text",
    "direccion" "text",
    "telefono" "text",
    "email" "text",
    "moneda" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."empresas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimientos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "tipo_movimiento" "text" NOT NULL,
    "fecha" "date" NOT NULL,
    "fecha_vencimiento" "date",
    "tercero_tipo" "text",
    "cliente_id" "uuid",
    "proveedor_id" "uuid",
    "categoria_id" "uuid",
    "centro_costo_id" "uuid",
    "cuenta_contable_id" "uuid",
    "cuenta_bancaria_id" "uuid",
    "tipo_documento" "text",
    "numero_documento" "text",
    "descripcion" "text" NOT NULL,
    "monto_neto" numeric(18,2) DEFAULT 0 NOT NULL,
    "monto_iva" numeric(18,2) DEFAULT 0 NOT NULL,
    "monto_exento" numeric(18,2) DEFAULT 0 NOT NULL,
    "monto_total" numeric(18,2) DEFAULT 0 NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "medio_pago" "text",
    "observaciones" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "impuesto_especifico" numeric(15,2) DEFAULT 0 NOT NULL,
    "tratamiento_tributario" "text" DEFAULT 'afecto_iva'::"text" NOT NULL,
    CONSTRAINT "movimientos_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'pagado'::"text", 'parcial'::"text", 'anulado'::"text"]))),
    CONSTRAINT "movimientos_medio_pago_check" CHECK (("medio_pago" = ANY (ARRAY['transferencia'::"text", 'efectivo'::"text", 'tarjeta'::"text", 'cheque'::"text", 'otro'::"text"]))),
    CONSTRAINT "movimientos_tercero_tipo_check" CHECK (("tercero_tipo" = ANY (ARRAY['cliente'::"text", 'proveedor'::"text", 'otro'::"text"]))),
    CONSTRAINT "movimientos_tipo_documento_check" CHECK (("tipo_documento" = ANY (ARRAY['factura'::"text", 'boleta'::"text", 'nota_credito'::"text", 'nota_debito'::"text", 'comprobante'::"text", 'otro'::"text"]))),
    CONSTRAINT "movimientos_tipo_movimiento_check" CHECK (("tipo_movimiento" = ANY (ARRAY['ingreso'::"text", 'egreso'::"text"])))
);


ALTER TABLE "public"."movimientos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "nombre_completo" "text" NOT NULL,
    "email" "text",
    "rol" "text" DEFAULT 'admin'::"text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "perfiles_rol_check" CHECK (("rol" = ANY (ARRAY['admin'::"text", 'contador'::"text", 'visualizador'::"text"])))
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proveedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "rut" "text",
    "contacto" "text",
    "email" "text",
    "telefono" "text",
    "direccion" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proveedores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."remuneraciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "trabajador_nombre" "text" NOT NULL,
    "cargo" "text",
    "periodo" "text" NOT NULL,
    "sueldo_base" numeric(14,2) DEFAULT 0 NOT NULL,
    "bonos" numeric(14,2) DEFAULT 0 NOT NULL,
    "descuentos" numeric(14,2) DEFAULT 0 NOT NULL,
    "liquido_pagar" numeric(14,2) DEFAULT 0 NOT NULL,
    "fecha_pago" "date",
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "cuenta_bancaria_id" "uuid",
    "observacion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gratificacion" numeric(14,2) DEFAULT 0 NOT NULL,
    "bono_colacion" numeric(14,2) DEFAULT 0 NOT NULL,
    "bono_movilizacion" numeric(14,2) DEFAULT 0 NOT NULL,
    "horas_extra" numeric(14,2) DEFAULT 0 NOT NULL,
    "otros_haberes_imponibles" numeric(14,2) DEFAULT 0 NOT NULL,
    "otros_haberes_no_imponibles" numeric(14,2) DEFAULT 0 NOT NULL,
    "afp" numeric(14,2) DEFAULT 0 NOT NULL,
    "salud" numeric(14,2) DEFAULT 0 NOT NULL,
    "afc" numeric(14,2) DEFAULT 0 NOT NULL,
    "anticipo" numeric(14,2) DEFAULT 0 NOT NULL,
    "otros_descuentos" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_imponible" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_no_imponible" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_descuentos" numeric(14,2) DEFAULT 0 NOT NULL,
    "movimiento_id" "uuid",
    CONSTRAINT "remuneraciones_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'pagado'::"text", 'anulada'::"text"])))
);


ALTER TABLE "public"."remuneraciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transferencias_bancarias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "fecha" "date" NOT NULL,
    "cuenta_origen_id" "uuid" NOT NULL,
    "cuenta_destino_id" "uuid" NOT NULL,
    "monto" numeric(14,2) DEFAULT 0 NOT NULL,
    "descripcion" "text",
    "estado" "text" DEFAULT 'aplicada'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transferencias_cuentas_distintas_check" CHECK (("cuenta_origen_id" <> "cuenta_destino_id")),
    CONSTRAINT "transferencias_estado_check" CHECK (("estado" = ANY (ARRAY['aplicada'::"text", 'anulada'::"text"]))),
    CONSTRAINT "transferencias_monto_check" CHECK (("monto" > (0)::numeric))
);


ALTER TABLE "public"."transferencias_bancarias" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_cobranza_pendiente" WITH ("security_invoker"='on') AS
 SELECT "cxc"."empresa_id",
    "cxc"."fecha_emision",
    "cxc"."fecha_vencimiento",
    "c"."nombre" AS "cliente",
    "m"."numero_documento" AS "numero_factura",
    "m"."descripcion",
    "cxc"."monto_total",
    "cxc"."saldo_pendiente",
    "cxc"."estado",
    ('$'::"text" || "to_char"("cxc"."monto_total", 'FM999G999G999G990'::"text")) AS "monto_total_clp",
    ('$'::"text" || "to_char"("cxc"."saldo_pendiente", 'FM999G999G999G990'::"text")) AS "saldo_pendiente_clp"
   FROM (("public"."cuentas_por_cobrar" "cxc"
     JOIN "public"."movimientos" "m" ON (("m"."id" = "cxc"."movimiento_id")))
     LEFT JOIN "public"."clientes" "c" ON (("c"."id" = "cxc"."cliente_id")))
  WHERE ("cxc"."estado" = ANY (ARRAY['pendiente'::"text", 'parcial'::"text", 'vencido'::"text"]))
  ORDER BY "cxc"."fecha_vencimiento", "cxc"."fecha_emision";


ALTER VIEW "public"."v_cobranza_pendiente" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_libro_bancos" WITH ("security_invoker"='on') AS
 SELECT "m"."fecha",
    "cb"."banco",
    "cb"."nombre_cuenta",
    "m"."tipo_movimiento",
    "m"."tipo_documento",
    "m"."numero_documento",
    "m"."descripcion",
        CASE
            WHEN (("m"."tipo_movimiento" = 'ingreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END AS "ingreso",
        CASE
            WHEN (("m"."tipo_movimiento" = 'egreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END AS "egreso",
    "m"."estado",
    ('$'::"text" || "to_char"(
        CASE
            WHEN (("m"."tipo_movimiento" = 'ingreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END, 'FM999G999G999G990'::"text")) AS "ingreso_clp",
    ('$'::"text" || "to_char"(
        CASE
            WHEN (("m"."tipo_movimiento" = 'egreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END, 'FM999G999G999G990'::"text")) AS "egreso_clp"
   FROM ("public"."movimientos" "m"
     JOIN "public"."cuentas_bancarias" "cb" ON (("cb"."id" = "m"."cuenta_bancaria_id")))
  WHERE ("m"."estado" = 'pagado'::"text")
  ORDER BY "m"."fecha", "cb"."banco", "cb"."nombre_cuenta", "m"."created_at";


ALTER VIEW "public"."v_libro_bancos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_movimientos_mensuales" WITH ("security_invoker"='on') AS
 SELECT (EXTRACT(year FROM "fecha"))::integer AS "anio",
    (EXTRACT(month FROM "fecha"))::integer AS "mes",
    "tipo_movimiento",
    "sum"("monto_total") AS "total"
   FROM "public"."movimientos"
  GROUP BY (EXTRACT(year FROM "fecha")), (EXTRACT(month FROM "fecha")), "tipo_movimiento"
  ORDER BY ((EXTRACT(year FROM "fecha"))::integer) DESC, ((EXTRACT(month FROM "fecha"))::integer) DESC, "tipo_movimiento";


ALTER VIEW "public"."v_movimientos_mensuales" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_movimientos_mensuales_formateado" WITH ("security_invoker"='on') AS
 SELECT "anio",
    "mes",
    "tipo_movimiento",
    "total",
    ('$'::"text" || "to_char"("total", 'FM999G999G999G990D00'::"text")) AS "total_clp"
   FROM "public"."v_movimientos_mensuales"
  ORDER BY "anio" DESC, "mes" DESC, "tipo_movimiento";


ALTER VIEW "public"."v_movimientos_mensuales_formateado" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_resultado_mensual" WITH ("security_invoker"='on') AS
 WITH "base" AS (
         SELECT (EXTRACT(year FROM "movimientos"."fecha"))::integer AS "anio",
            (EXTRACT(month FROM "movimientos"."fecha"))::integer AS "mes",
            "sum"(
                CASE
                    WHEN ("movimientos"."tipo_movimiento" = 'ingreso'::"text") THEN "movimientos"."monto_total"
                    ELSE (0)::numeric
                END) AS "ingresos",
            "sum"(
                CASE
                    WHEN ("movimientos"."tipo_movimiento" = 'egreso'::"text") THEN "movimientos"."monto_total"
                    ELSE (0)::numeric
                END) AS "egresos"
           FROM "public"."movimientos"
          GROUP BY (EXTRACT(year FROM "movimientos"."fecha")), (EXTRACT(month FROM "movimientos"."fecha"))
        )
 SELECT "anio",
    "mes",
    "ingresos",
    "egresos",
    ("ingresos" - "egresos") AS "resultado",
    ('$'::"text" || "to_char"("ingresos", 'FM999G999G999G990'::"text")) AS "ingresos_clp",
    ('$'::"text" || "to_char"("egresos", 'FM999G999G999G990'::"text")) AS "egresos_clp",
    ('$'::"text" || "to_char"(("ingresos" - "egresos"), 'FM999G999G999G990'::"text")) AS "resultado_clp"
   FROM "base"
  ORDER BY "anio" DESC, "mes" DESC;


ALTER VIEW "public"."v_resultado_mensual" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_resumen_financiero" WITH ("security_invoker"='on') AS
 SELECT COALESCE(( SELECT "sum"("cb"."saldo_inicial") AS "sum"
           FROM "public"."cuentas_bancarias" "cb"
          WHERE ("cb"."activa" = true)), (0)::numeric) AS "saldo_total_bancos",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."cuentas_bancarias" "cb"
          WHERE ("cb"."activa" = true)), (0)::bigint) AS "cuentas_bancarias_activas",
    COALESCE(( SELECT "sum"("cxc"."saldo_pendiente") AS "sum"
           FROM "public"."cuentas_por_cobrar" "cxc"
          WHERE ("cxc"."estado" = ANY (ARRAY['pendiente'::"text", 'parcial'::"text", 'vencido'::"text"]))), (0)::numeric) AS "total_cuentas_por_cobrar",
    COALESCE(( SELECT "sum"("cxp"."saldo_pendiente") AS "sum"
           FROM "public"."cuentas_por_pagar" "cxp"
          WHERE ("cxp"."estado" = ANY (ARRAY['pendiente'::"text", 'parcial'::"text", 'vencido'::"text"]))), (0)::numeric) AS "total_cuentas_por_pagar";


ALTER VIEW "public"."v_resumen_financiero" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_resumen_operativo" WITH ("security_invoker"='on') AS
 SELECT COALESCE(( SELECT "sum"("cb"."saldo_inicial") AS "sum"
           FROM "public"."cuentas_bancarias" "cb"
          WHERE ("cb"."activa" = true)), (0)::numeric) AS "saldo_total_bancos",
    COALESCE(( SELECT "sum"("cxc"."saldo_pendiente") AS "sum"
           FROM "public"."cuentas_por_cobrar" "cxc"
          WHERE ("cxc"."estado" = ANY (ARRAY['pendiente'::"text", 'parcial'::"text", 'vencido'::"text"]))), (0)::numeric) AS "total_por_cobrar",
    COALESCE(( SELECT "sum"("m"."monto_total") AS "sum"
           FROM "public"."movimientos" "m"
          WHERE (("m"."tipo_movimiento" = 'ingreso'::"text") AND ("date_trunc"('month'::"text", ("m"."fecha")::timestamp with time zone) = "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone)))), (0)::numeric) AS "ingresos_mes",
    COALESCE(( SELECT "sum"("m"."monto_total") AS "sum"
           FROM "public"."movimientos" "m"
          WHERE (("m"."tipo_movimiento" = 'egreso'::"text") AND ("date_trunc"('month'::"text", ("m"."fecha")::timestamp with time zone) = "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone)))), (0)::numeric) AS "egresos_mes";


ALTER VIEW "public"."v_resumen_operativo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_resumen_operativo_formateado" WITH ("security_invoker"='on') AS
 SELECT "saldo_total_bancos",
    "total_por_cobrar",
    "ingresos_mes",
    "egresos_mes",
    ('$'::"text" || "to_char"("saldo_total_bancos", 'FM999G999G999G990D00'::"text")) AS "saldo_total_bancos_clp",
    ('$'::"text" || "to_char"("total_por_cobrar", 'FM999G999G999G990D00'::"text")) AS "total_por_cobrar_clp",
    ('$'::"text" || "to_char"("ingresos_mes", 'FM999G999G999G990D00'::"text")) AS "ingresos_mes_clp",
    ('$'::"text" || "to_char"("egresos_mes", 'FM999G999G999G990D00'::"text")) AS "egresos_mes_clp"
   FROM "public"."v_resumen_operativo";


ALTER VIEW "public"."v_resumen_operativo_formateado" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_saldos_bancarios" WITH ("security_invoker"='on') AS
 SELECT "cb"."empresa_id",
    "cb"."id",
    "cb"."banco",
    "cb"."nombre_cuenta",
    "cb"."tipo_cuenta",
    "cb"."moneda",
    "cb"."saldo_inicial",
    COALESCE("sum"(
        CASE
            WHEN (("m"."tipo_movimiento" = 'ingreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric) AS "ingresos_pagados",
    COALESCE("sum"(
        CASE
            WHEN (("m"."tipo_movimiento" = 'egreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric) AS "egresos_pagados",
    (("cb"."saldo_inicial" + COALESCE("sum"(
        CASE
            WHEN (("m"."tipo_movimiento" = 'ingreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric)) - COALESCE("sum"(
        CASE
            WHEN (("m"."tipo_movimiento" = 'egreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric)) AS "saldo_calculado",
    ('$'::"text" || "to_char"("cb"."saldo_inicial", 'FM999G999G999G990'::"text")) AS "saldo_inicial_clp",
    ('$'::"text" || "to_char"(COALESCE("sum"(
        CASE
            WHEN (("m"."tipo_movimiento" = 'ingreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric), 'FM999G999G999G990'::"text")) AS "ingresos_pagados_clp",
    ('$'::"text" || "to_char"(COALESCE("sum"(
        CASE
            WHEN (("m"."tipo_movimiento" = 'egreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric), 'FM999G999G999G990'::"text")) AS "egresos_pagados_clp",
    ('$'::"text" || "to_char"((("cb"."saldo_inicial" + COALESCE("sum"(
        CASE
            WHEN (("m"."tipo_movimiento" = 'ingreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric)) - COALESCE("sum"(
        CASE
            WHEN (("m"."tipo_movimiento" = 'egreso'::"text") AND ("m"."estado" = 'pagado'::"text")) THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric)), 'FM999G999G999G990'::"text")) AS "saldo_calculado_clp"
   FROM ("public"."cuentas_bancarias" "cb"
     LEFT JOIN "public"."movimientos" "m" ON (("m"."cuenta_bancaria_id" = "cb"."id")))
  GROUP BY "cb"."empresa_id", "cb"."id", "cb"."banco", "cb"."nombre_cuenta", "cb"."tipo_cuenta", "cb"."moneda", "cb"."saldo_inicial"
  ORDER BY "cb"."banco", "cb"."nombre_cuenta";


ALTER VIEW "public"."v_saldos_bancarios" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_ventas_por_cliente" WITH ("security_invoker"='on') AS
 SELECT "c"."nombre" AS "cliente",
    "count"("m"."id") AS "cantidad_documentos",
    COALESCE("sum"("m"."monto_total"), (0)::numeric) AS "total_vendido",
    COALESCE("sum"(
        CASE
            WHEN ("m"."estado" = 'pagado'::"text") THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_pagado",
    COALESCE("sum"(
        CASE
            WHEN ("m"."estado" = ANY (ARRAY['pendiente'::"text", 'parcial'::"text"])) THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_pendiente",
    ('$'::"text" || "to_char"(COALESCE("sum"("m"."monto_total"), (0)::numeric), 'FM999G999G999G990'::"text")) AS "total_vendido_clp",
    ('$'::"text" || "to_char"(COALESCE("sum"(
        CASE
            WHEN ("m"."estado" = 'pagado'::"text") THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric), 'FM999G999G999G990'::"text")) AS "total_pagado_clp",
    ('$'::"text" || "to_char"(COALESCE("sum"(
        CASE
            WHEN ("m"."estado" = ANY (ARRAY['pendiente'::"text", 'parcial'::"text"])) THEN "m"."monto_total"
            ELSE (0)::numeric
        END), (0)::numeric), 'FM999G999G999G990'::"text")) AS "total_pendiente_clp"
   FROM ("public"."movimientos" "m"
     JOIN "public"."clientes" "c" ON (("c"."id" = "m"."cliente_id")))
  WHERE ("m"."tipo_movimiento" = 'ingreso'::"text")
  GROUP BY "c"."nombre"
  ORDER BY COALESCE("sum"("m"."monto_total"), (0)::numeric) DESC;


ALTER VIEW "public"."v_ventas_por_cliente" OWNER TO "postgres";


ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_empresa_id_nombre_tipo_key" UNIQUE ("empresa_id", "nombre", "tipo");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centros_costo"
    ADD CONSTRAINT "centros_costo_empresa_id_nombre_key" UNIQUE ("empresa_id", "nombre");



ALTER TABLE ONLY "public"."centros_costo"
    ADD CONSTRAINT "centros_costo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuentas_bancarias"
    ADD CONSTRAINT "cuentas_bancarias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuentas_contables"
    ADD CONSTRAINT "cuentas_contables_empresa_id_codigo_key" UNIQUE ("empresa_id", "codigo");



ALTER TABLE ONLY "public"."cuentas_contables"
    ADD CONSTRAINT "cuentas_contables_empresa_id_nombre_key" UNIQUE ("empresa_id", "nombre");



ALTER TABLE ONLY "public"."cuentas_contables"
    ADD CONSTRAINT "cuentas_contables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuentas_por_cobrar"
    ADD CONSTRAINT "cuentas_por_cobrar_movimiento_id_key" UNIQUE ("movimiento_id");



ALTER TABLE ONLY "public"."cuentas_por_cobrar"
    ADD CONSTRAINT "cuentas_por_cobrar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuentas_por_pagar"
    ADD CONSTRAINT "cuentas_por_pagar_movimiento_id_key" UNIQUE ("movimiento_id");



ALTER TABLE ONLY "public"."cuentas_por_pagar"
    ADD CONSTRAINT "cuentas_por_pagar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentos"
    ADD CONSTRAINT "documentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proveedores"
    ADD CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."remuneraciones"
    ADD CONSTRAINT "remuneraciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transferencias_bancarias"
    ADD CONSTRAINT "transferencias_bancarias_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_categorias_empresa_id" ON "public"."categorias" USING "btree" ("empresa_id");



CREATE INDEX "idx_centros_costo_empresa_id" ON "public"."centros_costo" USING "btree" ("empresa_id");



CREATE INDEX "idx_clientes_empresa_id" ON "public"."clientes" USING "btree" ("empresa_id");



CREATE INDEX "idx_cuentas_bancarias_empresa_id" ON "public"."cuentas_bancarias" USING "btree" ("empresa_id");



CREATE INDEX "idx_cuentas_contables_empresa_id" ON "public"."cuentas_contables" USING "btree" ("empresa_id");



CREATE INDEX "idx_cxc_empresa_id" ON "public"."cuentas_por_cobrar" USING "btree" ("empresa_id");



CREATE INDEX "idx_cxp_empresa_id" ON "public"."cuentas_por_pagar" USING "btree" ("empresa_id");



CREATE INDEX "idx_documentos_empresa_id" ON "public"."documentos" USING "btree" ("empresa_id");



CREATE INDEX "idx_movimientos_empresa_id" ON "public"."movimientos" USING "btree" ("empresa_id");



CREATE INDEX "idx_movimientos_fecha" ON "public"."movimientos" USING "btree" ("fecha");



CREATE INDEX "idx_movimientos_tipo" ON "public"."movimientos" USING "btree" ("tipo_movimiento");



CREATE INDEX "idx_proveedores_empresa_id" ON "public"."proveedores" USING "btree" ("empresa_id");



CREATE INDEX "idx_remuneraciones_empresa_periodo" ON "public"."remuneraciones" USING "btree" ("empresa_id", "periodo");



CREATE OR REPLACE TRIGGER "trg_categorias_updated_at" BEFORE UPDATE ON "public"."categorias" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_centros_costo_updated_at" BEFORE UPDATE ON "public"."centros_costo" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_clientes_updated_at" BEFORE UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_crear_cxc_desde_movimiento" AFTER INSERT ON "public"."movimientos" FOR EACH ROW EXECUTE FUNCTION "public"."crear_cxc_desde_movimiento"();



CREATE OR REPLACE TRIGGER "trg_crear_cxp_desde_movimiento" AFTER INSERT ON "public"."movimientos" FOR EACH ROW EXECUTE FUNCTION "public"."crear_cxp_desde_movimiento"();



CREATE OR REPLACE TRIGGER "trg_cuentas_bancarias_updated_at" BEFORE UPDATE ON "public"."cuentas_bancarias" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cuentas_contables_updated_at" BEFORE UPDATE ON "public"."cuentas_contables" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cxc_updated_at" BEFORE UPDATE ON "public"."cuentas_por_cobrar" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cxp_updated_at" BEFORE UPDATE ON "public"."cuentas_por_pagar" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_empresas_updated_at" BEFORE UPDATE ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_movimientos_updated_at" BEFORE UPDATE ON "public"."movimientos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_perfiles_updated_at" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_proveedores_updated_at" BEFORE UPDATE ON "public"."proveedores" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_transferencias_bancarias_updated_at" BEFORE UPDATE ON "public"."transferencias_bancarias" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."centros_costo"
    ADD CONSTRAINT "centros_costo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas_bancarias"
    ADD CONSTRAINT "cuentas_bancarias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas_contables"
    ADD CONSTRAINT "cuentas_contables_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas_por_cobrar"
    ADD CONSTRAINT "cuentas_por_cobrar_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cuentas_por_cobrar"
    ADD CONSTRAINT "cuentas_por_cobrar_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas_por_cobrar"
    ADD CONSTRAINT "cuentas_por_cobrar_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas_por_pagar"
    ADD CONSTRAINT "cuentas_por_pagar_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas_por_pagar"
    ADD CONSTRAINT "cuentas_por_pagar_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas_por_pagar"
    ADD CONSTRAINT "cuentas_por_pagar_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documentos"
    ADD CONSTRAINT "documentos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documentos"
    ADD CONSTRAINT "documentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentos"
    ADD CONSTRAINT "documentos_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_centro_costo_id_fkey" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_cuenta_bancaria_id_fkey" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_cuenta_contable_id_fkey" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."cuentas_contables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proveedores"
    ADD CONSTRAINT "proveedores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."remuneraciones"
    ADD CONSTRAINT "remuneraciones_cuenta_bancaria_id_fkey" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."remuneraciones"
    ADD CONSTRAINT "remuneraciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."remuneraciones"
    ADD CONSTRAINT "remuneraciones_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transferencias_bancarias"
    ADD CONSTRAINT "transferencias_bancarias_cuenta_destino_id_fkey" FOREIGN KEY ("cuenta_destino_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transferencias_bancarias"
    ADD CONSTRAINT "transferencias_bancarias_cuenta_origen_id_fkey" FOREIGN KEY ("cuenta_origen_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transferencias_bancarias"
    ADD CONSTRAINT "transferencias_bancarias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categorias_admin_all" ON "public"."categorias" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



ALTER TABLE "public"."centros_costo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "centros_costo_admin_all" ON "public"."centros_costo" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_admin_all" ON "public"."clientes" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



ALTER TABLE "public"."cuentas_bancarias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cuentas_bancarias_admin_all" ON "public"."cuentas_bancarias" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



ALTER TABLE "public"."cuentas_contables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cuentas_contables_admin_all" ON "public"."cuentas_contables" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



ALTER TABLE "public"."cuentas_por_cobrar" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cuentas_por_pagar" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cxc_admin_all" ON "public"."cuentas_por_cobrar" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



CREATE POLICY "cxp_admin_all" ON "public"."cuentas_por_pagar" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



ALTER TABLE "public"."documentos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documentos_admin_all" ON "public"."documentos" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



ALTER TABLE "public"."empresas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empresas_admin_all" ON "public"."empresas" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



ALTER TABLE "public"."movimientos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "movimientos_admin_all" ON "public"."movimientos" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfiles_admin_all" ON "public"."perfiles" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



CREATE POLICY "perfiles_self_select" ON "public"."perfiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "perfiles_self_update" ON "public"."perfiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."proveedores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proveedores_admin_all" ON "public"."proveedores" TO "authenticated" USING ("public"."es_admin_activo"()) WITH CHECK ("public"."es_admin_activo"());



ALTER TABLE "public"."remuneraciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "remuneraciones_delete" ON "public"."remuneraciones" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "remuneraciones_insert" ON "public"."remuneraciones" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "remuneraciones_select" ON "public"."remuneraciones" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "remuneraciones_update" ON "public"."remuneraciones" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."transferencias_bancarias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transferencias_delete" ON "public"."transferencias_bancarias" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "transferencias_insert" ON "public"."transferencias_bancarias" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "transferencias_select" ON "public"."transferencias_bancarias" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "transferencias_update" ON "public"."transferencias_bancarias" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."crear_cxc_desde_movimiento"() TO "anon";
GRANT ALL ON FUNCTION "public"."crear_cxc_desde_movimiento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_cxc_desde_movimiento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_cxp_desde_movimiento"() TO "anon";
GRANT ALL ON FUNCTION "public"."crear_cxp_desde_movimiento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_cxp_desde_movimiento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."es_admin_activo"() TO "anon";
GRANT ALL ON FUNCTION "public"."es_admin_activo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_admin_activo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_pago_cxc"("p_numero_factura" "text", "p_monto_pagado" numeric, "p_fecha_pago" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_pago_cxc"("p_numero_factura" "text", "p_monto_pagado" numeric, "p_fecha_pago" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_pago_cxc"("p_numero_factura" "text", "p_monto_pagado" numeric, "p_fecha_pago" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."categorias" TO "anon";
GRANT ALL ON TABLE "public"."categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias" TO "service_role";



GRANT ALL ON TABLE "public"."centros_costo" TO "anon";
GRANT ALL ON TABLE "public"."centros_costo" TO "authenticated";
GRANT ALL ON TABLE "public"."centros_costo" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON TABLE "public"."cuentas_bancarias" TO "anon";
GRANT ALL ON TABLE "public"."cuentas_bancarias" TO "authenticated";
GRANT ALL ON TABLE "public"."cuentas_bancarias" TO "service_role";



GRANT ALL ON TABLE "public"."cuentas_contables" TO "anon";
GRANT ALL ON TABLE "public"."cuentas_contables" TO "authenticated";
GRANT ALL ON TABLE "public"."cuentas_contables" TO "service_role";



GRANT ALL ON TABLE "public"."cuentas_por_cobrar" TO "anon";
GRANT ALL ON TABLE "public"."cuentas_por_cobrar" TO "authenticated";
GRANT ALL ON TABLE "public"."cuentas_por_cobrar" TO "service_role";



GRANT ALL ON TABLE "public"."cuentas_por_pagar" TO "anon";
GRANT ALL ON TABLE "public"."cuentas_por_pagar" TO "authenticated";
GRANT ALL ON TABLE "public"."cuentas_por_pagar" TO "service_role";



GRANT ALL ON TABLE "public"."documentos" TO "anon";
GRANT ALL ON TABLE "public"."documentos" TO "authenticated";
GRANT ALL ON TABLE "public"."documentos" TO "service_role";



GRANT ALL ON TABLE "public"."empresas" TO "anon";
GRANT ALL ON TABLE "public"."empresas" TO "authenticated";
GRANT ALL ON TABLE "public"."empresas" TO "service_role";



GRANT ALL ON TABLE "public"."movimientos" TO "anon";
GRANT ALL ON TABLE "public"."movimientos" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos" TO "service_role";



GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."proveedores" TO "anon";
GRANT ALL ON TABLE "public"."proveedores" TO "authenticated";
GRANT ALL ON TABLE "public"."proveedores" TO "service_role";



GRANT ALL ON TABLE "public"."remuneraciones" TO "anon";
GRANT ALL ON TABLE "public"."remuneraciones" TO "authenticated";
GRANT ALL ON TABLE "public"."remuneraciones" TO "service_role";



GRANT ALL ON TABLE "public"."transferencias_bancarias" TO "anon";
GRANT ALL ON TABLE "public"."transferencias_bancarias" TO "authenticated";
GRANT ALL ON TABLE "public"."transferencias_bancarias" TO "service_role";



GRANT ALL ON TABLE "public"."v_cobranza_pendiente" TO "anon";
GRANT ALL ON TABLE "public"."v_cobranza_pendiente" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cobranza_pendiente" TO "service_role";



GRANT ALL ON TABLE "public"."v_libro_bancos" TO "anon";
GRANT ALL ON TABLE "public"."v_libro_bancos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_libro_bancos" TO "service_role";



GRANT ALL ON TABLE "public"."v_movimientos_mensuales" TO "anon";
GRANT ALL ON TABLE "public"."v_movimientos_mensuales" TO "authenticated";
GRANT ALL ON TABLE "public"."v_movimientos_mensuales" TO "service_role";



GRANT ALL ON TABLE "public"."v_movimientos_mensuales_formateado" TO "anon";
GRANT ALL ON TABLE "public"."v_movimientos_mensuales_formateado" TO "authenticated";
GRANT ALL ON TABLE "public"."v_movimientos_mensuales_formateado" TO "service_role";



GRANT ALL ON TABLE "public"."v_resultado_mensual" TO "anon";
GRANT ALL ON TABLE "public"."v_resultado_mensual" TO "authenticated";
GRANT ALL ON TABLE "public"."v_resultado_mensual" TO "service_role";



GRANT ALL ON TABLE "public"."v_resumen_financiero" TO "anon";
GRANT ALL ON TABLE "public"."v_resumen_financiero" TO "authenticated";
GRANT ALL ON TABLE "public"."v_resumen_financiero" TO "service_role";



GRANT ALL ON TABLE "public"."v_resumen_operativo" TO "anon";
GRANT ALL ON TABLE "public"."v_resumen_operativo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_resumen_operativo" TO "service_role";



GRANT ALL ON TABLE "public"."v_resumen_operativo_formateado" TO "anon";
GRANT ALL ON TABLE "public"."v_resumen_operativo_formateado" TO "authenticated";
GRANT ALL ON TABLE "public"."v_resumen_operativo_formateado" TO "service_role";



GRANT ALL ON TABLE "public"."v_saldos_bancarios" TO "anon";
GRANT ALL ON TABLE "public"."v_saldos_bancarios" TO "authenticated";
GRANT ALL ON TABLE "public"."v_saldos_bancarios" TO "service_role";



GRANT ALL ON TABLE "public"."v_ventas_por_cliente" TO "anon";
GRANT ALL ON TABLE "public"."v_ventas_por_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ventas_por_cliente" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































