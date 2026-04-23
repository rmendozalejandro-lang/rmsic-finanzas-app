import type { OTResumen } from './types'

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (
        column: string,
        options?: { ascending?: boolean }
      ) => Promise<{ data: OTResumen[] | null; error: { message: string } | null }>
    }
  }
}

export async function getOTResumenList(
  supabase: SupabaseLike
): Promise<OTResumen[]> {
  const { data, error } = await supabase
    .from('ot_vw_resumen')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Error al cargar OT: ${error.message}`)
  }

  return data ?? []
}