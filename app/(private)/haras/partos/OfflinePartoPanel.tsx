"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";

type SexoCria = "macho" | "hembra" | "no_definido";
type ContextoParto = {
  id: string;
  madre_id: string;
  padre_id: string | null;
  fecha_ultima_monta: string | null;
  fecha_probable_parto: string | null;
  estado_reproductivo: string;
  madre_nombre?: string;
  padre_nombre?: string;
};
type CachePartos = {
  empresa_id: string;
  madres: { id: string; nombre: string }[];
  gestaciones: ContextoParto[];
};
type Horas = {
  hora_inicio_parto: string;
  hora_expulsion_cria: string;
  hora_parada_yegua: string;
  hora_corte_cordon: string;
  hora_parada_potrillo: string;
  hora_expulsion_placenta: string;
  hora_primera_mamada: string;
};
type Pendiente = Horas & {
  local_id: string;
  empresa_id: string;
  parto_id: string;
  gestacion_id: string;
  madre_id: string;
  padre_id: string | null;
  fecha_ultima_monta: string | null;
  fecha_parto_real: string;
  nombre_cria: string;
  sexo_cria: SexoCria;
  peso_cria: string;
  peso_placenta: string;
  observaciones: string;
  crear_cria: boolean;
  cria_id_creada: string | null;
  created_at_local: string;
  sync_status: "pendiente" | "sincronizando" | "error";
  sync_error: string | null;
};

const emptyHoras: Horas = {
  hora_inicio_parto: "",
  hora_expulsion_cria: "",
  hora_parada_yegua: "",
  hora_corte_cordon: "",
  hora_parada_potrillo: "",
  hora_expulsion_placenta: "",
  hora_primera_mamada: "",
};
const hourFields: { key: keyof Horas; label: string }[] = [
  { key: "hora_inicio_parto", label: "Hora inicio parto" },
  { key: "hora_expulsion_cria", label: "Hora expulsión cría" },
  { key: "hora_parada_yegua", label: "Hora parada yegua" },
  { key: "hora_corte_cordon", label: "Hora corte cordón umbilical" },
  { key: "hora_parada_potrillo", label: "Hora parada potrillo" },
  { key: "hora_expulsion_placenta", label: "Hora expulsión placenta" },
  { key: "hora_primera_mamada", label: "Hora primera mamada potrillo" },
];
const inputClass =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function cacheKey(empresaId: string) {
  return `tralixia_haras_partos_cache_${empresaId}`;
}
function pendingKey(empresaId: string) {
  return `tralixia_haras_partos_pendientes_${empresaId}`;
}
function safeRead<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function OfflinePartoPanel({
  empresaId,
  madres,
  gestaciones,
  onSynced,
}: {
  empresaId: string | null;
  madres: { id: string; nombre: string }[];
  gestaciones: ContextoParto[];
  onSynced: () => Promise<void>;
}) {
  const [online, setOnline] = useState(true);
  const [cache, setCache] = useState<CachePartos | null>(null);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const pendientesRef = useRef<Pendiente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [gestacionId, setGestacionId] = useState("");
  const [form, setForm] = useState({
    fecha_parto_real: "",
    nombre_cria: "",
    sexo_cria: "no_definido" as SexoCria,
    peso_cria: "",
    peso_placenta: "",
    observaciones: "",
    crear_cria: false,
    ...emptyHoras,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!empresaId) return;
    const savedCache = safeRead<CachePartos | null>(cacheKey(empresaId), null);
    const savedPending = safeRead<Pendiente[]>(pendingKey(empresaId), []);
    setCache(savedCache);
    const restored = savedPending.map(
      (item) =>
        ({
          ...item,
          sync_status:
            item.sync_status === "sincronizando"
              ? "pendiente"
              : item.sync_status,
        }) as Pendiente,
    );
    pendientesRef.current = restored;
    setPendientes(restored);
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId || !online) return;
    const minimal: CachePartos = { empresa_id: empresaId, madres, gestaciones };
    localStorage.setItem(cacheKey(empresaId), JSON.stringify(minimal));
    setCache(minimal);
  }, [empresaId, gestaciones, madres, online]);

  const persist = useCallback(
    (items: Pendiente[]) => {
      if (!empresaId) return;
      pendientesRef.current = items;
      setPendientes(items);
      localStorage.setItem(pendingKey(empresaId), JSON.stringify(items));
    },
    [empresaId],
  );

  const gestationNames = useMemo(
    () =>
      new Map(
        cache?.gestaciones.map((item) => [
          item.id,
          item.madre_nombre ?? "Yegua sin nombre",
        ]) ?? [],
      ),
    [cache],
  );

  function saveLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!empresaId || !gestacionId)
      return setMessage("Selecciona una gestación para guardar.");
    const gestacion = cache?.gestaciones.find(
      (item) => item.id === gestacionId,
    );
    if (!gestacion)
      return setMessage(
        "La gestación seleccionada ya no está disponible en el caché local.",
      );
    if (!form.fecha_parto_real)
      return setMessage("La fecha real del parto es obligatoria.");
    if (
      gestacion.fecha_ultima_monta &&
      form.fecha_parto_real < gestacion.fecha_ultima_monta
    )
      return setMessage("La fecha del parto no puede ser anterior a la monta.");
    if (Number(form.peso_cria || 0) < 0 || Number(form.peso_placenta || 0) < 0)
      return setMessage("Los pesos no pueden ser negativos.");
    if (form.crear_cria && !form.nombre_cria.trim())
      return setMessage(
        "El nombre de la cría es obligatorio para crearla en el maestro.",
      );
    const item: Pendiente = {
      ...form,
      local_id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      empresa_id: empresaId,
      parto_id: gestacion.id,
      gestacion_id: gestacion.id,
      madre_id: gestacion.madre_id,
      padre_id: gestacion.padre_id,
      fecha_ultima_monta: gestacion.fecha_ultima_monta,
      nombre_cria: form.nombre_cria.trim(),
      observaciones: form.observaciones.trim(),
      created_at_local: new Date().toISOString(),
      sync_status: "pendiente",
      sync_error: null,
      cria_id_creada: null,
    };
    persist([...pendientes, item]);
    setForm({
      fecha_parto_real: "",
      nombre_cria: "",
      sexo_cria: "no_definido",
      peso_cria: "",
      peso_placenta: "",
      observaciones: "",
      crear_cria: false,
      ...emptyHoras,
    });
    setGestacionId("");
    setShowForm(false);
    setMessage(
      "Parto guardado en este dispositivo. Se sincronizará cuando vuelva internet.",
    );
  }

  async function syncOne(item: Pendiente) {
    if (!online || syncing || item.sync_status === "sincronizando") return;
    setSyncing(true);
    setMessage(null);
    let working = pendientesRef.current.map((current) =>
      current.local_id === item.local_id
        ? {
            ...current,
            sync_status: "sincronizando" as const,
            sync_error: null,
          }
        : current,
    );
    persist(working);
    try {
      if (!item.empresa_id || !item.parto_id)
        throw new Error("Falta empresa o gestación en el registro local.");
      let criaId: string | null = item.cria_id_creada ?? null;
      if (item.crear_cria && item.nombre_cria && !criaId) {
        const child = await supabase
          .from("vet_animales")
          .insert({
            empresa_id: item.empresa_id,
            nombre: item.nombre_cria,
            sexo:
              item.sexo_cria === "no_definido" ? "desconocido" : item.sexo_cria,
            fecha_nacimiento: item.fecha_parto_real,
            madre_id: item.madre_id,
            padre_id: item.padre_id,
            categoria: "cria",
            estado: "activo",
          })
          .select("id")
          .single();
        if (child.error)
          throw new Error(
            `No fue posible crear la cría: ${child.error.message}`,
          );
        criaId = child.data.id;
        working = working.map((current) =>
          current.local_id === item.local_id
            ? { ...current, cria_id_creada: criaId }
            : current,
        );
        persist(working);
      }
      const times = Object.fromEntries(
        hourFields.map(({ key }) => [key, item[key] || null]),
      );
      const realDays = item.fecha_ultima_monta
        ? Math.round(
            (new Date(`${item.fecha_parto_real}T00:00:00`).getTime() -
              new Date(`${item.fecha_ultima_monta}T00:00:00`).getTime()) /
              86_400_000,
          )
        : null;
      const response = await supabase
        .from("vet_partos")
        .update({
          ...times,
          ...(criaId ? { cria_id: criaId } : {}),
          fecha_parto_real: item.fecha_parto_real,
          fecha_parto: `${item.fecha_parto_real}T12:00:00`,
          dias_gestacion_real: realDays,
          estado_reproductivo: "parto_registrado",
          estado: "ocurrido",
          nombre_cria: item.nombre_cria || null,
          sexo_cria: item.sexo_cria,
          peso_cria: item.peso_cria === "" ? null : Number(item.peso_cria),
          peso_placenta:
            item.peso_placenta === "" ? null : Number(item.peso_placenta),
          observaciones: item.observaciones || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.parto_id)
        .eq("empresa_id", item.empresa_id);
      if (response.error)
        throw new Error(
          `No fue posible registrar el parto: ${response.error.message}`,
        );
      working = working.filter((current) => current.local_id !== item.local_id);
      persist(working);
      setMessage("Sincronizado correctamente.");
      await onSynced();
    } catch (caught) {
      const detail =
        caught instanceof Error
          ? caught.message
          : "Error desconocido de sincronización.";
      working = working.map((current) =>
        current.local_id === item.local_id
          ? { ...current, sync_status: "error" as const, sync_error: detail }
          : current,
      );
      persist(working);
      setMessage(detail);
    } finally {
      setSyncing(false);
    }
  }

  async function syncAll() {
    if (syncing) return;
    for (const item of pendientes) await syncOne(item);
  }

  function remove(item: Pendiente) {
    if (item.sync_status === "sincronizando") return;
    if (
      window.confirm("¿Eliminar este registro pendiente de este dispositivo?")
    )
      persist(
        pendientes.filter((current) => current.local_id !== item.local_id),
      );
  }

  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className={`text-sm font-bold ${online ? "text-emerald-700" : "text-amber-700"}`}
          >
            {online
              ? "Con conexión"
              : "Sin conexión: los registros se guardarán en este dispositivo"}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Registro offline de partos
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Hay {pendientes.length} registros pendientes de sincronizar.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {online && pendientes.length > 0 && (
            <button
              disabled={syncing}
              onClick={() => void syncAll()}
              className="min-h-12 rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {syncing ? "Sincronizando…" : "Sincronizar pendientes"}
            </button>
          )}
          <button
            onClick={() => setShowForm((value) => !value)}
            className="min-h-12 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-slate-950"
          >
            Registrar parto offline
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
        <p>
          Abre esta pantalla con conexión antes de ir a pecebrera para dejar
          cargadas las gestaciones.
        </p>
        <p className="mt-1">
          Sin señal, los datos quedan guardados solo en este celular hasta
          sincronizar.
        </p>
        <p className="mt-1 font-semibold">
          Los datos offline quedan temporalmente en este dispositivo. Sincroniza
          apenas vuelva la señal.
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"
        >
          {message}
        </p>
      )}

      {showForm &&
        (cache?.gestaciones.length ? (
          <form
            onSubmit={saveLocal}
            className="mt-5 rounded-2xl border border-slate-200 p-4 sm:p-5"
          >
            <h3 className="font-semibold text-slate-900">
              Datos críticos del parto
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
                Gestación / yegua madre *
                <select
                  required
                  value={gestacionId}
                  onChange={(event) => setGestacionId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Seleccionar gestación</option>
                  {cache.gestaciones.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.madre_nombre ?? "Yegua sin nombre"} · probable{" "}
                      {item.fecha_probable_parto ?? "sin fecha"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Fecha parto real *
                <input
                  required
                  type="date"
                  value={form.fecha_parto_real}
                  onChange={(event) =>
                    setForm({ ...form, fecha_parto_real: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Nombre cría
                <input
                  value={form.nombre_cria}
                  onChange={(event) =>
                    setForm({ ...form, nombre_cria: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Sexo cría
                <select
                  value={form.sexo_cria}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      sexo_cria: event.target.value as SexoCria,
                    })
                  }
                  className={inputClass}
                >
                  <option value="no_definido">No definido</option>
                  <option value="hembra">Hembra</option>
                  <option value="macho">Macho</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Peso cría (kg)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.peso_cria}
                  onChange={(event) =>
                    setForm({ ...form, peso_cria: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Peso placenta (kg)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.peso_placenta}
                  onChange={(event) =>
                    setForm({ ...form, peso_placenta: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              {hourFields.map(({ key, label }) => (
                <label key={key} className="text-sm font-medium text-slate-700">
                  {label}
                  <input
                    type="time"
                    value={form[key]}
                    onChange={(event) =>
                      setForm({ ...form, [key]: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
              ))}
              <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
                Observaciones
                <textarea
                  rows={3}
                  value={form.observaciones}
                  onChange={(event) =>
                    setForm({ ...form, observaciones: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 sm:col-span-2 lg:col-span-3">
                <input
                  type="checkbox"
                  checked={form.crear_cria}
                  onChange={(event) =>
                    setForm({ ...form, crear_cria: event.target.checked })
                  }
                  className="h-5 w-5"
                />
                Crear cría en maestro al sincronizar
              </label>
            </div>
            <button className="mt-5 min-h-12 w-full rounded-xl bg-amber-500 px-5 py-3 font-semibold text-slate-950 sm:w-auto">
              Guardar en este dispositivo
            </button>
          </form>
        ) : (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No hay gestaciones disponibles en este dispositivo. Abre esta
            pantalla con conexión antes de usar el modo offline.
          </p>
        ))}

      {pendientes.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-slate-900">
            Registros pendientes de sincronizar
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {pendientes.map((item) => (
              <article
                key={item.local_id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {gestationNames.get(item.gestacion_id) ??
                        "Yegua no disponible"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {item.fecha_parto_real} ·{" "}
                      {item.nombre_cria || "Cría sin nombre"}
                    </p>
                  </div>
                  <span className="h-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {item.sync_status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Guardado:{" "}
                  {new Date(item.created_at_local).toLocaleString("es-CL")}
                </p>
                {item.sync_error && (
                  <p className="mt-2 text-sm text-rose-700">
                    {item.sync_error}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  {online && (
                    <button
                      disabled={syncing}
                      onClick={() => void syncOne(item)}
                      className="min-h-11 flex-1 rounded-xl bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Sincronizar
                    </button>
                  )}
                  <button
                    disabled={syncing}
                    onClick={() => remove(item)}
                    className="min-h-11 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                  >
                    Eliminar local
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
