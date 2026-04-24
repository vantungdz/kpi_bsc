import type { GmBscPerspective } from '@/types/gm-workspace'

export const GM_BSC_ORDER: GmBscPerspective[] = ['financial', 'customer', 'internal', 'learning']

export const GM_BSC_LABELS: Record<GmBscPerspective, string> = {
  financial: 'Financial',
  customer: 'Customer',
  internal: 'Internal Process',
  learning: 'Learning & Growth',
}

export function normalizeGmBscPerspective(raw: unknown): GmBscPerspective {
  const s = String(raw ?? '').trim()
  if (s === 'financial' || s === 'customer' || s === 'internal' || s === 'learning') return s
  return 'internal'
}
