const PDF_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png'])
const VISUAL_EVIDENCE_EXTENSIONS = new Set([
  ...PDF_IMAGE_EXTENSIONS,
  'webp',
  'gif',
  'bmp',
  'svg',
])

const OT_EVIDENCE_PUBLIC_PATH = '/storage/v1/object/public/ot-evidencias/'
const OT_EVIDENCE_RENDER_PATH = '/storage/v1/render/image/public/ot-evidencias/'

export function getFileExtension(url: string, fileName?: string | null) {
  const candidates = [fileName, url]

  for (const candidate of candidates) {
    if (!candidate) continue

    try {
      const pathname = candidate === url ? new URL(candidate).pathname : candidate
      const match = pathname.match(/\.([a-z0-9]+)$/i)
      if (match) return match[1].toLowerCase()
    } catch {
      const match = candidate.split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)$/i)
      if (match) return match[1].toLowerCase()
    }
  }

  return ''
}

export function isPdfCompatibleEvidenceImage(
  url: string,
  fileName?: string | null
) {
  return (
    PDF_IMAGE_EXTENSIONS.has(getFileExtension(url)) ||
    PDF_IMAGE_EXTENSIONS.has(getFileExtension('', fileName))
  )
}

/** Preserves every visual format that was historically included in OT PDFs. */
export function isVisualEvidence(url: string, fileName?: string | null) {
  return (
    VISUAL_EVIDENCE_EXTENSIONS.has(getFileExtension(url)) ||
    VISUAL_EVIDENCE_EXTENSIONS.has(getFileExtension('', fileName))
  )
}

/**
 * Uses Supabase's public image-render endpoint without changing the persisted URL.
 * Unknown hosts/paths and non-PDF-compatible files deliberately retain their source.
 */
export function getPdfEvidenceImageUrl(
  originalUrl: string,
  fileName?: string | null
) {
  if (!isPdfCompatibleEvidenceImage(originalUrl, fileName)) return originalUrl

  try {
    const url = new URL(originalUrl)
    if (!url.hostname.endsWith('.supabase.co')) return originalUrl
    if (!url.pathname.startsWith(OT_EVIDENCE_PUBLIC_PATH)) return originalUrl

    url.pathname = url.pathname.replace(
      OT_EVIDENCE_PUBLIC_PATH,
      OT_EVIDENCE_RENDER_PATH
    )
    url.searchParams.set('width', '1600')
    url.searchParams.set('height', '1600')
    url.searchParams.set('resize', 'contain')
    url.searchParams.set('quality', '80')
    url.searchParams.set('format', 'origin')
    return url.toString()
  } catch {
    return originalUrl
  }
}

const CLIENT_MAX_IMAGE_SIDE = 1920
const CLIENT_COMPRESSION_THRESHOLD = 750 * 1024
const CLIENT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const WEBP_CONVERSION_ERROR =
  'No fue posible convertir la imagen WebP a JPEG. Intenta nuevamente o selecciona una imagen JPG/PNG.'

function loadBrowserImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new window.Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo leer la fotografía seleccionada.'))
    }
    image.src = objectUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, type === 'image/png' ? undefined : 0.8)
  })
}

/** Reduces photographic evidence in-browser. Documents and SVG files are untouched. */
export async function optimizeEvidenceImageForUpload(file: File) {
  const fileType = file.type.toLowerCase()
  const isWebP =
    fileType === 'image/webp' || getFileExtension('', file.name) === 'webp'
  if (!isWebP && !CLIENT_IMAGE_TYPES.has(fileType)) return file

  try {
    const image = await loadBrowserImage(file)
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
    if (
      !isWebP &&
      longestSide <= CLIENT_MAX_IMAGE_SIDE &&
      file.size <= CLIENT_COMPRESSION_THRESHOLD
    ) {
      return file
    }

    const scale = Math.min(1, CLIENT_MAX_IMAGE_SIDE / longestSide)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D no disponible.')

    if (isWebP) {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const outputType = isWebP ? 'image/jpeg' : file.type
    const blob = await canvasToBlob(canvas, outputType)

    if (!blob) throw new Error('No se pudo codificar la imagen.')
    if (!isWebP && blob.size >= file.size) return file

    const outputName = isWebP
      ? file.name.replace(/\.[^.]+$/, '') + '.jpg'
      : file.name
    return new File([blob], outputName, {
      type: outputType,
      lastModified: file.lastModified,
    })
  } catch (error) {
    if (isWebP) throw new Error(WEBP_CONVERSION_ERROR, { cause: error })
    return file
  }
}
