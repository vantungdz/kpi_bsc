import apiClient from "./api";

export async function getKpiReviewList(params) {
  const res = await apiClient.get("/kpi-review", { params });
  return res.data;
}

export async function getReviewCycles() {
  const res = await apiClient.get("/review-cycles");
  return res.data;
}

export async function updateKpiReview(id, data) {
  const res = await apiClient.put(`/kpi-review/${id}`, data);
  return res.data;
}

export async function getMyKpisForReview(params) {
  const res = await apiClient.get("/kpi-review/my", { params });
  return res.data;
}

export async function submitMyKpiSelfReview(data) {
  const res = await apiClient.post("/kpi-review/my/self-review", data);
  return res.data;
}

export async function submitSectionReview(
  reviewId,
  sectionScore,
  sectionComment
) {
  return apiClient.post(`/kpi-review/section-review`, {
    reviewId,
    sectionScore,
    sectionComment,
  });
}

export async function submitDepartmentReview(
  reviewId,
  departmentScore,
  departmentComment
) {
  return apiClient.post(`/kpi-review/department-review`, {
    reviewId,
    departmentScore,
    departmentComment,
  });
}

export async function submitManagerReview(
  reviewId,
  managerScore,
  managerComment
) {
  return apiClient.post(`/kpi-review/manager-review`, {
    reviewId,
    managerScore,
    managerComment,
  });
}

export async function completeReview(reviewId) {
  return apiClient.post(`/kpi-review/complete-review`, { reviewId });
}

export async function submitEmployeeFeedback(reviewId, employeeFeedback) {
  return apiClient.post(`/kpi-review/employee-feedback`, {
    reviewId,
    employeeFeedback,
  });
}

export async function getKpiReviewHistory(review) {
  // Ưu tiên lấy theo review.id, nếu không có thì lấy theo kpi.id và cycle
  if (review && review.id) {
    // Nếu backend có API /kpi-review/history/:reviewId thì dùng dòng dưới:
    // const res = await apiClient.get(`/kpi-review/history/${review.id}`);
    // Nếu backend chỉ có /kpi-review/history/:kpiId/:cycle:
    const res = await apiClient.get(
      `/kpi-review/history/${review.kpi?.id}/${review.cycle}`
    );
    return res.data;
  }
  return [];
}
