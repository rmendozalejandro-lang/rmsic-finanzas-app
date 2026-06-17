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
  created_at: string | null;
  updated_at: string | null;
};

const datosDefault: InformeDatos = {
  numero_orden_cliente: "",
  descripcion_trabajo: "",
  empresa_contratista: "DyF Ingeniería y Mantenimiento Industrial",
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

const DYF_LOGO = "/logos/dyf-logo.png";
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
              "id,empresa_id,ot_id,plantilla_id,plantilla_codigo,plantilla_nombre,item_id,item_codigo,seccion,orden,actividad,tipo_respuesta,item_unidad,requerido,ayuda,estado,valor_texto,valor_numero,unidad,observacion,datos,created_at,updated_at",
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

        setResumen(resumenRow);
        setDetalle(detalleRow);
        setEvidencias((evidenciasResp.data ?? []) as Evidencia[]);
        setFirmas((firmasResp.data ?? []) as Firma[]);
        setTiempos((tiemposResp.data ?? []) as TiempoTrabajo[]);
        setChecklistResultados(
          (checklistResp.data ?? []) as ChecklistResultado[],
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
          "id,empresa_id,ot_id,plantilla_id,plantilla_codigo,plantilla_nombre,item_id,item_codigo,seccion,orden,actividad,tipo_respuesta,item_unidad,requerido,ayuda,estado,valor_texto,valor_numero,unidad,observacion,datos,created_at,updated_at",
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

  const checklistPorSeccion = checklistResultados.reduce<
    Record<string, ChecklistResultado[]>
  >((acc, item) => {
    const key = item.seccion || "Checklist técnico";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

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
              Estos datos se guardan en ot_informes_tecnicos y no modifican la
              OT base de RMSIC.
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
              label="Equipo de trabajo"
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

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Checklist técnico de mantenimiento
                </h3>
                <p className="text-sm text-slate-500">
                  Estos ítems vienen de la plantilla técnica y se guardan por
                  OT.
                </p>
              </div>

              {checklistResultados.length === 0 ? (
                <button
                  type="button"
                  onClick={generarChecklistMotorMt}
                  disabled={savingInforme}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  Generar checklist motor MT
                </button>
              ) : null}
            </div>

            {checklistResultados.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Sección</th>
                      <th className="px-3 py-2">Actividad</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Medición / valor</th>
                      <th className="px-3 py-2">Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checklistResultados.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-slate-100 align-top"
                      >
                        <td className="px-3 py-2 font-bold text-slate-700">
                          {item.item_codigo}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {item.seccion}
                        </td>
                        <td className="min-w-[280px] px-3 py-2 text-slate-800">
                          {item.actividad}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.estado || "pendiente"}
                            onChange={(event) =>
                              setChecklistTecnico(
                                item.id,
                                "estado",
                                event.target.value,
                              )
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="ok">OK</option>
                            <option value="observado">Observado</option>
                            <option value="no_aplica">No aplica</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {item.tipo_respuesta === "medicion" ||
                          item.item_unidad ? (
                            <div className="flex min-w-[140px] items-center gap-2">
                              <input
                                type="number"
                                value={item.valor_numero ?? ""}
                                onChange={(event) =>
                                  setChecklistTecnico(
                                    item.id,
                                    "valor_numero",
                                    event.target.value,
                                  )
                                }
                                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                              />
                              <span className="text-xs font-bold text-slate-500">
                                {item.unidad || item.item_unidad}
                              </span>
                            </div>
                          ) : item.tipo_respuesta === "texto" ? (
                            <input
                              value={item.valor_texto || ""}
                              onChange={(event) =>
                                setChecklistTecnico(
                                  item.id,
                                  "valor_texto",
                                  event.target.value,
                                )
                              }
                              className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            value={item.observacion || ""}
                            onChange={(event) =>
                              setChecklistTecnico(
                                item.id,
                                "observacion",
                                event.target.value,
                              )
                            }
                            rows={2}
                            className="min-w-[220px] rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Esta OT aún no tiene checklist técnico aplicado. Puedes
                generarlo para visualizar el flujo demo.
              </div>
            )}
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
            gap: 24px;
            padding: 28px 34px 22px;
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
            margin: 8px 0 0;
            color: #0f172a;
            font-size: 24px;
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
            padding: 28px 34px 34px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            border: 1px solid #dbe3ea;
            border-radius: 18px;
            overflow: hidden;
            margin-bottom: 22px;
          }

          .summary-grid .field {
            border-right: 1px solid #dbe3ea;
            border-bottom: 1px solid #dbe3ea;
          }

          .summary-grid .field:nth-child(4n) {
            border-right: 0;
          }

          .field {
            min-height: 62px;
            padding: 11px 13px;
          }

          .field span {
            display: block;
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .field strong {
            display: block;
            margin-top: 5px;
            color: #0f172a;
            font-size: 13px;
            line-height: 1.35;
            font-weight: 800;
          }

          .section-block {
            margin-top: 18px;
            break-inside: avoid;
          }

          .section-block h2 {
            margin: 0 0 10px;
            padding: 9px 12px;
            color: #ffffff;
            background: #163a5f;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 900;
            letter-spacing: 0.08em;
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
            border: 1px solid #dbe3ea;
            border-radius: 14px;
            padding: 13px 14px;
            color: #0f172a;
            font-size: 13px;
            line-height: 1.55;
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
            border: 1px solid #dbe3ea;
            padding: 10px;
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
            border-radius: 14px;
            font-size: 11px;
          }

          .technical-checklist-table th,
          .technical-checklist-table td {
            border: 1px solid #dbe3ea;
            padding: 8px;
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

            .evidence-card img {
              height: 190px;
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

          <Section title="Equipo / motor intervenido">
            <div className="summary-grid">
              <Field label="TAG" value={resumen.equipo_tag} />
              <Field
                label="Equipo"
                value={resumen.equipo_nombre || resumen.equipo_descripcion}
              />
              <Field label="Tipo" value={resumen.equipo_tipo} />
              <Field label="Potencia" value={resumen.equipo_potencia} />
              <Field label="Ubicación" value={equipoUbicacion} />
              <Field label="Marca / Modelo" value={equipoCaracteristicas} />
              <Field label="Serie" value={resumen.equipo_serie} />
              <Field label="Planta" value={resumen.equipo_planta} />
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
            {informeDatos.equipo_trabajo ? (
              <div style={{ marginBottom: 12 }}>
                <p className="label-title">Equipo de trabajo</p>
                <TextBox value={informeDatos.equipo_trabajo} minHeight={60} />
              </div>
            ) : null}

            {tiempos.length > 0 ? (
              <table className="reception-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Inicio</th>
                    <th>Término</th>
                    <th>Duración</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {tiempos.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.fecha)}</td>
                      <td>{labelOrDash(item.tipo_tiempo)}</td>
                      <td>{formatDateTime(item.hora_inicio)}</td>
                      <td>{formatDateTime(item.hora_termino)}</td>
                      <td>{formatMinutes(item.duracion_minutos)}</td>
                      <td>{labelOrDash(item.observacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <TextBox value={null} minHeight={60} />
            )}
          </Section>

          <Section title="Herramientas y materiales utilizados">
            <TextBox value={herramientasMateriales} minHeight={85} />
          </Section>

          <Section title="Checklist técnico ejecutado">
            {checklistResultados.length > 0 ? (
              <>
                {Object.entries(checklistPorSeccion).map(([seccion, items]) => (
                  <div key={seccion} style={{ marginBottom: 12 }}>
                    <p className="label-title">{seccion}</p>
                    <table className="technical-checklist-table">
                      <thead>
                        <tr>
                          <th style={{ width: 70 }}>Código</th>
                          <th>Actividad</th>
                          <th style={{ width: 90 }}>Estado</th>
                          <th style={{ width: 90 }}>Medición</th>
                          <th>Observación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.item_codigo}</td>
                            <td>{item.actividad}</td>
                            <td>
                              <span className="status-pill">
                                {estadoChecklistLabel(item.estado)}
                              </span>
                            </td>
                            <td>
                              {item.valor_numero !== null &&
                              item.valor_numero !== undefined
                                ? `${item.valor_numero} ${item.unidad || item.item_unidad || ""}`
                                : item.valor_texto || "-"}
                            </td>
                            <td>{item.observacion || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </>
            ) : (
              <TextBox
                value="Checklist técnico pendiente de cargar para esta OT."
                minHeight={60}
              />
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

          <Section title="Evidencias fotográficas">
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
            Informe generado desde Auren OT. Este documento respalda
            técnicamente la intervención indicada y debe ser revisado por el
            responsable del trabajo.
          </p>
        </div>
      </main>
    </ProtectedModuleRoute>
  );
}
