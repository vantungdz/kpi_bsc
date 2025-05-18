<template>
  <div class="my-kpi-review-page">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t("dashboard") }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{ $t("myKpiReviewTitle") }}</a-breadcrumb-item>
    </a-breadcrumb>

    <a-card :title="pageTitle" :bordered="false">
      <a-row :gutter="16" style="margin-bottom: 20px">
        <a-col :xs="24" :sm="12" :md="8">
          <a-form-item :label="$t('selectCycle')">
            <a-select
              v-model:value="selectedCycle"
              :placeholder="$t('selectCyclePlaceholder')"
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

      <a-spin :spinning="isLoadingMyReview" :tip="$t('loadingMyReview')">
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
          <a-empty :description="$t('selectCycleToView')" />
        </div>

        <div
          v-else-if="
            !isLoadingMyReview &&
            (!reviewDetails ||
              (reviewDetails.kpisReviewedByManager &&
                reviewDetails.kpisReviewedByManager.length === 0)) &&
            !myReviewError
          "
          class="empty-state"
        >
          <a-empty :description="$t('noDetailedKpiReview')" />
        </div>

        <div
          v-if="
            reviewDetails &&
            reviewDetails.kpisReviewedByManager &&
            reviewDetails.kpisReviewedByManager.length > 0
          "
        >
          <template v-if="canEditSelfReview">
            <h3>{{ $t("detailedKpiReview") }}</h3>
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
                <strong>{{ $t("kpiDescription") }}:</strong>
                {{ kpiItem.kpiDescription }}
              </p>
              <a-row :gutter="16" style="margin-bottom: 10px">
                <a-col :span="6">
                  <strong>{{ $t("target") }}:</strong>
                  {{ Number(kpiItem.targetValue).toLocaleString() }}
                  {{ kpiItem.unit }}
                </a-col>
                <a-col :span="6">
                  <strong>{{ $t("actualResult") }}:</strong>
                  {{ kpiItem.actualValue }}
                  {{ kpiItem.unit }}
                </a-col>
                <a-col :span="6">
                  <strong>{{ $t("completionRate") }}:</strong>
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
                <a-col :span="3">
                  <strong>{{ $t("weight") }}:</strong> {{ kpiItem.weight }}
                </a-col>
                <a-col :span="3">
                  <strong>{{ $t("weightedScoreSupervisor") }}:</strong>
                  {{ getWeightedScore(kpiItem) }}
                </a-col>
              </a-row>
              <a-form-item :label="$t('selfComment')">
                <Input.TextArea
                  v-model:value="selfKpiReviews[index].selfComment"
                  :rows="3"
                  :placeholder="$t('selfCommentPlaceholder')"
                  :disabled="isSubmittingSelfReview || !canEditSelfReview"
                />
              </a-form-item>
              <a-form-item :label="$t('selfScore')">
                <a-rate
                  v-model:value="selfKpiReviews[index].selfScore"
                  :disabled="isSubmittingSelfReview || !canEditSelfReview"
                />
              </a-form-item>
              <p>
                <strong>{{ $t("managerComment") }}:</strong>
                {{ kpiItem.existingManagerComment || $t("noComment") }}
              </p>
              <p v-if="kpiItem.existingManagerScore !== null">
                <strong>{{ $t("managerScore") }}:</strong>
                <a-rate :value="kpiItem.existingManagerScore" disabled />
              </p>
            </div>
            <a-divider />
            <div
              style="text-align: right; margin-bottom: 16px"
              v-if="
                reviewDetails.kpisReviewedByManager &&
                reviewDetails.kpisReviewedByManager.length > 0
              "
            >
              <strong>{{ $t("totalWeightedScoreSupervisor") }}:</strong>
              <span style="font-size: 1.2em; color: #1890ff">
                {{ totalWeightedScoreSupervisor }}
              </span>
            </div>
            <div style="text-align: right; margin-top: 24px">
              <a-button
                type="primary"
                @click="submitSelfReview"
                :loading="isSubmittingSelfReview"
                :disabled="isSubmittingSelfReview || !canEditSelfReview"
              >
                {{ $t("submitSelfReview") }}
              </a-button>
            </div>
          </template>
          <template v-else>
            <div style="margin-bottom: 16px; text-align: right">
              <span style="margin-right: 8px">{{ $t("reviewStatus") }}:</span>
              <a-tag :color="currentReviewStatusColor">
                {{ currentReviewStatusText }}
              </a-tag>
            </div>
            <a-descriptions
              :title="$t('overallManagerReview')"
              bordered
              :column="1"
              size="small"
              style="margin-bottom: 24px"
            >
              <a-descriptions-item :label="$t('overallComment')">
                {{
                  reviewDetails.overallReviewByManager.overallComment ||
                  $t("noComment")
                }}
              </a-descriptions-item>
              <a-descriptions-item :label="$t('overallScore')">
                <a-rate
                  :value="reviewDetails.overallReviewByManager.overallScore"
                  disabled
                  v-if="
                    reviewDetails.overallReviewByManager.overallScore !== null
                  "
                />
                <span v-else>{{ $t("noScore") }}</span>
              </a-descriptions-item>
            </a-descriptions>
            <h3>{{ $t("detailedKpiReview") }}</h3>
            <div
              v-for="(kpiItem, index) in reviewDetails.kpisReviewedByManager"
              :key="kpiItem.assignmentId"
              class="kpi-review-item-employee"
            >
              <template
                v-if="kpiItem && kpiItem.assignmentId && kpiItem.kpiName"
              >
                <a-divider v-if="index > 0" />
                <h4>{{ index + 1 }}. {{ kpiItem.kpiName }}</h4>
                <p
                  v-if="kpiItem.kpiDescription"
                  style="font-style: italic; color: #555; margin-bottom: 8px"
                >
                  <strong>{{ $t("kpiDescription") }}:</strong>
                  {{ kpiItem.kpiDescription }}
                </p>
                <a-row :gutter="16" style="margin-bottom: 10px">
                  <a-col :span="6">
                    <strong>{{ $t("target") }}:</strong>
                    {{ Number(kpiItem.targetValue).toLocaleString() }}
                    {{ kpiItem.unit }}
                  </a-col>
                  <a-col :span="6">
                    <strong>{{ $t("actualResult") }}:</strong>
                    {{ kpiItem.actualValue }}
                    {{ kpiItem.unit }}
                  </a-col>
                  <a-col :span="6">
                    <strong>{{ $t("completionRate") }}:</strong>
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
                  <a-col :span="3">
                    <strong>{{ $t("weight") }}:</strong> {{ kpiItem.weight }}
                  </a-col>
                  <a-col :span="3">
                    <strong>{{ $t("weightedScoreSupervisor") }}:</strong>
                    {{ getWeightedScore(kpiItem) }}
                  </a-col>
                </a-row>
                <div>
                  <p>
                    <strong>{{ $t("selfComment") }}:</strong>
                    {{ kpiItem.selfComment || $t("noComment") }}
                  </p>
                  <p>
                    <strong>{{ $t("selfScore") }}:</strong>
                    <a-rate :value="kpiItem.selfScore" disabled />
                  </p>
                </div>
                <p>
                  <strong>{{ $t("managerComment") }}:</strong>
                  {{ kpiItem.existingManagerComment || $t("noComment") }}
                </p>
                <p v-if="kpiItem.existingManagerScore !== null">
                  <strong>{{ $t("managerScore") }}:</strong>
                  <a-rate :value="kpiItem.existingManagerScore" disabled />
                </p>
              </template>
              <template v-else>
                <a-alert
                  type="warning"
                  :message="$t('invalidKpiAssignmentData')"
                  show-icon
                />
              </template>
            </div>
            <a-divider />
            <div style="text-align: right; margin-bottom: 16px">
              <strong>{{ $t("totalWeightedScoreSupervisor") }}:</strong>
              <span style="font-size: 1.2em; color: #1890ff">
                {{ totalWeightedScoreSupervisor }}
              </span>
            </div>
          </template>
        </div>

        <div
          v-if="
            selectedCycle &&
            reviewDetails &&
            reviewDetails.overallReviewByManager
          "
        >
          <a-divider />
          <h3>{{ $t("yourFeedback") }}</h3>
          <div
            v-if="
              reviewDetails &&
              reviewDetails.overallReviewByManager &&
              reviewDetails.overallReviewByManager.status ===
                'EMPLOYEE_FEEDBACK_PENDING'
            "
          >
            <a-form-item :label="$t('enterYourFeedback')">
              <Input.TextArea
                v-model:value="employeeFeedbackComment"
                :rows="4"
                :placeholder="$t('feedbackPlaceholder')"
              />
            </a-form-item>
            <a-button
              type="primary"
              @click="submitFeedback"
              :loading="isSubmittingFeedback"
            >
              {{ $t("submitFeedback") }}
            </a-button>
          </div>
          <div
            v-else-if="
              reviewDetails &&
              reviewDetails.overallReviewByManager &&
              reviewDetails.overallReviewByManager.employeeComment
            "
          >
            <p>
              <strong>
                {{ $t("yourFeedbackSentOn") }}
                {{
                  formatDate(
                    reviewDetails.overallReviewByManager.employeeFeedbackDate
                  )
                }}:
              </strong>
            </p>
            <p style="white-space: pre-wrap">
              {{ reviewDetails.overallReviewByManager.employeeComment }}
            </p>
          </div>
          <div
            v-else-if="
              reviewDetails &&
              reviewDetails.overallReviewByManager &&
              (reviewDetails.overallReviewByManager.status === 'COMPLETED' ||
                reviewDetails.overallReviewByManager.status ===
                  'MANAGER_REVIEWED')
            "
          >
            <p>{{ $t("reviewCompletedOrReviewed") }}</p>
          </div>
          <div
            v-else-if="
              reviewDetails &&
              reviewDetails.overallReviewByManager &&
              reviewDetails.overallReviewByManager.status ===
                'EMPLOYEE_RESPONDED'
            "
          >
            <p>{{ $t("feedbackAlreadySent") }}</p>
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
import { ref, computed, onMounted, watch, onUnmounted } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
const { t: $t } = useI18n();
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

const isSubmittingSelfReview = ref(false);

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
    return `${$t("myKpiReviewTitle")} - ${$t("selectCycle")}: ${cycleName}`;
  }
  return $t("myKpiReviewTitle");
});

const getSelectedCycleName = () => {
  const cycle = reviewCycles.value.find((c) => c.id === selectedCycle.value);
  return cycle ? cycle.name : "";
};

const fetchMyReview = async () => {
  if (!selectedCycle.value) {
    store.commit("kpiEvaluations/SET_EMPLOYEE_REVIEW_DETAILS", null);
    if (myReviewError.value) {
      myReviewError.value = null;
    }
    return;
  }
  myReviewError.value = null;
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

const getWeightedScore = (kpiItem) => {
  if (!kpiItem.weight || !kpiItem.existingManagerScore) return 0;
  return Math.round(kpiItem.weight * kpiItem.existingManagerScore * 100) / 100;
};

const totalWeightedScoreSupervisor = computed(() => {
  if (!reviewDetails.value || !reviewDetails.value.totalWeightedScoreSupervisor)
    return 0;
  return Number(reviewDetails.value.totalWeightedScoreSupervisor).toFixed(2);
});

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
    // Sau khi gửi feedback, fetch lại reviewDetails để cập nhật trạng thái và feedback mới nhất
    await fetchMyReview();
    // Chỉ clear comment khi submit thành công
    employeeFeedbackComment.value = "";
  } catch (error) {
    const errorMsg =
      error.response?.data?.message ||
      error.message ||
      "Không thể gửi phản hồi.";
    notification.error({ message: "Lỗi gửi phản hồi", description: errorMsg });
  }
};

const selfKpiReviews = ref([]);

// Thêm biến này để kiểm soát việc sync selfKpiReviews khi đang submit
const isSyncingSelfKpiReviews = ref(false);

watch(
  () => reviewDetails.value,
  (val) => {
    // Chỉ sync selfKpiReviews nếu không trong lúc submit hoặc đang sync lại
    if (
      val &&
      val.kpisReviewedByManager &&
      !isSubmittingSelfReview.value &&
      !isSyncingSelfKpiReviews.value
    ) {
      selfKpiReviews.value = val.kpisReviewedByManager.map((kpi) => ({
        assignmentId: kpi.assignmentId,
        selfScore: kpi.selfScore ?? null,
        selfComment: kpi.selfComment ?? "",
      }));
      // Log trạng thái và dữ liệu selfKpiReviews để debug
      console.log(
        "[MyKpiReview] overallReviewByManager.status:",
        val.overallReviewByManager?.status
      );
      console.log(
        "[MyKpiReview] selfKpiReviews:",
        JSON.parse(JSON.stringify(selfKpiReviews.value))
      );
    }
  },
  { immediate: true, deep: true }
);

const canEditSelfReview = computed(() => {
  if (!reviewDetails.value || !reviewDetails.value.kpisReviewedByManager)
    return false;
  if (!reviewDetails.value.overallReviewByManager) return true;
  return reviewDetails.value.overallReviewByManager.status === "DRAFT";
});

const submitSelfReview = async () => {
  if (!reviewDetails.value || !reviewDetails.value.kpisReviewedByManager)
    return;
  const invalid = selfKpiReviews.value.some(
    (kpi) => kpi.selfScore === null || kpi.selfScore === undefined
  );
  if (invalid) {
    notification.error({
      message: $t("error"),
      description: $t("pleaseEnterAllSelfScores"),
    });
    return;
  }
  // Đồng bộ selfKpiReviews vào reviewDetails trước khi submit
  reviewDetails.value.kpisReviewedByManager.forEach((kpi, idx) => {
    kpi.selfScore = selfKpiReviews.value[idx].selfScore;
    kpi.selfComment = selfKpiReviews.value[idx].selfComment;
  });
  isSubmittingSelfReview.value = true;
  try {
    await store.dispatch("kpiEvaluations/submitSelfKpiReview", {
      cycleId: selectedCycle.value,
      kpiReviews: selfKpiReviews.value.map((kpi) => ({
        assignmentId: kpi.assignmentId,
        selfScore: kpi.selfScore,
        selfComment: kpi.selfComment,
      })),
    });
    notification.success({ message: $t("submitSelfReviewSuccess") });
    // Đảm bảo fetch lại reviewDetails và sync lại selfKpiReviews
    isSyncingSelfKpiReviews.value = true;
    await fetchMyReview();
    isSyncingSelfKpiReviews.value = false;
  } catch (error) {
    notification.error({
      message: $t("error"),
      description: error?.message || $t("submitSelfReviewError"),
    });
  } finally {
    isSubmittingSelfReview.value = false;
  }
};

const currentReviewStatusText = computed(() => {
  if (!reviewDetails.value || !reviewDetails.value.overallReviewByManager)
    return "Không xác định";
  const statusMap = {
    DRAFT: "Nháp",
    PENDING_REVIEW: "Chờ Review",
    SECTION_REVIEW_PENDING: "Chờ Trưởng Bộ phận Review",
    SECTION_REVIEWED: "Trưởng Bộ phận đã Review",
    SECTION_REVISE_REQUIRED: "Trưởng Bộ phận yêu cầu chỉnh sửa",
    DEPARTMENT_REVIEW_PENDING: "Chờ Trưởng Phòng Review",
    DEPARTMENT_REVIEWED: "Trưởng Phòng đã Review",
    DEPARTMENT_REVISE_REQUIRED: "Trưởng Phòng yêu cầu chỉnh sửa",
    MANAGER_REVIEW_PENDING: "Chờ Quản lý Review",
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

watch(selectedCycle, (val) => {
  if (!val) {
    store.commit("kpiEvaluations/SET_EMPLOYEE_REVIEW_DETAILS", null);
    if (myReviewError.value) myReviewError.value = null;
  }
});
onUnmounted(() => {
  store.commit("kpiEvaluations/SET_EMPLOYEE_REVIEW_DETAILS", null);
  selectedCycle.value = null;
  myReviewError.value = null;
  employeeFeedbackComment.value = "";
});

onMounted(async () => {
  if (myReviewError.value) {
    myReviewError.value = null;
  }
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
