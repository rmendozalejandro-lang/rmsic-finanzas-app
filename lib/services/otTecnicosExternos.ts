import { supabase } from "@/lib/supabase/client";

export type OtTecnicoExterno = {
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
  created_at: string;
  updated_at: string;
};

export type CrearOtTecnicoExternoInput = {
  empresa_id: string;
  nombre_completo: string;
  rut: string;
  cargo: string;
  especialidad?: string | null;
  telefono?: string | null;
  email?: string | null;
  empresa_origen?: string;
};

export async function listarTecnicosExternosActivos() {
  
  const { data, error } = await supabase
    .from("ot_tecnicos_externos")
    .select("*")
    .eq("activo", true)
    .order("nombre_completo");

  if (error) {
    throw new Error(error.message);
  }

  return data as OtTecnicoExterno[];
}

export async function listarTecnicosExternos() {
 

  const { data, error } = await supabase
    .from("ot_tecnicos_externos")
    .select("*")
    .order("nombre_completo");

  if (error) {
    throw new Error(error.message);
  }

  return data as OtTecnicoExterno[];
}

export async function crearTecnicoExterno(input: CrearOtTecnicoExternoInput) {
  

  const { data, error } = await supabase
    .from("ot_tecnicos_externos")
    .insert({
      empresa_id: input.empresa_id,
      nombre_completo: input.nombre_completo.trim(),
      rut: input.rut.trim(),
      cargo: input.cargo.trim(),
      especialidad: input.especialidad?.trim() || null,
      telefono: input.telefono?.trim() || null,
      email: input.email?.trim() || null,
      empresa_origen: input.empresa_origen || "DyF",
      activo: true,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OtTecnicoExterno;
}

export async function actualizarTecnicoExterno(
  id: string,
  input: Partial<CrearOtTecnicoExternoInput> & { activo?: boolean }
) {
  

  const { data, error } = await supabase
    .from("ot_tecnicos_externos")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OtTecnicoExterno;
}

export async function inactivarTecnicoExterno(id: string) {
  return actualizarTecnicoExterno(id, { activo: false });
}

export async function activarTecnicoExterno(id: string) {
  return actualizarTecnicoExterno(id, { activo: true });
}