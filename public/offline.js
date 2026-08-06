const CONTEXT_KEY = "tralixia_terrain_context_v1";
const REGISTRY_PREFIX = "tralixia_terrain_registry_v1";
const PARTOS_MODULE = "haras_partos";
const PARTOS_ROUTE = "/haras/partos";
const OT_MODULE = "ot";
const OT_ROUTE = "/ot";
const OT_CACHE_SCHEMA_VERSION = 2;
const OT_CACHE_PREFIX = "tralixia_ot_offline_cache_v2";

function hasPreparedPartos(context, registry) {
  const hasModule = registry?.modules?.some(
    (module) =>
      module.module === PARTOS_MODULE && module.route === PARTOS_ROUTE,
  );
  const cache = JSON.parse(
    localStorage.getItem(`tralixia_haras_partos_cache_${context.empresaId}`) ||
      "null",
  );
  return hasModule && cache?.empresa_id === context.empresaId;
}

function readPreparedOt(context, registry) {
  const hasModule = registry?.modules?.some(
    (module) => module.module === OT_MODULE && module.route === OT_ROUTE,
  );
  const cache = JSON.parse(
    localStorage.getItem(
      `${OT_CACHE_PREFIX}_${context.empresaId}_${context.userId}`,
    ) || "null",
  );
  if (
    !hasModule ||
    cache?.schema_version !== OT_CACHE_SCHEMA_VERSION ||
    cache?.empresa_id !== context.empresaId ||
    cache?.user_id !== context.userId ||
    !Array.isArray(cache.ots) ||
    !Array.isArray(cache.detalles)
  ) {
    return null;
  }

  const detailIds = new Set(
    cache.detalles.map((detail) => String(detail?.id || "")).filter(Boolean),
  );
  const preparedIds = new Set(
    cache.ots
      .map((ot) => String(ot?.id || ""))
      .filter((id) => id && detailIds.has(id)),
  );
  return preparedIds.size > 0 ? preparedIds : null;
}

function isPreparedRoute(route, hasPartos, preparedOtIds) {
  if (route === PARTOS_ROUTE) return hasPartos;
  if (route === OT_ROUTE) return Boolean(preparedOtIds);
  const otDetailMatch = /^\/ot\/([^/]+)$/.exec(route || "");
  return Boolean(otDetailMatch && preparedOtIds?.has(otDetailMatch[1]));
}

function readPreparedRoute() {
  try {
    const context = JSON.parse(localStorage.getItem(CONTEXT_KEY) || "null");
    if (!context?.empresaId || !context?.userId) return null;
    const registryKey = `${REGISTRY_PREFIX}_${context.empresaId}_${context.userId}`;
    const registry = JSON.parse(localStorage.getItem(registryKey) || "null");
    const validRegistry =
      registry?.empresaId === context.empresaId &&
      registry?.userId === context.userId;
    if (!validRegistry) return null;

    const hasPartos = hasPreparedPartos(context, registry);
    const preparedOtIds = readPreparedOt(context, registry);
    if (isPreparedRoute(registry.lastSafeRoute, hasPartos, preparedOtIds)) {
      return registry.lastSafeRoute;
    }
    if (preparedOtIds) return OT_ROUTE;
    if (hasPartos) return PARTOS_ROUTE;
    return null;
  } catch {
    return null;
  }
}

function retryConnection() {
  window.location.reload();
}

const preparedRoute = readPreparedRoute();
const terrainLink = document.querySelector("#terrain-link");
const noModules = document.querySelector("#no-modules");
if (preparedRoute) {
  terrainLink.href = preparedRoute;
  terrainLink.textContent =
    preparedRoute === PARTOS_ROUTE
      ? "Volver a Partos"
      : preparedRoute === OT_ROUTE
        ? "Volver a OT"
        : "Volver al último trabajo offline";
  terrainLink.hidden = false;
} else {
  noModules.hidden = false;
}

document
  .querySelector("#retry-button")
  .addEventListener("click", retryConnection);
window.addEventListener("online", retryConnection);
