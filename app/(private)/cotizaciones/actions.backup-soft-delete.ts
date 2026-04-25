"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateCotizacionActionState = {
  error: string | null;
};

type ItemPayloadInput = {
  descripcion?: unknown;
  detalle?: unknown;
  unidad?: unknown;
  cantidad?: unknown;
  precio_unitario?: unknown;
  descuento_tipo?: unknown;
  descuento_valor?: unknown;
  afecto_iva?: unknown;
};

function asString(value: unknown) {
  if (typeof value === "string") return value.trim();
  return "";
}

function asNullableString(value: unknown) {
  const parsed = asString(value);
  return parsed.length > 0 ? parsed : null;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clampNonNegative(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function normalizeDiscountType(value: unknown): "porcentaje" | "monto" | null {
  const parsed = asString(value);
  if (parsed === "porcentaje" || parsed === "monto") return parsed;
  return null;
}

function normalizeEstado(
  value: unknown
): "borrador" | "enviada" | "aprobada" | "rechazada" | "vencida" {
  const parsed = asString(value);
  if (
    parsed === "borrador" ||
    parsed === "enviada" ||
    parsed === "aprobada" ||
    parsed === "rechazada" ||
    parsed === "vencida"
  ) {
    return parsed;
  }
  return "borrador";
}

function normalizeItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): ItemPayloadInput => {
      if (item && typeof item === "object") {
        return item as ItemPayloadInput;
      }
      return {};
    })
    .map((item, index) => {
      const descripcion = asString(item.descripcion);
      const detalle = asNullableString(item.detalle);
      const unidad = asNullableString(item.unidad);
      const cantidad = clampNonNegative(asNumber(item.cantidad, 1));
      const precioUnitario = clampNonNegative(asNumber(item.precio_unitario, 0));
      const descuentoTipo = normalizeDiscountType(item.descuento_tipo);
      let descuentoValor = clampNonNegative(asNumber(item.descuento_valor, 0));

      if (descuentoTipo === "porcentaje") {
        descuentoValor = Math.min(descuentoValor, 100);
      }

      return {
        orden: index + 1,
        descripcion,
        detalle,
        unidad,
        cantidad: cantidad > 0 ? cantidad : 1,
        precio_unitario: precioUnitario,
        descuento_tipo: descuentoTipo,
        descuento_valor: descuentoValor,
        afecto_iva: Boolean(item.afecto_iva),
      };
    })
    .filter((item) => item.descripcion.length > 0);
}

export async function createCotizacionAction(
  _prevState: CreateCotizacionActionState,
  formData: FormData
): Promise<CreateCotizacionActionState> {
  const supabase = await createClient();

  const empresaActivaId = asNullableString(formData.get("empresa_id"));

  if (!empresaActivaId) {
    return { error: "No se encontró la empresa activa para guardar la cotización." };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "No se pudo validar la sesión del usuario actual." };
  }

  const titulo = asString(formData.get("titulo"));
  const descripcion = asNullableString(formData.get("descripcion"));
  const observaciones = asNullableString(formData.get("observaciones"));
  const condicionesComerciales = asNullableString(formData.get("condiciones_comerciales"));
  const estado = normalizeEstado(formData.get("estado"));
  const clienteId = asNullableString(formData.get("cliente_id"));
  const fechaEmision = asString(formData.get("fecha_emision"));
  const fechaVencimiento = asNullableString(formData.get("fecha_vencimiento"));
  const moneda = asString(formData.get("moneda")) || "CLP";
  const porcentajeIva = Math.min(100, clampNonNegative(asNumber(formData.get("porcentaje_iva"), 19)));

  const descuentoGlobalTipo = normalizeDiscountType(formData.get("descuento_global_tipo"));
  let descuentoGlobalValor = clampNonNegative(asNumber(formData.get("descuento_global_valor"), 0));

  if (descuentoGlobalTipo === "porcentaje") {
    descuentoGlobalValor = Math.min(descuentoGlobalValor, 100);
  }

  const empresaNombre = asNullableString(formData.get("empresa_nombre"));
  const empresaLogoUrl = asNullableString(formData.get("empresa_logo_url"));
  const empresaEmail = asNullableString(formData.get("empresa_email"));
  const empresaTelefono = asNullableString(formData.get("empresa_telefono"));
  const empresaWeb = asNullableString(formData.get("empresa_web"));

  const ejecutivoNombre = asNullableString(formData.get("ejecutivo_nombre"));
  const ejecutivoEmail = asNullableString(formData.get("ejecutivo_email")) ?? user.email ?? null;
  const ejecutivoTelefono = asNullableString(formData.get("ejecutivo_telefono"));

  if (!titulo) {
    return { error: "Debes ingresar un título para la cotización." };
  }

  if (!fechaEmision) {
    return { error: "Debes ingresar la fecha de emisión." };
  }

  const itemsJson = asString(formData.get("items_json"));

  let parsedItems: unknown = [];
  try {
    parsedItems = itemsJson ? JSON.parse(itemsJson) : [];
  } catch {
    return { error: "No se pudieron procesar los ítems de la cotización." };
  }

  const items = normalizeItems(parsedItems);

  if (items.length === 0) {
    return { error: "Debes agregar al menos un ítem con descripción." };
  }

  const { data: cotizacion, error: cotizacionError } = await supabase
    .from("cotizaciones")
    .insert({
      empresa_id: empresaActivaId,
      cliente_id: clienteId,
      estado,
      titulo,
      descripcion,
      observaciones,
      condiciones_comerciales: condicionesComerciales,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      moneda,
      porcentaje_iva: round2(porcentajeIva),
      descuento_global_tipo: descuentoGlobalTipo,
      descuento_global_valor: round2(descuentoGlobalValor),
      empresa_nombre: empresaNombre,
      empresa_logo_url: empresaLogoUrl,
      empresa_email: empresaEmail,
      empresa_telefono: empresaTelefono,
      empresa_web: empresaWeb,
      ejecutivo_user_id: user.id,
      ejecutivo_nombre: ejecutivoNombre,
      ejecutivo_email: ejecutivoEmail,
      ejecutivo_telefono: ejecutivoTelefono,
    })
    .select("id, folio, codigo")
    .single();

  if (cotizacionError || !cotizacion) {
    return {
      error: cotizacionError?.message ?? "No se pudo crear la cotización.",
    };
  }

  const itemsInsert = items.map((item) => ({
    cotizacion_id: cotizacion.id,
    orden: item.orden,
    descripcion: item.descripcion,
    detalle: item.detalle,
    unidad: item.unidad,
    cantidad: round2(item.cantidad),
    precio_unitario: round2(item.precio_unitario),
    descuento_tipo: item.descuento_tipo,
    descuento_valor: round2(item.descuento_valor),
    afecto_iva: item.afecto_iva,
  }));

  const { error: itemsError } = await supabase.from("cotizacion_items").insert(itemsInsert);

  if (itemsError) {
    await supabase.from("cotizaciones").delete().eq("id", cotizacion.id);
    return {
      error: itemsError.message ?? "No se pudieron guardar los ítems de la cotización.",
    };
  }

  revalidatePath("/cotizaciones");
  revalidatePath("/cotizaciones/nueva");

  redirect("/cotizaciones");
}