import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { OTPdfDocument } from "../../../../components/ot/ot-pdf-document";
import type { OTResumen } from "../../../../lib/ot/types";
import React from "react";
import { existsSync } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OTDetalle = {
  id: string;
  folio: string | null;
  empresa_id: string;
  cliente_id: string;
  ubicacion_id: string | null;
  activo_id: string | null;
  cotizacion_id: string | null;
  tipo_servicio_id: string;
  estado_id: string;
  fecha_ot: string;
  fecha_programada: string | null;
  fecha_cierre: string | null;
  titulo: string;
  descripcion_solicitud: string | null;
  problema_reportado: string | null;
  numero_om_cliente: string | null;
  cantidad_tecnicos: number | null;
  horas_hombre_utilizadas: number | null;
  responsable_cliente_rut: string | null;
  supervisor_contratista_nombre: string | null;
  supervisor_contratista_rut: string | null;
  supervisor_contratista_cargo: string | null;
  herramientas_materiales_utilizados: string | null;
  recomendaciones_seguridad: string | null;
  seguridad_permiso_trabajo: boolean;
  seguridad_uso_epp: boolean;
  seguridad_bloqueo_tarjeta: boolean;
  seguridad_observacion: string | null;
  seguridad_validada_at: string | null;
  seguridad_validada_by: string | null;
  alcance_trabajo_ejecutado: boolean | null;
  alcance_trabajo_observacion: string | null;
  ejecutado_segun_programa: boolean | null;
  ejecutado_segun_programa_observacion: string | null;
  diagnostico: string | null;
  causa_probable: string | null;
  trabajo_realizado: string | null;
  recomendaciones: string | null;
  tecnico_responsable_id: string | null;
  supervisor_id: string | null;
  prioridad: "baja" | "media" | "alta" | "critica";
  requiere_checklist: boolean;
  plantilla_checklist_id: string | null;
  hora_inicio: string | null;
  hora_termino: string | null;
  duracion_minutos: number | null;
  cliente_nombre_firma: string | null;
  cliente_cargo_firma: string | null;
  observaciones_cierre: string | null;
  mostrar_firma_cliente: boolean;
  mostrar_firma_tecnico: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contacto_cliente_nombre: string | null;
  contacto_cliente_cargo: string | null;
  area_trabajo: string | null;
  resultado_servicio: string | null;
  hallazgos: string | null;
  conclusiones_tecnicas: string | null;
  mostrar_nota_valor_hora: boolean;
  valor_hora_uf: number | null;
};

type Evidencia = {
  id: string;
  ot_id: string;
  tipo: "antes" | "durante" | "despues" | "documento" | "otro";
  archivo_url: string;
  archivo_nombre: string | null;
  descripcion: string | null;
  orden: number;
  created_at: string;
};

type Firma = {
  id: string;
  ot_id: string;
  tipo_firma: "tecnico" | "cliente" | "supervisor";
  nombre_firmante: string | null;
  cargo_firmante: string | null;
  firma_url: string;
  fecha_firma: string;
  created_at: string;
};

type PerfilMini = {
  id: string;
  email: string | null;
};

type TipoServicioOption = {
  id: string;
  codigo: string;
  nombre: string;
  estructura_ot_codigo?: string | null;
  requiere_checklist?: boolean | null;
  usa_equipos_multiples?: boolean | null;
  usa_checklist_por_equipo?: boolean | null;
  tipo_equipo_permitido?: string | null;
};

type InformeTecnicoMini = {
  id: string;
  datos: Record<string, any> | null;
};

const CHILE_TIME_ZONE = "America/Santiago";
const DYF_EMPRESA_ID = "73dd5543-2bf7-4d44-9982-4a641c8658f5";
const RMSIC_EMPRESA_ID = "557a054c-71ef-4c5f-8637-594755ad669b";


const pickPublicLogoUrl = (request: NextRequest, candidates: string[]) => {
  for (const candidate of candidates) {
    const relativePath = candidate.startsWith("/") ? candidate.slice(1) : candidate;
    const absolutePath = path.join(process.cwd(), "public", relativePath);
    if (existsSync(absolutePath)) {
      return new URL(candidate, request.url).toString();
    }
  }

  return null;
};

const DYF_LOGO_CANDIDATES = [
  "/logos/dyf-logo-transparente.png",
  "/logos/dyf-logo.png",
  "/logos/logo-dyf.png",
];

const RMSIC_LOGO_CANDIDATES = ["/logos/rmsic-logo.png"];

type DateTimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function getChileDateTimeParts(
  value: string | null | undefined,
): DateTimeParts | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHILE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = formatter
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  if (
    !parts.year ||
    !parts.month ||
    !parts.day ||
    !parts.hour ||
    !parts.minute
  ) {
    return null;
  }

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour.padStart(2, "0"),
    minute: parts.minute.padStart(2, "0"),
    second: (parts.second || "00").padStart(2, "0"),
  };
}

function isDateOnly(value: string | null | undefined) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function toChileDate(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();

  // Las fechas puras de Supabase, por ejemplo 2026-05-17, no deben pasar
  // por new Date(), porque JS las interpreta como medianoche UTC y en Chile
  // pueden retroceder al dÃ­a anterior.
  if (isDateOnly(trimmed)) {
    return trimmed.slice(0, 10);
  }

  const parts = getChileDateTimeParts(trimmed);
  if (!parts) return null;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toChileFloatingDateTime(value: string | null | undefined) {
  const parts = getChileDateTimeParts(value);
  if (!parts) return null;

  // Importante: devolvemos fecha/hora local de Chile SIN sufijo Z ni offset.
  // El componente PDF vuelve a formatear con new Date(). En Vercel el servidor
  // corre en UTC; si le pasamos el timestamptz original, muestra +4 horas.
  // Al pasar un datetime "flotante" como 2026-05-11T21:15:00, tanto local
  // como Vercel muestran la hora real del servicio.
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function toChileTimeOnly(value: string | null | undefined) {
  const parts = getChileDateTimeParts(value);
  if (!parts) return null;
  return `${parts.hour}:${parts.minute}`;
}

function toPdfTimeOnly(value: string | null | undefined) {
  if (!value) return null;

  // Si ya viene como fecha/hora flotante local, por ejemplo 2026-07-01T20:00:00,
  // no lo volvemos a convertir a zona horaria para evitar desfases en Vercel.
  const floatingMatch = String(value).trim().match(/T(\d{2}):(\d{2})/);
  if (floatingMatch) return `${floatingMatch[1]}:${floatingMatch[2]}`;

  return toChileTimeOnly(value);
}

type TiempoTrabajo = {
  id: string;
  ot_id: string;
  usuario_id: string;
  fecha: string;
  hora_inicio: string | null;
  hora_termino: string | null;
  duracion_minutos: number | null;
  tipo_tiempo: "trabajo" | "traslado" | "espera" | "supervision";
  observacion: string | null;
  created_at: string;
  updated_at: string;
};

type EquipoAsociadoPdf = {
  id: string;
  equipo_id: string;
  orden: number | null;
  descripcion_trabajo: string | null;
  observacion: string | null;
  tag: string | null;
  nombre: string | null;
  descripcion: string | null;
  tipo_equipo: string | null;
  planta: string | null;
  area: string | null;
  linea: string | null;
  ubicacion: string | null;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  potencia: string | null;
  criticidad: string | null;
};

type EquipoChecklistPdf = {
  id: string;
  ot_orden_equipo_id: string;
  equipo_id: string;
  plantilla_item_id: string;
  respuesta_texto: string | null;
  observacion_antes: string | null;
  observacion_despues: string | null;
  accion_realizada: string | null;
  recomendacion_tecnica: string | null;
  evidencia_antes_url: string | null;
  evidencia_despues_url: string | null;
  item_zona: string | null;
  item_categoria: string | null;
  item_actividad: string | null;
  item_orden: number | null;
};

function toValidTime(value: string | null | undefined) {
  if (!value) return null;

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function obtenerHorarioDesdeTiempos(tiempos: TiempoTrabajo[]) {
  const activosConHoras = tiempos.filter(
    (item) =>
      toValidTime(item.hora_inicio) !== null ||
      toValidTime(item.hora_termino) !== null,
  );

  if (activosConHoras.length === 0) return null;

  // Para el encabezado del informe, priorizamos los bloques de trabajo.
  // Si no existen, usamos cualquier bloque de tiempo registrado en la OT.
  const base = activosConHoras.some((item) => item.tipo_tiempo === "trabajo")
    ? activosConHoras.filter((item) => item.tipo_tiempo === "trabajo")
    : activosConHoras;

  const inicio = base.reduce<TiempoTrabajo | null>((selected, current) => {
    const currentTime = toValidTime(current.hora_inicio);
    if (currentTime === null) return selected;

    if (!selected) return current;

    const selectedTime = toValidTime(selected.hora_inicio);
    return selectedTime === null || currentTime < selectedTime
      ? current
      : selected;
  }, null);

  const termino = base.reduce<TiempoTrabajo | null>((selected, current) => {
    const currentTime = toValidTime(current.hora_termino);
    if (currentTime === null) return selected;

    if (!selected) return current;

    const selectedTime = toValidTime(selected.hora_termino);
    return selectedTime === null || currentTime > selectedTime
      ? current
      : selected;
  }, null);

  const duracionTotal = base.reduce((total, item) => {
    if (typeof item.duracion_minutos === "number") {
      return total + item.duracion_minutos;
    }

    const inicioMs = toValidTime(item.hora_inicio);
    const terminoMs = toValidTime(item.hora_termino);

    if (inicioMs === null || terminoMs === null || terminoMs < inicioMs) {
      return total;
    }

    return total + Math.round((terminoMs - inicioMs) / 60000);
  }, 0);

  return {
    fecha_ot: toChileDate(inicio?.hora_inicio || inicio?.fecha || null),
    hora_inicio: toChileFloatingDateTime(inicio?.hora_inicio || null),
    hora_termino: toChileFloatingDateTime(termino?.hora_termino || null),
    duracion_minutos: duracionTotal > 0 ? duracionTotal : null,
  };
}

function equipoPdfNombre(equipo: EquipoAsociadoPdf) {
  return (
    [equipo.tag, equipo.nombre || equipo.descripcion]
      .filter(Boolean)
      .join(" - ") || equipo.equipo_id
  );
}

function equipoPdfUbicacion(equipo: EquipoAsociadoPdf) {
  return (
    [equipo.planta, equipo.area, equipo.linea, equipo.ubicacion]
      .filter(Boolean)
      .join(" / ") || "-"
  );
}

function equipoPdfCaracteristicas(equipo: EquipoAsociadoPdf) {
  return (
    [equipo.tipo_equipo, equipo.marca, equipo.modelo, equipo.potencia]
      .filter(Boolean)
      .join(" / ") || "-"
  );
}

function estadoEquipoPdf(value: string | null) {
  if (value === "ok") return "OK";
  if (value === "no_ok") return "No OK";
  if (value === "na") return "N/A";
  return "Pendiente";
}

function jsonError(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function cleanText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function hasText(value: string | null | undefined) {
  return cleanText(value) !== null;
}

function optionalTextLine(label: string, value: string | null | undefined) {
  const text = cleanText(value);
  return text ? `${label}: ${text}` : "";
}

function optionalTextBlock(label: string, value: string | null | undefined) {
  const text = cleanText(value);
  return text ? `${label}:\n${text}` : "";
}

function optionalNumberLine(label: string, value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${label}: ${value}`
    : "";
}

function optionalBoolLine(label: string, value: boolean | null | undefined) {
  if (value === true) return `${label}: SÃ­`;
  if (value === false) return `${label}: No`;
  return "";
}

function sectionText(title: string, rows: Array<string | null | undefined>) {
  const cleanRows = rows
    .map((row) => cleanText(row || ""))
    .filter((row): row is string => Boolean(row));

  return cleanRows.length > 0 ? [title, ...cleanRows].join("\n") : "";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: otId } = await context.params;

    if (!otId) {
      return jsonError("No se recibiÃ³ el identificador de la OT.", 400);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const missingVars = [
      !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !supabaseAnonKey
        ? "NEXT_PUBLIC_SUPABASE_ANON_KEY o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
        : null,
      !supabaseServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter(Boolean);

    if (missingVars.length > 0) {
      return jsonError(
        `Faltan variables de entorno: ${missingVars.join(", ")}`,
        500,
      );
    }
    const supabaseUrlSafe = supabaseUrl as string;
    const supabaseAnonKeySafe = supabaseAnonKey as string;
    const supabaseServiceRoleKeySafe = supabaseServiceRoleKey as string;
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return jsonError("No autorizado.", 401);
    }

    const authClient = createClient(supabaseUrlSafe, supabaseAnonKeySafe, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return jsonError("SesiÃ³n no vÃ¡lida.", 401);
    }

    const adminClient = createClient(
      supabaseUrlSafe,
      supabaseServiceRoleKeySafe,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const [
      resumenResp,
      detalleResp,
      evidenciasResp,
      firmasResp,
      tiemposResp,
      perfilesResp,
      tiposResp,
    ] = await Promise.all([
      adminClient.from("ot_vw_resumen").select("*").eq("id", otId).single(),
      adminClient
        .from("ot_ordenes_trabajo")
        .select(
          `
            id,
            folio,
            empresa_id,
            cliente_id,
            ubicacion_id,
            activo_id,
            cotizacion_id,
            tipo_servicio_id,
            estado_id,
            fecha_ot,
            fecha_programada,
            fecha_cierre,
            titulo,
            descripcion_solicitud,
            problema_reportado,
            numero_om_cliente,
            cantidad_tecnicos,
            horas_hombre_utilizadas,
            responsable_cliente_rut,
            supervisor_contratista_nombre,
            supervisor_contratista_rut,
            supervisor_contratista_cargo,
            herramientas_materiales_utilizados,
            recomendaciones_seguridad,
            seguridad_permiso_trabajo,
            seguridad_uso_epp,
            seguridad_bloqueo_tarjeta,
            seguridad_observacion,
            seguridad_validada_at,
            seguridad_validada_by,
            alcance_trabajo_ejecutado,
            alcance_trabajo_observacion,
            ejecutado_segun_programa,
            ejecutado_segun_programa_observacion,
            diagnostico,
            causa_probable,
            trabajo_realizado,
            recomendaciones,
            tecnico_responsable_id,
            supervisor_id,
            prioridad,
            requiere_checklist,
            plantilla_checklist_id,
            hora_inicio,
            hora_termino,
            duracion_minutos,
            cliente_nombre_firma,
            cliente_cargo_firma,
            observaciones_cierre,
            mostrar_firma_cliente,
            mostrar_firma_tecnico,
            created_by,
            created_at,
            updated_at,
            contacto_cliente_nombre,
            contacto_cliente_cargo,
            area_trabajo,
            resultado_servicio,
            hallazgos,
            conclusiones_tecnicas,
            mostrar_nota_valor_hora,
            valor_hora_uf
          `,
        )
        .eq("id", otId)
        .single(),
      adminClient
        .from("ot_evidencias")
        .select(
          `
            id,
            ot_id,
            tipo,
            archivo_url,
            archivo_nombre,
            descripcion,
            orden,
            created_at
          `,
        )
        .eq("ot_id", otId)
        .order("tipo", { ascending: true })
        .order("orden", { ascending: true }),
      adminClient
        .from("ot_firmas")
        .select(
          `
            id,
            ot_id,
            tipo_firma,
            nombre_firmante,
            cargo_firmante,
            firma_url,
            fecha_firma,
            created_at
          `,
        )
        .eq("ot_id", otId)
        .order("fecha_firma", { ascending: false }),
      adminClient
        .from("ot_tiempos_trabajo")
        .select(
          `
            id,
            ot_id,
            usuario_id,
            fecha,
            hora_inicio,
            hora_termino,
            duracion_minutos,
            tipo_tiempo,
            observacion,
            created_at,
            updated_at
          `,
        )
        .eq("ot_id", otId)
        .eq("activo", true)
        .is("deleted_at", null)
        .order("hora_inicio", { ascending: true }),
      adminClient
        .from("perfiles")
        .select("id, email")
        .order("email", { ascending: true }),
      adminClient
        .from("ot_tipos_servicio")
        .select(
          "id, codigo, nombre, estructura_ot_codigo, requiere_checklist, usa_equipos_multiples, usa_checklist_por_equipo, tipo_equipo_permitido",
        )
        .eq("activo", true),
    ]);

    if (resumenResp.error) {
      return jsonError(
        `No se pudo cargar el resumen OT: ${resumenResp.error.message}`,
        500,
      );
    }
    if (detalleResp.error) {
      return jsonError(
        `No se pudo cargar el detalle OT: ${detalleResp.error.message}`,
        500,
      );
    }
    if (evidenciasResp.error) {
      return jsonError(
        `No se pudieron cargar las evidencias: ${evidenciasResp.error.message}`,
        500,
      );
    }
    if (firmasResp.error) {
      return jsonError(
        `No se pudieron cargar las firmas: ${firmasResp.error.message}`,
        500,
      );
    }
    if (tiemposResp.error) {
      return jsonError(
        `No se pudieron cargar los tiempos registrados: ${tiemposResp.error.message}`,
        500,
      );
    }
    if (perfilesResp.error) {
      return jsonError(
        `No se pudieron cargar los perfiles: ${perfilesResp.error.message}`,
        500,
      );
    }
    if (tiposResp.error) {
      return jsonError(
        `No se pudieron cargar los tipos de servicio: ${tiposResp.error.message}`,
        500,
      );
    }

    const informeTecnicoResp = await adminClient
      .from("ot_informes_tecnicos")
      .select("id, datos")
      .eq("ot_id", otId)
      .eq("plantilla_codigo", "softys_om")
      .maybeSingle();

    if (informeTecnicoResp.error) {
      return jsonError(
        `No se pudo cargar la recepciÃ³n/informe tÃ©cnico: ${informeTecnicoResp.error.message}`,
        500,
      );
    }

    const perfilesRaw = (perfilesResp.data ?? []) as PerfilMini[];
    const perfilesMap = perfilesRaw.reduce<Record<string, string>>(
      (acc, item) => {
        acc[item.id] = item.email || item.id;
        return acc;
      },
      {},
    );

    const resumen = resumenResp.data as OTResumen;
    const detalle = detalleResp.data as OTDetalle;
    const tiempos = (tiemposResp.data ?? []) as TiempoTrabajo[];
    const horarioDesdeTiempos = obtenerHorarioDesdeTiempos(tiempos);

    const detalleHorarioBase: OTDetalle = {
      ...detalle,
      hora_inicio:
        toChileFloatingDateTime(detalle.hora_inicio) ||
        horarioDesdeTiempos?.hora_inicio ||
        null,
      hora_termino:
        toChileFloatingDateTime(detalle.hora_termino) ||
        horarioDesdeTiempos?.hora_termino ||
        null,
      duracion_minutos:
        detalle.duracion_minutos ??
        horarioDesdeTiempos?.duracion_minutos ??
        null,
    };

    const checklistResp = await adminClient
      .from("ot_respuestas_checklist")
      .select("id, plantilla_item_id, respuesta_texto, observacion")
      .eq("ot_id", otId);

    if (checklistResp.error) {
      return jsonError(
        `No se pudieron cargar las respuestas del checklist: ${checklistResp.error.message}`,
        500,
      );
    }

    const checklistRaw = (checklistResp.data ?? []) as Array<{
      id: string;
      plantilla_item_id: string;
      respuesta_texto: string | null;
      observacion: string | null;
    }>;

    let checklistTextoPdf = "";

    if (checklistRaw.length > 0) {
      const checklistItemIds = Array.from(
        new Set(
          checklistRaw.map((item) => item.plantilla_item_id).filter(Boolean),
        ),
      );

      if (checklistItemIds.length > 0) {
        const checklistItemsResp = await adminClient
          .from("ot_plantillas_checklist_items")
          .select(
            "id, zona, categoria, actividad, frecuencia_horas, tipo_item, orden",
          )
          .in("id", checklistItemIds);

        if (checklistItemsResp.error) {
          return jsonError(
            `No se pudieron cargar los Ã­tems del checklist: ${checklistItemsResp.error.message}`,
            500,
          );
        }

        const checklistItemsMap = (
          (checklistItemsResp.data ?? []) as Array<{
            id: string;
            zona: string;
            categoria: string | null;
            actividad: string;
            frecuencia_horas: number | null;
            tipo_item: string | null;
            orden: number;
          }>
        ).reduce<
          Record<
            string,
            {
              id: string;
              zona: string;
              categoria: string | null;
              actividad: string;
              frecuencia_horas: number | null;
              tipo_item: string | null;
              orden: number;
            }
          >
        >((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});

        const estadoLabel = (value: string | null) => {
          if (value === "ok") return "OK";
          if (value === "no_ok") return "No OK";
          if (value === "na") return "N/A";
          return "Sin respuesta";
        };

        checklistTextoPdf = checklistRaw
          .map((respuesta) => {
            const item = checklistItemsMap[respuesta.plantilla_item_id];
            if (!item) return null;

            return {
              orden: item.orden,
              texto: [
                item.zona || "General",
                item.frecuencia_horas ? `${item.frecuencia_horas} hrs` : "",
                item.actividad,
                estadoLabel(respuesta.respuesta_texto),
                respuesta.observacion ? `Obs: ${respuesta.observacion}` : "",
              ]
                .filter(Boolean)
                .join(" | "),
            };
          })
          .filter(
            (item): item is { orden: number; texto: string } => item !== null,
          )
          .sort((a, b) => a.orden - b.orden)
          .map((item) => item.texto)
          .join("\n");
      }
    }

    const equiposOtResp = await adminClient
      .from("ot_orden_equipos")
      .select("id,equipo_id,orden,descripcion_trabajo,observacion")
      .eq("ot_id", otId)
      .eq("activo", true)
      .is("deleted_at", null)
      .order("orden", { ascending: true });

    if (equiposOtResp.error) {
      return jsonError(
        `No se pudieron cargar los equipos asociados a la OM: ${equiposOtResp.error.message}`,
        500,
      );
    }

    const equiposOtRows = (equiposOtResp.data ?? []) as Array<{
      id: string;
      equipo_id: string;
      orden: number | null;
      descripcion_trabajo: string | null;
      observacion: string | null;
    }>;

    const equipoIds = Array.from(
      new Set(equiposOtRows.map((item) => item.equipo_id).filter(Boolean)),
    );
    let equiposInfoMap = new Map<string, Partial<EquipoAsociadoPdf>>();

    if (equipoIds.length > 0) {
      const equiposInfoResp = await adminClient
        .from("ot_equipos")
        .select(
          "id,tag,nombre,descripcion,tipo_equipo,planta,area,linea,ubicacion,marca,modelo,serie,potencia,criticidad",
        )
        .in("id", equipoIds);

      if (equiposInfoResp.error) {
        return jsonError(
          `No se pudieron cargar los datos de equipos asociados: ${equiposInfoResp.error.message}`,
          500,
        );
      }

      equiposInfoMap = new Map(
        (
          (equiposInfoResp.data ?? []) as Array<{
            id: string;
            tag: string | null;
            nombre: string | null;
            descripcion: string | null;
            tipo_equipo: string | null;
            planta: string | null;
            area: string | null;
            linea: string | null;
            ubicacion: string | null;
            marca: string | null;
            modelo: string | null;
            serie: string | null;
            potencia: string | null;
            criticidad: string | null;
          }>
        ).map((equipo) => [equipo.id, equipo]),
      );
    }

    const equiposAsociados = equiposOtRows.map((item) => ({
      id: item.id,
      equipo_id: item.equipo_id,
      orden: item.orden,
      descripcion_trabajo: item.descripcion_trabajo,
      observacion: item.observacion,
      tag: equiposInfoMap.get(item.equipo_id)?.tag ?? null,
      nombre: equiposInfoMap.get(item.equipo_id)?.nombre ?? null,
      descripcion: equiposInfoMap.get(item.equipo_id)?.descripcion ?? null,
      tipo_equipo: equiposInfoMap.get(item.equipo_id)?.tipo_equipo ?? null,
      planta: equiposInfoMap.get(item.equipo_id)?.planta ?? null,
      area: equiposInfoMap.get(item.equipo_id)?.area ?? null,
      linea: equiposInfoMap.get(item.equipo_id)?.linea ?? null,
      ubicacion: equiposInfoMap.get(item.equipo_id)?.ubicacion ?? null,
      marca: equiposInfoMap.get(item.equipo_id)?.marca ?? null,
      modelo: equiposInfoMap.get(item.equipo_id)?.modelo ?? null,
      serie: equiposInfoMap.get(item.equipo_id)?.serie ?? null,
      potencia: equiposInfoMap.get(item.equipo_id)?.potencia ?? null,
      criticidad: equiposInfoMap.get(item.equipo_id)?.criticidad ?? null,
    })) as EquipoAsociadoPdf[];

    const checklistEquipoResp = await adminClient
      .from("ot_equipo_checklist_resultados")
      .select(
        "id,ot_orden_equipo_id,equipo_id,plantilla_item_id,respuesta_texto,observacion_antes,observacion_despues,accion_realizada,recomendacion_tecnica,evidencia_antes_url,evidencia_despues_url",
      )
      .eq("ot_id", otId);

    if (checklistEquipoResp.error) {
      return jsonError(
        `No se pudo cargar el checklist tÃ©cnico por equipo: ${checklistEquipoResp.error.message}`,
        500,
      );
    }

    const checklistEquipoRows = (checklistEquipoResp.data ?? []) as Array<{
      id: string;
      ot_orden_equipo_id: string;
      equipo_id: string;
      plantilla_item_id: string;
      respuesta_texto: string | null;
      observacion_antes: string | null;
      observacion_despues: string | null;
      accion_realizada: string | null;
      recomendacion_tecnica: string | null;
      evidencia_antes_url: string | null;
      evidencia_despues_url: string | null;
    }>;

    const plantillaItemIdsEquipo = Array.from(
      new Set(
        checklistEquipoRows
          .map((item) => item.plantilla_item_id)
          .filter(Boolean),
      ),
    );
    let plantillaItemsEquipoMap = new Map<
      string,
      Partial<EquipoChecklistPdf>
    >();

    if (plantillaItemIdsEquipo.length > 0) {
      const plantillaItemsEquipoResp = await adminClient
        .from("ot_plantillas_checklist_items")
        .select("id,zona,categoria,actividad,orden")
        .in("id", plantillaItemIdsEquipo);

      if (plantillaItemsEquipoResp.error) {
        return jsonError(
          `No se pudieron cargar los Ã­tems del checklist por equipo: ${plantillaItemsEquipoResp.error.message}`,
          500,
        );
      }

      plantillaItemsEquipoMap = new Map(
        (
          (plantillaItemsEquipoResp.data ?? []) as Array<{
            id: string;
            zona: string | null;
            categoria: string | null;
            actividad: string | null;
            orden: number | null;
          }>
        ).map((item) => [
          item.id,
          {
            item_zona: item.zona,
            item_categoria: item.categoria,
            item_actividad: item.actividad,
            item_orden: item.orden,
          },
        ]),
      );
    }

    const checklistEquipo = checklistEquipoRows
      .map((row) => ({
        ...row,
        item_zona:
          plantillaItemsEquipoMap.get(row.plantilla_item_id)?.item_zona ?? null,
        item_categoria:
          plantillaItemsEquipoMap.get(row.plantilla_item_id)?.item_categoria ??
          null,
        item_actividad:
          plantillaItemsEquipoMap.get(row.plantilla_item_id)?.item_actividad ??
          null,
        item_orden:
          plantillaItemsEquipoMap.get(row.plantilla_item_id)?.item_orden ??
          null,
      }))
      .sort(
        (a, b) => (a.item_orden ?? 9999) - (b.item_orden ?? 9999),
      ) as EquipoChecklistPdf[];

    const checklistEquipoPorAsociacion = checklistEquipo.reduce<
      Record<string, EquipoChecklistPdf[]>
    >((acc, item) => {
      if (!acc[item.ot_orden_equipo_id]) acc[item.ot_orden_equipo_id] = [];
      acc[item.ot_orden_equipo_id].push(item);
      return acc;
    }, {});

    const equiposAsociadosTextoPdf =
      equiposAsociados.length > 0
        ? equiposAsociados
            .map((equipo, index) => {
              const itemsEquipo = checklistEquipoPorAsociacion[equipo.id] || [];
              const respondidosEquipo = itemsEquipo.filter(
                (item) => item.respuesta_texto,
              ).length;
              return [
                `Equipo ${index + 1}: ${equipoPdfNombre(equipo)}`,
                `UbicaciÃ³n: ${equipoPdfUbicacion(equipo)}`,
                `CaracterÃ­sticas: ${equipoPdfCaracteristicas(equipo)}`,
                `Checklist: ${respondidosEquipo}/${itemsEquipo.length} Ã­tems respondidos`,
                equipo.descripcion_trabajo
                  ? `Trabajo solicitado: ${equipo.descripcion_trabajo}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n\n")
        : "";

    const checklistEquipoTextoPdf =
      equiposAsociados.length > 0
        ? equiposAsociados
            .map((equipo, index) => {
              const itemsEquipo = checklistEquipoPorAsociacion[equipo.id] || [];
              const detalleItems = itemsEquipo
                .map((item) =>
                  [
                    `- ${item.item_actividad || "Ãtem tÃ©cnico"}: ${estadoEquipoPdf(item.respuesta_texto)}`,
                    item.observacion_antes
                      ? `  Antes: ${item.observacion_antes}`
                      : "",
                    item.accion_realizada
                      ? `  AcciÃ³n: ${item.accion_realizada}`
                      : "",
                    item.observacion_despues
                      ? `  DespuÃ©s: ${item.observacion_despues}`
                      : "",
                    item.recomendacion_tecnica
                      ? `  RecomendaciÃ³n: ${item.recomendacion_tecnica}`
                      : "",
                    item.evidencia_antes_url ? "  Foto antes: registrada" : "",
                    item.evidencia_despues_url
                      ? "  Foto despuÃ©s: registrada"
                      : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                )
                .join("\n");

              return `Equipo ${index + 1}: ${equipoPdfNombre(equipo)}\n${detalleItems || "Sin respuestas de checklist registradas."}`;
            })
            .join("\n\n")
        : "";

    const evidenciasChecklistPdf = checklistEquipo.flatMap((item, index) => {
      const equipo = equiposAsociados.find(
        (entry) => entry.id === item.ot_orden_equipo_id,
      );
      const baseDescription = `${equipo ? equipoPdfNombre(equipo) : "Equipo"} - ${item.item_actividad || "Ãtem tÃ©cnico"}`;
      const rows: Evidencia[] = [];

      if (item.evidencia_antes_url) {
        rows.push({
          id: `checklist-${item.id}-antes`,
          ot_id: otId,
          tipo: "otro",
          archivo_url: item.evidencia_antes_url,
          archivo_nombre: "foto-antes-checklist.jpg",
          descripcion: `Foto antes | ${baseDescription}`,
          orden: 9000 + index * 2,
          created_at: new Date().toISOString(),
        });
      }

      if (item.evidencia_despues_url) {
        rows.push({
          id: `checklist-${item.id}-despues`,
          ot_id: otId,
          tipo: "otro",
          archivo_url: item.evidencia_despues_url,
          archivo_nombre: "foto-despues-checklist.jpg",
          descripcion: `Foto despuÃ©s | ${baseDescription}`,
          orden: 9001 + index * 2,
          created_at: new Date().toISOString(),
        });
      }

      return rows;
    });

    const tiposServicio = (tiposResp.data ?? []) as TipoServicioOption[];
    const tipoServicioConfig =
      tiposServicio.find((item) => item.id === detalle.tipo_servicio_id) ??
      null;
    const estructuraOtCodigo = (
      tipoServicioConfig?.estructura_ot_codigo || ""
    ).toLowerCase();
    const tipoServicioCodigo = (tipoServicioConfig?.codigo || "").toLowerCase();
    const tipoServicioNombre = (
      tipoServicioConfig?.nombre ||
      resumen.tipo_servicio_nombre ||
      ""
    ).toLowerCase();
    const usaChecklistPorEquipo =
      Boolean(tipoServicioConfig?.usa_checklist_por_equipo) ||
      estructuraOtCodigo.includes("motores") ||
      estructuraOtCodigo.includes("valvulas") ||
      tipoServicioCodigo.includes("mantencion_motores") ||
      tipoServicioCodigo.includes("mantencion_valvulas");
    const esUrgencia =
      estructuraOtCodigo.includes("urgencia") ||
      tipoServicioCodigo.includes("urgencia") ||
      tipoServicioNombre.includes("urgencia");
    const esAsistenciaTecnica =
      estructuraOtCodigo.includes("asistencia") ||
      tipoServicioCodigo.includes("asistencia") ||
      tipoServicioNombre.includes("asistencia");
    const esMantenimientoGeneral =
      estructuraOtCodigo.includes("mantencion_general") ||
      estructuraOtCodigo.includes("mantenimiento_general") ||
      tipoServicioCodigo.includes("mantencion_general") ||
      tipoServicioNombre.includes("mantenimiento general");

    const esEmpresaDyf = detalle.empresa_id === DYF_EMPRESA_ID;
    const esClienteSoftys = (resumen.cliente_nombre || "")
      .toLowerCase()
      .includes("softys");
    const esFlujoDyfSoftys = esEmpresaDyf || esClienteSoftys;

    const informeTecnico = informeTecnicoResp.data as InformeTecnicoMini | null;
    const informeDatos = (informeTecnico?.datos ?? {}) as Record<string, any>;
    const checklistRecepcion = (informeDatos.checklist_recepcion ??
      {}) as Record<string, any>;

    const optionalRecepcionBoolLine = (label: string, value: unknown) => {
      if (
        value === true ||
        value === "si" ||
        value === "sÃ­" ||
        value === "true"
      )
        return `${label}: SÃ­`;
      if (value === false || value === "no" || value === "false")
        return `${label}: No`;
      return "";
    };

    const recepcionTextoPdf = sectionText(
      "CHECKLIST DE RECEPCIÃ“N DEL TRABAJO",
      [
        optionalRecepcionBoolLine(
          "Alcance del trabajo",
          checklistRecepcion.alcance_ejecutado,
        ),
        optionalRecepcionBoolLine(
          "Limpieza y orden",
          checklistRecepcion.area_limpia,
        ),
        optionalRecepcionBoolLine(
          "Seguridad",
          checklistRecepcion.seguridad_cumplida,
        ),
        optionalRecepcionBoolLine(
          "Tiempo de ejecuciÃ³n",
          checklistRecepcion.plazo_cumplido,
        ),
        optionalRecepcionBoolLine(
          "Funcionamiento y pruebas",
          checklistRecepcion.pruebas_realizadas,
        ),
        optionalTextBlock(
          "EvaluaciÃ³n general",
          informeDatos.evaluacion_general,
        ),
        optionalTextBlock(
          "Observaciones recepciÃ³n",
          informeDatos.observaciones_recepcion,
        ),
      ],
    );

    const desarrolloServicioSimplePdf = !usaChecklistPorEquipo
      ? esUrgencia
        ? sectionText("DESARROLLO DE URGENCIA", [
            optionalTextBlock(
              "Solicitud del cliente",
              detalle.descripcion_solicitud,
            ),
            optionalTextBlock("Problema reportado", detalle.problema_reportado),
            optionalTextBlock("DiagnÃ³stico", detalle.diagnostico),
            optionalTextBlock("Causa detectada", detalle.causa_probable),
            optionalTextBlock(
              "SoluciÃ³n aplicada",
              detalle.trabajo_realizado || detalle.resultado_servicio,
            ),
            optionalTextBlock(
              "Recomendaciones tÃ©cnicas",
              detalle.recomendaciones,
            ),
          ])
        : esAsistenciaTecnica
          ? sectionText("DESARROLLO DE ASISTENCIA TÃ‰CNICA", [
              optionalTextBlock(
                "Solicitud del cliente",
                detalle.descripcion_solicitud,
              ),
              optionalTextBlock(
                "Desarrollo de asistencia tÃ©cnica",
                detalle.trabajo_realizado,
              ),
              optionalTextBlock(
                "Resultado / observaciÃ³n tÃ©cnica",
                detalle.resultado_servicio || detalle.observaciones_cierre,
              ),
              optionalTextBlock(
                "Recomendaciones tÃ©cnicas",
                detalle.recomendaciones,
              ),
            ])
          : esMantenimientoGeneral
            ? sectionText("DESARROLLO DE MANTENIMIENTO GENERAL", [
                optionalTextBlock(
                  "Trabajo realizado",
                  detalle.trabajo_realizado,
                ),
                optionalTextBlock("Hallazgos detectados", detalle.hallazgos),
                optionalTextBlock(
                  "Resultado del servicio",
                  detalle.resultado_servicio,
                ),
                optionalTextBlock(
                  "Recomendaciones tÃ©cnicas",
                  detalle.recomendaciones,
                ),
              ])
            : sectionText("DESARROLLO TÃ‰CNICO DEL SERVICIO", [
                optionalTextBlock(
                  "Solicitud del cliente",
                  detalle.descripcion_solicitud,
                ),
                optionalTextBlock(
                  "Problema reportado",
                  detalle.problema_reportado,
                ),
                optionalTextBlock("DiagnÃ³stico", detalle.diagnostico),
                optionalTextBlock("Causa probable", detalle.causa_probable),
                optionalTextBlock(
                  "Trabajo realizado",
                  detalle.trabajo_realizado,
                ),
                optionalTextBlock(
                  "Resultado del servicio",
                  detalle.resultado_servicio,
                ),
                optionalTextBlock("Hallazgos", detalle.hallazgos),
                optionalTextBlock(
                  "Conclusiones tÃ©cnicas",
                  detalle.conclusiones_tecnicas,
                ),
                optionalTextBlock("Recomendaciones", detalle.recomendaciones),
              ])
      : "";

    // La estructura simple la renderiza el componente PDF desde los campos reales.
    // Se mantiene esta variable para compatibilidad mientras se retiran secciones antiguas.
    void desarrolloServicioSimplePdf;

    const receptorClienteLabel = (resumen.cliente_nombre || "")
      .toLowerCase()
      .includes("softys")
      ? "Responsable cliente / Softys"
      : "Responsable cliente";

    const responsableClienteTexto = [
      cleanText(detalle.contacto_cliente_nombre),
      cleanText(detalle.contacto_cliente_cargo),
      hasText(detalle.responsable_cliente_rut)
        ? `RUT ${cleanText(detalle.responsable_cliente_rut)}`
        : "",
    ]
      .filter(Boolean)
      .join(" - ");

    const supervisorContratistaTexto = [
      cleanText(detalle.supervisor_contratista_nombre),
      cleanText(detalle.supervisor_contratista_cargo),
      hasText(detalle.supervisor_contratista_rut)
        ? `RUT ${cleanText(detalle.supervisor_contratista_rut)}`
        : "",
    ]
      .filter(Boolean)
      .join(" - ");

    const omSoftysTextoPdf = sectionText("DATOS PRINCIPALES DEL INFORME", [
      optionalTextLine("NÂ° OM / Orden cliente", detalle.numero_om_cliente),
      responsableClienteTexto
        ? `${receptorClienteLabel}: ${responsableClienteTexto}`
        : "",
      supervisorContratistaTexto
        ? `Supervisor contratista: ${supervisorContratistaTexto}`
        : "",
      optionalTextLine("Ãrea / sector de trabajo", detalle.area_trabajo),
      toPdfTimeOnly(detalleHorarioBase.hora_inicio)
        ? `Hora inicio: ${toPdfTimeOnly(detalleHorarioBase.hora_inicio)}`
        : "",
      toPdfTimeOnly(detalleHorarioBase.hora_termino)
        ? `Hora tÃ©rmino: ${toPdfTimeOnly(detalleHorarioBase.hora_termino)}`
        : "",
      optionalNumberLine("Cantidad de tÃ©cnicos", detalle.cantidad_tecnicos),
      optionalNumberLine(
        "Horas hombre utilizadas",
        detalle.horas_hombre_utilizadas,
      ),
      optionalBoolLine(
        "Â¿Se ejecutÃ³ todo lo solicitado?",
        detalle.alcance_trabajo_ejecutado,
      ),
      optionalTextBlock(
        "ObservaciÃ³n alcance",
        detalle.alcance_trabajo_observacion,
      ),
      optionalBoolLine(
        "Â¿Se ejecutÃ³ de acuerdo al programa?",
        detalle.ejecutado_segun_programa,
      ),
      optionalTextBlock(
        "ObservaciÃ³n programa",
        detalle.ejecutado_segun_programa_observacion,
      ),
      optionalTextBlock(
        "Herramientas y materiales utilizados",
        detalle.herramientas_materiales_utilizados,
      ),
      optionalTextBlock(
        "Recomendaciones de seguridad",
        detalle.recomendaciones_seguridad,
      ),
    ]);

    const detallePdf: OTDetalle = {
      ...detalleHorarioBase,
      descripcion_solicitud: cleanText(detalle.descripcion_solicitud),
      problema_reportado: cleanText(detalle.problema_reportado),
      diagnostico: cleanText(detalle.diagnostico),
      causa_probable: cleanText(detalle.causa_probable),
      trabajo_realizado: cleanText(detalle.trabajo_realizado),
      recomendaciones: cleanText(detalle.recomendaciones),
      contacto_cliente_nombre: cleanText(detalle.contacto_cliente_nombre),
      contacto_cliente_cargo: cleanText(detalle.contacto_cliente_cargo),
      area_trabajo: cleanText(detalle.area_trabajo),
      resultado_servicio: cleanText(detalle.resultado_servicio),
      hallazgos: cleanText(detalle.hallazgos),
      conclusiones_tecnicas: cleanText(detalle.conclusiones_tecnicas),
      observaciones_cierre: [
        cleanText(detalle.observaciones_cierre)
          ? `OBSERVACIONES FINALES
${cleanText(detalle.observaciones_cierre)}`
          : "",
        esFlujoDyfSoftys ? omSoftysTextoPdf : "",
        usaChecklistPorEquipo && equiposAsociadosTextoPdf
          ? `${tipoServicioConfig?.tipo_equipo_permitido === "valvula" ? "VÃLVULAS ASOCIADAS A LA OM" : "EQUIPOS / MOTORES ASOCIADOS A LA OM"}
${equiposAsociadosTextoPdf}`
          : "",
        usaChecklistPorEquipo && checklistEquipoTextoPdf
          ? `${tipoServicioConfig?.tipo_equipo_permitido === "valvula" ? "CHECKLIST TÃ‰CNICO POR EQUIPO / VÃLVULA" : "CHECKLIST TÃ‰CNICO POR EQUIPO / MOTOR"}
${checklistEquipoTextoPdf}`
          : "",
        checklistTextoPdf
          ? `CHECKLIST DE MANTENIMIENTO
${checklistTextoPdf}`
          : "",
        esFlujoDyfSoftys ? recepcionTextoPdf : "",
      ]
        .filter((value) => value && value.trim())
        .join("\n\n"),
    };
    const evidencias = [
      ...((evidenciasResp.data ?? []) as Evidencia[]),
      ...evidenciasChecklistPdf,
    ];
    const firmas = (firmasResp.data ?? []) as Firma[];
    const logoUrl =
      detalle.empresa_id === RMSIC_EMPRESA_ID
        ? new URL("/logos/rmsic-logo.png", request.url).toString()
        : detalle.empresa_id === DYF_EMPRESA_ID
          ? new URL("/logos/dyf-logo-transparente.png", request.url).toString()
          : null;

    const resumenPdf = {
      ...resumen,
      fecha_ot: detalleHorarioBase.fecha_ot || (resumen as any).fecha_ot,
      fecha_visita:
        detalleHorarioBase.fecha_ot || (resumen as any).fecha_visita,
      hora_inicio:
        detalleHorarioBase.hora_inicio || (resumen as any).hora_inicio,
      hora_termino:
        detalleHorarioBase.hora_termino || (resumen as any).hora_termino,
      duracion_minutos:
        detalleHorarioBase.duracion_minutos ??
        (resumen as any).duracion_minutos,
    } as OTResumen;

    const pdfElement = React.createElement(OTPdfDocument, {
      resumen: resumenPdf,
      detalle: detallePdf,
      evidencias,
      firmas,
      perfilesMap,
      tiposServicio,
      logoUrl,
    }) as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(pdfElement);
    const pdfBytes = new Uint8Array(buffer);

    const safeFolio = (detalle.folio || "ot").replace(/[^\w.-]+/g, "_");

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeFolio}.pdf"`,
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo generar el PDF real.";
    return jsonError(message, 500);
  }
}

