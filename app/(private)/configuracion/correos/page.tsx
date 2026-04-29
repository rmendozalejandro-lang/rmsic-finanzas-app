'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

type ConfigCorreo = {
  id?: string
  empresa_id: string
  nombre_remitente: string
  email_respuesta: string
  email_copia: string
  telefono_contacto: string
  sitio_web: string
  firma_correo: string
  texto_pie_correo: string
  activo: boolean
}

const defaultConfig = (empresaId: string, empresaNombre: string): ConfigCorreo => ({
  empresa_id: empresaId,
  nombre_remitente: `${empresaNombre || 'Empresa'} Cobranzas`,
  email_respuesta: '',
  email_copia: '',
  telefono_contacto: '',
  sitio_web: '',
  firma_correo: `Área de Administración y Finanzas
${empresaNombre || 'Empresa'}`,
  texto_pie_correo: 'Correo enviado automáticamente desde Auren, sistema de gestión financiera de la empresa.',
  activo: true,
})

export default function ConfiguracionCorreosPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [config, setConfig] = useState<ConfigCorreo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaId(id)
    setEmpresaNombre(nombre)
  }, [])

  useEffect(() => {
    const loadConfig = async () => {
      if (!empresaId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      const { data, error: configError } = await supabase
        .from('empresa_config_correo')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()

      if (configError) {
        setError(configError.message)
        setLoading(false)
        return
      }

      if (data) {
        setConfig({
          id: data.id,
          empresa_id: data.empresa_id,
          nombre_remitente: data.nombre_remitente || '',
          email_respuesta: data.email_respuesta || '',
          email_copia: data.email_copia || '',
          telefono_contacto: data.telefono_contacto || '',
          sitio_web: data.sitio_web || '',
          firma_correo: data.firma_correo || '',
          texto_pie_correo: data.texto_pie_correo || '',
          activo: Boolean(data.activo),
        })
      } else {
        setConfig(defaultConfig(empresaId, empresaNombre))
      }

      setLoading(false)
    }

    void loadConfig()
  }, [empresaId, empresaNombre])

  const updateField = (field: keyof ConfigCorreo, value: string | boolean) => {
    setConfig((prev) => {
      if (!prev) return prev

      return {
        ...prev,
        [field]: value,
      }
    })
  }

  const guardar = async () => {
    try {
      if (!config || !empresaId) return

      setSaving(true)
      setError('')
      setSuccess('')

      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id || null

      if (!config.nombre_remitente.trim()) {
        throw new Error('Debes indicar el nombre del remitente.')
      }

      const payload = {
        empresa_id: empresaId,
        nombre_remitente: config.nombre_remitente.trim(),
        email_respuesta: config.email_respuesta.trim() || null,
        email_copia: config.email_copia.trim() || null,
        telefono_contacto: config.telefono_contacto.trim() || null,
        sitio_web: config.sitio_web.trim() || null,
        firma_correo: config.firma_correo.trim() || null,
        texto_pie_correo: config.texto_pie_correo.trim() || null,
        activo: config.activo,
        updated_at: new Date().toISOString(),
        updated_by: userId,
        created_by: userId,
      }

      const { data, error: saveError } = await supabase
        .from('empresa_config_correo')
        .upsert(payload, {
          onConflict: 'empresa_id',
        })
        .select('*')
        .single()

      if (saveError) {
        throw new Error(saveError.message)
      }

      setConfig({
        id: data.id,
        empresa_id: data.empresa_id,
        nombre_remitente: data.nombre_remitente || '',
        email_respuesta: data.email_respuesta || '',
        email_copia: data.email_copia || '',
        telefono_contacto: data.telefono_contacto || '',
        sitio_web: data.sitio_web || '',
        firma_correo: data.firma_correo || '',
        texto_pie_correo: data.texto_pie_correo || '',
        activo: Boolean(data.activo),
      })

      setSuccess('Configuración de correo guardada correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuración.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        Cargando configuración de correos...
      </div>
    )
  }

  if (!empresaId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        No hay empresa activa seleccionada.
      </div>
    )
  }

  if (!config) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        No se pudo cargar la configuración.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Configuración</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Correos y notificaciones
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Define la identidad de correo que usará la empresa activa para recordatorios de cobranza.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Empresa activa: <span className="font-medium text-slate-800">{empresaNombre || empresaId}</span>
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Nombre del remitente
            </label>
            <input
              value={config.nombre_remitente}
              onChange={(event) => updateField('nombre_remitente', event.target.value)}
              placeholder="RMSIC Cobranzas"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#163A5F]"
            />
            <p className="mt-1 text-xs text-slate-500">
              Es el nombre que verá el cliente en el correo.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email de respuesta
            </label>
            <input
              value={config.email_respuesta}
              onChange={(event) => updateField('email_respuesta', event.target.value)}
              placeholder="administracion@empresa.cl"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#163A5F]"
            />
            <p className="mt-1 text-xs text-slate-500">
              Si el cliente responde, se dirigirá a este correo.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email en copia
            </label>
            <input
              value={config.email_copia}
              onChange={(event) => updateField('email_copia', event.target.value)}
              placeholder="contador@empresa.cl"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#163A5F]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Teléfono de contacto
            </label>
            <input
              value={config.telefono_contacto}
              onChange={(event) => updateField('telefono_contacto', event.target.value)}
              placeholder="+56 9 1234 5678"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#163A5F]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Sitio web
            </label>
            <input
              value={config.sitio_web}
              onChange={(event) => updateField('sitio_web', event.target.value)}
              placeholder="www.empresa.cl"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#163A5F]"
            />
          </div>

          <div className="flex items-center gap-3 pt-7">
            <input
              id="activo"
              type="checkbox"
              checked={config.activo}
              onChange={(event) => updateField('activo', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="activo" className="text-sm font-medium text-slate-700">
              Configuración activa
            </label>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Firma del correo
          </label>
          <textarea
            value={config.firma_correo}
            onChange={(event) => updateField('firma_correo', event.target.value)}
            rows={5}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#163A5F]"
          />
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Texto pie de correo
          </label>
          <textarea
            value={config.texto_pie_correo}
            onChange={(event) => updateField('texto_pie_correo', event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#163A5F]"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={guardar}
            disabled={saving}
            className="rounded-xl border border-[#163A5F] bg-white px-5 py-2 text-sm font-semibold text-[#163A5F] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Vista de ejemplo
        </h2>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p>
            <strong>De:</strong> {config.nombre_remitente} &lt;noreply@mail.rmsic.cl&gt;
          </p>
          <p>
            <strong>Responder a:</strong> {config.email_respuesta || '-'}
          </p>
          <p className="mt-4">
            Saludos cordiales,
          </p>
          <p className="whitespace-pre-wrap">
            {config.firma_correo || '-'}
          </p>
          <p className="mt-4 text-xs text-slate-500">
            {config.texto_pie_correo || '-'}
          </p>
        </div>
      </section>
    </div>
  )
}