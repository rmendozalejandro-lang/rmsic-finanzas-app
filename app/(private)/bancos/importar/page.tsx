'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../../components/ProtectedModuleRoute'
import EmpresaActivaBanner from '../../../../components/EmpresaActivaBanner'
import { supabase } from '../../../../lib/supabase/client'

type CuentaBancaria = {
  id: string
  banco: string
  nombre_cuenta: string
  numero_cuenta: string | null
  moneda: string
}

type FilaPreview = {
  filaOrigen: number
  fecha: string
  sucursal: string | null
  numeroDocumento: string | null
  descripcionOriginal: string
  rutDetectado: string | null
  nombreDetectado: string | null
  cargo: number
  abono: number
  saldo: number | null
  tipoDetectado: 'cargo' | 'abono'
  tipoSugerido: 'ingreso' | 'egreso'
  hashMovimiento: string
  esDuplicado: boolean
}

type PreviewResponse = {
  cuenta: CuentaBancaria
  archivo: string
  formatoDetectado: string
  bancoDetectado: string
  totalFilas: number
  totalDuplicadas: number
  filas: FilaPreview[]
}

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string) {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
  }).format(date)
}

function BancosImportarContent() {
  const [empresaId, setEmpresaId] = useState('')
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [cuentaBancariaId, setCuentaBancariaId] = useState('')
  const [formato, setFormato] = useState('auto')
  const [file, setFile] = useState<File | null>(null)

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loadingCuentas, setLoadingCuentas] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [importacionId, setImportacionId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const activeEmpresa =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('empresa_activa_id') || ''
        : ''

    setEmpresaId(activeEmpresa)
  }, [])

  useEffect(() => {
    const loadCuentas = async () => {
      try {
        setLoadingCuentas(true)
        setError('')

        if (!empresaId) return

        const { data, error: cuentasError } = await supabase
          .from('cuentas_bancarias')
          .select('id, banco, nombre_cuenta, numero_cuenta, moneda')
          .eq('empresa_id', empresaId)
          .eq('activa', true)
          .is('deleted_at', null)
          .order('banco', { ascending: true })

        if (cuentasError) {
          throw new Error(cuentasError.message)
        }

        const cuentasData = (data ?? []) as CuentaBancaria[]
        setCuentas(cuentasData)

        if (!cuentaBancariaId && cuentasData.length > 0) {
          setCuentaBancariaId(cuentasData[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las cuentas.')
      } finally {
        setLoadingCuentas(false)
      }
    }

    void loadCuentas()
  }, [empresaId, cuentaBancariaId])

  const filasValidas = useMemo(() => {
    return preview?.filas.filter((fila) => !fila.esDuplicado) ?? []
  }, [preview])

  const totalAbonos = useMemo(() => {
    return filasValidas.reduce((acc, fila) => acc + fila.abono, 0)
  }, [filasValidas])

  const totalCargos = useMemo(() => {
    return filasValidas.reduce((acc, fila) => acc + fila.cargo, 0)
  }, [filasValidas])

  const handleConfirmarImportacion = async () => {
    try {
      setConfirmando(true)
      setError('')
      setSuccess('')

      if (!preview) {
        throw new Error('Primero debes leer una cartola y revisar la vista previa.')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error('No hay sesión activa.')
      }

      const response = await fetch('/api/bancos/confirmar-importacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cuentaBancariaId,
          archivo: preview.archivo,
          bancoDetectado: preview.bancoDetectado,
          formatoDetectado: preview.formatoDetectado,
          filas: preview.filas,
        }),
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'No se pudo confirmar la importación.')
      }

      setImportacionId(json.importacionId)
      setSuccess(
        `Importación guardada correctamente. Filas guardadas: ${json.totalGuardadas}. Duplicadas omitidas: ${json.totalDuplicadas}.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la importación.')
    } finally {
      setConfirmando(false)
    }
  }

  const handlePreview = async () => {
    try {
      setProcesando(true)
      setError('')
      setSuccess('')
      setPreview(null)

      if (!cuentaBancariaId) {
        throw new Error('Debes seleccionar una cuenta bancaria.')
      }

      if (!file) {
        throw new Error('Debes seleccionar un archivo Excel.')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error('No hay sesión activa.')
      }

      const body = new FormData()
      body.append('file', file)
      body.append('cuentaBancariaId', cuentaBancariaId)
      body.append('formato', formato)

      const response = await fetch('/api/bancos/importar-cartola', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body,
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'No se pudo procesar la cartola.')
      }

      setPreview(json as PreviewResponse)
      setSuccess('Cartola leída correctamente. Revisa la vista previa antes de importar.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la cartola.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="space-y-6">
      <EmpresaActivaBanner modulo="Bancos" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Bancos</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Importar cartola bancaria
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Sube una cartola Excel de BancoEstado o BCI para generar una vista previa
              normalizada antes de crear movimientos.
            </p>
          </div>

          <Link
            href="/bancos"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Volver a bancos
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Archivo a importar</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Cuenta bancaria
            </label>
            <select
              value={cuentaBancariaId}
              onChange={(event) => setCuentaBancariaId(event.target.value)}
              disabled={loadingCuentas}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
            >
              {cuentas.length === 0 ? (
                <option value="">Sin cuentas disponibles</option>
              ) : null}

              {cuentas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.banco} - {cuenta.nombre_cuenta}
                  {cuenta.numero_cuenta ? ` (${cuenta.numero_cuenta})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Formato
            </label>
            <select
              value={formato}
              onChange={(event) => setFormato(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
            >
              <option value="auto">Detectar automático</option>
              <option value="bci">BCI</option>
              <option value="bancoestado">BancoEstado</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Archivo Excel
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setPreview(null)
                setSuccess('')
                setError('')
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900"
            />
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        <div className="mt-5">
          <button
            type="button"
            onClick={handlePreview}
            disabled={procesando}
            className="inline-flex items-center justify-center rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {procesando ? 'Leyendo cartola...' : 'Leer cartola y previsualizar'}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Banco detectado</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {preview.bancoDetectado}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Movimientos</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {preview.totalFilas}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Abonos válidos</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {formatCurrency(totalAbonos)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Cargos válidos</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {formatCurrency(totalCargos)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Vista previa
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Esta etapa aún no guarda movimientos. Primero revisa la lectura,
                duplicados y RUT detectados.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-slate-600">
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Descripción banco</th>
                      <th className="px-4 py-3 font-semibold">RUT</th>
                      <th className="px-4 py-3 font-semibold text-right">Cargo</th>
                      <th className="px-4 py-3 font-semibold text-right">Abono</th>
                      <th className="px-4 py-3 font-semibold text-right">Saldo</th>
                      <th className="px-4 py-3 font-semibold">Tipo</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>

                  <tbody>
                    {preview.filas.map((fila) => (
                      <tr
                        key={fila.hashMovimiento}
                        className="border-t border-slate-100 text-slate-700"
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatDate(fila.fecha)}
                        </td>

                        <td className="min-w-[320px] px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {fila.descripcionOriginal}
                          </div>
                          {fila.numeroDocumento ? (
                            <div className="mt-1 text-xs text-slate-500">
                              Doc/Op: {fila.numeroDocumento}
                            </div>
                          ) : null}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          {fila.rutDetectado || '-'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {fila.cargo > 0 ? formatCurrency(fila.cargo) : '-'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {fila.abono > 0 ? formatCurrency(fila.abono) : '-'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {fila.saldo != null ? formatCurrency(fila.saldo) : '-'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              fila.tipoSugerido === 'ingreso'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {fila.tipoSugerido}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          {fila.esDuplicado ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Duplicado
                            </span>
                          ) : (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              Pendiente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">Confirmar importación</p>
                <p className="mt-1">
                  Se guardarán las filas válidas en bandeja de revisión. Los duplicados
                  serán omitidos.
                </p>
                {importacionId ? (
                  <p className="mt-2 text-xs">
                    Importación ID: {importacionId}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleConfirmarImportacion}
                disabled={confirmando || Boolean(importacionId)}
                className="inline-flex items-center justify-center rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {importacionId
                  ? "Importación guardada"
                  : confirmando
                    ? "Guardando importación..."
                    : "Confirmar importación"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function BancosImportarPage() {
  return (
    <ProtectedModuleRoute moduleKey="bancos">
      <BancosImportarContent />
    </ProtectedModuleRoute>
  )
}