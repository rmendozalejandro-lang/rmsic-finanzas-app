"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ClienteOption = {
  id: string;
  label: string;
};

export type CotizacionFormValues = {
  cliente_id: string;
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

type Props = {
  empresaId: string;
  clientes: ClienteOption[];
  initialValues: CotizacionFormValues;
  initialItems?: CotizacionFormItem[];
  mode?: "create" | "edit";
  cotizacionId?: string;
  backHref?: string;
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

export default function CotizacionForm({
  empresaId,
  clientes,
  initialValues,
  initialItems,
  mode = "create",
  cotizacionId,
  backHref,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CotizacionFormValues>(initialValues);
  const [items, setItems] = useState<CotizacionFormItem[]>(
    initialItems && initialItems.length > 0 ? initialItems : [createEmptyItem()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function updateFormField<K extends keyof CotizacionFormValues>(
    key: K,
    value: CotizacionFormValues[K]
  ) {
    setForm((prev) => ({
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
    setError(null);
    setSaving(true);

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

      const validItems = items
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

      const cotizacionPayload = {
        empresa_id: empresaId,
        cliente_id: form.cliente_id || null,
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
        empresa_logo_url: form.empresa_logo_url.trim() || null,
        empresa_email: form.empresa_email.trim() || null,
        empresa_telefono: form.empresa_telefono.trim() || null,
        empresa_web: form.empresa_web.trim() || null,
        ejecutivo_user_id: user.id,
        ejecutivo_nombre: form.ejecutivo_nombre.trim() || null,
        ejecutivo_email: form.ejecutivo_email.trim() || user.email || null,
        ejecutivo_telefono: form.ejecutivo_telefono.trim() || null,
        updated_by: user.id,
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
          `${baseUrl}/rest/v1/cotizacion_items?cotizacion_id=eq.${cotizacionId}&activo=is.true`,
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

      router.push(isEdit ? `/cotizaciones/${savedId}` : "/cotizaciones");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al guardar."
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            disabled={saving}
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
                  onChange={(e) => updateFormField("cliente_id", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Sin cliente asociado</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.label}
                    </option>
                  ))}
                </select>
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
                    updateFormField("empresa_logo_url", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
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
                disabled={saving}
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