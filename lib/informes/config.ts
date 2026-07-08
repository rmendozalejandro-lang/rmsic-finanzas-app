export const INFORMES_TECNICOS_ENABLED_EMPRESAS = [
  '557a054c-71ef-4c5f-8637-594755ad669b', // RMSIC
] as const

export function empresaTieneInformesTecnicos(empresaId?: string | null) {
  if (!empresaId) return false
  return INFORMES_TECNICOS_ENABLED_EMPRESAS.includes(
    empresaId as (typeof INFORMES_TECNICOS_ENABLED_EMPRESAS)[number]
  )
}