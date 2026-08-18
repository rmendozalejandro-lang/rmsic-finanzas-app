"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  getEmpresaDefaultLogoSrc,
  getEmpresaLogoSrc,
} from "@/lib/empresa-branding";

type ClienteOption = {
  id: string;
  label: string;
};

type ContactoOption = {
  id: string;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  tipo_contacto: string;
  es_principal: boolean;
  recibe_cotizaciones: boolean;
};

export type CotizacionFormValues = {
  cliente_id: string;
  contacto_id: string;
  estado: "borrador" | "enviada" | "aprobada" | "rechazada" | "vencida";
  titulo: string;
  descripcion: string;
  observaciones: string;
  condiciones_comerciales: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  moneda: string;
  porcentaje_iva: string;
  descuento_global_tipo: "" | "porcentaje" | "monto";
  descuento_global_valor: string;
  empresa_nombre: string;
  empresa_logo_url: string;
  empresa_email: string;
  empresa_telefono: string;
  empresa_web: string;
  ejecutivo_nombre: string;
  ejecutivo_email: string;
  ejecutivo_telefono: string;
  numero_oc?: string | null;
  fecha_oc?: string | null;
  aprobacion_sin_oc?: boolean | null;
  tipo_respaldo_aprobacion?: string | null;
  referencia_aprobacion?: string | null;
  ingreso_generado_id?: string | null;
};

export type CotizacionFormItem = {
  uid: string;
  descripcion: string;
  detalle: string;
  unidad: string;
  cantidad: string;
  precio_unitario: string;
  descuento_tipo: "" | "porcentaje" | "monto";
  descuento_valor: string;
  afecto_iva: boolean;
};

export type CotizacionOrigenOt = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  folio: string | null;
  titulo: string | null;
  cliente_nombre: string;
};

type TipoRelacionOrigenOt =
  | "trabajo_adicional"
  | "ampliacion_alcance"
  | "cotizacion_postservicio"
  | "regularizacion";

type Props = {
  empresaId: string;
  clientes: ClienteOption[];
  initialValues: CotizacionFormValues;
  initialItems?: CotizacionFormItem[];
  mode?: "create" | "edit";
  cotizacionId?: string;
  backHref?: string;
  origenOt?: CotizacionOrigenOt;
};

type RespaldoAprobacionTipo = "" | "orden_compra" | "correo" | "whatsapp" | "contrato" | "verbal" | "otro";

type AprobacionFinancieraForm = {
  numero_oc: string;
  fecha_oc: string;
  aprobacion_sin_oc: boolean;
  tipo_respaldo_aprobacion: RespaldoAprobacionTipo;
  referencia_aprobacion: string;
  generar_ingreso_financiero: boolean;
  factura_emitida: boolean;
  numero_factura: string;
  fecha_factura: string;
};

type IngresoFinancieroCotizacionResult = {
  cotizacion_id: string;
  movimiento_id: string;
  cuenta_por_cobrar_id: string | null;
  mensaje: string;
};

function createEmptyItem(): CotizacionFormItem {
  return {
    uid:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `item-${Date.now()}-${Math.random()}`,
    descripcion: "",
    detalle: "",
    unidad: "",
    cantidad: "1",
    precio_unitario: "0",
    descuento_tipo: "",
    descuento_valor: "0",
    afecto_iva: true,
  };
}

function sanitizeDecimalInput(value: string) {
  const normalized = value.replace(/,/g, ".");
  const cleaned = normalized.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");

  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function toNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: currency || "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function getDefaultEmpresaLogoUrl(empresaNombre?: string | null) {
  return getEmpresaDefaultLogoSrc(empresaNombre) || "";
}

function normalizeEmpresaLogoUrl(value?: string | null) {
  const logo = (value || "").trim();

  if (!logo) return "";

  if (logo.startsWith("http://") || logo.startsWith("https://")) {
    return logo;
  }

  if (logo.startsWith("/")) {
    return logo;
  }

  return `/${logo.replace(/^public\//, "")}`;
}

function withDefaultEmpresaLogo(
  values: CotizacionFormValues
): CotizacionFormValues {
  const currentLogo = normalizeEmpresaLogoUrl(values.empresa_logo_url);
  const fallbackLogo = getDefaultEmpresaLogoUrl(values.empresa_nombre);

  return {
    ...values,
    empresa_logo_url: currentLogo || fallbackLogo,
  };
}

function calculateItem(item: CotizacionFormItem) {
  const cantidad = Math.max(0, toNumber(item.cantidad));
  const precioUnitario = Math.max(0, toNumber(item.precio_unitario));
  const bruto = round2(cantidad * precioUnitario);

  let descuento = 0;

  if (item.descuento_tipo === "porcentaje") {
    descuento = round2(
      bruto *
        (Math.min(100, Math.max(0, toNumber(item.descuento_valor))) / 100)
    );
  } else if (item.descuento_tipo === "monto") {
    descuento = round2(
      Math.min(bruto, Math.max(0, toNumber(item.descuento_valor)))
    );
  }

  const subtotal = round2(Math.max(bruto - descuento, 0));

  return {
    bruto,
    descuento,
    subtotal,
  };
}

function calculateSummary(
  items: CotizacionFormItem[],
  descuentoGlobalTipo: CotizacionFormValues["descuento_global_tipo"],
  descuentoGlobalValor: string,
  porcentajeIva: string
) {
  const subtotalItemsNeto = round2(
    items.reduce((acc, item) => {
      const calc = calculateItem(item);
      return item.afecto_iva ? acc + calc.subtotal : acc;
    }, 0)
  );

  const subtotalItemsExento = round2(
    items.reduce((acc, item) => {
      const calc = calculateItem(item);
      return item.afecto_iva ? acc : acc + calc.subtotal;
    }, 0)
  );

  const brutoTotal = round2(subtotalItemsNeto + subtotalItemsExento);

  let descuentoGlobalTotal = 0;

  if (brutoTotal > 0) {
    if (descuentoGlobalTipo === "porcentaje") {
      descuentoGlobalTotal = round2(
        brutoTotal *
          (Math.min(100, Math.max(0, toNumber(descuentoGlobalValor))) / 100)
      );
    } else if (descuentoGlobalTipo === "monto") {
      descuentoGlobalTotal = round2(
        Math.min(brutoTotal, Math.max(0, toNumber(descuentoGlobalValor)))
      );
    }
  }

  const descuentoGlobalNeto =
    descuentoGlobalTotal > 0 && brutoTotal > 0
      ? round2(descuentoGlobalTotal * (subtotalItemsNeto / brutoTotal))
      : 0;

  const descuentoGlobalExento = round2(
    descuentoGlobalTotal - descuentoGlobalNeto
  );

  const subtotalNeto = round2(
    Math.max(subtotalItemsNeto - descuentoGlobalNeto, 0)
  );
  const subtotalExento = round2(
    Math.max(subtotalItemsExento - descuentoGlobalExento, 0)
  );
  const montoIva = round2(
    subtotalNeto * (Math.max(0, toNumber(porcentajeIva)) / 100)
  );
  const total = round2(subtotalNeto + subtotalExento + montoIva);

  return {
    subtotalItemsNeto,
    subtotalItemsExento,
    descuentoGlobalNeto,
    descuentoGlobalExento,
    descuentoGlobalTotal,
    subtotalNeto,
    subtotalExento,
    montoIva,
    total,
  };
}

function normalizeDiscountType(
  value: string
): "porcentaje" | "monto" | null {
  if (value === "porcentaje" || value === "monto") return value;
  return null;
}

function itemSignature(item: {
  descripcion: string;
  detalle?: string | null;
  unidad?: string | null;
  cantidad: number | string;
  precio_unitario: number | string;
  descuento_tipo?: string | null;
  descuento_valor: number | string;
  afecto_iva: boolean;
}) {
  return [
    item.descripcion.trim().toLowerCase(),
    (item.detalle ?? "").trim().toLowerCase(),
    (item.unidad ?? "").trim().toLowerCase(),
    round2(typeof item.cantidad === "number" ? item.cantidad : toNumber(item.cantidad)),
    round2(
      typeof item.precio_unitario === "number"
        ? item.precio_unitario
        : toNumber(item.precio_unitario)
    ),
    item.descuento_tipo || "",
    round2(
      typeof item.descuento_valor === "number"
        ? item.descuento_valor
        : toNumber(item.descuento_valor)
    ),
    item.afecto_iva ? "iva" : "no-iva",
  ].join("|");
}

function deduplicateFormItems(items: CotizacionFormItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const signature = itemSignature(item);

    if (seen.has(signature)) return false;

    seen.add(signature);
    return true;
  });
}

export default function CotizacionForm({
  empresaId,
  clientes,
  initialValues,
  initialItems,
  mode = "create",
  cotizacionId,
  backHref,
  origenOt,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CotizacionFormValues>(() =>
    withDefaultEmpresaLogo(initialValues)
  );
  const [items, setItems] = useState<CotizacionFormItem[]>(() => {
    const initial = initialItems && initialItems.length > 0
      ? deduplicateFormItems(initialItems)
      : [];

    return initial.length > 0 ? initial : [createEmptyItem()];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cotizacionPersistidaId, setCotizacionPersistidaId] =
    useState<string | null>(null);
  const [falloPosteriorPersistencia, setFalloPosteriorPersistencia] = useState<
    "relacion" | "financiero" | "otro" | null
  >(null);
  const [tipoRelacionOrigenOt, setTipoRelacionOrigenOt] =
    useState<TipoRelacionOrigenOt>("trabajo_adicional");
  const [contactos, setContactos] = useState<ContactoOption[]>([]);
  const [loadingContactos, setLoadingContactos] = useState(
    Boolean(initialValues.cliente_id)
  );
  const [ingresoGeneradoId, setIngresoGeneradoId] = useState<string | null>(
    initialValues.ingreso_generado_id ?? null
  );
  const [aprobacionFinanciera, setAprobacionFinanciera] =
    useState<AprobacionFinancieraForm>({
      numero_oc: initialValues.numero_oc ?? "",
      fecha_oc: initialValues.fecha_oc ?? "",
      aprobacion_sin_oc: Boolean(initialValues.aprobacion_sin_oc),
      tipo_respaldo_aprobacion:
        (initialValues.tipo_respaldo_aprobacion as RespaldoAprobacionTipo) || "",
      referencia_aprobacion: initialValues.referencia_aprobacion ?? "",
      generar_ingreso_financiero:
        initialValues.estado === "aprobada" && !initialValues.ingreso_generado_id,
      factura_emitida: false,
      numero_factura: "",
      fecha_factura: "",
    });

  const summary = useMemo(() => {
    return calculateSummary(
      items,
      form.descuento_global_tipo,
      form.descuento_global_valor,
      form.porcentaje_iva
    );
  }, [
    items,
    form.descuento_global_tipo,
    form.descuento_global_valor,
    form.porcentaje_iva,
  ]);

  const isEdit = mode === "edit";
  const mostrarAprobacionFinanciera = form.estado === "aprobada";
  const puedeGenerarIngresoFinanciero =
    mostrarAprobacionFinanciera && !ingresoGeneradoId;

  useEffect(() => {
    let active = true;

    if (!form.cliente_id) {
      return;
    }

    supabase
      .from("contactos")
      .select("id,nombre,cargo,email,telefono,tipo_contacto,es_principal,recibe_cotizaciones")
      .eq("empresa_id", empresaId)
      .eq("cliente_id", form.cliente_id)
      .eq("activo", true)
      .then(({ data, error: contactosError }) => {
        if (!active) return;
        if (contactosError) {
          setContactos([]);
          setError("No se pudieron cargar los contactos del cliente.");
        } else {
          const rows = (data ?? []) as ContactoOption[];
          rows.sort((a, b) => {
            const score = (contacto: ContactoOption) =>
              Number(contacto.recibe_cotizaciones) * 4 +
              Number(contacto.es_principal) * 2 +
              Number(["comercial", "gerencia"].includes(contacto.tipo_contacto));
            return score(b) - score(a) || a.nombre.localeCompare(b.nombre, "es");
          });
          setContactos(rows);
        }
        setLoadingContactos(false);
      });

    return () => {
      active = false;
    };
  }, [empresaId, form.cliente_id]);

  useEffect(() => {
    if (!cotizacionId || !empresaId || !isEdit) return;

    let isMounted = true;

    async function cargarDatosFinancierosCotizacion() {
      const { data, error: fetchError } = await supabase
        .from("cotizaciones")
        .select(
          "numero_oc,fecha_oc,aprobacion_sin_oc,tipo_respaldo_aprobacion,referencia_aprobacion,ingreso_generado_id"
        )
        .eq("id", cotizacionId)
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (!isMounted || fetchError || !data) return;

      setIngresoGeneradoId(data.ingreso_generado_id ?? null);
      setAprobacionFinanciera((prev) => ({
        ...prev,
        numero_oc: data.numero_oc ?? prev.numero_oc,
        fecha_oc: data.fecha_oc ?? prev.fecha_oc,
        aprobacion_sin_oc: Boolean(data.aprobacion_sin_oc),
        tipo_respaldo_aprobacion:
          (data.tipo_respaldo_aprobacion as RespaldoAprobacionTipo) ||
          prev.tipo_respaldo_aprobacion,
        referencia_aprobacion:
          data.referencia_aprobacion ?? prev.referencia_aprobacion,
        generar_ingreso_financiero: !data.ingreso_generado_id,
        factura_emitida: false,
        numero_factura: "",
        fecha_factura: "",
      }));
    }

    cargarDatosFinancierosCotizacion();

    return () => {
      isMounted = false;
    };
  }, [cotizacionId, empresaId, isEdit]);

  useEffect(() => {
    if (form.estado !== "aprobada") return;

    // Mantiene sincronizado el checkbox derivado del ingreso ya generado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAprobacionFinanciera((prev) => ({
      ...prev,
      generar_ingreso_financiero: !ingresoGeneradoId,
    }));
  }, [form.estado, ingresoGeneradoId]);

  function updateFormField<K extends keyof CotizacionFormValues>(
    key: K,
    value: CotizacionFormValues[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateAprobacionFinanciera<K extends keyof AprobacionFinancieraForm>(
    key: K,
    value: AprobacionFinancieraForm[K]
  ) {
    setAprobacionFinanciera((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateItem<K extends keyof CotizacionFormItem>(
    uid: string,
    key: K,
    value: CotizacionFormItem[K]
  ) {
    setItems((prev) =>
      prev.map((item) => (item.uid === uid ? { ...item, [key]: value } : item))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem()]);
  }

  function removeItem(uid: string) {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((item) => item.uid !== uid);
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || (origenOt && cotizacionPersistidaId)) return;

    setError(null);
    setSaving(true);
    let persistedIdThisSubmit: string | null = null;

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const session = data.session;

      if (sessionError || !session) {
        setError("No se pudo recuperar la sesión activa del navegador.");
        setSaving(false);
        return;
      }

      const accessToken = session.access_token;
      const user = session.user;

      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

      if (!apiKey || !baseUrl) {
        setError("Faltan variables públicas de Supabase.");
        setSaving(false);
        return;
      }

      if (origenOt) {
        const [rolResp, otResp] = await Promise.all([
          supabase
            .from("usuario_empresas")
            .select("rol")
            .eq("usuario_id", user.id)
            .eq("empresa_id", empresaId)
            .eq("activo", true)
            .maybeSingle(),
          supabase
            .from("ot_ordenes_trabajo")
            .select("id,empresa_id,cliente_id,activo,deleted_at")
            .eq("id", origenOt.id)
            .eq("empresa_id", empresaId)
            .maybeSingle(),
        ]);

        if (rolResp.error || rolResp.data?.rol !== "admin") {
          setError("Solo el administrador puede crear cotizaciones desde una OT.");
          setSaving(false);
          return;
        }

        if (
          otResp.error ||
          !otResp.data ||
          otResp.data.empresa_id !== origenOt.empresa_id ||
          !otResp.data.activo ||
          otResp.data.deleted_at ||
          !otResp.data.cliente_id
        ) {
          setError("La OT de origen ya no está activa o disponible en la empresa actual. Recarga la página antes de crear la cotización.");
          setSaving(false);
          return;
        }

        if (
          otResp.data.cliente_id !== origenOt.cliente_id ||
          otResp.data.cliente_id !== form.cliente_id
        ) {
          setError("El cliente de la OT cambió mientras el formulario estaba abierto. Recarga la página antes de crear la cotización.");
          setSaving(false);
          return;
        }
      }

      const sanitizedItems = items
        .map((item, index) => ({
          orden: index + 1,
          descripcion: item.descripcion.trim(),
          detalle: item.detalle.trim() || null,
          unidad: item.unidad.trim() || null,
          cantidad: Math.max(0, toNumber(item.cantidad)) || 1,
          precio_unitario: Math.max(0, toNumber(item.precio_unitario)),
          descuento_tipo: normalizeDiscountType(item.descuento_tipo),
          descuento_valor: Math.max(0, toNumber(item.descuento_valor)),
          afecto_iva: item.afecto_iva,
        }))
        .filter((item) => item.descripcion.length > 0);

      const itemMap = new Map<string, (typeof sanitizedItems)[number]>();

      for (const item of sanitizedItems) {
        const signature = itemSignature(item);

        if (!itemMap.has(signature)) {
          itemMap.set(signature, item);
        }
      }

      const validItems = Array.from(itemMap.values()).map((item, index) => ({
        ...item,
        orden: index + 1,
      }));

      if (!form.titulo.trim()) {
        setError("Debes ingresar un título para la cotización.");
        setSaving(false);
        return;
      }

      if (!form.fecha_emision) {
        setError("Debes ingresar la fecha de emisión.");
        setSaving(false);
        return;
      }

      if (validItems.length === 0) {
        setError("Debes agregar al menos un ítem con descripción.");
        setSaving(false);
        return;
      }

      if (
        form.estado === "aprobada" &&
        aprobacionFinanciera.generar_ingreso_financiero &&
        !ingresoGeneradoId
      ) {
        const tieneOc = aprobacionFinanciera.numero_oc.trim().length > 0;
        const tieneRespaldoSinOc =
          aprobacionFinanciera.aprobacion_sin_oc &&
          aprobacionFinanciera.tipo_respaldo_aprobacion &&
          aprobacionFinanciera.referencia_aprobacion.trim().length > 0;

        if (!tieneOc && !tieneRespaldoSinOc) {
          setError(
            "Para generar el ingreso financiero debes ingresar una OC o marcar aprobación sin OC con tipo y referencia de respaldo."
          );
          setSaving(false);
          return;
        }

        if (
          aprobacionFinanciera.factura_emitida &&
          !aprobacionFinanciera.numero_factura.trim()
        ) {
          setError("Debe ingresar el número de factura.");
          setSaving(false);
          return;
        }

        if (
          aprobacionFinanciera.factura_emitida &&
          !aprobacionFinanciera.fecha_factura
        ) {
          setError("Debe ingresar la fecha de la factura.");
          setSaving(false);
          return;
        }
      }

      const porcentajeIva = Math.min(
        100,
        Math.max(0, toNumber(form.porcentaje_iva))
      );

      let descuentoGlobalValor = Math.max(
        0,
        toNumber(form.descuento_global_valor)
      );

      if (form.descuento_global_tipo === "porcentaje") {
        descuentoGlobalValor = Math.min(100, descuentoGlobalValor);
      }

      // En creación, toma el branding nuevamente desde la empresa activa para
      // guardar un snapshot confiable aunque el formulario lleve tiempo abierto.
      // En edición se conserva el snapshot existente de la cotización.
      let empresaLogoSnapshot =
        normalizeEmpresaLogoUrl(form.empresa_logo_url) ||
        getDefaultEmpresaLogoUrl(form.empresa_nombre);

      if (!isEdit) {
        const { data: empresaActiva, error: empresaError } = await supabase
          .from("empresas")
          .select("*")
          .eq("id", empresaId)
          .maybeSingle();

        if (empresaError || !empresaActiva || empresaActiva.activa !== true) {
          setError("La empresa activa no está disponible para crear cotizaciones.");
          setSaving(false);
          return;
        }

        empresaLogoSnapshot = getEmpresaLogoSrc({
          ...empresaActiva,
          empresaNombre: form.empresa_nombre,
        }) || "";
      }

      const contactoSeleccionado = contactos.find(
        (contacto) => contacto.id === form.contacto_id
      );

      if (form.contacto_id && !contactoSeleccionado) {
        setError("El contacto destinatario no pertenece al cliente seleccionado.");
        setSaving(false);
        return;
      }

      const cotizacionPayload = {
        empresa_id: empresaId,
        cliente_id: form.cliente_id || null,
        contacto_id: contactoSeleccionado?.id || null,
        contacto_nombre_snapshot: contactoSeleccionado?.nombre || null,
        contacto_email_snapshot: contactoSeleccionado?.email || null,
        contacto_telefono_snapshot: contactoSeleccionado?.telefono || null,
        contacto_cargo_snapshot: contactoSeleccionado?.cargo || null,
        estado: form.estado,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        observaciones: form.observaciones.trim() || null,
        condiciones_comerciales: form.condiciones_comerciales.trim() || null,
        fecha_emision: form.fecha_emision,
        fecha_vencimiento: form.fecha_vencimiento || null,
        moneda: form.moneda.trim() || "CLP",
        porcentaje_iva: round2(porcentajeIva),
        descuento_global_tipo:
          normalizeDiscountType(form.descuento_global_tipo) ?? null,
        descuento_global_valor: round2(descuentoGlobalValor),
        empresa_nombre: form.empresa_nombre.trim() || null,
        empresa_logo_url: empresaLogoSnapshot || null,
        empresa_email: form.empresa_email.trim() || null,
        empresa_telefono: form.empresa_telefono.trim() || null,
        empresa_web: form.empresa_web.trim() || null,
        ejecutivo_user_id: user.id,
        ejecutivo_nombre: form.ejecutivo_nombre.trim() || null,
        ejecutivo_email: form.ejecutivo_email.trim() || user.email || null,
        ejecutivo_telefono: form.ejecutivo_telefono.trim() || null,
        updated_by: user.id,
        ...(form.estado === "aprobada"
          ? {
              numero_oc: aprobacionFinanciera.numero_oc.trim() || null,
              fecha_oc: aprobacionFinanciera.fecha_oc || null,
              aprobacion_sin_oc: aprobacionFinanciera.aprobacion_sin_oc,
              tipo_respaldo_aprobacion:
                aprobacionFinanciera.tipo_respaldo_aprobacion || null,
              referencia_aprobacion:
                aprobacionFinanciera.referencia_aprobacion.trim() || null,
              fecha_aceptacion: new Date().toISOString(),
            }
          : {}),
      };

      let savedId = cotizacionId || "";
      let softDeleteItemsAt: string | null = null;

      if (!isEdit) {
        const cotizacionResp = await fetch(`${baseUrl}/rest/v1/cotizaciones`, {
          method: "POST",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            ...cotizacionPayload,
            created_by: user.id,
            activo: true,
            deleted_at: null,
            deleted_by: null,
          }),
        });

        const cotizacionJson = await cotizacionResp.json();

        if (
          !cotizacionResp.ok ||
          !Array.isArray(cotizacionJson) ||
          !cotizacionJson[0]?.id
        ) {
          setError(
            cotizacionJson?.message ||
              cotizacionJson?.error_description ||
              cotizacionJson?.error ||
              "No se pudo crear la cotización."
          );
          setSaving(false);
          return;
        }

        savedId = cotizacionJson[0].id as string;
      } else {
        if (!cotizacionId) {
          setError("No se encontró el identificador de la cotización.");
          setSaving(false);
          return;
        }

        const cotizacionResp = await fetch(
          `${baseUrl}/rest/v1/cotizaciones?id=eq.${cotizacionId}&empresa_id=eq.${empresaId}`,
          {
            method: "PATCH",
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(cotizacionPayload),
          }
        );

        const cotizacionJson = await cotizacionResp.json();

        if (!cotizacionResp.ok) {
          setError(
            cotizacionJson?.message ||
              cotizacionJson?.error_description ||
              cotizacionJson?.error ||
              "No se pudo actualizar la cotización."
          );
          setSaving(false);
          return;
        }

        savedId = cotizacionId;

        softDeleteItemsAt = new Date().toISOString();

        const archiveItemsResp = await fetch(
          `${baseUrl}/rest/v1/cotizacion_items?cotizacion_id=eq.${cotizacionId}&activo=eq.true&deleted_at=is.null`,
          {
            method: "PATCH",
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              activo: false,
              deleted_at: softDeleteItemsAt,
              deleted_by: user.id,
              updated_by: user.id,
              updated_at: softDeleteItemsAt,
            }),
          }
        );

        if (!archiveItemsResp.ok) {
          const archiveJson = await archiveItemsResp.json().catch(() => null);
          setError(
            archiveJson?.message ||
              archiveJson?.error_description ||
              archiveJson?.error ||
              "No se pudieron archivar los ítems anteriores."
          );
          setSaving(false);
          return;
        }
      }

      const itemsPayload = validItems.map((item) => ({
        cotizacion_id: savedId,
        orden: item.orden,
        descripcion: item.descripcion,
        detalle: item.detalle,
        unidad: item.unidad,
        cantidad: round2(item.cantidad),
        precio_unitario: round2(item.precio_unitario),
        descuento_tipo: item.descuento_tipo,
        descuento_valor:
          item.descuento_tipo === "porcentaje"
            ? round2(Math.min(100, item.descuento_valor))
            : round2(item.descuento_valor),
        afecto_iva: item.afecto_iva,
        activo: true,
        created_by: user.id,
        updated_by: user.id,
        deleted_at: null,
        deleted_by: null,
      }));

      const itemsResp = await fetch(`${baseUrl}/rest/v1/cotizacion_items`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(itemsPayload),
      });

      const itemsJson = await itemsResp.json();

      if (!itemsResp.ok) {
        const rollbackAt = new Date().toISOString();

        if (!isEdit) {
          await fetch(`${baseUrl}/rest/v1/cotizaciones?id=eq.${savedId}`, {
            method: "PATCH",
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              activo: false,
              deleted_at: rollbackAt,
              deleted_by: user.id,
              updated_by: user.id,
              updated_at: rollbackAt,
            }),
          });
        } else if (cotizacionId && softDeleteItemsAt) {
          const encodedSoftDeleteItemsAt = encodeURIComponent(softDeleteItemsAt);

          await fetch(
            `${baseUrl}/rest/v1/cotizacion_items?cotizacion_id=eq.${cotizacionId}&deleted_at=eq.${encodedSoftDeleteItemsAt}&deleted_by=eq.${user.id}`,
            {
              method: "PATCH",
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                activo: true,
                deleted_at: null,
                deleted_by: null,
                updated_by: user.id,
                updated_at: rollbackAt,
              }),
            }
          );
        }

        setError(
          itemsJson?.message ||
            itemsJson?.error_description ||
            itemsJson?.error ||
            "No se pudieron guardar los ítems."
        );
        setSaving(false);
        return;
      }

      // Desde este punto la cotización y sus ítems son documentos reales. Las
      // operaciones secundarias no deben habilitar un segundo POST si fallan.
      if (origenOt) {
        persistedIdThisSubmit = savedId;
        setCotizacionPersistidaId(savedId);
      }

      if (origenOt) {
        const { error: relacionError } = await supabase
          .from("cotizacion_ot_relaciones")
          .insert({
            empresa_id: origenOt.empresa_id,
            cotizacion_id: savedId,
            ot_id: origenOt.id,
            tipo_relacion: tipoRelacionOrigenOt,
            monto_asociado: null,
            observacion: null,
            activo: true,
          });

        if (relacionError) {
          console.error("Error al relacionar la cotización creada con la OT:", relacionError);
          setFalloPosteriorPersistencia("relacion");
          setError("La cotización fue creada correctamente, pero no se pudo registrar la relación con la OT.");
          setSaving(false);
          return;
        }
      }

      if (
        form.estado === "aprobada" &&
        aprobacionFinanciera.generar_ingreso_financiero &&
        !ingresoGeneradoId
      ) {
        const { data: ingresoData, error: ingresoError } = await supabase.rpc(
          "generar_ingreso_financiero_cotizacion",
          {
            p_cotizacion_id: savedId,
            p_numero_oc: aprobacionFinanciera.numero_oc.trim() || null,
            p_fecha_oc: aprobacionFinanciera.fecha_oc || null,
            p_aprobacion_sin_oc: aprobacionFinanciera.aprobacion_sin_oc,
            p_tipo_respaldo_aprobacion:
              aprobacionFinanciera.tipo_respaldo_aprobacion || null,
            p_referencia_aprobacion:
              aprobacionFinanciera.referencia_aprobacion.trim() || null,
            p_factura_emitida: aprobacionFinanciera.factura_emitida,
            p_numero_factura: aprobacionFinanciera.factura_emitida
              ? aprobacionFinanciera.numero_factura.trim() || null
              : null,
            p_fecha_factura: aprobacionFinanciera.factura_emitida
              ? aprobacionFinanciera.fecha_factura || null
              : null,
          }
        );

        if (ingresoError) {
          if (origenOt) {
            setFalloPosteriorPersistencia("financiero");
            setError("La cotización fue guardada y vinculada correctamente con la OT, pero no se pudo generar el ingreso financiero.");
          } else {
            setError(
              ingresoError.message ||
                "La cotización fue guardada, pero no se pudo generar el ingreso financiero."
            );
          }
          setSaving(false);
          return;
        }

        const ingresoGenerado = (
          ingresoData as IngresoFinancieroCotizacionResult[] | null
        )?.[0];

        if (ingresoGenerado?.movimiento_id) {
          setIngresoGeneradoId(ingresoGenerado.movimiento_id);
        }
      }

      router.push(
        isEdit || origenOt ? `/cotizaciones/${savedId}` : "/cotizaciones"
      );
      router.refresh();
    } catch (err) {
      if (origenOt && persistedIdThisSubmit) {
        setCotizacionPersistidaId(persistedIdThisSubmit);
        setFalloPosteriorPersistencia("otro");
      }
      setError(
        origenOt && persistedIdThisSubmit
          ? "La cotización fue creada correctamente, pero falló una operación posterior."
          : err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al guardar."
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {origenOt ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Creando cotización desde OT {origenOt.folio || "sin folio"}
              </h2>
              <dl className="mt-3 space-y-1 text-sm text-slate-700">
                <div><dt className="inline font-medium">Título OT:</dt> <dd className="inline">{origenOt.titulo || "Sin título"}</dd></div>
                <div><dt className="inline font-medium">Cliente:</dt> <dd className="inline">{origenOt.cliente_nombre}</dd></div>
              </dl>
              <p className="mt-3 text-sm text-blue-800">
                La nueva cotización quedará vinculada automáticamente a esta OT.
              </p>
            </div>
            <Link href={`/ot/${origenOt.id}`} className="text-sm font-semibold text-blue-700 hover:underline">
              Ver OT
            </Link>
          </div>
          <label className="mt-4 block max-w-md text-sm font-medium text-slate-700">
            Motivo / tipo de relación
            <select
              value={tipoRelacionOrigenOt}
              onChange={(event) => setTipoRelacionOrigenOt(event.target.value as TipoRelacionOrigenOt)}
              disabled={Boolean(cotizacionPersistidaId)}
              className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="trabajo_adicional">Trabajo adicional</option>
              <option value="ampliacion_alcance">Ampliación de alcance</option>
              <option value="cotizacion_postservicio">Cotización postservicio</option>
              <option value="regularizacion">Regularización</option>
            </select>
          </label>
        </section>
      ) : null}
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm text-slate-500">Empresa activa</div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isEdit ? "Editar cotización" : "Nueva cotización"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            La empresa activa es{" "}
            <span className="font-medium text-slate-900">{empresaId}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Los cambios se guardarán sobre la cotización existente."
              : "El folio y el código se asignan automáticamente al guardar."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={backHref || "/cotizaciones"}
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Volver
          </Link>
          <button
            type="submit"
            disabled={saving || Boolean(origenOt && cotizacionPersistidaId)}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? isEdit
                ? "Guardando cambios..."
                : "Guardando..."
              : isEdit
              ? "Guardar cambios"
              : "Guardar cotización"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          {origenOt && cotizacionPersistidaId ? (
            <div className="mt-3">
              <Link href={`/cotizaciones/${cotizacionPersistidaId}`} className="font-semibold underline">
                Ver cotización creada
              </Link>
              {falloPosteriorPersistencia === "relacion" ? (
                <p className="mt-1">La relación secundaria requiere reparación.</p>
              ) : falloPosteriorPersistencia === "financiero" ? (
                <p className="mt-1">La relación con la OT quedó registrada correctamente. Abre la cotización para resolver el problema financiero.</p>
              ) : null}
              <p className="mt-1 font-medium">La cotización ya fue creada. No vuelvas a enviar este formulario.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Datos generales
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Cliente
                </label>
                <select
                  value={form.cliente_id}
                  disabled={Boolean(origenOt)}
                  onChange={(e) => {
                    updateFormField("cliente_id", e.target.value);
                    updateFormField("contacto_id", "");
                    setContactos([]);
                    setLoadingContactos(Boolean(e.target.value));
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">Sin cliente asociado</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.label}
                    </option>
                  ))}
                </select>
                {origenOt ? (
                  <p className="mt-2 text-xs text-slate-600">
                    El cliente está definido por la OT de origen y no puede cambiarse.
                  </p>
                ) : null}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Contacto destinatario
                  </label>
                  {form.cliente_id ? (
                    <Link
                      href={`/contactos?cliente_id=${encodeURIComponent(form.cliente_id)}`}
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      Administrar contactos
                    </Link>
                  ) : null}
                </div>
                <select
                  value={form.contacto_id}
                  onChange={(e) => updateFormField("contacto_id", e.target.value)}
                  disabled={!form.cliente_id || loadingContactos}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  <option value="">
                    {loadingContactos ? "Cargando contactos..." : "Sin contacto destinatario"}
                  </option>
                  {contactos.map((contacto) => (
                    <option key={contacto.id} value={contacto.id}>
                      {contacto.nombre}
                      {contacto.cargo ? ` — ${contacto.cargo}` : ""}
                      {contacto.recibe_cotizaciones ? " · Cotizaciones" : ""}
                      {contacto.es_principal ? " · Principal" : ""}
                    </option>
                  ))}
                </select>
                {form.cliente_id && !loadingContactos && contactos.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Este cliente aún no tiene contactos asociados para cotizaciones.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Estado
                </label>
                <select
                  value={form.estado}
                  onChange={(e) =>
                    updateFormField(
                      "estado",
                      e.target.value as CotizacionFormValues["estado"]
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="borrador">Borrador</option>
                  <option value="enviada">Enviada</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="rechazada">Rechazada</option>
                  <option value="vencida">Vencida</option>
                </select>
              </div>

              {mostrarAprobacionFinanciera ? (
                <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-900">
                        Aceptación comercial e ingreso financiero
                      </h3>
                      <p className="mt-1 text-xs text-emerald-800">
                        Este bloque solo aplica cuando la cotización queda aprobada.
                        Permite registrar la OC o el respaldo de aprobación y, si
                        corresponde, generar el ingreso financiero / cuenta por cobrar.
                      </p>
                    </div>
                    {ingresoGeneradoId ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        Ingreso generado
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                        Ingreso pendiente
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        N° OC
                      </label>
                      <input
                        value={aprobacionFinanciera.numero_oc}
                        onChange={(e) =>
                          updateAprobacionFinanciera("numero_oc", e.target.value)
                        }
                        disabled={Boolean(ingresoGeneradoId)}
                        placeholder="Ejemplo: 4800045627"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Fecha OC
                      </label>
                      <input
                        type="date"
                        value={aprobacionFinanciera.fecha_oc}
                        onChange={(e) =>
                          updateAprobacionFinanciera("fecha_oc", e.target.value)
                        }
                        disabled={Boolean(ingresoGeneradoId)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-white p-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={aprobacionFinanciera.aprobacion_sin_oc}
                          onChange={(e) =>
                            updateAprobacionFinanciera(
                              "aprobacion_sin_oc",
                              e.target.checked
                            )
                          }
                          disabled={Boolean(ingresoGeneradoId)}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium">Aprobada sin OC</span>
                          <span className="block text-xs text-slate-500">
                            Usar solo cuando el cliente acepta por correo, WhatsApp,
                            contrato u otro respaldo comercial.
                          </span>
                        </span>
                      </label>
                    </div>

                    {aprobacionFinanciera.aprobacion_sin_oc ? (
                      <>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Tipo de respaldo
                          </label>
                          <select
                            value={aprobacionFinanciera.tipo_respaldo_aprobacion}
                            onChange={(e) =>
                              updateAprobacionFinanciera(
                                "tipo_respaldo_aprobacion",
                                e.target.value as RespaldoAprobacionTipo
                              )
                            }
                            disabled={Boolean(ingresoGeneradoId)}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                          >
                            <option value="">Seleccionar respaldo</option>
                            <option value="correo">Correo</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="contrato">Contrato</option>
                            <option value="verbal">Verbal autorizada</option>
                            <option value="otro">Otro</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Referencia del respaldo
                          </label>
                          <input
                            value={aprobacionFinanciera.referencia_aprobacion}
                            onChange={(e) =>
                              updateAprobacionFinanciera(
                                "referencia_aprobacion",
                                e.target.value
                              )
                            }
                            disabled={Boolean(ingresoGeneradoId)}
                            placeholder="Ejemplo: correo del 02-07-2026"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                          />
                        </div>
                      </>
                    ) : null}

                    {puedeGenerarIngresoFinanciero ? (
                      <div className="md:col-span-2 space-y-3">
                        <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          <input
                            type="checkbox"
                            checked={
                              aprobacionFinanciera.generar_ingreso_financiero
                            }
                            onChange={(e) =>
                              updateAprobacionFinanciera(
                                "generar_ingreso_financiero",
                                e.target.checked
                              )
                            }
                            className="mt-1"
                          />
                          <span>
                            <span className="font-semibold">
                              Generar ingreso financiero al guardar
                            </span>
                            <span className="block text-xs">
                              Creará el movimiento de ingreso y la cuenta por cobrar.
                              No se ejecuta automáticamente si desmarcas esta opción.
                            </span>
                          </span>
                        </label>

                        {aprobacionFinanciera.generar_ingreso_financiero ? (
                          <>
                            <label className="flex items-start gap-2 rounded-xl border border-sky-200 bg-white p-3 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={aprobacionFinanciera.factura_emitida}
                                onChange={(e) =>
                                  updateAprobacionFinanciera(
                                    "factura_emitida",
                                    e.target.checked
                                  )
                                }
                                className="mt-1"
                              />
                              <span>
                                <span className="font-semibold">
                                  Factura ya emitida
                                </span>
                                <span className="block text-xs text-slate-500">
                                  Márcalo solo si la factura ya fue emitida. Tralixia
                                  registrará sus datos en el ingreso financiero, pero no
                                  emitirá la factura.
                                </span>
                              </span>
                            </label>

                            {aprobacionFinanciera.factura_emitida ? (
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-700">
                                    N° factura <span aria-hidden="true">*</span>
                                  </label>
                                  <input
                                    value={aprobacionFinanciera.numero_factura}
                                    onChange={(e) =>
                                      updateAprobacionFinanciera(
                                        "numero_factura",
                                        e.target.value
                                      )
                                    }
                                    required
                                    placeholder="Ejemplo: 12345"
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Fecha factura <span aria-hidden="true">*</span>
                                  </label>
                                  <input
                                    type="date"
                                    value={aprobacionFinanciera.fecha_factura}
                                    onChange={(e) =>
                                      updateAprobacionFinanciera(
                                        "fecha_factura",
                                        e.target.value
                                      )
                                    }
                                    required
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Título
                </label>
                <input
                  value={form.titulo}
                  onChange={(e) => updateFormField("titulo", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Descripción
                </label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) =>
                    updateFormField("descripcion", e.target.value)
                  }
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Fecha emisión
                </label>
                <input
                  type="date"
                  value={form.fecha_emision}
                  onChange={(e) =>
                    updateFormField("fecha_emision", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Fecha vencimiento
                </label>
                <input
                  type="date"
                  value={form.fecha_vencimiento}
                  onChange={(e) =>
                    updateFormField("fecha_vencimiento", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Moneda
                </label>
                <input
                  value={form.moneda}
                  onChange={(e) => updateFormField("moneda", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  % IVA
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.porcentaje_iva}
                  onChange={(e) =>
                    updateFormField(
                      "porcentaje_iva",
                      sanitizeDecimalInput(e.target.value)
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Observaciones
                </label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) =>
                    updateFormField("observaciones", e.target.value)
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Condiciones comerciales
                </label>
                <select
                  value={form.condiciones_comerciales}
                  onChange={(e) =>
                    updateFormField("condiciones_comerciales", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar condición</option>
                  <option value="Validez de la cotización: 15 días">
                    Validez de la cotización: 15 días
                  </option>
                  <option value="Validez de la cotización: 30 días">
                    Validez de la cotización: 30 días
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Ítems</h2>
              <button
                type="button"
                onClick={addItem}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Agregar ítem
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {items.map((item, index) => {
                const calc = calculateItem(item);

                return (
                  <div
                    key={item.uid}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Ítem {index + 1}
                      </h3>

                      <button
                        type="button"
                        onClick={() => removeItem(item.uid)}
                        disabled={items.length === 1}
                        className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="md:col-span-2 xl:col-span-4">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Descripción
                        </label>
                        <input
                          value={item.descripcion}
                          onChange={(e) =>
                            updateItem(item.uid, "descripcion", e.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="md:col-span-2 xl:col-span-4">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Detalle
                        </label>
                        <textarea
                          value={item.detalle}
                          onChange={(e) =>
                            updateItem(item.uid, "detalle", e.target.value)
                          }
                          rows={3}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Unidad
                        </label>
                        <input
                          value={item.unidad}
                          onChange={(e) =>
                            updateItem(item.uid, "unidad", e.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Cantidad
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.cantidad}
                          onChange={(e) =>
                            updateItem(
                              item.uid,
                              "cantidad",
                              sanitizeDecimalInput(e.target.value)
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Precio unitario
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.precio_unitario}
                          onChange={(e) =>
                            updateItem(
                              item.uid,
                              "precio_unitario",
                              sanitizeDecimalInput(e.target.value)
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Afecto IVA
                        </label>
                        <label className="flex h-[42px] items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={item.afecto_iva}
                            onChange={(e) =>
                              updateItem(item.uid, "afecto_iva", e.target.checked)
                            }
                          />
                          Sí
                        </label>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Tipo descuento
                        </label>
                        <select
                          value={item.descuento_tipo}
                          onChange={(e) =>
                            updateItem(
                              item.uid,
                              "descuento_tipo",
                              e.target.value as CotizacionFormItem["descuento_tipo"]
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="">Sin descuento</option>
                          <option value="porcentaje">Porcentaje</option>
                          <option value="monto">Monto</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Valor descuento
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.descuento_valor}
                          onChange={(e) =>
                            updateItem(
                              item.uid,
                              "descuento_valor",
                              sanitizeDecimalInput(e.target.value)
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-500">Bruto</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {formatCurrency(calc.bruto, form.moneda)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-500">Descuento</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {formatCurrency(calc.descuento, form.moneda)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-500">Subtotal</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {formatCurrency(calc.subtotal, form.moneda)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Datos empresa
            </h2>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nombre empresa
                </label>
                <input
                  value={form.empresa_nombre}
                  onChange={(e) =>
                    updateFormField("empresa_nombre", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Logo URL
                </label>
                <input
                  value={form.empresa_logo_url}
                  onChange={(e) =>
                    updateFormField(
                      "empresa_logo_url",
                      normalizeEmpresaLogoUrl(e.target.value)
                    )
                  }
                  placeholder={getDefaultEmpresaLogoUrl(form.empresa_nombre)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Ruta sugerida según empresa:{" "}
                  {getDefaultEmpresaLogoUrl(form.empresa_nombre)}
                </p>
              </div>

              {form.empresa_logo_url ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.empresa_logo_url}
                    alt="Logo empresa"
                    className="max-h-16 w-auto object-contain"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  value={form.empresa_email}
                  onChange={(e) =>
                    updateFormField("empresa_email", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Teléfono
                </label>
                <input
                  value={form.empresa_telefono}
                  onChange={(e) =>
                    updateFormField("empresa_telefono", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Página web
                </label>
                <input
                  value={form.empresa_web}
                  onChange={(e) => updateFormField("empresa_web", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Ejecutivo
            </h2>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nombre
                </label>
                <input
                  value={form.ejecutivo_nombre}
                  onChange={(e) =>
                    updateFormField("ejecutivo_nombre", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  value={form.ejecutivo_email}
                  onChange={(e) =>
                    updateFormField("ejecutivo_email", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Teléfono
                </label>
                <input
                  value={form.ejecutivo_telefono}
                  onChange={(e) =>
                    updateFormField("ejecutivo_telefono", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Descuento global
            </h2>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Tipo
                </label>
                <select
                  value={form.descuento_global_tipo}
                  onChange={(e) =>
                    updateFormField(
                      "descuento_global_tipo",
                      e.target.value as CotizacionFormValues["descuento_global_tipo"]
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Sin descuento</option>
                  <option value="porcentaje">Porcentaje</option>
                  <option value="monto">Monto</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Valor
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.descuento_global_valor}
                  onChange={(e) =>
                    updateFormField(
                      "descuento_global_valor",
                      sanitizeDecimalInput(e.target.value)
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Resumen</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Subtotal ítems afectos</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(summary.subtotalItemsNeto, form.moneda)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Subtotal ítems exentos</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(summary.subtotalItemsExento, form.moneda)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Descuento global neto</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(summary.descuentoGlobalNeto, form.moneda)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Descuento global exento</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(summary.descuentoGlobalExento, form.moneda)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Descuento global total</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(summary.descuentoGlobalTotal, form.moneda)}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-3" />

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Neto final</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(summary.subtotalNeto, form.moneda)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Exento final</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(summary.subtotalExento, form.moneda)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">IVA</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(summary.montoIva, form.moneda)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                <span className="text-sm font-semibold text-slate-900">
                  Total
                </span>
                <span className="text-lg font-semibold text-slate-900">
                  {formatCurrency(summary.total, form.moneda)}
                </span>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="submit"
                disabled={saving || Boolean(origenOt && cotizacionPersistidaId)}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? isEdit
                    ? "Guardando cambios..."
                    : "Guardando..."
                  : isEdit
                  ? "Guardar cambios"
                  : "Guardar cotización"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}
