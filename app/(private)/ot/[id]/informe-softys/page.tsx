"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ProtectedModuleRoute from "@/components/ProtectedModuleRoute";
import { supabase } from "@/lib/supabase/client";
import type { OTResumen } from "@/lib/ot/types";

type OTResumenConEquipo = OTResumen & {
  equipo_id: string | null;
  equipo_tag: string | null;
  equipo_nombre: string | null;
  equipo_descripcion: string | null;
  equipo_tipo: string | null;
  equipo_planta: string | null;
  equipo_area: string | null;
  equipo_linea: string | null;
  equipo_ubicacion: string | null;
  equipo_marca: string | null;
  equipo_modelo: string | null;
  equipo_serie: string | null;
  equipo_potencia: string | null;
};

type OTDetalle = {
  id: string;
  folio: string | null;
  empresa_id: string;
  cliente_id: string;
  tipo_servicio_id: string;
  estado_id: string;
  fecha_ot: string;
  fecha_programada: string | null;
  fecha_cierre: string | null;
  titulo: string;
  descripcion_solicitud: string | null;
  problema_reportado: string | null;
  diagnostico: string | null;
  causa_probable: string | null;
  trabajo_realizado: string | null;
  recomendaciones: string | null;
  tecnico_responsable_id: string | null;
  supervisor_id: string | null;
  prioridad: string;
  requiere_checklist: boolean;
  hora_inicio: string | null;
  hora_termino: string | null;
  duracion_minutos: number | null;
  cliente_nombre_firma: string | null;
  cliente_cargo_firma: string | null;
  observaciones_cierre: string | null;
  contacto_cliente_nombre: string | null;
  contacto_cliente_cargo: string | null;
  area_trabajo: string | null;
  resultado_servicio: string | null;
  hallazgos: string | null;
  conclusiones_tecnicas: string | null;
};

type Evidencia = {
  id: string;
  tipo: string | null;
  archivo_url: string | null;
  archivo_nombre: string | null;
  descripcion: string | null;
  orden: number | null;
  created_at: string;
};

type Firma = {
  id: string;
  tipo_firma: string;
  nombre_firmante: string | null;
  cargo_firmante: string | null;
  firma_url: string | null;
  fecha_firma: string | null;
};

type TiempoTrabajo = {
  id: string;
  usuario_id: string;
  usuario_nombre?: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_termino: string | null;
  duracion_minutos: number | null;
  tipo_tiempo: string | null;
  observacion: string | null;
};

type InformeDatos = {
  numero_orden_cliente?: string;
  descripcion_trabajo?: string;
  empresa_contratista?: string;
  sistema?: string;
  sub_sistema?: string;
  sub_equipo?: string;
  criticidad?: string;
  frecuencia?: string;
  codigo_sap?: string;
  responsable_softys?: string;
  cargo_responsable_softys?: string;
  supervisor_contratista?: string;
  cargo_supervisor_contratista?: string;
  equipo_trabajo?: string;
  herramientas_materiales?: string;
  alcance?: string;
  detalle_trabajo_realizado?: string;
  cumplimiento_programa?: string;
  recomendaciones_seguridad?: string;
  observaciones_recepcion?: string;
  evaluacion_general?: string;
  checklist_recepcion?: {
    alcance_ejecutado?: boolean;
    area_limpia?: boolean;
    seguridad_cumplida?: boolean;
    plazo_cumplido?: boolean;
    pruebas_realizadas?: boolean;
  };
};

type InformeTecnico = {
  id: string;
  empresa_id: string;
  ot_id: string;
  plantilla_codigo: string;
  estado: string;
  datos: InformeDatos | null;
};

type ChecklistResultado = {
  id: string;
  empresa_id: string;
  ot_id: string;
  plantilla_id: string;
  plantilla_codigo: string | null;
  plantilla_nombre: string | null;
  item_id: string;
  item_codigo: string | null;
  seccion: string | null;
  orden: number | null;
  actividad: string | null;
  tipo_respuesta:
    | "estado"
    | "texto"
    | "numero"
    | "si_no"
    | "medicion"
    | string
    | null;
  item_unidad: string | null;
  requerido: boolean | null;
  ayuda: string | null;
  estado: "pendiente" | "ok" | "observado" | "no_aplica" | string;
  valor_texto: string | null;
  valor_numero: number | null;
  unidad: string | null;
  observacion: string | null;
  datos: Record<string, unknown> | null;
  item_config?: Record<string, unknown> | null;
  plantilla_config?: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type EquipoAsociadoInforme = {
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
  estado_equipo: string | null;
};

type EquipoChecklistInforme = {
  id: string;
  ot_orden_equipo_id: string;
  equipo_id: string;
  plantilla_item_id: string;
  respuesta_texto: string | null;
  respuesta_boolean: boolean | null;
  observacion_antes: string | null;
  observacion_despues: string | null;
  accion_realizada: string | null;
  recomendacion_tecnica: string | null;
  evidencia_antes_url: string | null;
  evidencia_despues_url: string | null;
  item_zona: string | null;
  item_categoria: string | null;
  item_actividad: string | null;
  item_frecuencia_horas: number | null;
  item_indicaciones: string | null;
  item_orden: number | null;
  item_requiere_evidencia: boolean | null;
};


const datosDefault: InformeDatos = {
  numero_orden_cliente: "",
  descripcion_trabajo: "",
  empresa_contratista: "DyF Ingeniería y Mantenimiento Industrial",
  sistema: "",
  sub_sistema: "",
  sub_equipo: "",
  criticidad: "",
  frecuencia: "",
  codigo_sap: "",
  responsable_softys: "",
  cargo_responsable_softys: "",
  supervisor_contratista: "",
  cargo_supervisor_contratista: "Supervisor / Técnico DyF",
  equipo_trabajo: "",
  herramientas_materiales: "",
  alcance: "",
  detalle_trabajo_realizado: "",
  cumplimiento_programa: "",
  recomendaciones_seguridad: "",
  observaciones_recepcion: "",
  evaluacion_general: "",
  checklist_recepcion: {},
};

function mergeInformeDatos(
  datos: InformeDatos | null | undefined,
): InformeDatos {
  return {
    ...datosDefault,
    ...(datos || {}),
    checklist_recepcion: {
      ...datosDefault.checklist_recepcion,
      ...(datos?.checklist_recepcion || {}),
    },
  };
}

const DYF_LOGO = "/logos/dyf-logo-transparente.png";
const SOFTYS_LOGO = "/logos/softys-logo.png";

function labelOrDash(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatMinutes(value: number | null | undefined) {
  if (!value || value <= 0) return "-";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function formatHoursDecimal(value: number | null | undefined) {
  if (!value || value <= 0) return "-";
  return `${(value / 60).toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} HH`;
}

function nombreUsuarioTiempo(item: TiempoTrabajo) {
  return item.usuario_nombre || item.usuario_id || "Técnico registrado";
}

function buildLocation(resumen: OTResumenConEquipo | null) {
  if (!resumen) return "";
  return [
    resumen.equipo_planta,
    resumen.equipo_area,
    resumen.equipo_linea,
    resumen.equipo_ubicacion,
  ]
    .filter(Boolean)
    .join(" / ");
}

function buildEquipoCaracteristicas(resumen: OTResumenConEquipo | null) {
  if (!resumen) return "";
  return [
    resumen.equipo_tipo,
    resumen.equipo_marca,
    resumen.equipo_modelo,
    resumen.equipo_potencia,
  ]
    .filter(Boolean)
    .join(" · ");
}

function equipoInformeNombre(equipo: EquipoAsociadoInforme) {
  return [equipo.tag, equipo.nombre || equipo.descripcion]
    .filter(Boolean)
    .join(" · ") || equipo.equipo_id;
}

function equipoInformeUbicacion(equipo: EquipoAsociadoInforme) {
  return [equipo.planta, equipo.area, equipo.linea, equipo.ubicacion]
    .filter(Boolean)
    .join(" / ") || "-";
}

function equipoInformeCaracteristicas(equipo: EquipoAsociadoInforme) {
  return [equipo.tipo_equipo, equipo.marca, equipo.modelo, equipo.potencia]
    .filter(Boolean)
    .join(" · ") || "-";
}

function estadoEquipoChecklistLabel(value: string | null | undefined) {
  if (value === "ok") return "OK";
  if (value === "no_ok") return "No OK";
  if (value === "na") return "N/A";
  return "Pendiente";
}

function estadoEquipoChecklistClass(value: string | null | undefined) {
  if (value === "ok") return "status-ok";
  if (value === "no_ok") return "status-no-ok";
  if (value === "na") return "status-na";
  return "status-pending";
}

function checklistTexto(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function hasChecklistEvidence(item: EquipoChecklistInforme) {
  return Boolean(item.evidencia_antes_url || item.evidencia_despues_url);
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDocumentTitle(resumen: OTResumenConEquipo | null) {
  const folio = resumen?.folio || "OT";
  const tag = resumen?.equipo_tag ? ` ${resumen.equipo_tag}` : "";
  return sanitizeFileName(`Informe OM ${folio}${tag}`);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{labelOrDash(value)}</strong>
    </div>
  );
}

function TextBox({
  value,
  minHeight = 70,
}: {
  value: string | null | undefined;
  minHeight?: number;
}) {
  return (
    <div className="text-box" style={{ minHeight }}>
      {value || <span className="muted">Sin información registrada.</span>}
    </div>
  );
}

function inputClass() {
  return "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass()}
      />
    </label>
  );
}

function TextAreaInput({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass()}
      />
    </label>
  );
}

function CheckInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}

function checkMark(value: boolean | null | undefined) {
  return value ? "☑" : "□";
}

function estadoChecklistLabel(value: string | null | undefined) {
  if (value === "ok") return "OK";
  if (value === "observado") return "Observado";
  if (value === "no_aplica") return "No aplica";
  return "Pendiente";
}

function getItemConfig(item: ChecklistResultado) {
  return item.item_config || {};
}

function checklistDatos(item: ChecklistResultado) {
  return item.datos || {};
}

function datoBoolean(item: ChecklistResultado, key: string) {
  return checklistDatos(item)[key] === true;
}

function datoTexto(item: ChecklistResultado, key: string) {
  const value = checklistDatos(item)[key];
  if (value === null || value === undefined) return "";
  return String(value);
}

function checkSymbol(value: boolean) {
  return value ? "☑" : "□";
}

function usesConfig(item: ChecklistResultado, key: string) {
  const config = getItemConfig(item);
  if (config[key] === true) return true;

  const seccion = item.seccion || "";
  const codigo = item.item_codigo || "";

  if (key === "usa_cumplimiento") return seccion.startsWith("1.") || seccion.startsWith("2.");
  if (key === "usa_encontrado") return seccion.startsWith("3.") || seccion.startsWith("4.");
  if (key === "usa_acciones") return seccion.startsWith("3.") || seccion.startsWith("4.");
  if (key === "usa_pt100") return codigo === "4.6" || codigo === "4.9";
  if (key === "usa_valor_texto") return codigo === "4.7" || codigo === "4.10";
  if (key === "usa_texto_largo") return codigo === "5.1";

  return false;
}

const encontradoKeys = [
  { key: "muy_bueno", label: "MB", title: "Muy bueno" },
  { key: "bueno", label: "B", title: "Bueno" },
  { key: "malo", label: "M", title: "Malo" },
  { key: "muy_malo", label: "MM", title: "Muy malo" },
];

const accionKeys = [
  { key: "limpieza", label: "L", title: "Limpieza" },
  { key: "reparacion", label: "R", title: "Reparación" },
  { key: "cambio", label: "C", title: "Cambio" },
  { key: "aviso_sap", label: "SAP", title: "Aviso SAP" },
];

const pt100Keys = [
  { key: "pt100_1", label: "N°1" },
  { key: "pt100_2", label: "N°2" },
  { key: "pt100_3", label: "N°3" },
  { key: "pt100_4", label: "N°4" },
];

function FirmaBox({
  title,
  nombre,
  cargo,
  firmaUrl,
}: {
  title: string;
  nombre: string | null | undefined;
  cargo: string | null | undefined;
  firmaUrl?: string | null;
}) {
  return (
    <div className="firma-box">
      <p className="firma-title">{title}</p>
      <div className="firma-area">
        {firmaUrl ? <img src={firmaUrl} alt={title} /> : <span>Firma</span>}
      </div>
      <p className="firma-name">{labelOrDash(nombre)}</p>
      <p className="firma-role">{labelOrDash(cargo)}</p>
    </div>
  );
}

export default function InformeSoftysPage() {
  const params = useParams();
  const otId = String(params?.id || "");

  const [resumen, setResumen] = useState<OTResumenConEquipo | null>(null);
  const [detalle, setDetalle] = useState<OTDetalle | null>(null);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [firmas, setFirmas] = useState<Firma[]>([]);
  const [tiempos, setTiempos] = useState<TiempoTrabajo[]>([]);
  const [checklistResultados, setChecklistResultados] = useState<
    ChecklistResultado[]
  >([]);
  const [equiposAsociados, setEquiposAsociados] = useState<EquipoAsociadoInforme[]>([]);
  const [checklistEquipoResultados, setChecklistEquipoResultados] = useState<
    EquipoChecklistInforme[]
  >([]);
  const [informe, setInforme] = useState<InformeTecnico | null>(null);
  const [informeDatos, setInformeDatos] = useState<InformeDatos>(datosDefault);
  const [savingInforme, setSavingInforme] = useState(false);
  const [saveOk, setSaveOk] = useState("");
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [
          resumenResp,
          detalleResp,
          evidenciasResp,
          firmasResp,
          tiemposResp,
          checklistResp,
        ] = await Promise.all([
          supabase
            .from("ot_vw_resumen")
            .select("*")
            .eq("id", otId)
            .maybeSingle(),
          supabase
            .from("ot_ordenes_trabajo")
            .select(
              `
                id,
                folio,
                empresa_id,
                cliente_id,
                tipo_servicio_id,
                estado_id,
                fecha_ot,
                fecha_programada,
                fecha_cierre,
                titulo,
                descripcion_solicitud,
                problema_reportado,
                diagnostico,
                causa_probable,
                trabajo_realizado,
                recomendaciones,
                tecnico_responsable_id,
                supervisor_id,
                prioridad,
                requiere_checklist,
                hora_inicio,
                hora_termino,
                duracion_minutos,
                cliente_nombre_firma,
                cliente_cargo_firma,
                observaciones_cierre,
                contacto_cliente_nombre,
                contacto_cliente_cargo,
                area_trabajo,
                resultado_servicio,
                hallazgos,
                conclusiones_tecnicas
              `,
            )
            .eq("id", otId)
            .maybeSingle(),
          supabase
            .from("ot_evidencias")
            .select(
              "id,tipo,archivo_url,archivo_nombre,descripcion,orden,created_at",
            )
            .eq("ot_id", otId)
            .order("orden", { ascending: true }),
          supabase
            .from("ot_firmas")
            .select(
              "id,tipo_firma,nombre_firmante,cargo_firmante,firma_url,fecha_firma",
            )
            .eq("ot_id", otId)
            .order("fecha_firma", { ascending: false }),
          supabase
            .from("ot_tiempos_trabajo")
            .select(
              "id,usuario_id,fecha,hora_inicio,hora_termino,duracion_minutos,tipo_tiempo,observacion",
            )
            .eq("ot_id", otId)
            .eq("activo", true)
            .is("deleted_at", null)
            .order("created_at", { ascending: true }),
          supabase
            .from("ot_vw_checklist_resultados")
            .select(
              "id,empresa_id,ot_id,plantilla_id,plantilla_codigo,plantilla_nombre,item_id,item_codigo,seccion,orden,actividad,tipo_respuesta,item_unidad,requerido,ayuda,estado,valor_texto,valor_numero,unidad,observacion,datos,item_config,plantilla_config,created_at,updated_at",
            )
            .eq("ot_id", otId)
            .order("orden", { ascending: true }),
        ]);

        if (resumenResp.error) {
          throw new Error(
            `No se pudo cargar resumen OT: ${resumenResp.error.message}`,
          );
        }

        if (detalleResp.error) {
          throw new Error(
            `No se pudo cargar detalle OT: ${detalleResp.error.message}`,
          );
        }

        if (!resumenResp.data || !detalleResp.data) {
          throw new Error("No se encontró la OT solicitada.");
        }

        if (evidenciasResp.error) {
          throw new Error(
            `No se pudieron cargar evidencias: ${evidenciasResp.error.message}`,
          );
        }

        if (firmasResp.error) {
          throw new Error(
            `No se pudieron cargar firmas: ${firmasResp.error.message}`,
          );
        }

        if (tiemposResp.error) {
          throw new Error(
            `No se pudieron cargar tiempos: ${tiemposResp.error.message}`,
          );
        }

        if (checklistResp.error) {
          throw new Error(
            `No se pudo cargar checklist técnico: ${checklistResp.error.message}`,
          );
        }

        const resumenRow = resumenResp.data as OTResumenConEquipo;
        const detalleRow = detalleResp.data as OTDetalle;

        const tiemposRows = (tiemposResp.data ?? []) as TiempoTrabajo[];
        const usuarioIds = Array.from(
          new Set(tiemposRows.map((item) => item.usuario_id).filter(Boolean)),
        );
        const usuariosMap = new Map<string, string>();

        if (usuarioIds.length > 0) {
          const { data: perfilesData, error: perfilesError } = await supabase
            .from("perfiles")
            .select("id,email")
            .in("id", usuarioIds);

          if (perfilesError) {
            throw new Error(
              `No se pudieron cargar usuarios del equipo de trabajo: ${perfilesError.message}`,
            );
          }

          (perfilesData ?? []).forEach((perfil) => {
            if (perfil.id) {
              usuariosMap.set(perfil.id, perfil.email || perfil.id);
            }
          });
        }

        setResumen(resumenRow);
        setDetalle(detalleRow);
        setEvidencias((evidenciasResp.data ?? []) as Evidencia[]);
        setFirmas((firmasResp.data ?? []) as Firma[]);
        setTiempos(
          tiemposRows.map((item) => ({
            ...item,
            usuario_nombre: usuariosMap.get(item.usuario_id) || item.usuario_id,
          })),
        );
        setChecklistResultados(
          (checklistResp.data ?? []) as ChecklistResultado[],
        );

        const db = supabase as any;
        const { data: equiposOtData, error: equiposOtError } = await db
          .from("ot_orden_equipos")
          .select("id,equipo_id,orden,descripcion_trabajo,observacion")
          .eq("ot_id", otId)
          .eq("activo", true)
          .is("deleted_at", null)
          .order("orden", { ascending: true });

        if (equiposOtError) {
          throw new Error(
            `No se pudieron cargar equipos asociados a la OM: ${equiposOtError.message}`,
          );
        }

        const equiposOtRows = (equiposOtData ?? []) as Array<{
          id: string;
          equipo_id: string;
          orden: number | null;
          descripcion_trabajo: string | null;
          observacion: string | null;
        }>;

        const equipoIds = Array.from(
          new Set(equiposOtRows.map((item) => item.equipo_id).filter(Boolean)),
        );

        let equiposInfoMap = new Map<string, Partial<EquipoAsociadoInforme>>();

        if (equipoIds.length > 0) {
          const { data: equiposInfoData, error: equiposInfoError } = await db
            .from("ot_equipos")
            .select(
              "id,tag,nombre,descripcion,tipo_equipo,planta,area,linea,ubicacion,marca,modelo,serie,potencia,criticidad,estado",
            )
            .in("id", equipoIds);

          if (equiposInfoError) {
            throw new Error(
              `No se pudieron cargar datos de equipos asociados: ${equiposInfoError.message}`,
            );
          }

          equiposInfoMap = new Map(
            ((equiposInfoData ?? []) as Array<{
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
              estado: string | null;
            }>).map((equipo) => [
              equipo.id,
              {
                tag: equipo.tag,
                nombre: equipo.nombre,
                descripcion: equipo.descripcion,
                tipo_equipo: equipo.tipo_equipo,
                planta: equipo.planta,
                area: equipo.area,
                linea: equipo.linea,
                ubicacion: equipo.ubicacion,
                marca: equipo.marca,
                modelo: equipo.modelo,
                serie: equipo.serie,
                potencia: equipo.potencia,
                criticidad: equipo.criticidad,
                estado_equipo: equipo.estado,
              },
            ]),
          );
        }

        const equiposInforme = equiposOtRows.map((item) => ({
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
          estado_equipo: equiposInfoMap.get(item.equipo_id)?.estado_equipo ?? null,
        })) as EquipoAsociadoInforme[];

        setEquiposAsociados(equiposInforme);

        const { data: checklistEquipoData, error: checklistEquipoError } = await db
          .from("ot_equipo_checklist_resultados")
          .select(
            "id,ot_orden_equipo_id,equipo_id,plantilla_item_id,respuesta_texto,respuesta_boolean,observacion_antes,observacion_despues,accion_realizada,recomendacion_tecnica,evidencia_antes_url,evidencia_despues_url",
          )
          .eq("ot_id", otId);

        if (checklistEquipoError) {
          throw new Error(
            `No se pudo cargar checklist técnico por equipo: ${checklistEquipoError.message}`,
          );
        }

        const checklistEquipoRows = (checklistEquipoData ?? []) as Array<{
          id: string;
          ot_orden_equipo_id: string;
          equipo_id: string;
          plantilla_item_id: string;
          respuesta_texto: string | null;
          respuesta_boolean: boolean | null;
          observacion_antes: string | null;
          observacion_despues: string | null;
          accion_realizada: string | null;
          recomendacion_tecnica: string | null;
          evidencia_antes_url: string | null;
          evidencia_despues_url: string | null;
        }>;

        const plantillaItemIds = Array.from(
          new Set(
            checklistEquipoRows
              .map((item) => item.plantilla_item_id)
              .filter(Boolean),
          ),
        );

        let plantillaItemsMap = new Map<string, Partial<EquipoChecklistInforme>>();

        if (plantillaItemIds.length > 0) {
          const { data: plantillaItemsData, error: plantillaItemsError } = await db
            .from("ot_plantillas_checklist_items")
            .select(
              "id,zona,categoria,actividad,frecuencia_horas,indicaciones,orden,requiere_evidencia",
            )
            .in("id", plantillaItemIds);

          if (plantillaItemsError) {
            throw new Error(
              `No se pudieron cargar ítems de checklist por equipo: ${plantillaItemsError.message}`,
            );
          }

          plantillaItemsMap = new Map(
            ((plantillaItemsData ?? []) as Array<{
              id: string;
              zona: string | null;
              categoria: string | null;
              actividad: string | null;
              frecuencia_horas: number | null;
              indicaciones: string | null;
              orden: number | null;
              requiere_evidencia: boolean | null;
            }>).map((item) => [
              item.id,
              {
                item_zona: item.zona,
                item_categoria: item.categoria,
                item_actividad: item.actividad,
                item_frecuencia_horas: item.frecuencia_horas,
                item_indicaciones: item.indicaciones,
                item_orden: item.orden,
                item_requiere_evidencia: item.requiere_evidencia,
              },
            ]),
          );
        }

        setChecklistEquipoResultados(
          checklistEquipoRows
            .map((row) => ({
              ...row,
              item_zona: plantillaItemsMap.get(row.plantilla_item_id)?.item_zona ?? null,
              item_categoria: plantillaItemsMap.get(row.plantilla_item_id)?.item_categoria ?? null,
              item_actividad: plantillaItemsMap.get(row.plantilla_item_id)?.item_actividad ?? null,
              item_frecuencia_horas:
                plantillaItemsMap.get(row.plantilla_item_id)?.item_frecuencia_horas ?? null,
              item_indicaciones:
                plantillaItemsMap.get(row.plantilla_item_id)?.item_indicaciones ?? null,
              item_orden: plantillaItemsMap.get(row.plantilla_item_id)?.item_orden ?? null,
              item_requiere_evidencia:
                plantillaItemsMap.get(row.plantilla_item_id)?.item_requiere_evidencia ?? null,
            }))
            .sort((a, b) => (a.item_orden ?? 9999) - (b.item_orden ?? 9999)) as EquipoChecklistInforme[],
        );

        if (resumenRow.equipo_id) {
          const informeResp = await supabase
            .from("ot_informes_tecnicos")
            .select("*")
            .eq("ot_id", otId)
            .eq("plantilla_codigo", "softys_om")
            .maybeSingle();

          if (informeResp.error) {
            throw new Error(
              `No se pudo cargar informe técnico: ${informeResp.error.message}`,
            );
          }

          if (informeResp.data) {
            const informeRow = informeResp.data as InformeTecnico;
            setInforme(informeRow);
            setInformeDatos(mergeInformeDatos(informeRow.datos));
          } else {
            const datosIniciales = mergeInformeDatos({
              numero_orden_cliente: "",
              descripcion_trabajo:
                detalleRow.descripcion_solicitud || detalleRow.titulo || "",
              empresa_contratista: "DyF Ingeniería y Mantenimiento Industrial",
              sistema: resumenRow.equipo_planta || "",
              sub_sistema: resumenRow.equipo_area || "",
              sub_equipo: resumenRow.equipo_tipo || "",
              criticidad: "",
              frecuencia: "",
              codigo_sap: "",
              responsable_softys:
                detalleRow.contacto_cliente_nombre ||
                detalleRow.cliente_nombre_firma ||
                "",
              cargo_responsable_softys:
                detalleRow.contacto_cliente_cargo ||
                detalleRow.cliente_cargo_firma ||
                "",
              supervisor_contratista: "",
              cargo_supervisor_contratista: "Supervisor / Técnico DyF",
              alcance:
                detalleRow.problema_reportado || detalleRow.diagnostico || "",
              detalle_trabajo_realizado:
                detalleRow.trabajo_realizado ||
                detalleRow.resultado_servicio ||
                "",
              herramientas_materiales: detalleRow.observaciones_cierre || "",
              recomendaciones_seguridad: detalleRow.recomendaciones || "",
            });

            // En desarrollo, React/Next puede ejecutar este efecto dos veces.
            // Usamos upsert para evitar error por duplicado si el informe ya fue creado
            // por una ejecución anterior del mismo render.
            const nuevoInformeResp = await supabase
              .from("ot_informes_tecnicos")
              .upsert(
                {
                  empresa_id: resumenRow.empresa_id,
                  ot_id: resumenRow.id,
                  plantilla_codigo: "softys_om",
                  estado: "borrador",
                  datos: datosIniciales,
                },
                { onConflict: "ot_id,plantilla_codigo" },
              )
              .select("*")
              .single();

            if (nuevoInformeResp.error) {
              throw new Error(
                `No se pudo crear o cargar informe técnico: ${nuevoInformeResp.error.message}`,
              );
            }

            const informeRow = nuevoInformeResp.data as InformeTecnico;
            setInforme(informeRow);
            setInformeDatos(
              mergeInformeDatos(informeRow.datos || datosIniciales),
            );
          }
        } else {
          setInforme(null);
          setInformeDatos(datosDefault);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo cargar el informe.",
        );
      } finally {
        setLoading(false);
      }
    };

    if (otId) loadData();
  }, [otId]);

  function setCampoInforme<K extends keyof InformeDatos>(
    campo: K,
    valor: InformeDatos[K],
  ) {
    setSaveOk("");
    setSaveError("");
    setInformeDatos((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }

  function setChecklistInforme(
    campo: keyof NonNullable<InformeDatos["checklist_recepcion"]>,
    valor: boolean,
  ) {
    setSaveOk("");
    setSaveError("");
    setInformeDatos((prev) => ({
      ...prev,
      checklist_recepcion: {
        ...prev.checklist_recepcion,
        [campo]: valor,
      },
    }));
  }

  function setChecklistTecnico(
    id: string,
    campo: "estado" | "valor_texto" | "valor_numero" | "observacion",
    valor: string,
  ) {
    setSaveOk("");
    setSaveError("");
    setChecklistResultados((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (campo === "valor_numero") {
          return {
            ...item,
            valor_numero: valor === "" ? null : Number(valor),
          };
        }

        return {
          ...item,
          [campo]: valor,
        };
      }),
    );
  }

  function setChecklistDato(
    id: string,
    campo: string,
    valor: boolean | string,
  ) {
    setSaveOk("");
    setSaveError("");
    setChecklistResultados((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        return {
          ...item,
          datos: {
            ...(item.datos || {}),
            [campo]: valor,
          },
        };
      }),
    );
  }

  function setEncontradoExclusivo(id: string, campo: string, checked: boolean) {
    setSaveOk("");
    setSaveError("");
    setChecklistResultados((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const currentDatos = { ...(item.datos || {}) };
        encontradoKeys.forEach((entry) => {
          currentDatos[entry.key] = false;
        });
        currentDatos[campo] = checked;

        return {
          ...item,
          datos: currentDatos,
        };
      }),
    );
  }

  async function generarChecklistMotorMt() {
    try {
      setSavingInforme(true);
      setSaveOk("");
      setSaveError("");

      const { error: rpcError } = await supabase.rpc(
        "ot_generar_checklist_motor_mt_ot",
        {
          p_ot_id: otId,
        },
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const { data, error: checklistError } = await supabase
        .from("ot_vw_checklist_resultados")
        .select(
          "id,empresa_id,ot_id,plantilla_id,plantilla_codigo,plantilla_nombre,item_id,item_codigo,seccion,orden,actividad,tipo_respuesta,item_unidad,requerido,ayuda,estado,valor_texto,valor_numero,unidad,observacion,datos,item_config,plantilla_config,created_at,updated_at",
        )
        .eq("ot_id", otId)
        .order("orden", { ascending: true });

      if (checklistError) {
        throw new Error(checklistError.message);
      }

      setChecklistResultados((data ?? []) as ChecklistResultado[]);
      setSaveOk("Checklist técnico generado correctamente.");
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "No se pudo generar el checklist técnico.",
      );
    } finally {
      setSavingInforme(false);
    }
  }

  async function guardarInformeTecnico() {
    if (!informe) {
      setSaveError("No existe informe técnico para guardar.");
      return;
    }

    try {
      setSavingInforme(true);
      setSaveOk("");
      setSaveError("");

      const { error: updateError } = await supabase
        .from("ot_informes_tecnicos")
        .update({
          datos: informeDatos,
          estado: "borrador",
        })
        .eq("id", informe.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (checklistResultados.length > 0) {
        const checklistUpdates = checklistResultados.map((item) =>
          supabase
            .from("ot_checklist_resultados")
            .update({
              estado: item.estado || "pendiente",
              valor_texto: item.valor_texto,
              valor_numero: item.valor_numero,
              unidad: item.unidad || item.item_unidad,
              observacion: item.observacion,
              datos: item.datos || {},
            })
            .eq("id", item.id),
        );

        const checklistResponses = await Promise.all(checklistUpdates);
        const checklistError = checklistResponses.find(
          (response) => response.error,
        )?.error;

        if (checklistError) {
          throw new Error(checklistError.message);
        }
      }

      setSaveOk("Informe y checklist técnico guardados correctamente.");
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el informe técnico.",
      );
    } finally {
      setSavingInforme(false);
    }
  }

  const evidenciasImagenes = useMemo(() => {
    return evidencias.filter((item) => {
      const url = item.archivo_url || "";
      const nombre = item.archivo_nombre || "";
      return (
        /\.(png|jpg|jpeg|webp|gif)$/i.test(url) ||
        /\.(png|jpg|jpeg|webp|gif)$/i.test(nombre)
      );
    });
  }, [evidencias]);

  const firmaCliente = firmas.find((item) => item.tipo_firma === "cliente");
  const firmaTecnico = firmas.find((item) => item.tipo_firma === "tecnico");
  const firmaSupervisor = firmas.find(
    (item) => item.tipo_firma === "supervisor",
  );

  const documentTitle = useMemo(() => buildDocumentTitle(resumen), [resumen]);

  useEffect(() => {
    if (!resumen) return;

    const previousTitle = document.title;
    document.title = documentTitle;

    return () => {
      document.title = previousTitle;
    };
  }, [resumen, documentTitle]);

  if (loading) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando informe...
        </div>
      </ProtectedModuleRoute>
    );
  }

  if (error || !resumen || !detalle) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
            {error || "No se encontró la OT."}
          </div>
          <Link
            href={`/ot/${otId}`}
            className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Volver a la OT
          </Link>
        </div>
      </ProtectedModuleRoute>
    );
  }

  const equipoUbicacion = buildLocation(resumen);
  const equipoCaracteristicas = buildEquipoCaracteristicas(resumen);

  const responsableSoftys =
    informeDatos.responsable_softys ||
    detalle.contacto_cliente_nombre ||
    detalle.cliente_nombre_firma;

  const cargoResponsableSoftys =
    informeDatos.cargo_responsable_softys ||
    detalle.contacto_cliente_cargo ||
    detalle.cliente_cargo_firma;

  const supervisorContratista =
    informeDatos.supervisor_contratista ||
    firmaSupervisor?.nombre_firmante ||
    firmaTecnico?.nombre_firmante;

  const cargoSupervisorContratista =
    informeDatos.cargo_supervisor_contratista ||
    firmaSupervisor?.cargo_firmante ||
    firmaTecnico?.cargo_firmante ||
    "Supervisor / Técnico DyF";

  const descripcionTrabajo =
    informeDatos.descripcion_trabajo ||
    detalle.descripcion_solicitud ||
    detalle.titulo;

  const alcanceTrabajo =
    informeDatos.alcance || detalle.problema_reportado || detalle.diagnostico;

  const detalleTrabajoRealizado =
    informeDatos.detalle_trabajo_realizado ||
    detalle.trabajo_realizado ||
    detalle.resultado_servicio;

  const herramientasMateriales =
    informeDatos.herramientas_materiales || detalle.observaciones_cierre;

  const recomendacionesSeguridad =
    informeDatos.recomendaciones_seguridad || detalle.recomendaciones;

  const totalMinutosEquipo = tiempos.reduce(
    (total, item) => total + (item.duracion_minutos || 0),
    0,
  );
  const integrantesUnicos = new Set(
    tiempos.map((item) => nombreUsuarioTiempo(item)).filter(Boolean),
  ).size;

  const checklistPorSeccion = checklistResultados.reduce<
    Record<string, ChecklistResultado[]>
  >((acc, item) => {
    const key = item.seccion || "Checklist técnico";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const equiposInforme = equiposAsociados.length > 0
    ? equiposAsociados
    : resumen.equipo_id
      ? [
          {
            id: resumen.equipo_id,
            equipo_id: resumen.equipo_id,
            orden: 1,
            descripcion_trabajo: detalle.descripcion_solicitud || detalle.titulo,
            observacion: null,
            tag: resumen.equipo_tag,
            nombre: resumen.equipo_nombre,
            descripcion: resumen.equipo_descripcion,
            tipo_equipo: resumen.equipo_tipo,
            planta: resumen.equipo_planta,
            area: resumen.equipo_area,
            linea: resumen.equipo_linea,
            ubicacion: resumen.equipo_ubicacion,
            marca: resumen.equipo_marca,
            modelo: resumen.equipo_modelo,
            serie: resumen.equipo_serie,
            potencia: resumen.equipo_potencia,
            criticidad: null,
            estado_equipo: null,
          },
        ] as EquipoAsociadoInforme[]
      : [];

  const checklistEquipoPorAsociacion = checklistEquipoResultados.reduce<
    Record<string, EquipoChecklistInforme[]>
  >((acc, item) => {
    const key = item.ot_orden_equipo_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const totalChecklistEquipo = checklistEquipoResultados.length;
  const totalChecklistRespondido = checklistEquipoResultados.filter((item) =>
    Boolean(item.respuesta_texto),
  ).length;
  const totalChecklistObservado = checklistEquipoResultados.filter(
    (item) => item.respuesta_texto === "no_ok",
  ).length;
  const totalFotosChecklist = checklistEquipoResultados.reduce(
    (total, item) =>
      total + (item.evidencia_antes_url ? 1 : 0) + (item.evidencia_despues_url ? 1 : 0),
    0,
  );

  return (
    <ProtectedModuleRoute moduleKey="ot">
      <div className="screen-actions">
        <Link href={`/ot/${otId}`} className="action-secondary">
          Volver a la OT
        </Link>
        {informe ? (
          <button
            type="button"
            onClick={guardarInformeTecnico}
            disabled={savingInforme}
            className="action-secondary"
          >
            {savingInforme ? "Guardando..." : "Guardar borrador"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            document.title = documentTitle;
            window.print();
          }}
          className="action-primary"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {resumen.equipo_id ? (
        <section className="screen-edit-panel">
          <div className="mb-4">
            <h2 className="text-lg font-black text-slate-900">
              Datos manuales del informe DyF / Softys
            </h2>
            <p className="text-sm text-slate-500">
              Estos datos complementan la OM principal y se utilizarán en el
              informe técnico del cliente.
            </p>
          </div>

          {saveOk ? (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {saveOk}
            </div>
          ) : null}

          {saveError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {saveError}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <TextInput
              label="N° orden cliente / Softys"
              value={informeDatos.numero_orden_cliente || ""}
              onChange={(value) =>
                setCampoInforme("numero_orden_cliente", value)
              }
            />
            <TextInput
              label="Empresa contratista"
              value={informeDatos.empresa_contratista || ""}
              onChange={(value) =>
                setCampoInforme("empresa_contratista", value)
              }
            />
            <TextInput
              label="Sistema"
              value={informeDatos.sistema || ""}
              onChange={(value) => setCampoInforme("sistema", value)}
            />
            <TextInput
              label="Sub-sistema"
              value={informeDatos.sub_sistema || ""}
              onChange={(value) => setCampoInforme("sub_sistema", value)}
            />
            <TextInput
              label="Sub-equipo"
              value={informeDatos.sub_equipo || ""}
              onChange={(value) => setCampoInforme("sub_equipo", value)}
            />
            <TextInput
              label="Criticidad"
              value={informeDatos.criticidad || ""}
              onChange={(value) => setCampoInforme("criticidad", value)}
            />
            <TextInput
              label="Frecuencia"
              value={informeDatos.frecuencia || ""}
              onChange={(value) => setCampoInforme("frecuencia", value)}
            />
            <TextInput
              label="Código SAP"
              value={informeDatos.codigo_sap || ""}
              onChange={(value) => setCampoInforme("codigo_sap", value)}
            />
            <TextInput
              label="Evaluación general"
              value={informeDatos.evaluacion_general || ""}
              onChange={(value) => setCampoInforme("evaluacion_general", value)}
            />
            <TextInput
              label="Responsable Softys"
              value={informeDatos.responsable_softys || ""}
              onChange={(value) => setCampoInforme("responsable_softys", value)}
            />
            <TextInput
              label="Cargo responsable Softys"
              value={informeDatos.cargo_responsable_softys || ""}
              onChange={(value) =>
                setCampoInforme("cargo_responsable_softys", value)
              }
            />
            <TextInput
              label="Supervisor contratista"
              value={informeDatos.supervisor_contratista || ""}
              onChange={(value) =>
                setCampoInforme("supervisor_contratista", value)
              }
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextAreaInput
              label="Descripción del trabajo"
              value={informeDatos.descripcion_trabajo || ""}
              onChange={(value) =>
                setCampoInforme("descripcion_trabajo", value)
              }
            />
            <TextAreaInput
              label="Alcance"
              value={informeDatos.alcance || ""}
              onChange={(value) => setCampoInforme("alcance", value)}
            />
            <TextAreaInput
              label="Equipo de trabajo / complemento manual"
              value={informeDatos.equipo_trabajo || ""}
              onChange={(value) => setCampoInforme("equipo_trabajo", value)}
            />
            <TextAreaInput
              label="Herramientas / materiales"
              value={informeDatos.herramientas_materiales || ""}
              onChange={(value) =>
                setCampoInforme("herramientas_materiales", value)
              }
            />
            <TextAreaInput
              label="Detalle del trabajo realizado"
              value={informeDatos.detalle_trabajo_realizado || ""}
              onChange={(value) =>
                setCampoInforme("detalle_trabajo_realizado", value)
              }
              rows={5}
            />
            <TextAreaInput
              label="Recomendaciones de seguridad"
              value={informeDatos.recomendaciones_seguridad || ""}
              onChange={(value) =>
                setCampoInforme("recomendaciones_seguridad", value)
              }
              rows={5}
            />
            <TextAreaInput
              label="Cumplimiento del programa"
              value={informeDatos.cumplimiento_programa || ""}
              onChange={(value) =>
                setCampoInforme("cumplimiento_programa", value)
              }
            />
            <TextAreaInput
              label="Observaciones de recepción"
              value={informeDatos.observaciones_recepcion || ""}
              onChange={(value) =>
                setCampoInforme("observaciones_recepcion", value)
              }
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <CheckInput
              label="Alcance ejecutado"
              checked={!!informeDatos.checklist_recepcion?.alcance_ejecutado}
              onChange={(value) =>
                setChecklistInforme("alcance_ejecutado", value)
              }
            />
            <CheckInput
              label="Área limpia y ordenada"
              checked={!!informeDatos.checklist_recepcion?.area_limpia}
              onChange={(value) => setChecklistInforme("area_limpia", value)}
            />
            <CheckInput
              label="Seguridad cumplida"
              checked={!!informeDatos.checklist_recepcion?.seguridad_cumplida}
              onChange={(value) =>
                setChecklistInforme("seguridad_cumplida", value)
              }
            />
            <CheckInput
              label="Plazo cumplido"
              checked={!!informeDatos.checklist_recepcion?.plazo_cumplido}
              onChange={(value) => setChecklistInforme("plazo_cumplido", value)}
            />
            <CheckInput
              label="Pruebas realizadas"
              checked={!!informeDatos.checklist_recepcion?.pruebas_realizadas}
              onChange={(value) =>
                setChecklistInforme("pruebas_realizadas", value)
              }
            />
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-bold text-blue-950">Checklist técnico por equipo</p>
            <p className="mt-1">
              El detalle técnico y las fotos antes/después se completan desde el detalle de la OM,
              en la sección “Checklist técnico por equipo”. Este informe consolida automáticamente
              esas respuestas por cada motor asociado.
            </p>
          </div>
        </section>
      ) : (
        <div className="mx-auto mb-4 max-w-[980px] rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 print:hidden">
          Esta OT no tiene equipo/TAG asociado. El informe DyF / Softys se
          mantiene solo para OT industriales con equipo.
        </div>
      )}

      <main className="report-page">
        <style jsx global>{`
          body {
            background: #f1f5f9;
          }

          .screen-actions {
            max-width: 980px;
            margin: 0 auto 16px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          }

          .action-primary,
          .action-secondary {
            border-radius: 14px;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
            border: 1px solid #cbd5e1;
            cursor: pointer;
          }

          .action-primary {
            background: #163a5f;
            color: #ffffff;
            border-color: #163a5f;
          }

          .action-secondary {
            background: #ffffff;
            color: #334155;
          }

          .screen-edit-panel {
            max-width: 980px;
            margin: 0 auto 16px;
            border: 1px solid #dbe3ea;
            border-radius: 24px;
            background: #ffffff;
            padding: 22px;
            box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
          }

          .report-page {
            max-width: 980px;
            margin: 0 auto;
            background: #ffffff;
            color: #0f172a;
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
            border-radius: 24px;
            overflow: hidden;
            font-family: Arial, Helvetica, sans-serif;
          }

          .report-header {
            display: grid;
            grid-template-columns: 1fr 1.5fr 1fr;
            align-items: center;
            gap: 22px;
            padding: 24px 30px 18px;
            border-bottom: 4px solid #163a5f;
          }

          .logo-wrap {
            height: 82px;
            display: flex;
            align-items: center;
          }

          .logo-wrap.right {
            justify-content: flex-end;
          }

          .logo-wrap img {
            max-height: 76px;
            max-width: 210px;
            object-fit: contain;
          }

          .header-title {
            text-align: center;
          }

          .header-title p {
            margin: 0;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .header-title h1 {
            margin: 7px 0 0;
            color: #0f172a;
            font-size: 22px;
            line-height: 1.15;
            font-weight: 900;
            text-transform: uppercase;
          }

          .header-title strong {
            display: block;
            margin-top: 8px;
            font-size: 14px;
            color: #163a5f;
          }

          .report-body {
            padding: 24px 30px 32px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            overflow: hidden;
            margin-bottom: 16px;
            background: #ffffff;
          }

          .summary-grid .field {
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
          }

          .summary-grid .field:nth-child(4n) {
            border-right: 0;
          }

          .field {
            min-height: 52px;
            padding: 8px 10px;
            background: #ffffff;
          }

          .field span {
            display: block;
            color: #64748b;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.09em;
            line-height: 1.2;
            text-transform: uppercase;
          }

          .field strong {
            display: block;
            margin-top: 4px;
            color: #0f172a;
            font-size: 12px;
            line-height: 1.28;
            font-weight: 700;
          }

          .section-block {
            margin-top: 16px;
            break-inside: avoid;
          }

          .section-block h2 {
            margin: 0 0 8px;
            padding: 7px 11px;
            color: #ffffff;
            background: #163a5f;
            border-radius: 10px;
            font-size: 12px;
            line-height: 1.2;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .label-title {
            margin: 0 0 6px;
            color: #334155;
            font-size: 11px;
            line-height: 1.2;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .two-col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .three-col {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }

          .text-box {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 10px 12px;
            color: #0f172a;
            font-size: 12px;
            line-height: 1.5;
            white-space: pre-wrap;
            background: #ffffff;
          }

          .muted {
            color: #94a3b8;
            font-style: italic;
          }

          .reception-table {
            width: 100%;
            border-collapse: collapse;
            overflow: hidden;
            border-radius: 14px;
            font-size: 12px;
          }

          .reception-table th,
          .reception-table td {
            border: 1px solid #e2e8f0;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }

          .reception-table th {
            background: #f8fafc;
            color: #475569;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .checkbox-cell {
            width: 46px;
            text-align: center !important;
            font-weight: 800;
            color: #64748b;
          }

          .technical-checklist-table {
            width: 100%;
            border-collapse: collapse;
            overflow: hidden;
            border-radius: 12px;
            font-size: 10.5px;
          }

          .technical-checklist-table th,
          .technical-checklist-table td {
            border: 1px solid #e2e8f0;
            padding: 7px;
            text-align: left;
            vertical-align: top;
          }

          .technical-checklist-table th {
            background: #f8fafc;
            color: #475569;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .softys-matrix-table {
            font-size: 8.5px;
          }

          .softys-matrix-table th,
          .softys-matrix-table td {
            padding: 4px;
          }

          .softys-matrix-table th {
            text-align: center;
            vertical-align: middle;
          }

          .matrix-center {
            text-align: center !important;
            white-space: nowrap;
          }

          .status-pill {
            display: inline-block;
            border-radius: 999px;
            border: 1px solid #cbd5e1;
            padding: 3px 8px;
            font-size: 10px;
            font-weight: 800;
            color: #334155;
            background: #f8fafc;
          }

          .evidence-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .evidence-card {
            border: 1px solid #dbe3ea;
            border-radius: 16px;
            overflow: hidden;
            break-inside: avoid;
          }

          .evidence-card img {
            width: 100%;
            height: 230px;
            object-fit: cover;
            display: block;
            background: #f8fafc;
          }

          .evidence-card p {
            margin: 0;
            padding: 10px 12px;
            font-size: 12px;
            color: #475569;
          }

          .small-note {
            margin: 0 0 10px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.45;
          }

          .equipment-list,
          .equipment-checklist-list,
          .checklist-item-list {
            display: grid;
            gap: 12px;
          }

          .equipment-card,
          .equipment-checklist-block,
          .checklist-item-card {
            border: 1px solid #dbe3ea;
            border-radius: 16px;
            background: #ffffff;
            padding: 12px;
            break-inside: avoid;
          }

          .equipment-card-header,
          .checklist-equipment-title {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
          }

          .equipment-card-header span,
          .checklist-equipment-title span {
            border-radius: 999px;
            background: #163a5f;
            color: #ffffff;
            padding: 4px 8px;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .equipment-card-header strong,
          .checklist-equipment-title strong {
            color: #0f172a;
            font-size: 14px;
            font-weight: 900;
          }

          .checklist-equipment-title small {
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
          }

          .equipment-meta-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
          }

          .equipment-meta-grid .field {
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
          }

          .equipment-note {
            margin-top: 10px;
            border-radius: 12px;
            background: #f8fafc;
            padding: 9px 10px;
            color: #475569;
            font-size: 12px;
            line-height: 1.45;
          }

          .equipment-note p {
            margin: 0;
          }

          .checklist-item-head {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 12px;
            align-items: start;
            margin-bottom: 10px;
          }

          .checklist-item-head h3 {
            margin: 2px 0 0;
            color: #0f172a;
            font-size: 13px;
            line-height: 1.35;
            font-weight: 900;
          }

          .checklist-zone,
          .checklist-help {
            margin: 0;
            color: #64748b;
            font-size: 10.5px;
            line-height: 1.4;
          }

          .checklist-help {
            margin-top: 4px;
            font-size: 11px;
          }

          .status-ok {
            border-color: #bbf7d0;
            background: #f0fdf4;
            color: #166534;
          }

          .status-no-ok {
            border-color: #fecdd3;
            background: #fff1f2;
            color: #be123c;
          }

          .status-na {
            border-color: #cbd5e1;
            background: #f8fafc;
            color: #475569;
          }

          .status-pending {
            border-color: #fde68a;
            background: #fffbeb;
            color: #92400e;
          }

          .checklist-detail-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .checklist-evidence-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-top: 10px;
          }

          .checklist-evidence-card {
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            overflow: hidden;
            background: #f8fafc;
          }

          .checklist-evidence-card p {
            margin: 0;
            padding: 7px 9px;
            color: #334155;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .checklist-evidence-card img,
          .no-image {
            width: 100%;
            height: 170px;
            object-fit: cover;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            font-size: 11px;
            background: #f1f5f9;
          }

          .firma-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
          }

          .firma-box {
            border: 1px solid #dbe3ea;
            border-radius: 16px;
            padding: 14px;
            min-height: 160px;
          }

          .firma-title {
            margin: 0;
            color: #163a5f;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .firma-area {
            height: 72px;
            border-bottom: 1px solid #94a3b8;
            margin: 10px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #cbd5e1;
            font-size: 12px;
          }

          .firma-area img {
            max-height: 64px;
            max-width: 100%;
            object-fit: contain;
          }

          .firma-name {
            margin: 4px 0 0;
            color: #0f172a;
            font-size: 13px;
            font-weight: 800;
          }

          .firma-role {
            margin: 2px 0 0;
            color: #64748b;
            font-size: 12px;
          }

          .footer-note {
            margin-top: 22px;
            border-top: 1px solid #dbe3ea;
            padding-top: 12px;
            color: #64748b;
            font-size: 11px;
            text-align: center;
          }

          @page {
            size: A4;
            margin: 10mm;
          }

          @media print {
            body {
              background: #ffffff !important;
            }

            .screen-actions,
            .screen-edit-panel,
            aside,
            header,
            nav {
              display: none !important;
            }

            .report-page {
              max-width: none;
              width: 100%;
              margin: 0;
              box-shadow: none;
              border-radius: 0;
            }

            .report-header {
              padding: 0 0 16px;
            }

            .report-body {
              padding: 18px 0 0;
            }

            .section-block {
              page-break-inside: avoid;
            }

            .evidence-card img,
            .checklist-evidence-card img,
            .no-image {
              height: 145px;
            }
          }
        `}</style>

        <div className="report-header">
          <div className="logo-wrap">
            <img
              src={DYF_LOGO}
              alt="DyF Ingeniería y Mantenimiento Industrial"
            />
          </div>

          <div className="header-title">
            <p>Informe de OM</p>
            <h1>Orden de Trabajo / Informe Técnico</h1>
            <strong>{labelOrDash(resumen.folio)}</strong>
          </div>

          <div className="logo-wrap right">
            <img src={SOFTYS_LOGO} alt="Softys" />
          </div>
        </div>

        <div className="report-body">
          <div className="summary-grid">
            <Field
              label="N° orden cliente / Softys"
              value={informeDatos.numero_orden_cliente}
            />
            <Field
              label="Cliente final"
              value={resumen.cliente_nombre || "Softys"}
            />
            <Field
              label="Empresa contratista"
              value={
                informeDatos.empresa_contratista ||
                "DyF Ingeniería y Mantenimiento Industrial"
              }
            />
            <Field
              label="Tipo de servicio"
              value={resumen.tipo_servicio_nombre}
            />
            <Field label="Estado" value={resumen.estado_nombre} />
            <Field label="Fecha OT" value={formatDate(detalle.fecha_ot)} />
            <Field
              label="Fecha programada"
              value={formatDate(detalle.fecha_programada)}
            />
            <Field label="Inicio" value={formatDateTime(detalle.hora_inicio)} />
            <Field
              label="Término"
              value={formatDateTime(detalle.hora_termino)}
            />
            <Field
              label="Duración"
              value={formatMinutes(detalle.duracion_minutos)}
            />
            <Field
              label="Responsable Softys / receptor"
              value={responsableSoftys}
            />
            <Field label="Cargo receptor" value={cargoResponsableSoftys} />
            <Field
              label="Área de trabajo"
              value={detalle.area_trabajo || resumen.equipo_area}
            />
          </div>

          <Section title="Equipos / motores asociados a la OM">
            {equiposInforme.length > 0 ? (
              <div className="equipment-list">
                {equiposInforme.map((equipo, index) => {
                  const itemsEquipo = checklistEquipoPorAsociacion[equipo.id] || [];
                  const respondidosEquipo = itemsEquipo.filter((item) => item.respuesta_texto).length;
                  const fotosEquipo = itemsEquipo.reduce(
                    (total, item) =>
                      total + (item.evidencia_antes_url ? 1 : 0) + (item.evidencia_despues_url ? 1 : 0),
                    0,
                  );

                  return (
                    <div className="equipment-card" key={equipo.id}>
                      <div className="equipment-card-header">
                        <span>Equipo {index + 1}</span>
                        <strong>{equipoInformeNombre(equipo)}</strong>
                      </div>
                      <div className="equipment-meta-grid">
                        <Field label="Tipo" value={equipo.tipo_equipo} />
                        <Field label="Ubicación" value={equipoInformeUbicacion(equipo)} />
                        <Field label="Marca / Modelo / Potencia" value={equipoInformeCaracteristicas(equipo)} />
                        <Field label="Serie" value={equipo.serie} />
                        <Field label="Criticidad" value={equipo.criticidad} />
                        <Field label="Checklist" value={`${respondidosEquipo}/${itemsEquipo.length} respondidos`} />
                        <Field label="Fotos checklist" value={fotosEquipo > 0 ? `${fotosEquipo} foto(s)` : "-"} />
                      </div>
                      {equipo.descripcion_trabajo || equipo.observacion ? (
                        <div className="equipment-note">
                          {equipo.descripcion_trabajo ? (
                            <p><strong>Trabajo solicitado:</strong> {equipo.descripcion_trabajo}</p>
                          ) : null}
                          {equipo.observacion ? (
                            <p><strong>Observación:</strong> {equipo.observacion}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <TextBox value="No hay equipos asociados a esta OM." minHeight={60} />
            )}
          </Section>

          <Section title="Resumen de checklist y evidencias técnicas">
            <div className="summary-grid">
              <Field label="Equipos asociados" value={equiposInforme.length} />
              <Field label="Ítems técnicos respondidos" value={`${totalChecklistRespondido}/${totalChecklistEquipo}`} />
              <Field label="Ítems No OK" value={totalChecklistObservado} />
              <Field label="Fotos antes/después" value={totalFotosChecklist} />
            </div>
          </Section>

          <Section title="Descripción y alcance del trabajo">
            <div className="two-col">
              <div>
                <p className="label-title">Descripción / solicitud</p>
                <TextBox value={descripcionTrabajo} minHeight={105} />
              </div>
              <div>
                <p className="label-title">Alcance / diagnóstico</p>
                <TextBox value={alcanceTrabajo} minHeight={105} />
              </div>
            </div>
          </Section>

          <Section title="Detalle de trabajo realizado">
            <TextBox value={detalleTrabajoRealizado} minHeight={125} />

            <div className="two-col" style={{ marginTop: 12 }}>
              <div>
                <p className="label-title">Hallazgos</p>
                <TextBox value={detalle.hallazgos} minHeight={80} />
              </div>
              <div>
                <p className="label-title">Conclusiones técnicas</p>
                <TextBox value={detalle.conclusiones_tecnicas} minHeight={80} />
              </div>
            </div>
          </Section>

          <Section title="Equipo de trabajo / horas hombre">
            {tiempos.length > 0 ? (
              <>
                <table className="reception-table">
                  <thead>
                    <tr>
                      <th>Integrante</th>
                      <th>Fecha</th>
                      <th>Tipo / función</th>
                      <th>Inicio</th>
                      <th>Término</th>
                      <th>Duración</th>
                      <th>HH</th>
                      <th>Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiempos.map((item) => (
                      <tr key={item.id}>
                        <td>{labelOrDash(nombreUsuarioTiempo(item))}</td>
                        <td>{formatDate(item.fecha)}</td>
                        <td>{labelOrDash(item.tipo_tiempo)}</td>
                        <td>{formatDateTime(item.hora_inicio)}</td>
                        <td>{formatDateTime(item.hora_termino)}</td>
                        <td>{formatMinutes(item.duracion_minutos)}</td>
                        <td>{formatHoursDecimal(item.duracion_minutos)}</td>
                        <td>{labelOrDash(item.observacion)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={6} style={{ fontWeight: 900, textAlign: "right" }}>
                        Total horas hombre calculadas
                      </td>
                      <td style={{ fontWeight: 900 }}>{formatHoursDecimal(totalMinutosEquipo)}</td>
                      <td>
                        {integrantesUnicos > 0
                          ? `${integrantesUnicos} integrante${integrantesUnicos === 1 ? "" : "s"}`
                          : "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {informeDatos.equipo_trabajo ? (
                  <div style={{ marginTop: 12 }}>
                    <p className="label-title">Complemento manual</p>
                    <TextBox value={informeDatos.equipo_trabajo} minHeight={45} />
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="small-note">
                  Sin registros automáticos de tiempo asociados a esta OT. Registrar tiempos permite calcular automáticamente las HH.
                </p>
                {informeDatos.equipo_trabajo ? (
                  <TextBox value={informeDatos.equipo_trabajo} minHeight={60} />
                ) : (
                  <TextBox value={null} minHeight={60} />
                )}
              </>
            )}
          </Section>

          <Section title="Herramientas y materiales utilizados">
            <TextBox value={herramientasMateriales} minHeight={85} />
          </Section>

                    <Section title="Checklist técnico por equipo / motor">
            {equiposInforme.length > 0 ? (
              <div className="equipment-checklist-list">
                {equiposInforme.map((equipo, index) => {
                  const itemsEquipo = checklistEquipoPorAsociacion[equipo.id] || [];

                  return (
                    <div className="equipment-checklist-block" key={`checklist-${equipo.id}`}>
                      <div className="checklist-equipment-title">
                        <span>Equipo {index + 1}</span>
                        <strong>{equipoInformeNombre(equipo)}</strong>
                        <small>{equipoInformeUbicacion(equipo)}</small>
                      </div>

                      {itemsEquipo.length > 0 ? (
                        <div className="checklist-item-list">
                          {itemsEquipo.map((item) => (
                            <div className="checklist-item-card" key={item.id}>
                              <div className="checklist-item-head">
                                <div>
                                  <p className="checklist-zone">
                                    {[item.item_zona, item.item_categoria].filter(Boolean).join(" / ") || "Checklist técnico"}
                                  </p>
                                  <h3>{item.item_actividad || "Ítem técnico"}</h3>
                                  {item.item_indicaciones ? (
                                    <p className="checklist-help">{item.item_indicaciones}</p>
                                  ) : null}
                                </div>
                                <span className={`status-pill ${estadoEquipoChecklistClass(item.respuesta_texto)}`}>
                                  {estadoEquipoChecklistLabel(item.respuesta_texto)}
                                </span>
                              </div>

                              <div className="checklist-detail-grid">
                                <div>
                                  <p className="label-title">Antes / condición encontrada</p>
                                  <TextBox value={item.observacion_antes} minHeight={52} />
                                </div>
                                <div>
                                  <p className="label-title">Acción realizada</p>
                                  <TextBox value={item.accion_realizada} minHeight={52} />
                                </div>
                                <div>
                                  <p className="label-title">Después / resultado</p>
                                  <TextBox value={item.observacion_despues} minHeight={52} />
                                </div>
                                <div>
                                  <p className="label-title">Recomendación técnica</p>
                                  <TextBox value={item.recomendacion_tecnica} minHeight={52} />
                                </div>
                              </div>

                              {hasChecklistEvidence(item) ? (
                                <div className="checklist-evidence-grid">
                                  <div className="checklist-evidence-card">
                                    <p>Foto antes</p>
                                    {item.evidencia_antes_url ? (
                                      <img src={item.evidencia_antes_url} alt="Foto antes" />
                                    ) : (
                                      <div className="no-image">Sin foto antes</div>
                                    )}
                                  </div>
                                  <div className="checklist-evidence-card">
                                    <p>Foto después</p>
                                    {item.evidencia_despues_url ? (
                                      <img src={item.evidencia_despues_url} alt="Foto después" />
                                    ) : (
                                      <div className="no-image">Sin foto después</div>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <TextBox value="Este equipo aún no tiene respuestas de checklist registradas." minHeight={55} />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : checklistResultados.length > 0 ? (
              <>
                {(Object.entries(checklistPorSeccion) as [string, ChecklistResultado[]][]).map(([seccion, items]) => (
                  <div key={seccion} style={{ marginBottom: 14 }}>
                    <p className="label-title">{seccion}</p>
                    <table className="technical-checklist-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Actividad</th>
                          <th>Estado</th>
                          <th>Observación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.item_codigo}</td>
                            <td>{item.actividad}</td>
                            <td>{estadoChecklistLabel(item.estado)}</td>
                            <td>{item.observacion || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </>
            ) : (
              <TextBox value="Checklist técnico pendiente de cargar para esta OT." minHeight={60} />
            )}
          </Section>

          <Section title="Recomendaciones de seguridad y observaciones">
            <TextBox value={recomendacionesSeguridad} minHeight={90} />
          </Section>

          <Section title="Checklist de recepción del trabajo - Responsable Softys">
            <table className="reception-table">
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th>Descripción</th>
                  <th className="checkbox-cell">Sí</th>
                  <th className="checkbox-cell">No</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label:
                      "Alcance del trabajo: ¿Se ejecutó todo lo solicitado?",
                    value: informeDatos.checklist_recepcion?.alcance_ejecutado,
                  },
                  {
                    label:
                      "Limpieza y orden: ¿Se retiraron residuos y herramientas, dejando la zona limpia?",
                    value: informeDatos.checklist_recepcion?.area_limpia,
                  },
                  {
                    label:
                      "Seguridad: ¿Se respetan las normas de seguridad y protocolos?",
                    value: informeDatos.checklist_recepcion?.seguridad_cumplida,
                  },
                  {
                    label:
                      "Tiempo de ejecución: ¿Se completó dentro del plazo acordado?",
                    value: informeDatos.checklist_recepcion?.plazo_cumplido,
                  },
                  {
                    label:
                      "Funcionamiento y pruebas: ¿Se verificó el correcto funcionamiento de lo ejecutado dentro de lo posible?",
                    value: informeDatos.checklist_recepcion?.pruebas_realizadas,
                  },
                ].map((item, index) => (
                  <tr key={item.label}>
                    <td>{index + 1}</td>
                    <td>{item.label}</td>
                    <td className="checkbox-cell">{checkMark(item.value)}</td>
                    <td className="checkbox-cell">
                      {item.value === false ? "☑" : "□"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 12 }}>
              <p className="label-title">Evaluación general</p>
              <table className="reception-table">
                <tbody>
                  <tr>
                    {[
                      "Deficiente",
                      "Malo",
                      "Regular",
                      "Bueno",
                      "Excelente",
                    ].map((item) => (
                      <td key={item}>
                        {item}{" "}
                        {informeDatos.evaluacion_general === item ? "☑" : "□"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12 }}>
              <p className="label-title">Observaciones de recepción</p>
              <TextBox
                value={informeDatos.observaciones_recepcion}
                minHeight={70}
              />
            </div>
          </Section>

          <Section title="Evidencias generales adicionales">
            {evidenciasImagenes.length > 0 ? (
              <div className="evidence-grid">
                {evidenciasImagenes.map((item) => (
                  <div className="evidence-card" key={item.id}>
                    {item.archivo_url ? (
                      <img
                        src={item.archivo_url}
                        alt={
                          item.descripcion || item.archivo_nombre || "Evidencia"
                        }
                      />
                    ) : null}
                    <p>
                      {item.descripcion || item.archivo_nombre || "Evidencia"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <TextBox value={null} minHeight={70} />
            )}
          </Section>

          <Section title="Firmas">
            <div className="firma-grid">
              <FirmaBox
                title="Nombre y firma responsable Softys"
                nombre={firmaCliente?.nombre_firmante || responsableSoftys}
                cargo={firmaCliente?.cargo_firmante || cargoResponsableSoftys}
                firmaUrl={firmaCliente?.firma_url}
              />

              <FirmaBox
                title="Firma supervisor contratista"
                nombre={supervisorContratista}
                cargo={cargoSupervisorContratista}
                firmaUrl={firmaSupervisor?.firma_url || firmaTecnico?.firma_url}
              />
            </div>
          </Section>

          <p className="footer-note">
            Informe generado desde Tralixia. Este documento respalda
            técnicamente la intervención indicada y debe ser revisado por el
            responsable del trabajo.
          </p>
        </div>
      </main>
    </ProtectedModuleRoute>
  );
}
