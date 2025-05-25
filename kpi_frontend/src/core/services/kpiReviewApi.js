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
