/** Mock dữ liệu màn Quản lý KPI Team (giả lập theo prototype HTML) */

export type EmployeeSheetStatus =
  | 'pending_review'
  | 'self_scoring'
  | 'approved'
  | 'submitted'

export interface EvidenceTable {
  title: string
  titleIcon: string
  accent: 'indigo' | 'emerald'
  headers: string[]
  rows: string[][]
}

export interface KpiLineMock {
  id: string
  index: number
  title: string
  subtitle: string
  weight: number
  selfScore: number
  evidenceLabel: string
  evidenceIcon: string
  evidenceVariant: 'blue' | 'emerald'
  evidenceDetail: EvidenceTable
}

export interface KpiGroupMock {
  label: string
  lines: KpiLineMock[]
}

export interface TeamMemberMock {
  id: string
  code: string
  name: string
  roleLine: string
  initials: string
  avatarClass: string
  rank: string
  status: EmployeeSheetStatus
  selfScoreDisplay: string
  leaderScoreDisplay: string | null
  canScore: boolean
  employeeComment: string
  groups: KpiGroupMock[]
  /** Điểm leader đã khóa (xem năm quá khứ) — key = id dòng KPI */
  leaderPmByLineId?: Record<string, string>
  /** Ghi chú supervisor đã lưu khi khóa kỳ (readonly) */
  supervisorCommentSaved?: string
}

export const TOTAL_KPI_WEIGHT = 160

export const MOCK_TEAM_MEMBERS: TeamMemberMock[] = [
  {
    id: '834',
    code: '834',
    name: 'Nguyen Quang Huy',
    roleLine: 'Dev - Production',
    initials: 'QH',
    avatarClass: 'bg-indigo-100 text-indigo-700',
    rank: 'R1',
    status: 'pending_review',
    selfScoreDisplay: '3.80',
    leaderScoreDisplay: null,
    canScore: false,
    employeeComment: 'Em đã hoàn thành dự án Alpha với IE=5. Mong leader xem xét.',
    groups: [
      {
        label: '(A) Hiệu suất & Chất lượng dự án',
        lines: [
          {
            id: 'a1a',
            index: 1,
            title: 'A.1a Individual Efficiency',
            subtitle: 'Mục tiêu: IE ≥ 3.0',
            weight: 30,
            selfScore: 5,
            evidenceLabel: 'Dự án',
            evidenceIcon: 'fas fa-table',
            evidenceVariant: 'blue',
            evidenceDetail: {
              title: 'Bảng số liệu: Individual Efficiency (IE)',
              titleIcon: 'fas fa-chart-bar',
              accent: 'indigo',
              headers: ['Dự án', 'IEi', 'Wi (MM)', 'IEi x Wi'],
              rows: [
                ['Project Alpha', '4.0', '2.5', '10.00'],
                ['Project Beta', '4.5', '1.0', '4.50'],
              ],
            },
          },
          {
            id: 'a2a',
            index: 2,
            title: 'A.2a Work Amount',
            subtitle: 'Mục tiêu: WA ≥ 90%',
            weight: 20,
            selfScore: 4,
            evidenceLabel: 'Timesheet',
            evidenceIcon: 'fas fa-clock',
            evidenceVariant: 'blue',
            evidenceDetail: {
              title: 'Dữ liệu: Work Amount (Trung bình 6 tháng H2: 100%)',
              titleIcon: 'fas fa-clock',
              accent: 'indigo',
              headers: ['Tháng', 'Spent Time (h)', 'Standard Time (h)', 'Tỷ lệ WA (%)'],
              rows: [
                ['Tháng 7', '160', '160', '100%'],
                ['Tháng 8', '152', '152', '100%'],
              ],
            },
          },
          {
            id: 'a3a',
            index: 3,
            title: 'A.3a Individual Quality',
            subtitle: 'Mục tiêu: IQ ≥ 3.0',
            weight: 20,
            selfScore: 3,
            evidenceLabel: 'Bug Stats',
            evidenceIcon: 'fas fa-bug',
            evidenceVariant: 'blue',
            evidenceDetail: {
              title: 'Individual Quality (IQ)',
              titleIcon: 'fas fa-bug',
              accent: 'indigo',
              headers: ['Dự án', 'Rework (%)', 'UT Bug (%)', 'Degraded Bug (%)'],
              rows: [['Project Alpha', '5.2%', '2.1%', '0.0%']],
            },
          },
          {
            id: 'a4',
            index: 4,
            title: 'A.4 Customer Satisfaction',
            subtitle: 'Mục tiêu: CS ≥ 3.0',
            weight: 10,
            selfScore: 4,
            evidenceLabel: 'CS / CES',
            evidenceIcon: 'fas fa-star',
            evidenceVariant: 'blue',
            evidenceDetail: {
              title: 'Customer Satisfaction (CS)',
              titleIcon: 'fas fa-star',
              accent: 'indigo',
              headers: ['Dự án', 'CES Point', 'Ghi chú'],
              rows: [['Project Alpha', '4.5', 'Khách hàng khen support nhiệt tình']],
            },
          },
          {
            id: 'a5a',
            index: 5,
            title: 'A.5a Task Delivery',
            subtitle: 'Mục tiêu: TD ≥ 3.0',
            weight: 15,
            selfScore: 4,
            evidenceLabel: 'Report',
            evidenceIcon: 'fas fa-bullseye',
            evidenceVariant: 'blue',
            evidenceDetail: {
              title: 'Task Delivery (TD)',
              titleIcon: 'fas fa-bullseye',
              accent: 'indigo',
              headers: ['Dự án (Project)', 'TD (Point)', 'Ghi chú (Comment)'],
              rows: [['Project Alpha', '4', 'Hoàn thành đúng hạn tất cả các sprint']],
            },
          },
          {
            id: 'a6',
            index: 6,
            title: 'A.6 Process Compliance',
            subtitle: 'Mục tiêu: Tuân thủ quy trình (No violation)',
            weight: 10,
            selfScore: 5,
            evidenceLabel: 'QA Report',
            evidenceIcon: 'fas fa-shield-alt',
            evidenceVariant: 'blue',
            evidenceDetail: {
              title: 'Process Compliance',
              titleIcon: 'fas fa-shield-alt',
              accent: 'indigo',
              headers: [
                'Dự án (Project)',
                'Report from QA',
                'Report from Non-Production',
                'Ghi chú (Comment)',
              ],
              rows: [['Project Alpha', '0', '0', 'Tuân thủ tốt']],
            },
          },
          {
            id: 'a7',
            index: 7,
            title: 'A.7 Security Compliance',
            subtitle: 'Mục tiêu: No violation',
            weight: 10,
            selfScore: 5,
            evidenceLabel: 'ISMS Report',
            evidenceIcon: 'fas fa-lock',
            evidenceVariant: 'blue',
            evidenceDetail: {
              title: 'Security Compliance',
              titleIcon: 'fas fa-lock',
              accent: 'indigo',
              headers: ['Improvement', 'Violation', 'Ghi chú (Comment)'],
              rows: [['Hoàn thành khóa Security Awareness', '0', 'Không có vi phạm ISMS']],
            },
          },
        ],
      },
      {
        label: '(B) Mục tiêu đào tạo & phát triển',
        lines: [
          {
            id: 'b1',
            index: 8,
            title: 'B.1 Improvement',
            subtitle: 'Mục tiêu: IM ≥ 3.0',
            weight: 15,
            selfScore: 4,
            evidenceLabel: 'Cải tiến',
            evidenceIcon: 'fas fa-chart-line',
            evidenceVariant: 'emerald',
            evidenceDetail: {
              title: 'Improvement',
              titleIcon: 'fas fa-chart-line',
              accent: 'emerald',
              headers: ['Nội dung Cải tiến', 'Kết quả / Minh chứng'],
              rows: [['Cải thiện kỹ năng Review Code', 'Đã hướng dẫn và mentor 1 junior member trong team.']],
            },
          },
          {
            id: 'b2',
            index: 9,
            title: 'B.2 Contribution',
            subtitle: 'Mục tiêu: CO ≥ 3.0',
            weight: 10,
            selfScore: 3,
            evidenceLabel: 'Bài viết',
            evidenceIcon: 'fas fa-share-alt',
            evidenceVariant: 'emerald',
            evidenceDetail: {
              title: 'Contribution',
              titleIcon: 'fas fa-share-alt',
              accent: 'emerald',
              headers: ['Tên bài viết / Nội dung', 'Loại (Type)', 'Đường dẫn (Link)'],
              rows: [['Hướng dẫn sử dụng React Hooks', 'Tech', 'https://internal.wiki/react-hooks']],
            },
          },
          {
            id: 'b3',
            index: 10,
            title: 'B.3 Language Capability',
            subtitle: 'Mục tiêu: TOEIC 700 / JLPT N3',
            weight: 10,
            selfScore: 4,
            evidenceLabel: 'Chứng chỉ',
            evidenceIcon: 'fas fa-award',
            evidenceVariant: 'emerald',
            evidenceDetail: {
              title: 'Bằng chứng Ngoại ngữ',
              titleIcon: 'fas fa-file-alt',
              accent: 'emerald',
              headers: ['Kỳ thi / Khóa học', 'Level / Điểm số', 'File đính kèm', 'Trạng thái HR'],
              rows: [['TOEIC Official Exam', '750', 'Result_TOEIC_750.pdf', 'Verified']],
            },
          },
          {
            id: 'b4',
            index: 11,
            title: 'B.4 Certificate',
            subtitle: 'Mục tiêu: Đạt chứng chỉ chuyên môn',
            weight: 10,
            selfScore: 3,
            evidenceLabel: 'Chứng chỉ',
            evidenceIcon: 'fas fa-award',
            evidenceVariant: 'emerald',
            evidenceDetail: {
              title: 'Certificate',
              titleIcon: 'fas fa-award',
              accent: 'emerald',
              headers: ['Tên chứng chỉ', 'Trạng thái', 'Ghi chú'],
              rows: [['AWS Cloud Practitioner', 'Đang ôn tập', 'Dự kiến thi vào Q1/2026']],
            },
          },
        ],
      },
    ],
  },
  {
    id: '812',
    code: '812',
    name: 'Trần Văn Phước',
    roleLine: 'QC - Production',
    initials: 'TP',
    avatarClass: 'bg-emerald-100 text-emerald-700',
    rank: 'R3',
    status: 'self_scoring',
    selfScoreDisplay: '—',
    leaderScoreDisplay: null,
    canScore: false,
    employeeComment: '',
    groups: [],
  },
  {
    id: '801',
    code: '801',
    name: 'Lê Thị Mai',
    roleLine: 'Dev - Production',
    initials: 'LM',
    avatarClass: 'bg-rose-100 text-rose-700',
    rank: 'R2',
    status: 'pending_review',
    selfScoreDisplay: '4.10',
    leaderScoreDisplay: null,
    canScore: false,
    employeeComment: 'Đã bổ sung evidence cho A.1a.',
    groups: [], // gọn: chỉ hiển thị placeholder khi expand (dùng chung template tối giản)
  },
  {
    id: '799',
    code: '799',
    name: 'Phạm Đức Anh',
    roleLine: 'Dev - Maintenance',
    initials: 'PA',
    avatarClass: 'bg-amber-100 text-amber-800',
    rank: 'R2',
    status: 'approved',
    selfScoreDisplay: '4.25',
    leaderScoreDisplay: '4.20',
    canScore: false,
    employeeComment: '—',
    groups: [],
  },
]

/** Điểm leader đã chốt năm 2025 (NV 834) — dùng cho readonly */
const LEADER_PM_834_2025: Record<string, string> = {
  a1a: '5',
  a2a: '4',
  a3a: '4',
  a4: '4',
  a5a: '5',
  a6: '5',
  a7: '5',
  b1: '4',
  b2: '3',
  b3: '4',
  b4: '3',
}

/** NV 801 fallback cùng bộ KPI — snapshot 2025 */
const LEADER_PM_801_2025: Record<string, string> = {
  a1a: '4',
  a2a: '5',
  a3a: '4',
  a4: '4',
  a5a: '4',
  a6: '5',
  a7: '4',
  b1: '5',
  b2: '4',
  b3: '4',
  b4: '4',
}

/** Bản ghi team năm 2025 — đã khóa, chỉ xem */
export const MOCK_TEAM_2025: TeamMemberMock[] = [
  {
    ...MOCK_TEAM_MEMBERS[0],
    status: 'approved',
    canScore: false,
    selfScoreDisplay: '3.95',
    leaderScoreDisplay: '4.12',
    leaderPmByLineId: LEADER_PM_834_2025,
    supervisorCommentSaved:
      'Đồng ý kết quả self-review FY2025. Tiếp tục phát huy IE và Task Delivery.',
    employeeComment: MOCK_TEAM_MEMBERS[0].employeeComment,
  },
  {
    ...MOCK_TEAM_MEMBERS[1],
    status: 'approved',
    canScore: false,
    selfScoreDisplay: '3.90',
    leaderScoreDisplay: '3.85',
    employeeComment: 'Đã hoàn thành tự chấm và được duyệt trong kỳ 2025.',
    supervisorCommentSaved: 'QC ổn định, duy trì coverage regression.',
  },
  {
    ...MOCK_TEAM_MEMBERS[2],
    status: 'approved',
    canScore: false,
    selfScoreDisplay: '4.15',
    leaderScoreDisplay: '4.08',
    leaderPmByLineId: LEADER_PM_801_2025,
    supervisorCommentSaved: 'Đánh giá tốt; bổ sung thêm bài viết tech cho B.2 trong năm sau.',
    employeeComment: 'Đã bổ sung đủ evidence A.1a trong FY2025.',
  },
  {
    ...MOCK_TEAM_MEMBERS[3],
    status: 'approved',
    canScore: false,
    selfScoreDisplay: '4.25',
    leaderScoreDisplay: '4.20',
    supervisorCommentSaved: 'KPI năm 2025 đạt yêu cầu, giữ nhịp deliver maintenance.',
    employeeComment: '—',
  },
]

/** Mock theo năm chọn (dropdown hiện có 2025 / 2026) */
export function getTeamMembersForYear(year: number): TeamMemberMock[] {
  if (year === 2025) return MOCK_TEAM_2025
  return MOCK_TEAM_MEMBERS
}

/** Năm lịch < năm hiện tại → chỉ xem (đã khóa kỳ) */
export function isReadonlyKpiYear(year: number): boolean {
  return year < new Date().getFullYear()
}

/** Đếm NV chờ chấm theo năm “đang mở” (năm hiện tại trên lịch) */
export function countPendingScoring(): number {
  const y = new Date().getFullYear()
  return getTeamMembersForYear(y).filter((m) => m.status === 'pending_review').length
}
