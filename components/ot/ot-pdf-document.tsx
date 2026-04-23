import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
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

type OTPdfDocumentProps = {
  resumen: ResumenLike
  detalle: OTDetallePdf
  evidencias: EvidenciaPdf[]
  firmas: FirmaPdf[]
  perfilesMap: Record<string, string>
  tiposServicio: TipoServicioPdf[]
  logoUrl: string
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 30,
    paddingHorizontal: 28,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 14,
  },

  headerLeft: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
  },

  logoBox: {
    width: 94,
    height: 62,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },

  logo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },

  headerTextWrap: {
    marginLeft: 14,
    flexShrink: 1,
    flexGrow: 1,
  },

  company: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: 700,
    letterSpacing: 1,
  },

  mainTitle: {
    fontSize: 19,
    fontWeight: 700,
    marginTop: 6,
    color: '#0f172a',
  },

  subTitle: {
    fontSize: 10,
    color: '#475569',
    marginTop: 8,
    lineHeight: 1.45,
  },

  headerCard: {
    width: 190,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
  },

  headerCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },

  fieldLabel: {
    fontSize: 7.5,
    color: '#64748b',
    fontWeight: 700,
    letterSpacing: 0.8,
  },

  fieldValue: {
    fontSize: 10,
    color: '#0f172a',
    marginTop: 4,
    lineHeight: 1.35,
  },

  section: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#ffffff',
  },

  sectionTitle: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 12,
    color: '#0f172a',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: -4,
    marginRight: -4,
  },

  compactCard: {
    width: '48.8%',
    marginLeft: 4,
    marginRight: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#f8fafc',
  },

  textBlock: {
    marginBottom: 12,
  },

  textBlockTitle: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.8,
    marginBottom: 5,
    color: '#1e293b',
  },

  textBlockBody: {
    fontSize: 10,
    lineHeight: 1.55,
    color: '#334155',
  },

  noteBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fffbeb',
  },

  noteText: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: '#92400e',
  },

  photoGroupTitle: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.8,
    marginBottom: 8,
    color: '#1e293b',
  },

  photoCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 12,
    paddingBottom: 10,
  },

  photoImage: {
    width: '100%',
    height: 205,
    objectFit: 'cover',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },

  photoBody: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },

  photoTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 5,
  },

  photoText: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: '#334155',
  },

  receptionWrap: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },

  receptionCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
  },

  signatureBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    borderBottomColor: '#94a3b8',
    width: '100%',
    height: 40,
  },
})

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'long',
  }).format(date)
}

function formatTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
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
    'rmendozaalejandro@gmail.com': 'Raúl Mendoza',
    'raul mendoza': 'Raúl Mendoza',
    'raúl mendoza': 'Raúl Mendoza',
    'david allendes': 'David Allendes',
  }

  if (knownMap[lower]) return knownMap[lower]

  if (
    lower.includes('rmendoza') ||
    (lower.includes('raul') && lower.includes('mendoza')) ||
    (lower.includes('raúl') && lower.includes('mendoza'))
  ) {
    return 'Raúl Mendoza'
  }

  if (lower.includes('david') && lower.includes('allendes')) {
    return 'David Allendes'
  }

  if (raw.includes('@')) {
    const localPart = raw.split('@')[0]
    const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return toTitleCase(cleaned)
  }

  return raw
}

function FieldCard({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  if (value == null || value === '' || value === '-') return null

  return (
    <View style={styles.compactCard}>
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
      <Text style={styles.textBlockTitle}>{title}</Text>
      <Text style={styles.textBlockBody}>{value}</Text>
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

  return (
    <View wrap={false} style={{ marginBottom: 12 }}>
      <Text style={styles.photoGroupTitle}>{title}</Text>

      {items.map((item) => (
        <View key={item.id} wrap={false} style={styles.photoCard}>
          <Image src={item.archivo_url} style={styles.photoImage} />
          <View style={styles.photoBody}>
            <Text style={styles.photoTitle}>
              {item.archivo_nombre ?? 'Registro fotográfico'}
            </Text>
            <Text style={styles.photoText}>
              {item.descripcion?.trim() ? item.descripcion : 'Sin detalle informado.'}
            </Text>
          </View>
        </View>
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

  return (
    <Document
      title={`${detalle.folio || 'OT'} - ${detalle.titulo}`}
      author="RM Servicios de Ingeniería y Construcción SpA"
      subject="Informe de servicio en terreno"
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
              <Text style={styles.mainTitle}>Informe de servicio en terreno</Text>
              <Text style={styles.subTitle}>{detalle.titulo}</Text>
            </View>
          </View>

          <View style={styles.headerCard}>
            <View style={styles.headerCardRow}>
              <View>
                <Text style={styles.fieldLabel}>FOLIO OT</Text>
                <Text style={styles.fieldValue}>{detalle.folio || '-'}</Text>
              </View>

              <View>
                <Text style={styles.fieldLabel}>FECHA</Text>
                <Text style={styles.fieldValue}>{formatDate(detalle.fecha_ot)}</Text>
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>TIPO DE SERVICIO</Text>
              <Text style={styles.fieldValue}>{tipoNombre}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATOS DEL CLIENTE Y SERVICIO</Text>

          <View style={styles.grid}>
            <FieldCard label="RAZÓN SOCIAL" value={resumen.cliente_nombre} />
            <FieldCard label="FECHA VISITA" value={formatDate(detalle.fecha_ot)} />
            <FieldCard label="HORA INICIO" value={formatTime(detalle.hora_inicio)} />
            <FieldCard label="HORA TÉRMINO" value={formatTime(detalle.hora_termino)} />
            <FieldCard label="TÉCNICO EJECUTANTE" value={nombreTecnico} />
            <FieldCard label="ÁREA / SECTOR" value={areaTrabajo} />
          </View>
        </View>

        {isPreventiva ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESARROLLO DE LA ACTIVIDAD</Text>
            <TextBlock
              title="OBJETIVO DEL MANTENIMIENTO"
              value={detalle.descripcion_solicitud}
            />
            <TextBlock
              title="ACTIVIDADES EJECUTADAS"
              value={detalle.trabajo_realizado}
            />
            <TextBlock
              title="HALLAZGOS DETECTADOS"
              value={detalle.hallazgos}
            />
            <TextBlock
              title="RESULTADO DEL SERVICIO"
              value={detalle.resultado_servicio}
            />
            <TextBlock
              title="RECOMENDACIONES"
              value={detalle.recomendaciones}
            />
            <TextBlock
              title="OBSERVACIONES"
              value={detalle.observaciones_cierre}
            />
          </View>
        ) : null}

        {isUrgenciaOAsistencia ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESARROLLO DE LA ACTIVIDAD</Text>
            <TextBlock
              title="SOLICITUD DEL CLIENTE"
              value={detalle.descripcion_solicitud}
            />
            <TextBlock
              title="PROBLEMA DETECTADO"
              value={detalle.problema_reportado}
            />
            <TextBlock
              title="CAUSA PROBABLE"
              value={detalle.causa_probable}
            />
            <TextBlock
              title="SOLUCIÓN IMPLEMENTADA"
              value={detalle.trabajo_realizado}
            />
            <TextBlock
              title="RESULTADO DEL SERVICIO"
              value={detalle.resultado_servicio}
            />
            <TextBlock
              title="RECOMENDACIONES"
              value={detalle.recomendaciones}
            />
            <TextBlock
              title="OBSERVACIONES"
              value={detalle.observaciones_cierre}
            />

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
              title="OBJETIVO DE LA ASESORÍA"
              value={detalle.descripcion_solicitud}
            />
            <TextBlock
              title="ANTECEDENTES OBSERVADOS"
              value={detalle.problema_reportado}
            />
            <TextBlock
              title="ANÁLISIS TÉCNICO"
              value={detalle.diagnostico}
            />
            <TextBlock
              title="CONCLUSIONES TÉCNICAS"
              value={detalle.conclusiones_tecnicas}
            />
            <TextBlock
              title="RECOMENDACIONES"
              value={detalle.recomendaciones}
            />
            <TextBlock
              title="OBSERVACIONES"
              value={detalle.observaciones_cierre}
            />
          </View>
        ) : null}

        {!isPreventiva && !isUrgenciaOAsistencia && !isAsesoria ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESARROLLO DE LA ACTIVIDAD</Text>
            <TextBlock
              title="SOLICITUD DEL CLIENTE"
              value={detalle.descripcion_solicitud}
            />
            <TextBlock
              title="PROBLEMA DETECTADO"
              value={detalle.problema_reportado}
            />
            <TextBlock
              title="DIAGNÓSTICO"
              value={detalle.diagnostico}
            />
            <TextBlock
              title="SOLUCIÓN IMPLEMENTADA"
              value={detalle.trabajo_realizado}
            />
            <TextBlock
              title="RESULTADO DEL SERVICIO"
              value={detalle.resultado_servicio}
            />
            <TextBlock
              title="RECOMENDACIONES"
              value={detalle.recomendaciones}
            />
            <TextBlock
              title="OBSERVACIONES"
              value={detalle.observaciones_cierre}
            />
          </View>
        ) : null}

        {evidenciasImagenes.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REGISTRO FOTOGRÁFICO</Text>
            <PhotoGroup title="ANTES" items={fotosAntes} />
            <PhotoGroup title="DURANTE" items={fotosDurante} />
            <PhotoGroup title="DESPUÉS" items={fotosDespues} />
            <PhotoGroup title="OTRAS EVIDENCIAS" items={otrasFotos} />
          </View>
        ) : null}

        <View wrap={false} style={styles.section}>
          <Text style={styles.sectionTitle}>RECEPCIÓN Y CONFORMIDAD DEL SERVICIO</Text>

          <View style={styles.receptionWrap}>
            <View style={styles.receptionCard}>
              <Text style={styles.fieldLabel}>NOMBRE</Text>
              <Text style={styles.fieldValue}>{labelOrDash(nombreRecepcion)}</Text>

              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>CARGO</Text>
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
      </Page>
    </Document>
  )
}