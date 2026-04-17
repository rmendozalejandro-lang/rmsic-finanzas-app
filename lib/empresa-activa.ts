import "server-only";
import { getEmpresaActivaForUser } from "@/lib/auth/getEmpresaActivaForUser";

export async function getEmpresaActivaId(): Promise<string | null> {
  const empresaActiva = await getEmpresaActivaForUser();
  return empresaActiva?.id ?? null;
}

export async function getEmpresaActiva() {
  return getEmpresaActivaForUser();
}