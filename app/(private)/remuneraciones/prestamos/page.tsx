'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Prestamo = {
  id: string
  banco_id: string | null
  movimiento_banco_id: string | null
  trabajador_nombre: string
  trabajador_rut: string | null
  tipo: string
  fecha_otorgamiento: string | null
  monto_original: number | string
  monto_saldo: number | string
  numero_cuotas: number
  monto_cuota: number | string
  fecha_inicio_descuento: string | null
  estado: string
  observacion: string | null
  created_at: string
}

type Cuota = {
  id: string
  prestamo_id: string
  numero_cuota: number
  fecha_vencimiento: string | null
  monto_programado: number | string
  monto_pagado: number | string
  estado: string
  movimiento_banco_id: string | null
}

type AbonoCuota = {
  id: string
  empresa_id: string
  prestamo_id: string
  cuota_id: string
  movimiento_banco_id: string
  movimiento_reversa_id: string | null
  fecha_pago: string
  monto_aplicado: number | string
  estado: string
  created_at: string
}

type Movimiento = {
  id: string
  tipo_movimiento: string | null
  fecha: string | null
  numero_documento: string | null
  descripcion: string | null
  monto_total: number | string | null
  estado: string | null
  medio_pago: string | null
  cuenta_bancaria_id: string | null
}

type Banco = {
  id: string
  banco: string | null
  nombre_cuenta: string | null
  numero_cuenta: string | null
  tipo_cuenta: string | null
  moneda: string | null
}

type FormPrestamo = {
  trabajador_nombre: string
  trabajador_rut: string
  trabajador_email: string
  banco_id: string
  tipo: 'prestamo' | 'anticipo'
  fecha_otorgamiento: string
  monto_original: string
  numero_cuotas: string
  fecha_inicio_descuento: string
  observacion: string
}

type FormAbono = {
  prestamo_id: string
  trabajador_nombre: string
  monto_saldo: string
  monto_pago: string
  fecha_pago: string
  cuenta_bancaria_id: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatCLP(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value

  return `${day}-${month}-${year}`
}

function limpiarMonto(value: string) {
  return value.replace(/[^\d]/g, '')
}

function getBancoLabel(banco: Banco | undefined) {
  if (!banco) return 'No indicado'

  const nombreCuenta = banco.nombre_cuenta || 'Cuenta bancaria'
  const bancoNombre = banco.banco ? ` - ${banco.banco}` : ''
  const numeroCuenta = banco.numero_cuenta ? ` - ${banco.numero_cuenta}` : ''
  const tipoCuenta = banco.tipo_cuenta ? ` - ${banco.tipo_cuenta}` : ''
  const moneda = banco.moneda ? ` (${banco.moneda})` : ''

  return `${nombreCuenta}${bancoNombre}${numeroCuenta}${tipoCuenta}${moneda}`
}

const initialForm: FormPrestamo = {
  trabajador_nombre: '',
  trabajador_rut: '',
  trabajador_email: '',
  banco_id: '',
  tipo: 'prestamo',
  fecha_otorgamiento: todayISO(),
  monto_original: '',
  numero_cuotas: '1',
  fecha_inicio_descuento: todayISO(),
  observacion: '',
}

const initialAbonoForm: FormAbono = {
  prestamo_id: '',
  trabajador_nombre: '',
  monto_saldo: '',
  monto_pago: '',
  fecha_pago: todayISO(),
  cuenta_bancaria_id: '',
}

export default function PrestamosTrabajadoresPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [prestamos, setPrestamos] = useState<Prestamo[]>([])
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [abonos, setAbonos] = useState<AbonoCuota[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormPrestamo>(initialForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [showAbonoForm, setShowAbonoForm] = useState(false)
  const [abonoForm, setAbonoForm] = useState<FormAbono>(initialAbonoForm)
  const [abonoError, setAbonoError] = useState('')
  const [savingAbono, setSavingAbono] = useState(false)
  const [reversingMovimientoId, setReversingMovimientoId] = useState<
    string | null
  >(null)

  const cargarEmpresaActiva = useCallback(() => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaActivaId(id)
    setEmpresaActivaNombre(nombre)
  }, [])

  const cargarBancos = useCallback(async (empresaId: string) => {
    if (!empresaId) {
      setBancos([])
      return
    }

    const bancosResp = await supabase
      .from('cuentas_bancarias')
      .select(`
        id,
        banco,
        nombre_cuenta,
        numero_cuenta,
        tipo_cuenta,
        moneda
      `)
      .eq('empresa_id', empresaId)
      .eq('activa', true)
      .is('deleted_at', null)
      .order('nombre_cuenta', { ascending: true })

    if (bancosResp.error) {
      console.error('Error cargando bancos:', bancosResp.error.message)
      setBancos([])
      return
    }

    setBancos((bancosResp.data ?? []) as Banco[])
  }, [])

  const cargarPrestamos = useCallback(async (empresaId: string) => {
    if (!empresaId) {
      setPrestamos([])
      setCuotas([])
      setAbonos([])
      setMovimientos([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const prestamosResp = await supabase
      .from('rrhh_prestamos_trabajadores')
      .select(`
        id,
        banco_id,
        movimiento_banco_id,
        trabajador_nombre,
        trabajador_rut,
        tipo,
        fecha_otorgamiento,
        monto_original,
        monto_saldo,
        numero_cuotas,
        monto_cuota,
        fecha_inicio_descuento,
        estado,
        observacion,
        created_at
      `)
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })

    if (prestamosResp.error) {
      setError(prestamosResp.error.message)
      setPrestamos([])
      setCuotas([])
      setAbonos([])
      setMovimientos([])
      setLoading(false)
      return
    }

    const prestamosData = (prestamosResp.data ?? []) as Prestamo[]
    setPrestamos(prestamosData)

    const cuotasResp = await supabase
      .from('rrhh_prestamo_cuotas')
      .select(`
        id,
        prestamo_id,
        numero_cuota,
        fecha_vencimiento,
        monto_programado,
        monto_pagado,
        estado,
        movimiento_banco_id
      `)
      .eq('empresa_id', empresaId)
      .order('prestamo_id', { ascending: true })
      .order('numero_cuota', { ascending: true })

    if (cuotasResp.error) {
      setError(`Error al cargar cuotas: ${cuotasResp.error.message}`)
      setCuotas([])
      setAbonos([])
      setMovimientos([])
      setLoading(false)
      return
    }

    const cuotasData = (cuotasResp.data ?? []) as Cuota[]
    setCuotas(cuotasData)

    const prestamoIds = prestamosData.map((prestamo) => prestamo.id)

    let abonosData: AbonoCuota[] = []

    if (prestamoIds.length > 0) {
      const abonosResp = await supabase
        .from('rrhh_prestamo_cuota_abonos')
        .select(`
          id,
          empresa_id,
          prestamo_id,
          cuota_id,
          movimiento_banco_id,
          movimiento_reversa_id,
          fecha_pago,
          monto_aplicado,
          estado,
          created_at
        `)
        .in('prestamo_id', prestamoIds)
        .order('created_at', { ascending: true })

      if (abonosResp.error) {
        setError(
          `Error al cargar historial de abonos: ${abonosResp.error.message}`
        )
        setAbonos([])
        setMovimientos([])
        setLoading(false)
        return
      }

      abonosData = (abonosResp.data ?? []) as AbonoCuota[]
    }

    setAbonos(abonosData)

    const movimientosPrestamoIds = prestamosData
      .map((prestamo) => prestamo.movimiento_banco_id)
      .filter((id): id is string => Boolean(id))

    const movimientosCuotaIds = cuotasData
      .map((cuota) => cuota.movimiento_banco_id)
      .filter((id): id is string => Boolean(id))

    const movimientosAbonoIds = abonosData
      .map((abono) => abono.movimiento_banco_id)
      .filter((id): id is string => Boolean(id))

    const movimientosReversaIds = abonosData
      .map((abono) => abono.movimiento_reversa_id)
      .filter((id): id is string => Boolean(id))

    const movimientosIds = Array.from(
      new Set([
        ...movimientosPrestamoIds,
        ...movimientosCuotaIds,
        ...movimientosAbonoIds,
        ...movimientosReversaIds,
      ])
    )

    if (movimientosIds.length > 0) {
      const movimientosResp = await supabase
        .from('movimientos')
        .select(`
          id,
          tipo_movimiento,
          fecha,
          numero_documento,
          descripcion,
          monto_total,
          estado,
          medio_pago,
          cuenta_bancaria_id
        `)
        .in('id', movimientosIds)

      if (movimientosResp.error) {
        setError(
          `Error al cargar movimientos bancarios: ${movimientosResp.error.message}`
        )
        setMovimientos([])
        setLoading(false)
        return
      }

      setMovimientos((movimientosResp.data ?? []) as Movimiento[])
    } else {
      setMovimientos([])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    cargarEmpresaActiva()

    window.addEventListener('empresa-activa-cambiada', cargarEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', cargarEmpresaActiva)
    }
  }, [cargarEmpresaActiva])

  useEffect(() => {
    cargarPrestamos(empresaActivaId)
    cargarBancos(empresaActivaId)
  }, [empresaActivaId, cargarPrestamos, cargarBancos])

  const cuotasPorPrestamo = useMemo(() => {
    const map = new Map<string, Cuota[]>()

    for (const cuota of cuotas) {
      const actuales = map.get(cuota.prestamo_id) ?? []
      actuales.push(cuota)
      map.set(cuota.prestamo_id, actuales)
    }

    return map
  }, [cuotas])

  const abonosPorCuota = useMemo(() => {
    const map = new Map<string, AbonoCuota[]>()

    for (const abono of abonos) {
      const actuales = map.get(abono.cuota_id) ?? []
      actuales.push(abono)
      map.set(abono.cuota_id, actuales)
    }

    return map
  }, [abonos])

  const bancosPorId = useMemo(() => {
    const map = new Map<string, Banco>()

    for (const banco of bancos) {
      map.set(banco.id, banco)
    }

    return map
  }, [bancos])

  const movimientosPorId = useMemo(() => {
    const map = new Map<string, Movimiento>()

    for (const movimiento of movimientos) {
      map.set(movimiento.id, movimiento)
    }

    return map
  }, [movimientos])

  const resumen = useMemo(() => {
    const totalOriginal = prestamos.reduce(
      (total, prestamo) => total + Number(prestamo.monto_original ?? 0),
      0
    )

    const totalSaldo = prestamos.reduce(
      (total, prestamo) => total + Number(prestamo.monto_saldo ?? 0),
      0
    )

    return {
      totalPrestamos: prestamos.length,
      totalOriginal,
      totalSaldo,
    }
  }, [prestamos])

  const montoPreview = Number(limpiarMonto(form.monto_original) || 0)
  const cuotasPreview = Number(form.numero_cuotas || 0)
  const montoCuotaPreview =
    montoPreview > 0 && cuotasPreview > 0 ? montoPreview / cuotasPreview : 0

  const montoAbonoPreview = Number(limpiarMonto(abonoForm.monto_pago) || 0)
  const saldoAbonoPreview = Number(abonoForm.monto_saldo || 0)

  const abrirFormulario = () => {
    setForm({
      ...initialForm,
      fecha_otorgamiento: todayISO(),
      fecha_inicio_descuento: todayISO(),
    })
    setFormError('')
    setShowForm(true)
  }

  const cerrarFormulario = () => {
    if (saving) return
    setShowForm(false)
    setFormError('')
  }

  const abrirFormularioAbono = (prestamo: Prestamo) => {
    setAbonoForm({
      prestamo_id: prestamo.id,
      trabajador_nombre: prestamo.trabajador_nombre,
      monto_saldo: String(prestamo.monto_saldo ?? 0),
      monto_pago: '',
      fecha_pago: todayISO(),
      cuenta_bancaria_id: prestamo.banco_id || '',
    })
    setAbonoError('')
    setShowAbonoForm(true)
  }

  const cerrarFormularioAbono = () => {
    if (savingAbono) return
    setShowAbonoForm(false)
    setAbonoError('')
    setAbonoForm(initialAbonoForm)
  }

  const handleChange = (field: keyof FormPrestamo, value: string) => {
    setForm((current) => {
      const next = {
        ...current,
        [field]: field === 'monto_original' ? limpiarMonto(value) : value,
      } as FormPrestamo

      if (field === 'tipo' && value === 'anticipo') {
        next.numero_cuotas = '1'
      }

      return next
    })
  }

  const handleAbonoChange = (field: keyof FormAbono, value: string) => {
    setAbonoForm((current) => ({
      ...current,
      [field]: field === 'monto_pago' ? limpiarMonto(value) : value,
    }))
  }

  const crearPrestamo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!empresaActivaId) {
      setFormError('No hay empresa activa seleccionada.')
      return
    }

    const montoOriginal = Number(limpiarMonto(form.monto_original))
    const numeroCuotas = Number(form.numero_cuotas)

    if (!form.trabajador_nombre.trim()) {
      setFormError('Debes ingresar el nombre del trabajador.')
      return
    }

    if (!form.banco_id) {
      setFormError('Debes seleccionar el banco o cuenta de origen del dinero.')
      return
    }

    if (!form.fecha_otorgamiento) {
      setFormError('Debes ingresar la fecha de otorgamiento.')
      return
    }

    if (!form.fecha_inicio_descuento) {
      setFormError('Debes ingresar la fecha de inicio de pago.')
      return
    }

    if (!montoOriginal || montoOriginal <= 0) {
      setFormError('El monto debe ser mayor a cero.')
      return
    }

    if (!numeroCuotas || numeroCuotas < 1) {
      setFormError('El número de cuotas debe ser mayor o igual a 1.')
      return
    }

    if (form.tipo === 'anticipo' && numeroCuotas !== 1) {
      setFormError('Un anticipo debe registrarse en una sola cuota.')
      return
    }

    setSaving(true)
    setFormError('')

    const observacionFinal =
      form.observacion.trim() ||
      `${form.tipo === 'anticipo' ? 'Anticipo' : 'Préstamo'} otorgado a trabajador por ${formatCLP(
        montoOriginal
      )}, a pagar en ${numeroCuotas} cuota${
        numeroCuotas === 1 ? '' : 's'
      } mediante transferencia.`

    const { error: rpcError } = await supabase.rpc('crear_prestamo_trabajador', {
      p_empresa_id: empresaActivaId,
      p_trabajador_nombre: form.trabajador_nombre.trim(),
      p_tipo: form.tipo,
      p_fecha_otorgamiento: form.fecha_otorgamiento,
      p_monto_original: montoOriginal,
      p_numero_cuotas: numeroCuotas,
      p_fecha_inicio_descuento: form.fecha_inicio_descuento,
      p_trabajador_id: null,
      p_trabajador_rut: form.trabajador_rut.trim() || null,
      p_trabajador_email: form.trabajador_email.trim() || null,
      p_observacion: observacionFinal,
      p_banco_id: form.banco_id || null,
      p_documento_url: null,
    })

    if (rpcError) {
      setFormError(rpcError.message)
      setSaving(false)
      return
    }

    await cargarPrestamos(empresaActivaId)

    setSaving(false)
    setShowForm(false)
    setForm(initialForm)
  }

  const registrarAbono = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!empresaActivaId) {
      setAbonoError('No hay empresa activa seleccionada.')
      return
    }

    if (!abonoForm.prestamo_id) {
      setAbonoError('No se encontró el préstamo seleccionado.')
      return
    }

    const montoPago = Number(limpiarMonto(abonoForm.monto_pago))
    const saldoPendiente = Number(abonoForm.monto_saldo || 0)

    if (!montoPago || montoPago <= 0) {
      setAbonoError('El monto del abono debe ser mayor a cero.')
      return
    }

    if (montoPago > saldoPendiente) {
      setAbonoError('El monto recibido supera el saldo pendiente del préstamo.')
      return
    }

    if (!abonoForm.fecha_pago) {
      setAbonoError('Debes ingresar la fecha de pago.')
      return
    }

    if (!abonoForm.cuenta_bancaria_id) {
      setAbonoError('Debes seleccionar la cuenta bancaria donde ingresó el abono.')
      return
    }

    const confirmar = window.confirm(
      `¿Registrar abono por transferencia por ${formatCLP(
        montoPago
      )}? El sistema aplicará el pago automáticamente a las cuotas pendientes más antiguas.`
    )

    if (!confirmar) return

    setSavingAbono(true)
    setAbonoError('')

    const { error: rpcError } = await supabase.rpc(
      'registrar_abono_prestamo_transferencia',
      {
        p_prestamo_id: abonoForm.prestamo_id,
        p_monto_pago: montoPago,
        p_cuenta_bancaria_id: abonoForm.cuenta_bancaria_id,
        p_fecha_pago: abonoForm.fecha_pago,
      }
    )

    if (rpcError) {
      setAbonoError(rpcError.message)
      setSavingAbono(false)
      return
    }

    await cargarPrestamos(empresaActivaId)

    setSavingAbono(false)
    setShowAbonoForm(false)
    setAbonoForm(initialAbonoForm)
  }

  const reversarPagoPrestamo = async (movimientoPagoId: string) => {
    if (!empresaActivaId) {
      setError('No hay empresa activa seleccionada.')
      return
    }

    const confirmar = window.confirm(
      '¿Reversar este abono? Se creará un egreso bancario de reversa, se restaurará el saldo del préstamo y se ajustarán las cuotas afectadas.'
    )

    if (!confirmar) return

    setReversingMovimientoId(movimientoPagoId)
    setError('')

    const { error: rpcError } = await supabase.rpc(
      'reversar_pago_prestamo_transferencia',
      {
        p_movimiento_pago_id: movimientoPagoId,
      }
    )

    if (rpcError) {
      setError(rpcError.message)
      setReversingMovimientoId(null)
      return
    }

    await cargarPrestamos(empresaActivaId)

    setReversingMovimientoId(null)
  }

  return (
    <main className="space-y-6 p-6">
      <section className="flex flex-col gap-3 rounded-2xl border bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Recursos Humanos / Remuneraciones
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Préstamos y anticipos
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Empresa activa:{' '}
            <span className="font-medium text-slate-900">
              {empresaActivaNombre || 'Sin empresa activa'}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={abrirFormulario}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          Nuevo préstamo
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Registros</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {resumen.totalPrestamos}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Monto otorgado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCLP(resumen.totalOriginal)}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Saldo pendiente</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCLP(resumen.totalSaldo)}
          </p>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
          Cargando préstamos...
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      {!loading && !error && bancos.length === 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          No se encontraron bancos o cuentas bancarias para esta empresa. Para
          crear un préstamo desde la app será necesario tener al menos una
          cuenta bancaria registrada.
        </section>
      ) : null}

      {!loading && !error && prestamos.length === 0 ? (
        <section className="rounded-2xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
          No hay préstamos ni anticipos registrados para esta empresa.
        </section>
      ) : null}

      {!loading && !error && prestamos.length > 0 ? (
        <section className="space-y-4">
          {prestamos.map((prestamo) => {
            const cuotasPrestamo = cuotasPorPrestamo.get(prestamo.id) ?? []
            const bancoOrigen = prestamo.banco_id
              ? bancosPorId.get(prestamo.banco_id)
              : undefined

            const movimientoAsociado = prestamo.movimiento_banco_id
              ? movimientosPorId.get(prestamo.movimiento_banco_id)
              : undefined

            const saldoPendiente = Number(prestamo.monto_saldo ?? 0)

            return (
              <article
                key={prestamo.id}
                className="rounded-2xl border bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {prestamo.trabajador_nombre}
                      </h2>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase text-slate-700">
                        {prestamo.tipo}
                      </span>

                      <span
                        className={
                          prestamo.estado === 'pagado'
                            ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase text-emerald-700'
                            : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase text-slate-700'
                        }
                      >
                        {prestamo.estado}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      Fecha otorgamiento:{' '}
                      {formatDate(prestamo.fecha_otorgamiento)}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Origen del dinero:{' '}
                      <span className="font-medium text-slate-700">
                        {getBancoLabel(bancoOrigen)}
                      </span>
                    </p>

                    {movimientoAsociado ? (
                      <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                        <p className="font-semibold">
                          Movimiento bancario asociado
                        </p>

                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <p>
                            Documento:{' '}
                            <span className="font-medium">
                              {movimientoAsociado.numero_documento ||
                                'Sin número'}
                            </span>
                          </p>

                          <p>
                            Fecha:{' '}
                            <span className="font-medium">
                              {formatDate(movimientoAsociado.fecha)}
                            </span>
                          </p>

                          <p>
                            Monto:{' '}
                            <span className="font-medium">
                              {formatCLP(movimientoAsociado.monto_total)}
                            </span>
                          </p>

                          <p>
                            Estado:{' '}
                            <span className="font-medium">
                              {movimientoAsociado.estado || '-'}
                            </span>
                          </p>

                          <p>
                            Medio de pago:{' '}
                            <span className="font-medium">
                              {movimientoAsociado.medio_pago || '-'}
                            </span>
                          </p>

                          <p>
                            Tipo:{' '}
                            <span className="font-medium">
                              {movimientoAsociado.tipo_movimiento || '-'}
                            </span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        Este préstamo aún no tiene movimiento bancario asociado.
                      </div>
                    )}

                    {prestamo.trabajador_rut ? (
                      <p className="mt-2 text-sm text-slate-500">
                        RUT: {prestamo.trabajador_rut}
                      </p>
                    ) : null}

                    {prestamo.observacion ? (
                      <p className="mt-2 text-sm text-slate-600">
                        {prestamo.observacion}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm md:min-w-[360px]">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Monto original</p>
                      <p className="font-semibold text-slate-900">
                        {formatCLP(prestamo.monto_original)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Saldo pendiente</p>
                      <p className="font-semibold text-slate-900">
                        {formatCLP(prestamo.monto_saldo)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Cuotas</p>
                      <p className="font-semibold text-slate-900">
                        {prestamo.numero_cuotas}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Monto cuota</p>
                      <p className="font-semibold text-slate-900">
                        {formatCLP(prestamo.monto_cuota)}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => abrirFormularioAbono(prestamo)}
                        disabled={saldoPendiente <= 0}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saldoPendiente <= 0
                          ? 'Préstamo pagado'
                          : 'Registrar abono / transferencia'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border text-sm">
                  <div className="grid grid-cols-7 bg-slate-50 text-xs uppercase text-slate-500">
                    <div className="px-4 py-3 font-semibold">Cuota</div>
                    <div className="px-4 py-3 font-semibold">Vencimiento</div>
                    <div className="px-4 py-3 font-semibold">Monto</div>
                    <div className="px-4 py-3 font-semibold">Pagado</div>
                    <div className="px-4 py-3 font-semibold">Estado</div>
                    <div className="px-4 py-3 font-semibold">Abonos</div>
                    <div className="px-4 py-3 font-semibold">Saldo cuota</div>
                  </div>

                  {cuotasPrestamo.length > 0 ? (
                    <div className="divide-y">
                      {cuotasPrestamo.map((cuota) => {
                        const abonosCuota = abonosPorCuota.get(cuota.id) ?? []
                        const saldoCuota = Math.max(
                          Number(cuota.monto_programado ?? 0) -
                            Number(cuota.monto_pagado ?? 0),
                          0
                        )

                        return (
                          <div
                            key={cuota.id}
                            className="grid grid-cols-7 items-center"
                          >
                            <div className="px-4 py-3">
                              {cuota.numero_cuota}
                            </div>

                            <div className="px-4 py-3">
                              {formatDate(cuota.fecha_vencimiento)}
                            </div>

                            <div className="px-4 py-3">
                              {formatCLP(cuota.monto_programado)}
                            </div>

                            <div className="px-4 py-3">
                              {formatCLP(cuota.monto_pagado)}
                            </div>

                            <div className="px-4 py-3">
                              <span
                                className={
                                  cuota.estado === 'pendiente'
                                    ? 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700'
                                    : cuota.estado === 'parcial'
                                      ? 'rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700'
                                      : cuota.estado === 'pagada'
                                        ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700'
                                        : cuota.estado === 'descontada'
                                          ? 'rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700'
                                          : 'rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700'
                                }
                              >
                                {cuota.estado}
                              </span>
                            </div>

                            <div className="px-4 py-3 text-xs">
                              {abonosCuota.length > 0 ? (
                                <div className="space-y-2 text-slate-700">
                                  {abonosCuota.map((abono) => {
                                    const movimiento = movimientosPorId.get(
                                      abono.movimiento_banco_id
                                    )
                                    const movimientoReversa =
                                      abono.movimiento_reversa_id
                                        ? movimientosPorId.get(
                                            abono.movimiento_reversa_id
                                          )
                                        : undefined

                                    return (
                                      <div
                                        key={abono.id}
                                        className={
                                          abono.estado === 'reversado'
                                            ? 'rounded-lg border border-red-100 bg-red-50 p-2'
                                            : 'rounded-lg bg-slate-50 p-2'
                                        }
                                      >
                                        <p className="font-semibold text-slate-900">
                                          {formatCLP(abono.monto_aplicado)}
                                        </p>

                                        <p>{formatDate(abono.fecha_pago)}</p>

                                        <p className="text-slate-500">
                                          {movimiento?.numero_documento ||
                                            'Abono'}
                                        </p>

                                        {abono.estado === 'reversado' ? (
                                          <div className="mt-2 rounded-md bg-white/70 p-2 text-red-700">
                                            <p className="font-medium">
                                              Reversado
                                            </p>
                                            <p>
                                              {movimientoReversa?.numero_documento ||
                                                'Reversa registrada'}
                                            </p>
                                            <p>
                                              {formatDate(
                                                movimientoReversa?.fecha
                                              )}
                                            </p>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              reversarPagoPrestamo(
                                                abono.movimiento_banco_id
                                              )
                                            }
                                            disabled={
                                              reversingMovimientoId ===
                                              abono.movimiento_banco_id
                                            }
                                            className="mt-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                                          >
                                            {reversingMovimientoId ===
                                            abono.movimiento_banco_id
                                              ? 'Reversando...'
                                              : 'Reversar abono'}
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <span className="text-slate-400">
                                  Sin abonos
                                </span>
                              )}
                            </div>

                            <div className="px-4 py-3 font-medium text-slate-900">
                              {formatCLP(saldoCuota)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-center text-slate-500">
                      Este préstamo no tiene cuotas registradas.
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      ) : null}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Nuevo registro
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Préstamo o anticipo al trabajador
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Empresa activa: {empresaActivaNombre || 'Sin empresa activa'}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarFormulario}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={crearPrestamo} className="mt-5 space-y-5">
              {formError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {formError}
                </div>
              ) : null}

              <section className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(event) =>
                      handleChange(
                        'tipo',
                        event.target.value as 'prestamo' | 'anticipo'
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="prestamo">Préstamo</option>
                    <option value="anticipo">Anticipo</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Banco / cuenta de origen
                  </label>

                  <select
                    value={form.banco_id}
                    onChange={(event) =>
                      handleChange('banco_id', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">Seleccionar cuenta</option>

                    {bancos.map((banco) => (
                      <option key={banco.id} value={banco.id}>
                        {getBancoLabel(banco)}
                      </option>
                    ))}
                  </select>

                  <p className="mt-1 text-xs text-slate-500">
                    Esta cuenta quedará asociada como origen del dinero.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Nombre trabajador
                  </label>
                  <input
                    type="text"
                    value={form.trabajador_nombre}
                    onChange={(event) =>
                      handleChange('trabajador_nombre', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    placeholder="Ej: Juan Pérez"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    RUT trabajador
                  </label>
                  <input
                    type="text"
                    value={form.trabajador_rut}
                    onChange={(event) =>
                      handleChange('trabajador_rut', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    placeholder="Opcional"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Email trabajador
                  </label>
                  <input
                    type="email"
                    value={form.trabajador_email}
                    onChange={(event) =>
                      handleChange('trabajador_email', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    placeholder="Opcional"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Fecha otorgamiento
                  </label>
                  <input
                    type="date"
                    value={form.fecha_otorgamiento}
                    onChange={(event) =>
                      handleChange('fecha_otorgamiento', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Inicio pago / vencimiento primera cuota
                  </label>
                  <input
                    type="date"
                    value={form.fecha_inicio_descuento}
                    onChange={(event) =>
                      handleChange('fecha_inicio_descuento', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Monto
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.monto_original}
                    onChange={(event) =>
                      handleChange('monto_original', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    placeholder="Ej: 1000000"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {montoPreview > 0
                      ? formatCLP(montoPreview)
                      : 'Ingrese monto'}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Número de cuotas
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.numero_cuotas}
                    disabled={form.tipo === 'anticipo'}
                    onChange={(event) =>
                      handleChange('numero_cuotas', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Monto estimado por cuota:{' '}
                    <span className="font-medium">
                      {formatCLP(montoCuotaPreview)}
                    </span>
                  </p>
                </div>
              </section>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Observación
                </label>
                <textarea
                  value={form.observacion}
                  onChange={(event) =>
                    handleChange('observacion', event.target.value)
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  placeholder="Opcional. Ej: préstamo autorizado por trabajador, pago mensual por transferencia."
                />
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Resumen</p>
                <p className="mt-1">
                  Monto total:{' '}
                  <span className="font-semibold">
                    {formatCLP(montoPreview)}
                  </span>
                </p>
                <p>
                  Cuotas:{' '}
                  <span className="font-semibold">{cuotasPreview || 0}</span>
                </p>
                <p>
                  Valor aproximado cuota:{' '}
                  <span className="font-semibold">
                    {formatCLP(montoCuotaPreview)}
                  </span>
                </p>
                <p>
                  Origen del dinero:{' '}
                  <span className="font-semibold">
                    {form.banco_id
                      ? getBancoLabel(bancosPorId.get(form.banco_id))
                      : 'No seleccionado'}
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Este registro creará el préstamo, las cuotas y el egreso
                bancario asociado a la cuenta seleccionada. Los abonos se
                registrarán posteriormente como ingresos bancarios por
                transferencia.
              </div>

              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarFormulario}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Guardar préstamo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showAbonoForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Registrar abono
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Pago por transferencia
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Trabajador: {abonoForm.trabajador_nombre}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarFormularioAbono}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={registrarAbono} className="mt-5 space-y-5">
              {abonoError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {abonoError}
                </div>
              ) : null}

              <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                <p>
                  Saldo pendiente:{' '}
                  <span className="font-semibold text-slate-900">
                    {formatCLP(abonoForm.monto_saldo)}
                  </span>
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Monto recibido
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={abonoForm.monto_pago}
                  onChange={(event) =>
                    handleAbonoChange('monto_pago', event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  placeholder="Ej: 400000"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {montoAbonoPreview > 0
                    ? formatCLP(montoAbonoPreview)
                    : 'Ingrese el monto transferido'}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Fecha de pago
                </label>
                <input
                  type="date"
                  value={abonoForm.fecha_pago}
                  onChange={(event) =>
                    handleAbonoChange('fecha_pago', event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Cuenta bancaria destino
                </label>
                <select
                  value={abonoForm.cuenta_bancaria_id}
                  onChange={(event) =>
                    handleAbonoChange('cuenta_bancaria_id', event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                >
                  <option value="">Seleccionar cuenta</option>

                  {bancos.map((banco) => (
                    <option key={banco.id} value={banco.id}>
                      {getBancoLabel(banco)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                El abono se aplicará automáticamente a las cuotas pendientes más
                antiguas. Si el monto supera una cuota, el saldo restante se
                aplicará a la siguiente.
              </div>

              {montoAbonoPreview > saldoAbonoPreview ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  El monto recibido supera el saldo pendiente del préstamo.
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarFormularioAbono}
                  disabled={savingAbono}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingAbono || montoAbonoPreview > saldoAbonoPreview}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingAbono ? 'Registrando...' : 'Registrar abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}