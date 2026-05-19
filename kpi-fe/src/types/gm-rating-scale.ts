export interface GmRatingScaleSummary {
  cycleId: string
  year: number
  name: string
  statusCode: number
  editable: boolean
  levelCount: number
}

export interface GmRatingScaleLevel {
  id: string
  cycleId: string
  sortOrder: number
  levelCode: string
  label: string
  minScore: number | string
  maxScore: number | string | null
  pitch: number | string
  colorHex: string | null
  topTier: boolean
}

export interface GmRatingScaleDetail {
  cycleId: string
  year: number
  name?: string
  statusCode: number
  editable: boolean
  hasScale: boolean
  levels: GmRatingScaleLevel[]
}

export interface CreateGmRatingScaleBody {
  cycleId: string
  name?: string
  copyFromCycleId?: string
}

export interface PatchGmRatingScaleCycleStatusBody {
  statusCode: 201 | 202
}

export interface GmRatingScaleCycleStatus {
  cycleId: string
  year: number
  name: string
  statusCode: number
  editable: boolean
}

export interface SaveGmRatingScaleLevelBody {
  sortOrder: number
  levelCode: string
  label: string
  minScore: number
  maxScore: number | null
  pitch: number
  colorHex?: string | null
  topTier?: boolean
}
