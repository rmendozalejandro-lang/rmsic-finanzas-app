"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const STORAGE_ID_KEY = "empresa_activa_id";
const STORAGE_NAME_KEY = "empresa_activa_nombre";

type EstadoCotizacion =
  | "borrador"
  | "enviada"
  | "aprobada"
  | "rechazada"
  | "vencida";

type Cotizacion = {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  folio: number | null;
  codigo: string | null;
  estado: EstadoCotizacion;
  titulo: string;
  descripcion: string | null;
  observaciones: string | null;
  condiciones_comerciales: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  moneda: string | null;
  porcentaje_iva: number | null;
  descuento_global_tipo: "porcentaje" | "monto" | null;
  descuento_global_valor: number | null;
  subtotal_items_neto: number | null;
  subtotal_items_exento: number | null;
  descuento_global_neto: number | null;
  descuento_global_exento: number | null;
  descuento_global_total: number | null;
  subtotal_neto: number | null;
  subtotal_exento: number | null;
  monto_iva: number | null;
  total: number | null;
  empresa_nombre: string | null;
  empresa_logo_url: string | null;
  empresa_email: string | null;
  empresa_telefono: string | null;
  empresa_web: string | null;
  ejecutivo_user_id: string | null;
  ejecutivo_nombre: string | null;
  ejecutivo_email: string | null;
  ejecutivo_telefono: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CotizacionItem = {
  id: string;
  cotizacion_id: string;
  orden: number | null;
  descripcion: string;
  detalle: string | null;
  unidad: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  descuento_tipo: "porcentaje" | "monto" | null;
  descuento_valor: number | null;
  afecto_iva: boolean;
  bruto?: number | null;
  subtotal: number | null;
};

type Cliente = {
  id: string;
  nombre?: string | null;
  razon_social?: string | null;
  nombre_fantasia?: string | null;
  empresa?: string | null;
  cliente?: string | null;
  rut?: string | null;
  email?: string | null;
  correo?: string | null;
  telefono?: string | null;
  celular?: string | null;
  direccion?: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: number | string | null | undefined, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: currency || "CLP",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 3,
  }).format(toNumber(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getEstadoStyles(estado: EstadoCotizacion) {
  switch (estado) {
    case "borrador":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "enviada":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "aprobada":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "rechazada":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "vencida":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getClienteDisplayName(cliente: Cliente | null) {
  if (!cliente) return "Sin cliente";

  return (
    cliente.razon_social ||
    cliente.nombre ||
    cliente.nombre_fantasia ||
    cliente.empresa ||
    cliente.cliente ||
    cliente.rut ||
    "Sin cliente"
  );
}

export default function CotizacionDetallePage() {
  const params = useParams<{ id: string }>();
  const cotizacionId = String(params?.id || "");

  const [empresaActivaId, setEmpresaActivaId] = useState("");
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState("");

  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [items, setItems] = useState<CotizacionItem[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncEmpresaActiva = () => {
      const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || "";
      const empresaNombre = window.localStorage.getItem(STORAGE_NAME_KEY) || "";

      setEmpresaActivaId(empresaId);
      setEmpresaActivaNombre(empresaNombre);
    };

    syncEmpresaActiva();
    window.addEventListener("empresa-activa-cambiada", syncEmpresaActiva);

    return () => {
      window.removeEventListener("empresa-activa-cambiada", syncEmpresaActiva);
    };
  }, []);

  useEffect(() => {
    const fetchDetalle = async () => {
      if (!empresaActivaId || !cotizacionId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        const session = data.session;

        if (sessionError || !session) {
          setError("No se pudo recuperar la sesión activa del navegador.");
          setLoading(false);
          return;
        }

        const accessToken = session.access_token;
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

        if (!apiKey || !baseUrl) {
          setError("Faltan variables públicas de Supabase.");
          setLoading(false);
          return;
        }

        const cotizacionResp = await fetch(
          `${baseUrl}/rest/v1/cotizaciones?id=eq.${cotizacionId}&empresa_id=eq.${empresaActivaId}&select=*`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const cotizacionJson = await cotizacionResp.json();

        if (!cotizacionResp.ok) {
          setError(
            cotizacionJson?.message ||
              cotizacionJson?.error_description ||
              cotizacionJson?.error ||
              "No se pudo cargar la cotización."
          );
          setLoading(false);
          return;
        }

        const cotizacionData = Array.isArray(cotizacionJson) ? cotizacionJson[0] : null;

        if (!cotizacionData) {
          setError("No se encontró la cotización solicitada.");
          setLoading(false);
          return;
        }

        const itemsResp = await fetch(
          `${baseUrl}/rest/v1/cotizacion_items?cotizacion_id=eq.${cotizacionId}&select=*&order=orden.asc`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const itemsJson = await itemsResp.json();

        if (!itemsResp.ok) {
          setError(
            itemsJson?.message ||
              itemsJson?.error_description ||
              itemsJson?.error ||
              "No se pudieron cargar los ítems."
          );
          setLoading(false);
          return;
        }

        let clienteData: Cliente | null = null;

        if (cotizacionData.cliente_id) {
          const clienteResp = await fetch(
            `${baseUrl}/rest/v1/clientes?id=eq.${cotizacionData.cliente_id}&empresa_id=eq.${empresaActivaId}&select=*`,
            {
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          const clienteJson = await clienteResp.json();

          if (clienteResp.ok && Array.isArray(clienteJson) && clienteJson[0]) {
            clienteData = clienteJson[0] as Cliente;
          }
        }

        setCotizacion(cotizacionData as Cotizacion);
        setItems((itemsJson ?? []) as CotizacionItem[]);
        setCliente(clienteData);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Ocurrió un error cargando el detalle."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDetalle();
  }, [empresaActivaId, cotizacionId]);

  const totalItems = useMemo(() => items.length, [items]);

  if (!empresaActivaId && !loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h1 className="text-xl font-semibold text-slate-900">Detalle cotización</h1>
          <p className="mt-2 text-sm text-slate-700">
            No se encontró una empresa activa en el navegador.
          </p>
          <div className="mt-4">
            <Link
              href="/cotizaciones"
              className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Volver a cotizaciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando detalle de cotización...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h1 className="text-xl font-semibold text-slate-900">Detalle cotización</h1>
          <p className="mt-2 text-sm text-rose-700">{error}</p>

          <div className="mt-4">
            <Link
              href="/cotizaciones"
              className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Volver a cotizaciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!cotizacion) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h1 className="text-xl font-semibold text-slate-900">Detalle cotización</h1>
          <p className="mt-2 text-sm text-slate-700">
            No se encontró información para esta cotización.
          </p>

          <div className="mt-4">
            <Link
              href="/cotizaciones"
              className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Volver a cotizaciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Cotización</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {cotizacion.codigo || `Folio ${cotizacion.folio ?? "—"}`}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Empresa activa:{" "}
            <span className="font-medium text-slate-900">
              {empresaActivaNombre || empresaActivaId}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${getEstadoStyles(
              cotizacion.estado
            )}`}
          >
            {cotizacion.estado}
          </span>

          <Link
            href="/cotizaciones"
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Volver
          </Link>

          <Link
            href={`/cotizaciones/${cotizacion.id}/editar`}
            className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Editar
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Folio</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {cotizacion.folio ?? "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Fecha emisión</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatDate(cotizacion.fecha_emision)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Fecha vencimiento</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatDate(cotizacion.fecha_vencimiento)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Items</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {totalItems}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatCurrency(cotizacion.total, cotizacion.moneda ?? "CLP")}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Datos generales</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="text-sm text-slate-500">Título</p>
                <p className="mt-1 text-base font-medium text-slate-900">
                  {cotizacion.titulo || "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Código</p>
                <p className="mt-1 font-medium text-slate-900">
                  {cotizacion.codigo || "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Moneda</p>
                <p className="mt-1 font-medium text-slate-900">
                  {cotizacion.moneda || "CLP"}
                </p>
              </div>

              
              <div>
                <p className="text-sm text-slate-500">Cliente</p>
                <p className="mt-1 font-medium text-slate-900">
                  {getClienteDisplayName(cliente)}
                </p>
              </div>

              <div className="md:col-span-2">
                <p className="text-sm text-slate-500">Descripción</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">
                  {cotizacion.descripcion || "—"}
                </p>
              </div>

              <div className="md:col-span-2">
                <p className="text-sm text-slate-500">Observaciones</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">
                  {cotizacion.observaciones || "—"}
                </p>
              </div>

              <div className="md:col-span-2">
                <p className="text-sm text-slate-500">Condiciones comerciales</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">
                  {cotizacion.condiciones_comerciales || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Ítems cotizados</h2>
              <span className="text-sm text-slate-500">{totalItems} ítem(s)</span>
            </div>

            {items.length === 0 ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Esta cotización no tiene ítems registrados.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Descripción</th>
                      <th className="px-4 py-3 font-medium">Unidad</th>
                      <th className="px-4 py-3 font-medium text-right">Cantidad</th>
                      <th className="px-4 py-3 font-medium text-right">P. Unitario</th>
                      <th className="px-4 py-3 font-medium text-right">Descuento</th>
                      <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="px-4 py-4 text-slate-700">
                          {item.orden ?? "—"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900">
                            {item.descripcion}
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-xs text-slate-500">
                            {item.detalle || "Sin detalle"}
                          </div>
                          <div className="mt-2">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                item.afecto_iva
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700"
                              }`}
                            >
                              {item.afecto_iva ? "Afecto IVA" : "Exento"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {item.unidad || "—"}
                        </td>
                        <td className="px-4 py-4 text-right text-slate-700">
                          {formatNumber(item.cantidad)}
                        </td>
                        <td className="px-4 py-4 text-right text-slate-700">
                          {formatCurrency(item.precio_unitario, cotizacion.moneda ?? "CLP")}
                        </td>
                        <td className="px-4 py-4 text-right text-slate-700">
                          {item.descuento_tipo
                            ? item.descuento_tipo === "porcentaje"
                              ? `${toNumber(item.descuento_valor)}%`
                              : formatCurrency(item.descuento_valor, cotizacion.moneda ?? "CLP")
                            : "—"}
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-slate-900">
                          {formatCurrency(item.subtotal, cotizacion.moneda ?? "CLP")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Empresa</h2>

            <div className="mt-4 space-y-3">
              {cotizacion.empresa_logo_url ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cotizacion.empresa_logo_url}
                    alt="Logo empresa"
                    className="max-h-16 w-auto object-contain"
                  />
                </div>
              ) : null}

              <div>
                <p className="text-sm text-slate-500">Nombre</p>
                <p className="mt-1 font-medium text-slate-900">
                  {cotizacion.empresa_nombre || "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="mt-1 text-slate-800">
                  {cotizacion.empresa_email || "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Teléfono</p>
                <p className="mt-1 text-slate-800">
                  {cotizacion.empresa_telefono || "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Página web</p>
                <p className="mt-1 text-slate-800">
                  {cotizacion.empresa_web || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Ejecutivo</h2>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm text-slate-500">Nombre</p>
                <p className="mt-1 font-medium text-slate-900">
                  {cotizacion.ejecutivo_nombre || "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="mt-1 text-slate-800">
                  {cotizacion.ejecutivo_email || "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Teléfono</p>
                <p className="mt-1 text-slate-800">
                  {cotizacion.ejecutivo_telefono || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Cliente</h2>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm text-slate-500">Nombre</p>
                <p className="mt-1 font-medium text-slate-900">
                  {getClienteDisplayName(cliente)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="mt-1 text-slate-800">
                  {cliente?.email || cliente?.correo || "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Teléfono</p>
                <p className="mt-1 text-slate-800">
                  {cliente?.telefono || cliente?.celular || "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Dirección</p>
                <p className="mt-1 text-slate-800">
                  {cliente?.direccion || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Resumen económico</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Subtotal ítems afectos</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(cotizacion.subtotal_items_neto, cotizacion.moneda ?? "CLP")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Subtotal ítems exentos</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(cotizacion.subtotal_items_exento, cotizacion.moneda ?? "CLP")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Descuento global neto</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(cotizacion.descuento_global_neto, cotizacion.moneda ?? "CLP")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Descuento global exento</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(cotizacion.descuento_global_exento, cotizacion.moneda ?? "CLP")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Descuento global total</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(cotizacion.descuento_global_total, cotizacion.moneda ?? "CLP")}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-3" />

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Neto final</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(cotizacion.subtotal_neto, cotizacion.moneda ?? "CLP")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Exento final</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(cotizacion.subtotal_exento, cotizacion.moneda ?? "CLP")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">IVA</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(cotizacion.monto_iva, cotizacion.moneda ?? "CLP")}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                <span className="text-sm font-semibold text-slate-900">Total</span>
                <span className="text-lg font-semibold text-slate-900">
                  {formatCurrency(cotizacion.total, cotizacion.moneda ?? "CLP")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}