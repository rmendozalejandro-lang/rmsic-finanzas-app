import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Auren',
    template: '%s | Auren',
  },
  description: 'Plataforma de gestión financiera y administrativa',
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