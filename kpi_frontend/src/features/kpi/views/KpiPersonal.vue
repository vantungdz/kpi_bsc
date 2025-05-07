<template>
  <div class="kpi-personal-list-page">
    <a-card>
      <template #title>
        My Assigned KPIs
      </template>
      <template #extra>
        <a-button type="primary" @click="goToCreatePersonalKpi">
          <plus-outlined />
          Create Personal KPI
        </a-button>
      </template>
      <p style="margin-bottom: 16px">
        List of KPIs assigned to you (User:{{ actualUser?.username || "N/A" }}). Submit your progress updates here.
      </p>
      <div style="margin-bottom: 20px">
        <a-alert v-if="loadingMyAssignments" message="Loading your KPIs..." type="info" show-icon>
          <template #icon>
            <a-spin />
          </template>
        </a-alert>
        <a-alert v-else-if="myAssignmentsError" :message="myAssignmentsError" type="error" show-icon closable
          @close="clearError" />
        <a-alert v-else-if="!loadingMyAssignments && myAssignments.length === 0" message="You have no assigned KPIs."
          type="warning" show-icon />
      </div>
      <div v-if="!loadingMyAssignments && hasKpis">
        <a-collapse v-model:activeKey="activePanelKeys" expandIconPosition="end">
          <a-collapse-panel v-for="(kpiList, perspectiveId) in groupedPersonalKpis" :key="perspectiveId"
            :header="`${kpiList[0].perspective?.id || '?'}. ${kpiList[0].perspective?.name || 'Uncategorized'} (${kpiList.length} KPI${kpiList.length > 1 ? 's' : ''})`">
            <a-table :columns="myPersonalKpiColumns" :data-source="kpiList" :row-key="'id'" :pagination="false"
              size="small" bordered :scroll="{ x: 'max-content' }">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                    <a @click="$router.push({ name: 'KpiDetail', params: { id: record.id } })"
                      style="cursor: pointer; color: #1890ff">
                      {{ record.name }}
                    </a>
                </template>
                <template v-else-if="column.key === 'level'">
                  <a-tag :color="getKpiLevelColor(record.created_by_type)">
                    {{ record.created_by_type?.toUpperCase() || "N/A" }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'target'">
                  {{ getTargetValue(record)?.toLocaleString() ?? 'N/A' }}
                  <span v-if="record.unit">
                    {{ record.unit }}
                  </span>
                </template>
                <template v-else-if="column.key === 'value'">
                  {{ getApprovedValue(record)?.toLocaleString() ?? '-' }}
                </template>
                <template v-else-if="column.key === 'progress'">
                  <template :set="APPROVEDVal = getApprovedValue(record)">
                  </template>
                  <template :set="targetVal = getTargetValue(record)">
                  </template>
                  <a-progress v-if="targetVal != null && APPROVEDVal != null && targetVal !== 0"
                    :percent="calculateProgress(APPROVEDVal, targetVal)" size="small" status="active" />
                  <span v-else> - </span>
                </template>
                <template v-else-if="column.key === 'status'">
                  <template :set="latestValue = findLatestKpiValue(getRelevantAssignment(record))">
                  </template>
                  <div>
                    <a-tag :color="getValueStatusColor(latestValue?.status)">
                      {{ getValueStatusText(latestValue?.status) }}
                    </a-tag>
                    <div v-if="latestValue?.rejection_reason && latestValue.status?.startsWith('REJECTED')"
                      style="margin-top: 4px;">
                      <a-tooltip placement="topLeft" :title="latestValue.rejection_reason">
                        <span style="color: #ff4d4f; font-size: 0.85em; cursor: help;">
                          <info-circle-outlined style="margin-right: 4px;" />
                          Lý do từ chối
                        </span>
                      </a-tooltip>
                    </div>
                  </div>
                </template>
                <template v-else-if="column.key === 'actions'">
                  <a-space>
                    <template :set="latestValueForActions = findLatestKpiValue(getRelevantAssignment(record))">
                    </template>
                    <a-button type="primary" size="small" @click="openSubmitUpdateModal(record)"
                      :disabled="isSubmitDisabled(latestValueForActions, record.status)"
                      :loading="submittingUpdate && currentSubmittingAssignment?.assignment_id === getRelevantAssignment(record)?.id">
                      {{ submitButtonText(latestValueForActions) }}
                    </a-button>
                    <a-tooltip title="Xem lịch sử cập nhật/phê duyệt">
                      <a-button type="default" size="small" @click="openHistoryModal(record)">
                        <history-outlined />
                      </a-button>
                    </a-tooltip>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-collapse-panel>
        </a-collapse>
      </div>
      <a-empty v-else description="Bạn không có KPI nào được giao." />
    </a-card>
    <a-modal :open="isSubmitUpdateModalVisible" @update:open="isSubmitUpdateModalVisible = $event"
      :title="`Submit Progress Update for ${currentSubmittingAssignment?.kpi_name}`" @ok="handleSubmitUpdate"
      @cancel="closeSubmitUpdateModal" :confirm-loading="submittingUpdate" :mask-closable="false" destroyOnClose
      okText="Submit for Approval" cancelText="Cancel" width="600px">
      <a-form layout="vertical" :model="submitUpdateForm" ref="submitFormRef">
        <div style="max-height: 300px; overflow-y: auto; margin-bottom: 15px; padding-right: 10px;">
          <div v-for="(project, index) in submitUpdateForm.projectValues" :key="project.id">
            <a-row :gutter="16" style="margin-bottom: 12px; display: flex; align-items: center">
              <a-col :span="10">
                <a-form-item :name="['projectValues', index, 'projectName']" label="Project Name"
                  :rules="[{ required: true, message: 'Project name required' }]" style="margin-bottom: 0">
                  <a-input v-model:value="project.projectName" placeholder="Project Name" style="height: 36px" />
                </a-form-item>
              </a-col>
              <a-col :span="10">
                <a-form-item :name="['projectValues', index, 'projectValue']" label="Value"
                  :rules="[{ required: true, message: 'Value required' }, { type: 'number', message: 'Must be a number', transform: (value) => Number(value) }]"
                  style="margin-bottom: 0">
                  <a-input-number v-model:value="project.projectValue"
                    :placeholder="`Value (${currentSubmittingAssignment?.unit || ''})`"
                    style="width: 100%; height: 36px" :min="0" />
                </a-form-item>
              </a-col>
              <a-col :span="4" style="display: flex; align-items: center; justify-content: center;">
                <MinusCircleOutlined v-if="submitUpdateForm.projectValues.length > 1"
                  @click="removeProjectValue(project)" style="cursor: pointer; color: #ff4d4f; font-size: 16px" />
              </a-col>
            </a-row>
          </div>
        </div>
        <a-button type="dashed" block @click="addProjectValue" style="margin-bottom: 15px;">
          <plus-outlined />
          Add Project Entry
        </a-button>
        <a-form-item label="Overall Notes (Optional)" name="notes">
          <a-textarea v-model:value="submitUpdateForm.notes" rows="3" placeholder="Add any overall notes" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-modal :open="isHistoryModalVisible" title="Lịch sử cập nhật/phê duyệt" @cancel="closeHistoryModal" :width="1000"
      :footer="null" destroyOnClose>
      <a-spin :spinning="isLoadingHistory" tip="Đang tải lịch sử...">
        <a-alert v-if="historyError" type="error" show-icon :message="historyError" style="margin-bottom: 10px" />
        <a-table v-if="!historyError && kpiValueHistory.length > 0" :columns="historyColumns"
          :data-source="kpiValueHistory" :row-key="'id'" size="small" bordered
          :pagination="{ pageSize: 5, size: 'small' }" :scroll="{ x: 'max-content' }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'timestamp'">
              {{ formatDate(record.changed_at || record.timestamp) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <span>
                {{ getActionText(record.action) }}
              </span>
            </template>
            <template v-else-if="column.key === 'value'">
              {{ record.value?.toLocaleString() ?? '' }}
            </template>
            <template v-else-if="column.key === 'status_before'">
              <a-tag v-if="record.status_before" :color="getValueStatusColor(record.status_before)">
                {{ getValueStatusText(record.status_before) }}
              </a-tag>
              <span v-else>
                -
              </span>
            </template>
            <template v-else-if="column.key === 'status_after'">
              <a-tag v-if="record.status_after" :color="getValueStatusColor(record.status_after)">
                {{ getValueStatusText(record.status_after) }}
              </a-tag>
              <span v-else>
                -
              </span>
            </template>
            <template v-else-if="column.key === 'noteOrReason'">
              <a-tooltip placement="topLeft" v-if="record.reason" :title="record.reason">
                <span style="color: red;">
                  Lý do: {{ truncateText(record.reason, 70) }}
                </span>
              </a-tooltip>
              <a-tooltip v-else-if="record.notes" :title="record.notes">
                <span>
                  {{ truncateText(record.notes, 70) }}
                </span>
              </a-tooltip>
              <span v-else style="color: #888;">
                -
              </span>
            </template>
            <template v-else-if="column.key === 'changed_by'">
              <span v-if="record.changedByUser">
                {{ record.changedByUser.first_name }} {{ record.changedByUser.last_name
                }}
              </span>
              <span v-else-if="record.changed_by">
                ID: {{ record.changed_by }}
              </span>
              <span v-else>
                N/A
              </span>
            </template>
          </template>
        </a-table>
        <a-empty v-if="!historyError && kpiValueHistory.length === 0" description="Không có lịch sử." />
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, nextTick } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import {
  notification, Collapse as ACollapse, CollapsePanel as ACollapsePanel,
  Form as AForm, FormItem as AFormItem, Modal as AModal, Input as AInput,
  InputNumber as AInputNumber, Textarea as ATextarea, Space as ASpace,
  Button as AButton, Table as ATable, Tag as ATag, Progress as AProgress,
  Tooltip as ATooltip, Alert as AAlert, Spin as ASpin, Card as ACard, Empty as AEmpty,
} from "ant-design-vue";
import { PlusOutlined, MinusCircleOutlined, InfoCircleOutlined, HistoryOutlined } from "@ant-design/icons-vue";
import dayjs from 'dayjs';
import { KpiValueStatus, KpiValueStatusText, KpiValueStatusColor, KpiDefinitionStatus } from '@/core/constants/kpiStatus';

const store = useStore();
const router = useRouter();
const actualUser = computed(() => store.getters["auth/user"]);

const loadingMyAssignments = ref(false);
const myAssignmentsError = ref(null);
const myAssignments = ref([]);
const activePanelKeys = ref([]);
const isSubmitUpdateModalVisible = ref(false);
const currentSubmittingAssignment = ref(null);
const submitFormRef = ref(null);
const submitUpdateForm = reactive({
  projectValues: [],
  notes: "",
});
const isHistoryModalVisible = ref(false);
const selectedKpiValueForHistory = ref(null);
const kpiValueHistory = ref([]);
const isLoadingHistory = ref(false);
const historyError = ref(null);

const hasKpis = computed(() => myAssignments.value && myAssignments.value.length > 0);
const submittingUpdate = computed(() => store.getters['kpiValues/isSubmittingUpdate']);

const groupedPersonalKpis = computed(() => {
  const grouped = {};
  if (!myAssignments.value || myAssignments.value.length === 0) return grouped;
  myAssignments.value.forEach((kpi) => {
    if (kpi && kpi.assignments && kpi.assignments.length > 0) {
      const key = kpi.perspective?.id || "uncategorized";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(kpi);
    } else {
      console.warn("KPI object missing assignments:", kpi);
    }
  });
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const numA = parseInt(a, 10); const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1; if (!isNaN(numB)) return 1;
    if (a === 'uncategorized') return 1; if (b === 'uncategorized') return -1;
    return String(a).localeCompare(String(b));
  });
  const sortedGrouped = {};
  sortedKeys.forEach(key => { sortedGrouped[key] = grouped[key]; });
  return sortedGrouped;
});

const myPersonalKpiColumns = ref([
  { title: "KPI Name", key: "name", width: "20%", ellipsis: true, fixed: 'left' },
  { title: "Level", dataIndex: "created_by_type", key: "level", width: "8%", align: "center" },
  { title: "Target", key: "target", align: "right", width: "10%" },
  { title: "Approved Value", key: "value", align: "right", width: "10%" },
  { title: "Progress (%)", key: "progress", align: "center", width: "10%" },
  { title: "Update Status", key: "status", align: "center", width: "18%" },
  { title: "Actions", key: "actions", align: "center", width: "15%", fixed: 'right' },
]);

const historyColumns = ref([
  { title: 'Thời gian', key: 'timestamp', width: 140 },
  { title: 'Hành động', dataIndex: 'action', key: 'action', width: 180 },
  { title: 'Giá trị', dataIndex: 'value', key: 'value', align: 'right', width: 70 },
  { title: 'Status Trước', key: 'status_before', align: 'center', width: 80 },
  { title: 'Status Sau', key: 'status_after', align: 'center', width: 80 },
  { title: 'Ghi chú / Lý do', key: 'noteOrReason', ellipsis: true },
  { title: 'Người thực hiện', key: 'changed_by', width: 150 },
]);


const getRelevantAssignment = (kpiRecord) => kpiRecord?.assignments?.[0] || null;

const findLatestKpiValue = (assignment) => {
  if (!assignment?.kpiValues || assignment.kpiValues.length === 0) return null;
  return [...assignment.kpiValues].sort((a, b) =>
    new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
  )[0];
};

const findLatestApprovedKpiValue = (assignment) => {
  if (!assignment?.kpiValues || assignment.kpiValues.length === 0) return null;
  const APPROVEDValues = assignment.kpiValues.filter(v => v.status === KpiValueStatus.APPROVED);
  if (APPROVEDValues.length === 0) return null;
  return [...APPROVEDValues].sort((a, b) =>
    new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
  )[0];
};

const getApprovedValue = (kpiRecord) => {
  const assignment = getRelevantAssignment(kpiRecord);
  const latestApproved = findLatestApprovedKpiValue(assignment);
  return latestApproved ? Number(latestApproved.value) : null;
};

const getTargetValue = (kpiRecord) => {
  const assignment = getRelevantAssignment(kpiRecord);
  const target = assignment?.targetValue ?? kpiRecord?.target;
  return target !== null && target !== undefined ? Number(target) : null;
};

const calculateProgress = (current, target) => {
  const currentValue = parseFloat(current); const targetValue = parseFloat(target);
  if (isNaN(currentValue) || isNaN(targetValue) || targetValue === 0 || currentValue === null || targetValue === null) return 0;
  const percent = (currentValue / targetValue) * 100;
  return parseFloat(Math.min(percent, 100).toFixed(2));
};

const isSubmitDisabled = (latestValue, kpiDefinitionStatus) => {
  if (kpiDefinitionStatus !== KpiDefinitionStatus.APPROVED) {
    return true;
  }
  const valueStatus = latestValue?.status;
  const allowedStatuses = [
    null, undefined,
    KpiValueStatus.DRAFT,
    KpiValueStatus.REJECTED_BY_SECTION,
    KpiValueStatus.REJECTED_BY_DEPT,
    KpiValueStatus.REJECTED_BY_MANAGER
  ];
  const isDisabled = !allowedStatuses.includes(valueStatus);
  return isDisabled;
};

const submitButtonText = (latestValue) => {
  const status = latestValue?.status;
  switch (status) {
    case KpiValueStatus.REJECTED_BY_SECTION:
    case KpiValueStatus.REJECTED_BY_DEPT:
    case KpiValueStatus.REJECTED_BY_MANAGER:
      return "Gửi lại Cập nhật";
    case KpiValueStatus.SUBMITTED:
    case KpiValueStatus.PENDING_SECTION_APPROVAL:
    case KpiValueStatus.PENDING_DEPT_APPROVAL:
    case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      return "Đang chờ duyệt...";
    case KpiValueStatus.APPROVED:
      return "Đã duyệt";
    default:
      return "Gửi Cập nhật";
  }
};

const getValueStatusColor = (status) => KpiValueStatusColor[status] || 'default';
const getValueStatusText = (status) => KpiValueStatusText[status] || status || 'Chưa submit';

const getKpiLevelColor = (level) => {
  switch (level?.toLowerCase()) {
    case "company": return "blue";
    case "department": return "green";
    case "section": return "orange";
    case "personal": case "user": return "purple";
    default: return "default";
  }
};
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return dayjs(dateString).format('YYYY-MM-DD HH:mm');
};
const truncateText = (text, length) => {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
};
const getActionText = (actionKey) => {
  const map = { 'SUBMIT_CREATE': 'Tạo & Gửi duyệt', 'SUBMIT_UPDATE': 'Cập nhật & Gửi duyệt', 'APPROVE_SECTION': 'Section Duyệt', 'REJECT_SECTION': 'Section Từ chối', 'APPROVE_DEPT': 'Dept Duyệt', 'REJECT_DEPT': 'Dept Từ chối', 'APPROVE_MANAGER': 'Manager Duyệt', 'REJECT_MANAGER': 'Manager Từ chối', 'CREATE': 'Tạo mới', 'UPDATE': 'Cập nhật', 'DELETE': 'Xóa' };
  return map[actionKey?.toUpperCase()] || actionKey || 'Không rõ';
};

const fetchMyAssignedKpis = async () => {
  const userId = actualUser.value?.id;
  if (!userId) { myAssignmentsError.value = "Could not determine current user ID."; loadingMyAssignments.value = false; return; }
  loadingMyAssignments.value = true;
  myAssignmentsError.value = null;
  try {
    const assignmentsData = await store.dispatch("kpis/fetchMyAssignments", userId);
    myAssignments.value = assignmentsData || [];
    await nextTick(); // Đợi DOM cập nhật (hoặc computed property tính toán xong)
    const groups = groupedPersonalKpis.value;
    if (groups && typeof groups === 'object') {
      activePanelKeys.value = Object.keys(groups); // Lấy tất cả các key (perspectiveId)
      console.log("Setting active panel keys:", activePanelKeys.value);
    } else {
      activePanelKeys.value = [];
    }
    console.log("Fetched My Assignments (KPI Objects):", myAssignments.value);
  } catch (error) {
    myAssignmentsError.value = store.getters["kpis/error"] || error.message || "Failed to load assigned KPIs.";
    myAssignments.value = [];
    console.error("Fetch my assignments error:", error);
  } finally {
    loadingMyAssignments.value = false;
  }
};
const clearError = () => { myAssignmentsError.value = null; };

const openSubmitUpdateModal = (kpiRecord) => {
  const relevantAssignment = getRelevantAssignment(kpiRecord);
  if (!relevantAssignment || !relevantAssignment.id) { notification.error({ message: "Error", description: "Cannot identify assignment for this KPI." }); return; }
  if (kpiRecord.status !== KpiDefinitionStatus.APPROVED) { notification.warn({ message: "Thông báo", description: `KPI "${kpiRecord.name}" chưa được duyệt, không thể submit giá trị.` }); return; }
  const latestValue = findLatestKpiValue(relevantAssignment);
  if (!isSubmitDisabled(latestValue, kpiRecord.status)) {
    currentSubmittingAssignment.value = {
      kpi_id: kpiRecord.id, kpi_name: kpiRecord.name, unit: kpiRecord.unit,
      target: getTargetValue(kpiRecord), assignment_id: relevantAssignment.id,
    };
    submitUpdateForm.projectValues = [{ id: Date.now(), projectName: "", projectValue: null }];
    submitUpdateForm.notes = "";
    isSubmitUpdateModalVisible.value = true;
    nextTick(() => { submitFormRef.value?.resetFields(); });
  } else {
    notification.info({ message: "Thông báo", description: "Trạng thái hiện tại không cho phép gửi cập nhật mới." });
  }
};

const closeSubmitUpdateModal = () => { isSubmitUpdateModalVisible.value = false; currentSubmittingAssignment.value = null; };
const addProjectValue = () => { submitUpdateForm.projectValues.push({ id: Date.now(), projectName: "", projectValue: null }); };
const removeProjectValue = (itemToRemove) => {
  const index = submitUpdateForm.projectValues.findIndex(item => item.id === itemToRemove.id);
  if (index !== -1 && submitUpdateForm.projectValues.length > 1) { submitUpdateForm.projectValues.splice(index, 1); }
  else if (submitUpdateForm.projectValues.length === 1) { notification.warn({ message: "Cannot remove last entry" }); }
};

const handleSubmitUpdate = async () => {
  try { await submitFormRef.value?.validate(); } catch (errorInfo) { return; }
  if (submitUpdateForm.projectValues.length === 0) { notification.error({ message: "Validation Failed", description: "Add at least one project entry." }); return; }
  if (submitUpdateForm.projectValues.some(p => !p.projectName || p.projectValue === null || p.projectValue < 0)) { notification.error({ message: "Validation Failed", description: "Enter project name and valid value (>=0)." }); return; }
  if (!currentSubmittingAssignment.value?.assignment_id) return;

  const payload = {
    notes: submitUpdateForm.notes,
    project_details: submitUpdateForm.projectValues.map((p) => ({ name: p.projectName, value: Number(p.projectValue) })),
  };

  try {
    await store.dispatch("kpiValues/submitKpiUpdate", {
      assignmentId: currentSubmittingAssignment.value.assignment_id,
      updateData: payload,
    });
    notification.success({ message: "Update Submitted", description: "Progress submitted for approval." });
    closeSubmitUpdateModal();
    await fetchMyAssignedKpis();
  } catch (error) {
    console.error("handleSubmitUpdate failed:", error);
  }
};

const goToCreatePersonalKpi = () => { router.push({ name: "KpiPersonalCreate", query: { scope: "personal" } }); };

const openHistoryModal = async (kpiRecord) => {
  const assignment = getRelevantAssignment(kpiRecord);
  if (!assignment || !assignment.id) { notification.error({ message: "Cannot view history without assignment ID." }); return; }
  const latestValue = findLatestKpiValue(assignment);
  if (!latestValue || !latestValue.id) { notification.info({ message: "No submission history found for this KPI yet." }); return; }
  selectedKpiValueForHistory.value = latestValue;
  kpiValueHistory.value = [];
  historyError.value = null;
  isHistoryModalVisible.value = true;
  await loadHistory(latestValue.id);
};

const loadHistory = async (valueId) => {
  if (!valueId) return;
  isLoadingHistory.value = true;
  historyError.value = null;
  try {
    const historyData = await store.dispatch('kpiValues/fetchValueHistory', { valueId });
    kpiValueHistory.value = historyData || [];
  } catch (error) {
    historyError.value = error.message || 'Lỗi khi tải lịch sử.';
  } finally {
    isLoadingHistory.value = false;
  }
};

const closeHistoryModal = () => {
  isHistoryModalVisible.value = false;
  setTimeout(() => {
    selectedKpiValueForHistory.value = null;
    kpiValueHistory.value = [];
    isLoadingHistory.value = false;
    historyError.value = null;
  }, 300);
};

onMounted(() => {
  fetchMyAssignedKpis();
});

</script>

<style scoped>
/* Style chung */
:deep(.ant-collapse-header) {
  background-color: #f0f2f5;
  font-weight: bold;
}

:deep(.ant-collapse-content > .ant-collapse-content-box) {
  padding: 0;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.kpi-actions-button {
  font-size: 0.8em;
  padding: 3px 6px;
  margin: 0 3px;
}

.mb-6 {
  margin-bottom: 1.5rem;
}

.text-lg {
  font-size: 1.125rem;
}

.font-bold {
  font-weight: 600;
}

.mb-2 {
  margin-bottom: 0.75rem;
}
</style>
