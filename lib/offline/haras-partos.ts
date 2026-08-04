export type HarasPartoPendingPayload = {
  local_id: string;
  empresa_id: string;
  parto_id: string;
  gestacion_id: string;
  madre_id: string;
  padre_id: string | null;
  fecha_ultima_monta: string | null;
  fecha_parto_real: string;
  nombre_cria: string;
  sexo_cria: "macho" | "hembra" | "no_definido";
  peso_cria: string;
  peso_placenta: string;
  observaciones: string;
  crear_cria: boolean;
  cria_id_creada: string | null;
  hora_inicio_parto: string;
  hora_expulsion_cria: string;
  hora_parada_yegua: string;
  hora_corte_cordon: string;
  hora_parada_potrillo: string;
  hora_expulsion_placenta: string;
  hora_primera_mamada: string;
};

export const HARAS_PARTO_ACTION = "registrar_parto";

export function isHarasPartoPayload(
  value: unknown,
): value is HarasPartoPendingPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<HarasPartoPendingPayload>;
  return Boolean(
    payload.local_id &&
    payload.empresa_id &&
    payload.parto_id &&
    payload.madre_id &&
    payload.fecha_parto_real,
  );
}

export function isNetworkFailure(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|fetch failed|network|networkerror|load failed|conexi[oó]n/i.test(
    message,
  );
}
