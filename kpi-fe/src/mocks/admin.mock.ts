/**
 * admin.mock.ts
 * Mock data cho toàn bộ module Admin
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Backend trả về "current" | "future" | "past_YYYY" (YYYY là năm động từ DB) */
export type CampaignPeriod =
  | "current"
  | "future"
  | (string & Record<never, never>);

export interface Campaign {
  id: string;
  label: string;
  period: CampaignPeriod;
  status: "active" | "upcoming" | "archived";
  startDate: string | null;
  endDate: string | null;
  stats: CampaignStats;
}

export interface CampaignStats {
  total: number;
  completed: number;
  pending: number;
  notStarted: number;
  overdue: number;
}

export interface EmployeeProgress {
  id: string;
  name: string;
  email: string;
  section: string;
  division: string;
  status: "completed" | "pending" | "not_started" | "overdue";
  lastUpdate: string | null;
}

export type EmployeeStatus = "active" | "inactive";

export interface Employee {
  id: string;
  code: string;
  name: string;
  email: string;
  /** Tên phòng ban (hiển thị trong bảng) */
  section: string;
  /** Mã cấp bậc, ví dụ: R1, R2 (hiển thị trong bảng) */
  rank: string;
  /** Chức danh (chỉ hiển thị trong bảng, không edit) */
  jobTitle: string;
  status: EmployeeStatus;
}

/** Phòng ban — lấy từ bảng departments trong DB */
export interface Section {
  id: string;
  name: string;
  parentId?: string | null;
}

/** Cấp bậc — lấy từ bảng ranks trong DB */
export interface RankOption {
  id: string;
  code: string;
  name: string;
}

/**
 * Mock phòng ban — khớp với V3__sample_data.sql (SECTION 6: DEPARTMENTS)
 */
export const MOCK_DEPARTMENTS: Section[] = [
  {
    id: "f1000000-0000-0000-0000-000000000001",
    name: "Section 1",
    parentId: null,
  },
  {
    id: "f1000000-0000-0000-0000-000000000002",
    name: "Section 2",
    parentId: "f1000000-0000-0000-0000-000000000001",
  },
  {
    id: "f1000000-0000-0000-0000-000000000003",
    name: "Section 3",
    parentId: "f1000000-0000-0000-0000-000000000002",
  },
  {
    id: "f1000000-0000-0000-0000-000000000004",
    name: "Section 4",
    parentId: "f1000000-0000-0000-0000-000000000002",
  },
];

/**
 * Mock cấp bậc — khớp với V3__sample_data.sql (SECTION 3: RANKS)
 */
export const MOCK_RANK_OPTIONS: RankOption[] = [
  { id: "c1000000-0000-0000-0000-000000000001", code: "R0", name: "Director / GM" },
  { id: "c1000000-0000-0000-0000-000000000002", code: "R1", name: "Junior" },
  { id: "c1000000-0000-0000-0000-000000000003", code: "R2", name: "Mid-Level" },
  { id: "c1000000-0000-0000-0000-000000000004", code: "R3", name: "Senior" },
  { id: "c1000000-0000-0000-0000-000000000005", code: "R4", name: "Lead / Principal" },
];

export type TemplateStatus = "active" | "inactive";
export type TemplateMode = "manual" | "auto";
export type TemplateGroup = "launch" | "reminder" | "approval";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: TemplateStatus;
  mode: TemplateMode;
  group: TemplateGroup;
  updatedAt: string;
}

// ── Campaign Data ──────────────────────────────────────────────────────────────

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "cp-1",
    label: "1st Half 2026 (Đang diễn ra)",
    period: "current",
    status: "active",
    startDate: null,
    endDate: null,
    stats: {
      total: 125,
      completed: 80,
      pending: 20,
      notStarted: 15,
      overdue: 10,
    },
  },
  {
    id: "cp-2",
    label: "2nd Half 2026 (Sắp tới)",
    period: "future",
    status: "upcoming",
    startDate: null,
    endDate: null,
    stats: {
      total: 125,
      completed: 0,
      pending: 0,
      notStarted: 125,
      overdue: 0,
    },
  },
  {
    id: "cp-3",
    label: "Năm 2025 (Đã đóng)",
    period: "past_2025",
    status: "archived",
    startDate: "2025-01-10",
    endDate: "2025-12-31",
    stats: {
      total: 125,
      completed: 125,
      pending: 0,
      notStarted: 0,
      overdue: 0,
    },
  },
  {
    id: "cp-4",
    label: "Năm 2024 (Đã đóng)",
    period: "past_2024",
    status: "archived",
    startDate: "2024-01-08",
    endDate: "2024-12-30",
    stats: {
      total: 120,
      completed: 120,
      pending: 0,
      notStarted: 0,
      overdue: 0,
    },
  },
  {
    id: "cp-5",
    label: "Năm 2023 (Đã đóng)",
    period: "past_2023",
    status: "archived",
    startDate: "2023-01-09",
    endDate: "2023-12-29",
    stats: {
      total: 110,
      completed: 110,
      pending: 0,
      notStarted: 0,
      overdue: 0,
    },
  },
];

export const MOCK_EMPLOYEE_PROGRESS: EmployeeProgress[] = [
  {
    id: "ep-1",
    name: "Nguyễn Văn A",
    email: "nva@company.com",
    section: "Software Dev 1",
    division: "Khối Công nghệ",
    status: "overdue",
    lastUpdate: null,
  },
  {
    id: "ep-2",
    name: "Trần Thị B",
    email: "ttb@company.com",
    section: "Quality Assurance",
    division: "Khối Công nghệ",
    status: "not_started",
    lastUpdate: "Hôm qua, 14:30",
  },
  {
    id: "ep-3",
    name: "Phạm Thị D",
    email: "ptd@company.com",
    section: "Operations",
    division: "Khối Vận hành",
    status: "completed",
    lastUpdate: "12/06",
  },
  {
    id: "ep-4",
    name: "Lê Văn C",
    email: "lvc@company.com",
    section: "Software Dev 2",
    division: "Khối Công nghệ",
    status: "pending",
    lastUpdate: "15/06, 09:00",
  },
  {
    id: "ep-5",
    name: "Hoàng Thị E",
    email: "hte@company.com",
    section: "Customer Support",
    division: "Khối Dịch vụ",
    status: "completed",
    lastUpdate: "10/06",
  },
  {
    id: "ep-6",
    name: "Vũ Minh F",
    email: "vmf@company.com",
    section: "Software Dev 1",
    division: "Khối Công nghệ",
    status: "overdue",
    lastUpdate: null,
  },
];

export const MOCK_PAST_EMPLOYEE_PROGRESS: EmployeeProgress[] = [
  {
    id: "ep-p1",
    name: "Nguyễn Văn A",
    email: "nva@company.com",
    section: "Software Dev 1",
    division: "Khối Công nghệ",
    status: "completed",
    lastUpdate: "Hoàn tất ngày 31/12",
  },
  {
    id: "ep-p2",
    name: "Trần Thị B",
    email: "ttb@company.com",
    section: "Quality Assurance",
    division: "Khối Công nghệ",
    status: "completed",
    lastUpdate: "Hoàn tất ngày 30/12",
  },
  {
    id: "ep-p3",
    name: "Phạm Thị D",
    email: "ptd@company.com",
    section: "Operations",
    division: "Khối Vận hành",
    status: "completed",
    lastUpdate: "Hoàn tất ngày 29/12",
  },
];

// ── Employee Master Data ───────────────────────────────────────────────────────

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "emp-1",
    code: "VNG-001",
    name: "Nguyễn Văn Thắng",
    email: "nguyen.gm@company.vn",
    section: "Section 1",
    rank: "R0",
    jobTitle: "General Manager",
    status: "active",
  },
  {
    id: "emp-2",
    code: "VNG-002",
    name: "Trần Quang Minh",
    email: "tran.pm@company.vn",
    section: "Section 2",
    rank: "R4",
    jobTitle: "Project Manager",
    status: "active",
  },
  {
    id: "emp-3",
    code: "VNG-003",
    name: "Trần Đăng Huy",
    email: "tran.leader@company.vn",
    section: "Section 3",
    rank: "R4",
    jobTitle: "Technical Lead",
    status: "active",
  },
  {
    id: "emp-4",
    code: "VNG-004",
    name: "Nguyễn Thị Lan",
    email: "nguyen.leader2@company.vn",
    section: "Section 4",
    rank: "R3",
    jobTitle: "Senior Developer",
    status: "active",
  },
  {
    id: "emp-5",
    code: "VNG-005",
    name: "Nguyễn Quang Huy",
    email: "huy.nguyen@company.vn",
    section: "Section 3",
    rank: "R1",
    jobTitle: "Junior Developer",
    status: "active",
  },
  {
    id: "emp-6",
    code: "VNG-006",
    name: "Trần Văn Phước",
    email: "phuoc.tran@company.vn",
    section: "Section 3",
    rank: "R2",
    jobTitle: "Mid-Level Developer",
    status: "active",
  },
  {
    id: "emp-7",
    code: "VNG-007",
    name: "Lê Thị Mai",
    email: "mai.le@company.vn",
    section: "Section 3",
    rank: "R2",
    jobTitle: "Mid-Level QA Engineer",
    status: "active",
  },
  {
    id: "emp-8",
    code: "VNG-008",
    name: "Phạm Đức Anh",
    email: "anh.pham@company.vn",
    section: "Section 3",
    rank: "R2",
    jobTitle: "Mid-Level Business Analyst",
    status: "active",
  },
  {
    id: "emp-9",
    code: "VNG-009",
    name: "Vũ Minh Tuấn",
    email: "tuan.vu@company.vn",
    section: "Section 4",
    rank: "R1",
    jobTitle: "Junior Developer",
    status: "active",
  },
  {
    id: "emp-10",
    code: "VNG-010",
    name: "Đặng Thị Hoa",
    email: "hoa.dang@company.vn",
    section: "Section 4",
    rank: "R2",
    jobTitle: "Mid-Level Developer",
    status: "inactive",
  },
];

// ── Email Templates ────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE_BODY = `Kính gửi anh/chị {{Employee_Name}},

Hệ thống Đánh giá KPI cho kỳ {{KPI_Period}} đã chính thức được mở.
Anh/chị vui lòng đăng nhập vào hệ thống để cập nhật kết quả thực hiện công việc và nộp bằng chứng (Evidence) tương ứng.

Thời gian tự đánh giá:
- Hạn chót hoàn thành: {{Deadline_Date}}
- Link truy cập: {{System_URL}}

Lưu ý: Việc nộp trễ có thể ảnh hưởng đến kết quả đánh giá cuối kỳ.
Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ HR hoặc Quản lý trực tiếp (PM).

Trân trọng,
HR & Admin Team`;

export const MOCK_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "tpl-1",
    name: "Thông báo Mở kỳ Đánh giá KPI",
    subject: "[Thông báo] Yêu cầu thực hiện Đánh giá KPI ({{KPI_Period}})",
    body: DEFAULT_TEMPLATE_BODY,
    status: "active",
    mode: "manual",
    group: "launch",
    updatedAt: "2 ngày trước",
  },
  {
    id: "tpl-2",
    name: "Nhắc nhở trước Deadline 1 ngày",
    subject:
      "[Nhắc nhở] Còn 1 ngày để hoàn thành đánh giá KPI ({{KPI_Period}})",
    body: `Kính gửi anh/chị {{Employee_Name}},\n\nHệ thống ghi nhận anh/chị vẫn chưa hoàn thành đánh giá KPI kỳ {{KPI_Period}}.\nCòn {{Missing_Count}} mục KPI cần cập nhật. Hạn chót: {{Deadline_Date}}.\n\nVui lòng đăng nhập ngay: {{System_URL}}\n\nTrân trọng,\nHR & Admin Team`,
    status: "active",
    mode: "auto",
    group: "reminder",
    updatedAt: "15/01/2025",
  },
  {
    id: "tpl-3",
    name: "Cảnh báo Quá hạn Đánh giá",
    subject: "[KHẨN] Quá hạn nộp đánh giá KPI - {{Employee_Name}}",
    body: `Kính gửi anh/chị {{Employee_Name}},\n\nHệ thống ghi nhận anh/chị đã quá hạn nộp đánh giá KPI kỳ {{KPI_Period}}.\nVui lòng liên hệ ngay với HR để được hỗ trợ xử lý.\n\nTrân trọng,\nHR & Admin Team`,
    status: "active",
    mode: "auto",
    group: "reminder",
    updatedAt: "10/01/2025",
  },
  {
    id: "tpl-4",
    name: "Nhắc nhở Cập nhật lại (Revision)",
    subject: "[Yêu cầu] Cập nhật lại bằng chứng KPI - {{Employee_Name}}",
    body: `Kính gửi anh/chị {{Employee_Name}},\n\nQuản lý của bạn đã yêu cầu bạn cập nhật lại bằng chứng cho một số mục KPI.\nComment từ PM: {{Manager_Comment}}\n\nVui lòng đăng nhập và xử lý: {{System_URL}}\n\nTrân trọng,\nHR & Admin Team`,
    status: "active",
    mode: "manual",
    group: "reminder",
    updatedAt: "05/01/2025",
  },
  {
    id: "tpl-5",
    name: "Thông báo Đã duyệt KPI",
    subject: "[Thông báo] Kết quả Đánh giá KPI kỳ {{KPI_Period}} đã được duyệt",
    body: `Kính gửi anh/chị {{Employee_Name}},\n\nGM đã hoàn tất quá trình review và chốt điểm KPI cho kỳ {{KPI_Period}}.\nVui lòng đăng nhập để xem kết quả đánh giá chi tiết của bạn.\n\nLink truy cập: {{System_URL}}\n\nTrân trọng,\nHR & Admin Team`,
    status: "active",
    mode: "auto",
    group: "approval",
    updatedAt: "01/01/2025",
  },
];

export const TEMPLATE_VARIABLES = {
  recipient: [
    { key: "{{Employee_Name}}", desc: "Ví dụ: Nguyễn Văn A" },
    { key: "{{Employee_Code}}", desc: "Ví dụ: VNG-001" },
    { key: "{{Section_Name}}", desc: "Ví dụ: Software Dev 1" },
  ],
  campaign: [
    { key: "{{KPI_Period}}", desc: "Ví dụ: 1st Half 2025" },
    { key: "{{Deadline_Date}}", desc: "Ngày hết hạn" },
    { key: "{{System_URL}}", desc: "Link hệ thống" },
  ],
  reminder: [
    { key: "{{Missing_Count}}", desc: "Số KPI chưa nộp" },
    { key: "{{Manager_Comment}}", desc: "Comment của PM" },
  ],
};
