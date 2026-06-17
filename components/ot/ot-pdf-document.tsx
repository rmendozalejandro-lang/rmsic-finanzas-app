import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

type ResumenLike = {
  cliente_nombre?: string | null
  ubicacion_nombre?: string | null
  activo_nombre?: string | null
  tecnico_nombre?: string | null
  tipo_servicio_nombre?: string | null
}

type OTDetallePdf = {
  folio: string | null
  tipo_servicio_id: string
  fecha_ot: string
  titulo: string
  descripcion_solicitud: string | null
  problema_reportado: string | null
  diagnostico: string | null
  causa_probable: string | null
  trabajo_realizado: string | null
  recomendaciones: string | null
  tecnico_responsable_id: string | null
  hora_inicio: string | null
  hora_termino: string | null
  cliente_nombre_firma: string | null
  cliente_cargo_firma: string | null
  observaciones_cierre: string | null
  contacto_cliente_nombre: string | null
  contacto_cliente_cargo: string | null
  area_trabajo: string | null
  resultado_servicio: string | null
  hallazgos: string | null
  conclusiones_tecnicas: string | null
  mostrar_nota_valor_hora: boolean
  valor_hora_uf: number | null
}

type EvidenciaPdf = {
  id: string
  tipo: 'antes' | 'durante' | 'despues' | 'documento' | 'otro'
  archivo_url: string
  archivo_nombre: string | null
  descripcion: string | null
  orden: number
}

type FirmaPdf = {
  id: string
  tipo_firma: 'tecnico' | 'cliente' | 'supervisor'
  nombre_firmante: string | null
  cargo_firmante: string | null
  firma_url: string
  fecha_firma: string
}

type TipoServicioPdf = {
  id: string
  codigo: string
  nombre: string
}

type ChecklistRow = {
  sistema: string
  frecuencia: string
  actividad: string
  estado: string
  observacion: string
}

export type OTPdfDocumentProps = {
  resumen: ResumenLike
  detalle: OTDetallePdf
  evidencias: EvidenciaPdf[]
  firmas: FirmaPdf[]
  perfilesMap: Record<string, string>
  tiposServicio: TipoServicioPdf[]
  logoUrl: string
}

Font.registerHyphenationCallback((word) => [word])

const COLORS = {
  primary: '#2f5877',
  primaryDark: '#24445e',
  primarySoft: '#eaf2f8',
  slate900: '#0f172a',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate300: '#cbd5e1',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  white: '#ffffff',
  amber50: '#fffbeb',
  amber300: '#fcd34d',
  amber800: '#92400e',
  green50: '#ecfdf5',
  green700: '#047857',
  red50: '#fef2f2',
  red700: '#b91c1c',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 30,
    paddingHorizontal: 30,
    fontSize: 9.3,
    fontFamily: 'Helvetica',
    color: COLORS.slate900,
    backgroundColor: COLORS.white,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 12,
  },

  headerLeft: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    maxWidth: 355,
  },

  logoBox: {
    width: 78,
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    borderRadius: 10,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },

  logo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },

  headerTextWrap: {
    marginLeft: 13,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },

  company: {
    fontSize: 7.5,
    color: COLORS.slate500,
    fontWeight: 700,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },

  mainTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginTop: 5,
    color: COLORS.primaryDark,
    lineHeight: 1.15,
    textTransform: 'uppercase',
  },

  subTitle: {
    fontSize: 9.2,
    color: COLORS.slate600,
    marginTop: 6,
    lineHeight: 1.35,
  },

  headerCard: {
    width: 176,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    backgroundColor: COLORS.slate50,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },

  headerCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  headerMetaLeft: {
    width: 70,
  },

  headerMetaRight: {
    width: 82,
  },

  fieldLabel: {
    fontSize: 6.8,
    color: COLORS.slate500,
    fontWeight: 700,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    lineHeight: 1.25,
  },

  fieldValue: {
    fontSize: 9.2,
    color: COLORS.slate900,
    marginTop: 3,
    lineHeight: 1.3,
    fontWeight: 700,
  },

  section: {
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 10.2,
    fontWeight: 700,
    letterSpacing: 0.75,
    marginBottom: 8,
    color: COLORS.primaryDark,
    backgroundColor: COLORS.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    textTransform: 'uppercase',
  },

  sectionPanel: {
    borderWidth: 1,
    borderColor: COLORS.slate200,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  infoCell: {
    width: '50%',
    minHeight: 49,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.slate200,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.white,
  },

  infoCellWide: {
    width: '100%',
    minHeight: 49,
    borderBottomWidth: 1,
    borderColor: COLORS.slate200,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.white,
  },

  textBlock: {
    borderWidth: 1,
    borderColor: COLORS.slate200,
    borderRadius: 10,
    marginBottom: 9,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },

  textBlockTitleWrap: {
    backgroundColor: COLORS.slate50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate200,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  textBlockTitle: {
    fontSize: 8.2,
    fontWeight: 700,
    letterSpacing: 0.9,
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
  },

  textBlockBody: {
    fontSize: 9.4,
    lineHeight: 1.5,
    color: COLORS.slate700,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },

  noteBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.amber300,
    borderRadius: 10,
    padding: 10,
    backgroundColor: COLORS.amber50,
  },

  noteText: {
    fontSize: 9,
    lineHeight: 1.45,
    color: COLORS.amber800,
  },

  checklistTable: {
    borderWidth: 1,
    borderColor: COLORS.slate200,
    borderRadius: 10,
    overflow: 'hidden',
  },

  checklistHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.slate50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate200,
  },

  checklistRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate200,
    minHeight: 31,
  },

  th: {
    fontSize: 6.5,
    fontWeight: 700,
    color: COLORS.slate700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },

  td: {
    fontSize: 7.8,
    color: COLORS.slate700,
    lineHeight: 1.35,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },

  colSistema: {
    width: '19%',
    borderRightWidth: 1,
    borderRightColor: COLORS.slate200,
  },

  colFrecuencia: {
    width: '8%',
    borderRightWidth: 1,
    borderRightColor: COLORS.slate200,
  },

  colActividad: {
    width: '37%',
    borderRightWidth: 1,
    borderRightColor: COLORS.slate200,
  },

  colEstado: {
    width: '9%',
    borderRightWidth: 1,
    borderRightColor: COLORS.slate200,
  },

  colObs: {
    width: '27%',
  },

  statusOk: {
    color: COLORS.green700,
    fontWeight: 700,
  },

  statusNoOk: {
    color: COLORS.red700,
    fontWeight: 700,
  },

  photoGroupWrap: {
    marginBottom: 12,
  },

  photoGroupTitle: {
    fontSize: 8.8,
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 7,
    color: COLORS.primary,
    textTransform: 'uppercase',
  },

  photoCard: {
    borderWidth: 1,
    borderColor: COLORS.slate200,
    borderRadius: 11,
    marginBottom: 15,
    backgroundColor: COLORS.white,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },

  photoImage: {
    width: 460,
    height: 250,
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: 10,
  },

  photoBody: {
    borderTopWidth: 1,
    borderTopColor: COLORS.slate200,
    paddingTop: 9,
  },

  photoTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.slate900,
    marginBottom: 4,
    lineHeight: 1.35,
  },

  photoText: {
    fontSize: 8.8,
    lineHeight: 1.4,
    color: COLORS.slate700,
    marginTop: 3,
  },

  photoFileName: {
    fontSize: 8,
    lineHeight: 1.35,
    color: COLORS.slate500,
    marginTop: 3,
  },

  receptionWrap: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },

  receptionCard: {
    borderWidth: 1,
    borderColor: COLORS.slate200,
    borderRadius: 12,
    padding: 14,
    backgroundColor: COLORS.white,
  },

  receptionNote: {
    fontSize: 8.6,
    lineHeight: 1.4,
    color: COLORS.slate600,
    marginBottom: 9,
  },

  signatureBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 72,
    justifyContent: 'center',
  },

  signatureImage: {
    width: '100%',
    height: 56,
    objectFit: 'contain',
  },

  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate300,
    width: '100%',
    height: 40,
  },

  footer: {
    position: 'absolute',
    bottom: 12,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate200,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  footerText: {
    fontSize: 7,
    color: COLORS.slate500,
  },
})

const MONTHS_ES_CL = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function formatDate(value: string | null) {
  if (!value) return '-'

  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (match) {
    const year = match[1]
    const monthIndex = Number(match[2]) - 1
    const day = Number(match[3])
    const monthName = MONTHS_ES_CL[monthIndex]

    if (monthName && Number.isFinite(day)) {
      return `${day} de ${monthName} de ${year}`
    }
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'long',
    timeZone: 'America/Santiago',
  }).format(date)
}

function formatTime(value: string | null) {
  if (!value) return '-'

  const trimmed = value.trim()
  const match = trimmed.match(/T(\d{2}):(\d{2})/)

  if (match) {
    return `${match[1]}:${match[2]}`
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago',
  }).format(date)
}

function labelOrDash(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'
  return value
}

function isImageFile(url: string, fileName?: string | null) {
  const value = `${url} ${fileName ?? ''}`.toLowerCase()
  return (
    value.includes('.jpg') ||
    value.includes('.jpeg') ||
    value.includes('.png') ||
    value.includes('.webp') ||
    value.includes('.gif') ||
    value.includes('.bmp') ||
    value.includes('.svg')
  )
}

function toTitleCase(text: string) {
  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function humanizePerson(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'

  const raw = value.trim()
  const lower = raw.toLowerCase()

  const knownMap: Record<string, string> = {
    'rmendoza@rmsic.cl': 'Raúl Mendoza',
    'dallendes@rmsic.cl': 'David Allendes',
    'rmendozaalejandro@gmail.com': 'Raúl Mendoza',
    'raul mendoza': 'Raúl Mendoza',
    'raúl mendoza': 'Raúl Mendoza',
    'raul mendoza c.': 'Raúl Mendoza',
    'raúl mendoza c.': 'Raúl Mendoza',
    'david allendes': 'David Allendes',
    'david allendes a.': 'David Allendes',
    'rmendoza': 'Raúl Mendoza',
    'dallendes': 'David Allendes',
  }

  if (knownMap[lower]) return knownMap[lower]

  if (
    lower.includes('rmendoza') ||
    (lower.includes('raul') && lower.includes('mendoza')) ||
    (lower.includes('raúl') && lower.includes('mendoza'))
  ) {
    return 'Raúl Mendoza'
  }

  if (lower.includes('dallendes') || (lower.includes('david') && lower.includes('allendes'))) {
    return 'David Allendes'
  }

  if (raw.includes('@')) {
    const localPart = raw.split('@')[0].toLowerCase().trim()

    if (knownMap[localPart]) return knownMap[localPart]

    const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return toTitleCase(cleaned)
  }

  return raw
}

function splitObservacionesAndChecklist(value: string | null | undefined) {
  const raw = value?.trim() ?? ''

  if (!raw) {
    return {
      observaciones: '',
      checklistRows: [] as ChecklistRow[],
    }
  }

  const marker = 'CHECKLIST DE MANTENIMIENTO'
  const markerIndex = raw.toUpperCase().indexOf(marker)

  if (markerIndex < 0) {
    return {
      observaciones: raw,
      checklistRows: [] as ChecklistRow[],
    }
  }

  const observaciones = raw.slice(0, markerIndex).trim()
  const checklistText = raw.slice(markerIndex + marker.length).trim()

  const checklistRows = checklistText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim())

      const sistema = parts[0] || 'General'
      const frecuencia = parts[1] || '-'
      const actividad = parts[2] || line
      const estado = parts[3] || '-'
      const observacion = parts
        .slice(4)
        .join(' | ')
        .replace(/^Obs:\s*/i, '')
        .trim()

      return {
        sistema,
        frecuencia,
        actividad,
        estado,
        observacion,
      }
    })

  return {
    observaciones,
    checklistRows,
  }
}

function InfoCell({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string | number | null | undefined
  wide?: boolean
}) {
  if (value == null || value === '' || value === '-') return null

  return (
    <View style={wide ? styles.infoCellWide : styles.infoCell}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{String(value)}</Text>
    </View>
  )
}

function TextBlock({
  title,
  value,
}: {
  title: string
  value: string | null | undefined
}) {
  if (!value || !value.trim()) return null

  return (
    <View style={styles.textBlock}>
      <View style={styles.textBlockTitleWrap}>
        <Text style={styles.textBlockTitle}>{title}</Text>
      </View>
      <Text style={styles.textBlockBody}>{value}</Text>
    </View>
  )
}

function ChecklistTable({ rows }: { rows: ChecklistRow[] }) {
  if (rows.length === 0) return null

  return (
    <View style={styles.section} break>
      <Text style={styles.sectionTitle}>CHECKLIST DE MANTENIMIENTO</Text>

      <View style={styles.checklistTable}>
        <View style={styles.checklistHeader}>
          <Text style={[styles.th, styles.colSistema]}>Sistema</Text>
          <Text style={[styles.th, styles.colFrecuencia]}>Frec.</Text>
          <Text style={[styles.th, styles.colActividad]}>Actividad</Text>
          <Text style={[styles.th, styles.colEstado]}>Estado</Text>
          <Text style={[styles.th, styles.colObs]}>Observación</Text>
        </View>

        {rows.map((row, index) => {
          const estadoLower = row.estado.toLowerCase()
          const estadoStyle = estadoLower.includes('ok')
            ? styles.statusOk
            : estadoLower.includes('no')
              ? styles.statusNoOk
              : null

          return (
            <View key={`${row.sistema}-${row.actividad}-${index}`} style={styles.checklistRow} wrap={false}>
              <Text style={[styles.td, styles.colSistema]}>{row.sistema || '-'}</Text>
              <Text style={[styles.td, styles.colFrecuencia]}>{row.frecuencia || '-'}</Text>
              <Text style={[styles.td, styles.colActividad]}>{row.actividad || '-'}</Text>
              <Text style={[styles.td, styles.colEstado, estadoStyle]}>{row.estado || '-'}</Text>
              <Text style={[styles.td, styles.colObs]}>{row.observacion || '-'}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function PhotoCard({ item }: { item: EvidenciaPdf }) {
  const descripcion = item.descripcion?.trim() ?? ''
  const nombreArchivo = item.archivo_nombre?.trim() ?? 'Registro fotográfico'

  return (
    <View wrap={false} style={styles.photoCard}>
      <Image src={item.archivo_url} style={styles.photoImage} />

      <View style={styles.photoBody}>
        <Text style={styles.photoTitle}>
          {descripcion || nombreArchivo}
        </Text>

        {descripcion ? (
          <Text style={styles.photoFileName}>{nombreArchivo}</Text>
        ) : (
          <Text style={styles.photoText}>Sin detalle informado.</Text>
        )}
      </View>
    </View>
  )
}

function PhotoGroup({
  title,
  items,
}: {
  title: string
  items: EvidenciaPdf[]
}) {
  if (items.length === 0) return null

  const [firstItem, ...restItems] = items

  return (
    <View style={styles.photoGroupWrap}>
      {firstItem ? (
        <View wrap={false}>
          <Text style={styles.photoGroupTitle}>{title}</Text>
          <PhotoCard item={firstItem} />
        </View>
      ) : null}

      {restItems.map((item) => (
        <PhotoCard key={item.id} item={item} />
      ))}
    </View>
  )
}

export function OTPdfDocument({
  resumen,
  detalle,
  evidencias,
  firmas,
  perfilesMap,
  tiposServicio,
  logoUrl,
}: OTPdfDocumentProps) {
  const tipoActual =
    tiposServicio.find((item) => item.id === detalle.tipo_servicio_id) ?? null

  const tipoCodigo = tipoActual?.codigo ?? ''
  const tipoNombre = tipoActual?.nombre ?? resumen.tipo_servicio_nombre ?? '-'

  const isPreventiva = tipoCodigo === 'preventiva'
  const isUrgencia = tipoCodigo === 'urgencia'
  const isAsistencia = tipoCodigo === 'general'
  const isUrgenciaOAsistencia = isUrgencia || isAsistencia
  const isAsesoria = tipoCodigo === 'asesoria'

  const evidenciasImagenes = evidencias.filter((item) =>
    isImageFile(item.archivo_url, item.archivo_nombre)
  )

  const fotosAntes = evidenciasImagenes.filter((item) => item.tipo === 'antes')
  const fotosDurante = evidenciasImagenes.filter((item) => item.tipo === 'durante')
  const fotosDespues = evidenciasImagenes.filter((item) => item.tipo === 'despues')
  const otrasFotos = evidenciasImagenes.filter(
    (item) =>
      item.tipo !== 'antes' && item.tipo !== 'durante' && item.tipo !== 'despues'
  )

  const firmaCliente =
    firmas.find((item) => item.tipo_firma === 'cliente') ?? null

  const nombreTecnico = humanizePerson(
    (detalle.tecnico_responsable_id
      ? perfilesMap[detalle.tecnico_responsable_id] || detalle.tecnico_responsable_id
      : null) ||
      resumen.tecnico_nombre ||
      '-'
  )

  const areaTrabajo =
    detalle.area_trabajo || resumen.ubicacion_nombre || resumen.activo_nombre || '-'

  const nombreRecepcion = humanizePerson(
    firmaCliente?.nombre_firmante ||
      detalle.cliente_nombre_firma ||
      detalle.contacto_cliente_nombre ||
      '-'
  )

  const cargoRecepcion =
    firmaCliente?.cargo_firmante ||
    detalle.cliente_cargo_firma ||
    detalle.contacto_cliente_cargo ||
    '-'

  const { observaciones, checklistRows } = splitObservacionesAndChecklist(
    detalle.observaciones_cierre
  )

  return (
    <Document
      title={`${detalle.folio || 'OT'} - ${resumen.cliente_nombre || 'Cliente'} - ${detalle.titulo}`}
      author="RM Servicios de Ingeniería y Construcción SpA"
      subject="Informe técnico de servicio en terreno"
      creator="Auren / RMSIC"
      producer="Auren / RMSIC"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBox}>
              <Image src={logoUrl} style={styles.logo} />
            </View>

            <View style={styles.headerTextWrap}>
              <Text style={styles.company}>
                RM SERVICIOS DE INGENIERÍA Y CONSTRUCCIÓN SPA
              </Text>
              <Text style={styles.mainTitle}>Informe técnico de servicio</Text>
              <Text style={styles.subTitle}>{detalle.titulo}</Text>
            </View>
          </View>

          <View style={styles.headerCard}>
            <View style={styles.headerCardRow}>
              <View style={styles.headerMetaLeft}>
                <Text style={styles.fieldLabel}>Folio OT</Text>
                <Text style={styles.fieldValue}>{detalle.folio || '-'}</Text>
              </View>

              <View style={styles.headerMetaRight}>
                <Text style={styles.fieldLabel}>Fecha</Text>
                <Text style={styles.fieldValue}>{formatDate(detalle.fecha_ot)}</Text>
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>Tipo de servicio</Text>
              <Text style={styles.fieldValue}>{tipoNombre}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATOS DEL CLIENTE Y SERVICIO</Text>

          <View style={styles.sectionPanel}>
            <View style={styles.infoGrid}>
              <InfoCell label="Razón social" value={resumen.cliente_nombre} />
              <InfoCell label="Fecha visita" value={formatDate(detalle.fecha_ot)} />
              <InfoCell label="Hora inicio" value={formatTime(detalle.hora_inicio)} />
              <InfoCell label="Hora término" value={formatTime(detalle.hora_termino)} />
              <InfoCell label="Técnico ejecutante" value={nombreTecnico} />
              <InfoCell label="Área / sector" value={areaTrabajo} />
            </View>
          </View>
        </View>

        {isPreventiva ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESARROLLO DE LA ACTIVIDAD</Text>
            <TextBlock
              title="Objetivo del mantenimiento"
              value={detalle.descripcion_solicitud}
            />
            <TextBlock
              title="Actividades ejecutadas"
              value={detalle.trabajo_realizado}
            />
            <TextBlock title="Hallazgos detectados" value={detalle.hallazgos} />
            <TextBlock
              title="Resultado del servicio"
              value={detalle.resultado_servicio}
            />
            <TextBlock title="Recomendaciones" value={detalle.recomendaciones} />
            <TextBlock title="Observaciones" value={observaciones} />
          </View>
        ) : null}

        {isUrgenciaOAsistencia ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESARROLLO DE LA ACTIVIDAD</Text>
            <TextBlock
              title="Solicitud del cliente"
              value={detalle.descripcion_solicitud}
            />
            <TextBlock
              title="Problema detectado"
              value={detalle.problema_reportado}
            />
            <TextBlock title="Causa probable" value={detalle.causa_probable} />
            <TextBlock
              title="Solución implementada"
              value={detalle.trabajo_realizado}
            />
            <TextBlock
              title="Resultado del servicio"
              value={detalle.resultado_servicio}
            />
            <TextBlock title="Recomendaciones" value={detalle.recomendaciones} />
            <TextBlock title="Observaciones" value={observaciones} />

            {detalle.mostrar_nota_valor_hora ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>
                  <Text style={{ fontWeight: 700 }}>
                    Nota comercial informativa:{' '}
                  </Text>
                  Este servicio fue atendido bajo modalidad de atención inmediata
                  en terreno. El valor referencial de atención corresponde a{' '}
                  <Text style={{ fontWeight: 700 }}>
                    {labelOrDash(
                      detalle.valor_hora_uf != null
                        ? `${detalle.valor_hora_uf} UF por hora`
                        : null
                    )}
                  </Text>
                  , salvo acuerdo comercial, cotización previa o condiciones
                  particulares pactadas con el cliente.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {isAsesoria ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESARROLLO DE LA ASESORÍA</Text>
            <TextBlock
              title="Objetivo de la asesoría"
              value={detalle.descripcion_solicitud}
            />
            <TextBlock
              title="Antecedentes observados"
              value={detalle.problema_reportado}
            />
            <TextBlock title="Análisis técnico" value={detalle.diagnostico} />
            <TextBlock
              title="Conclusiones técnicas"
              value={detalle.conclusiones_tecnicas}
            />
            <TextBlock title="Recomendaciones" value={detalle.recomendaciones} />
            <TextBlock title="Observaciones" value={observaciones} />
          </View>
        ) : null}

        {!isPreventiva && !isUrgenciaOAsistencia && !isAsesoria ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESARROLLO DE LA ACTIVIDAD</Text>
            <TextBlock
              title="Solicitud del cliente"
              value={detalle.descripcion_solicitud}
            />
            <TextBlock
              title="Problema detectado"
              value={detalle.problema_reportado}
            />
            <TextBlock title="Diagnóstico" value={detalle.diagnostico} />
            <TextBlock
              title="Solución implementada"
              value={detalle.trabajo_realizado}
            />
            <TextBlock
              title="Resultado del servicio"
              value={detalle.resultado_servicio}
            />
            <TextBlock title="Recomendaciones" value={detalle.recomendaciones} />
            <TextBlock title="Observaciones" value={observaciones} />
          </View>
        ) : null}

        <ChecklistTable rows={checklistRows} />

        {evidenciasImagenes.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REGISTRO FOTOGRÁFICO</Text>
            <PhotoGroup title="Antes" items={fotosAntes} />
            <PhotoGroup title="Durante" items={fotosDurante} />
            <PhotoGroup title="Después" items={fotosDespues} />
            <PhotoGroup title="Otras evidencias" items={otrasFotos} />
          </View>
        ) : null}

        <View wrap={false} style={styles.section}>
          <Text style={styles.sectionTitle}>RECEPCIÓN Y CONFORMIDAD DEL SERVICIO</Text>

          <View style={styles.receptionWrap}>
            <View style={styles.receptionCard}>
              <Text style={styles.receptionNote}>
                El cliente declara recepción del servicio indicado en este informe, de acuerdo con los antecedentes, evidencias y observaciones registradas.
              </Text>

              <Text style={styles.fieldLabel}>Nombre receptor</Text>
              <Text style={styles.fieldValue}>{labelOrDash(nombreRecepcion)}</Text>

              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Cargo</Text>
              <Text style={styles.fieldValue}>{labelOrDash(cargoRecepcion)}</Text>

              <View style={styles.signatureBox}>
                {firmaCliente?.firma_url ? (
                  <Image src={firmaCliente.firma_url} style={styles.signatureImage} />
                ) : (
                  <View style={styles.signatureLine} />
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>RM Servicios de Ingeniería y Construcción SpA · Informe generado desde Auren OT</Text>
          <Text style={styles.footerText}>{detalle.folio || 'OT'}</Text>
        </View>
      </Page>
    </Document>
  )
}
