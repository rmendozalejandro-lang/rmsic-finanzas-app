import type { SupabaseClient } from '@supabase/supabase-js'

export type EstadoPreparacionSync = {
  disponible: boolean
  tablas_ok: string[]
  tablas_faltantes: string[]
  errores: Array<{ tabla: string; mensaje: string }>
}

const TABLAS_REQUERIDAS = [
  'asistente_casos',
  'asistente_caso_ots',
  'asistente_sesiones',
  'asistente_eventos',
] as const

function esTablaInexistente(mensaje: string) {
  const m = mensaje.toLowerCase()
  return (
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    m.includes('relation') && m.includes('does not exist')
  )
}

/**
 * Verificacion no destructiva previa a sincronizar OT Viva.
 *
 * Solo realiza SELECT de id con limit 1. No inserta, modifica ni elimina datos.
 * Su objetivo es impedir que la UI intente sincronizar mientras el nucleo
 * asistente_* aun no exista en la base de datos seleccionada.
 */
export async function verificarPreparacionSyncAsistente(
  supabase: SupabaseClient,
): Promise<EstadoPreparacionSync> {
  const tablas_ok: string[] = []
  const tablas_faltantes: string[] = []
  const errores: Array<{ tabla: string; mensaje: string }> = []

  for (const tabla of TABLAS_REQUERIDAS) {
    const { error } = await supabase
      .from(tabla)
      .select('id')
      .limit(1)

    if (!error) {
      tablas_ok.push(tabla)
      continue
    }

    if (esTablaInexistente(error.message)) {
      tablas_faltantes.push(tabla)
      continue
    }

    errores.push({ tabla, mensaje: error.message })
  }

  return {
    disponible: tablas_faltantes.length === 0 && errores.length === 0,
    tablas_ok,
    tablas_faltantes,
    errores,
  }
}

export function descripcionPreparacionSync(estado: EstadoPreparacionSync) {
  if (estado.disponible) {
    return 'Núcleo Asistente Tralixia disponible para sincronización.'
  }

  if (estado.tablas_faltantes.length > 0) {
    return `Sincronización bloqueada: faltan ${estado.tablas_faltantes.length} tablas del núcleo asistente_*.`
  }

  if (estado.errores.length > 0) {
    return 'Sincronización bloqueada: no fue posible validar permisos o acceso al núcleo asistente_*.'
  }

  return 'Sincronización no disponible.'
}
