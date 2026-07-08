"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";
import {
  buttonDangerSmall,
  buttonGroup,
  buttonPrimary,
} from "../../../../lib/styles/buttons";

const RMSIC_EMPRESA_ID = "557a054c-71ef-4c5f-8637-594755ad669b";
const STORAGE_ID_KEY = "empresa_activa_id";
const DEFAULT_RESPONSABLE_NOMBRE = "Raúl Mendoza Céledon";
const DEFAULT_RESPONSABLE_CARGO =
  "Ingeniero de Proyecto / Magíster en Ingeniería Industrial";

type Informe = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  ot_id: string | null;
  codigo: string;
  titulo: string;
  tipo_informe: string;
  subtipo_informe: string | null;
  estado: string;
  fecha_informe: string;
  fecha_emision: string | null;
  emitido_por: string | null;
  emitido_por_nombre: string | null;
  emitido_por_email: string | null;
  responsable_id: string | null;
  revisor_id: string | null;
  informe_origen_id: string | null;
  version_anterior_id: string | null;
  motivo_version: string | null;
  es_version_actual: boolean | null;
  version: string;
  area_ubicacion: string | null;
  equipo_tag: string | null;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
  responsable_email: string | null;
  responsable_telefono: string | null;
  destinatario_nombre: string | null;
  destinatario_cargo: string | null;
  destinatario_email: string | null;
  destinatario_area: string | null;
  resumen_ejecutivo: string | null;
  antecedentes: string | null;
  objetivo: string | null;
  alcance: string | null;
  metodologia: string | null;
  desarrollo: string | null;
  analisis_tecnico: string | null;
  conclusiones: string | null;
  created_at: string;
};

type Cliente = {
  id: string;
  nombre: string | null;
  rut: string | null;
};

type InformeMedicion = {
  id: string;
  informe_id: string;
  fecha_medicion: string | null;
  punto_medicion: string | null;
  fase: string | null;
  parametro: string;
  valor: number | null;
  unidad: string | null;
  observacion: string | null;
  orden: number;
};

type InformeRecomendacion = {
  id: string;
  informe_id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: "baja" | "media" | "alta" | null;
  plazo_sugerido: string | null;
  requiere_cotizacion: boolean;
  cotizacion_id: string | null;
  orden: number;
};

type InformeHallazgo = {
  id: string;
  informe_id: string;
  titulo: string;
  descripcion: string | null;
  severidad: "baja" | "media" | "alta" | "critica" | null;
  evidencia: string | null;
  orden: number;
};

type InformeFoto = {
  id: string;
  informe_id: string;
  archivo_url: string;
  titulo: string | null;
  descripcion: string | null;
  fecha_foto: string | null;
  visible_en_informe: boolean;
  orden: number;
  url_firmada?: string | null;
};

type InformeAnexo = {
  id: string;
  informe_id: string;
  archivo_url: string;
  nombre: string;
  tipo_anexo: string | null;
  descripcion: string | null;
  visible_en_informe: boolean;
  orden: number;
  url_firmada?: string | null;
};

function hasText(value?: string | null) {
  return Boolean(value && value.trim().length > 0);
}

function estadoInformeLabel(estado: string) {
  const labels: Record<string, string> = {
    borrador: "Borrador",
    en_revision: "En revisión",
    observado: "Observado",
    aprobado: "Aprobado",
    emitido: "Emitido",
    anulado: "Anulado",
  };

  return labels[estado] ?? estado;
}

function tipoInformeLabel(tipo: string) {
  const labels: Record<string, string> = {
    levantamiento_tecnico: "Levantamiento técnico",
    mediciones: "Informe de mediciones",
    mantenimiento: "Informe de mantenimiento",
    falla: "Informe de falla",
    consultoria: "Informe de consultoría",
    avance: "Informe de avance",
    inspeccion: "Informe de inspección",
    mejora_propuesta: "Informe de mejora propuesta",
  };

  return labels[tipo] ?? tipo;
}

function prioridadLabel(prioridad?: string | null) {
  const labels: Record<string, string> = {
    baja: "Baja",
    media: "Media",
    alta: "Alta",
  };

  return prioridad ? (labels[prioridad] ?? prioridad) : "Sin prioridad";
}

function severidadLabel(severidad?: string | null) {
  const labels: Record<string, string> = {
    baja: "Baja",
    media: "Media",
    alta: "Alta",
    critica: "Crítica",
  };

  return severidad ? (labels[severidad] ?? severidad) : "Sin severidad";
}

function formatFechaMedicion(fecha?: string | null) {
  if (!fecha) return "Sin fecha";

  try {
    return new Date(fecha).toLocaleString("es-CL");
  } catch {
    return fecha;
  }
}

function formatValorMedicion(valor?: number | null) {
  if (valor === null || valor === undefined) return "Sin valor";
  return String(valor);
}

function formatFechaSimple(fecha?: string | null) {
  if (!fecha) return "Sin fecha";

  try {
    return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CL");
  } catch {
    return fecha;
  }
}

function limpiarNombreArchivo(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function crearStoragePath(empresaId: string, informeId: string, nombre: string) {
  const limpio = limpiarNombreArchivo(nombre) || "archivo";
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${empresaId}/${informeId}/${sufijo}-${limpio}`;
}


function normalizarVersion(version?: string | null) {
  const partes = String(version || "1.0").split(".");
  const mayor = Number.parseInt(partes[0] || "1", 10);
  const menor = Number.parseInt(partes[1] || "0", 10);

  return {
    mayor: Number.isNaN(mayor) ? 1 : mayor,
    menor: Number.isNaN(menor) ? 0 : menor,
  };
}

function calcularNuevaVersion(versionActual: string, tipo: "menor" | "mayor") {
  const { mayor, menor } = normalizarVersion(versionActual);

  if (tipo === "mayor") {
    return `${mayor + 1}.0`;
  }

  return `${mayor}.${menor + 1}`;
}

function obtenerNombreUsuario(user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]) {
  const metadata = user?.user_metadata ?? {};

  if (typeof metadata.nombre_completo === "string" && metadata.nombre_completo.trim()) {
    return metadata.nombre_completo.trim();
  }

  if (typeof metadata.full_name === "string" && metadata.full_name.trim()) {
    return metadata.full_name.trim();
  }

  if (typeof metadata.name === "string" && metadata.name.trim()) {
    return metadata.name.trim();
  }

  return user?.email || "Usuario RMSIC";
}

async function crearUrlFirmada(bucket: string, path: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.warn(`No se pudo crear URL firmada para ${bucket}:`, error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

export default function VerInformePage() {
  const params = useParams();
  const router = useRouter();
  const informeId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [empresaActivaId, setEmpresaActivaId] = useState("");
  const [informe, setInforme] = useState<Informe | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [mediciones, setMediciones] = useState<InformeMedicion[]>([]);
  const [recomendaciones, setRecomendaciones] = useState<
    InformeRecomendacion[]
  >([]);
  const [hallazgos, setHallazgos] = useState<InformeHallazgo[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [emitiendo, setEmitiendo] = useState(false);
  const [creandoVersion, setCreandoVersion] = useState(false);
  const [guardandoRecomendacion, setGuardandoRecomendacion] = useState(false);
  const [eliminandoRecomendacionId, setEliminandoRecomendacionId] = useState<
    string | null
  >(null);
  const [guardandoHallazgo, setGuardandoHallazgo] = useState(false);
  const [eliminandoHallazgoId, setEliminandoHallazgoId] = useState<
    string | null
  >(null);
  const [guardandoMedicion, setGuardandoMedicion] = useState(false);
  const [eliminandoMedicionId, setEliminandoMedicionId] = useState<
    string | null
  >(null);

  const [fotos, setFotos] = useState<InformeFoto[]>([]);
  const [anexos, setAnexos] = useState<InformeAnexo[]>([]);
  const [guardandoFoto, setGuardandoFoto] = useState(false);
  const [guardandoAnexo, setGuardandoAnexo] = useState(false);
  const [eliminandoFotoId, setEliminandoFotoId] = useState<string | null>(null);
  const [eliminandoAnexoId, setEliminandoAnexoId] = useState<string | null>(
    null,
  );

  const [medicionFecha, setMedicionFecha] = useState("");
  const [medicionPunto, setMedicionPunto] = useState("");
  const [medicionFase, setMedicionFase] = useState("");
  const [medicionParametro, setMedicionParametro] = useState("");
  const [medicionValor, setMedicionValor] = useState("");
  const [medicionUnidad, setMedicionUnidad] = useState("");
  const [medicionObservacion, setMedicionObservacion] = useState("");

  const [hallazgoTitulo, setHallazgoTitulo] = useState("");
  const [hallazgoDescripcion, setHallazgoDescripcion] = useState("");
  const [hallazgoSeveridad, setHallazgoSeveridad] = useState<
    "baja" | "media" | "alta" | "critica" | ""
  >("media");
  const [hallazgoEvidencia, setHallazgoEvidencia] = useState("");

  const [recomendacionTitulo, setRecomendacionTitulo] = useState("");
  const [recomendacionDescripcion, setRecomendacionDescripcion] = useState("");
  const [recomendacionPrioridad, setRecomendacionPrioridad] = useState<
    "baja" | "media" | "alta" | ""
  >("media");
  const [recomendacionPlazo, setRecomendacionPlazo] = useState("");
  const [recomendacionRequiereCotizacion, setRecomendacionRequiereCotizacion] =
    useState(false);


  const [fotoArchivo, setFotoArchivo] = useState<File | null>(null);
  const [fotoTitulo, setFotoTitulo] = useState("");
  const [fotoDescripcion, setFotoDescripcion] = useState("");
  const [fotoFecha, setFotoFecha] = useState("");
  const [fotoVisibleEnInforme, setFotoVisibleEnInforme] = useState(true);

  const [anexoArchivo, setAnexoArchivo] = useState<File | null>(null);
  const [anexoNombre, setAnexoNombre] = useState("");
  const [anexoTipo, setAnexoTipo] = useState("");
  const [anexoDescripcion, setAnexoDescripcion] = useState("");
  const [anexoVisibleEnInforme, setAnexoVisibleEnInforme] = useState(true);

  useEffect(() => {
    const cargarInforme = async () => {
      try {
        const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || "";
        setEmpresaActivaId(empresaId);

        if (empresaId !== RMSIC_EMPRESA_ID) {
          setLoading(false);
          return;
        }

        const { data: informeData, error: informeError } = await supabase
          .from("informes_tecnicos")
          .select("*")
          .eq("id", informeId)
          .eq("empresa_id", empresaId)
          .single();

        if (informeError) {
          console.error("Error cargando informe:", informeError.message);
          setErrorMessage(informeError.message);
          setLoading(false);
          return;
        }

        setInforme(informeData as Informe);

        const { data: clienteData, error: clienteError } = await supabase
          .from("clientes")
          .select("id, nombre, rut")
          .eq("id", informeData.cliente_id)
          .single();

        if (clienteError) {
          console.warn(
            "No se pudo cargar cliente del informe:",
            clienteError.message,
          );
        } else {
          setCliente(clienteData as Cliente);
        }

        const { data: medicionesData, error: medicionesError } = await supabase
          .from("informes_mediciones")
          .select(
            "id, informe_id, fecha_medicion, punto_medicion, fase, parametro, valor, unidad, observacion, orden",
          )
          .eq("informe_id", informeId)
          .order("orden", { ascending: true });

        if (medicionesError) {
          console.warn(
            "No se pudieron cargar mediciones:",
            medicionesError.message,
          );
        } else {
          setMediciones((medicionesData ?? []) as InformeMedicion[]);
        }

        const { data: hallazgosData, error: hallazgosError } = await supabase
          .from("informes_hallazgos")
          .select(
            "id, informe_id, titulo, descripcion, severidad, evidencia, orden",
          )
          .eq("informe_id", informeId)
          .order("orden", { ascending: true });

        if (hallazgosError) {
          console.warn(
            "No se pudieron cargar hallazgos:",
            hallazgosError.message,
          );
        } else {
          setHallazgos((hallazgosData ?? []) as InformeHallazgo[]);
        }

        const { data: recomendacionesData, error: recomendacionesError } =
          await supabase
            .from("informes_recomendaciones")
            .select(
              "id, informe_id, titulo, descripcion, prioridad, plazo_sugerido, requiere_cotizacion, cotizacion_id, orden",
            )
            .eq("informe_id", informeId)
            .order("orden", { ascending: true });

        if (recomendacionesError) {
          console.warn(
            "No se pudieron cargar recomendaciones:",
            recomendacionesError.message,
          );
        } else {
          setRecomendaciones(
            (recomendacionesData ?? []) as InformeRecomendacion[],
          );
        }


        const { data: fotosData, error: fotosError } = await supabase
          .from("informes_fotos")
          .select(
            "id, informe_id, archivo_url, titulo, descripcion, fecha_foto, visible_en_informe, orden",
          )
          .eq("informe_id", informeId)
          .order("orden", { ascending: true });

        if (fotosError) {
          console.warn("No se pudieron cargar fotos:", fotosError.message);
        } else {
          const fotosConUrl = await Promise.all(
            ((fotosData ?? []) as InformeFoto[]).map(async (foto) => ({
              ...foto,
              url_firmada: await crearUrlFirmada(
                "informes-fotos",
                foto.archivo_url,
              ),
            })),
          );
          setFotos(fotosConUrl);
        }

        const { data: anexosData, error: anexosError } = await supabase
          .from("informes_anexos")
          .select(
            "id, informe_id, archivo_url, nombre, tipo_anexo, descripcion, visible_en_informe, orden",
          )
          .eq("informe_id", informeId)
          .order("orden", { ascending: true });

        if (anexosError) {
          console.warn("No se pudieron cargar anexos:", anexosError.message);
        } else {
          const anexosConUrl = await Promise.all(
            ((anexosData ?? []) as InformeAnexo[]).map(async (anexo) => ({
              ...anexo,
              url_firmada: await crearUrlFirmada(
                "informes-anexos",
                anexo.archivo_url,
              ),
            })),
          );
          setAnexos(anexosConUrl);
        }
      } catch (error) {
        console.error("Error inesperado cargando informe:", error);
        setErrorMessage("No se pudo cargar el informe técnico.");
      } finally {
        setLoading(false);
      }
    };

    void cargarInforme();
  }, [informeId]);

  async function handleEmitirInforme() {
    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage("Solo se pueden emitir informes en estado borrador.");
      return;
    }

    const confirmar = window.confirm(
      [
        "Emitir informe técnico",
        "",
        "Esta acción cambiará el estado del informe a Emitido.",
        "Una vez emitido, el informe quedará bloqueado para edición y no podrás agregar, modificar o eliminar mediciones, hallazgos, recomendaciones, fotos o anexos.",
        "",
        "¿Deseas continuar?",
      ].join("\n"),
    );

    if (!confirmar) return;

    setEmitiendo(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const fechaEmision = new Date().toISOString();
      const emitidoPorNombre = obtenerNombreUsuario(user);
      const emitidoPorEmail = user?.email ?? null;

      const { error } = await supabase
        .from("informes_tecnicos")
        .update({
          estado: "emitido",
          fecha_emision: fechaEmision,
          emitido_por: user?.id ?? null,
          emitido_por_nombre: emitidoPorNombre,
          emitido_por_email: emitidoPorEmail,
          actualizado_por: user?.id ?? null,
        })
        .eq("id", informe.id)
        .eq("empresa_id", empresaActivaId)
        .eq("estado", "borrador");

      if (error) {
        console.error("Error emitiendo informe:", error.message);
        setErrorMessage(error.message);
        return;
      }

      setInforme({
        ...informe,
        estado: "emitido",
        fecha_emision: fechaEmision,
        emitido_por: user?.id ?? null,
        emitido_por_nombre: emitidoPorNombre,
        emitido_por_email: emitidoPorEmail,
      });

      router.refresh();
    } catch (error) {
      console.error("Error inesperado emitiendo informe:", error);
      setErrorMessage("No se pudo emitir el informe técnico.");
    } finally {
      setEmitiendo(false);
    }
  }

  async function handleCrearNuevaVersion() {
    if (!informe) return;

    if (informe.estado !== "emitido") {
      setErrorMessage("Solo se pueden crear nuevas versiones desde informes emitidos.");
      return;
    }

    if (informe.es_version_actual === false) {
      setErrorMessage(
        "Este informe corresponde a una versión histórica. Crea nuevas versiones desde la versión actual.",
      );
      return;
    }

    const tipoIngresado = window.prompt(
      [
        "Crear nueva versión del informe",
        "",
        "Indica el tipo de nueva versión:",
        "",
        "1) Corrección menor / complemento",
        "   Genera una versión tipo v1.1. Úsala para corregir redacción, agregar evidencia, anexos o complementar información sin cambiar el diagnóstico principal.",
        "",
        "2) Nueva revisión técnica mayor",
        "   Genera una versión tipo v2.0. Úsala cuando existan nuevas mediciones, nueva visita, cambio de alcance o cambios relevantes en conclusiones/recomendaciones.",
        "",
        "Escribe: correccion o mayor",
      ].join("\n"),
      "correccion",
    );

    if (tipoIngresado === null) return;

    const tipoNormalizado = tipoIngresado
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const tipoVersion: "menor" | "mayor" =
      tipoNormalizado.includes("mayor") ||
      tipoNormalizado.includes("2") ||
      tipoNormalizado.includes("nueva revision")
        ? "mayor"
        : "menor";
    const nuevaVersion = calcularNuevaVersion(informe.version, tipoVersion);
    const tipoVersionLabel =
      tipoVersion === "mayor"
        ? "Nueva revisión técnica mayor"
        : "Corrección menor / complemento";

    const motivo = window.prompt(
      [
        `Motivo de la nueva versión ${nuevaVersion}`,
        "",
        `Tipo seleccionado: ${tipoVersionLabel}`,
        "",
        "Describe brevemente por qué se crea esta nueva versión.",
      ].join("\n"),
      tipoVersion === "mayor"
        ? "Nueva revisión técnica del informe por actualización relevante de antecedentes, mediciones o conclusiones."
        : "Se agrega evidencia complementaria y/o se ajusta redacción del informe emitido.",
    );

    if (motivo === null) return;

    const confirmar = window.confirm(
      [
        "Confirmar nueva versión del informe",
        "",
        `Se creará una copia editable del informe ${informe.codigo}.`,
        `Versión actual: ${informe.version}`,
        `Nueva versión: ${nuevaVersion}`,
        `Tipo de versión: ${tipoVersionLabel}`,
        "",
        "El informe emitido original quedará intacto como versión histórica.",
        "La nueva versión quedará en estado Borrador para edición y revisión antes de una nueva emisión.",
        "",
        "¿Deseas continuar?",
      ].join("\n"),
    );

    if (!confirmar) return;

    setCreandoVersion(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const fechaInformeNuevaVersion = new Date().toISOString().slice(0, 10);
      const usuarioId = user?.id ?? null;
      const informeOrigenId = informe.informe_origen_id || informe.id;

      const { data: nuevoInforme, error: insertError } = await supabase
        .from("informes_tecnicos")
        .insert({
          empresa_id: informe.empresa_id,
          cliente_id: informe.cliente_id,
          ot_id: informe.ot_id,
          codigo: informe.codigo,
          titulo: informe.titulo,
          tipo_informe: informe.tipo_informe,
          subtipo_informe: informe.subtipo_informe,
          estado: "borrador",
          fecha_informe: fechaInformeNuevaVersion,
          fecha_emision: null,
          responsable_id: informe.responsable_id,
          revisor_id: informe.revisor_id,
          version: nuevaVersion,
          area_ubicacion: informe.area_ubicacion,
          equipo_tag: informe.equipo_tag,
          resumen_ejecutivo: informe.resumen_ejecutivo,
          antecedentes: informe.antecedentes,
          objetivo: informe.objetivo,
          alcance: informe.alcance,
          metodologia: informe.metodologia,
          desarrollo: informe.desarrollo,
          analisis_tecnico: informe.analisis_tecnico,
          conclusiones: informe.conclusiones,
          pdf_url: null,
          creado_por: usuarioId,
          actualizado_por: usuarioId,
          responsable_nombre: informe.responsable_nombre,
          responsable_cargo: informe.responsable_cargo,
          responsable_email: informe.responsable_email,
          responsable_telefono: informe.responsable_telefono,
          destinatario_nombre: informe.destinatario_nombre,
          destinatario_cargo: informe.destinatario_cargo,
          destinatario_email: informe.destinatario_email,
          destinatario_area: informe.destinatario_area,
          emitido_por: null,
          emitido_por_nombre: null,
          emitido_por_email: null,
          informe_origen_id: informeOrigenId,
          version_anterior_id: informe.id,
          motivo_version: motivo.trim() || null,
          es_version_actual: true,
        })
        .select("id")
        .single();

      if (insertError || !nuevoInforme) {
        console.error("Error creando nueva versión:", insertError?.message);
        setErrorMessage(
          insertError?.message || "No se pudo crear la nueva versión del informe.",
        );
        return;
      }

      const nuevoInformeId = nuevoInforme.id as string;

      if (mediciones.length > 0) {
        const { error } = await supabase.from("informes_mediciones").insert(
          mediciones.map((medicion, index) => ({
            informe_id: nuevoInformeId,
            fecha_medicion: medicion.fecha_medicion,
            punto_medicion: medicion.punto_medicion,
            fase: medicion.fase,
            parametro: medicion.parametro,
            valor: medicion.valor,
            unidad: medicion.unidad,
            observacion: medicion.observacion,
            orden: index + 1,
          })),
        );

        if (error) {
          console.warn("No se pudieron copiar mediciones:", error.message);
        }
      }

      if (hallazgos.length > 0) {
        const { error } = await supabase.from("informes_hallazgos").insert(
          hallazgos.map((hallazgo, index) => ({
            informe_id: nuevoInformeId,
            titulo: hallazgo.titulo,
            descripcion: hallazgo.descripcion,
            severidad: hallazgo.severidad,
            evidencia: hallazgo.evidencia,
            orden: index + 1,
          })),
        );

        if (error) {
          console.warn("No se pudieron copiar hallazgos:", error.message);
        }
      }

      if (recomendaciones.length > 0) {
        const { error } = await supabase
          .from("informes_recomendaciones")
          .insert(
            recomendaciones.map((recomendacion, index) => ({
              informe_id: nuevoInformeId,
              titulo: recomendacion.titulo,
              descripcion: recomendacion.descripcion,
              prioridad: recomendacion.prioridad,
              plazo_sugerido: recomendacion.plazo_sugerido,
              requiere_cotizacion: recomendacion.requiere_cotizacion,
              cotizacion_id: recomendacion.cotizacion_id,
              orden: index + 1,
            })),
          );

        if (error) {
          console.warn("No se pudieron copiar recomendaciones:", error.message);
        }
      }

      if (fotos.length > 0) {
        const { error } = await supabase.from("informes_fotos").insert(
          fotos.map((foto, index) => ({
            informe_id: nuevoInformeId,
            archivo_url: foto.archivo_url,
            titulo: foto.titulo,
            descripcion: foto.descripcion,
            fecha_foto: foto.fecha_foto,
            visible_en_informe: foto.visible_en_informe,
            orden: index + 1,
          })),
        );

        if (error) {
          console.warn("No se pudieron copiar fotos:", error.message);
        }
      }

      if (anexos.length > 0) {
        const { error } = await supabase.from("informes_anexos").insert(
          anexos.map((anexo, index) => ({
            informe_id: nuevoInformeId,
            archivo_url: anexo.archivo_url,
            nombre: anexo.nombre,
            tipo_anexo: anexo.tipo_anexo,
            descripcion: anexo.descripcion,
            visible_en_informe: anexo.visible_en_informe,
            orden: index + 1,
          })),
        );

        if (error) {
          console.warn("No se pudieron copiar anexos:", error.message);
        }
      }

      const { error: versionActualError } = await supabase
        .from("informes_tecnicos")
        .update({ es_version_actual: false })
        .eq("empresa_id", informe.empresa_id)
        .eq("codigo", informe.codigo)
        .neq("id", nuevoInformeId);

      if (versionActualError) {
        console.warn(
          "No se pudo actualizar marca de versión actual:",
          versionActualError.message,
        );
      }

      router.push(`/informes/${nuevoInformeId}`);
    } catch (error) {
      console.error("Error inesperado creando nueva versión:", error);
      setErrorMessage("No se pudo crear la nueva versión del informe.");
    } finally {
      setCreandoVersion(false);
    }
  }

  async function handleAgregarMedicion(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage(
        "Solo se pueden agregar mediciones en informes en estado borrador.",
      );
      return;
    }

    if (!medicionParametro.trim()) {
      setErrorMessage("Debes ingresar un parámetro para la medición.");
      return;
    }

    const valorNormalizado = medicionValor.trim().replace(",", ".");
    const valorNumerico = valorNormalizado ? Number(valorNormalizado) : null;

    if (valorNormalizado && Number.isNaN(valorNumerico)) {
      setErrorMessage("El valor de la medición debe ser numérico.");
      return;
    }

    setGuardandoMedicion(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("informes_mediciones")
        .insert({
          informe_id: informe.id,
          fecha_medicion: medicionFecha
            ? new Date(medicionFecha).toISOString()
            : null,
          punto_medicion: medicionPunto.trim() || null,
          fase: medicionFase.trim() || null,
          parametro: medicionParametro.trim(),
          valor: valorNumerico,
          unidad: medicionUnidad.trim() || null,
          observacion: medicionObservacion.trim() || null,
          orden: mediciones.length + 1,
        })
        .select(
          "id, informe_id, fecha_medicion, punto_medicion, fase, parametro, valor, unidad, observacion, orden",
        )
        .single();

      if (error) {
        console.error("Error agregando medición:", error.message);
        setErrorMessage(error.message);
        return;
      }

      setMediciones((actuales) => [...actuales, data as InformeMedicion]);
      setMedicionFecha("");
      setMedicionPunto("");
      setMedicionFase("");
      setMedicionParametro("");
      setMedicionValor("");
      setMedicionUnidad("");
      setMedicionObservacion("");
    } catch (error) {
      console.error("Error inesperado agregando medición:", error);
      setErrorMessage("No se pudo agregar la medición.");
    } finally {
      setGuardandoMedicion(false);
    }
  }

  async function handleEliminarMedicion(medicionId: string) {
    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage(
        "Solo se pueden eliminar mediciones en informes en estado borrador.",
      );
      return;
    }

    const confirmar = window.confirm("¿Confirmas eliminar esta medición?");
    if (!confirmar) return;

    setEliminandoMedicionId(medicionId);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("informes_mediciones")
        .delete()
        .eq("id", medicionId);

      if (error) {
        console.error("Error eliminando medición:", error.message);
        setErrorMessage(error.message);
        return;
      }

      setMediciones((actuales) =>
        actuales.filter((medicion) => medicion.id !== medicionId),
      );
    } catch (error) {
      console.error("Error inesperado eliminando medición:", error);
      setErrorMessage("No se pudo eliminar la medición.");
    } finally {
      setEliminandoMedicionId(null);
    }
  }

  async function handleAgregarHallazgo(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage(
        "Solo se pueden agregar hallazgos en informes en estado borrador.",
      );
      return;
    }

    if (!hallazgoTitulo.trim()) {
      setErrorMessage("Debes ingresar un título para el hallazgo.");
      return;
    }

    setGuardandoHallazgo(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("informes_hallazgos")
        .insert({
          informe_id: informe.id,
          titulo: hallazgoTitulo.trim(),
          descripcion: hallazgoDescripcion.trim() || null,
          severidad: hallazgoSeveridad || null,
          evidencia: hallazgoEvidencia.trim() || null,
          orden: hallazgos.length + 1,
        })
        .select(
          "id, informe_id, titulo, descripcion, severidad, evidencia, orden",
        )
        .single();

      if (error) {
        console.error("Error agregando hallazgo:", error.message);
        setErrorMessage(error.message);
        return;
      }

      setHallazgos((actuales) => [...actuales, data as InformeHallazgo]);
      setHallazgoTitulo("");
      setHallazgoDescripcion("");
      setHallazgoSeveridad("media");
      setHallazgoEvidencia("");
    } catch (error) {
      console.error("Error inesperado agregando hallazgo:", error);
      setErrorMessage("No se pudo agregar el hallazgo.");
    } finally {
      setGuardandoHallazgo(false);
    }
  }

  async function handleEliminarHallazgo(hallazgoId: string) {
    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage(
        "Solo se pueden eliminar hallazgos en informes en estado borrador.",
      );
      return;
    }

    const confirmar = window.confirm("¿Confirmas eliminar este hallazgo?");
    if (!confirmar) return;

    setEliminandoHallazgoId(hallazgoId);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("informes_hallazgos")
        .delete()
        .eq("id", hallazgoId);

      if (error) {
        console.error("Error eliminando hallazgo:", error.message);
        setErrorMessage(error.message);
        return;
      }

      setHallazgos((actuales) =>
        actuales.filter((hallazgo) => hallazgo.id !== hallazgoId),
      );
    } catch (error) {
      console.error("Error inesperado eliminando hallazgo:", error);
      setErrorMessage("No se pudo eliminar el hallazgo.");
    } finally {
      setEliminandoHallazgoId(null);
    }
  }

  async function handleAgregarRecomendacion(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage(
        "Solo se pueden agregar recomendaciones en informes en estado borrador.",
      );
      return;
    }

    if (!recomendacionTitulo.trim()) {
      setErrorMessage("Debes ingresar un título para la recomendación.");
      return;
    }

    setGuardandoRecomendacion(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("informes_recomendaciones")
        .insert({
          informe_id: informe.id,
          titulo: recomendacionTitulo.trim(),
          descripcion: recomendacionDescripcion.trim() || null,
          prioridad: recomendacionPrioridad || null,
          plazo_sugerido: recomendacionPlazo.trim() || null,
          requiere_cotizacion: recomendacionRequiereCotizacion,
          orden: recomendaciones.length + 1,
        })
        .select(
          "id, informe_id, titulo, descripcion, prioridad, plazo_sugerido, requiere_cotizacion, cotizacion_id, orden",
        )
        .single();

      if (error) {
        console.error("Error agregando recomendación:", error.message);
        setErrorMessage(error.message);
        return;
      }

      setRecomendaciones((actuales) => [
        ...actuales,
        data as InformeRecomendacion,
      ]);
      setRecomendacionTitulo("");
      setRecomendacionDescripcion("");
      setRecomendacionPrioridad("media");
      setRecomendacionPlazo("");
      setRecomendacionRequiereCotizacion(false);
    } catch (error) {
      console.error("Error inesperado agregando recomendación:", error);
      setErrorMessage("No se pudo agregar la recomendación.");
    } finally {
      setGuardandoRecomendacion(false);
    }
  }

  async function handleEliminarRecomendacion(recomendacionId: string) {
    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage(
        "Solo se pueden eliminar recomendaciones en informes en estado borrador.",
      );
      return;
    }

    const confirmar = window.confirm("¿Confirmas eliminar esta recomendación?");
    if (!confirmar) return;

    setEliminandoRecomendacionId(recomendacionId);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("informes_recomendaciones")
        .delete()
        .eq("id", recomendacionId);

      if (error) {
        console.error("Error eliminando recomendación:", error.message);
        setErrorMessage(error.message);
        return;
      }

      setRecomendaciones((actuales) =>
        actuales.filter(
          (recomendacion) => recomendacion.id !== recomendacionId,
        ),
      );
    } catch (error) {
      console.error("Error inesperado eliminando recomendación:", error);
      setErrorMessage("No se pudo eliminar la recomendación.");
    } finally {
      setEliminandoRecomendacionId(null);
    }
  }


  async function handleAgregarFoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage(
        "Solo se pueden agregar fotos en informes en estado borrador.",
      );
      return;
    }

    if (!fotoArchivo) {
      setErrorMessage("Debes seleccionar una imagen para subir.");
      return;
    }

    if (!fotoArchivo.type.startsWith("image/")) {
      setErrorMessage("El archivo seleccionado debe ser una imagen.");
      return;
    }

    setGuardandoFoto(true);
    setErrorMessage("");

    try {
      const storagePath = crearStoragePath(
        empresaActivaId,
        informe.id,
        fotoArchivo.name,
      );

      const { error: uploadError } = await supabase.storage
        .from("informes-fotos")
        .upload(storagePath, fotoArchivo, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error subiendo foto:", uploadError.message);
        setErrorMessage(uploadError.message);
        return;
      }

      const { data, error } = await supabase
        .from("informes_fotos")
        .insert({
          informe_id: informe.id,
          archivo_url: storagePath,
          titulo: fotoTitulo.trim() || null,
          descripcion: fotoDescripcion.trim() || null,
          fecha_foto: fotoFecha || null,
          visible_en_informe: fotoVisibleEnInforme,
          orden: fotos.length + 1,
        })
        .select(
          "id, informe_id, archivo_url, titulo, descripcion, fecha_foto, visible_en_informe, orden",
        )
        .single();

      if (error) {
        console.error("Error registrando foto:", error.message);
        setErrorMessage(error.message);
        await supabase.storage.from("informes-fotos").remove([storagePath]);
        return;
      }

      const fotoGuardada = data as InformeFoto;
      const urlFirmada = await crearUrlFirmada(
        "informes-fotos",
        fotoGuardada.archivo_url,
      );

      setFotos((actuales) => [
        ...actuales,
        { ...fotoGuardada, url_firmada: urlFirmada },
      ]);
      setFotoArchivo(null);
      setFotoTitulo("");
      setFotoDescripcion("");
      setFotoFecha("");
      setFotoVisibleEnInforme(true);
      form.reset();
    } catch (error) {
      console.error("Error inesperado agregando foto:", error);
      setErrorMessage("No se pudo agregar la foto al informe.");
    } finally {
      setGuardandoFoto(false);
    }
  }

  async function handleEliminarFoto(foto: InformeFoto) {
    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage(
        "Solo se pueden eliminar fotos en informes en estado borrador.",
      );
      return;
    }

    const confirmar = window.confirm("¿Confirmas eliminar esta foto?");
    if (!confirmar) return;

    setEliminandoFotoId(foto.id);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("informes_fotos")
        .delete()
        .eq("id", foto.id);

      if (error) {
        console.error("Error eliminando foto:", error.message);
        setErrorMessage(error.message);
        return;
      }

      const { count: referenciasRestantes, error: referenciasError } =
        await supabase
          .from("informes_fotos")
          .select("id", { count: "exact", head: true })
          .eq("archivo_url", foto.archivo_url);

      if (referenciasError) {
        console.warn(
          "No se pudo verificar referencias de la foto:",
          referenciasError.message,
        );
      } else if ((referenciasRestantes ?? 0) === 0) {
        const { error: storageError } = await supabase.storage
          .from("informes-fotos")
          .remove([foto.archivo_url]);

        if (storageError) {
          console.warn("No se pudo eliminar archivo de Storage:", storageError.message);
        }
      }

      setFotos((actuales) => actuales.filter((item) => item.id !== foto.id));
    } catch (error) {
      console.error("Error inesperado eliminando foto:", error);
      setErrorMessage("No se pudo eliminar la foto del informe.");
    } finally {
      setEliminandoFotoId(null);
    }
  }

  async function handleAgregarAnexo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage(
        "Solo se pueden agregar anexos en informes en estado borrador.",
      );
      return;
    }

    if (!anexoArchivo) {
      setErrorMessage("Debes seleccionar un archivo para subir.");
      return;
    }

    setGuardandoAnexo(true);
    setErrorMessage("");

    try {
      const storagePath = crearStoragePath(
        empresaActivaId,
        informe.id,
        anexoArchivo.name,
      );

      const { error: uploadError } = await supabase.storage
        .from("informes-anexos")
        .upload(storagePath, anexoArchivo, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error subiendo anexo:", uploadError.message);
        setErrorMessage(uploadError.message);
        return;
      }

      const nombreNormalizado = anexoNombre.trim() || anexoArchivo.name;

      const { data, error } = await supabase
        .from("informes_anexos")
        .insert({
          informe_id: informe.id,
          archivo_url: storagePath,
          nombre: nombreNormalizado,
          tipo_anexo: anexoTipo.trim() || anexoArchivo.type || null,
          descripcion: anexoDescripcion.trim() || null,
          visible_en_informe: anexoVisibleEnInforme,
          orden: anexos.length + 1,
        })
        .select(
          "id, informe_id, archivo_url, nombre, tipo_anexo, descripcion, visible_en_informe, orden",
        )
        .single();

      if (error) {
        console.error("Error registrando anexo:", error.message);
        setErrorMessage(error.message);
        await supabase.storage.from("informes-anexos").remove([storagePath]);
        return;
      }

      const anexoGuardado = data as InformeAnexo;
      const urlFirmada = await crearUrlFirmada(
        "informes-anexos",
        anexoGuardado.archivo_url,
      );

      setAnexos((actuales) => [
        ...actuales,
        { ...anexoGuardado, url_firmada: urlFirmada },
      ]);
      setAnexoArchivo(null);
      setAnexoNombre("");
      setAnexoTipo("");
      setAnexoDescripcion("");
      setAnexoVisibleEnInforme(true);
      form.reset();
    } catch (error) {
      console.error("Error inesperado agregando anexo:", error);
      setErrorMessage("No se pudo agregar el anexo al informe.");
    } finally {
      setGuardandoAnexo(false);
    }
  }

  async function handleEliminarAnexo(anexo: InformeAnexo) {
    if (!informe) return;

    if (informe.estado !== "borrador") {
      setErrorMessage(
        "Solo se pueden eliminar anexos en informes en estado borrador.",
      );
      return;
    }

    const confirmar = window.confirm("¿Confirmas eliminar este anexo?");
    if (!confirmar) return;

    setEliminandoAnexoId(anexo.id);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("informes_anexos")
        .delete()
        .eq("id", anexo.id);

      if (error) {
        console.error("Error eliminando anexo:", error.message);
        setErrorMessage(error.message);
        return;
      }

      const { count: referenciasRestantes, error: referenciasError } =
        await supabase
          .from("informes_anexos")
          .select("id", { count: "exact", head: true })
          .eq("archivo_url", anexo.archivo_url);

      if (referenciasError) {
        console.warn(
          "No se pudo verificar referencias del anexo:",
          referenciasError.message,
        );
      } else if ((referenciasRestantes ?? 0) === 0) {
        const { error: storageError } = await supabase.storage
          .from("informes-anexos")
          .remove([anexo.archivo_url]);

        if (storageError) {
          console.warn("No se pudo eliminar archivo de Storage:", storageError.message);
        }
      }

      setAnexos((actuales) =>
        actuales.filter((item) => item.id !== anexo.id),
      );
    } catch (error) {
      console.error("Error inesperado eliminando anexo:", error);
      setErrorMessage("No se pudo eliminar el anexo del informe.");
    } finally {
      setEliminandoAnexoId(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Cargando informe técnico...</p>
      </section>
    );
  }

  if (empresaActivaId !== RMSIC_EMPRESA_ID) {
    return (
      <section className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-amber-700">Acceso restringido</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">
          Módulo en desarrollo interno
        </h1>
        <p className="mt-3 text-sm leading-6 text-amber-800">
          El módulo Informes Técnicos se encuentra habilitado inicialmente solo
          para RMSIC.
        </p>
        <Link href="/informes" className={`${buttonPrimary} mt-5`}>
          Volver
        </Link>
      </section>
    );
  }

  if (!informe) {
    return (
      <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-red-700">
          Informe no encontrado
        </p>
        <p className="mt-2 text-sm text-red-700">
          No fue posible cargar el informe solicitado.
        </p>
        {errorMessage && (
          <p className="mt-2 text-xs text-red-600">{errorMessage}</p>
        )}
        <Link href="/informes" className={`${buttonPrimary} mt-5`}>
          Volver al listado
        </Link>
      </section>
    );
  }

  const secciones = [
    { titulo: "Resumen ejecutivo", contenido: informe.resumen_ejecutivo },
    { titulo: "Antecedentes", contenido: informe.antecedentes },
    { titulo: "Objetivo", contenido: informe.objetivo },
    { titulo: "Alcance", contenido: informe.alcance },
    { titulo: "Metodología", contenido: informe.metodologia },
    { titulo: "Desarrollo del levantamiento", contenido: informe.desarrollo },
    { titulo: "Análisis técnico", contenido: informe.analisis_tecnico },
    { titulo: "Conclusiones", contenido: informe.conclusiones },
  ].filter((seccion) => hasText(seccion.contenido));

  const mostrarMediciones =
    informe.estado === "borrador" || mediciones.length > 0;
  const mostrarHallazgos =
    informe.estado === "borrador" || hallazgos.length > 0;
  const mostrarRecomendaciones =
    informe.estado === "borrador" || recomendaciones.length > 0;
  const mostrarFotos = informe.estado === "borrador" || fotos.length > 0;
  const mostrarAnexos = informe.estado === "borrador" || anexos.length > 0;
  const mostrarDestinatario =
    hasText(informe.destinatario_nombre) ||
    hasText(informe.destinatario_cargo) ||
    hasText(informe.destinatario_area) ||
    hasText(informe.destinatario_email);
  const responsableNombre =
    informe.responsable_nombre || DEFAULT_RESPONSABLE_NOMBRE;
  const responsableCargo =
    informe.responsable_cargo || DEFAULT_RESPONSABLE_CARGO;
  const esVersionHistorica = informe.es_version_actual === false;
  const esNuevaVersionEnPreparacion =
    informe.estado === "borrador" && Boolean(informe.version_anterior_id);
  const vigenciaLabel = esVersionHistorica ? "Histórica" : "Actual";

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Informe técnico
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {informe.titulo}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {informe.codigo} · Versión {informe.version} ·{" "}
              {estadoInformeLabel(informe.estado)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[#B8D4EA] bg-[#F4FAFE] px-3 py-1 font-semibold text-[#163A5F]">
                v{informe.version}
              </span>

              <span
                className={
                  esVersionHistorica
                    ? "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-800"
                    : "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700"
                }
              >
                {vigenciaLabel}
              </span>

              {esNuevaVersionEnPreparacion && (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-semibold text-sky-700">
                  Nueva versión en preparación
                </span>
              )}
            </div>
          </div>

          <div className={buttonGroup}>
            {informe.estado === "borrador" && (
              <>
                <Link
                  href={`/informes/${informe.id}/editar`}
                  className={buttonPrimary}
                >
                  Editar
                </Link>

                <button
                  type="button"
                  onClick={handleEmitirInforme}
                  disabled={emitiendo}
                  className={buttonPrimary}
                >
                  {emitiendo ? "Emitiendo..." : "Emitir informe"}
                </button>
              </>
            )}

            {informe.estado === "emitido" && informe.es_version_actual !== false && (
              <button
                type="button"
                onClick={handleCrearNuevaVersion}
                disabled={creandoVersion}
                className={buttonPrimary}
              >
                {creandoVersion ? "Creando versión..." : "Crear nueva versión"}
              </button>
            )}

            <Link
              href={`/informes/${informe.id}/pdf`}
              className={buttonPrimary}
            >
              Vista PDF
            </Link>

            <Link href="/informes" className={buttonPrimary}>
              Volver
            </Link>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {esVersionHistorica ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-semibold">Versión histórica del informe</p>
          <p className="mt-1 leading-6">
            Estás visualizando {informe.codigo} · v{informe.version}. Esta versión
            queda disponible solo para trazabilidad documental. No debe ser
            modificada ni utilizada como versión vigente.
          </p>
        </div>
      ) : esNuevaVersionEnPreparacion ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
          <p className="font-semibold">Nueva versión en preparación</p>
          <p className="mt-1 leading-6">
            Estás trabajando sobre {informe.codigo} · v{informe.version}. Esta
            versión aún está en borrador y debe emitirse formalmente para quedar
            vigente.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <p className="font-semibold">Versión actual del informe</p>
          <p className="mt-1 leading-6">
            Estás visualizando la versión vigente de {informe.codigo} ·
            v{informe.version}.
          </p>
        </div>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Datos generales
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">
              Cliente
            </p>
            <p className="mt-1 text-sm text-slate-900">
              {cliente?.nombre || "Cliente no cargado"}
              {cliente?.rut ? ` - ${cliente.rut}` : ""}
            </p>
          </div>

          {mostrarDestinatario && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <p className="text-xs font-medium uppercase text-slate-500">
                Dirigido a
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {informe.destinatario_nombre || "Contacto no especificado"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {hasText(informe.destinatario_cargo) && (
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                    Cargo: {informe.destinatario_cargo}
                  </span>
                )}

                {hasText(informe.destinatario_area) && (
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                    Área: {informe.destinatario_area}
                  </span>
                )}

                {hasText(informe.destinatario_email) && (
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                    Correo: {informe.destinatario_email}
                  </span>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase text-slate-500">
              Fecha informe
            </p>
            <p className="mt-1 text-sm text-slate-900">
              {informe.fecha_informe}
            </p>
          </div>

          {hasText(informe.fecha_emision) && (
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Fecha emisión
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {informe.fecha_emision
  ? new Date(informe.fecha_emision).toLocaleString('es-CL')
  : 'Pendiente de emisión'}
              </p>
            </div>
          )}

          {informe.estado === "emitido" &&
            (hasText(informe.emitido_por_nombre) ||
              hasText(informe.emitido_por_email)) && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 md:col-span-2">
                <p className="text-xs font-medium uppercase text-emerald-700">
                  Emisión formal
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">
                  Emitido por: {informe.emitido_por_nombre || "Usuario RMSIC"}
                </p>
                {hasText(informe.emitido_por_email) && (
                  <p className="mt-1 text-sm text-emerald-800">
                    Correo: {informe.emitido_por_email}
                  </p>
                )}
              </div>
            )}

          {(hasText(informe.motivo_version) || informe.version_anterior_id || informe.informe_origen_id) && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <p className="text-xs font-medium uppercase text-slate-500">
                Control de versión
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {informe.es_version_actual === false
                  ? "Versión histórica"
                  : "Versión actual"}
              </p>
              {hasText(informe.motivo_version) && (
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Motivo: {informe.motivo_version}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Tipo</p>
            <p className="mt-1 text-sm text-slate-900">
              {tipoInformeLabel(informe.tipo_informe)}
            </p>
          </div>

          {hasText(informe.subtipo_informe) && (
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Subtipo
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {informe.subtipo_informe}
              </p>
            </div>
          )}

          {hasText(informe.area_ubicacion) && (
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Área / ubicación
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {informe.area_ubicacion}
              </p>
            </div>
          )}

          {hasText(informe.equipo_tag) && (
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Equipo / TAG
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {informe.equipo_tag}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Responsable técnico RMSIC
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">
              Responsable
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {responsableNombre}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase text-slate-500">
              Cargo / formación
            </p>
            <p className="mt-1 text-sm text-slate-900">{responsableCargo}</p>
          </div>

          {hasText(informe.responsable_email) && (
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Correo
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {informe.responsable_email}
              </p>
            </div>
          )}

          {hasText(informe.responsable_telefono) && (
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Teléfono
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {informe.responsable_telefono}
              </p>
            </div>
          )}
        </div>
      </section>

      {secciones.length === 0 ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Este informe todavía no tiene contenido técnico registrado.
          </p>
        </section>
      ) : (
        secciones.map((seccion, index) => (
          <section
            key={seccion.titulo}
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">
              {index + 1}. {seccion.titulo}
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">
              {seccion.contenido}
            </p>
          </section>
        ))
      )}

      {mostrarMediciones && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Mediciones técnicas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Registra parámetros medidos en terreno, punto de medición, fase,
                valor, unidad y observaciones.
              </p>
            </div>
          </div>

          {mediciones.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
              Todavía no existen mediciones registradas para este informe.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">#</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold">Punto</th>
                    <th className="px-4 py-3 text-left font-semibold">Fase</th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Parámetro
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Valor</th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Observación
                    </th>
                    {informe.estado === "borrador" && (
                      <th className="px-4 py-3 text-right font-semibold">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {mediciones.map((medicion, index) => (
                    <tr
                      key={medicion.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-3 text-slate-600">{index + 1}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatFechaMedicion(medicion.fecha_medicion)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {medicion.punto_medicion || "Sin punto"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {medicion.fase || "General"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {medicion.parametro}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatValorMedicion(medicion.valor)}
                        {medicion.unidad ? ` ${medicion.unidad}` : ""}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {medicion.observacion || "Sin observación"}
                      </td>
                      {informe.estado === "borrador" && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleEliminarMedicion(medicion.id)}
                            disabled={eliminandoMedicionId === medicion.id}
                            className={buttonDangerSmall}
                          >
                            {eliminandoMedicionId === medicion.id
                              ? "Eliminando..."
                              : "Eliminar"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {informe.estado === "borrador" && (
            <form
              onSubmit={handleAgregarMedicion}
              className="mt-6 rounded-2xl border border-slate-200 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">
                Agregar medición
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Fecha y hora
                  </span>
                  <input
                    type="datetime-local"
                    value={medicionFecha}
                    onChange={(event) => setMedicionFecha(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Punto de medición
                  </span>
                  <input
                    value={medicionPunto}
                    onChange={(event) => setMedicionPunto(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: Tablero general, línea principal"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Fase
                  </span>
                  <input
                    value={medicionFase}
                    onChange={(event) => setMedicionFase(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: R, S, T, R-S, General"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Parámetro
                  </span>
                  <input
                    value={medicionParametro}
                    onChange={(event) =>
                      setMedicionParametro(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: Factor de potencia, tensión, corriente"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Valor
                  </span>
                  <input
                    value={medicionValor}
                    onChange={(event) => setMedicionValor(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    inputMode="decimal"
                    placeholder="Ej: 0.82, 380, 42"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Unidad
                  </span>
                  <input
                    value={medicionUnidad}
                    onChange={(event) => setMedicionUnidad(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: V, A, kW, kVAr, cos φ"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Observación
                  </span>
                  <textarea
                    value={medicionObservacion}
                    onChange={(event) =>
                      setMedicionObservacion(event.target.value)
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: Medición bajo carga normal, sin banco de condensadores conectado."
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={guardandoMedicion}
                  className={buttonPrimary}
                >
                  {guardandoMedicion ? "Agregando..." : "Agregar medición"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {mostrarHallazgos && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Hallazgos técnicos
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Registra condiciones detectadas, desviaciones, evidencias y
                nivel de severidad.
              </p>
            </div>
          </div>

          {hallazgos.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
              Todavía no existen hallazgos registrados para este informe.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {hallazgos.map((hallazgo, index) => (
                <div
                  key={hallazgo.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-500">
                        Hallazgo {index + 1}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-900">
                        {hallazgo.titulo}
                      </h3>
                    </div>

                    {informe.estado === "borrador" && (
                      <button
                        type="button"
                        onClick={() => handleEliminarHallazgo(hallazgo.id)}
                        disabled={eliminandoHallazgoId === hallazgo.id}
                        className={buttonDangerSmall}
                      >
                        {eliminandoHallazgoId === hallazgo.id
                          ? "Eliminando..."
                          : "Eliminar"}
                      </button>
                    )}
                  </div>

                  {hasText(hallazgo.descripcion) && (
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                      {hallazgo.descripcion}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                      Severidad: {severidadLabel(hallazgo.severidad)}
                    </span>

                    {hasText(hallazgo.evidencia) && (
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                        Evidencia: {hallazgo.evidencia}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {informe.estado === "borrador" && (
            <form
              onSubmit={handleAgregarHallazgo}
              className="mt-6 rounded-2xl border border-slate-200 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">
                Agregar hallazgo
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Título
                  </span>
                  <input
                    value={hallazgoTitulo}
                    onChange={(event) => setHallazgoTitulo(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: Bajo factor de potencia detectado"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Descripción
                  </span>
                  <textarea
                    value={hallazgoDescripcion}
                    onChange={(event) =>
                      setHallazgoDescripcion(event.target.value)
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Describe el hallazgo técnico observado en terreno."
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Severidad
                  </span>
                  <select
                    value={hallazgoSeveridad}
                    onChange={(event) =>
                      setHallazgoSeveridad(
                        event.target.value as
                          "baja" | "media" | "alta" | "critica" | "",
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Sin severidad</option>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Evidencia
                  </span>
                  <input
                    value={hallazgoEvidencia}
                    onChange={(event) =>
                      setHallazgoEvidencia(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: Medición, fotografía, inspección visual"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={guardandoHallazgo}
                  className={buttonPrimary}
                >
                  {guardandoHallazgo ? "Agregando..." : "Agregar hallazgo"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {mostrarRecomendaciones && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recomendaciones técnicas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Registra acciones sugeridas, prioridades y oportunidades que
                pueden derivar en una cotización.
              </p>
            </div>
          </div>

          {recomendaciones.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
              Todavía no existen recomendaciones registradas para este informe.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recomendaciones.map((recomendacion, index) => (
                <div
                  key={recomendacion.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-500">
                        Recomendación {index + 1}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-900">
                        {recomendacion.titulo}
                      </h3>
                    </div>

                    {informe.estado === "borrador" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleEliminarRecomendacion(recomendacion.id)
                        }
                        disabled={
                          eliminandoRecomendacionId === recomendacion.id
                        }
                        className={buttonDangerSmall}
                      >
                        {eliminandoRecomendacionId === recomendacion.id
                          ? "Eliminando..."
                          : "Eliminar"}
                      </button>
                    )}
                  </div>

                  {hasText(recomendacion.descripcion) && (
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                      {recomendacion.descripcion}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                      Prioridad: {prioridadLabel(recomendacion.prioridad)}
                    </span>

                    {hasText(recomendacion.plazo_sugerido) && (
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                        Plazo: {recomendacion.plazo_sugerido}
                      </span>
                    )}

                    {recomendacion.requiere_cotizacion && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800 ring-1 ring-amber-200">
                        Requiere cotización
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {informe.estado === "borrador" && (
            <form
              onSubmit={handleAgregarRecomendacion}
              className="mt-6 rounded-2xl border border-slate-200 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">
                Agregar recomendación
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Título
                  </span>
                  <input
                    value={recomendacionTitulo}
                    onChange={(event) =>
                      setRecomendacionTitulo(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: Implementar banco de condensadores automático"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Descripción
                  </span>
                  <textarea
                    value={recomendacionDescripcion}
                    onChange={(event) =>
                      setRecomendacionDescripcion(event.target.value)
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Describe la recomendación técnica y su justificación."
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Prioridad
                  </span>
                  <select
                    value={recomendacionPrioridad}
                    onChange={(event) =>
                      setRecomendacionPrioridad(
                        event.target.value as "baja" | "media" | "alta" | "",
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Sin prioridad</option>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Plazo sugerido
                  </span>
                  <input
                    value={recomendacionPlazo}
                    onChange={(event) =>
                      setRecomendacionPlazo(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: Corto plazo, 30 días, próxima mantención"
                  />
                </label>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={recomendacionRequiereCotizacion}
                  onChange={(event) =>
                    setRecomendacionRequiereCotizacion(event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Requiere cotización posterior
              </label>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={guardandoRecomendacion}
                  className={buttonPrimary}
                >
                  {guardandoRecomendacion
                    ? "Agregando..."
                    : "Agregar recomendación"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {mostrarFotos && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Evidencia fotográfica
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Adjunta fotografías de terreno, tableros, equipos, mediciones o
              condiciones observadas.
            </p>
          </div>

          {fotos.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
              Todavía no existen fotografías registradas para este informe.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {fotos.map((foto, index) => (
                <article
                  key={foto.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                >
                  <div className="flex aspect-video items-center justify-center bg-white">
                    {foto.url_firmada ? (
                      <img
                        src={foto.url_firmada}
                        alt={foto.titulo || `Foto ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <p className="px-4 text-center text-sm text-slate-500">
                        No fue posible cargar la vista previa de esta foto.
                      </p>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase text-slate-500">
                          Foto {index + 1}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900">
                          {foto.titulo || "Sin título"}
                        </h3>
                      </div>

                      {informe.estado === "borrador" && (
                        <button
                          type="button"
                          onClick={() => handleEliminarFoto(foto)}
                          disabled={eliminandoFotoId === foto.id}
                          className={buttonDangerSmall}
                        >
                          {eliminandoFotoId === foto.id
                            ? "Eliminando..."
                            : "Eliminar"}
                        </button>
                      )}
                    </div>

                    {hasText(foto.descripcion) && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                        {foto.descripcion}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                        Fecha: {formatFechaSimple(foto.fecha_foto)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                        {foto.visible_en_informe
                          ? "Visible en informe"
                          : "No visible en PDF"}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {informe.estado === "borrador" && (
            <form
              onSubmit={handleAgregarFoto}
              className="mt-6 rounded-2xl border border-slate-200 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">
                Agregar foto
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Imagen
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setFotoArchivo(event.target.files?.[0] ?? null)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Título
                  </span>
                  <input
                    value={fotoTitulo}
                    onChange={(event) => setFotoTitulo(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: Tablero general"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Fecha foto
                  </span>
                  <input
                    type="date"
                    value={fotoFecha}
                    onChange={(event) => setFotoFecha(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Descripción
                  </span>
                  <textarea
                    value={fotoDescripcion}
                    onChange={(event) =>
                      setFotoDescripcion(event.target.value)
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Describe brevemente qué evidencia muestra la fotografía."
                  />
                </label>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={fotoVisibleEnInforme}
                  onChange={(event) =>
                    setFotoVisibleEnInforme(event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Mostrar esta foto en el informe PDF
              </label>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={guardandoFoto}
                  className={buttonPrimary}
                >
                  {guardandoFoto ? "Subiendo..." : "Agregar foto"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {mostrarAnexos && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Anexos</h2>
            <p className="mt-1 text-sm text-slate-500">
              Adjunta respaldos, planillas, PDFs, certificados, registros o
              documentos asociados al informe.
            </p>
          </div>

          {anexos.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
              Todavía no existen anexos registrados para este informe.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {anexos.map((anexo, index) => (
                <article
                  key={anexo.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-500">
                        Anexo {index + 1}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-900">
                        {anexo.nombre}
                      </h3>
                      {hasText(anexo.descripcion) && (
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                          {anexo.descripcion}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {anexo.url_firmada && (
                        <a
                          href={anexo.url_firmada}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonPrimary}
                        >
                          Ver / Descargar
                        </a>
                      )}

                      {informe.estado === "borrador" && (
                        <button
                          type="button"
                          onClick={() => handleEliminarAnexo(anexo)}
                          disabled={eliminandoAnexoId === anexo.id}
                          className={buttonDangerSmall}
                        >
                          {eliminandoAnexoId === anexo.id
                            ? "Eliminando..."
                            : "Eliminar"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {hasText(anexo.tipo_anexo) && (
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                        Tipo: {anexo.tipo_anexo}
                      </span>
                    )}
                    <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                      {anexo.visible_en_informe
                        ? "Visible en informe"
                        : "No visible en PDF"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {informe.estado === "borrador" && (
            <form
              onSubmit={handleAgregarAnexo}
              className="mt-6 rounded-2xl border border-slate-200 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">
                Agregar anexo
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Archivo
                  </span>
                  <input
                    type="file"
                    onChange={(event) => {
                      const archivo = event.target.files?.[0] ?? null;
                      setAnexoArchivo(archivo);
                      if (archivo && !anexoNombre.trim()) {
                        setAnexoNombre(archivo.name);
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Nombre anexo
                  </span>
                  <input
                    value={anexoNombre}
                    onChange={(event) => setAnexoNombre(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: Registro de mediciones"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Tipo anexo
                  </span>
                  <input
                    value={anexoTipo}
                    onChange={(event) => setAnexoTipo(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ej: Planilla, PDF, certificado, respaldo"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Descripción
                  </span>
                  <textarea
                    value={anexoDescripcion}
                    onChange={(event) =>
                      setAnexoDescripcion(event.target.value)
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Describe brevemente el respaldo adjunto."
                  />
                </label>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={anexoVisibleEnInforme}
                  onChange={(event) =>
                    setAnexoVisibleEnInforme(event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Mostrar este anexo en el listado del PDF
              </label>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={guardandoAnexo}
                  className={buttonPrimary}
                >
                  {guardandoAnexo ? "Subiendo..." : "Agregar anexo"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
