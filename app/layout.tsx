import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  applicationName: 'Tralixia',
  title: {
    default: 'Tralixia',
    template: '%s | Tralixia',
  },
  description: 'Tralixia, plataforma modular de gestión empresarial desarrollada por RM Servicios de Ingeniería y Construcción',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Tralixia',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-[#F6F8FB] text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}
