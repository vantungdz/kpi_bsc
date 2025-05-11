<template>
  <div class="my-kpi-review-page">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item
        ><router-link to="/dashboard">Dashboard</router-link></a-breadcrumb-item
      >
      <a-breadcrumb-item>Đánh giá KPI của tôi</a-breadcrumb-item>
    </a-breadcrumb>

    <a-card :title="pageTitle" :bordered="false">
      <!-- Bộ lọc Chu kỳ -->
      <a-row :gutter="16" style="margin-bottom: 20px">
        <a-col :xs="24" :sm="12" :md="8">
          <a-form-item label="Chọn Chu kỳ Đánh giá">
            <a-select
              v-model:value="selectedCycle"
              placeholder="Chọn chu kỳ để xem"
              @change="fetchMyReview"
              :loading="isLoadingCycles"
            >
              <a-select-option
                v-for="cycle in reviewCycles"
                :key="cycle.id"
                :value="cycle.id"
              >
                {{ cycle.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-spin :spinning="isLoadingMyReview" tip="Đang tải đánh giá của bạn...">
        <a-alert
          v-if="myReviewError"
          type="error"
          show-icon
          closable
          style="margin-bottom: 16px"
          :message="myReviewError"
          @close="clearMyReviewError"
        />

        <div v-if="!selectedCycle" class="empty-state">
          <a-empty description="Vui lòng chọn Chu kỳ để xem đánh giá." />
        </div>

        <div
          v-else-if="!isLoadingMyReview && !reviewDetails && !myReviewError"
          class="empty-state"
        >
          <a-empty
            :description="`Không tìm thấy đánh giá nào cho bạn trong chu kỳ ${getSelectedCycleName()}.`"
          />
        </div>

        <div v-if="reviewDetails && reviewDetails.overallReviewByManager">
          <div style="margin-bottom: 16px; text-align: right">
            <span style="margin-right: 8px">Trạng thái Review:</span>
            <a-tag :color="currentReviewStatusColor">
              {{ currentReviewStatusText }}
            </a-tag>
          </div>

          <!-- Hiển thị Đánh giá Tổng thể của Quản lý -->
          <a-descriptions
            title="Đánh giá Tổng thể từ Quản lý"
            bordered
            :column="1"
            size="small"
            style="margin-bottom: 24px"
          >
            <a-descriptions-item label="Nhận xét Tổng thể">
              {{
                reviewDetails.overallReviewByManager.overallComment ||
                "Chưa có nhận xét."
              }}
            </a-descriptions-item>
            <a-descriptions-item label="Điểm Tổng thể">
              <a-rate
                :value="reviewDetails.overallReviewByManager.overallScore"
                disabled
                v-if="
                  reviewDetails.overallReviewByManager.overallScore !== null
                "
              />
              <span v-else>Chưa có điểm.</span>
            </a-descriptions-item>
          </a-descriptions>

          <!-- Hiển thị Đánh giá Chi tiết từng KPI của Quản lý -->
          <div
            v-if="
              reviewDetails.kpisReviewedByManager &&
              reviewDetails.kpisReviewedByManager.length > 0
            "
          >
            <h3>Đánh giá Chi tiết KPI từ Quản lý</h3>
            <div
              v-for="(kpiItem, index) in reviewDetails.kpisReviewedByManager"
              :key="kpiItem.assignmentId"
              class="kpi-review-item-employee"
            >
              <a-divider v-if="index > 0" />
              <h4>{{ index + 1 }}. {{ kpiItem.kpiName }}</h4>
              <p
                v-if="kpiItem.kpiDescription"
                style="font-style: italic; color: #555; margin-bottom: 8px"
              >
                <strong>Mô tả KPI:</strong> {{ kpiItem.kpiDescription }}
              </p>
              <a-row :gutter="16" style="margin-bottom: 10px">
                <a-col :span="8"
                  ><strong>Mục tiêu:</strong> {{ kpiItem.targetValue }}
                  {{ kpiItem.unit }}</a-col
                >
                <a-col :span="8"
                  ><strong>Thực tế:</strong> {{ kpiItem.actualValue }}
                  {{ kpiItem.unit }}</a-col
                >
                <a-col :span="8">
                  <strong>Hoàn thành:</strong>
                  <a-progress
                    :percent="
                      calculateCompletionRate(
                        kpiItem.actualValue,
                        kpiItem.targetValue
                      )
                    "
                    size="small"
                  />
                </a-col>
              </a-row>
              <p>
                <strong>Nhận xét của Quản lý:</strong>
                {{ kpiItem.existingManagerComment || "Chưa có nhận xét." }}
              </p>
              <p v-if="kpiItem.existingManagerScore !== null">
                <strong>Điểm của Quản lý:</strong>
                <a-rate :value="kpiItem.existingManagerScore" disabled />
              </p>
            </div>
          </div>
          <a-empty
            v-else
            description="Không có đánh giá chi tiết KPI nào từ quản lý."
          />

          <!-- Phần Phản hồi của Nhân viên -->
          <a-divider />
          <h3>Phản hồi của bạn</h3>
          <div
            v-if="
              reviewDetails.overallReviewByManager.status ===
              'EMPLOYEE_FEEDBACK_PENDING'
            "
          >
            <a-form-item label="Nhập phản hồi của bạn về đánh giá này:">
              <!-- Sử dụng Input.TextArea thay vì a-textarea -->
              <Input.TextArea
                v-model:value="employeeFeedbackComment"
                :rows="4"
                placeholder="Ý kiến, giải trình, hoặc kế hoạch cải thiện của bạn..."
              />
            </a-form-item>
            <a-button
              type="primary"
              @click="submitFeedback"
              :loading="isSubmittingFeedback"
            >
              Gửi Phản hồi
            </a-button>
          </div>
          <div v-else-if="reviewDetails.overallReviewByManager.employeeComment">
            <p>
              <strong
                >Phản hồi của bạn (Đã gửi ngày
                {{
                  formatDate(
                    reviewDetails.overallReviewByManager.employeeFeedbackDate
                  )
                }}):</strong
              >
            </p>
            <p style="white-space: pre-wrap">
              {{ reviewDetails.overallReviewByManager.employeeComment }}
            </p>
          </div>
          <div
            v-else-if="
              reviewDetails.overallReviewByManager.status === 'COMPLETED' ||
              reviewDetails.overallReviewByManager.status === 'MANAGER_REVIEWED'
            "
          >
            <p>
              Đánh giá đã được quản lý xem xét hoặc hoàn tất. Không thể gửi phản
              hồi thêm.
            </p>
          </div>
          <div
            v-else-if="
              reviewDetails.overallReviewByManager.status ===
              'EMPLOYEE_RESPONDED'
            "
          >
            <p>Bạn đã gửi phản hồi. Cảm ơn!</p>
          </div>
          <a-alert
            v-if="submitFeedbackError"
            type="error"
            show-icon
            closable
            style="margin-top: 16px"
            :message="submitFeedbackError"
            @close="clearSubmitFeedbackError"
          />
        </div>
      </a-spin>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";
import {
  Card as ACard,
  Row as ARow,
  Col as ACol,
  Select as ASelect,
  SelectOption as ASelectOption,
  FormItem as AFormItem,
  Input,
  Button as AButton,
  Spin as ASpin,
  Alert as AAlert,
  Empty as AEmpty,
  Divider as ADivider,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Progress as AProgress,
  Rate as ARate,
  Tag as ATag,
  notification,
  Breadcrumb as ABreadcrumb,
  BreadcrumbItem as ABreadcrumbItem,
} from "ant-design-vue";
import dayjs from "dayjs";

const store = useStore();

const selectedCycle = ref(null);
const reviewCycles = computed(
  () => store.getters["kpiEvaluations/getReviewCycles"]
);
const isLoadingCycles = computed(
  () => store.getters["kpiEvaluations/isLoadingReviewCycles"]
);

const reviewDetails = computed(
  () => store.getters["kpiEvaluations/getEmployeeReviewDetails"]
);
const isLoadingMyReview = computed(
  () => store.getters["kpiEvaluations/isLoadingEmployeeReview"]
);
const myReviewError = ref(
  computed({
    get: () => store.getters["kpiEvaluations/getEmployeeReviewError"],
    set: (val) => store.commit("kpiEvaluations/SET_EMPLOYEE_REVIEW_ERROR", val),
  })
);

const employeeFeedbackComment = ref("");
const isSubmittingFeedback = computed(
  () => store.getters["kpiEvaluations/isSubmittingEmpFeedback"]
);
const submitFeedbackError = ref(
  computed({
    get: () => store.getters["kpiEvaluations/getSubmitEmpFeedbackError"],
    set: (val) =>
      store.commit("kpiEvaluations/SET_SUBMIT_EMPLOYEE_FEEDBACK_ERROR", val),
  })
);

const pageTitle = computed(() => {
  const cycleName = getSelectedCycleName();
  if (cycleName) {
    return `Đánh giá KPI của tôi - Chu kỳ: ${cycleName}`;
  }
  return "Đánh giá KPI của tôi";
});

const getSelectedCycleName = () => {
  const cycle = reviewCycles.value.find((c) => c.id === selectedCycle.value);
  return cycle ? cycle.name : "";
};

const fetchMyReview = async () => {
  if (!selectedCycle.value) {
    store.commit("kpiEvaluations/SET_EMPLOYEE_REVIEW_DETAILS", null);
    return;
  }
  await store.dispatch("kpiEvaluations/fetchMyReviewDetails", {
    cycleId: selectedCycle.value,
  });
};

const calculateCompletionRate = (actual, target) => {
  if (
    target === null ||
    target === undefined ||
    target === 0 ||
    actual === null ||
    actual === undefined
  ) {
    return 0;
  }
  return Math.round((actual / target) * 100);
};

const submitFeedback = async () => {
  if (!employeeFeedbackComment.value.trim()) {
    notification.error({
      message: "Lỗi",
      description: "Vui lòng nhập nội dung phản hồi.",
    });
    return;
  }
  try {
    await store.dispatch("kpiEvaluations/submitEmployeeFeedback", {
      cycleId: selectedCycle.value,
      employeeComment: employeeFeedbackComment.value,
    });
    notification.success({ message: "Gửi phản hồi thành công!" });
    employeeFeedbackComment.value = "";
  } catch (error) {
    const errorMsg =
      error.response?.data?.message ||
      error.message ||
      "Không thể gửi phản hồi.";
    notification.error({ message: "Lỗi gửi phản hồi", description: errorMsg });
  }
};

const currentReviewStatusText = computed(() => {
  if (!reviewDetails.value || !reviewDetails.value.overallReviewByManager)
    return "Không xác định";
  const statusMap = {
    PENDING_REVIEW: "Chờ Review",
    MANAGER_REVIEWED: "Quản lý Đã Review",
    EMPLOYEE_FEEDBACK_PENDING: "Chờ Bạn Phản hồi",
    EMPLOYEE_RESPONDED: "Bạn Đã Phản hồi",
    COMPLETED: "Hoàn tất",
  };
  return (
    statusMap[reviewDetails.value.overallReviewByManager.status] ||
    "Không xác định"
  );
});

const currentReviewStatusColor = computed(() => {
  if (!reviewDetails.value || !reviewDetails.value.overallReviewByManager)
    return "default";
  const status = reviewDetails.value.overallReviewByManager.status;
  if (status === "EMPLOYEE_FEEDBACK_PENDING") return "orange";
  if (status === "EMPLOYEE_RESPONDED") return "cyan";
  if (status === "COMPLETED") return "green";
  if (status === "MANAGER_REVIEWED") return "blue";
  return "default";
});

const formatDate = (dateString) => {
  if (!dateString) return "";
  return dayjs(dateString).format("DD/MM/YYYY HH:mm");
};

const clearMyReviewError = () => {
  myReviewError.value = null;
};
const clearSubmitFeedbackError = () => {
  submitFeedbackError.value = null;
};

onMounted(async () => {
  await store.dispatch("kpiEvaluations/fetchReviewCycles");
});
</script>

<style scoped>
.my-kpi-review-page {
  padding: 24px;
}
.kpi-review-item-employee {
  margin-bottom: 20px;
  padding: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}
.kpi-review-item-employee h4 {
  margin-bottom: 8px;
}
.empty-state {
  text-align: center;
  padding: 40px 0;
}
</style>
