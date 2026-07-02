"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type TecnicoDyF = {
  id: string;
  empresa_id: string;
  nombre_completo: string;
  rut: string;
  cargo: string;
  especialidad: string | null;
  telefono: string | null;
  email: string | null;
  empresa_origen: string;
  activo: boolean;
};
type FormTecnico = {
  nombre_completo: string;
  rut: string;
  cargo: string;
  especialidad: string;
  telefono: string;
  email: string;
};

const formInicial: FormTecnico = {
  nombre_completo: "",
  rut: "",
  cargo: "",
  especialidad: "",
  telefono: "",
  email: "",
};

export default function TecnicosDyFPage() {
  

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [tecnicos, setTecnicos] = useState<TecnicoDyF[]>([]);
  const [form, setForm] = useState<FormTecnico>(formInicial);
  const [tecnicoEditando, setTecnicoEditando] = useState<TecnicoDyF | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  inicializar();

  const handleEmpresaActivaCambiada = () => {
    limpiarFormulario();
    inicializar();
  };

  window.addEventListener("empresa-activa-cambiada", handleEmpresaActivaCambiada);

  return () => {
    window.removeEventListener("empresa-activa-cambiada", handleEmpresaActivaCambiada);
  };
}, []);

useEffect(() => {
  inicializar();

  const handleEmpresaActivaCambiada = () => {
    limpiarFormulario();
    inicializar();
  };

  window.addEventListener("empresa-activa-cambiada", handleEmpresaActivaCambiada);

  return () => {
    window.removeEventListener("empresa-activa-cambiada", handleEmpresaActivaCambiada);
  };
}, []);
  async function inicializar() {
  setCargando(true);
  setError(null);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    setError("No se pudo obtener el usuario autenticado.");
    setCargando(false);
    return;
  }

  const empresaActivaId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("empresa_activa_id") || ""
      : "";

  if (!empresaActivaId) {
    setError("No existe empresa activa seleccionada.");
    setTecnicos([]);
    setEmpresaId(null);
    setCargando(false);
    return;
  }

  const { data: superAdminData, error: superAdminError } = await supabase.rpc(
    "es_super_admin"
  );

  const esSuperAdmin = !superAdminError && Boolean(superAdminData);

  if (!esSuperAdmin) {
    const { data: usuarioEmpresa, error: empresaError } = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("usuario_id", user.id)
      .eq("empresa_id", empresaActivaId)
      .eq("activo", true)
      .maybeSingle();

    if (empresaError || !usuarioEmpresa?.empresa_id) {
      setError("No tienes acceso a la empresa activa seleccionada.");
      setTecnicos([]);
      setEmpresaId(null);
      setCargando(false);
      return;
    }
  }

  setEmpresaId(empresaActivaId);
  await cargarTecnicos(empresaActivaId);
  setCargando(false);
}

  async function cargarTecnicos(idEmpresa: string) {
    const { data, error } = await supabase
      .from("ot_tecnicos_externos")
      .select("*")
      .eq("empresa_id", idEmpresa)
      .order("nombre_completo", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setTecnicos((data || []) as TecnicoDyF[]);
  }

  function actualizarCampo(campo: keyof FormTecnico, valor: string) {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }

  function limpiarFormulario() {
    setForm(formInicial);
    setTecnicoEditando(null);
    setError(null);
  }

  function editarTecnico(tecnico: TecnicoDyF) {
    setTecnicoEditando(tecnico);
    setForm({
      nombre_completo: tecnico.nombre_completo || "",
      rut: tecnico.rut || "",
      cargo: tecnico.cargo || "",
      especialidad: tecnico.especialidad || "",
      telefono: tecnico.telefono || "",
      email: tecnico.email || "",
    });
  }

  async function guardarTecnico(e: React.FormEvent) {
    e.preventDefault();

    if (!empresaId) {
      setError("No existe empresa activa.");
      return;
    }

    if (!form.nombre_completo.trim()) {
      setError("El nombre completo es obligatorio.");
      return;
    }

    if (!form.rut.trim()) {
      setError("El RUT es obligatorio.");
      return;
    }

    if (!form.cargo.trim()) {
      setError("El cargo es obligatorio.");
      return;
    }

    setGuardando(true);
    setError(null);

    const payload = {
      empresa_id: empresaId,
      nombre_completo: form.nombre_completo.trim(),
      rut: form.rut.trim(),
      cargo: form.cargo.trim(),
      especialidad: form.especialidad.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      empresa_origen: "DyF",
      updated_at: new Date().toISOString(),
    };

    if (tecnicoEditando) {
      const { error } = await supabase
        .from("ot_tecnicos_externos")
        .update(payload)
        .eq("id", tecnicoEditando.id);

      if (error) {
        setError(error.message);
        setGuardando(false);
        return;
      }
    } else {
      const { error } = await supabase.from("ot_tecnicos_externos").insert({
        ...payload,
        activo: true,
      });

      if (error) {
        setError(error.message);
        setGuardando(false);
        return;
      }
    }

    await cargarTecnicos(empresaId);
    limpiarFormulario();
    setGuardando(false);
  }

  async function cambiarEstadoTecnico(tecnico: TecnicoDyF) {
    if (!empresaId) return;

    const { error } = await supabase
      .from("ot_tecnicos_externos")
      .update({
        activo: !tecnico.activo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tecnico.id);

    if (error) {
      setError(error.message);
      return;
    }

    await cargarTecnicos(empresaId);
  }

  const tecnicosFiltrados = tecnicos.filter((tecnico) => {
    const texto = `${tecnico.nombre_completo} ${tecnico.rut} ${tecnico.cargo} ${tecnico.especialidad || ""}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
  Técnicos participantes DyF
</h1>
        <p className="text-sm text-gray-600">
         Registra técnicos de DyF para trazabilidad en OT/OM Softys. 
Estos técnicos no tienen acceso al sistema y solo se utilizan para indicar quiénes participaron en cada trabajo.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          {tecnicoEditando ? "Editar técnico" : "Crear técnico"}
        </h2>

        <form onSubmit={guardarTecnico} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre completo *</label>
            <input
              type="text"
              value={form.nombre_completo}
              onChange={(e) => actualizarCampo("nombre_completo", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Ej: Juan Pérez Soto"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">RUT *</label>
            <input
              type="text"
              value={form.rut}
              onChange={(e) => actualizarCampo("rut", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Ej: 12.345.678-9"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Cargo *</label>
            <input
              type="text"
              value={form.cargo}
              onChange={(e) => actualizarCampo("cargo", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Ej: Técnico mecánico"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Especialidad</label>
            <input
              type="text"
              value={form.especialidad}
              onChange={(e) => actualizarCampo("especialidad", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Ej: Motores / Válvulas"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Teléfono</label>
            <input
              type="text"
              value={form.telefono}
              onChange={(e) => actualizarCampo("telefono", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Ej: +56 9 1234 5678"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => actualizarCampo("email", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="correo@empresa.cl"
            />
          </div>

          <div className="flex gap-2 md:col-span-3">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {guardando
                ? "Guardando..."
                : tecnicoEditando
                  ? "Actualizar técnico"
                  : "Crear técnico"}
            </button>

            {tecnicoEditando && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="rounded-md border px-4 py-2 text-sm font-medium"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Listado de técnicos</h2>

          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm md:w-80"
            placeholder="Buscar por nombre, RUT, cargo o especialidad"
          />
        </div>

        {cargando ? (
          <p className="text-sm text-gray-600">Cargando técnicos...</p>
        ) : tecnicosFiltrados.length === 0 ? (
          <p className="text-sm text-gray-600">No hay técnicos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">RUT</th>
                  <th className="px-3 py-2">Cargo</th>
                  <th className="px-3 py-2">Especialidad</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {tecnicosFiltrados.map((tecnico) => (
                  <tr key={tecnico.id} className="border-b">
                    <td className="px-3 py-2 font-medium">{tecnico.nombre_completo}</td>
                    <td className="px-3 py-2">{tecnico.rut}</td>
                    <td className="px-3 py-2">{tecnico.cargo}</td>
                    <td className="px-3 py-2">{tecnico.especialidad || "-"}</td>
                    <td className="px-3 py-2">{tecnico.telefono || "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          tecnico.activo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {tecnico.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editarTecnico(tecnico)}
                          className="rounded-md border px-3 py-1 text-xs"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => cambiarEstadoTecnico(tecnico)}
                          className="rounded-md border px-3 py-1 text-xs"
                        >
                          {tecnico.activo ? "Inactivar" : "Activar"}
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
    </div>
  );
}