"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import {
  HARAS_PARTO_ACTION,
  isHarasPartoPayload,
  type HarasPartoPendingPayload,
} from "@/lib/offline/haras-partos";
import { supabase } from "@/lib/supabase/client";

type LegacyPending = HarasPartoPendingPayload & {
  sync_status?: "pendiente" | "sincronizando" | "error";
  sync_error?: string | null;
  created_at_local?: string;
};

const timeFields: (keyof Pick<
  HarasPartoPendingPayload,
  | "hora_inicio_parto"
  | "hora_expulsion_cria"
  | "hora_parada_yegua"
  | "hora_corte_cordon"
  | "hora_parada_potrillo"
  | "hora_expulsion_placenta"
  | "hora_primera_mamada"
>)[] = [
  "hora_inicio_parto",
  "hora_expulsion_cria",
  "hora_parada_yegua",
  "hora_corte_cordon",
  "hora_parada_potrillo",
  "hora_expulsion_placenta",
  "hora_primera_mamada",
];

function legacyPendingKey(empresaId: string) {
  return `tralixia_haras_partos_pendientes_${empresaId}`;
}

export default function OfflinePartoPanel({
  empresaId,
  onSynced,
}: {
  empresaId: string | null;
  onSynced: () => Promise<void>;
}) {
  const { isOnline, isOffline } = useNetworkStatus();
  const { items, addPending, removePending, updatePending } = useOfflineQueue();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoSyncAttempted = useRef(false);
  const pending = useMemo(
    () =>
      items.filter(
        (item) =>
          item.module === "haras_partos" &&
          item.action === HARAS_PARTO_ACTION &&
          isHarasPartoPayload(item.payload) &&
          (!empresaId || item.payload.empresa_id === empresaId),
      ),
    [empresaId, items],
  );

  useEffect(() => {
    if (!empresaId) return;
    const key = legacyPendingKey(empresaId);
    try {
      const raw = localStorage.getItem(key);
      const legacy: LegacyPending[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(legacy) || legacy.length === 0) return;
      const existingIds = new Set(
        items
          .filter((item) => item.module === "haras_partos")
          .map((item) =>
            isHarasPartoPayload(item.payload) ? item.payload.local_id : "",
          ),
      );
      legacy.filter(isHarasPartoPayload).forEach((candidate) => {
        const payload = candidate as LegacyPending;
        if (!existingIds.has(payload.local_id))
          addPending({
            module: "haras_partos",
            action: HARAS_PARTO_ACTION,
            payload,
            error:
              payload.sync_status === "error"
                ? (payload.sync_error ?? undefined)
                : undefined,
          });
      });
      localStorage.removeItem(key);
    } catch {
      setMessage(
        "No se pudieron incorporar algunos pendientes anteriores. Se conservaron en este dispositivo.",
      );
    }
  }, [addPending, empresaId, items]);

  const syncOne = useCallback(
    async (id: string, payload: HarasPartoPendingPayload) => {
      updatePending(id, { status: "sincronizando", error: undefined });
      try {
        let criaId = payload.cria_id_creada;
        if (payload.crear_cria && payload.nombre_cria && !criaId) {
          const child = await supabase
            .from("vet_animales")
            .insert({
              empresa_id: payload.empresa_id,
              nombre: payload.nombre_cria,
              sexo:
                payload.sexo_cria === "no_definido"
                  ? "desconocido"
                  : payload.sexo_cria,
              fecha_nacimiento: payload.fecha_parto_real,
              madre_id: payload.madre_id,
              padre_id: payload.padre_id,
              categoria: "cria",
              estado: "activo",
            })
            .select("id")
            .single();
          if (child.error) throw new Error(child.error.message);
          criaId = child.data.id;
          payload = { ...payload, cria_id_creada: criaId };
          updatePending(id, { payload, status: "sincronizando" });
        }
        const realDays = payload.fecha_ultima_monta
          ? Math.round(
              (new Date(`${payload.fecha_parto_real}T00:00:00`).getTime() -
                new Date(`${payload.fecha_ultima_monta}T00:00:00`).getTime()) /
                86_400_000,
            )
          : null;
        const times = Object.fromEntries(
          timeFields.map((key) => [key, payload[key] || null]),
        );
        const response = await supabase
          .from("vet_partos")
          .update({
            ...times,
            ...(criaId ? { cria_id: criaId } : {}),
            fecha_parto_real: payload.fecha_parto_real,
            fecha_parto: `${payload.fecha_parto_real}T12:00:00`,
            dias_gestacion_real: realDays,
            estado_reproductivo: "parto_registrado",
            estado: "ocurrido",
            nombre_cria: payload.nombre_cria || null,
            sexo_cria: payload.sexo_cria,
            peso_cria:
              payload.peso_cria === "" ? null : Number(payload.peso_cria),
            peso_placenta:
              payload.peso_placenta === ""
                ? null
                : Number(payload.peso_placenta),
            observaciones: payload.observaciones || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.parto_id)
          .eq("empresa_id", payload.empresa_id);
        if (response.error) throw new Error(response.error.message);
        removePending(id);
        return true;
      } catch (error) {
        updatePending(id, {
          status: "error",
          error:
            error instanceof Error ? error.message : "No se pudo sincronizar.",
        });
        return false;
      }
    },
    [removePending, updatePending],
  );

  const syncAll = useCallback(async () => {
    if (!isOnline || syncing || pending.length === 0) return;
    setSyncing(true);
    setMessage(null);
    let allSucceeded = true;
    for (const item of pending) {
      if (isHarasPartoPayload(item.payload)) {
        allSucceeded = (await syncOne(item.id, item.payload)) && allSucceeded;
      }
    }
    setMessage(
      allSucceeded
        ? "Partos sincronizados correctamente."
        : "Algunos partos no pudieron sincronizarse. Siguen guardados en este dispositivo.",
    );
    if (allSucceeded) await onSynced();
    setSyncing(false);
  }, [isOnline, onSynced, pending, syncOne, syncing]);

  useEffect(() => {
    if (isOffline) autoSyncAttempted.current = false;
    if (isOnline && pending.length > 0 && !autoSyncAttempted.current) {
      autoSyncAttempted.current = true;
      void syncAll();
    }
  }, [isOffline, isOnline, pending.length, syncAll]);

  const hasErrors = pending.some((item) => item.status === "error");
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className={`text-sm font-bold ${isOffline ? "text-amber-700" : "text-emerald-700"}`}
          >
            {isOffline ? "Sin conexión" : "Con conexión"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {pending.length}{" "}
            {pending.length === 1 ? "parto pendiente" : "partos pendientes"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {syncing
              ? "Sincronizando…"
              : hasErrors
                ? "Error al sincronizar. Tus datos siguen guardados."
                : isOffline
                  ? "Puedes registrar partos; se guardarán en este dispositivo."
                  : pending.length
                    ? "Se sincronizarán automáticamente o cuando tú lo indiques."
                    : "Todo está sincronizado."}
          </p>
        </div>
        {isOnline && pending.length > 0 && (
          <button
            disabled={syncing}
            onClick={() => void syncAll()}
            className="min-h-11 rounded-xl bg-sky-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {syncing ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
        )}
      </div>
      {message && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-800"
        >
          {message}
        </p>
      )}
    </section>
  );
}
