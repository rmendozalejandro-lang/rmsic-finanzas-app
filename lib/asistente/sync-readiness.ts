import type { SupabaseClient } from '@supabase/supabase-js'

export type EstadoPreparacionSync = {
  disponible: boolean
  tablas_ok: string[]
  tablas_faltantes: string[]
  errores: Array<{ tabla: string; mensaje: string }>
}

const REQUISITOS_SYNC = [
  { tabla: 'asistente_casos', columnas: 'id, origen_externo, clave_externa' },
  { tabla: 'asistente_caso_ots', columnas: 'id' },
  { tabla: 'asistente_sesiones', columnas: 'id, origen_externo, clave_externa' },
  { tabla: 'asistente_eventos', columnas: 'id, origen_externo, clave_externa' },
  { tabla: 'asistente_evento_relaciones', columnas: 'id' },
] as const

function esTablaInexistente(mensaje: string) {
  const m = mensaje.toLowerCase()
  return (
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    (m.includes('relation') && m.includes('does not exist'))
  )
}

/**
 * Verificacion no destructiva previa a sincronizar OT Viva.
 *
 * Solo realiza SELECT con limit 1. No inserta, modifica ni elimina datos.
 * Ademas de las tablas base, valida las columnas de idempotencia usadas por
 * los upsert para impedir que la UI habilite sincronizacion con un esquema
 * parcialmente migrado.
 */
export async function verificarPreparacionSyncAsistente(
  supabase: SupabaseClient,
): Promise<EstadoPreparacionSync> {
  const tablas_ok: string[] = []
  const tablas_faltantes: string[] = []
  const errores: Array<{ tabla: string; mensaje: string }> = []

  for (const requisito of REQUISITOS_SYNC) {
    const { error } = await supabase
      .from(requisito.tabla)
      .select(requisito.columnas)
      .limit(1)

    if (!error) {
      tablas_ok.push(requisito.tabla)
      continue
    }

    if (esTablaInexistente(error.message)) {
      tablas_faltantes.push(requisito.tabla)
      continue
    }

    errores.push({ tabla: requisito.tabla, mensaje: error.message })
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
    return 'Sincronización bloqueada: el núcleo asistente_* está incompleto o no fue posible validar su acceso.'
  }

  return 'Sincronización no disponible.'
}
