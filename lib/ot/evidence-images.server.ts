import { Buffer } from 'node:buffer'
import {
  getPdfEvidenceImageUrl,
  isPdfCompatibleEvidenceImage,
} from './evidence-images'

const DOWNLOAD_TIMEOUT_MS = 8_000
const PDF_CONTENT_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png'])

async function downloadPdfImage(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    })
    const contentType =
      response.headers.get('content-type')?.split(';', 1)[0].toLowerCase() ?? ''

    if (!response.ok || !PDF_CONTENT_TYPES.has(contentType)) return null

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength === 0) return null

    const mimeType = contentType === 'image/png' ? 'image/png' : 'image/jpeg'
    return `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString('base64')}`
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Downloads the exact JPEG/PNG source React PDF will render. The transformed
 * resource is preferred, with a complete download of the persisted URL as the
 * fallback. Unsupported or unavailable evidence is omitted without failing the PDF.
 */
export async function resolvePdfEvidenceImageSource(
  originalUrl: string,
  fileName?: string | null
) {
  if (!isPdfCompatibleEvidenceImage(originalUrl, fileName)) return null

  const transformedUrl = getPdfEvidenceImageUrl(originalUrl, fileName)
  if (transformedUrl !== originalUrl) {
    const transformedSource = await downloadPdfImage(transformedUrl)
    if (transformedSource) return transformedSource
  }

  return downloadPdfImage(originalUrl)
}
