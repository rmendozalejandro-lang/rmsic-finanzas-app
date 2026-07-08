export const buttonBase =
  'inline-flex items-center justify-center rounded-2xl border font-semibold no-underline shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60'

export const buttonPrimary =
  `${buttonBase} h-11 border-[#B8D4EA] bg-[#F4FAFE] px-5 text-sm text-[#163A5F] hover:border-[#7FB3DA] hover:bg-white`

export const buttonSmall =
  `${buttonBase} h-9 border-[#B8D4EA] bg-[#F4FAFE] px-4 text-xs text-[#163A5F] hover:border-[#7FB3DA] hover:bg-white`

export const buttonDanger =
  `${buttonBase} h-11 border-red-200 bg-red-50 px-5 text-sm text-red-700 hover:border-red-300 hover:bg-white`

export const buttonDangerSmall =
  `${buttonBase} h-9 border-red-200 bg-red-50 px-4 text-xs text-red-700 hover:border-red-300 hover:bg-white`

export const buttonNeutral =
  `${buttonBase} h-11 border-slate-300 bg-slate-50 px-5 text-sm text-slate-700 hover:bg-white`

export const buttonIconCircle =
  'flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-semibold leading-none text-[#163A5F] shadow-sm'

export const buttonGroup =
  'flex flex-wrap items-center gap-3'

export const buttonGroupPanel =
  'flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm'
