import { createClient } from '@/lib/supabase/server'
import { empresaTieneInformesTecnicos } from './config'

export async function getInformesTecnicos(empresaId: string) {
  if (!empresaTieneInformesTecnicos(empresaId)) {
    return []
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('informes_tecnicos')
    .select(`
      id,
      codigo,
      titulo,
      tipo_informe,
      subtipo_informe,
      estado,
      fecha_informe,
      version,
      cliente_id,
      ot_id,
      created_at
    `)
    .eq('empresa_id', empresaId)
    .order('fecha_informe', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error cargando informes técnicos:', error)
    return []
  }

  return data ?? []
}

export async function getInformeTecnicoById(id: string, empresaId: string) {
  if (!empresaTieneInformesTecnicos(empresaId)) {
    return null
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('informes_tecnicos')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .single()

  if (error) {
    console.error('Error cargando informe técnico:', error)
    return null
  }

  return data
}