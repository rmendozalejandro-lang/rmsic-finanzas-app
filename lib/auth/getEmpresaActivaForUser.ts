import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type EmpresaActiva = {
  id: string;
  nombre: string | null;
  rut: string | null;
};

const COOKIE_ID_CANDIDATES = [
  "empresa_activa_id",
  "empresaActivaId",
  "empresa_id",
  "activeEmpresaId",
];

const COOKIE_NAME_CANDIDATES = [
  "empresa_activa_nombre",
  "empresaActivaNombre",
  "empresa_nombre",
  "activeEmpresaName",
];

export async function getEmpresaActivaForUser(): Promise<EmpresaActiva | null> {
  const cookieStore = await cookies();
  const supabase = await createClient();

  const empresaId =
    COOKIE_ID_CANDIDATES.map((name) => cookieStore.get(name)?.value).find(Boolean) ?? null;

  const empresaNombreRaw =
    COOKIE_NAME_CANDIDATES.map((name) => cookieStore.get(name)?.value).find(Boolean) ?? null;

  const empresaNombre = empresaNombreRaw ? decodeURIComponent(empresaNombreRaw) : null;

  if (empresaId) {
    const { data: empresaPorId } = await supabase
      .from("empresas")
      .select("id, nombre, rut")
      .eq("id", empresaId)
      .maybeSingle();

    if (empresaPorId) return empresaPorId;
  }

  if (empresaNombre) {
    const { data: empresaPorNombre } = await supabase
      .from("empresas")
      .select("id, nombre, rut")
      .ilike("nombre", empresaNombre)
      .maybeSingle();

    if (empresaPorNombre) return empresaPorNombre;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: relacion } = await supabase
    .from("usuario_empresas")
    .select("empresa_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!relacion?.empresa_id) return null;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nombre, rut")
    .eq("id", relacion.empresa_id)
    .maybeSingle();

  return empresa ?? null;
}