// lib/empresa-branding.ts
// Helpers reutilizables para logos y datos públicos de empresa.
// Acepta nombres de campos históricos y nuevos para mantener compatibilidad.

type EmpresaBrandingLike = {
  // Logo guardado en cotizaciones / empresas
  empresa_logo_url?: string | null
  empresaLogoUrl?: string | null
  logo_url?: string | null
  logoUrl?: string | null
  logo?: string | null
  url_logo?: string | null
  urlLogo?: string | null

  // Sitio web / contacto
  empresa_web?: string | null
  empresaWeb?: string | null
  web?: string | null
  sitio_web?: string | null
  sitioWeb?: string | null
  website?: string | null

  // Nombre empresa
  empresa_nombre?: string | null
  empresaNombre?: string | null
  nombre?: string | null
  empresaActivaNombre?: string | null
}

function clean(value?: string | null): string {
  return (value ?? '').trim()
}

function normalizePublicAssetPath(value?: string | null): string | null {
  const raw = clean(value)

  if (!raw) return null

  // URLs absolutas o data URI.
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) {
    return raw
  }

  // Rutas públicas Next.js: /logos/archivo.png
  if (raw.startsWith('/')) {
    return raw
  }

  // Si viene como "logos/archivo.png", normaliza a "/logos/archivo.png".
  return `/${raw}`
}

export function getEmpresaLogoSrc(empresa?: EmpresaBrandingLike | null): string | null {
  if (!empresa) return null

  return (
    normalizePublicAssetPath(empresa.empresa_logo_url) ||
    normalizePublicAssetPath(empresa.empresaLogoUrl) ||
    normalizePublicAssetPath(empresa.logo_url) ||
    normalizePublicAssetPath(empresa.logoUrl) ||
    normalizePublicAssetPath(empresa.logo) ||
    normalizePublicAssetPath(empresa.url_logo) ||
    normalizePublicAssetPath(empresa.urlLogo)
  )
}

export function getEmpresaWebFallback(empresa?: EmpresaBrandingLike | null): string {
  if (!empresa) return ''

  return (
    clean(empresa.empresa_web) ||
    clean(empresa.empresaWeb) ||
    clean(empresa.web) ||
    clean(empresa.sitio_web) ||
    clean(empresa.sitioWeb) ||
    clean(empresa.website)
  )
}

export function getEmpresaNombreFallback(empresa?: EmpresaBrandingLike | null): string {
  if (!empresa) return ''

  return (
    clean(empresa.empresa_nombre) ||
    clean(empresa.empresaNombre) ||
    clean(empresa.nombre) ||
    clean(empresa.empresaActivaNombre)
  )
}
