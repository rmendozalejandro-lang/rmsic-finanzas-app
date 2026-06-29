"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ProtectedModuleRoute from "@/components/ProtectedModuleRoute";
import { supabase } from "@/lib/supabase/client";

type OTDetalle = {
  id: string;
  folio: string | null;
  empresa_id: string;
  fecha_ot: string | null;
  fecha_programada: string | null;
  hora_inicio: string | null;
  hora_termino: string | null;
  duracion_minutos: number | null;
  titulo: string | null;
  descripcion_solicitud: string | null;
  numero_om_cliente: string | null;
  area_trabajo: string | null;
  contacto_cliente_nombre: string | null;
  contacto_cliente_cargo: string | null;
  cliente_nombre_firma: string | null;
  cliente_cargo_firma: string | null;
};

type OTResumen = {
  id: string;
  folio: string | null;
  cliente_nombre: string | null;
  estado_nombre: string | null;
  tipo_servicio_nombre: string | null;
};

type InformeDatos = {
  numero_orden_cliente?: string;
  empresa_contratista?: string;
  sistema?: string;
  sub_sistema?: string;
  sub_equipo?: string;
  responsable_softys?: string;
  cargo_responsable_softys?: string;
  supervisor_contratista?: string;
  cargo_supervisor_contratista?: string;
};

type EquipoAsociado = {
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

type ChecklistItem = {
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
  condicion_equipo: string | null;
  accion_checklist: string | null;
  evidencia_antes_url: string | null;
  evidencia_despues_url: string | null;
  datos: Record<string, unknown> | null;
  item_zona: string | null;
  item_categoria: string | null;
  item_actividad: string | null;
  item_frecuencia_horas: number | null;
  item_indicaciones: string | null;
  item_orden: number | null;
};

type Firma = {
  id: string;
  tipo_firma: string;
  nombre_firmante: string | null;
  cargo_firmante: string | null;
  firma_url: string | null;
};

type MedicionMotorTipo = "resistencia_bobinas" | "aislacion";

type MedicionMotorField = {
  key: string;
  label: string;
  unidad: string;
};

const DYF_LOGO = "/logos/dyf-logo-transparente.png";
const SOFTYS_LOGO = "/logos/softys-logo.png";

const RESISTENCIA_BOBINAS_FIELDS: MedicionMotorField[] = [
  { key: "u1_u2", label: "U1 - U2", unidad: "Ω" },
  { key: "v1_v2", label: "V1 - V2", unidad: "Ω" },
  { key: "w1_w2", label: "W1 - W2", unidad: "Ω" },
];

const AISLACION_MOTOR_FIELDS: MedicionMotorField[] = [
  { key: "u_tierra", label: "U - Tierra", unidad: "MΩ" },
  { key: "v_tierra", label: "V - Tierra", unidad: "MΩ" },
  { key: "w_tierra", label: "W - Tierra", unidad: "MΩ" },
  { key: "u_v", label: "U - V", unidad: "MΩ" },
  { key: "v_w", label: "V - W", unidad: "MΩ" },
  { key: "w_u", label: "W - U", unidad: "MΩ" },
];

function labelOrDash(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function hasValue(value: string | number | null | undefined) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL");
}

function formatTimeOnly(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
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

function equipoNombre(equipo: EquipoAsociado) {
  return [equipo.tag, equipo.nombre || equipo.descripcion]
    .filter(Boolean)
    .join(" · ") || equipo.equipo_id;
}

function equipoUbicacion(equipo: EquipoAsociado) {
  return [equipo.planta, equipo.area, equipo.linea, equipo.ubicacion]
    .filter(Boolean)
    .join(" / ") || "-";
}

function equipoCaracteristicas(equipo: EquipoAsociado) {
  return [equipo.tipo_equipo, equipo.marca, equipo.modelo, equipo.potencia]
    .filter(Boolean)
    .join(" · ") || "-";
}

function estadoLabel(value: string | null | undefined) {
  if (value === "ok") return "OK";
  if (value === "no_ok") return "No OK";
  if (value === "na") return "N/A";
  return "Pendiente";
}

function estadoClass(value: string | null | undefined) {
  if (value === "ok") return "status-ok";
  if (value === "no_ok") return "status-no-ok";
  if (value === "na") return "status-na";
  return "status-pending";
}

function condicionLabel(value: string | null | undefined) {
  if (value === "muy_bueno") return "Muy bueno";
  if (value === "bueno") return "Bueno";
  if (value === "regular") return "Regular";
  if (value === "malo") return "Malo";
  if (value === "muy_malo") return "Muy malo";
  if (value === "no_aplica") return "No aplica";
  return "";
}

function accionLabel(value: string | null | undefined) {
  if (value === "check") return "Check";
  if (value === "limpieza") return "Limpieza";
  if (value === "reparacion") return "Reparación";
  if (value === "cambio") return "Cambio";
  if (value === "aviso_sap") return "Aviso SAP";
  if (value === "no_aplica") return "No aplica";
  return "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function medicionMotorTipo(item: ChecklistItem): MedicionMotorTipo | null {
  const text = normalizeText(
    [item.item_actividad, item.item_categoria, item.item_zona]
      .filter(Boolean)
      .join(" "),
  );

  if (text.includes("resistencia") && (text.includes("bobina") || text.includes("bobinas"))) {
    return "resistencia_bobinas";
  }

  if (text.includes("aislacion") && (text.includes("bobina") || text.includes("tierra"))) {
    return "aislacion";
  }

  return null;
}

function getMedicionesMotor(datos: Record<string, unknown> | null | undefined) {
  const mediciones = datos?.mediciones_motor;
  return mediciones && typeof mediciones === "object"
    ? (mediciones as Record<string, Record<string, unknown>>)
    : {};
}

function getMedicionValue(
  datos: Record<string, unknown> | null | undefined,
  tipo: MedicionMotorTipo,
  key: string,
) {
  const mediciones = getMedicionesMotor(datos);
  const grupo = mediciones[tipo];
  const value = grupo && typeof grupo === "object" ? grupo[key] : "";
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function diferenciaBobinas(datos: Record<string, unknown> | null | undefined) {
  const values = RESISTENCIA_BOBINAS_FIELDS
    .map((field) => Number(String(getMedicionValue(datos, "resistencia_bobinas", field.key)).replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length < 2) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!avg) return "";
  return `${(((max - min) / avg) * 100).toFixed(2)} %`;
}

function MedicionTable({ item, tipo }: { item: ChecklistItem; tipo: MedicionMotorTipo }) {
  const fields = tipo === "resistencia_bobinas" ? RESISTENCIA_BOBINAS_FIELDS : AISLACION_MOTOR_FIELDS;
  const rows = fields
    .map((field) => ({ ...field, value: getMedicionValue(item.datos, tipo, field.key) }))
    .filter((field) => hasValue(field.value));
  const voltaje = tipo === "aislacion" ? getMedicionValue(item.datos, tipo, "voltaje_prueba_v") : "";
  const diferencia = tipo === "resistencia_bobinas" ? diferenciaBobinas(item.datos) : "";

  if (rows.length === 0 && !voltaje && !diferencia) return null;

  return (
    <div className="measurement-box">
      <p className="label-title">
        {tipo === "resistencia_bobinas" ? "Medición de resistencia de bobinas" : "Medición de aislación del motor"}
      </p>
      <table className="measurement-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th>{row.label}</th>
              <td>{row.value} {row.unidad}</td>
            </tr>
          ))}
          {tipo === "resistencia_bobinas" && diferencia ? (
            <tr>
              <th>Diferencia máxima calculada</th>
              <td>{diferencia}</td>
            </tr>
          ) : null}
          {tipo === "aislacion" && voltaje ? (
            <tr>
              <th>Voltaje de prueba</th>
              <td>{voltaje} V</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{labelOrDash(value)}</strong>
    </div>
  );
}

function TextBox({ value }: { value: string | null | undefined }) {
  if (!hasValue(value)) return null;
  return <div className="text-box">{value}</div>;
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function ChecklistsIndividualesPage() {
  const params = useParams();
  const otId = String(params?.id || "");
  const [resumen, setResumen] = useState<OTResumen | null>(null);
  const [detalle, setDetalle] = useState<OTDetalle | null>(null);
  const [informeDatos, setInformeDatos] = useState<InformeDatos>({});
  const [equipos, setEquipos] = useState<EquipoAsociado[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [firmas, setFirmas] = useState<Firma[]>([]);
  const [selectedEquipoId, setSelectedEquipoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");
        const db = supabase as any;

        const [resumenResp, detalleResp, informeResp, firmasResp] = await Promise.all([
          db.from("ot_vw_resumen").select("id,folio,cliente_nombre,estado_nombre,tipo_servicio_nombre").eq("id", otId).maybeSingle(),
          db
            .from("ot_ordenes_trabajo")
            .select("id,folio,empresa_id,fecha_ot,fecha_programada,hora_inicio,hora_termino,duracion_minutos,titulo,descripcion_solicitud,numero_om_cliente,area_trabajo,contacto_cliente_nombre,contacto_cliente_cargo,cliente_nombre_firma,cliente_cargo_firma")
            .eq("id", otId)
            .maybeSingle(),
          db.from("ot_informes_tecnicos").select("datos").eq("ot_id", otId).eq("plantilla_codigo", "softys_om").maybeSingle(),
          db.from("ot_firmas").select("id,tipo_firma,nombre_firmante,cargo_firmante,firma_url").eq("ot_id", otId),
        ]);

        if (resumenResp.error) throw new Error(resumenResp.error.message);
        if (detalleResp.error) throw new Error(detalleResp.error.message);
        if (!resumenResp.data || !detalleResp.data) throw new Error("No se encontró la OT solicitada.");
        if (informeResp.error) throw new Error(informeResp.error.message);
        if (firmasResp.error) throw new Error(firmasResp.error.message);

        setResumen(resumenResp.data as OTResumen);
        setDetalle(detalleResp.data as OTDetalle);
        setInformeDatos((informeResp.data?.datos || {}) as InformeDatos);
        setFirmas((firmasResp.data || []) as Firma[]);

        const { data: equiposOtData, error: equiposOtError } = await db
          .from("ot_orden_equipos")
          .select("id,equipo_id,orden,descripcion_trabajo,observacion")
          .eq("ot_id", otId)
          .eq("activo", true)
          .is("deleted_at", null)
          .order("orden", { ascending: true });

        if (equiposOtError) throw new Error(equiposOtError.message);

        const equiposOtRows = (equiposOtData || []) as Array<{
          id: string;
          equipo_id: string;
          orden: number | null;
          descripcion_trabajo: string | null;
          observacion: string | null;
        }>;

        const equipoIds = Array.from(new Set(equiposOtRows.map((row) => row.equipo_id).filter(Boolean)));
        let equipoInfoMap = new Map<string, Partial<EquipoAsociado>>();

        if (equipoIds.length > 0) {
          const { data: equiposData, error: equiposError } = await db
            .from("ot_equipos")
            .select("id,tag,nombre,descripcion,tipo_equipo,planta,area,linea,ubicacion,marca,modelo,serie,potencia,criticidad")
            .in("id", equipoIds);

          if (equiposError) throw new Error(equiposError.message);

          equipoInfoMap = new Map(
            ((equiposData || []) as Array<{
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
            }>).map((equipo) => [equipo.id, equipo]),
          );
        }

        const equiposRows = equiposOtRows.map((row) => ({
          id: row.id,
          equipo_id: row.equipo_id,
          orden: row.orden,
          descripcion_trabajo: row.descripcion_trabajo,
          observacion: row.observacion,
          tag: equipoInfoMap.get(row.equipo_id)?.tag || null,
          nombre: equipoInfoMap.get(row.equipo_id)?.nombre || null,
          descripcion: equipoInfoMap.get(row.equipo_id)?.descripcion || null,
          tipo_equipo: equipoInfoMap.get(row.equipo_id)?.tipo_equipo || null,
          planta: equipoInfoMap.get(row.equipo_id)?.planta || null,
          area: equipoInfoMap.get(row.equipo_id)?.area || null,
          linea: equipoInfoMap.get(row.equipo_id)?.linea || null,
          ubicacion: equipoInfoMap.get(row.equipo_id)?.ubicacion || null,
          marca: equipoInfoMap.get(row.equipo_id)?.marca || null,
          modelo: equipoInfoMap.get(row.equipo_id)?.modelo || null,
          serie: equipoInfoMap.get(row.equipo_id)?.serie || null,
          potencia: equipoInfoMap.get(row.equipo_id)?.potencia || null,
          criticidad: equipoInfoMap.get(row.equipo_id)?.criticidad || null,
        })) as EquipoAsociado[];

        setEquipos(equiposRows);

        const { data: checklistData, error: checklistError } = await db
          .from("ot_equipo_checklist_resultados")
          .select("id,ot_orden_equipo_id,equipo_id,plantilla_item_id,respuesta_texto,respuesta_boolean,observacion_antes,observacion_despues,accion_realizada,recomendacion_tecnica,condicion_equipo,accion_checklist,evidencia_antes_url,evidencia_despues_url,datos")
          .eq("ot_id", otId);

        if (checklistError) throw new Error(checklistError.message);

        const checklistRows = (checklistData || []) as Array<{
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
          condicion_equipo: string | null;
          accion_checklist: string | null;
          evidencia_antes_url: string | null;
          evidencia_despues_url: string | null;
          datos: Record<string, unknown> | null;
        }>;

        const plantillaItemIds = Array.from(new Set(checklistRows.map((row) => row.plantilla_item_id).filter(Boolean)));
        let plantillaItemsMap = new Map<string, Partial<ChecklistItem>>();

        if (plantillaItemIds.length > 0) {
          const { data: plantillaItemsData, error: plantillaItemsError } = await db
            .from("ot_plantillas_checklist_items")
            .select("id,zona,categoria,actividad,frecuencia_horas,indicaciones,orden")
            .in("id", plantillaItemIds);

          if (plantillaItemsError) throw new Error(plantillaItemsError.message);

          plantillaItemsMap = new Map(
            ((plantillaItemsData || []) as Array<{
              id: string;
              zona: string | null;
              categoria: string | null;
              actividad: string | null;
              frecuencia_horas: number | null;
              indicaciones: string | null;
              orden: number | null;
            }>).map((item) => [
              item.id,
              {
                item_zona: item.zona,
                item_categoria: item.categoria,
                item_actividad: item.actividad,
                item_frecuencia_horas: item.frecuencia_horas,
                item_indicaciones: item.indicaciones,
                item_orden: item.orden,
              },
            ]),
          );
        }

        setItems(
          checklistRows
            .map((row) => ({
              ...row,
              item_zona: plantillaItemsMap.get(row.plantilla_item_id)?.item_zona || null,
              item_categoria: plantillaItemsMap.get(row.plantilla_item_id)?.item_categoria || null,
              item_actividad: plantillaItemsMap.get(row.plantilla_item_id)?.item_actividad || null,
              item_frecuencia_horas: plantillaItemsMap.get(row.plantilla_item_id)?.item_frecuencia_horas || null,
              item_indicaciones: plantillaItemsMap.get(row.plantilla_item_id)?.item_indicaciones || null,
              item_orden: plantillaItemsMap.get(row.plantilla_item_id)?.item_orden || null,
            }))
            .sort((a, b) => (a.item_orden || 9999) - (b.item_orden || 9999)) as ChecklistItem[],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron cargar los checklists individuales.");
      } finally {
        setLoading(false);
      }
    };

    if (otId) loadData();
  }, [otId]);

  const itemsPorEquipo = useMemo(() => {
    return items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
      if (!acc[item.ot_orden_equipo_id]) acc[item.ot_orden_equipo_id] = [];
      acc[item.ot_orden_equipo_id].push(item);
      return acc;
    }, {});
  }, [items]);

  const equiposVisibles = useMemo(() => {
    if (!selectedEquipoId) return equipos;
    return equipos.filter((equipo) => equipo.id === selectedEquipoId);
  }, [equipos, selectedEquipoId]);

  const responsableSoftys =
    informeDatos.responsable_softys ||
    detalle?.contacto_cliente_nombre ||
    detalle?.cliente_nombre_firma ||
    "-";

  const cargoResponsableSoftys =
    informeDatos.cargo_responsable_softys ||
    detalle?.contacto_cliente_cargo ||
    detalle?.cliente_cargo_firma ||
    "-";

  const firmaCliente = firmas.find((firma) => firma.tipo_firma === "cliente");
  const firmaSupervisor = firmas.find((firma) => firma.tipo_firma === "supervisor");
  const firmaTecnico = firmas.find((firma) => firma.tipo_firma === "tecnico");

  function printAll() {
    setSelectedEquipoId(null);
    setTimeout(() => window.print(), 80);
  }

  function printEquipo(equipoId: string, equipo: EquipoAsociado) {
    setSelectedEquipoId(equipoId);
    document.title = sanitizeFileName(`Checklist ${detalle?.folio || resumen?.folio || "OM"} ${equipo.tag || equipo.nombre || "equipo"}`);
    setTimeout(() => window.print(), 100);
  }

  if (loading) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando checklists individuales...
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
          <Link href={`/ot/${otId}`} className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Volver a la OT
          </Link>
        </div>
      </ProtectedModuleRoute>
    );
  }

  return (
    <ProtectedModuleRoute moduleKey="ot">
      <div className="screen-actions">
        <Link href={`/ot/${otId}`} className="action-secondary">
          Volver a la OT
        </Link>
        {selectedEquipoId ? (
          <button type="button" onClick={() => setSelectedEquipoId(null)} className="action-secondary">
            Ver todos
          </button>
        ) : null}
        <button type="button" onClick={printAll} className="action-primary">
          Imprimir todos los checklists
        </button>
      </div>

      <section className="screen-panel">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Checklists individuales</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            {labelOrDash(resumen.folio)} · {labelOrDash(detalle.titulo)}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Cada checklist se imprime como documento individual y mantiene referencia directa a la OM principal.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {equipos.map((equipo) => {
            const total = (itemsPorEquipo[equipo.id] || []).length;
            const respondidos = (itemsPorEquipo[equipo.id] || []).filter((item) => item.respuesta_texto).length;
            return (
              <div key={equipo.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Equipo {equipo.orden || "-"}
                </p>
                <h2 className="mt-1 text-base font-black text-slate-900">{equipoNombre(equipo)}</h2>
                <p className="mt-1 text-xs text-slate-500">Checklist: {respondidos}/{total} respondidos</p>
                <button
                  type="button"
                  onClick={() => printEquipo(equipo.id, equipo)}
                  className="mt-3 w-full rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-bold text-white hover:bg-[#245C90]"
                >
                  Imprimir este checklist
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <main className="print-wrap">
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
            flex-wrap: wrap;
          }

          .screen-panel {
            max-width: 980px;
            margin: 0 auto 16px;
            border: 1px solid #dbe3ea;
            border-radius: 24px;
            background: #ffffff;
            padding: 22px;
            box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
          }

          .action-primary,
          .action-secondary {
            border-radius: 14px;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 800;
            text-decoration: none;
            border: 1px solid #cbd5e1;
            cursor: pointer;
          }

          .action-primary {
            background: #0f172a !important;
            color: #ffffff !important;
            border-color: #0f172a !important;
          }

          .action-secondary {
            background: #ffffff !important;
            color: #334155 !important;
          }

          .print-wrap {
            max-width: 980px;
            margin: 0 auto;
          }

          .checklist-document {
            margin-bottom: 18px;
            background: #ffffff;
            color: #0f172a;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
            font-family: Arial, Helvetica, sans-serif;
            page-break-after: always;
          }

          .report-header {
            display: grid;
            grid-template-columns: 1fr 1.5fr 1fr;
            align-items: center;
            gap: 20px;
            padding: 22px 28px 16px;
            border-bottom: 4px solid #163a5f;
          }

          .logo-wrap {
            height: 74px;
            display: flex;
            align-items: center;
          }

          .logo-wrap.right {
            justify-content: flex-end;
          }

          .logo-wrap img {
            max-height: 68px;
            max-width: 190px;
            object-fit: contain;
          }

          .header-title {
            text-align: center;
          }

          .header-title p {
            margin: 0;
            color: #64748b;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .header-title h1 {
            margin: 7px 0 0;
            color: #0f172a;
            font-size: 20px;
            line-height: 1.15;
            font-weight: 900;
            text-transform: uppercase;
          }

          .header-title strong {
            display: block;
            margin-top: 8px;
            color: #163a5f;
            font-size: 13px;
          }

          .report-body {
            padding: 22px 28px 30px;
          }

          .summary-grid,
          .equipment-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            overflow: hidden;
            background: #ffffff;
          }

          .summary-grid .field,
          .equipment-grid .field {
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
          }

          .field {
            min-height: 50px;
            padding: 8px 10px;
            background: #ffffff;
          }

          .field span {
            display: block;
            color: #64748b;
            font-size: 8.5px;
            font-weight: 900;
            letter-spacing: 0.09em;
            line-height: 1.2;
            text-transform: uppercase;
          }

          .field strong {
            display: block;
            margin-top: 4px;
            color: #0f172a;
            font-size: 11.5px;
            line-height: 1.28;
            font-weight: 800;
          }

          .section-title {
            margin: 16px 0 8px;
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

          .belong-note {
            margin: 0 0 12px;
            border-left: 4px solid #163a5f;
            background: #f8fafc;
            padding: 10px 12px;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
          }

          .checklist-items {
            display: grid;
            gap: 10px;
          }

          .checklist-card {
            border: 1px solid #dbe3ea;
            border-radius: 16px;
            padding: 10px;
            background: #ffffff;
            break-inside: avoid;
          }

          .checklist-head {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 12px;
            align-items: start;
          }

          .checklist-zone {
            margin: 0;
            color: #64748b;
            font-size: 10.5px;
            line-height: 1.4;
            font-weight: 700;
          }

          .checklist-head h3 {
            margin: 3px 0 0;
            color: #0f172a;
            font-size: 13px;
            line-height: 1.35;
            font-weight: 900;
          }

          .status-pill {
            display: inline-block;
            min-width: 68px;
            border-radius: 999px;
            border: 1px solid #cbd5e1;
            padding: 4px 9px;
            text-align: center;
            font-size: 10px;
            font-weight: 900;
          }

          .status-ok { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
          .status-no-ok { border-color: #fecdd3; background: #fff1f2; color: #be123c; }
          .status-na { border-color: #cbd5e1; background: #f8fafc; color: #475569; }
          .status-pending { border-color: #fde68a; background: #fffbeb; color: #92400e; }

          .detail-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
            margin-top: 9px;
          }

          .mini-field {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 8px 9px;
            background: #f8fafc;
          }

          .mini-field span,
          .label-title {
            display: block;
            margin: 0 0 5px;
            color: #64748b;
            font-size: 9.5px;
            font-weight: 900;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .mini-field strong {
            color: #0f172a;
            font-size: 11.5px;
            line-height: 1.35;
            font-weight: 800;
          }

          .text-box {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 8px 9px;
            color: #0f172a;
            font-size: 11.5px;
            line-height: 1.45;
            white-space: pre-wrap;
            background: #ffffff;
          }

          .measurement-box {
            grid-column: 1 / -1;
            border: 1px solid #cfe0ff;
            background: #f8fbff;
            border-radius: 14px;
            padding: 10px;
          }

          .measurement-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            font-size: 11px;
          }

          .measurement-table th,
          .measurement-table td {
            border: 1px solid #dbeafe;
            padding: 7px 8px;
            text-align: left;
          }

          .measurement-table th {
            width: 45%;
            background: #eff6ff;
            color: #334155;
          }

          .evidence-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-top: 10px;
          }

          .evidence-card {
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            overflow: hidden;
            background: #f8fafc;
          }

          .evidence-card p {
            margin: 0;
            padding: 7px 9px;
            color: #334155;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .evidence-card img,
          .no-image {
            width: 100%;
            height: 165px;
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
            margin-top: 12px;
          }

          .firma-box {
            border: 1px solid #dbe3ea;
            border-radius: 16px;
            min-height: 142px;
            padding: 12px;
          }

          .firma-box p {
            margin: 0;
          }

          .firma-title {
            color: #163a5f;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .firma-area {
            height: 64px;
            border-bottom: 1px solid #94a3b8;
            margin: 8px 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .firma-area img {
            max-height: 58px;
            max-width: 100%;
            object-fit: contain;
          }

          .firma-name {
            color: #0f172a;
            font-size: 12px;
            font-weight: 800;
          }

          .firma-role {
            color: #64748b;
            font-size: 11px;
          }

          .footer-note {
            margin-top: 16px;
            border-top: 1px solid #dbe3ea;
            padding-top: 10px;
            color: #64748b;
            font-size: 10.5px;
            text-align: center;
          }

          @page {
            size: A4;
            margin: 10mm;
          }

          @media print {
            body { background: #ffffff !important; }
            .screen-actions,
            .screen-panel,
            aside,
            header,
            nav { display: none !important; }
            .print-wrap { max-width: none; width: 100%; margin: 0; }
            .checklist-document {
              margin: 0;
              box-shadow: none;
              border-radius: 0;
              page-break-after: always;
            }
            .report-header { padding: 0 0 14px; }
            .report-body { padding: 16px 0 0; }
            .evidence-card img,
            .no-image { height: 128px; }
          }
        `}</style>

        {equiposVisibles.map((equipo, index) => {
          const checklist = itemsPorEquipo[equipo.id] || [];
          const respondidos = checklist.filter((item) => item.respuesta_texto).length;
          const noOk = checklist.filter((item) => item.respuesta_texto === "no_ok").length;
          const fotos = checklist.reduce(
            (total, item) => total + (item.evidencia_antes_url ? 1 : 0) + (item.evidencia_despues_url ? 1 : 0),
            0,
          );

          return (
            <article className="checklist-document" key={equipo.id}>
              <div className="report-header">
                <div className="logo-wrap"><img src={DYF_LOGO} alt="DyF" /></div>
                <div className="header-title">
                  <p>Checklist individual</p>
                  <h1>Inspección técnica de equipo / motor</h1>
                  <strong>{labelOrDash(resumen.folio)}</strong>
                </div>
                <div className="logo-wrap right"><img src={SOFTYS_LOGO} alt="Softys" /></div>
              </div>

              <div className="report-body">
                <p className="belong-note">
                  Este checklist individual pertenece a la OM/OT {labelOrDash(resumen.folio)}{detalle.numero_om_cliente ? ` · Orden cliente Softys ${detalle.numero_om_cliente}` : ""}.
                </p>

                <div className="summary-grid">
                  <Field label="OM / OT Tralixia" value={resumen.folio} />
                  <Field label="N° orden cliente / Softys" value={informeDatos.numero_orden_cliente || detalle.numero_om_cliente} />
                  <Field label="Cliente final" value={resumen.cliente_nombre || "Softys"} />
                  <Field label="Contratista" value={informeDatos.empresa_contratista || "DyF Ingeniería y Mantenimiento Industrial"} />
                  <Field label="Tipo de servicio" value={resumen.tipo_servicio_nombre} />
                  <Field label="Fecha OT" value={formatDate(detalle.fecha_ot)} />
                  <Field label="Inicio" value={formatTimeOnly(detalle.hora_inicio)} />
                  <Field label="Término" value={formatTimeOnly(detalle.hora_termino)} />
                  <Field label="Duración OM" value={formatMinutes(detalle.duracion_minutos)} />
                  <Field label="Responsable Softys" value={responsableSoftys} />
                  <Field label="Cargo responsable" value={cargoResponsableSoftys} />
                  <Field label="Área de trabajo" value={detalle.area_trabajo || equipo.area} />
                </div>

                <h2 className="section-title">Equipo / TAG inspeccionado</h2>
                <div className="equipment-grid">
                  <Field label="Equipo" value={`Equipo ${equipo.orden || index + 1}`} />
                  <Field label="TAG / Nombre" value={equipoNombre(equipo)} />
                  <Field label="Tipo / Modelo / Potencia" value={equipoCaracteristicas(equipo)} />
                  <Field label="Serie" value={equipo.serie} />
                  <Field label="Ubicación" value={equipoUbicacion(equipo)} />
                  <Field label="Criticidad" value={equipo.criticidad} />
                  <Field label="Checklist" value={`${respondidos}/${checklist.length} respondidos`} />
                  <Field label="Ítems No OK / Fotos" value={`${noOk} No OK · ${fotos} foto(s)`} />
                </div>

                {hasValue(equipo.descripcion_trabajo) || hasValue(equipo.observacion) ? (
                  <div style={{ marginTop: 10 }}>
                    <TextBox value={equipo.descripcion_trabajo || equipo.observacion} />
                  </div>
                ) : null}

                <h2 className="section-title">Detalle del checklist técnico</h2>

                {checklist.length > 0 ? (
                  <div className="checklist-items">
                    {checklist.map((item) => {
                      const tipoMedicion = medicionMotorTipo(item);
                      const condicion = condicionLabel(item.condicion_equipo);
                      const accion = accionLabel(item.accion_checklist);
                      const hasEvidence = Boolean(item.evidencia_antes_url || item.evidencia_despues_url);

                      return (
                        <div className="checklist-card" key={item.id}>
                          <div className="checklist-head">
                            <div>
                              <p className="checklist-zone">
                                {[item.item_zona, item.item_categoria].filter(Boolean).join(" / ") || "Inspección técnica"}
                              </p>
                              <h3>{labelOrDash(item.item_actividad)}</h3>
                              {item.item_frecuencia_horas ? (
                                <p className="checklist-zone">Tiempo estimado según planilla Softys: {item.item_frecuencia_horas} min</p>
                              ) : null}
                            </div>
                            <span className={`status-pill ${estadoClass(item.respuesta_texto)}`}>{estadoLabel(item.respuesta_texto)}</span>
                          </div>

                          <div className="detail-grid">
                            {condicion ? (
                              <div className="mini-field"><span>Condición encontrada</span><strong>{condicion}</strong></div>
                            ) : null}
                            {accion ? (
                              <div className="mini-field"><span>Acción / gestión</span><strong>{accion}</strong></div>
                            ) : null}
                            {tipoMedicion ? <MedicionTable item={item} tipo={tipoMedicion} /> : null}
                            <TextBox value={item.observacion_antes} />
                            <TextBox value={item.accion_realizada} />
                            <TextBox value={item.observacion_despues} />
                            <TextBox value={item.recomendacion_tecnica} />
                          </div>

                          {hasEvidence ? (
                            <div className="evidence-grid">
                              <div className="evidence-card">
                                <p>Foto antes</p>
                                {item.evidencia_antes_url ? <img src={item.evidencia_antes_url} alt="Foto antes" /> : <div className="no-image">Sin foto antes</div>}
                              </div>
                              <div className="evidence-card">
                                <p>Foto después</p>
                                {item.evidencia_despues_url ? <img src={item.evidencia_despues_url} alt="Foto después" /> : <div className="no-image">Sin foto después</div>}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-box">Este equipo aún no tiene checklist registrado.</div>
                )}

                <h2 className="section-title">Firmas de referencia de la OM</h2>
                <div className="firma-grid">
                  <div className="firma-box">
                    <p className="firma-title">Responsable Softys</p>
                    <div className="firma-area">
                      {firmaCliente?.firma_url ? <img src={firmaCliente.firma_url} alt="Firma responsable Softys" /> : null}
                    </div>
                    <p className="firma-name">{labelOrDash(firmaCliente?.nombre_firmante || responsableSoftys)}</p>
                    <p className="firma-role">{labelOrDash(firmaCliente?.cargo_firmante || cargoResponsableSoftys)}</p>
                  </div>

                  <div className="firma-box">
                    <p className="firma-title">Supervisor contratista</p>
                    <div className="firma-area">
                      {(firmaSupervisor?.firma_url || firmaTecnico?.firma_url) ? <img src={firmaSupervisor?.firma_url || firmaTecnico?.firma_url || ""} alt="Firma supervisor contratista" /> : null}
                    </div>
                    <p className="firma-name">{labelOrDash(firmaSupervisor?.nombre_firmante || firmaTecnico?.nombre_firmante || informeDatos.supervisor_contratista)}</p>
                    <p className="firma-role">{labelOrDash(firmaSupervisor?.cargo_firmante || firmaTecnico?.cargo_firmante || informeDatos.cargo_supervisor_contratista || "Supervisor / Técnico DyF")}</p>
                  </div>
                </div>

                <p className="footer-note">
                  Checklist individual generado desde Tralixia. Documento asociado a la OM/OT {labelOrDash(resumen.folio)}.
                </p>
              </div>
            </article>
          );
        })}
      </main>
    </ProtectedModuleRoute>
  );
}
