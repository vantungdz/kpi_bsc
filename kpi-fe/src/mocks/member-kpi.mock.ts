import type { KpiItem } from '@/types/kpi'

/**
 * KPI nhóm Promotion (Direct) — dùng cho mock Leader dashboard (member dashboard dùng API thật).
 */
export const MOCK_PROMOTION_KPI_ITEMS: KpiItem[] = [
  {
    id: 'item-p1',
    code: 'P.1',
    name: 'Leadership & Ownership',
    description: 'Dẫn dắt initiative nhỏ, buddy/mentor, ownership xuyên suốt delivery',
    target: 'Hoàn thành ≥ 2 initiative cross-team có biên bản retrospective / lessons learned',
    weight: 30,
    group: 'P',
    evaluationStatus: 'not_started',
    evidenceFormCase: 'general',
    evidenceStatus: 'missing',
    selfScore: null,
    pmScore: null,
    leaderScore: null,
  },
  {
    id: 'item-p2',
    code: 'P.2',
    name: 'Strategic Impact',
    description: 'Đóng góp mục tiêu cấp dự án hoặc product roadmap (OKR liên kết)',
    target: 'Ít nhất 1 đề xuất cải tiến được PM/Leader phê duyệt và triển khai trong năm',
    weight: 35,
    group: 'P',
    evaluationStatus: 'pending_approval',
    evidenceFormCase: 'general',
    evidenceStatus: 'submitted',
    selfScore: 4,
    pmScore: null,
    leaderScore: null,
  },
  {
    id: 'item-p3',
    code: 'P.3',
    name: 'Role Readiness (Next Level)',
    description: 'Năng lực theo JD bậc kế tiếp (R3 → R4 hoặc tương đương)',
    target: 'Checklist readiness ≥ 80% theo bảng HR/Leader; có minh chứng cụ thể từng tiêu chí',
    weight: 35,
    group: 'P',
    evaluationStatus: 'approved',
    evidenceFormCase: 'upload_only',
    evidenceStatus: 'submitted',
    selfScore: 5,
    pmScore: 5,
    leaderScore: null,
  },
]
