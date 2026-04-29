import { createHash } from 'crypto'
import * as XLSX from 'xlsx'

export type BancoFormato = 'auto' | 'bci' | 'bancoestado'

export type MovimientoCartolaNormalizado = {
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
  hashMovimiento: string
}

export type ResultadoImportadorCartola = {
  formatoDetectado: 'bci' | 'bancoestado' | 'generico'
  bancoDetectado: string
  filas: MovimientoCartolaNormalizado[]
}

function normalizarTexto(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function limpiarTexto(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function parseNumero(value: unknown) {
  if (typeof value === 'number') return value

  const raw = String(value ?? '').trim()
  if (!raw) return 0

  const cleaned = raw
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')

  const parsed = Number(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

function parseFecha(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const match = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (!match) return ''

  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  const year = match[3].length === 2 ? `20${match[3]}` : match[3]

  return `${year}-${month}-${day}`
}

function extraerRut(text: string) {
  const match = text.match(/\b(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]|\d{7,8}-[\dkK])\b/)
  if (!match) return null

  return match[1].replace(/\./g, '').toUpperCase()
}

function detectarNombre(text: string) {
  const cleaned = limpiarTexto(text)

  const deMatch = cleaned.match(/(?:transfer(?:encia)? de|de)\s+(.+)$/i)
  if (deMatch?.[1]) return deMatch[1].trim()

  return null
}

function getIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) =>
    candidates.some((candidate) => header.includes(candidate))
  )
}

function buildHash(params: {
  cuentaBancariaId: string
  fecha: string
  descripcion: string
  numeroDocumento: string | null
  cargo: number
  abono: number
  saldo: number | null
}) {
  const base = [
    params.cuentaBancariaId,
    params.fecha,
    params.descripcion,
    params.numeroDocumento ?? '',
    params.cargo,
    params.abono,
    params.saldo ?? '',
  ].join('|')

  return createHash('sha256').update(base).digest('hex')
}

function detectarHeaderRow(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 60); i += 1) {
    const headers = (rows[i] ?? []).map(normalizarTexto)

    const hasFecha = headers.some((item) => item.includes('fecha'))
    const hasDescripcion = headers.some((item) => item.includes('descripcion'))
    const hasCargo = headers.some((item) => item.includes('cargo') || item.includes('cheque'))
    const hasAbono = headers.some((item) => item.includes('abono') || item.includes('deposito'))

    if (hasFecha && hasDescripcion && hasCargo && hasAbono) {
      return i
    }
  }

  return -1
}

function detectarFormato(headers: string[], requested: BancoFormato): 'bci' | 'bancoestado' | 'generico' {
  if (requested === 'bci') return 'bci'
  if (requested === 'bancoestado') return 'bancoestado'

  const joined = headers.join(' ')

  if (joined.includes('cheques') || joined.includes('depositos y abono')) {
    return 'bci'
  }

  if (joined.includes('n operacion') || joined.includes('operacion')) {
    return 'bancoestado'
  }

  return 'generico'
}

export function parseCartolaExcel(params: {
  buffer: Buffer
  formato: BancoFormato
  cuentaBancariaId: string
}): ResultadoImportadorCartola {
  const workbook = XLSX.read(params.buffer, {
    type: 'buffer',
    cellDates: true,
  })

  const preferredSheet =
    workbook.SheetNames.find((name) => normalizarTexto(name).includes('registros')) ||
    workbook.SheetNames.find((name) => normalizarTexto(name).includes('cartola')) ||
    workbook.SheetNames[0]

  if (!preferredSheet) {
    throw new Error('El archivo Excel no contiene hojas válidas.')
  }

  const worksheet = workbook.Sheets[preferredSheet]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  })

  const headerRowIndex = detectarHeaderRow(rows)

  if (headerRowIndex < 0) {
    throw new Error('No se pudo detectar la fila de encabezados de la cartola.')
  }

  const headers = (rows[headerRowIndex] ?? []).map(normalizarTexto)
  const formatoDetectado = detectarFormato(headers, params.formato)

  const idxFecha = getIndex(headers, ['fecha'])
  const idxSucursal = getIndex(headers, ['sucursal'])
  const idxOperacion = getIndex(headers, ['n operacion', 'operacion', 'documento'])
  const idxDescripcion = getIndex(headers, ['descripcion'])
  const idxCargo = getIndex(headers, ['cargos', 'cargo', 'cheques y otros cargos', 'cheques'])
  const idxAbono = getIndex(headers, ['abonos', 'abono', 'depositos y abono', 'depositos'])
  const idxSaldo = getIndex(headers, ['saldo', 'saldo diario'])

  if (idxFecha < 0 || idxDescripcion < 0 || idxCargo < 0 || idxAbono < 0) {
    throw new Error('La cartola no tiene columnas mínimas: fecha, descripción, cargo y abono.')
  }

  const filas: MovimientoCartolaNormalizado[] = []

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []

    const fecha = parseFecha(row[idxFecha])
    const descripcionOriginal = limpiarTexto(row[idxDescripcion])
    const cargo = Math.abs(parseNumero(row[idxCargo]))
    const abono = Math.abs(parseNumero(row[idxAbono]))
    const saldo = idxSaldo >= 0 ? parseNumero(row[idxSaldo]) : null

    if (!fecha || !descripcionOriginal) continue
    if (cargo === 0 && abono === 0) continue

    const sucursal = idxSucursal >= 0 ? limpiarTexto(row[idxSucursal]) || null : null
    const numeroDocumento = idxOperacion >= 0 ? limpiarTexto(row[idxOperacion]) || null : null
    const rutDetectado = extraerRut(descripcionOriginal)
    const nombreDetectado = detectarNombre(descripcionOriginal)
    const tipoDetectado = abono > 0 ? 'abono' : 'cargo'

    filas.push({
      filaOrigen: rowIndex + 1,
      fecha,
      sucursal,
      numeroDocumento,
      descripcionOriginal,
      rutDetectado,
      nombreDetectado,
      cargo,
      abono,
      saldo,
      tipoDetectado,
      hashMovimiento: buildHash({
        cuentaBancariaId: params.cuentaBancariaId,
        fecha,
        descripcion: descripcionOriginal,
        numeroDocumento,
        cargo,
        abono,
        saldo,
      }),
    })
  }

  return {
    formatoDetectado,
    bancoDetectado:
      formatoDetectado === 'bci'
        ? 'BCI'
        : formatoDetectado === 'bancoestado'
          ? 'BancoEstado'
          : 'Generico',
    filas,
  }
}