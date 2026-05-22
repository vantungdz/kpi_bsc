/** Nhãn ASM 407 — khớp {@code MemberKpiService#feedback407StatusLabel}. */
export function feedback407StatusLabel(feedbackTargetRoleCode?: string | null): string {
  const role = String(feedbackTargetRoleCode ?? '').trim().toUpperCase()
  if (role === 'GM') return 'Feedback Pending GM Review'
  return 'Feedback Pending PM Review'
}
