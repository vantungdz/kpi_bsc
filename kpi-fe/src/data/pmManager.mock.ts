/** Mock types & data for PM Manager — đánh giá KPI nhân viên (giả lập). */

export type EmployeeSheetStatus = 'pending_pm' | 'self_scoring' | 'approved'

export interface EvidenceTable {
  title: string
  icon: string
  /** Tailwind border accent: indigo | emerald */
  accent: 'indigo' | 'emerald'
  headers: string[]
  rows: string[][]
  /** Optional last row (e.g. tổng) */
  footer?: string[]
}

export interface PmManagerKpiItem {
  id: string
  index: number
  title: string
  target: string
  weight: number
  evidenceButtonLabel: string
  evidenceButtonIcon: string
  evidenceTone: 'blue' | 'emerald'
  selfScore: number
  evidence: EvidenceTable
}

export interface PmManagerKpiGroup {
  groupTitle: string
  items: PmManagerKpiItem[]
}

export interface PmManagerEmployee {
  id: string
  code: string
  name: string
  role: string
  initials: string
  initialsClass: string
  rank: string
  status: EmployeeSheetStatus
  /** Điểm TB tự chấm (hiển thị cột chính); null nếu chưa nộp */
  selfScoreDisplay: string | null
  canScore: boolean
  /** Dự án gán (mock filter) — không chứa 'all' */
  projectIds: string[]
  employeeComment?: string
  groups: PmManagerKpiGroup[]
}

export interface PmManagerProject {
  id: string
  name: string
}

export const MOCK_PM_PROJECTS: PmManagerProject[] = [
  { id: 'all', name: 'Tất cả dự án' },
  { id: 'alpha', name: 'Project Alpha' },
  { id: 'beta', name: 'Project Beta' },
  { id: 'gamma', name: 'Project Gamma' },
]

const groupA: PmManagerKpiGroup = {
  groupTitle: '(A) Hiệu suất, Cải tiến & Năng lực chuyên môn',
  items: [
    {
      id: 'a1a',
      index: 1,
      title: 'A.1a Individual Efficiency (IE)',
      target: 'Target: IE ≥ 3.0',
      weight: 30,
      evidenceButtonLabel: 'Bảng biểu',
      evidenceButtonIcon: 'fas fa-table',
      evidenceTone: 'blue',
      selfScore: 5,
      evidence: {
        title: 'Dữ liệu: Individual Efficiency (IE)',
        icon: 'fas fa-chart-bar',
        accent: 'indigo',
        headers: ['Dự án', 'IEi', 'Wi (MM)', 'IEi x Wi'],
        rows: [
          ['Project Alpha', '4.0', '2.5', '10.00'],
          ['Project Beta', '4.5', '1.0', '4.50'],
        ],
        footer: ['Tổng:', '', '3.5 MM', '14.50'],
      },
    },
    {
      id: 'a2a',
      index: 2,
      title: 'A.2a Work Amount (WA)',
      target: 'Target: WA ≥ 90%',
      weight: 20,
      evidenceButtonLabel: 'Timesheet',
      evidenceButtonIcon: 'fas fa-clock',
      evidenceTone: 'blue',
      selfScore: 4,
      evidence: {
        title: 'Dữ liệu: Work Amount',
        icon: 'fas fa-clock',
        accent: 'indigo',
        headers: ['Tháng', 'Jul', 'Aug', 'Sep', 'Trung Bình'],
        rows: [
          ['Spent (h)', '160', '152', '176', '162.6'],
          ['Standard (h)', '160', '152', '176', '162.6'],
          ['Tỷ lệ WA (%)', '100%', '100%', '100%', '100%'],
        ],
      },
    },
    {
      id: 'a3a',
      index: 3,
      title: 'A.3a Individual Quality (IQ)',
      target: 'Target: IQ ≥ 3.0',
      weight: 20,
      evidenceButtonLabel: 'Báo cáo Lỗi',
      evidenceButtonIcon: 'fas fa-bug',
      evidenceTone: 'blue',
      selfScore: 3,
      evidence: {
        title: 'Bảng số liệu: Individual Quality',
        icon: 'fas fa-bug',
        accent: 'indigo',
        headers: ['Dự án', 'Rework (%)', 'UT Bug (%)', 'Degraded Bug (%)'],
        rows: [['Project Alpha', '5.2%', '2.1%', '0.0%']],
      },
    },
    {
      id: 'a4',
      index: 4,
      title: 'A.4 Customer Satisfaction',
      target: 'Target: CS ≥ 3.0',
      weight: 10,
      evidenceButtonLabel: 'Điểm CES',
      evidenceButtonIcon: 'fas fa-star',
      evidenceTone: 'blue',
      selfScore: 4,
      evidence: {
        title: 'Đánh giá Khách hàng (Customer Satisfaction)',
        icon: 'fas fa-star',
        accent: 'indigo',
        headers: ['Dự án', 'CES Point', 'Ghi chú từ Khách hàng'],
        rows: [
          [
            'Project Alpha',
            '4.5',
            'Khách hàng khen support nhiệt tình, fix bug nhanh.',
          ],
        ],
      },
    },
    {
      id: 'a5a',
      index: 5,
      title: 'A.5a Task Delivery (TD)',
      target: 'Target: TD ≥ 3.0',
      weight: 15,
      evidenceButtonLabel: 'Báo cáo',
      evidenceButtonIcon: 'fas fa-bullseye',
      evidenceTone: 'blue',
      selfScore: 4,
      evidence: {
        title: 'Bảng tiến độ: Task Delivery',
        icon: 'fas fa-bullseye',
        accent: 'indigo',
        headers: ['Dự án (Project)', 'TD Point', 'Ghi chú (Comment)'],
        rows: [['Project Alpha', '4', 'Hoàn thành đúng hạn tất cả các sprint']],
      },
    },
    {
      id: 'a6',
      index: 6,
      title: 'A.6 Process Compliance',
      target: 'Target: Tuân thủ quy trình (No violation)',
      weight: 10,
      evidenceButtonLabel: 'QA Report',
      evidenceButtonIcon: 'fas fa-shield-alt',
      evidenceTone: 'blue',
      selfScore: 5,
      evidence: {
        title: 'Tuân thủ quy trình (Process Compliance)',
        icon: 'fas fa-shield-alt',
        accent: 'indigo',
        headers: ['Dự án', 'QA Violation (Lỗi)', 'Non-Prod Issues', 'Báo cáo'],
        rows: [['Project Alpha', '0', '0', 'Tuân thủ đầy đủ quy trình CMMI.']],
      },
    },
    {
      id: 'a7',
      index: 7,
      title: 'A.7 Security Compliance',
      target: 'Target: No violation',
      weight: 10,
      evidenceButtonLabel: 'Báo cáo',
      evidenceButtonIcon: 'fas fa-lock',
      evidenceTone: 'blue',
      selfScore: 5,
      evidence: {
        title: 'Tuân thủ Bảo mật (Security Compliance)',
        icon: 'fas fa-lock',
        accent: 'indigo',
        headers: ['Hoạt động / Improvement', 'Vi phạm (Violations)', 'Ghi chú'],
        rows: [
          [
            'Hoàn thành bài Test Security Awareness',
            '0',
            'Điểm test 100/100. Đạt chuẩn.',
          ],
        ],
      },
    },
  ],
}

const groupB: PmManagerKpiGroup = {
  groupTitle: '(B) Mục tiêu đào tạo & phát triển',
  items: [
    {
      id: 'b1',
      index: 8,
      title: 'B.1 Improvement',
      target: 'Target: IM ≥ 3.0',
      weight: 15,
      evidenceButtonLabel: 'Cải tiến',
      evidenceButtonIcon: 'fas fa-chart-line',
      evidenceTone: 'emerald',
      selfScore: 4,
      evidence: {
        title: 'Improvement',
        icon: 'fas fa-chart-line',
        accent: 'emerald',
        headers: ['Nội dung Cải tiến', 'Kết quả / Minh chứng cụ thể'],
        rows: [
          [
            'Nâng cao kỹ năng Report',
            'Đã nhận template chuẩn và thực hành report cho KH hàng tuần vào Q4. Feedback từ KH là tốt.',
          ],
        ],
      },
    },
    {
      id: 'b2',
      index: 9,
      title: 'B.2 Contribution',
      target: 'Target: CO ≥ 3.0',
      weight: 10,
      evidenceButtonLabel: 'Bài viết',
      evidenceButtonIcon: 'fas fa-share-alt',
      evidenceTone: 'emerald',
      selfScore: 3,
      evidence: {
        title: 'Đóng góp nội bộ (Contribution)',
        icon: 'fas fa-share-alt',
        accent: 'emerald',
        headers: ['Tên bài viết / Chủ đề chia sẻ', 'Loại (Type)', 'Đường dẫn (Link)'],
        rows: [
          [
            'Báo cáo: Tối ưu hiệu năng ReactJS',
            'Tech',
            'https://internal.wiki/react-perf',
          ],
        ],
      },
    },
    {
      id: 'b3',
      index: 10,
      title: 'B.3 Language Capability',
      target: 'Target: TOEIC 700 / JLPT N3',
      weight: 10,
      evidenceButtonLabel: 'Chứng chỉ',
      evidenceButtonIcon: 'fas fa-language',
      evidenceTone: 'emerald',
      selfScore: 4,
      evidence: {
        title: 'Bằng chứng Ngoại ngữ',
        icon: 'fas fa-language',
        accent: 'emerald',
        headers: ['Kỳ thi / Khóa học', 'Điểm / Level', 'File đính kèm', 'Trạng thái HR'],
        rows: [['TOEIC Official Exam', '750', 'Result_TOEIC.pdf', 'Verified']],
      },
    },
    {
      id: 'b4',
      index: 11,
      title: 'B.4 Certificate',
      target: 'Target: Đạt chứng chỉ chuyên môn',
      weight: 10,
      evidenceButtonLabel: 'Chứng chỉ',
      evidenceButtonIcon: 'fas fa-award',
      evidenceTone: 'emerald',
      selfScore: 3,
      evidence: {
        title: 'Chứng chỉ chuyên môn (Certificate)',
        icon: 'fas fa-award',
        accent: 'emerald',
        headers: ['Tên chứng chỉ', 'Trạng thái', 'Ghi chú'],
        rows: [['AWS Cloud Practitioner', 'Đang ôn tập', 'Dự kiến thi vào Q1/2026']],
      },
    },
  ],
}

function emptyGroups(): PmManagerKpiGroup[] {
  return []
}

/** 12 nhân viên mock — chỉ nhân viên đầu có đủ 11 hạng mục như prototype a.html */
export const MOCK_PM_EMPLOYEES: PmManagerEmployee[] = [
  {
    id: '834',
    code: '834',
    name: 'Nguyen Quang Huy',
    role: 'Dev - Production',
    initials: 'QH',
    initialsClass: 'bg-indigo-100 text-indigo-700',
    rank: 'R1',
    status: 'pending_pm',
    selfScoreDisplay: '3.80',
    canScore: true,
    projectIds: ['alpha', 'beta'],
    employeeComment:
      'Em đã hoàn thành tốt dự án Alpha, OT nhiều và không có bug release. Các chứng chỉ em sẽ cố gắng thi xong vào năm sau. Mong Leader xem xét ạ.',
    groups: [groupA, groupB],
  },
  {
    id: '812',
    code: '812',
    name: 'Trần Văn Phước',
    role: 'QC - Production',
    initials: 'TP',
    initialsClass: 'bg-emerald-100 text-emerald-700',
    rank: 'R3',
    status: 'self_scoring',
    selfScoreDisplay: null,
    canScore: false,
    projectIds: ['alpha'],
    groups: emptyGroups(),
  },
  {
    id: '801',
    code: '801',
    name: 'Lê Thị Mai',
    role: 'BA - Production',
    initials: 'LM',
    initialsClass: 'bg-rose-100 text-rose-700',
    rank: 'R2',
    status: 'pending_pm',
    selfScoreDisplay: '3.65',
    canScore: true,
    projectIds: ['alpha', 'gamma'],
    employeeComment: 'Đã hoàn thành BRD cho 2 sprint liên tiếp.',
    groups: [groupA, groupB],
  },
  {
    id: '805',
    code: '805',
    name: 'Phạm Đức Anh',
    role: 'Dev - Maintenance',
    initials: 'PA',
    initialsClass: 'bg-sky-100 text-sky-700',
    rank: 'R2',
    status: 'approved',
    selfScoreDisplay: '4.10',
    canScore: true,
    projectIds: ['beta'],
    employeeComment: 'Ổn định production, không P1 trong quý.',
    groups: [groupA, groupB],
  },
  {
    id: '820',
    code: '820',
    name: 'Hoàng Minh Tuấn',
    role: 'Dev - Production',
    initials: 'HT',
    initialsClass: 'bg-violet-100 text-violet-700',
    rank: 'R1',
    status: 'pending_pm',
    selfScoreDisplay: '3.92',
    canScore: true,
    projectIds: ['alpha'],
    groups: [groupA, groupB],
  },
  {
    id: '821',
    code: '821',
    name: 'Đặng Thu Hà',
    role: 'QC - Maintenance',
    initials: 'DH',
    initialsClass: 'bg-amber-100 text-amber-800',
    rank: 'R3',
    status: 'self_scoring',
    selfScoreDisplay: null,
    canScore: false,
    projectIds: ['gamma'],
    groups: emptyGroups(),
  },
  {
    id: '822',
    code: '822',
    name: 'Võ Quốc Bảo',
    role: 'Dev - Production',
    initials: 'VB',
    initialsClass: 'bg-teal-100 text-teal-700',
    rank: 'R2',
    status: 'approved',
    selfScoreDisplay: '3.55',
    canScore: true,
    projectIds: ['beta', 'gamma'],
    groups: [groupA, groupB],
  },
  {
    id: '823',
    code: '823',
    name: 'Ngô Thanh Tùng',
    role: 'Dev - Production',
    initials: 'NT',
    initialsClass: 'bg-orange-100 text-orange-800',
    rank: 'R1',
    status: 'pending_pm',
    selfScoreDisplay: '4.22',
    canScore: true,
    projectIds: ['alpha'],
    groups: [groupA, groupB],
  },
  {
    id: '824',
    code: '824',
    name: 'Bùi Thị Lan',
    role: 'PM Assistant',
    initials: 'BL',
    initialsClass: 'bg-pink-100 text-pink-700',
    rank: 'R4',
    status: 'self_scoring',
    selfScoreDisplay: null,
    canScore: false,
    projectIds: ['alpha', 'beta'],
    groups: emptyGroups(),
  },
  {
    id: '825',
    code: '825',
    name: 'Cao Văn Nam',
    role: 'Dev - Production',
    initials: 'CN',
    initialsClass: 'bg-cyan-100 text-cyan-800',
    rank: 'R2',
    status: 'approved',
    selfScoreDisplay: '3.70',
    canScore: true,
    projectIds: ['gamma'],
    groups: [groupA, groupB],
  },
  {
    id: '826',
    code: '826',
    name: 'Dương Khánh Ly',
    role: 'QC - Production',
    initials: 'DL',
    initialsClass: 'bg-fuchsia-100 text-fuchsia-800',
    rank: 'R3',
    status: 'pending_pm',
    selfScoreDisplay: '3.45',
    canScore: true,
    projectIds: ['alpha', 'beta', 'gamma'],
    groups: [groupA, groupB],
  },
  {
    id: '827',
    code: '827',
    name: 'Erik Nguyen',
    role: 'Dev - Production',
    initials: 'EN',
    initialsClass: 'bg-slate-200 text-slate-700',
    rank: 'R1',
    status: 'self_scoring',
    selfScoreDisplay: null,
    canScore: false,
    projectIds: ['beta'],
    groups: emptyGroups(),
  },
]

/** Tổng trọng số 11 mục (theo chuẩn Excel trong a.html) */
export const PM_MANAGER_TOTAL_WEIGHT = 160

export function flattenKpiItems(emp: PmManagerEmployee): PmManagerKpiItem[] {
  return emp.groups.flatMap(g => g.items)
}

export function statusLabelVi(s: EmployeeSheetStatus): string {
  if (s === 'pending_pm') return 'Chờ duyệt'
  if (s === 'self_scoring') return 'Đang tự chấm'
  return 'Đã duyệt'
}
