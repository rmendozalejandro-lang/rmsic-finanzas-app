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
  ejecutivo_nombre: string | null;
  ejecutivo_email: string | null;
  ejecutivo_telefono: string | null;
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
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

function getEmpresaWeb(cotizacion: Cotizacion | null, empresaActivaNombre: string) {
  const web = cotizacion?.empresa_web?.trim();
  if (web) return web;

  const source = `${cotizacion?.empresa_nombre || ""} ${empresaActivaNombre || ""}`.toLowerCase();

  if (source.includes("rm servicios") || source.includes("rmsic")) {
    return "www.rmsic.cl";
  }

  return "";
}

export default function CotizacionImprimirPage() {
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
            : "Ocurrió un error cargando la vista de impresión."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDetalle();
  }, [empresaActivaId, cotizacionId]);

  const empresaWeb = useMemo(() => {
    return getEmpresaWeb(cotizacion, empresaActivaNombre);
  }, [cotizacion, empresaActivaNombre]);

  if (!empresaActivaId && !loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h1 className="text-xl font-semibold text-slate-900">Vista de impresión</h1>
          <p className="mt-2 text-sm text-slate-700">
            No se encontró una empresa activa en el navegador.
          </p>
          <div className="mt-4">
            <Link
              href="/cotizaciones"
              className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando vista de impresión...
        </div>
      </div>
    );
  }

  if (error || !cotizacion) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h1 className="text-xl font-semibold text-slate-900">Vista de impresión</h1>
          <p className="mt-2 text-sm text-rose-700">
            {error || "No se encontró la cotización."}
          </p>
          <div className="mt-4">
            <Link
              href="/cotizaciones"
              className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          .print-hidden {
            display: none !important;
          }

          body {
            background: white !important;
          }

          .print-shell {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            max-width: 100% !important;
          }

          .print-page {
            padding: 0 !important;
          }

          @page {
            size: A4;
            margin: 16mm 14mm 16mm 14mm;
          }
        }
      `}</style>

      <div className="bg-slate-100 print-page">
        <div className="mx-auto max-w-5xl p-6 print-shell">
          <div className="print-hidden mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Vista de impresión / PDF
              </h1>
              <p className="text-sm text-slate-500">
                Usa el botón imprimir y luego “Guardar como PDF”.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/cotizaciones/${cotizacion.id}`}
                className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Volver
              </Link>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Imprimir / Guardar PDF
              </button>
            </div>
          </div>

          <article className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
            <header className="border-b border-slate-200 pb-8">
              <div className="flex flex-col items-center text-center">
                {cotizacion.empresa_logo_url ? (
                  <div className="mb-5">
                    <img
                      src={cotizacion.empresa_logo_url}
                      alt="Logo empresa"
                      className="max-h-20 w-auto object-contain"
                    />
                  </div>
                ) : null}

                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {cotizacion.empresa_nombre || empresaActivaNombre || "Empresa"}
                </h1>

                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  {cotizacion.ejecutivo_nombre ? (
                    <p>
                      Ejecutivo:{" "}
                      <span className="font-medium text-slate-800">
                        {cotizacion.ejecutivo_nombre}
                      </span>
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                    {cotizacion.ejecutivo_email ? <span>{cotizacion.ejecutivo_email}</span> : null}
                    {cotizacion.empresa_telefono ? <span>{cotizacion.empresa_telefono}</span> : null}
                    {empresaWeb ? <span>{empresaWeb}</span> : null}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Documento
                  </h2>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">COTIZACIÓN</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Propuesta comercial y técnica de acuerdo con lo solicitado.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Folio</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {cotizacion.folio ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Código</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {cotizacion.codigo || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Fecha emisión</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatDate(cotizacion.fecha_emision)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Fecha vencimiento</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatDate(cotizacion.fecha_vencimiento)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <section className="mt-8">
              <div className="rounded-2xl border border-slate-200 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Cliente
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-slate-500">Nombre / Razón social</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {getClienteDisplayName(cliente)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">RUT</p>
                    <p className="mt-1 font-medium text-slate-900">{cliente?.rut || "-"}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">Correo</p>
                    <p className="mt-1 text-slate-800">
                      {cliente?.email || cliente?.correo || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">Teléfono</p>
                    <p className="mt-1 text-slate-800">
                      {cliente?.telefono || cliente?.celular || "-"}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-sm text-slate-500">Dirección</p>
                    <p className="mt-1 text-slate-800">{cliente?.direccion || "-"}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Presentación
              </h3>

              <p className="mt-4 leading-7 text-slate-700">
                Según lo solicitado, se presenta la siguiente cotización correspondiente a los
                trabajos, servicios y/o suministros indicados a continuación, de acuerdo con el
                siguiente detalle.
              </p>

              {cotizacion.descripcion ? (
                <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
                  {cotizacion.descripcion}
                </p>
              ) : null}
            </section>

            <section className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Desarrollo de la cotización
              </h3>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Ítem</th>
                      <th className="px-4 py-3 text-left font-semibold">Descripción</th>
                      <th className="px-4 py-3 text-center font-semibold">Unidad</th>
                      <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                      <th className="px-4 py-3 text-right font-semibold">P. Unitario</th>
                      <th className="px-4 py-3 text-right font-semibold">Descuento</th>
                      <th className="px-4 py-3 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="px-4 py-4 text-slate-700">{item.orden ?? "-"}</td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900">{item.descripcion}</div>
                          {item.detalle ? (
                            <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-500">
                              {item.detalle}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-center text-slate-700">
                          {item.unidad || "-"}
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
                            : "-"}
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-slate-900">
                          {formatCurrency(item.subtotal, cotizacion.moneda ?? "CLP")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Observaciones
                  </h3>
                  <div className="mt-4 min-h-[110px] rounded-2xl border border-slate-200 p-5">
                    <p className="whitespace-pre-wrap leading-7 text-slate-700">
                      {cotizacion.observaciones || "-"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Condiciones comerciales
                  </h3>
                  <div className="mt-4 min-h-[110px] rounded-2xl border border-slate-200 p-5">
                    <p className="whitespace-pre-wrap leading-7 text-slate-700">
                      {cotizacion.condiciones_comerciales || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Resumen económico
                </h3>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Subtotal afecto</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(cotizacion.subtotal_items_neto, cotizacion.moneda ?? "CLP")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Subtotal exento</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(
                          cotizacion.subtotal_items_exento,
                          cotizacion.moneda ?? "CLP"
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Descuento global</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(
                          cotizacion.descuento_global_total,
                          cotizacion.moneda ?? "CLP"
                        )}
                      </span>
                    </div>

                    <div className="border-t border-slate-200 pt-3" />

                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Neto</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(cotizacion.subtotal_neto, cotizacion.moneda ?? "CLP")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Exento</span>
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

                    <div className="mt-4 rounded-2xl bg-white px-4 py-4">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-slate-900">TOTAL</span>
                        <span className="text-xl font-bold text-slate-900">
                          {formatCurrency(cotizacion.total, cotizacion.moneda ?? "CLP")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <footer className="mt-12 border-t border-slate-200 pt-8">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-900">
                  {cotizacion.ejecutivo_nombre || "-"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {cotizacion.empresa_nombre || empresaActivaNombre || "Empresa"}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  {cotizacion.ejecutivo_email ? <span>{cotizacion.ejecutivo_email}</span> : null}
                  {cotizacion.ejecutivo_telefono ? <span>{cotizacion.ejecutivo_telefono}</span> : null}
                </div>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}