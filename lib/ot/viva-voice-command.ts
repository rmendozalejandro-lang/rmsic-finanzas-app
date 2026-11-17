// Comandos explícitos para cerrar un relato Viva sin usar las manos.
// Nunca se interpreta un silencio, una pausa o una frase descriptiva como cierre.
// Solo se reconoce una instrucción dirigida a Tralixia al FINAL de un fragmento.
export type VoiceEventCommand = { text: string; register: boolean }

export function parseVivaVoiceEventCommand(transcript: string): VoiceEventCommand {
  const original = transcript.trim()
  const command = /(?:^|[.!?;,]\s*|\s+)tralixia\s*[,.:]?\s*(?:registra|registrar|guarda|guardar)\s+(?:este|el)\s+evento\s*[.!?]*\s*$/iu
  const match = command.exec(original)
  if (!match) return { text: original, register: false }

  // No insertar un evento vacío cuando se dicta solo la instrucción.
  const text = original.slice(0, match.index).trim()
  return { text, register: true }
}
