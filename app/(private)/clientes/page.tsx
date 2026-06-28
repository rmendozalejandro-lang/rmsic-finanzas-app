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

type ClienteContacto = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  nombre: string;
  cargo: string | null;
  area: string | null;
  linea: string | null;
  email: string | null;
  telefono: string | null;
  tipo_contacto: string | null;
  recibe_informes_ot: boolean | null;
  activo: boolean;
  created_at: string;
};

type ContactoForm = {
  nombre: string;
  cargo: string;
  area: string;
  linea: string;
  email: string;
  telefono: string;
  tipo_contacto: string;
  recibe_informes_ot: boolean;
};

const emptyContactoForm: ContactoForm = {
  nombre: "",
  cargo: "",
  area: "",
  linea: "",
  email: "",
  telefono: "",
  tipo_contacto: "responsable_trabajo",
  recibe_informes_ot: true,
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

  const [contactoCliente, setContactoCliente] = useState<Cliente | null>(null);
  const [contactosCliente, setContactosCliente] = useState<ClienteContacto[]>([]);
  const [contactosLoading, setContactosLoading] = useState(false);
  const [contactosError, setContactosError] = useState("");
  const [contactosSuccess, setContactosSuccess] = useState("");
  const [contactoEditingId, setContactoEditingId] = useState<string | null>(null);
  const [savingContacto, setSavingContacto] = useState(false);
  const [updatingContactoId, setUpdatingContactoId] = useState("");
  const [contactoForm, setContactoForm] = useState<ContactoForm>(emptyContactoForm);

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
      setContactoCliente(null);
      setContactosCliente([]);
      setContactoEditingId(null);
      setContactoForm(emptyContactoForm);
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


  const resetContactoForm = () => {
    setContactoEditingId(null);
    setContactoForm(emptyContactoForm);
  };

  const fetchContactosCliente = async (clienteId = contactoCliente?.id || "") => {
    if (!empresaActivaId || !clienteId) return;

    try {
      setContactosLoading(true);
      setContactosError("");

      const { data, error: contactosErrorResp } = await supabase
        .from("cliente_contactos")
        .select(
          "id, empresa_id, cliente_id, nombre, cargo, area, linea, email, telefono, tipo_contacto, recibe_informes_ot, activo, created_at",
        )
        .eq("empresa_id", empresaActivaId)
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (contactosErrorResp) {
        setContactosError(contactosErrorResp.message);
        return;
      }

      setContactosCliente((data ?? []) as ClienteContacto[]);
    } catch (err) {
      setContactosError(
        err instanceof Error ? err.message : "No se pudieron cargar los contactos.",
      );
    } finally {
      setContactosLoading(false);
    }
  };

  const openContactosCliente = async (cliente: Cliente) => {
    setContactoCliente(cliente);
    setContactosCliente([]);
    setContactosError("");
    setContactosSuccess("");
    resetContactoForm();
    await fetchContactosCliente(cliente.id);
  };

  const handleContactoChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    if (name === "recibe_informes_ot") {
      setContactoForm((prev) => ({
        ...prev,
        recibe_informes_ot: value === "true",
      }));
      return;
    }

    setContactoForm((prev) => ({ ...prev, [name]: value }));
  };

  const startEditContacto = (contacto: ClienteContacto) => {
    setContactoEditingId(contacto.id);
    setContactosError("");
    setContactosSuccess("");
    setContactoForm({
      nombre: contacto.nombre || "",
      cargo: contacto.cargo || "",
      area: contacto.area || "",
      linea: contacto.linea || "",
      email: contacto.email || "",
      telefono: contacto.telefono || "",
      tipo_contacto: contacto.tipo_contacto || "responsable_trabajo",
      recibe_informes_ot: contacto.recibe_informes_ot !== false,
    });
  };

  const handleContactoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactoCliente) {
      setContactosError("Debes seleccionar un cliente para administrar contactos.");
      return;
    }

    if (!contactoForm.nombre.trim()) {
      setContactosError("Debes ingresar el nombre del contacto.");
      return;
    }

    if (contactoForm.recibe_informes_ot && !contactoForm.email.trim()) {
      setContactosError("Para recibir informes OM el contacto debe tener email.");
      return;
    }

    try {
      setSavingContacto(true);
      setContactosError("");
      setContactosSuccess("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("No se pudo validar el usuario actual.");
      }

      const payload = {
        empresa_id: empresaActivaId,
        cliente_id: contactoCliente.id,
        nombre: contactoForm.nombre.trim(),
        cargo: contactoForm.cargo.trim() || null,
        area: contactoForm.area.trim() || null,
        linea: contactoForm.linea.trim() || null,
        email: contactoForm.email.trim() || null,
        telefono: contactoForm.telefono.trim() || null,
        tipo_contacto: contactoForm.tipo_contacto.trim() || null,
        recibe_informes_ot: contactoForm.recibe_informes_ot,
        updated_by: user.id,
        ...(contactoEditingId ? {} : { created_by: user.id }),
      };

      const query = contactoEditingId
        ? supabase
            .from("cliente_contactos")
            .update(payload)
            .eq("id", contactoEditingId)
            .eq("empresa_id", empresaActivaId)
            .eq("cliente_id", contactoCliente.id)
        : supabase.from("cliente_contactos").insert(payload);

      const { error: saveContactoError } = await query;

      if (saveContactoError) {
        throw new Error(saveContactoError.message);
      }

      setContactosSuccess(
        contactoEditingId
          ? "Contacto actualizado correctamente."
          : "Contacto agregado correctamente.",
      );
      resetContactoForm();
      await fetchContactosCliente(contactoCliente.id);
    } catch (err) {
      setContactosError(
        err instanceof Error ? err.message : "No se pudo guardar el contacto.",
      );
    } finally {
      setSavingContacto(false);
    }
  };

  const desactivarContacto = async (contacto: ClienteContacto) => {
    if (!contactoCliente) return;

    const confirmar = window.confirm(
      `¿Deseas desactivar el contacto ${contacto.nombre}?`,
    );

    if (!confirmar) return;

    try {
      setUpdatingContactoId(contacto.id);
      setContactosError("");
      setContactosSuccess("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: updateContactoError } = await supabase
        .from("cliente_contactos")
        .update({
          activo: false,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contacto.id)
        .eq("empresa_id", empresaActivaId)
        .eq("cliente_id", contactoCliente.id);

      if (updateContactoError) {
        throw new Error(updateContactoError.message);
      }

      if (contactoEditingId === contacto.id) {
        resetContactoForm();
      }

      setContactosSuccess("Contacto desactivado correctamente.");
      await fetchContactosCliente(contactoCliente.id);
    } catch (err) {
      setContactosError(
        err instanceof Error ? err.message : "No se pudo desactivar el contacto.",
      );
    } finally {
      setUpdatingContactoId("");
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

      if (contactoCliente?.id === deleteTarget.id) {
        setContactoCliente(null);
        setContactosCliente([]);
        resetContactoForm();
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
                            onClick={() => void openContactosCliente(item)}
                            className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >
                            Contactos
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

      {contactoCliente && (
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Contactos de {contactoCliente.nombre}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Estos contactos podrán seleccionarse en una OM y recibir el informe por correo.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setContactoCliente(null);
                setContactosCliente([]);
                resetContactoForm();
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cerrar contactos
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {contactosLoading ? (
                <div className="text-sm text-slate-500">Cargando contactos...</div>
              ) : contactosCliente.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                  Este cliente aún no tiene contactos registrados.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-500">
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">Cargo</th>
                        <th className="px-4 py-3">Área / línea</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Recibe informes</th>
                        <th className="px-4 py-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactosCliente.map((contacto) => (
                        <tr key={contacto.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {contacto.nombre}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {contacto.cargo || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {[contacto.area, contacto.linea].filter(Boolean).join(" / ") || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {contacto.email || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              status={contacto.recibe_informes_ot === false ? "inactivo" : "activo"}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEditContacto(contacto)}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void desactivarContacto(contacto)}
                                disabled={updatingContactoId === contacto.id}
                                className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                              >
                                Desactivar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {contactoEditingId ? "Editar contacto" : "Nuevo contacto"}
              </h3>

              <form onSubmit={handleContactoSubmit} autoComplete="off" className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-2">Nombre</label>
                  <input
                    type="text"
                    name="nombre"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={contactoForm.nombre}
                    onChange={handleContactoChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-2">Cargo</label>
                  <input
                    type="text"
                    name="cargo"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={contactoForm.cargo}
                    onChange={handleContactoChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Área</label>
                    <input
                      type="text"
                      name="area"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      value={contactoForm.area}
                      onChange={handleContactoChange}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Línea</label>
                    <input
                      type="text"
                      name="linea"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      value={contactoForm.linea}
                      onChange={handleContactoChange}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={contactoForm.email}
                    onChange={handleContactoChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-2">Teléfono</label>
                  <input
                    type="text"
                    name="telefono"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={contactoForm.telefono}
                    onChange={handleContactoChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-2">Tipo contacto</label>
                  <select
                    name="tipo_contacto"
                    value={contactoForm.tipo_contacto}
                    onChange={handleContactoChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                  >
                    <option value="responsable_trabajo">Responsable trabajo</option>
                    <option value="solicitante">Solicitante</option>
                    <option value="recepcion">Recepción informe</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="seguridad">Seguridad</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-2">
                    Recibe informes OM
                  </label>
                  <select
                    name="recibe_informes_ot"
                    value={contactoForm.recibe_informes_ot ? "true" : "false"}
                    onChange={handleContactoChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>

                {contactosError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {contactosError}
                  </div>
                )}

                {contactosSuccess && (
                  <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                    {contactosSuccess}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={savingContacto}
                    className="flex-1 rounded-xl bg-slate-900 text-white py-3 font-medium disabled:opacity-60"
                  >
                    {savingContacto
                      ? "Guardando..."
                      : contactoEditingId
                        ? "Actualizar contacto"
                        : "Guardar contacto"}
                  </button>

                  {contactoEditingId && (
                    <button
                      type="button"
                      onClick={resetContactoForm}
                      className="rounded-xl border border-slate-300 px-4 py-3 font-medium"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
