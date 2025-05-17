export enum OverallReviewStatus {
  DRAFT = 'DRAFT', // Nhân viên tự đánh giá, chưa gửi
  PENDING_REVIEW = 'PENDING_REVIEW', // Nhân viên đã submit, chờ section/department review
  SECTION_REVIEW_PENDING = 'SECTION_REVIEW_PENDING', // Chờ section review
  SECTION_REVIEWED = 'SECTION_REVIEWED', // Section đã review, chờ department duyệt
  SECTION_REVISE_REQUIRED = 'SECTION_REVISE_REQUIRED', // Section phải sửa lại theo yêu cầu department
  DEPARTMENT_REVIEW_PENDING = 'DEPARTMENT_REVIEW_PENDING', // Chờ department review
  DEPARTMENT_REVIEWED = 'DEPARTMENT_REVIEWED', // Department đã review, chờ manager/admin duyệt
  DEPARTMENT_REVISE_REQUIRED = 'DEPARTMENT_REVISE_REQUIRED', // Department phải sửa lại theo yêu cầu manager/admin
  MANAGER_REVIEW_PENDING = 'MANAGER_REVIEW_PENDING', // Chờ manager/admin review
  MANAGER_REVIEWED = 'MANAGER_REVIEWED', // Manager/Admin đã review, chờ nhân viên phản hồi
  EMPLOYEE_FEEDBACK_PENDING = 'EMPLOYEE_FEEDBACK_PENDING', // Chờ nhân viên phản hồi
  EMPLOYEE_RESPONDED = 'EMPLOYEE_RESPONDED', // Nhân viên đã phản hồi
  COMPLETED = 'COMPLETED', // Đánh giá hoàn tất
}
