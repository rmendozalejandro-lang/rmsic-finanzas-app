import React from 'react'
import { Document, Font, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'

export type PTSPdfRisk = {
  paso: number
  actividad: string
  peligros: string
  riesgos: string
  medidas_preventivas: string
}

export type PTSPdfPerson = {
  nombre_apellido: string
  rut: string
  induccion_ingreso_ok: boolean
  charla_5_min_ok: boolean
  examen_altura_vigente_hasta: string | null
}

export type PTSPdfApproval = {
  etapa: string
  estado: string
  observacion: string | null
  responsable_nombre: string | null
  firmado_at: string | null
}

export type PTSPdfHistory = {
  evento: string
  detalle: string | null
  created_at: string
  usuario_nombre: string | null
}

export type PTSPdfData = {
  folio: number
  estado: string
  empresa_nombre: string
  trabajo_a_realizar: string
  tipo_actividad: string
  lugar_ejecucion: string
  empresa_contratista: string
  fecha_inicio: string
  fecha_termino: string | null
  hora_inicio: string | null
  hora_termino: string | null
  observaciones: string | null
  iniciado_at: string | null
  cerrado_at: string | null
  iniciado_por_nombre: string | null
  cerrado_por_nombre: string | null
  cierre_observaciones: string | null
  riesgos: PTSPdfRisk[]
  personal: PTSPdfPerson[]
  epp: string[]
  aprobaciones: PTSPdfApproval[]
  historial: PTSPdfHistory[]
  verificationUrl: string
  qrPath: string
  qrViewBoxSize: number
}

Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingRight: 28,
    paddingBottom: 30,
    paddingLeft: 28,
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: '#1f2937',
    lineHeight: 1.35,
  },
  header: {
    backgroundColor: '#0B2947',
    color: '#ffffff',
    padding: 14,
    borderRadius: 5,
    marginBottom: 12,
  },
  brand: {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: '#67e8f9',
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    marginTop: 7,
    lineHeight: 1.2,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 8.5,
    color: '#dbeafe',
  },
  row: { flexDirection: 'row' },
  rowCards: { flexDirection: 'row', justifyContent: 'space-between' },
  grow: { flexGrow: 1, flexBasis: 0 },
  card: {
    border: '1 solid #dbe3ea',
    borderRadius: 5,
    padding: 9,
    marginBottom: 10,
  },
  halfCard: { width: '49%' },
  fieldRight: { marginLeft: 10 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0B2947',
    marginBottom: 6,
  },
  label: {
    fontSize: 6.8,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: { fontSize: 8.5, marginTop: 2 },
  field: { marginBottom: 6 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottom: '1 solid #cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
  },
  cell: {
    paddingTop: 4,
    paddingRight: 4,
    paddingBottom: 4,
    paddingLeft: 4,
    fontSize: 7.1,
    lineHeight: 1.25,
  },
  cStep: { width: '6%' },
  cAct: { width: '20%' },
  cHaz: { width: '20%' },
  cRisk: { width: '20%' },
  cPrev: { width: '34%' },
  personBlock: { marginBottom: 7 },
  personName: { fontWeight: 700, fontSize: 8.1 },
  personMeta: { marginTop: 2, fontSize: 7.2, color: '#64748b' },
  pills: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: {
    paddingTop: 3,
    paddingRight: 6,
    paddingBottom: 3,
    paddingLeft: 6,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    color: '#047857',
    marginRight: 4,
    marginBottom: 4,
    fontSize: 7.5,
  },
  approvalBlock: { marginBottom: 7 },
  approvalName: { fontSize: 8.2, fontWeight: 700 },
  approvalMeta: { marginTop: 2, fontSize: 7.2, color: '#64748b' },
  historyBlock: { marginBottom: 6 },
  muted: { color: '#64748b' },
  footerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    border: '1 solid #cbd5e1',
    borderRadius: 5,
    padding: 9,
    marginTop: 10,
  },
  qr: { width: 82, height: 82, backgroundColor: '#ffffff' },
  verifyContent: { flexGrow: 1, flexBasis: 0, marginLeft: 12 },
  verifyTitle: { fontSize: 9, fontWeight: 700, color: '#0B2947' },
  verifyText: { marginTop: 3, fontSize: 7, color: '#64748b' },
  verifyCode: { marginTop: 5, fontSize: 6.8, color: '#475569' },
  pageNumber: {
    position: 'absolute',
    right: 28,
    bottom: 16,
    fontSize: 7,
    color: '#94a3b8',
  },
})

const etapaLabel: Record<string, string> = {
  supervisor_contratista: 'Supervisor contratista',
  coordinador_contratista: 'Coordinador contratista',
  jefatura_area: 'Jefatura del área',
  seguridad: 'Seguridad y Salud',
}

const eventoLabel: Record<string, string> = {
  pts_creado: 'PTS creado',
  enviado_revision: 'Enviado a revisión',
  revision_observada: 'Revisión observada',
  correccion_guardada: 'Corrección guardada',
  revision_aprobada: 'Revisión aprobada',
  revision_rechazada: 'Revisión rechazada',
  trabajo_iniciado: 'Trabajo iniciado',
  trabajo_cerrado: 'Trabajo cerrado',
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return '—'
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  return `${match[3]}-${match[2]}-${match[1]}`
}

function formatDateRange(start: string, end: string | null) {
  if (!end || start === end) return formatDateOnly(start)
  return `${formatDateOnly(start)} al ${formatDateOnly(end)}`
}

function formatTimeOnly(value: string | null | undefined) {
  if (!value) return '—'
  const match = value.trim().match(/^(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : value
}

function formatTimeRange(start: string | null, end: string | null) {
  if (!start && !end) return '—'
  if (!start) return formatTimeOnly(end)
  if (!end) return formatTimeOnly(start)
  return `${formatTimeOnly(start)} a ${formatTimeOnly(end)}`
}

function dt(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})

  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}`
}

function approvalStatus(value: string) {
  if (value === 'aprobado') return 'Aprobado'
  if (value === 'observado') return 'Observado'
  if (value === 'rechazado') return 'Rechazado'
  if (value === 'pendiente') return 'Pendiente'
  return value
}

function shouldShowHistoryDetail(item: PTSPdfHistory) {
  if (!item.detalle) return false
  if (
    item.evento === 'trabajo_iniciado' &&
    item.detalle.toLowerCase().startsWith('inicio de ejecución registrado por')
  ) {
    return false
  }
  return true
}

export function PTSPdfDocument({ data }: { data: PTSPdfData }) {
  const folio = `PTS-${String(data.folio).padStart(6, '0')}`
  const verificationCode = data.verificationUrl.split('/').filter(Boolean).pop() || '—'

  return (
    <Document title={`${folio} - Permiso de Trabajo Seguro`} author="Tralixia">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>TRALIXIA - SEGURIDAD Y CONTRATISTAS</Text>
          <Text style={styles.title}>Permiso de Trabajo Seguro - {folio}</Text>
          <Text style={styles.subtitle}>{data.empresa_nombre} | Estado: {data.estado.toUpperCase()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>I. Identificación</Text>
          <View style={styles.row}>
            <Field label="Trabajo" value={data.trabajo_a_realizar} grow />
            <Field label="Tipo actividad" value={data.tipo_actividad} grow right />
          </View>
          <View style={styles.row}>
            <Field label="Contratista" value={data.empresa_contratista} grow />
            <Field label="Lugar" value={data.lugar_ejecucion} grow right />
          </View>
          <View style={styles.row}>
            <Field label="Fecha" value={formatDateRange(data.fecha_inicio, data.fecha_termino)} grow />
            <Field label="Horario" value={formatTimeRange(data.hora_inicio, data.hora_termino)} grow right />
          </View>
          {data.observaciones ? <Field label="Observaciones" value={data.observaciones} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>II. Análisis de riesgos</Text>
          <View style={styles.tableHeader}>
            <Cell text="Paso" style={styles.cStep} />
            <Cell text="Actividad" style={styles.cAct} />
            <Cell text="Peligros" style={styles.cHaz} />
            <Cell text="Riesgos" style={styles.cRisk} />
            <Cell text="Medidas preventivas" style={styles.cPrev} />
          </View>
          {data.riesgos.map((item) => (
            <View key={item.paso} style={styles.tableRow} wrap={false}>
              <Cell text={String(item.paso)} style={styles.cStep} />
              <Cell text={item.actividad} style={styles.cAct} />
              <Cell text={item.peligros} style={styles.cHaz} />
              <Cell text={item.riesgos} style={styles.cRisk} />
              <Cell text={item.medidas_preventivas} style={styles.cPrev} />
            </View>
          ))}
        </View>

        <View style={styles.rowCards} wrap={false}>
          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.sectionTitle}>III. Personal participante</Text>
            {data.personal.map((person) => (
              <View key={`${person.rut}-${person.nombre_apellido}`} style={styles.personBlock}>
                <Text style={styles.personName}>{person.nombre_apellido} - RUT {person.rut}</Text>
                <Text style={styles.personMeta}>
                  Inducción: {person.induccion_ingreso_ok ? 'Sí' : 'No'} | Charla 5 min: {person.charla_5_min_ok ? 'Sí' : 'No'}
                </Text>
                <Text style={styles.personMeta}>
                  Examen altura vigente hasta: {formatDateOnly(person.examen_altura_vigente_hasta)}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.sectionTitle}>IV. EPP y elementos</Text>
            <View style={styles.pills}>
              {data.epp.map((name) => <Text key={name} style={styles.pill}>{name}</Text>)}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>V. Aprobaciones</Text>
          {data.aprobaciones.map((approval) => {
            const noRequeridoPiloto = approval.etapa !== 'seguridad' && approval.estado === 'pendiente'
            return (
              <View key={approval.etapa} style={styles.approvalBlock} wrap={false}>
                <Text style={styles.approvalName}>
                  {etapaLabel[approval.etapa] || approval.etapa}: {noRequeridoPiloto ? 'No requerido en piloto' : approvalStatus(approval.estado)}
                </Text>
                {!noRequeridoPiloto && approval.responsable_nombre ? (
                  <Text style={styles.approvalMeta}>Responsable: {approval.responsable_nombre}</Text>
                ) : null}
                {!noRequeridoPiloto && approval.firmado_at ? (
                  <Text style={styles.approvalMeta}>Fecha de revisión: {dt(approval.firmado_at)}</Text>
                ) : null}
                {approval.observacion ? (
                  <Text style={styles.approvalMeta}>Observación: {approval.observacion}</Text>
                ) : null}
              </View>
            )
          })}
        </View>

        <View style={styles.card} wrap={false}>
          <Text style={styles.sectionTitle}>VI. Ejecución y cierre</Text>
          <View style={styles.row}>
            <Field label="Inicio real" value={dt(data.iniciado_at)} grow />
            <Field label="Iniciado por" value={data.iniciado_por_nombre || '—'} grow right />
          </View>
          <View style={styles.row}>
            <Field label="Cierre real" value={dt(data.cerrado_at)} grow />
            <Field label="Cerrado por" value={data.cerrado_por_nombre || '—'} grow right />
          </View>
          <Field label="Resultado final" value={data.cierre_observaciones || '—'} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>VII. Trazabilidad</Text>
          {data.historial.map((item, index) => (
            <View key={`${item.created_at}-${index}`} style={styles.historyBlock} wrap={false}>
              <Text>
                <Text style={{ fontWeight: 700 }}>{eventoLabel[item.evento] || item.evento.replaceAll('_', ' ')} - </Text>
                {dt(item.created_at)}
              </Text>
              {item.usuario_nombre ? <Text style={styles.muted}>Responsable: {item.usuario_nombre}</Text> : null}
              {shouldShowHistoryDetail(item) ? <Text style={styles.muted}>{item.detalle}</Text> : null}
            </View>
          ))}
        </View>

        <View style={styles.footerBox} wrap={false}>
          <Svg viewBox={`0 0 ${data.qrViewBoxSize} ${data.qrViewBoxSize}`} style={styles.qr}>
            <Path d={data.qrPath} fill="#000000" />
          </Svg>
          <View style={styles.verifyContent}>
            <Text style={styles.verifyTitle}>Verificación de autenticidad</Text>
            <Text style={styles.verifyText}>
              Escanea el QR para confirmar folio, estado y datos generales del PTS en Tralixia. La vista pública no expone datos personales ni el expediente completo.
            </Text>
            <Text style={styles.verifyCode}>Código de verificación: {verificationCode}</Text>
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}

function Field({
  label,
  value,
  grow = false,
  right = false,
}: {
  label: string
  value: string
  grow?: boolean
  right?: boolean
}) {
  const style = grow
    ? right
      ? [styles.field, styles.grow, styles.fieldRight]
      : [styles.field, styles.grow]
    : styles.field

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  )
}

function Cell({ text, style }: { text: string; style: typeof styles.cStep }) {
  return <Text style={[styles.cell, style]}>{text}</Text>
}
