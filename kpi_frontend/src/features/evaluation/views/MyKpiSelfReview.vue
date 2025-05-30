<template>
  <div class="my-kpi-self-review">
    <h2>{{ $t("personalKpiReview") }}</h2>
    <a-alert v-if="successMessage" type="success" :message="successMessage" show-icon closable
      @close="successMessage = ''" />
    <a-alert v-if="errorMessage" type="error" :message="errorMessage" show-icon closable @close="errorMessage = ''" />
    <div class="filters">
      <a-select v-model="selectedCycle" :options="cycleOptions" placeholder="{{ $t('selectCycle') }}"
        style="width: 200px; margin-right: 16px" @change="onCycleChange" />
    </div>
    <a-table :columns="columns" :data-source="kpis" row-key="id" bordered class="kpi-table" style="
        margin-top: 32px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 2px 8px #f0f1f2;
      " :loading="loading" :pagination="false">
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'selfScore'">
          <a-rate
            :value="record.selfScore"
            :count="5"
            allow-half
            :disabled="loading || !EDITABLE_STATUSES.includes(record.status)"
            @change="(value) => updateKpi(index, 'selfScore', value)"
            style="font-size: 20px"
          />
        </template>
        <template v-else-if="column.key === 'selfComment'">
          <a-textarea
            :value="record.selfComment"
            rows="2"
            :placeholder="$t('selfComment')"
            :disabled="loading || !EDITABLE_STATUSES.includes(record.status)"
            @input="(event) => updateKpi(index, 'selfComment', event.target.value)"
            style="
              background: #f9fafb;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
              font-size: 15px;
            "
          />
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="getStatusColor(record.status, record)"
            style="font-size: 14px; padding: 2px 12px; border-radius: 8px">
            {{ getStatusText(record.status, record) }}
            <span v-if="record.status === 'REJECTED'" style="color:#ff4d4f; font-weight:600; margin-left:6px">({{
              $t('rejected') }})</span>
          </a-tag>
        </template>
        <template v-else-if="column.key === 'actions'">
          <div v-if="record.status === 'EMPLOYEE_FEEDBACK'">
            <a-button type="primary" size="small" @click="openFeedbackModal(record, index)"
              style="border-radius: 6px">{{ $t("viewAndFeedback") }}</a-button>
          </div>
          <div v-else-if="record.status === 'MANAGER_REVIEWED'">
            <span style="color: #faad14; font-weight: 500">{{
              $t("waitingManagerConfirm")
              }}</span>
          </div>
          <div v-else-if="record.status === 'COMPLETED'">
            <span style="color: #52c41a; font-weight: 500">{{
              $t("completed")
              }}</span>
            <a-button type="link" size="small" @click="openDetailModal(record)"
              style="margin-left: 8px; color: #1890ff">{{ $t("viewDetails") }}</a-button>
          </div>
        </template>
      </template>
    </a-table>
    <a-button type="primary" @click="submitSelfReview" :loading="loading" style="margin-top: 24px"
      :disabled="!canSubmit || loading" v-if="kpis.some((k) => EDITABLE_STATUSES.includes(k.status))">
      {{ $t("submitReview") }}
    </a-button>
    <a-modal v-model:open="feedbackModal.visible" :title="$t('kpiFeedbackTitle')" :footer="null" width="540px"
      @cancel="closeFeedbackModal" destroyOnClose>
      <div v-if="feedbackModal.record" class="feedback-modal-content-v2">
        <div class="feedback-kpi-title">
          <span>{{ feedbackModal.record.kpi?.name }}</span>
        </div>
        <div class="feedback-timeline">
          <div v-if="feedbackModal.record.sectionScore !== undefined" class="feedback-step section">
            <div class="step-icon section">
              <TeamOutlined style="color:#13c2c2;font-size:22px;" />
            </div>
            <div class="step-content">
              <div class="step-title" style="color:#13c2c2">{{ $t("sectionReview") }}</div>
              <div class="step-score">
                <a-rate :value="feedbackModal.record.sectionScore" :count="5" allow-half disabled />
              </div>
              <div class="step-comment">
                <span>{{ feedbackModal.record.sectionComment || $t("noComment") }}</span>
              </div>
            </div>
          </div>
          <div v-if="feedbackModal.record.departmentScore !== undefined" class="feedback-step department">
            <div class="step-icon department">
              <ApartmentOutlined style="color:#1890ff;font-size:22px;" />
            </div>
            <div class="step-content">
              <div class="step-title" style="color:#1890ff">{{ $t("departmentReview") }}</div>
              <div class="step-score">
                <a-rate :value="feedbackModal.record.departmentScore" :count="5" allow-half disabled />
              </div>
              <div class="step-comment">
                <span>{{ feedbackModal.record.departmentComment || $t("noComment") }}</span>
              </div>
            </div>
          </div>
          <div v-if="feedbackModal.record.managerScore !== undefined" class="feedback-step manager">
            <div class="step-icon manager">
              <SolutionOutlined style="color:#722ed1;font-size:22px;" />
            </div>
            <div class="step-content">
              <div class="step-title" style="color:#722ed1">{{ $t("managerReview") }}</div>
              <div class="step-score">
                <a-rate :value="feedbackModal.record.managerScore" :count="5" allow-half disabled />
              </div>
              <div class="step-comment">
                <span>{{ feedbackModal.record.managerComment || $t("noComment") }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="feedback-group-v2">
          <div class="feedback-label">{{ $t("yourFeedback") }}</div>
          <a-textarea v-model:value="feedbackModal.feedbackInput" rows="3" :placeholder="$t('feedbackPlaceholder')"
            style="margin-top: 8px" />
        </div>
        <div style="margin-top: 22px; text-align: right">
          <a-button type="primary" size="large"
            style="border-radius: 24px; min-width: 180px; font-weight:600; background: linear-gradient(90deg,#1890ff 0%,#40a9ff 100%); box-shadow:0 2px 8px #1890ff33; border:none;"
            :loading="feedbackModal.loading" @click="submitEmployeeFeedbackModal">{{ $t("submitFeedback") }}</a-button>
        </div>
      </div>
    </a-modal>
    <a-modal v-model:open="detailModal.visible" :title="$t('kpiReviewDetailTitle')" :footer="null" width="540px"
      @cancel="closeDetailModal" destroyOnClose class="kpi-detail-modal">
      <div v-if="detailModal.record" class="kpi-detail-content-v2">
        <div class="kpi-detail-title-v2">{{ detailModal.record.kpi?.name }}</div>
        <div class="kpi-detail-grid-v2">
          <div class="kpi-detail-card">
            <div class="kpi-detail-label-v2">
              <TeamOutlined style="color:#13c2c2;font-size:18px;margin-right:6px;" />{{ $t('selfScore') }}
            </div>
            <a-rate :value="detailModal.record.selfScore" :count="5" allow-half disabled />
          </div>
          <div class="kpi-detail-card">
            <div class="kpi-detail-label-v2">{{ $t('selfComment') }}</div>
            <div class="kpi-detail-value-v2">{{ detailModal.record.selfComment || $t('noComment') }}</div>
          </div>
          <template v-if="detailModal.record.sectionScore !== undefined">
            <div class="kpi-detail-card">
              <div class="kpi-detail-label-v2">
                <TeamOutlined style="color:#13c2c2;font-size:18px;margin-right:6px;" />{{ $t('sectionScore') }}
              </div>
              <a-rate :value="detailModal.record.sectionScore" :count="5" allow-half disabled />
            </div>
            <div class="kpi-detail-card">
              <div class="kpi-detail-label-v2">{{ $t('sectionComment') }}</div>
              <div class="kpi-detail-value-v2">{{ detailModal.record.sectionComment || $t('noComment') }}</div>
            </div>
          </template>
          <template v-if="detailModal.record.departmentScore !== undefined">
            <div class="kpi-detail-card">
              <div class="kpi-detail-label-v2">
                <ApartmentOutlined style="color:#1890ff;font-size:18px;margin-right:6px;" />{{ $t('departmentScore') }}
              </div>
              <a-rate :value="detailModal.record.departmentScore" :count="5" allow-half disabled />
            </div>
            <div class="kpi-detail-card">
              <div class="kpi-detail-label-v2">{{ $t('departmentComment') }}</div>
              <div class="kpi-detail-value-v2">{{ detailModal.record.departmentComment || $t('noComment') }}</div>
            </div>
          </template>
          <template v-if="detailModal.record.managerScore !== undefined">
            <div class="kpi-detail-card">
              <div class="kpi-detail-label-v2">
                <SolutionOutlined style="color:#722ed1;font-size:18px;margin-right:6px;" />{{ $t('managerScore') }}
              </div>
              <a-rate :value="detailModal.record.managerScore" :count="5" allow-half disabled />
            </div>
            <div class="kpi-detail-card">
              <div class="kpi-detail-label-v2">{{ $t('managerComment') }}</div>
              <div class="kpi-detail-value-v2">{{ detailModal.record.managerComment || $t('noComment') }}</div>
            </div>
          </template>
          <template v-if="detailModal.record.employeeFeedback">
            <div class="kpi-detail-card kpi-detail-card-full">
              <div class="kpi-detail-label-v2" style="color:#faad14">
                <SolutionOutlined style="color:#faad14;font-size:18px;margin-right:6px;" />{{ $t('yourFeedback') }}
              </div>
              <div class="kpi-detail-value-v2">{{ detailModal.record.employeeFeedback }}</div>
            </div>
          </template>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import {
  submitMyKpiSelfReview,
  getReviewCycles,
  submitEmployeeFeedback,
} from "@/core/services/kpiReviewApi";
import { TeamOutlined, ApartmentOutlined, SolutionOutlined } from '@ant-design/icons-vue';

const store = useStore();
const { t } = useI18n();
const selectedCycle = ref();
const cycleOptions = ref([]);
const successMessage = ref("");
const errorMessage = ref("");

const kpis = ref([]); // Sử dụng ref thay vì computed để có thể gán dữ liệu sau khi fetch
const loading = ref(false);

const columns = computed(() => [
  { title: t("kpiName"), dataIndex: ["kpi", "name"], key: "kpiName" },
  { title: t("target"), dataIndex: "targetValue", key: "targetValue" },
  { title: t("actualResult"), dataIndex: "actualValue", key: "actualValue" },
  { title: t("selfScore"), key: "selfScore" },
  { title: t("selfComment"), key: "selfComment" },
  { title: t("status"), key: "status" },
  { title: "", key: "actions" },
]);

const getStatusText = (status) => {
  switch (status) {
    case "PENDING":
      return t("notSubmitted");
    case "SELF_REVIEWED":
      return t("selfReviewed");
    case "SECTION_REVIEWED":
      return t("sectionReviewed");
    case "DEPARTMENT_REVIEWED":
      return t("departmentReviewed");
    case "EMPLOYEE_FEEDBACK":
      return t("awaitingEmployeeFeedback");
    case "MANAGER_REVIEWED":
      return t("waitingManagerConfirm");
    case "COMPLETED":
      return t("completed");
    default:
      return status || t("notSubmitted");
  }
};

const getStatusColor = (status, record) => {
  if (
    (!status || status === "PENDING") &&
    record.selfScore !== null &&
    record.selfScore !== undefined
  ) {
    return "blue";
  }
  if (status === "MANAGER_REVIEWED") return "blue";
  if (status === "COMPLETED") return "green";
  return "default";
};

// Khai báo các status cho phép chỉnh sửa self review 1 lần duy nhất
const EDITABLE_STATUSES = [
  'PENDING',
  'SECTION_REJECTED',
  'DEPARTMENT_REJECTED',
  'MANAGER_REJECTED'
];

// Update `canSubmit` to check if all KPIs have valid selfScore and selfComment
const canSubmit = computed(() => {
  const editableKpis = kpis.value.filter(kpi => EDITABLE_STATUSES.includes(kpi.status));
  if (!editableKpis.length) return false;
  return editableKpis.every(
    (kpi) =>
      kpi.selfScore !== null &&
      kpi.selfScore !== undefined &&
      kpi.selfComment &&
      typeof kpi.selfComment === "string" &&
      kpi.selfComment.trim().length > 0
  );
});

const fetchMyKpis = async () => {
  if (!selectedCycle.value) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    await store.dispatch("myKpiReviews/fetchMyKpiReviews", selectedCycle.value);
    kpis.value = store.getters["myKpiReviews/myKpiReviews"] || [];
    if (kpis.value.length === 0) {
      errorMessage.value =
        "Không có KPI nào đã được duyệt và có kết quả thực tế để tự đánh giá.";
    }
  } catch (e) {
    errorMessage.value = "Không tải được danh sách KPI.";
  } finally {
    loading.value = false;
  }
};

const fetchCycles = async () => {
  const res = await getReviewCycles();
  cycleOptions.value = res.map((c) => ({ label: c.name, value: c.id }));
};

const submitSelfReview = async () => {
  loading.value = true;
  try {
    await submitMyKpiSelfReview({
      cycle: selectedCycle.value,
      kpis: kpis.value.map((item) => ({
        id: item.id,
        selfScore: item.selfScore,
        selfComment: item.selfComment,
      })),
    });
    successMessage.value = "Gửi đánh giá thành công!";
    fetchMyKpis();
  } catch (e) {
    errorMessage.value = "Gửi đánh giá thất bại.";
  } finally {
    loading.value = false;
  }
};

const feedbackModal = ref({
  visible: false,
  record: null,
  feedbackInput: "",
  loading: false,
  index: null,
});

const detailModal = ref({
  visible: false,
  record: null,
});

const openFeedbackModal = (record, index) => {
  feedbackModal.value.visible = true;
  feedbackModal.value.record = record;
  feedbackModal.value.feedbackInput = record.employeeFeedbackInput || "";
  feedbackModal.value.loading = false;
  feedbackModal.value.index = index;
};

const closeFeedbackModal = () => {
  feedbackModal.value.visible = false;
  feedbackModal.value.record = null;
  feedbackModal.value.feedbackInput = "";
  feedbackModal.value.loading = false;
  feedbackModal.value.index = null;
};

const openDetailModal = (record) => {
  detailModal.value.visible = true;
  detailModal.value.record = record;
};

const closeDetailModal = () => {
  detailModal.value.visible = false;
  detailModal.value.record = null;
};

const submitEmployeeFeedbackModal = async () => {
  const record = feedbackModal.value.record;
  if (
    !feedbackModal.value.feedbackInput ||
    !feedbackModal.value.feedbackInput.trim()
  ) {
    errorMessage.value = "Vui lòng nhập phản hồi trước khi gửi.";
    return;
  }
  feedbackModal.value.loading = true;
  try {
    await submitEmployeeFeedback(record.id, feedbackModal.value.feedbackInput);
    successMessage.value = "Gửi phản hồi thành công!";
    closeFeedbackModal();
    fetchMyKpis();
  } catch (e) {
    errorMessage.value = "Gửi phản hồi thất bại.";
  } finally {
    feedbackModal.value.loading = false;
  }
};

const onCycleChange = (val) => {
  selectedCycle.value = val;
  fetchMyKpis();
};

// Consolidate the `updateKpi` function to ensure reactivity
const updateKpi = (index, key, value) => {
  kpis.value[index] = {
    ...kpis.value[index],
    [key]: value,
  };
  kpis.value = [...kpis.value]; // Trigger reactivity
};

// Add a watch to monitor changes in kpis and log updates
watch(
  kpis,
  (newKpis) => {
    // Ensure feedback input and loading state are initialized for feedback step
    newKpis.forEach((k) => {
      if (k.status === "EMPLOYEE_FEEDBACK") {
        if (k.employeeFeedbackInput === undefined) k.employeeFeedbackInput = "";
        if (k.feedbackLoading === undefined) k.feedbackLoading = false;
      }
    });
    console.log("kpis updated:", newKpis);
    console.log("Re-evaluating canSubmit:", canSubmit.value);
  },
  { deep: true }
);

// Add a reactive variable to manage button status
const buttonStatus = ref("disabled");

// Watch dependencies to update buttonStatus
watch(
  [canSubmit, loading, successMessage],
  ([newCanSubmit, newLoading, newSuccessMessage]) => {
    if (newLoading) {
      buttonStatus.value = "loading";
    } else if (newSuccessMessage) {
      buttonStatus.value = "disabled";
    } else if (newCanSubmit) {
      buttonStatus.value = "enabled";
    } else {
      buttonStatus.value = "disabled";
    }
  }
);

onMounted(() => {
  fetchCycles();
});
</script>

<style scoped>
.my-kpi-self-review {
  padding: 32px 0 0 0;
  background: #f5f6fa;
  min-height: 100vh;
}
.filters {
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  background: #fff;
  padding: 24px 32px 16px 32px;
  border-radius: 12px;
  box-shadow: 0 2px 8px #f0f1f2;
}
.kpi-table {
  font-size: 15px;
  border-radius: 12px;
  background: #fff;
}
.kpi-table th {
  background: #f0f2f5 !important;
  font-weight: 600;
  font-size: 15px;
  color: #222;
  border-radius: 0;
}
.kpi-table td {
  background: #fff;
  border-bottom: 1px solid #f0f1f2;
  vertical-align: middle;
}
.kpi-table .ant-rate {
  color: #faad14;
}
.kpi-table .ant-btn-link {
  color: #1890ff;
  font-weight: 500;
}
.kpi-table .ant-btn-primary {
  background: linear-gradient(90deg, #1890ff 0%, #40a9ff 100%);
  border: none;
}
.kpi-detail-modal .ant-modal-content {
  border-radius: 16px;
  padding: 36px 36px 28px 36px;
  background: #fff;
  box-shadow: 0 8px 32px rgba(24, 144, 255, 0.08);
}
.kpi-detail-content-v2 {
  padding: 8px 2px 0 2px;
}
.kpi-detail-title-v2 {
  font-size: 22px;
  font-weight: 700;
  color: #1890ff;
  text-align: center;
  margin-bottom: 18px;
  letter-spacing: 0.5px;
}
.kpi-detail-grid-v2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 18px;
}
.kpi-detail-card {
  background: #f7faff;
  border-radius: 12px;
  box-shadow: 0 2px 8px #e6f7ff33;
  padding: 14px 18px 12px 18px;
  min-height: 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.kpi-detail-card-full {
  grid-column: span 2;
  background: linear-gradient(90deg,#fffbe6 60%,#fff1b8 100%);
  box-shadow: 0 2px 8px #ffe58f44;
}
.kpi-detail-label-v2 {
  font-size: 15px;
  font-weight: 700;
  color: #1890ff;
  margin-bottom: 4px;
}
.kpi-detail-value-v2 {
  color: #222;
  font-size: 15px;
  word-break: break-word;
}
@media (max-width: 700px) {
  .kpi-detail-content-v2 { padding: 4px 0 0 0; }
  .kpi-detail-title-v2 { font-size: 16px; }
  .kpi-detail-grid-v2 { grid-template-columns: 1fr; gap: 10px; }
  .kpi-detail-card, .kpi-detail-card-full { padding: 8px 6px 6px 6px; }
}
.feedback-modal-content {
  padding: 8px 2px 0 2px;
}
.feedback-modal-content-v2 {
  padding: 12px 8px 0 8px;
}
.feedback-kpi-title {
  font-size: 20px;
  font-weight: 700;
  color: #1890ff;
  text-align: center;
  margin-bottom: 18px;
  letter-spacing: 0.5px;
}
.feedback-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.feedback-step {
  display: flex;
  align-items: flex-start;
  background: #f7faff;
  border-radius: 12px;
  box-shadow: 0 2px 8px #e6f7ff33;
  padding: 14px 20px 12px 14px;
  border-left: 6px solid;
  margin-bottom: 2px;
  transition: background 0.2s, box-shadow 0.2s;
}
.feedback-step.section { border-image: linear-gradient(180deg,#13c2c2,#36e2e2) 1; }
.feedback-step.department { border-image: linear-gradient(180deg,#1890ff,#40a9ff) 1; }
.feedback-step.manager { border-image: linear-gradient(180deg,#722ed1,#b37feb) 1; }
.feedback-step:hover { background: linear-gradient(90deg,#e6f7ff 60%,#f0f5ff 100%); box-shadow: 0 4px 16px #1890ff22; }
.step-icon {
  font-size: 26px;
  margin-right: 16px;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px #e6f7ff44;
}
.step-icon.section { background: #e6fffb; }
.step-icon.department { background: #e6f7ff; }
.step-icon.manager { background: #f9f0ff; }
.step-title {
  font-weight: 700;
  margin-bottom: 2px;
  font-size: 16px;
}
.step-score { margin-bottom: 2px; }
.step-comment {
  color: #555;
  font-size: 14px;
  margin-bottom: 2px;
}
.feedback-group-v2 {
  margin-top: 20px;
  background: linear-gradient(90deg,#fffbe6 60%,#fff1b8 100%);
  border-radius: 10px;
  padding: 14px 18px 12px 18px;
  box-shadow: 0 2px 8px #ffe58f44;
}
.feedback-label {
  font-weight: 700;
  color: #faad14;
  margin-bottom: 6px;
  font-size: 15px;
}
@media (max-width: 700px) {
  .kpi-detail-modal .ant-modal-content {
    padding: 16px 6px 12px 6px;
  }
  .kpi-detail-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .feedback-modal-content-v2 { padding: 4px 0 0 0; }
  .feedback-kpi-title { font-size: 16px; }
  .feedback-timeline { gap: 8px; }
  .feedback-step { padding: 8px 6px 6px 6px; }
  .feedback-group-v2 { padding: 8px 6px 6px 6px; }
}
</style>
