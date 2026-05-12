import type {
  GmEmployeeSheetStatus,
  GmEvalMember,
  GmEvalPmBranch,
  GmKpiGroup,
  GmKpiItem,
} from '@/types/gm-employee-evaluation'

/** Labels aligned with ASM lifecycle semantics when display strings are not from the API (e.g. offline mock). */
export function gmEmployeeSheetStatusDescription(status: GmEmployeeSheetStatus): string {
  if (status === 'pending_pm') return 'Awaiting PM final score'
  if (status === 'self_scoring') return 'Member submitted 1st-half evidence; awaiting PM review'
  return 'Fully closed (lifecycle complete)'
}

export function flattenGmKpiItems(emp: GmEvalMember): GmKpiItem[] {
  return emp.groups.flatMap((g) => g.items)
}

/** Tab Promotion — nhận diện theo từ khóa «Promotion» trong `groupTitle`. */
export function isGmEvalPromotionKpiGroup(group: GmKpiGroup): boolean {
  return /\bpromotion\b/i.test(group.groupTitle)
}

/** PM + mọi member có sheet (flatten) — khởi tạo điểm GM / lọc `?pm=` (mock hoặc cây từ API). */
export function flattenGmEvalPmHubTreeForScores(tree: GmEvalPmBranch[]): GmEvalMember[] {
  const out: GmEvalMember[] = []
  for (const br of tree) {
    out.push(br.pm)
    for (const ld of br.leaders) {
      out.push(ld.sheet)
      out.push(...ld.members)
    }
    out.push(...br.directMembers)
  }
  return out
}
