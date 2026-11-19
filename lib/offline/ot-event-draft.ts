// Drafts are local-only, not official technical events.
// Partition storage by company, user and OT to prevent cross-OT restoration.
export const OT_EVENT_DRAFT_PREFIX = 'tralixia_ot_event_draft_v1'

export const OT_EVENT_TYPES = ['accion', 'hallazgo', 'medicion', 'prueba', 'resultado', 'hipotesis'] as const
export type OTEventDraftType = (typeof OT_EVENT_TYPES)[number]
export type OTEventDraft = {
  tipo_evento: OTEventDraftType
  texto_original: string
  updated_at: string
}

function key(empresaId: string, userId: string, otId: string) {
  return `${OT_EVENT_DRAFT_PREFIX}_${empresaId}_${userId}_${otId}`
}

export function readOTEventDraft(empresaId: string, userId: string, otId: string): OTEventDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key(empresaId, userId, otId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const draft = parsed as Partial<OTEventDraft>
    if (typeof draft.texto_original !== 'string' || !draft.texto_original.trim()) return null
    if (!OT_EVENT_TYPES.some((type) => type === draft.tipo_evento)) return null
    return {
      tipo_evento: draft.tipo_evento as OTEventDraftType,
      texto_original: draft.texto_original,
      updated_at: typeof draft.updated_at === 'string' ? draft.updated_at : '',
    }
  } catch {
    return null
  }
}

export function saveOTEventDraft(
  empresaId: string,
  userId: string,
  otId: string,
  draft: Pick<OTEventDraft, 'tipo_evento' | 'texto_original'>,
) {
  if (typeof window === 'undefined') throw new Error('Almacenamiento local no disponible.')
  if (!draft.texto_original.trim()) {
    window.localStorage.removeItem(key(empresaId, userId, otId))
    return
  }
  window.localStorage.setItem(key(empresaId, userId, otId), JSON.stringify({
    ...draft,
    updated_at: new Date().toISOString(),
  } satisfies OTEventDraft))
}

export function clearOTEventDraft(empresaId: string, userId: string, otId: string) {
  if (typeof window !== 'undefined') window.localStorage.removeItem(key(empresaId, userId, otId))
}
