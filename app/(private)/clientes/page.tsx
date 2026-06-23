"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import StatusBadge from "../../../components/StatusBadge";

type CondicionPago =
  | "contado"
  | "7_dias"
  | "15_dias"
  | "30_dias"
  | "45_dias"
  | "60_dias"
  | "personalizado";

type EstadoComercial = "prospecto" | "cliente_activo" | "inactivo";

type Cliente = {
  id: string;
  empresa_id: string;
  nombre: string;
  rut: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  condicion_pago: CondicionPago | null;
  dias_credito: number | null;
  estado_comercial: EstadoComercial | null;
  activo: boolean;
  deleted_at?: string | null;
  created_at: string;
};

const STORAGE_KEY = "empresa_activa_id";

const condicionesPago = [
  { value: "contado", label: "Contado", dias: 0 },
  { value: "7_dias", label: "7 días", dias: 7 },
  { value: "15_dias", label: "15 días", dias: 15 },
  { value: "30_dias", label: "30 días", dias: 30 },
  { value: "45_dias", label: "45 días", dias: 45 },
  { value: "60_dias", label: "60 días", dias: 60 },
  { value: "personalizado", label: "Personalizado", dias: 0 },
] as const;

const estadosComerciales = [
  { value: "prospecto", label: "Prospecto" },
  { value: "cliente_activo", label: "Cliente activo" },
  { value: "inactivo", label: "Inactivo" },
] as const;

function getDiasPorCondicion(
  condicion: string,
  diasCredito: string | number | null | undefined,
) {
  if (condicion === "personalizado") {
    const dias = Number(diasCredito ?? 0);
    return Number.isFinite(dias) && dias >= 0 ? Math.trunc(dias) : 0;
  }

  return condicionesPago.find((item) => item.value === condicion)?.dias ?? 0;
}

function getCondicionLabel(
  condicion: string | null | undefined,
  diasCredito: number | null | undefined,
) {
  const value = condicion || "contado";
  const option = condicionesPago.find((item) => item.value === value);

  if (value === "personalizado") {
    return `Personalizado (${diasCredito ?? 0} días)`;
  }

  return option?.label ?? "Contado";
}

function getEstadoComercialLabel(estado: string | null | undefined) {
  return (
    estadosComerciales.find((item) => item.value === estado)?.label ??
    "Cliente activo"
  );
}

function getEstadoComercialBadgeClass(estado: string | null | undefined) {
  if (estado === "prospecto") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (estado === "inactivo") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default function ClientesPage() {
  const router = useRouter();

  const [empresaActivaId, setEmpresaActivaId] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
  const [deleteMotivo, setDeleteMotivo] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    rut: "",
    contacto: "",
    email: "",
    telefono: "",
    direccion: "",
    condicion_pago: "contado",
    dias_credito: "0",
    estado_comercial: "cliente_activo",
    activo: "true",
  });

  useEffect(() => {
    const syncEmpresaActiva = () => {
      const empresaId = window.localStorage.getItem(STORAGE_KEY) || "";
      setEmpresaActivaId(empresaId);
    };

    syncEmpresaActiva();
    window.addEventListener("empresa-activa-cambiada", syncEmpresaActiva);

    return () => {
      window.removeEventListener("empresa-activa-cambiada", syncEmpresaActiva);
    };
  }, []);

  const resetForm = () => {
    setForm({
      nombre: "",
      rut: "",
      contacto: "",
      email: "",
      telefono: "",
      direccion: "",
      condicion_pago: "contado",
      dias_credito: "0",
      estado_comercial: "cliente_activo",
      activo: "true",
    });
    setEditingId(null);
  };

  const fetchClientes = async () => {
    if (!empresaActivaId) return;

    try {
      setLoading(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const accessToken = sessionData.session.access_token;
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const headers = {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
      };

      const rolResp = await fetch(
        `${baseUrl}/rest/v1/usuario_empresas?usuario_id=eq.${sessionData.session.user.id}&empresa_id=eq.${empresaActivaId}&activo=eq.true&select=rol&limit=1`,
        { headers },
      );
      const rolJson = await rolResp.json().catch(() => []);
      setIsAdmin(
        rolResp.ok &&
          Array.isArray(rolJson) &&
          rolJson.some((item) => item.rol === "admin"),
      );

      const resp = await fetch(
        `${baseUrl}/rest/v1/clientes?empresa_id=eq.${empresaActivaId}&deleted_at=is.null&select=*&order=nombre.asc`,
        { headers },
      );

      const json = await resp.json();

      if (!resp.ok) {
        setError(`No se pudieron cargar los clientes. ${JSON.stringify(json)}`);
        return;
      }

      setClientes(json ?? []);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error desconocido");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, [router, empresaActivaId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;

    if (name === "condicion_pago") {
      setForm((prev) => ({
        ...prev,
        condicion_pago: value,
        dias_credito: String(getDiasPorCondicion(value, prev.dias_credito)),
      }));
      return;
    }

    if (name === "dias_credito") {
      const dias = Math.max(0, Math.trunc(Number(value || 0)));
      setForm((prev) => ({
        ...prev,
        dias_credito: Number.isFinite(dias) ? String(dias) : "0",
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const startEdit = (cliente: Cliente) => {
    const condicion = cliente.condicion_pago || "contado";
    const dias = getDiasPorCondicion(condicion, cliente.dias_credito ?? 0);

    setEditingId(cliente.id);
    setError("");
    setSuccess("");
    setForm({
      nombre: cliente.nombre ?? "",
      rut: cliente.rut ?? "",
      contacto: cliente.contacto ?? "",
      email: cliente.email ?? "",
      telefono: cliente.telefono ?? "",
      direccion: cliente.direccion ?? "",
      condicion_pago: condicion,
      dias_credito: String(dias),
      estado_comercial: cliente.estado_comercial || "cliente_activo",
      activo: cliente.activo ? "true" : "false",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!empresaActivaId) {
      setError("Debes seleccionar una empresa activa.");
      return;
    }

    if (!form.nombre.trim()) {
      setError("Debes ingresar el nombre del cliente.");
      return;
    }

    try {
      setSaving(true);

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const accessToken = sessionData.session.access_token;
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const diasCredito = getDiasPorCondicion(
        form.condicion_pago,
        form.dias_credito,
      );

      const payload = {
        empresa_id: empresaActivaId,
        nombre: form.nombre.trim(),
        rut: form.rut.trim() || null,
        contacto: form.contacto.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        condicion_pago: form.condicion_pago,
        dias_credito: diasCredito,
        estado_comercial: form.estado_comercial,
        activo: form.activo === "true",
      };

      const url = editingId
        ? `${baseUrl}/rest/v1/clientes?id=eq.${editingId}`
        : `${baseUrl}/rest/v1/clientes`;

      const method = editingId ? "PATCH" : "POST";

      const resp = await fetch(url, {
        method,
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });

      const json = await resp.json().catch(() => null);

      if (!resp.ok) {
        console.error(json);
        setError(
          editingId
            ? "No se pudo actualizar el cliente."
            : "No se pudo guardar el cliente.",
        );
        return;
      }

      setSuccess(
        editingId
          ? "Cliente actualizado correctamente."
          : "Cliente registrado correctamente.",
      );
      resetForm();
      await fetchClientes();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error desconocido al guardar.");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (cliente: Cliente) => {
    const accion = cliente.activo ? "inactivar" : "activar";
    const confirmar = window.confirm(`¿Deseas ${accion} este cliente?`);

    if (!confirmar) return;

    try {
      setUpdatingId(cliente.id);
      setError("");
      setSuccess("");

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const accessToken = sessionData.session.access_token;
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

      const resp = await fetch(
        `${baseUrl}/rest/v1/clientes?id=eq.${cliente.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            activo: !cliente.activo,
          }),
        },
      );

      const json = await resp.json().catch(() => null);

      if (!resp.ok) {
        console.error(json);
        setError("No se pudo actualizar el estado del cliente.");
        return;
      }

      setSuccess(
        !cliente.activo
          ? "Cliente activado correctamente."
          : "Cliente inactivado correctamente.",
      );

      if (editingId === cliente.id) {
        setForm((prev) => ({
          ...prev,
          activo: !cliente.activo ? "true" : "false",
        }));
      }

      await fetchClientes();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error desconocido al actualizar.");
      }
    } finally {
      setUpdatingId("");
    }
  };


  const openDeleteCliente = (cliente: Cliente) => {
    setDeleteTarget(cliente);
    setDeleteMotivo("");
    setError("");
    setSuccess("");
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteMotivo("");
  };

  const handleDeleteCliente = async () => {
    if (!deleteTarget) return;

    if (!deleteMotivo.trim()) {
      setError("Debes indicar un motivo para eliminar el cliente.");
      return;
    }

    try {
      setDeleting(true);
      setUpdatingId(deleteTarget.id);
      setError("");
      setSuccess("");

      const { error: rpcError } = await supabase.rpc("eliminar_cliente_admin", {
        p_cliente_id: deleteTarget.id,
        p_motivo: deleteMotivo.trim(),
      });

      if (rpcError) {
        setError(rpcError.message || "No se pudo eliminar el cliente.");
        return;
      }

      if (editingId === deleteTarget.id) {
        resetForm();
      }

      setSuccess("Cliente eliminado correctamente.");
      setDeleteTarget(null);
      setDeleteMotivo("");
      await fetchClientes();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error desconocido al eliminar.");
      }
    } finally {
      setDeleting(false);
      setUpdatingId("");
    }
  };

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Clientes</h1>
        <p className="text-slate-600 mt-2">
          Administración de clientes por empresa activa.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Listado de clientes
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Clientes registrados para la empresa activa.
          </p>

          {loading && (
            <div className="text-slate-500">Cargando clientes...</div>
          )}

          {!loading && !error && clientes.length === 0 && (
            <div className="text-slate-500 text-sm">
              No hay clientes registrados para esta empresa.
            </div>
          )}

          {!loading && !error && clientes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-3 pr-4">Nombre</th>
                    <th className="py-3 pr-4">RUT</th>
                    <th className="py-3 pr-4">Contacto</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Teléfono</th>
                    <th className="py-3 pr-4">Tipo cliente</th>
                    <th className="py-3 pr-4">Condición pago</th>
                    <th className="py-3 pr-4">Estado</th>
                    <th className="py-3 pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-medium">{item.nombre}</td>
                      <td className="py-3 pr-4">{item.rut ?? "-"}</td>
                      <td className="py-3 pr-4">{item.contacto ?? "-"}</td>
                      <td className="py-3 pr-4">{item.email ?? "-"}</td>
                      <td className="py-3 pr-4">{item.telefono ?? "-"}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getEstadoComercialBadgeClass(
                            item.estado_comercial,
                          )}`}
                        >
                          {getEstadoComercialLabel(item.estado_comercial)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {getCondicionLabel(
                          item.condicion_pago,
                          item.dias_credito,
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge
                          status={item.activo ? "activo" : "inactivo"}
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleActivo(item)}
                            disabled={updatingId === item.id}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            {updatingId === item.id
                              ? "Guardando..."
                              : item.activo
                                ? "Inactivar"
                                : "Activar"}
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => openDeleteCliente(item)}
                              disabled={updatingId === item.id || deleting}
                              className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            {editingId ? "Editar cliente" : "Nuevo cliente / prospecto"}
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            {editingId
              ? "Actualiza la información del cliente."
              : "Crea un cliente real o un prospecto para cotizaciones."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Nombre
              </label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">RUT</label>
              <input
                type="text"
                name="rut"
                value={form.rut}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Estado comercial
              </label>
              <select
                name="estado_comercial"
                value={form.estado_comercial}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
              >
                {estadosComerciales.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Usa Prospecto para cotizaciones cuando aún no es cliente real.
              </p>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Contacto
              </label>
              <input
                type="text"
                name="contacto"
                value={form.contacto}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Teléfono
              </label>
              <input
                type="text"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Dirección
              </label>
              <textarea
                name="direccion"
                value={form.direccion}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">
                  Condición de pago
                </label>
                <select
                  name="condicion_pago"
                  value={form.condicion_pago}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                >
                  {condicionesPago.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">
                  Días de crédito
                </label>
                <input
                  type="number"
                  name="dias_credito"
                  value={form.dias_credito}
                  onChange={handleChange}
                  min={0}
                  disabled={form.condicion_pago !== "personalizado"}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 disabled:bg-slate-100 disabled:text-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Para condiciones fijas se calcula automáticamente. Usa
                  "Personalizado" para ingresar otro plazo.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Estado interno
              </label>
              <select
                name="activo"
                value={form.activo}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-slate-900 text-white py-3 font-medium disabled:opacity-60"
              >
                {saving
                  ? "Guardando..."
                  : editingId
                    ? "Actualizar cliente"
                    : "Guardar cliente"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-300 px-4 py-3 font-medium"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-900">
              Eliminar cliente
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Esta acción no borra físicamente el registro. El cliente quedará
              oculto del listado normal y no se podrá usar en nuevos registros.
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
              <div className="font-semibold">{deleteTarget.nombre}</div>
              <div>RUT: {deleteTarget.rut || "-"}</div>
              <div>Email: {deleteTarget.email || "-"}</div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-slate-600 mb-2">
                Motivo de eliminación
              </label>
              <textarea
                value={deleteMotivo}
                onChange={(e) => setDeleteMotivo(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Ejemplo: cliente ingresado por error o duplicado."
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCliente}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Eliminando..." : "Eliminar cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
