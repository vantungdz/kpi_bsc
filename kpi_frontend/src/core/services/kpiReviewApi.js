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
  if (review && review.id) {
    const res = await apiClient.get(
      `/kpi-review/history/${review.kpi?.id}/${review.cycle}`
    );
    return res.data;
  }
  return [];
}

export async function submitReviewByRole(reviewId, score, comment) {
  return apiClient.post(`/kpi-review/submit-review`, {
    reviewId,
    score,
    comment,
  });
}

export async function submitSectionReview(reviewId, score, comment) {
  return apiClient.post(`/kpi-review/section-review`, {
    reviewId,
    score,
    comment,
  });
}

export async function submitDepartmentReview(reviewId, score, comment) {
  return apiClient.post(`/kpi-review/department-review`, {
    reviewId,
    score,
    comment,
  });
}

export async function submitManagerReview(reviewId, score, comment) {
  return apiClient.post(`/kpi-review/manager-review`, {
    reviewId,
    score,
    comment,
  });
}

export async function rejectReviewByRole(reviewId, rejectionReason) {
  return apiClient.post(`/kpi-review/reject`, {
    reviewId,
    rejectionReason,
  });
}
