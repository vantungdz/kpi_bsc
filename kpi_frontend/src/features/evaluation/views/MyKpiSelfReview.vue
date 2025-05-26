<template>
  <div class="my-kpi-self-review">
    <h2>{{ $t('personalKpiReview') }}</h2>
    <a-alert
      v-if="successMessage"
      type="success"
      :message="successMessage"
      show-icon
      closable
      @close="successMessage = ''"
    />
    <a-alert
      v-if="errorMessage"
      type="error"
      :message="errorMessage"
      show-icon
      closable
      @close="errorMessage = ''"
    />
    <div class="filters">
      <a-select
        v-model="selectedCycle"
        :options="cycleOptions"
        placeholder="{{ $t('selectCycle') }}"
        style="width: 200px; margin-right: 16px"
        @change="onCycleChange"
      />
    </div>
    <a-table
      :columns="columns"
      :data-source="kpis"
      row-key="id"
      bordered
      class="kpi-table"
      style="margin-top: 32px; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px #f0f1f2;"
      :loading="loading"
      :pagination="false"
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'selfScore'">
          <a-rate
            :value="record.selfScore"
            :count="5"
            allow-half
            :disabled="loading || record.status !== 'PENDING'"
            @change="(value) => updateKpi(index, 'selfScore', value)"
            style="font-size: 20px;"
          />
        </template>
        <template v-else-if="column.key === 'selfComment'">
          <a-textarea
            :value="record.selfComment"
            rows="2"
            :placeholder="$t('selfComment')"
            :disabled="loading || record.status !== 'PENDING'"
            @input="(event) => updateKpi(index, 'selfComment', event.target.value)"
            style="background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 15px;"
          />
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="getStatusColor(record.status, record)" style="font-size: 14px; padding: 2px 12px; border-radius: 8px;">{{ getStatusText(record.status, record) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'actions'">
          <div v-if="record.status === 'EMPLOYEE_FEEDBACK'">
            <a-button type="primary" size="small" @click="openFeedbackModal(record, index)" style="border-radius: 6px;">{{$t('viewAndFeedback')}}</a-button>
          </div>
          <div v-else-if="record.status === 'MANAGER_REVIEWED'">
            <span style="color: #faad14; font-weight: 500;">{{$t('waitingManagerConfirm')}}</span>
          </div>
          <div v-else-if="record.status === 'COMPLETED'">
            <span style="color: #52c41a; font-weight: 500;">{{$t('completed')}}</span>
            <a-button type="link" size="small" @click="openDetailModal(record)" style="margin-left: 8px; color: #1890ff;">{{$t('viewDetails')}}</a-button>
          </div>
        </template>
      </template>
    </a-table>
    <a-button
      type="primary"
      @click="submitSelfReview"
      :loading="loading"
      style="margin-top: 24px"
      :disabled="!canSubmit || loading"
      v-if="kpis.some(k => k.status === 'PENDING')"
      >{{ $t('submitReview') }}</a-button
    >
    <a-modal
      v-model:open="feedbackModal.visible"
      :title="$t('kpiFeedbackTitle')"
      :footer="null"
      width="500px"
      @cancel="closeFeedbackModal"
      destroyOnClose
    >
      <div v-if="feedbackModal.record">
        <div style="margin-bottom: 12px">
          <b>{{$t('kpiName')}}:</b> {{ feedbackModal.record.kpi?.name }}
        </div>
        <div v-if="feedbackModal.record.sectionScore !== undefined">
          <b>{{$t('sectionScore')}}:</b> <a-rate :value="feedbackModal.record.sectionScore" :count="5" allow-half disabled />
          <div><b>{{$t('sectionComment')}}:</b> {{ feedbackModal.record.sectionComment || $t('noComment') }}</div>
        </div>
        <div v-if="feedbackModal.record.departmentScore !== undefined">
          <b>{{$t('departmentScore')}}:</b> <a-rate :value="feedbackModal.record.departmentScore" :count="5" allow-half disabled />
          <div><b>{{$t('departmentComment')}}:</b> {{ feedbackModal.record.departmentComment || $t('noComment') }}</div>
        </div>
        <div v-if="feedbackModal.record.managerScore !== undefined">
          <b>{{$t('managerScore')}}:</b> <a-rate :value="feedbackModal.record.managerScore" :count="5" allow-half disabled />
          <div><b>{{$t('managerComment')}}:</b> {{ feedbackModal.record.managerComment || $t('noComment') }}</div>
        </div>
        <div style="margin-top: 16px">
          <b>{{$t('yourFeedback')}}:</b>
          <a-textarea
            v-model:value="feedbackModal.feedbackInput"
            rows="3"
            :placeholder="$t('feedbackPlaceholder')"
            style="margin-top: 8px"
          />
        </div>
        <div style="margin-top: 16px; text-align: right">
          <a-button
            type="primary"
            :loading="feedbackModal.loading"
            @click="submitEmployeeFeedbackModal"
          >{{$t('submitFeedback')}}</a-button>
        </div>
      </div>
    </a-modal>
    <a-modal
      v-model:open="detailModal.visible"
      :title="$t('kpiReviewDetailTitle')"
      :footer="null"
      width="540px"
      @cancel="closeDetailModal"
      destroyOnClose
      class="kpi-detail-modal"
    >
      <div v-if="detailModal.record" class="kpi-detail-content">
        <div class="kpi-detail-header">
          <span class="kpi-detail-title">{{ detailModal.record.kpi?.name }}</span>
        </div>
        <div class="kpi-detail-grid">
          <div class="kpi-detail-item">
            <span class="kpi-detail-label">{{$t('selfScore')}}</span>
            <a-rate :value="detailModal.record.selfScore" :count="5" allow-half disabled style="font-size: 22px; vertical-align: middle;" />
          </div>
          <div class="kpi-detail-item">
            <span class="kpi-detail-label">{{$t('selfComment')}}</span>
            <span class="kpi-detail-value">{{ detailModal.record.selfComment || $t('noComment') }}</span>
          </div>
          <template v-if="detailModal.record.sectionScore !== undefined">
            <div class="kpi-detail-item">
              <span class="kpi-detail-label">{{$t('sectionScore')}}</span>
              <a-rate :value="detailModal.record.sectionScore" :count="5" allow-half disabled style="font-size: 22px; vertical-align: middle;" />
            </div>
            <div class="kpi-detail-item">
              <span class="kpi-detail-label">{{$t('sectionComment')}}</span>
              <span class="kpi-detail-value">{{ detailModal.record.sectionComment || $t('noComment') }}</span>
            </div>
          </template>
          <template v-if="detailModal.record.departmentScore !== undefined">
            <div class="kpi-detail-item">
              <span class="kpi-detail-label">{{$t('departmentScore')}}</span>
              <a-rate :value="detailModal.record.departmentScore" :count="5" allow-half disabled style="font-size: 22px; vertical-align: middle;" />
            </div>
            <div class="kpi-detail-item">
              <span class="kpi-detail-label">{{$t('departmentComment')}}</span>
              <span class="kpi-detail-value">{{ detailModal.record.departmentComment || $t('noComment') }}</span>
            </div>
          </template>
          <template v-if="detailModal.record.managerScore !== undefined">
            <div class="kpi-detail-item">
              <span class="kpi-detail-label">{{$t('managerScore')}}</span>
              <a-rate :value="detailModal.record.managerScore" :count="5" allow-half disabled style="font-size: 22px; vertical-align: middle;" />
            </div>
            <div class="kpi-detail-item">
              <span class="kpi-detail-label">{{$t('managerComment')}}</span>
              <span class="kpi-detail-value">{{ detailModal.record.managerComment || $t('noComment') }}</span>
            </div>
          </template>
          <div v-if="detailModal.record.employeeFeedback" class="kpi-detail-item">
            <span class="kpi-detail-label">{{$t('yourFeedback')}}</span>
            <span class="kpi-detail-value">{{ detailModal.record.employeeFeedback }}</span>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useStore } from "vuex";
import { useI18n } from 'vue-i18n';
import {
  submitMyKpiSelfReview,
  getReviewCycles,
  submitEmployeeFeedback,
} from "@/core/services/kpiReviewApi";

const store = useStore();
const { t } = useI18n();
const selectedCycle = ref();
const cycleOptions = ref([]);
const successMessage = ref("");
const errorMessage = ref("");

const kpis = ref([]); // Sử dụng ref thay vì computed để có thể gán dữ liệu sau khi fetch
const loading = ref(false);

const columns = computed(() => [
  { title: t('kpiName'), dataIndex: ['kpi', 'name'], key: 'kpiName' },
  { title: t('target'), dataIndex: 'targetValue', key: 'targetValue' },
  { title: t('actualResult'), dataIndex: 'actualValue', key: 'actualValue' },
  { title: t('selfScore'), key: 'selfScore' },
  { title: t('selfComment'), key: 'selfComment' },
  { title: t('status'), key: 'status' },
  { title: '', key: 'actions' },
]);

const getStatusText = (status) => {
  switch (status) {
    case 'PENDING':
      return t('notSubmitted');
    case 'SELF_REVIEWED':
      return t('selfReviewed');
    case 'SECTION_REVIEWED':
      return t('sectionReviewed');
    case 'DEPARTMENT_REVIEWED':
      return t('departmentReviewed');
    case 'EMPLOYEE_FEEDBACK':
      return t('awaitingEmployeeFeedback');
    case 'MANAGER_REVIEWED':
      return t('waitingManagerConfirm');
    case 'COMPLETED':
      return t('completed');
    case 'DEPARTMENT_REVIEW_PENDING':
      return t('pendingDeptApproval');
    default:
      return status || t('notSubmitted');
  }
};

const getStatusColor = (status, record) => {
  if (
    (!status || status === "PENDING") &&
    record.selfScore &&
    record.selfScore.trim().length > 0
  ) {
    return "blue";
  }
  if (status === "MANAGER_REVIEWED") return "blue";
  if (status === "COMPLETED") return "green";
  return "default";
};

// Update `canSubmit` to check if all KPIs have valid selfScore and selfComment
const canSubmit = computed(() => {
  if (!kpis.value.length) return false;
  // Chỉ cho phép gửi khi tất cả KPI của bản thân còn ở trạng thái PENDING và đã nhập đủ điểm, comment
  return kpis.value.every(
    (kpi) =>
      kpi.status === 'PENDING' &&
      kpi.selfScore !== null &&
      kpi.selfScore !== undefined &&
      kpi.selfComment &&
      typeof kpi.selfComment === 'string' &&
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
  feedbackInput: '',
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
  feedbackModal.value.feedbackInput = record.employeeFeedbackInput || '';
  feedbackModal.value.loading = false;
  feedbackModal.value.index = index;
};

const closeFeedbackModal = () => {
  feedbackModal.value.visible = false;
  feedbackModal.value.record = null;
  feedbackModal.value.feedbackInput = '';
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
  if (!feedbackModal.value.feedbackInput || !feedbackModal.value.feedbackInput.trim()) {
    errorMessage.value = 'Vui lòng nhập phản hồi trước khi gửi.';
    return;
  }
  feedbackModal.value.loading = true;
  try {
    await submitEmployeeFeedback(record.id, feedbackModal.value.feedbackInput);
    successMessage.value = 'Gửi phản hồi thành công!';
    closeFeedbackModal();
    fetchMyKpis();
  } catch (e) {
    errorMessage.value = 'Gửi phản hồi thất bại.';
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
      if (k.status === 'EMPLOYEE_FEEDBACK') {
        if (k.employeeFeedbackInput === undefined) k.employeeFeedbackInput = '';
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
.kpi-detail-header {
  text-align: center;
  margin-bottom: 18px;
}
.kpi-detail-title {
  font-size: 22px;
  font-weight: 700;
  color: #1890ff;
  letter-spacing: 0.5px;
}
.kpi-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px 32px;
}
.kpi-detail-item {
  display: flex;
  flex-direction: column;
  background: #f7faff;
  border-radius: 10px;
  padding: 14px 18px 10px 18px;
  box-shadow: 0 1px 4px #e6f7ff44;
  min-height: 60px;
}
.kpi-detail-label {
  font-size: 15px;
  font-weight: 600;
  color: #555;
  margin-bottom: 4px;
}
.kpi-detail-value {
  color: #222;
  font-size: 15px;
  word-break: break-word;
}
@media (max-width: 700px) {
  .kpi-detail-modal .ant-modal-content {
    padding: 16px 6px 12px 6px;
  }
  .kpi-detail-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
