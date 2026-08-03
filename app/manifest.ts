import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tralixia',
    short_name: 'Tralixia',
    description: 'Plataforma modular de gestión empresarial',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'portrait',
    lang: 'es-CL',
    icons: [
      {
        src: '/tralixia.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        // El manifest admite varios propósitos separados por espacios; el tipo
        // de Next.js 16 todavía modela este campo como un solo valor.
        purpose: 'any maskable' as 'any',
      },
    ],
  }
}

// P8B-10 incorporará la estrategia offline. Esta base no registra un service
// worker ni almacena en caché datos clínicos, operacionales o de Supabase.
