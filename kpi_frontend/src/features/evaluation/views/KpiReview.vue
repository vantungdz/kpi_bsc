<template>
  <div>
    <div v-if="canViewKpiReview" class="kpi-review-page">
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
                        {{ Number(kpiItem.targetValue).toLocaleString() }}
                        {{ kpiItem.unit }}
                      </a-descriptions-item>
                    </a-descriptions>
                  </a-col>
                  <a-col :span="8">
                    <a-descriptions size="small" bordered :column="1">
                      <a-descriptions-item :label="$t('actualResult')">
                        {{ Number(kpiItem.actualValue).toLocaleString() }}
                        {{ kpiItem.unit }}
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
                  <a-col :span="8">
                    <a-descriptions size="small" bordered :column="1">
                      <a-descriptions-item :label="$t('weight')">
                        {{ kpiItem.weight }}
                      </a-descriptions-item>
                      <a-descriptions-item :label="$t('weightedScoreSupervisor')">
                        {{ getWeightedScore(kpiItem) }}
                      </a-descriptions-item>
                    </a-descriptions>
                  </a-col>
                </a-row>

                <!-- Nếu là nhân viên: nhập selfComment/selfScore -->
                <template v-if="currentUser.role === 'employee'">
                  <a-form-item
                    :label="`${$t('selfCommentForKpi')} ${kpiItem.kpiName}`"
                    :name="['kpiItem', index, 'selfComment']"
                    style="margin-top: 10px"
                  >
                    <a-textarea
                      v-model:value="kpiItem.selfComment"
                      :placeholder="$t('selfCommentPlaceholder')"
                      :rows="3"
                      :disabled="
                        isLoadingKpis || overallReview.status !== 'DRAFT'
                      "
                    />
                  </a-form-item>
                  <a-form-item
                    :label="`${$t('selfScoreForKpi')} ${kpiItem.kpiName}`"
                    :name="['kpiItem', index, 'selfScore']"
                  >
                    <a-rate
                      v-model:value="kpiItem.selfScore"
                      :disabled="
                        isLoadingKpis || overallReview.status !== 'DRAFT'
                      "
                    />
                  </a-form-item>
                </template>

                <!-- Nếu là quản lý: chỉ xem self, nhập manager -->
                <template v-else>
                  <a-form-item
                    :label="`${$t('selfCommentForKpi')} ${kpiItem.kpiName}`"
                    :name="['kpiItem', index, 'selfComment']"
                    style="margin-top: 10px"
                  >
                    <a-textarea
                      v-model:value="kpiItem.selfComment"
                      :rows="3"
                      disabled
                    />
                  </a-form-item>
                  <a-form-item
                    :label="`${$t('selfScoreForKpi')} ${kpiItem.kpiName}`"
                    :name="['kpiItem', index, 'selfScore']"
                  >
                    <a-rate v-model:value="kpiItem.selfScore" disabled />
                  </a-form-item>
                  <a-form-item
                    :label="`${$t('managerCommentForKpi')} ${kpiItem.kpiName}`"
                    :name="['kpiItem', index, 'managerComment']"
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
                </template>
              </div>

              <a-divider />
              <div style="text-align: right; margin-bottom: 16px">
                <strong>{{ $t("totalWeightedScoreSupervisor") }}:</strong>
                <span style="font-size: 1.2em; color: #1890ff">{{
                  totalWeightedScoreSupervisor
                }}</span>
              </div>
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
                  :disabled="
                    isLoadingKpis || overallReview.status === 'COMPLETED'
                  "
                />
              </a-form-item>
              <a-form-item>
                <a-button
                  type="primary"
                  html-type="button"
                  @click="handleSaveButtonClick"
                  :loading="isSubmitting"
                  :disabled="isLoadingKpis || !canEditManagerReview"
                >
                  {{ $t("saveReview") }}
                </a-button>
                <a-button
                  v-if="
                    (overallReview.status === 'MANAGER_REVIEWED' ||
                      overallReview.status === 'EMPLOYEE_FEEDBACK_PENDING' ||
                      overallReview.status === 'EMPLOYEE_RESPONDED') &&
                    (currentUser.role === 'manager' ||
                      currentUser.role === 'admin')
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

            <!-- Multi-level review action buttons -->
            <div v-if="overallReview.status && overallReviewId">
              <a-divider />
              <div style="margin-bottom: 16px">
                <template
                  v-if="
                    overallReview.status === 'SECTION_REVIEW_PENDING' &&
                    (currentUser.role === 'section' ||
                      currentUser.role === 'admin' ||
                      currentUser.role === 'manager')
                  "
                >
                  <a-button
                    type="primary"
                    :loading="isProcessingOverallReview"
                    @click="approveSectionReview(overallReviewId)"
                  >
                    {{ $t("approveSection") }}
                  </a-button>
                  <a-button
                    danger
                    :loading="isProcessingOverallReview"
                    @click="showRejectSectionModal = true"
                    style="margin-left: 8px"
                  >
                    {{ $t("rejectSection") }}
                  </a-button>
                </template>
                <template
                  v-if="
                    overallReview.status === 'DEPARTMENT_REVIEW_PENDING' &&
                    (currentUser.role === 'department' ||
                      currentUser.role === 'admin' ||
                      currentUser.role === 'manager')
                  "
                >
                  <a-button
                    type="primary"
                    :loading="isProcessingOverallReview"
                    @click="approveDeptReview(overallReviewId)"
                  >
                    {{ $t("approveDept") }}
                  </a-button>
                  <a-button
                    danger
                    :loading="isProcessingOverallReview"
                    @click="showRejectDeptModal = true"
                    style="margin-left: 8px"
                  >
                    {{ $t("rejectDept") }}
                  </a-button>
                </template>
                <template
                  v-if="
                    overallReview.status === 'MANAGER_REVIEW_PENDING' &&
                    (currentUser.role === 'manager' ||
                      currentUser.role === 'admin')
                  "
                >
                  <a-button
                    type="primary"
                    :loading="isProcessingOverallReview"
                    @click="approveManagerReview(overallReviewId)"
                  >
                    {{ $t("approveManager") }}
                  </a-button>
                  <a-button
                    danger
                    :loading="isProcessingOverallReview"
                    @click="showRejectManagerModal = true"
                    style="margin-left: 8px"
                  >
                    {{ $t("rejectManager") }}
                  </a-button>
                </template>
              </div>
            </div>
            <!-- Reject modals for each level -->
            <a-modal
              v-model:visible="showRejectSectionModal"
              :title="$t('rejectSection')"
              @ok="handleRejectSection"
              @cancel="showRejectSectionModal = false"
              :confirmLoading="isProcessingOverallReview"
            >
              <a-textarea
                v-model:value="rejectSectionComment"
                :placeholder="$t('enterRejectReason')"
                rows="4"
              />
            </a-modal>
            <a-modal
              v-model:visible="showRejectDeptModal"
              :title="$t('rejectDept')"
              @ok="handleRejectDept"
              @cancel="showRejectDeptModal = false"
              :confirmLoading="isProcessingOverallReview"
            >
              <a-textarea
                v-model:value="rejectDeptComment"
                :placeholder="$t('enterRejectReason')"
                rows="4"
              />
            </a-modal>
            <a-modal
              v-model:visible="showRejectManagerModal"
              :title="$t('rejectManager')"
              @ok="handleRejectManager"
              @cancel="showRejectManagerModal = false"
              :confirmLoading="isProcessingOverallReview"
            >
              <a-textarea
                v-model:value="rejectManagerComment"
                :placeholder="$t('enterRejectReason')"
                rows="4"
              />
            </a-modal>
          </div>
        </a-spin>
      </a-card>
    </div>
    <div v-else class="no-permission" style="text-align:center; padding: 60px 0;">
      <a-empty :description="$t('noPermission', 'Bạn không có quyền truy cập trang này.')" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import dayjs from "dayjs";
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
  Modal as AModal,
  Textarea as ATextarea,
} from "ant-design-vue";

const { t: $t } = useI18n();

const store = useStore();
const router = useRouter();

const userPermissions = computed(() => store.getters["auth/user"]?.permissions || []);
function hasPermission(action, resource) {
  return userPermissions.value?.some(
    (p) => p.action?.trim() === action && p.resource?.trim() === resource
  );
}
const canViewKpiReview = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW));

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
  // Chuẩn hóa: kiểm tra role entity
  const roleName = user.role?.name;
  if (roleName === "admin") return reviewTargets.value;
  if (roleName === "manager" || roleName === "department") {
    return reviewTargets.value.filter(
      (t) => t.type === "employee" || t.type === "section"
    );
  }
  if (roleName === "section") {
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

const showRejectSectionModal = ref(false);
const showRejectDeptModal = ref(false);
const showRejectManagerModal = ref(false);
const rejectSectionComment = ref("");
const rejectDeptComment = ref("");
const rejectManagerComment = ref("");

const overallReviewId = computed(() =>
  existingOverallReviewFromStore.value &&
  existingOverallReviewFromStore.value.id
    ? existingOverallReviewFromStore.value.id
    : null
);

// Đảm bảo dữ liệu kpisToReview luôn có selfComment/selfScore mặc định
watch(
  kpisFromStore,
  (newKpis) => {
    if (newKpis && Array.isArray(newKpis)) {
      kpisToReview.value = newKpis.map((kpi) => ({
        ...kpi,
        selfComment: kpi.selfComment ?? "",
        selfScore: kpi.selfScore ?? null,
        managerComment: kpi.existingManagerComment || "",
        managerScore:
          kpi.existingManagerScore === undefined
            ? null
            : kpi.existingManagerScore,
      }));
    } else {
      kpisToReview.value = [];
    }
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
      // Gán thêm trường tổng weighted score supervisor nếu có
      overallReview.value.totalWeightedScoreSupervisor =
        newOverallReview.totalWeightedScoreSupervisor ?? null;
    } else {
      overallReview.value.managerComment = "";
      overallReview.value.managerScore = null;
      overallReview.value.status = null;
      overallReview.value.employeeComment = null;
      overallReview.value.employeeFeedbackDate = null;
      overallReview.value.totalWeightedScoreSupervisor = null;
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
    DRAFT: $t("draft", "Chưa đánh giá"),
    PENDING_REVIEW: $t("status_array.PENDING_REVIEW"),
    SECTION_REVIEW_PENDING: $t("status_array.SECTION_REVIEW_PENDING"),
    SECTION_REVIEWED: $t("status_array.SECTION_REVIEWED"),
    SECTION_REVISE_REQUIRED: $t("status_array.SECTION_REVISE_REQUIRED"),
    DEPARTMENT_REVIEW_PENDING: $t("status_array.DEPARTMENT_REVIEW_PENDING"),
    DEPARTMENT_REVIEWED: $t("status_array.DEPARTMENT_REVIEWED"),
    DEPARTMENT_REVISE_REQUIRED: $t("status_array.DEPARTMENT_REVISE_REQUIRED"),
    MANAGER_REVIEW_PENDING: $t("status_array.MANAGER_REVIEW_PENDING"),
    MANAGER_REVIEWED: $t("status_array.MANAGER_REVIEWED"),
    EMPLOYEE_FEEDBACK_PENDING: $t("status_array.EMPLOYEE_FEEDBACK_PENDING"),
    EMPLOYEE_RESPONDED: $t("status_array.EMPLOYEE_RESPONDED"),
    COMPLETED: $t("status_array.COMPLETED"),
  };
  return (
    statusMap[overallReview.value.status] ||
    $t("unknownStatus", "Không xác định")
  );
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
    store.commit("kpiEvaluations/SET_KPIS_TO_REVIEW", []);
    store.commit("kpiEvaluations/SET_EXISTING_OVERALL_REVIEW", null);
    overallReview.value.managerComment = "";
    return;
  }
  try {
    const [targetType, targetIdStr] = selectedTarget.value.split("-");
    const targetId = parseInt(targetIdStr, 10);
    if (!targetType || isNaN(targetId)) {
      notification.error({
        message: "Lỗi",
        description: "Không tìm thấy thông tin đối tượng được chọn.",
      });
      store.commit("kpiEvaluations/SET_KPIS_TO_REVIEW", []);
      store.commit("kpiEvaluations/SET_EXISTING_OVERALL_REVIEW", null);
      return;
    }
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

const getWeightedScore = (kpiItem) => {
  if (!kpiItem.weight || !kpiItem.managerScore) return 0;
  return Math.round(kpiItem.weight * kpiItem.managerScore * 100) / 100;
};

const totalWeightedScoreSupervisor = computed(() => {
  console.log("totalWeightedScoreSupervisor", overallReview.value);
  if (!overallReview.value || !overallReview.value.totalWeightedScoreSupervisor)
    return 0;
  return Number(overallReview.value.totalWeightedScoreSupervisor).toFixed(2);
});

// Đảm bảo submit lấy đúng selfComment/selfScore
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
        selfComment: kpi.selfComment,
        selfScore: kpi.selfScore,
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

// Multi-level review actions for section/department/manager
const isProcessingOverallReview = computed(
  () => store.getters["kpiEvaluations/isProcessingObjectiveEvalApproval"]
);

// Example: Approve/Reject at Section Level
const approveSectionReview = async (reviewId) => {
  try {
    await store.dispatch("kpiEvaluations/approveOverallReviewSection", {
      reviewId
    });
    notification.success({ message: $t("approveSectionSuccess") });
    fetchKpisForReview(); // Refresh data
  } catch (error) {
    notification.error({
      message: $t("approveSectionError"),
      description: error.message
    });
  }
};
const rejectSectionReview = async (reviewId, comment) => {
  try {
    await store.dispatch("kpiEvaluations/rejectOverallReviewSection", {
      reviewId,
      comment
    });
    notification.success({ message: $t("rejectSectionSuccess") });
    fetchKpisForReview();
  } catch (error) {
    notification.error({
      message: $t("rejectSectionError"),
      description: error.message
    });
  }
};
// Tương tự cho approve/reject department, manager
const approveDeptReview = async (reviewId) => {
  try {
    await store.dispatch("kpiEvaluations/approveOverallReviewDept", {
      reviewId
    });
    notification.success({ message: $t("approveDeptSuccess") });
    fetchKpisForReview();
  } catch (error) {
    notification.error({
      message: $t("approveDeptError"),
      description: error.message
    });
  }
};
const rejectDeptReview = async (reviewId, comment) => {
  try {
    await store.dispatch("kpiEvaluations/rejectOverallReviewDept", {
      reviewId,
      comment
    });
    notification.success({ message: $t("rejectDeptSuccess") });
    fetchKpisForReview();
  } catch (error) {
    notification.error({
      message: $t("rejectDeptError"),
      description: error.message
    });
  }
};
const approveManagerReview = async (reviewId) => {
  try {
    await store.dispatch("kpiEvaluations/approveOverallReviewManager", {
      reviewId
    });
    notification.success({ message: $t("approveManagerSuccess") });
    fetchKpisForReview();
  } catch (error) {
    notification.error({
      message: $t("approveManagerError"),
      description: error.message
    });
  }
};
const rejectManagerReview = async (reviewId, comment) => {
  try {
    await store.dispatch("kpiEvaluations/rejectOverallReviewManager", {
      reviewId,
      comment
    });
    notification.success({ message: $t("rejectManagerSuccess") });
    fetchKpisForReview();
  } catch (error) {
    notification.error({
      message: $t("rejectManagerError"),
      description: error.message
    });
  }
};

const handleRejectSection = async () => {
  if (!rejectSectionComment.value.trim()) {
    notification.error({
      message: $t("error"),
      description: $t("enterRejectReason")
    });
    return;
  }
  await rejectSectionReview(overallReviewId.value, rejectSectionComment.value);
  showRejectSectionModal.value = false;
  rejectSectionComment.value = "";
};
const handleRejectDept = async () => {
  if (!rejectDeptComment.value.trim()) {
    notification.error({
      message: $t("error"),
      description: $t("enterRejectReason")
    });
    return;
  }
  await rejectDeptReview(overallReviewId.value, rejectDeptComment.value);
  showRejectDeptModal.value = false;
  rejectDeptComment.value = "";
};
const handleRejectManager = async () => {
  if (!rejectManagerComment.value.trim()) {
    notification.error({
      message: $t("error"),
      description: $t("enterRejectReason")
    });
    return;
  }
  await rejectManagerReview(overallReviewId.value, rejectManagerComment.value);
  showRejectManagerModal.value = false;
  rejectManagerComment.value = "";
};

const canEditManagerReview = computed(() => {
  const status = overallReview.value.status;
  const role = currentUser.value?.role;
  if (!status || !role) return false;
  if (role === "employee") {
    return status === "DRAFT";
  }
  // admin, manager, section, department
  return [
    "DRAFT",
    "PENDING_REVIEW",
    "SECTION_REVIEW_PENDING",
    "DEPARTMENT_REVIEW_PENDING",
    "MANAGER_REVIEW_PENDING",
  ].includes(status);
});

onMounted(() => {
  fetchReviewTargets();
  fetchReviewCycles();

  // Helper để set target/cycle khi có dữ liệu
  const setTargetAndCycle = () => {
    const targets = reviewTargets.value;
    const cycles = reviewCycles.value;
    const { params, query } = router.currentRoute.value;
    // 1. Lấy employeeId/cycleId từ path hoặc query
    const employeeId = params.employeeId || query.targetId;
    const cycleId = params.cycleId || query.cycleId;
    // 2. Xác định targetType (ưu tiên path, nếu không có thì mặc định 'employee')
    let targetType = params.targetType || query.targetType || "employee";
    // 3. Set selectedTarget nếu có employeeId
    if (employeeId && targets && Array.isArray(targets)) {
      let found = targets.find(
        (t) => String(t.id) === String(employeeId) && t.type === targetType
      );
      if (!found)
        found = targets.find((t) => String(t.id) === String(employeeId));
      if (found) {
        selectedTarget.value = `${found.type}-${found.id}`;
      } else {
        // Nếu không tìm thấy, thử mặc định là employee
        selectedTarget.value = `employee-${employeeId}`;
      }
    }
    // 4. Set selectedCycle nếu có cycleId
    if (cycleId && cycles && Array.isArray(cycles)) {
      let foundCycle = cycles.find(
        (c) => String(c.id) === String(cycleId) || c.name === cycleId
      );
      if (foundCycle) {
        selectedCycle.value = foundCycle.id;
      } else {
        selectedCycle.value = cycleId;
      }
    }
    // 5. Nếu đã có đủ, load data
    if (selectedTarget.value && selectedCycle.value) fetchKpisForReview();
  };
  // Nếu targets và cycles đã có thì set luôn, nếu chưa thì watch cả hai
  if (
    reviewTargets.value &&
    reviewTargets.value.length > 0 &&
    reviewCycles.value &&
    reviewCycles.value.length > 0
  ) {
    setTargetAndCycle();
  } else {
    const stop = watch([reviewTargets, reviewCycles], ([val1, val2]) => {
      if (val1 && val1.length > 0 && val2 && val2.length > 0) {
        setTargetAndCycle();
        stop();
      }
    });
  }
  // Watch route thay đổi để tự động cập nhật dropdown
  watch(
    () => router.currentRoute.value.fullPath,
    () => {
      setTargetAndCycle();
    }
  );
});

// Đảm bảo luôn load data khi chọn đủ target và cycle
watch([selectedTarget, selectedCycle], ([target, cycle]) => {
  if (target && cycle) {
    fetchKpisForReview();
  }
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
