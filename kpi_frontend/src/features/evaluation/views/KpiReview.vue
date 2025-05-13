<template>
  <div class="kpi-review-page">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t("dashboard") }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{ $t("kpiReviewTitle") }}</a-breadcrumb-item>
    </a-breadcrumb>

    <a-card :title="pageTitle" :bordered="false">
      <a-row :gutter="16" style="margin-bottom: 20px">
        <a-col :xs="24" :sm="12" :md="8">
          <a-form-item :label="$t('selectTarget')">
            <a-select
              v-model:value="selectedTarget"
              :placeholder="$t('selectTargetPlaceholder')"
              show-search
              :filter-option="filterOption"
              @change="handleTargetChange"
              :loading="isLoadingTargets"
            >
              <a-select-option
                v-for="target in filteredReviewTargets"
                :key="`${target.type}-${target.id}`"
                :value="`${target.type}-${target.id}`"
              >
                {{ target.name }} ({{
                  target.type === "employee"
                    ? $t("employee")
                    : $t("departmentOrSection")
                }})
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="12" :md="8">
          <a-form-item :label="$t('selectCycle')">
            <a-select
              v-model:value="selectedCycle"
              :placeholder="$t('selectCyclePlaceholder')"
              @change="fetchKpisForReview"
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
        <a-col
          :xs="24"
          :sm="12"
          :md="8"
          style="display: flex; align-items: flex-end; padding-bottom: 24px"
        >
          <a-button
            v-if="selectedTarget && selectedCycle"
            type="dashed"
            @click="viewTargetReviewHistory"
          >
            {{ $t("viewReviewHistory") }}
          </a-button>
        </a-col>
      </a-row>

      <a-spin :spinning="isLoadingKpis" :tip="$t('loadingKpis')">
        <a-alert
          v-if="loadingError"
          type="error"
          show-icon
          closable
          style="margin-bottom: 16px"
          :message="loadingError"
          @close="loadingError = null"
        />

        <div v-if="!selectedTarget || !selectedCycle" class="empty-state">
          <a-empty :description="$t('selectTargetAndCycle')" />
        </div>

        <div
          v-else-if="
            !isLoadingKpis && kpisToReview.length === 0 && !loadingError
          "
          class="empty-state"
        >
          <a-empty
            :description="`${$t('noKpisToReview')} ${getSelectedTargetName()} ${$t('inCycle')} ${getSelectedCycleName()}.`"
          />
        </div>

        <div v-else-if="kpisToReview.length > 0">
          <div style="margin-bottom: 16px; text-align: right">
            <span style="margin-right: 8px">{{ $t("reviewStatus") }}:</span>
            <a-tag :color="reviewStatusColor">
              {{ reviewStatusText }}
            </a-tag>
          </div>

          <a-form
            layout="vertical"
            @finish="submitReviewData"
            @finishFailed="onFinishFailed"
          >
            <div
              v-for="(kpiItem, index) in kpisToReview"
              :key="kpiItem.assignmentId"
              class="kpi-review-item"
            >
              <a-divider v-if="index > 0" />
              <p
                v-if="kpiItem.kpiDescription"
                style="font-style: italic; color: #555; margin-bottom: 8px"
              >
                <strong>{{ $t("kpiDescription") }}:</strong>
                {{ kpiItem.kpiDescription }}
              </p>
              <h3>{{ index + 1 }}. {{ kpiItem.kpiName }}</h3>
              <a-row :gutter="16">
                <a-col :span="8">
                  <a-descriptions size="small" bordered :column="1">
                    <a-descriptions-item :label="$t('target')">
                      {{ kpiItem.targetValue }} {{ kpiItem.unit }}
                    </a-descriptions-item>
                  </a-descriptions>
                </a-col>
                <a-col :span="8">
                  <a-descriptions size="small" bordered :column="1">
                    <a-descriptions-item :label="$t('actualResult')">
                      {{ kpiItem.actualValue }} {{ kpiItem.unit }}
                    </a-descriptions-item>
                  </a-descriptions>
                </a-col>
                <a-col :span="8">
                  <a-descriptions size="small" bordered :column="1">
                    <a-descriptions-item :label="$t('completionRate')">
                      <a-progress
                        :percent="
                          calculateCompletionRate(
                            kpiItem.actualValue,
                            kpiItem.targetValue
                          )
                        "
                        :status="
                          getCompletionStatus(
                            calculateCompletionRate(
                              kpiItem.actualValue,
                              kpiItem.targetValue
                            )
                          )
                        "
                      />
                    </a-descriptions-item>
                  </a-descriptions>
                </a-col>
              </a-row>

              <a-form-item
                :label="`${$t('managerCommentForKpi')} ${kpiItem.kpiName}`"
                :name="['kpiItem', index, 'managerComment']"
                style="margin-top: 10px"
              >
                <a-textarea
                  v-model:value="kpiItem.managerComment"
                  :placeholder="$t('managerCommentPlaceholder')"
                  :rows="3"
                  :disabled="
                    isLoadingKpis || overallReview.status === 'COMPLETED'
                  "
                />
              </a-form-item>

              <a-form-item
                :label="`${$t('managerScoreForKpi')} ${kpiItem.kpiName}`"
                :name="['kpiItem', index, 'managerScore']"
              >
                <a-rate v-model:value="kpiItem.managerScore" />
              </a-form-item>
            </div>

            <a-divider />
            <div
              v-if="
                overallReview.employeeComment &&
                (overallReview.status === 'EMPLOYEE_RESPONDED' ||
                  overallReview.status === 'COMPLETED')
              "
            >
              <h3>{{ $t("employeeFeedback") }}</h3>
              <a-descriptions
                bordered
                :column="1"
                size="small"
                style="margin-bottom: 16px"
              >
                <a-descriptions-item :label="$t('feedbackDate')">
                  {{ formatDate(overallReview.employeeFeedbackDate) }}
                </a-descriptions-item>
                <a-descriptions-item :label="$t('feedbackContent')">
                  <p style="white-space: pre-wrap">
                    {{ overallReview.employeeComment }}
                  </p>
                </a-descriptions-item>
              </a-descriptions>
              <a-divider />
            </div>

            <a-form-item
              :label="$t('overallManagerComment')"
              name="overallManagerComment"
            >
              <Input.TextArea
                v-model:value="overallReview.managerComment"
                :placeholder="$t('overallManagerCommentPlaceholder')"
                :rows="5"
              />
            </a-form-item>

            <a-form-item
              :label="$t('overallManagerScore')"
              name="overallManagerScore"
            >
              <a-rate v-model:value="overallReview.managerScore" />
            </a-form-item>

            <a-form-item>
              <a-button
                type="primary"
                html-type="button"
                @click="handleSaveButtonClick"
                :loading="isSubmitting"
                :disabled="
                  isLoadingKpis || overallReview.status === 'COMPLETED'
                "
              >
                {{ $t("saveReview") }}
              </a-button>
              <a-button
                v-if="
                  overallReview.status === 'MANAGER_REVIEWED' ||
                  overallReview.status === 'EMPLOYEE_FEEDBACK_PENDING' ||
                  overallReview.status === 'EMPLOYEE_RESPONDED'
                "
                type="primary"
                danger
                @click="handleCompleteReview"
                :loading="isCompletingReview"
                style="margin-left: 8px"
              >
                {{ $t("completeReview") }}
              </a-button>
            </a-form-item>
          </a-form>
        </div>
      </a-spin>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import {
  Card as ACard,
  Row as ARow,
  Col as ACol,
  Select as ASelect,
  SelectOption as ASelectOption,
  Form as AForm,
  FormItem as AFormItem,
  Input,
  Button as AButton,
  Spin as ASpin,
  Alert as AAlert,
  Empty as AEmpty,
  Divider as ADivider,
  Descriptions as ADescriptions,
  Tag as ATag,
  DescriptionsItem as ADescriptionsItem,
  Progress as AProgress,
  notification,
  Breadcrumb as ABreadcrumb,
  Rate as ARate,
  BreadcrumbItem as ABreadcrumbItem,
} from "ant-design-vue";
import { useI18n } from "vue-i18n";

const { t: $t } = useI18n();
import dayjs from "dayjs";
import { cloneDeep } from "lodash-es";

const store = useStore();
const router = useRouter(); 

const selectedTarget = ref(null);
const reviewTargets = computed(
  () => store.getters["kpiEvaluations/getReviewableTargets"]
);
const isLoadingTargets = computed(
  () => store.getters["kpiEvaluations/isLoadingReviewableTargets"]
);

const currentUser = computed(() => store.getters["auth/user"]);

const filteredReviewTargets = computed(() => {
  if (!reviewTargets.value || !Array.isArray(reviewTargets.value)) return [];
  const user = currentUser.value;
  if (!user) return reviewTargets.value;
  
  if (user.role === "admin") return reviewTargets.value;
  
  if (user.role === "manager" || user.role === "department") {
    
    return reviewTargets.value.filter(
      (t) => t.type === "employee" || t.type === "section"
    );
  }
  
  if (user.role === "section") {
    return reviewTargets.value.filter(
      (t) => t.type === "employee" || t.type === "section"
    );
  }
  
  return reviewTargets.value;
});

const selectedCycle = ref(null);
const reviewCycles = computed(
  () => store.getters["kpiEvaluations/getReviewCycles"]
);
const isLoadingCycles = computed(
  () => store.getters["kpiEvaluations/isLoadingReviewCycles"]
);

const kpisFromStore = computed(
  () => store.getters["kpiEvaluations/getKpisToReview"]
);
const existingOverallReviewFromStore = computed(
  () => store.getters["kpiEvaluations/getExistingOverallReview"]
);
const kpisToReview = ref([]);
const isLoadingKpis = computed(
  () => store.getters["kpiEvaluations/isLoadingKpisToReview"]
);
const loadingError = computed(
  () => store.getters["kpiEvaluations/getKpisToReviewError"]
);

const overallReview = ref({
  managerComment: "",
  managerScore: null,
  employeeComment: null,
  employeeFeedbackDate: null,
  status: null,
});

const isSubmitting = computed(
  () => store.getters["kpiEvaluations/isSubmittingKpiReview"]
);
const submitError = computed(
  () => store.getters["kpiEvaluations/getSubmitKpiReviewError"]
);

const isCompletingReview = computed(
  () => store.getters["kpiEvaluations/isCompletingKpiReview"]
);

watch(
  kpisFromStore,
  (newKpis) => {
    console.log(
      "KpiReview.vue: kpisFromStore watcher triggered. newKpis:",
      newKpis
    );

    if (newKpis && Array.isArray(newKpis)) {
      kpisToReview.value = cloneDeep(newKpis).map((kpi) => ({
        ...kpi,

        managerComment: kpi.existingManagerComment || "",
        managerScore:
          kpi.existingManagerScore === undefined
            ? null
            : kpi.existingManagerScore,
      }));
    } else {
      kpisToReview.value = [];
    }
    console.log(
      "KpiReview.vue: local kpisToReview.value updated:",
      kpisToReview.value
    );
  },
  { deep: true, immediate: true }
);

watch(
  existingOverallReviewFromStore,
  (newOverallReview) => {
    if (newOverallReview) {
      overallReview.value.managerComment =
        newOverallReview.overallComment || "";
      overallReview.value.managerScore =
        newOverallReview.overallScore === undefined
          ? null
          : newOverallReview.overallScore;
      overallReview.value.status = newOverallReview.status || null;
      overallReview.value.employeeComment =
        newOverallReview.employeeComment || null;
      overallReview.value.employeeFeedbackDate =
        newOverallReview.employeeFeedbackDate || null;
    } else {
      overallReview.value.managerComment = "";
      overallReview.value.managerScore = null;
      overallReview.value.status = null;
      overallReview.value.employeeComment = null;
      overallReview.value.employeeFeedbackDate = null;
    }
  },
  { deep: true, immediate: true }
);

const pageTitle = computed(() => {
  const targetName = getSelectedTargetName();
  const cycleName = getSelectedCycleName();
  if (targetName && cycleName) {
    return `${$t("kpiReviewTitleFor")} ${targetName} - ${$t("cycle")}: ${cycleName}`;
  }
  return $t("kpiReviewTitle");
});

const reviewStatusText = computed(() => {
  const statusMap = {
    PENDING_REVIEW: $t("pendingReview"),
    MANAGER_REVIEWED: $t("managerReviewedStatus", "Manager Reviewed"), 
    EMPLOYEE_FEEDBACK_PENDING: $t("employeeFeedbackPendingStatus", "Awaiting Employee Feedback"), 
    EMPLOYEE_RESPONDED: $t("employeeRespondedStatus", "Employee Responded"), 
    COMPLETED: $t("completedStatus", "Completed"), 
  };
  return statusMap[overallReview.value.status] || $t("unknownStatus", "Không xác định");
});
const reviewStatusColor = computed(() => {
  if (overallReview.value.status === "MANAGER_REVIEWED") return "blue";
  if (overallReview.value.status === "COMPLETED") return "green";
  return "default";
});

const getSelectedTargetName = () => {
  if (!selectedTarget.value) return "";
  const [type, idStr] = selectedTarget.value.split("-");
  const id = parseInt(idStr, 10);
  const target = reviewTargets.value.find(
    (t) => t.id === id && t.type === type
  );
  return target ? target.name : "";
};

const getSelectedCycleName = () => {
  const cycle = reviewCycles.value.find((c) => c.id === selectedCycle.value);
  return cycle ? cycle.name : "";
};

const filterOption = (input, option) => {
  const optionText =
    option.children && option.children[0] && option.children[0].children
      ? option.children[0].children
      : option.label || "";
  return optionText.toLowerCase().includes(input.toLowerCase());
};

const fetchReviewTargets = async () => {
  try {
    await store.dispatch("kpiEvaluations/fetchReviewableTargets");
  } catch (error) {
    console.error("Component error fetching review targets:", error);
  }
};

const fetchReviewCycles = async () => {
  try {
    await store.dispatch("kpiEvaluations/fetchReviewCycles");
  } catch (error) {
    console.error("Component error fetching review cycles:", error);
  }
};

const handleTargetChange = () => {
  console.log(
    "[KpiReview.vue] handleTargetChange called. Selected Target:",
    selectedTarget.value,
    "Selected Cycle:",
    selectedCycle.value
  );
  if (selectedTarget.value && selectedCycle.value) {
    console.log(
      "[KpiReview.vue] handleTargetChange: Both target and cycle selected, calling component fetchKpisForReview."
    );
    fetchKpisForReview();
  } else {
    console.log(
      "[KpiReview.vue] handleTargetChange: Conditions not met to call component fetchKpisForReview."
    );
  }
};

const fetchKpisForReview = async () => {
  if (!selectedTarget.value || !selectedCycle.value) {
    console.log(
      "[KpiReview.vue] Component fetchKpisForReview: Called, but selectedTarget or selectedCycle is missing.",
      {
        target: selectedTarget.value,
        cycle: selectedCycle.value,
      }
    );
    store.commit("kpiEvaluations/SET_KPIS_TO_REVIEW", []);
    store.commit("kpiEvaluations/SET_EXISTING_OVERALL_REVIEW", null);
    overallReview.value.managerComment = "";
    return;
  }
  try {
    if (!selectedTarget.value) {
      console.error(
        "[KpiReview.vue] Component fetchKpisForReview: selectedTarget.value is null or undefined."
      );
      store.commit("kpiEvaluations/SET_KPIS_TO_REVIEW", []);
      store.commit("kpiEvaluations/SET_EXISTING_OVERALL_REVIEW", null);
      return;
    }
    const [targetType, targetIdStr] = selectedTarget.value.split("-");
    const targetId = parseInt(targetIdStr, 10);
    if (!targetType || isNaN(targetId)) {
      notification.error({
        message: "Lỗi",
        description: "Không tìm thấy thông tin đối tượng được chọn.",
      });
      console.error(
        "[KpiReview.vue] Component fetchKpisForReview: Target object not found in reviewTargets.value."
      );

      store.commit("kpiEvaluations/SET_KPIS_TO_REVIEW", []);
      store.commit("kpiEvaluations/SET_EXISTING_OVERALL_REVIEW", null);
      return;
    }
    console.log(
      "[KpiReview.vue] Component fetchKpisForReview: Dispatching Vuex action kpiEvaluations/fetchKpisForReview with params:",
      {
        targetId: targetId,
        targetType: targetType,
        cycleId: selectedCycle.value,
      }
    );
    await store.dispatch("kpiEvaluations/fetchKpisForReview", {
      targetId: targetId,
      targetType: targetType,
      cycleId: selectedCycle.value,
    });
  } catch (error) {
    console.error("Component error fetching KPIs for review:", error);
  }
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

const getCompletionStatus = (rate) => {
  if (rate >= 100) return "success";
  if (rate >= 70) return "normal";
  return "exception";
};

const submitReviewData = async () => {
  try {
    console.log("[KpiReview.vue] submitReviewData called.");
    console.log("[KpiReview.vue] selectedTarget.value:", selectedTarget.value);
    console.log(
      "[KpiReview.vue] reviewTargets.value:",
      JSON.parse(JSON.stringify(reviewTargets.value))
    );
    console.log("[KpiReview.vue] selectedCycle.value:", selectedCycle.value);

    if (!selectedTarget.value) {
      notification.error({
        message: "Lỗi",
        description: "Vui lòng chọn đối tượng review hợp lệ.",
      });
      return;
    }

    const [targetType, targetIdStr] = selectedTarget.value.split("-");
    const targetId = parseInt(targetIdStr, 10);

    const reviewData = {
      targetId: targetId,
      targetType: targetType,
      cycleId: selectedCycle.value,
      overallComment: overallReview.value.managerComment,
      overallScore: overallReview.value.managerScore,
      kpiReviews: kpisToReview.value.map((kpi) => ({
        assignmentId: kpi.assignmentId,
        managerComment: kpi.managerComment,
        managerScore: kpi.managerScore,
      })),
    };
    console.log("Submitting review data:", reviewData);
    await store.dispatch("kpiEvaluations/submitKpiReview", reviewData);
    notification.success({ message: "Lưu đánh giá thành công!" });
  } catch (err) {
    const error = err || submitError.value;
    notification.error({
      message: "Lỗi lưu đánh giá",
      description: error.message,
    });
  }
};

const handleSaveButtonClick = () => {
  console.log("[KpiReview.vue] 'Lưu Đánh giá' button was clicked directly.");

  submitReviewData();
};
const onFinishFailed = (errorInfo) => {
  console.log("[KpiReview.vue] Form validation failed:", errorInfo);
  notification.error({
    message: "Validation Failed",
    description: "Please check the form fields for errors.",
  });
};

const handleCompleteReview = async () => {
  if (!selectedTarget.value || !selectedCycle.value) {
    notification.error({
      message: "Lỗi",
      description: "Vui lòng chọn đối tượng và chu kỳ review.",
    });
    return;
  }
  const [targetType, targetIdStr] = selectedTarget.value.split("-");
  const targetId = parseInt(targetIdStr, 10);
  if (!targetType || isNaN(targetId)) {
    notification.error({
      message: "Lỗi",
      description: "Không tìm thấy thông tin đối tượng được chọn.",
    });
    return;
  }

  try {
    const completeReviewDto = {
      targetId: targetId,
      targetType: targetType,
      cycleId: selectedCycle.value,
    };
    await store.dispatch("kpiEvaluations/completeKpiReview", completeReviewDto);
    notification.success({ message: "Review đã được hoàn tất thành công!" });
  } catch (error) {
    const errorMsg =
      error.response?.data?.message ||
      error.message ||
      "Không thể hoàn tất review.";
    notification.error({
      message: "Lỗi hoàn tất review",
      description: errorMsg,
    });
  }
};

const viewTargetReviewHistory = () => {
  if (!selectedTarget.value) {
    notification.warn({
      message: "Vui lòng chọn một đối tượng để xem lịch sử.",
    });
    return;
  }
  const [targetType, targetIdStr] = selectedTarget.value.split("-");
  const targetId = parseInt(targetIdStr, 10);

  if (targetType && !isNaN(targetId)) {
    router.push({
      name: "ReviewHistory", 
      params: { targetType: targetType, targetId: targetId },
    });
  } else {
    notification.error({
      message: "Lỗi",
      description:
        "Không tìm thấy thông tin đối tượng được chọn để xem lịch sử.",
    });
  }
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  return dayjs(dateString).format("DD/MM/YYYY HH:mm");
};

onMounted(() => {
  fetchReviewTargets();
  fetchReviewCycles();
});
</script>

<style scoped>
.kpi-review-page {
  padding: 24px;
}

.kpi-review-item {
  margin-bottom: 24px;
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background-color: #fafafa;
}

.kpi-review-item h3 {
  margin-bottom: 12px;
  font-size: 1.1em;
}

.empty-state {
  text-align: center;
  padding: 40px 0;
}
</style>
