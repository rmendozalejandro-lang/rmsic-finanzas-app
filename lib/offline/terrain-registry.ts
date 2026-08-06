export const TERRAIN_CONTEXT_KEY = "tralixia_terrain_context_v1";
export const TERRAIN_REGISTRY_PREFIX = "tralixia_terrain_registry_v1";
export const HARAS_PARTOS_ROUTE = "/haras/partos";
export const HARAS_PARTOS_MODULE = "haras_partos";
export const OT_ROUTE = "/ot";
export const OT_MODULE = "ot";

export type PreparedTerrainModule = {
  module: typeof HARAS_PARTOS_MODULE | typeof OT_MODULE;
  route: typeof HARAS_PARTOS_ROUTE | typeof OT_ROUTE;
  preparedAt: string;
};

export type TerrainRegistry = {
  empresaId: string;
  userId: string;
  modules: PreparedTerrainModule[];
  lastSafeRoute: string | null;
  lastModule: typeof HARAS_PARTOS_MODULE | typeof OT_MODULE | null;
  preparedAt: string;
};

type TerrainContext = { empresaId: string; userId: string };

export function terrainRegistryKey(empresaId: string, userId: string) {
  return `${TERRAIN_REGISTRY_PREFIX}_${empresaId}_${userId}`;
}

export function readTerrainRegistry(
  empresaId: string,
  userId: string,
): TerrainRegistry | null {
  try {
    const raw = window.localStorage.getItem(
      terrainRegistryKey(empresaId, userId),
    );
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<TerrainRegistry>;
    if (
      value.empresaId !== empresaId ||
      value.userId !== userId ||
      !Array.isArray(value.modules)
    )
      return null;
    return value as TerrainRegistry;
  } catch {
    return null;
  }
}

export function readCurrentTerrainRegistry(): TerrainRegistry | null {
  try {
    const raw = window.localStorage.getItem(TERRAIN_CONTEXT_KEY);
    if (!raw) return null;
    const context = JSON.parse(raw) as Partial<TerrainContext>;
    if (!context.empresaId || !context.userId) return null;
    return readTerrainRegistry(context.empresaId, context.userId);
  } catch {
    return null;
  }
}

export function prepareHarasPartosRegistry(empresaId: string, userId: string) {
  const preparedAt = new Date().toISOString();
  const registry: TerrainRegistry = {
    empresaId,
    userId,
    modules: [
      {
        module: HARAS_PARTOS_MODULE,
        route: HARAS_PARTOS_ROUTE,
        preparedAt,
      },
    ],
    lastSafeRoute: HARAS_PARTOS_ROUTE,
    lastModule: HARAS_PARTOS_MODULE,
    preparedAt,
  };
  window.localStorage.setItem(
    terrainRegistryKey(empresaId, userId),
    JSON.stringify(registry),
  );
  window.localStorage.setItem(
    TERRAIN_CONTEXT_KEY,
    JSON.stringify({ empresaId, userId } satisfies TerrainContext),
  );
  window.dispatchEvent(new Event("tralixia-terrain-registry-changed"));
  return registry;
}

export function upsertTerrainModule(
  empresaId: string,
  userId: string,
  module: PreparedTerrainModule["module"],
  route: PreparedTerrainModule["route"],
) {
  const preparedAt = new Date().toISOString();
  const current = readTerrainRegistry(empresaId, userId);
  const modules = [
    ...(current?.modules.filter((item) => item.module !== module) ?? []),
    { module, route, preparedAt },
  ];
  const registry: TerrainRegistry = {
    empresaId,
    userId,
    modules,
    lastSafeRoute: route,
    lastModule: module,
    preparedAt,
  };

  window.localStorage.setItem(
    terrainRegistryKey(empresaId, userId),
    JSON.stringify(registry),
  );
  window.localStorage.setItem(
    TERRAIN_CONTEXT_KEY,
    JSON.stringify({ empresaId, userId } satisfies TerrainContext),
  );
  window.dispatchEvent(new Event("tralixia-terrain-registry-changed"));
  return registry;
}

export function markHarasPartosUsed(empresaId: string, userId: string) {
  const registry = readTerrainRegistry(empresaId, userId);
  if (!registry) return;
  window.localStorage.setItem(
    terrainRegistryKey(empresaId, userId),
    JSON.stringify({
      ...registry,
      lastSafeRoute: HARAS_PARTOS_ROUTE,
      lastModule: HARAS_PARTOS_MODULE,
    }),
  );
}
