/** Messages for KPI target fields (catalog + allocation). */
export const KPI_TARGET_NUMERIC_MSG = 'Enter a numeric target.'
export const KPI_TARGET_NON_NEGATIVE_MSG = 'Target must be ≥ 0.'

/** Parse trimmed target input; returns null if empty or not a finite number. */
export function parseTrimmedTargetNumber(
  raw: string | number | null | undefined,
): number | null {
  const s = String(raw ?? '').trim()
  if (s === '') return null
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n) || Number.isNaN(n)) return null
  return n
}

/**
 * Validate a single target field.
 * @returns error message, or null when valid
 */
export function validateNonNegativeTargetValue(
  raw: string | number | null | undefined,
  options?: { required?: boolean },
): string | null {
  const required = options?.required !== false
  const s = String(raw ?? '').trim()
  if (!s) {
    return required ? KPI_TARGET_NUMERIC_MSG : null
  }
  const n = parseTrimmedTargetNumber(s)
  if (n === null) return KPI_TARGET_NUMERIC_MSG
  if (n < 0) return KPI_TARGET_NON_NEGATIVE_MSG
  return null
}

export type TargetBatchEntry = {
  raw: string | number | null | undefined
  label: string
}

/**
 * Validate multiple allocation targets (PM/GM team assignees).
 * @returns error message for the batch, or null when all valid
 */
export function validateNonNegativeTargetBatch(
  entries: TargetBatchEntry[],
  options?: { requireAllFilled?: boolean },
): string | null {
  const requireAll = options?.requireAllFilled !== false
  if (entries.length === 0) return null

  const missing: string[] = []
  const invalid: string[] = []

  for (const { raw, label } of entries) {
    const s = String(raw ?? '').trim()
    if (!s) {
      if (requireAll) missing.push(label)
      continue
    }
    const n = parseTrimmedTargetNumber(s)
    if (n === null || n < 0) invalid.push(label)
  }

  if (missing.length > 0) {
    return missing.length === entries.length
      ? 'Enter a target for each selected assignee.'
      : `Enter targets for: ${missing.join(', ')}.`
  }
  if (invalid.length > 0) {
    return `Targets must be numbers ≥ 0: ${invalid.join(', ')}.`
  }
  return null
}

/** Weight (%) must be a number from 1 to 100 inclusive. */
export const KPI_WEIGHT_RANGE_MSG = 'Weight must be between 1 and 100.'

export function validateWeightPctValue(
  raw: string | number | null | undefined,
  options?: { required?: boolean },
): string | null {
  const required = options?.required !== false
  const s = String(raw ?? '').trim()
  if (!s) {
    return required ? 'Enter a weight (%).' : null
  }
  const n = parseTrimmedTargetNumber(s)
  if (n === null) return 'Enter a weight (%).'
  if (n <= 0 || n > 100) return KPI_WEIGHT_RANGE_MSG
  return null
}

/** Whether a row should show invalid styling (empty, non-numeric, or negative). */
export function targetRowHasValidationIssue(
  raw: string | number | null | undefined,
  options?: { required?: boolean },
): boolean {
  const required = options?.required !== false
  const s = String(raw ?? '').trim()
  if (!s) return required
  const n = parseTrimmedTargetNumber(s)
  return n === null || n < 0
}
