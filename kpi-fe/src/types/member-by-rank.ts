/** Một dòng `GET /kpi/reference/members-by-rank?rankCode=` hoặc `GET .../promotion-assignees`. */
export interface MemberByRankOption {
  id: string
  username: string
  email: string
  fullName: string
  /** Có thể rỗng nếu user chưa gán chức danh / rank. */
  rankCode?: string | null
  departmentName?: string | null
}
