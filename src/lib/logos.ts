export type LogoAlign = 'left' | 'center' | 'right'

export interface LogoItem {
  id: string
  dataUrl: string
  widthMm: number
  align: LogoAlign
}

export function makeLogoId(): string {
  return `logo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function groupLogosByAlign(logos: LogoItem[]): Record<LogoAlign, LogoItem[]> {
  const groups: Record<LogoAlign, LogoItem[]> = { left: [], center: [], right: [] }
  for (const logo of logos) groups[logo.align].push(logo)
  return groups
}
