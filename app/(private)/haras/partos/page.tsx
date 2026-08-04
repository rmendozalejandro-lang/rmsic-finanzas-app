"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import {
  HARAS_PARTO_ACTION,
  isHarasPartoPayload,
  isNetworkFailure,
  type HarasPartoPendingPayload,
} from "@/lib/offline/haras-partos";
import { supabase } from "@/lib/supabase/client";
import OfflinePartoPanel from "./OfflinePartoPanel";

const EMPRESA_KEY = "empresa_activa_id";
const DAY_MS = 86_400_000;
type EstadoReproductivo =
  | "en_gestacion"
  | "proxima_a_parto"
  | "parto_atrasado"
  | "parto_registrado"
  | "sin_monta"
  | "anulado";
const estadoLabels: Record<EstadoReproductivo, string> = {
  en_gestacion: "En gestación",
  proxima_a_parto: "Próxima a parto",
  parto_atrasado: "Parto atrasado",
  parto_registrado: "Parto registrado",
  sin_monta: "Sin monta",
  anulado: "Anulado",
};
const badgeClasses: Record<EstadoReproductivo, string> = {
  en_gestacion: "bg-sky-100 text-sky-800",
  proxima_a_parto: "bg-amber-100 text-amber-800",
  parto_atrasado: "bg-rose-100 text-rose-800",
  parto_registrado: "bg-emerald-100 text-emerald-800",
  sin_monta: "bg-slate-100 text-slate-700",
  anulado: "bg-zinc-200 text-zinc-700",
};

type Animal = {
  id: string;
  nombre: string;
  categoria: string;
  sexo: string | null;
};
type Parto = {
  id: string;
  madre_id: string;
  padre_id: string | null;
  cria_id: string | null;
  fecha_ultima_monta: string | null;
  fecha_probable_parto: string | null;
  fecha_parto_real: string | null;
  dias_gestacion_real: number | null;
  estado_reproductivo: EstadoReproductivo;
  sexo_cria: "macho" | "hembra" | "no_definido" | null;
  nombre_cria: string | null;
  peso_cria: number | null;
  peso_placenta: number | null;
  observaciones: string | null;
  hora_inicio_parto: string | null;
  hora_expulsion_cria: string | null;
  hora_parada_yegua: string | null;
  hora_corte_cordon: string | null;
  hora_parada_potrillo: string | null;
  hora_expulsion_placenta: string | null;
  hora_primera_mamada: string | null;
};
type PartosTerrainCache = {
  empresa_id: string;
  updated_at: string | null;
  animales: Animal[];
  gestaciones: Parto[];
};
type GestacionForm = {
  madre_id: string;
  padre_id: string;
  fecha_ultima_monta: string;
  fecha_probable_parto: string;
  observaciones: string;
};
type PartoForm = {
  fecha_parto_real: string;
  nombre_cria: string;
  sexo_cria: "macho" | "hembra" | "no_definido";
  peso_cria: string;
  peso_placenta: string;
  observaciones: string;
  crear_cria: boolean;
  hora_inicio_parto: string;
  hora_expulsion_cria: string;
  hora_parada_yegua: string;
  hora_corte_cordon: string;
  hora_parada_potrillo: string;
  hora_expulsion_placenta: string;
  hora_primera_mamada: string;
};
const emptyGestacion: GestacionForm = {
  madre_id: "",
  padre_id: "",
  fecha_ultima_monta: "",
  fecha_probable_parto: "",
  observaciones: "",
};
const emptyParto: PartoForm = {
  fecha_parto_real: "",
  nombre_cria: "",
  sexo_cria: "no_definido",
  peso_cria: "",
  peso_placenta: "",
  observaciones: "",
  crear_cria: false,
  hora_inicio_parto: "",
  hora_expulsion_cria: "",
  hora_parada_yegua: "",
  hora_corte_cordon: "",
  hora_parada_potrillo: "",
  hora_expulsion_placenta: "",
  hora_primera_mamada: "",
};

function terrainCacheKey(empresaId: string) {
  return `tralixia_haras_partos_cache_${empresaId}`;
}

function readTerrainCache(empresaId: string): PartosTerrainCache | null {
  try {
    const raw = localStorage.getItem(terrainCacheKey(empresaId));
    if (!raw) return null;
    const value = JSON.parse(raw) as {
      empresa_id?: string;
      updated_at?: string;
      animales?: Animal[];
      madres?: Animal[];
      gestaciones?: Partial<Parto>[];
    };
    if (value.empresa_id !== empresaId || !Array.isArray(value.gestaciones))
      return null;
    return {
      empresa_id: empresaId,
      updated_at: value.updated_at ?? null,
      animales: Array.isArray(value.animales)
        ? value.animales
        : Array.isArray(value.madres)
          ? value.madres
          : [],
      gestaciones: value.gestaciones
        .filter(
          (item): item is Partial<Parto> & Pick<Parto, "id" | "madre_id"> =>
            typeof item.id === "string" && typeof item.madre_id === "string",
        )
        .map((item) => ({
          id: item.id,
          madre_id: item.madre_id,
          padre_id: item.padre_id ?? null,
          cria_id: item.cria_id ?? null,
          fecha_ultima_monta: item.fecha_ultima_monta ?? null,
          fecha_probable_parto: item.fecha_probable_parto ?? null,
          fecha_parto_real: item.fecha_parto_real ?? null,
          dias_gestacion_real: item.dias_gestacion_real ?? null,
          estado_reproductivo: item.estado_reproductivo ?? "en_gestacion",
          sexo_cria: item.sexo_cria ?? null,
          nombre_cria: item.nombre_cria ?? null,
          peso_cria: item.peso_cria ?? null,
          peso_placenta: item.peso_placenta ?? null,
          observaciones: item.observaciones ?? null,
          hora_inicio_parto: item.hora_inicio_parto ?? null,
          hora_expulsion_cria: item.hora_expulsion_cria ?? null,
          hora_parada_yegua: item.hora_parada_yegua ?? null,
          hora_corte_cordon: item.hora_corte_cordon ?? null,
          hora_parada_potrillo: item.hora_parada_potrillo ?? null,
          hora_expulsion_placenta: item.hora_expulsion_placenta ?? null,
          hora_primera_mamada: item.hora_primera_mamada ?? null,
        })),
    };
  } catch {
    return null;
  }
}
type TimeKey =
  | "hora_inicio_parto"
  | "hora_expulsion_cria"
  | "hora_parada_yegua"
  | "hora_corte_cordon"
  | "hora_parada_potrillo"
  | "hora_expulsion_placenta"
  | "hora_primera_mamada";
const timeFields: { key: TimeKey; label: string }[] = [
  { key: "hora_inicio_parto", label: "Inicio del parto" },
  { key: "hora_expulsion_cria", label: "Expulsión de la cría" },
  { key: "hora_parada_yegua", label: "Yegua de pie" },
  { key: "hora_corte_cordon", label: "Corte del cordón" },
  { key: "hora_parada_potrillo", label: "Potrillo de pie" },
  { key: "hora_expulsion_placenta", label: "Expulsión de placenta" },
  { key: "hora_primera_mamada", label: "Primera mamada" },
];

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}
function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}
function dateDiff(later: string, earlier: string) {
  return Math.round(
    (parseDate(later).getTime() - parseDate(earlier).getTime()) / DAY_MS,
  );
}
function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-CL").format(parseDate(value))
    : "—";
}
function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "—";
}
function today() {
  return isoDate(new Date());
}
function visualState(parto: Parto): EstadoReproductivo {
  if (parto.estado_reproductivo === "anulado") return "anulado";
  if (parto.fecha_parto_real) return "parto_registrado";
  if (!parto.fecha_ultima_monta) return "sin_monta";
  if (parto.fecha_probable_parto) {
    const remaining = dateDiff(parto.fecha_probable_parto, today());
    if (remaining < 0) return "parto_atrasado";
    if (remaining <= 30) return "proxima_a_parto";
  }
  return "en_gestacion";
}

export default function PartosPage() {
  const { items: offlineItems, addPending } = useOfflineQueue();
  const { isOnline, isOffline } = useNetworkStatus();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [animales, setAnimales] = useState<Animal[]>([]);
  const [partos, setPartos] = useState<Parto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const [hasTerrainCache, setHasTerrainCache] = useState(false);
  const [showGestacion, setShowGestacion] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [registering, setRegistering] = useState<Parto | null>(null);
  const [selected, setSelected] = useState<Parto | null>(null);
  const [gestacionForm, setGestacionForm] =
    useState<GestacionForm>(emptyGestacion);
  const [partoForm, setPartoForm] = useState<PartoForm>(emptyParto);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setEmpresaId(localStorage.getItem(EMPRESA_KEY)),
      0,
    );
    return () => clearTimeout(timer);
  }, []);
  const loadData = useCallback(async () => {
    if (!empresaId) {
      setLoading(false);
      return;
    }
    const restoreCachedData = () => {
      const cache = readTerrainCache(empresaId);
      setHasTerrainCache(Boolean(cache));
      setCacheUpdatedAt(cache?.updated_at ?? null);
      if (cache) {
        setAnimales(cache.animales);
        setPartos(cache.gestaciones);
      } else {
        setAnimales([]);
        setPartos([]);
      }
      setLoading(false);
      return Boolean(cache);
    };
    if (!navigator.onLine) return void restoreCachedData();
    setLoading(true);
    setError(null);
    try {
      const [animalsResponse, partosResponse] = await Promise.all([
        supabase
          .from("vet_animales")
          .select("id, nombre, categoria, sexo")
          .eq("empresa_id", empresaId)
          .order("nombre"),
        supabase
          .from("vet_partos")
          .select(
            "id, madre_id, padre_id, cria_id, fecha_ultima_monta, fecha_probable_parto, fecha_parto_real, dias_gestacion_real, estado_reproductivo, sexo_cria, nombre_cria, peso_cria, peso_placenta, observaciones, hora_inicio_parto, hora_expulsion_cria, hora_parada_yegua, hora_corte_cordon, hora_parada_potrillo, hora_expulsion_placenta, hora_primera_mamada",
          )
          .eq("empresa_id", empresaId)
          .order("fecha_probable_parto", { ascending: true }),
      ]);
      const requestError = animalsResponse.error || partosResponse.error;
      if (requestError && isNetworkFailure(requestError)) {
        restoreCachedData();
        return;
      }
      if (requestError) {
        setError(
          `No fue posible cargar el calendario: ${requestError.message}`,
        );
        setLoading(false);
        return;
      }
      const loadedAnimals = (animalsResponse.data ?? []) as Animal[];
      const loadedPartos = (partosResponse.data ?? []) as Parto[];
      setAnimales(loadedAnimals);
      setPartos(loadedPartos);
      const cache: PartosTerrainCache = {
        empresa_id: empresaId,
        updated_at: new Date().toISOString(),
        animales: loadedAnimals,
        gestaciones: loadedPartos.filter(
          (parto) =>
            !parto.fecha_parto_real && parto.estado_reproductivo !== "anulado",
        ),
      };
      try {
        localStorage.setItem(terrainCacheKey(empresaId), JSON.stringify(cache));
        setHasTerrainCache(true);
        setCacheUpdatedAt(cache.updated_at);
      } catch {
        setHasTerrainCache(false);
        setCacheUpdatedAt(null);
      }
    } catch (caught) {
      if (isNetworkFailure(caught)) restoreCachedData();
      else
        setError(
          "No fue posible cargar Partos. Intenta nuevamente en unos momentos.",
        );
    }
    setLoading(false);
  }, [empresaId]);
  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [isOnline, loadData]);

  const names = useMemo(
    () => new Map(animales.map((animal) => [animal.id, animal.nombre])),
    [animales],
  );
  const locallyPendingPartoIds = useMemo(
    () =>
      new Set(
        offlineItems
          .filter(
            (item) =>
              item.module === "haras_partos" &&
              item.action === HARAS_PARTO_ACTION &&
              isHarasPartoPayload(item.payload) &&
              item.payload.empresa_id === empresaId,
          )
          .map((item) =>
            isHarasPartoPayload(item.payload) ? item.payload.parto_id : "",
          ),
      ),
    [empresaId, offlineItems],
  );
  const mothers = useMemo(
    () =>
      [...animales].sort(
        (a, b) =>
          Number(!(a.sexo === "hembra" || a.categoria === "yegua")) -
          Number(!(b.sexo === "hembra" || b.categoria === "yegua")),
      ),
    [animales],
  );

  function newGestacion() {
    setEditingId(null);
    setGestacionForm(emptyGestacion);
    setShowGestacion(true);
    setError(null);
    setSuccess(null);
  }
  function editGestacion(parto: Parto) {
    setEditingId(parto.id);
    setGestacionForm({
      madre_id: parto.madre_id,
      padre_id: parto.padre_id ?? "",
      fecha_ultima_monta: parto.fecha_ultima_monta ?? "",
      fecha_probable_parto: parto.fecha_probable_parto ?? "",
      observaciones: parto.observaciones ?? "",
    });
    setShowGestacion(true);
    setSelected(null);
    setError(null);
  }
  function changeMonta(value: string) {
    setGestacionForm((current) => ({
      ...current,
      fecha_ultima_monta: value,
      fecha_probable_parto: value ? addDays(value, 340) : "",
    }));
  }
  async function saveGestacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!empresaId)
      return setError("Selecciona una empresa activa antes de guardar.");
    if (!gestacionForm.madre_id) return setError("La madre es obligatoria.");
    if (!gestacionForm.fecha_ultima_monta)
      return setError("La fecha de última monta es obligatoria.");
    if (gestacionForm.fecha_probable_parto <= gestacionForm.fecha_ultima_monta)
      return setError(
        "La fecha probable de parto debe ser posterior a la monta.",
      );
    setSaving(true);
    setError(null);
    const payload = {
      empresa_id: empresaId,
      madre_id: gestacionForm.madre_id,
      padre_id: gestacionForm.padre_id || null,
      fecha_ultima_monta: gestacionForm.fecha_ultima_monta,
      fecha_probable_parto: gestacionForm.fecha_probable_parto,
      fecha_probable: gestacionForm.fecha_probable_parto,
      observaciones: gestacionForm.observaciones.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const response = editingId
      ? await supabase
          .from("vet_partos")
          .update(payload)
          .eq("id", editingId)
          .eq("empresa_id", empresaId)
      : await supabase
          .from("vet_partos")
          .insert({ ...payload, estado_reproductivo: "en_gestacion" });
    if (response.error)
      setError(
        `No fue posible guardar la gestación: ${response.error.message}`,
      );
    else {
      setSuccess(
        editingId
          ? "Registro reproductivo actualizado."
          : "Gestación registrada correctamente.",
      );
      setShowGestacion(false);
      setEditingId(null);
      await loadData();
    }
    setSaving(false);
  }
  function openParto(parto: Parto) {
    setRegistering(parto);
    setSelected(null);
    setError(null);
    setPartoForm({
      ...emptyParto,
      fecha_parto_real: parto.fecha_parto_real ?? today(),
      nombre_cria: parto.nombre_cria ?? "",
      sexo_cria: parto.sexo_cria ?? "no_definido",
      peso_cria: parto.peso_cria?.toString() ?? "",
      peso_placenta: parto.peso_placenta?.toString() ?? "",
      observaciones: parto.observaciones ?? "",
      ...Object.fromEntries(
        timeFields.map(({ key }) => [key, parto[key]?.slice(0, 5) ?? ""]),
      ),
    } as PartoForm);
  }
  function savePartoLocally(
    parto: Parto,
    criaId: string | null = parto.cria_id,
  ) {
    if (!empresaId) return;
    const localId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const payload: HarasPartoPendingPayload = {
      ...partoForm,
      local_id: localId,
      empresa_id: empresaId,
      parto_id: parto.id,
      gestacion_id: parto.id,
      madre_id: parto.madre_id,
      padre_id: parto.padre_id,
      fecha_ultima_monta: parto.fecha_ultima_monta,
      nombre_cria: partoForm.nombre_cria.trim(),
      observaciones: partoForm.observaciones.trim(),
      cria_id_creada: criaId,
    };
    addPending({
      module: "haras_partos",
      action: HARAS_PARTO_ACTION,
      payload,
    });
    setRegistering(null);
    setSuccess(
      "Parto guardado localmente. Se sincronizará cuando vuelva la conexión.",
    );
  }
  async function saveParto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!empresaId || !registering)
      return setError("No hay una empresa o gestación seleccionada.");
    if (!partoForm.fecha_parto_real)
      return setError("La fecha real del parto es obligatoria.");
    if (
      registering.fecha_ultima_monta &&
      partoForm.fecha_parto_real < registering.fecha_ultima_monta
    )
      return setError("La fecha del parto no puede ser anterior a la monta.");
    if (
      Number(partoForm.peso_cria || 0) < 0 ||
      Number(partoForm.peso_placenta || 0) < 0
    )
      return setError("Los pesos no pueden ser negativos.");
    if (partoForm.crear_cria && !partoForm.nombre_cria.trim())
      return setError(
        "El nombre de la cría es obligatorio para crearla en el maestro.",
      );
    setSaving(true);
    setError(null);
    let criaId = registering.cria_id;
    if (!navigator.onLine) {
      savePartoLocally(registering, criaId);
      setSaving(false);
      return;
    }
    if (partoForm.crear_cria && !criaId) {
      let child;
      try {
        child = await supabase
          .from("vet_animales")
          .insert({
            empresa_id: empresaId,
            nombre: partoForm.nombre_cria.trim(),
            sexo:
              partoForm.sexo_cria === "no_definido"
                ? "desconocido"
                : partoForm.sexo_cria,
            fecha_nacimiento: partoForm.fecha_parto_real,
            madre_id: registering.madre_id,
            padre_id: registering.padre_id,
            categoria: "cria",
            estado: "activo",
          })
          .select("id")
          .single();
      } catch (caught) {
        if (isNetworkFailure(caught)) {
          savePartoLocally(registering);
          setSaving(false);
          return;
        }
        setError("No fue posible crear la cría.");
        setSaving(false);
        return;
      }
      if (child.error) {
        if (isNetworkFailure(child.error)) {
          savePartoLocally(registering);
          setSaving(false);
          return;
        }
        setError(`No fue posible crear la cría: ${child.error.message}`);
        setSaving(false);
        return;
      }
      criaId = child.data.id;
    }
    const realDays = registering.fecha_ultima_monta
      ? dateDiff(partoForm.fecha_parto_real, registering.fecha_ultima_monta)
      : null;
    const times = Object.fromEntries(
      timeFields.map(({ key }) => [key, partoForm[key] || null]),
    );
    let response;
    try {
      response = await supabase
        .from("vet_partos")
        .update({
          ...times,
          cria_id: criaId,
          fecha_parto_real: partoForm.fecha_parto_real,
          fecha_parto: `${partoForm.fecha_parto_real}T12:00:00`,
          dias_gestacion_real: realDays,
          estado_reproductivo: "parto_registrado",
          estado: "ocurrido",
          nombre_cria: partoForm.nombre_cria.trim() || null,
          sexo_cria: partoForm.sexo_cria,
          peso_cria:
            partoForm.peso_cria === "" ? null : Number(partoForm.peso_cria),
          peso_placenta:
            partoForm.peso_placenta === ""
              ? null
              : Number(partoForm.peso_placenta),
          observaciones: partoForm.observaciones.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registering.id)
        .eq("empresa_id", empresaId);
    } catch (caught) {
      if (isNetworkFailure(caught)) {
        savePartoLocally(registering, criaId);
      } else {
        setError("No fue posible registrar el parto.");
      }
      setSaving(false);
      return;
    }
    if (response.error && isNetworkFailure(response.error)) {
      savePartoLocally(registering, criaId);
    } else if (response.error)
      setError(`No fue posible registrar el parto: ${response.error.message}`);
    else {
      setSuccess("Parto y datos de nacimiento registrados.");
      setRegistering(null);
      await loadData();
    }
    setSaving(false);
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  return (
    <ModuleAccessGuard moduleKey="haras">
      <main className="min-h-full bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-5 rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.2em] text-rose-300">
                Tralixia Haras
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                Partos y nacimientos
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Gestaciones, fechas estimadas, nacimientos e historial
                reproductivo.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/haras"
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
              >
                Volver
              </Link>
              {isOnline && (
                <button
                  onClick={newGestacion}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-700"
                >
                  Nueva gestación
                </button>
              )}
            </div>
          </header>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
            >
              {error}
            </p>
          )}
          {success && (
            <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {success}
            </p>
          )}
          <OfflinePartoPanel
            empresaId={empresaId}
            hasCachedData={hasTerrainCache}
            cacheUpdatedAt={cacheUpdatedAt}
            onSynced={loadData}
          />
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-900">
                Historial reproductivo
              </h2>
              <p className="text-sm text-slate-500">
                Los estados próximos y atrasados se calculan a partir de la
                fecha probable.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      "Madre / padre",
                      "Última monta",
                      "Días desde monta",
                      "Parto probable",
                      "Días restantes",
                      "Parto real",
                      "Gestación real",
                      "Estado",
                      "Cría",
                      "Acciones",
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        Cargando calendario…
                      </td>
                    </tr>
                  ) : partos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        {isOffline && !hasTerrainCache
                          ? "No hay datos locales disponibles."
                          : "Aún no hay gestaciones pendientes."}
                      </td>
                    </tr>
                  ) : (
                    partos.map((parto) => {
                      const state = visualState(parto);
                      const elapsed = parto.fecha_ultima_monta
                        ? dateDiff(today(), parto.fecha_ultima_monta)
                        : null;
                      const remaining = parto.fecha_probable_parto
                        ? dateDiff(parto.fecha_probable_parto, today())
                        : null;
                      return (
                        <tr key={parto.id} className="text-slate-700">
                          <td className="px-4 py-3">
                            <strong className="block text-slate-900">
                              {names.get(parto.madre_id) ??
                                "Ejemplar no disponible"}
                            </strong>
                            <span className="text-xs text-slate-500">
                              {parto.padre_id
                                ? (names.get(parto.padre_id) ??
                                  "Padre no disponible")
                                : "Sin padre registrado"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {formatDate(parto.fecha_ultima_monta)}
                          </td>
                          <td className="px-4 py-3">
                            {parto.fecha_parto_real || elapsed === null
                              ? "—"
                              : `${elapsed} días`}
                          </td>
                          <td className="px-4 py-3">
                            {formatDate(parto.fecha_probable_parto)}
                          </td>
                          <td className="px-4 py-3">
                            {parto.fecha_parto_real || remaining === null
                              ? "—"
                              : remaining < 0
                                ? `${Math.abs(remaining)} días tarde`
                                : `${remaining} días`}
                          </td>
                          <td className="px-4 py-3">
                            {formatDate(parto.fecha_parto_real)}
                          </td>
                          <td className="px-4 py-3">
                            {parto.dias_gestacion_real === null
                              ? "—"
                              : `${parto.dias_gestacion_real} días`}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses[state]}`}
                            >
                              {estadoLabels[state]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {parto.nombre_cria ||
                              (parto.cria_id
                                ? names.get(parto.cria_id)
                                : null) ||
                              "—"}
                            <span className="block text-xs text-slate-500">
                              {parto.sexo_cria
                                ? parto.sexo_cria.replace("_", " ")
                                : ""}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setSelected(parto)}
                                className="font-semibold text-sky-700 hover:underline"
                              >
                                Detalle
                              </button>
                              {!parto.fecha_parto_real &&
                                !locallyPendingPartoIds.has(parto.id) && (
                                  <button
                                    onClick={() => openParto(parto)}
                                    className="font-semibold text-emerald-700 hover:underline"
                                  >
                                    Registrar parto
                                  </button>
                                )}
                              {locallyPendingPartoIds.has(parto.id) && (
                                <span className="font-semibold text-amber-700">
                                  Pendiente local
                                </span>
                              )}
                              {isOnline && (
                                <button
                                  onClick={() => editGestacion(parto)}
                                  className="font-semibold text-slate-700 hover:underline"
                                >
                                  Editar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {showGestacion && (
            <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-8">
              <form
                onSubmit={saveGestacion}
                className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {editingId
                      ? "Editar registro reproductivo"
                      : "Nueva gestación"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowGestacion(false)}
                    className="text-slate-500"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Madre *
                    <select
                      required
                      value={gestacionForm.madre_id}
                      onChange={(e) =>
                        setGestacionForm({
                          ...gestacionForm,
                          madre_id: e.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Seleccionar yegua</option>
                      {mothers.map((animal) => (
                        <option key={animal.id} value={animal.id}>
                          {animal.nombre} · {animal.categoria}
                          {animal.sexo === "hembra"
                            ? ""
                            : " (dato sexual incompleto)"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Padre
                    <select
                      value={gestacionForm.padre_id}
                      onChange={(e) =>
                        setGestacionForm({
                          ...gestacionForm,
                          padre_id: e.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Sin padre</option>
                      {animales.map((animal) => (
                        <option key={animal.id} value={animal.id}>
                          {animal.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Fecha última monta *
                    <input
                      required
                      type="date"
                      value={gestacionForm.fecha_ultima_monta}
                      onChange={(e) => changeMonta(e.target.value)}
                      className={inputClass}
                    />
                    {gestacionForm.fecha_ultima_monta > today() && (
                      <span className="mt-1 block text-xs text-amber-700">
                        Advertencia: la fecha indicada está en el futuro.
                      </span>
                    )}
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Fecha probable de parto *
                    <input
                      required
                      type="date"
                      value={gestacionForm.fecha_probable_parto}
                      min={
                        gestacionForm.fecha_ultima_monta
                          ? addDays(gestacionForm.fecha_ultima_monta, 1)
                          : undefined
                      }
                      onChange={(e) =>
                        setGestacionForm({
                          ...gestacionForm,
                          fecha_probable_parto: e.target.value,
                        })
                      }
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      Calculada a 340 días; puedes ajustarla.
                    </span>
                  </label>
                  <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                    Observaciones
                    <textarea
                      value={gestacionForm.observaciones}
                      onChange={(e) =>
                        setGestacionForm({
                          ...gestacionForm,
                          observaciones: e.target.value,
                        })
                      }
                      rows={3}
                      className={inputClass}
                    />
                  </label>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGestacion(false)}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={saving}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Guardando…" : "Guardar gestación"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {registering && (
            <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-8">
              <form
                onSubmit={saveParto}
                className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Registrar parto
                    </h2>
                    <p className="text-sm text-slate-500">
                      Madre: {names.get(registering.madre_id)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRegistering(null)}
                    className="text-slate-500"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-sm font-medium text-slate-700">
                    Fecha parto real *
                    <input
                      required
                      type="date"
                      value={partoForm.fecha_parto_real}
                      min={registering.fecha_ultima_monta ?? undefined}
                      onChange={(e) =>
                        setPartoForm({
                          ...partoForm,
                          fecha_parto_real: e.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Nombre cría
                    <input
                      value={partoForm.nombre_cria}
                      onChange={(e) =>
                        setPartoForm({
                          ...partoForm,
                          nombre_cria: e.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Sexo cría
                    <select
                      value={partoForm.sexo_cria}
                      onChange={(e) =>
                        setPartoForm({
                          ...partoForm,
                          sexo_cria: e.target.value as PartoForm["sexo_cria"],
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
                      value={partoForm.peso_cria}
                      onChange={(e) =>
                        setPartoForm({
                          ...partoForm,
                          peso_cria: e.target.value,
                        })
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
                      value={partoForm.peso_placenta}
                      onChange={(e) =>
                        setPartoForm({
                          ...partoForm,
                          peso_placenta: e.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                  {timeFields.map(({ key, label }) => (
                    <label
                      key={key}
                      className="text-sm font-medium text-slate-700"
                    >
                      {label}
                      <input
                        type="time"
                        value={String(partoForm[key])}
                        onChange={(e) =>
                          setPartoForm({ ...partoForm, [key]: e.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                  ))}
                  <label className="sm:col-span-2 lg:col-span-3 text-sm font-medium text-slate-700">
                    Observaciones
                    <textarea
                      rows={3}
                      value={partoForm.observaciones}
                      onChange={(e) =>
                        setPartoForm({
                          ...partoForm,
                          observaciones: e.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                    <input
                      type="checkbox"
                      checked={partoForm.crear_cria}
                      disabled={Boolean(registering.cria_id)}
                      onChange={(e) =>
                        setPartoForm({
                          ...partoForm,
                          crear_cria: e.target.checked,
                        })
                      }
                      className="h-4 w-4"
                    />
                    Crear cría en maestro de animales
                  </label>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setRegistering(null)}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={saving}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Guardando…" : "Registrar parto"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {selected && (
            <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/50">
              <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      Detalle reproductivo
                    </p>
                    <h2 className="text-2xl font-semibold text-slate-900">
                      {names.get(selected.madre_id)}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-slate-500"
                  >
                    Cerrar
                  </button>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  {[
                    [
                      "Padre",
                      selected.padre_id
                        ? (names.get(selected.padre_id) ?? "No disponible")
                        : "No registrado",
                    ],
                    ["Última monta", formatDate(selected.fecha_ultima_monta)],
                    [
                      "Días desde monta",
                      selected.fecha_ultima_monta
                        ? `${dateDiff(selected.fecha_parto_real ?? today(), selected.fecha_ultima_monta)} días`
                        : "Sin fecha de monta",
                    ],
                    [
                      "Parto probable",
                      formatDate(selected.fecha_probable_parto),
                    ],
                    ["Parto real", formatDate(selected.fecha_parto_real)],
                    [
                      "Gestación real",
                      selected.dias_gestacion_real === null
                        ? "—"
                        : `${selected.dias_gestacion_real} días`,
                    ],
                    ["Cría", selected.nombre_cria ?? "—"],
                    ["Sexo", selected.sexo_cria?.replace("_", " ") ?? "—"],
                    [
                      "Peso cría",
                      selected.peso_cria === null
                        ? "—"
                        : `${selected.peso_cria} kg`,
                    ],
                    [
                      "Peso placenta",
                      selected.peso_placenta === null
                        ? "—"
                        : `${selected.peso_placenta} kg`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 p-3">
                      <dt className="text-xs font-semibold uppercase text-slate-500">
                        {label}
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <h3 className="mt-7 font-semibold text-slate-900">
                  Tiempos críticos
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  {timeFields.map(({ key, label }) => (
                    <div key={key} className="border-b pb-2">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-semibold text-slate-900">
                        {formatTime(selected[key])}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-7 rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">
                    Observaciones
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {selected.observaciones || "Sin observaciones."}
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </ModuleAccessGuard>
  );
}
