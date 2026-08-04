const CONTEXT_KEY = "tralixia_terrain_context_v1";
const REGISTRY_PREFIX = "tralixia_terrain_registry_v1";
const PARTOS_MODULE = "haras_partos";
const PARTOS_ROUTE = "/haras/partos";

function readPreparedRoute() {
  try {
    const context = JSON.parse(localStorage.getItem(CONTEXT_KEY) || "null");
    if (!context?.empresaId || !context?.userId) return null;
    const registryKey = `${REGISTRY_PREFIX}_${context.empresaId}_${context.userId}`;
    const registry = JSON.parse(localStorage.getItem(registryKey) || "null");
    const hasPartos =
      registry?.empresaId === context.empresaId &&
      registry?.userId === context.userId &&
      registry?.modules?.some(
        (module) =>
          module.module === PARTOS_MODULE && module.route === PARTOS_ROUTE,
      );
    const cache = JSON.parse(
      localStorage.getItem(
        `tralixia_haras_partos_cache_${context.empresaId}`,
      ) || "null",
    );
    if (!hasPartos || cache?.empresa_id !== context.empresaId) return null;
    return registry.lastSafeRoute === PARTOS_ROUTE
      ? registry.lastSafeRoute
      : PARTOS_ROUTE;
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
      : "Volver al último trabajo offline";
  terrainLink.hidden = false;
} else {
  noModules.hidden = false;
}

document
  .querySelector("#retry-button")
  .addEventListener("click", retryConnection);
window.addEventListener("online", retryConnection);
