import React from 'react'
import { Document, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'

export type PTSPdfRisk = { paso: number; actividad: string; peligros: string; riesgos: string; medidas_preventivas: string }
export type PTSPdfPerson = { nombre_apellido: string; rut: string; induccion_ingreso_ok: boolean; charla_5_min_ok: boolean; examen_altura_vigente_hasta: string | null }
export type PTSPdfApproval = { etapa: string; estado: string; observacion: string | null }
export type PTSPdfHistory = { evento: string; detalle: string | null; created_at: string }

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

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: 'Helvetica', color: '#1f2937', lineHeight: 1.35 },
  header: { backgroundColor: '#0B2947', color: '#ffffff', padding: 14, borderRadius: 5, marginBottom: 12 },
  brand: { fontSize: 9, fontWeight: 700, letterSpacing: 1.4, color: '#67e8f9' },
  title: { fontSize: 18, fontWeight: 700, marginTop: 5 },
  subtitle: { marginTop: 3, fontSize: 8.5, color: '#dbeafe' },
  row: { flexDirection: 'row', gap: 8 },
  grow: { flexGrow: 1 },
  card: { border: '1 solid #dbe3ea', borderRadius: 5, padding: 9, marginBottom: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: '#0B2947', marginBottom: 6 },
  label: { fontSize: 6.8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 },
  value: { fontSize: 8.5, marginTop: 2 },
  field: { marginBottom: 6 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottom: '1 solid #cbd5e1' },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #e2e8f0' },
  cell: { padding: 4, fontSize: 7.1 },
  cStep: { width: '6%' }, cAct: { width: '20%' }, cHaz: { width: '20%' }, cRisk: { width: '20%' }, cPrev: { width: '34%' },
  pill: { paddingVertical: 3, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#ecfdf5', color: '#047857', marginRight: 4, marginBottom: 4 },
  muted: { color: '#64748b' },
  footerBox: { flexDirection: 'row', alignItems: 'center', gap: 12, border: '1 solid #cbd5e1', borderRadius: 5, padding: 9, marginTop: 10 },
  qr: { width: 86, height: 86, backgroundColor: '#ffffff' },
  verifyTitle: { fontSize: 9, fontWeight: 700, color: '#0B2947' },
  verifyUrl: { marginTop: 4, fontSize: 6.5, color: '#475569' },
  pageNumber: { position: 'absolute', right: 28, bottom: 16, fontSize: 7, color: '#94a3b8' },
})

const etapaLabel: Record<string, string> = {
  supervisor_contratista: 'Supervisor contratista',
  coordinador_contratista: 'Coordinador contratista',
  jefatura_area: 'Jefatura área',
  seguridad: 'Seguridad y Salud',
}

function dt(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function PTSPdfDocument({ data }: { data: PTSPdfData }) {
  const folio = `PTS-${String(data.folio).padStart(6, '0')}`
  return (
    <Document title={`${folio} - Permiso de Trabajo Seguro`} author="Tralixia">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>TRALIXIA · SEGURIDAD Y CONTRATISTAS</Text>
          <Text style={styles.title}>Permiso de Trabajo Seguro · {folio}</Text>
          <Text style={styles.subtitle}>{data.empresa_nombre} · Estado: {data.estado.toUpperCase()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>I. Identificación</Text>
          <View style={styles.row}><Field label="Trabajo" value={data.trabajo_a_realizar} grow /><Field label="Tipo actividad" value={data.tipo_actividad} grow /></View>
          <View style={styles.row}><Field label="Contratista" value={data.empresa_contratista} grow /><Field label="Lugar" value={data.lugar_ejecucion} grow /></View>
          <View style={styles.row}><Field label="Fecha" value={`${data.fecha_inicio}${data.fecha_termino ? ` → ${data.fecha_termino}` : ''}`} grow /><Field label="Horario" value={`${data.hora_inicio || '—'}${data.hora_termino ? ` → ${data.hora_termino}` : ''}`} grow /></View>
          {data.observaciones ? <Field label="Observaciones" value={data.observaciones} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>II. Análisis de riesgos</Text>
          <View style={styles.tableHeader}><Cell text="Paso" style={styles.cStep} /><Cell text="Actividad" style={styles.cAct} /><Cell text="Peligros" style={styles.cHaz} /><Cell text="Riesgos" style={styles.cRisk} /><Cell text="Medidas preventivas" style={styles.cPrev} /></View>
          {data.riesgos.map((item) => <View key={item.paso} style={styles.tableRow}><Cell text={String(item.paso)} style={styles.cStep} /><Cell text={item.actividad} style={styles.cAct} /><Cell text={item.peligros} style={styles.cHaz} /><Cell text={item.riesgos} style={styles.cRisk} /><Cell text={item.medidas_preventivas} style={styles.cPrev} /></View>)}
        </View>

        <View style={styles.row} wrap={false}>
          <View style={[styles.card, styles.grow]}>
            <Text style={styles.sectionTitle}>III. Personal participante</Text>
            {data.personal.map((p) => <View key={`${p.rut}-${p.nombre_apellido}`} style={{ marginBottom: 6 }}><Text style={{ fontWeight: 700 }}>{p.nombre_apellido} · RUT {p.rut}</Text><Text style={styles.muted}>Inducción: {p.induccion_ingreso_ok ? 'Sí' : 'No'} · Charla 5 min: {p.charla_5_min_ok ? 'Sí' : 'No'} · Examen altura: {p.examen_altura_vigente_hasta || '—'}</Text></View>)}
          </View>
          <View style={[styles.card, styles.grow]}>
            <Text style={styles.sectionTitle}>IV. EPP y elementos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{data.epp.map((name) => <Text key={name} style={styles.pill}>✓ {name}</Text>)}</View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>V. Aprobaciones</Text>
          {data.aprobaciones.map((a) => <View key={a.etapa} style={{ marginBottom: 5 }}><Text><Text style={{ fontWeight: 700 }}>{etapaLabel[a.etapa] || a.etapa}: </Text>{a.etapa !== 'seguridad' && a.estado === 'pendiente' ? 'No requerido en piloto' : a.estado}</Text>{a.observacion ? <Text style={styles.muted}>{a.observacion}</Text> : null}</View>)}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>VI. Ejecución y cierre</Text>
          <View style={styles.row}><Field label="Inicio real" value={dt(data.iniciado_at)} grow /><Field label="Iniciado por" value={data.iniciado_por_nombre || '—'} grow /></View>
          <View style={styles.row}><Field label="Cierre real" value={dt(data.cerrado_at)} grow /><Field label="Cerrado por" value={data.cerrado_por_nombre || '—'} grow /></View>
          <Field label="Resultado final" value={data.cierre_observaciones || '—'} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>VII. Trazabilidad</Text>
          {data.historial.map((h, index) => <View key={`${h.created_at}-${index}`} style={{ marginBottom: 5 }}><Text><Text style={{ fontWeight: 700 }}>{h.evento.replaceAll('_', ' ')} · </Text>{dt(h.created_at)}</Text>{h.detalle ? <Text style={styles.muted}>{h.detalle}</Text> : null}</View>)}
        </View>

        <View style={styles.footerBox} wrap={false}>
          <Svg viewBox={`0 0 ${data.qrViewBoxSize} ${data.qrViewBoxSize}`} style={styles.qr}><Path d={data.qrPath} fill="#000000" /></Svg>
          <View style={styles.grow}><Text style={styles.verifyTitle}>Verificación de autenticidad</Text><Text style={styles.muted}>Escanea el QR para confirmar folio, estado y datos generales del PTS en Tralixia. La vista pública no expone datos personales ni el expediente completo.</Text><Text style={styles.verifyUrl}>{data.verificationUrl}</Text></View>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

function Field({ label, value, grow = false }: { label: string; value: string; grow?: boolean }) {
  return <View style={[styles.field, grow ? styles.grow : {}]}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value || '—'}</Text></View>
}

function Cell({ text, style }: { text: string; style: object }) {
  return <Text style={[styles.cell, style]}>{text}</Text>
}
