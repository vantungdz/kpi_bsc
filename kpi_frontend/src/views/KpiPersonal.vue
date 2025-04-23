<template>
  <div class="kpi-personal-list-page">
    <a-card>
      <template #title>
        My Assigned KPIs
      </template>
      <template #extra>
        <a-button type="primary" @click="goToCreatePersonalKpi">
          <plus-outlined /> Create Personal KPI
        </a-button>
      </template>

      <p style="margin-bottom: 16px">
        List of KPIs assigned to you (User: {{ actualUser?.username || 'N/A' }}). Submit your progress updates here.
      </p>

      <div style="margin-bottom: 20px">
        <a-alert v-if="loadingMyAssignments" message="Loading your KPIs..." type="info" show-icon>
          <template #icon><a-spin /></template>
        </a-alert>
        <a-alert v-else-if="myAssignmentsError" :message="myAssignmentsError" type="error" show-icon closable
          @close="clearError" />
        <a-alert v-else-if="myAssignments.length === 0 && !loadingMyAssignments" message="You have no assigned KPIs."
          type="warning" show-icon />
        <a-alert v-if="submissionSuccessMessage" :message="submissionSuccessMessage" type="success" closable
          @close="submissionSuccessMessage = null" show-icon />
      </div>

      <div v-if="!loadingMyAssignments && hasKpis">
        <a-collapse v-model:activeKey="activePanelKeys" expandIconPosition="end">
          <a-collapse-panel v-for="(kpiList, perspectiveId) in groupedPersonalKpis" :key="perspectiveId" :header="`${kpiList[0].perspective?.id || '?'}. ${kpiList[0].perspective
              ?.name || 'Uncategorized'} (${kpiList.length} KPI${kpiList.length > 1 ? 's' : ''
            })`
            ">
            <a-table :columns="myPersonalKpiColumns" :data-source="kpiList" :row-key="'assignment_id'"
              :pagination="false" size="small" bordered :scroll="{ x: 'max-content' }">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                  <a-tooltip :title="`KPI ID: ${record.kpi_id} | Assignment ID: ${record.assignment_id}`">
                    {{ record.name }}
                  </a-tooltip>
                </template>
                <template v-else-if="column.key === 'level'">
                  <a-tag :color="getKpiLevelColor(record.created_by_type)">
                    {{ record.created_by_type?.toUpperCase() || 'N/A' }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'target'">
                  {{ record.target?.toLocaleString() ?? 'N/A' }} {{ record.unit }}
                </template>
                <template v-else-if="column.key === 'value'">
                  {{ record.last_approved_value?.toLocaleString() ?? 'N/A' }}
                </template>
                <template v-else-if="column.key === 'progress'">
                  <a-progress v-if="record.target && record.last_approved_value != null"
                    :percent="calculateProgress(record.last_approved_value, record.target)" size="small" />
                  <span v-else>N/A</span>
                </template>
                <template v-else-if="column.key === 'status'">
                  <a-tag :color="getStatusColor(record.latest_update_status)">
                    {{ record.latest_update_status || 'Not Submitted' }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'actions'">
                  <a-space>
                    <a-button type="primary" size="small" @click="openSubmitUpdateModal(record)"
                      :disabled="isSubmitDisabled(record.latest_update_status)" :loading="submittingUpdate &&
                        currentSubmittingAssignment?.assignment_id ===
                        record.assignment_id
                        ">
                      {{ submitButtonText(record.latest_update_status) }}
                    </a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </a-card>

    <a-modal :open="isSubmitUpdateModalVisible" @update:open="isSubmitUpdateModalVisible = $event"
      :title="`Submit Progress Update for ${currentSubmittingAssignment?.kpi_name}`" @ok="handleSubmitUpdate"
      @cancel="closeSubmitUpdateModal" :confirm-loading="submittingUpdate" :mask-closable="false" destroyOnClose
      okText="Submit for Approval" cancelText="Cancel" width="600px">
      <a-form layout="vertical" :model="submitUpdateForm" ref="submitFormRef">
        <div style="
            max-height: 300px;
            overflow-y: auto;
            margin-bottom: 15px;
            padding-right: 10px;
          ">
          <a-space v-for="(project, index) in submitUpdateForm.projectValues" :key="project.id"
            style="display: flex; margin-bottom: 8px" align="baseline">
            <a-form-item :name="['projectValues', index, 'projectName']"
              :rules="[{ required: true, message: 'Project name required' }]" :wrapper-col="{ span: 24 }"
              style="margin-bottom: 0; flex: 1">
              <a-input v-model:value="project.projectName" placeholder="Project Name" />
            </a-form-item>
            <a-form-item :name="['projectValues', index, 'projectValue']" :rules="[
              { required: true, message: 'Value required' },
              { type: 'number', message: 'Must be a number', transform: (value) => Number(value) },
            ]" :wrapper-col="{ span: 24 }" style="margin-bottom: 0; flex: 1">
              <a-input-number v-model:value="project.projectValue"
                :placeholder="`Value (${currentSubmittingAssignment?.unit || ''})`" style="width: 100%" :min="0" />
            </a-form-item>
            <MinusCircleOutlined v-if="submitUpdateForm.projectValues.length > 1" @click="removeProjectValue(project)"
              style="cursor: pointer; color: #ff4d4f; font-size: 16px" />
          </a-space>
        </div>
        <a-form-item>
          <a-button type="dashed" block @click="addProjectValue">
            <PlusOutlined /> Add Project Entry
          </a-button>
        </a-form-item>
        <a-form-item label="Overall Notes (Optional)" name="notes">
          <a-textarea v-model:value="submitUpdateForm.notes" rows="3" placeholder="Add any overall notes" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, reactive } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router'; // Import router
import { notification, Collapse as ACollapse, CollapsePanel as ACollapsePanel, Form as AForm, FormItem as AFormItem, Modal as AModal, Input as AInput, InputNumber as AInputNumber, Textarea as ATextarea, Space as ASpace, Button as AButton, Table as ATable, Tag as ATag, Progress as AProgress, Tooltip as ATooltip, Alert as AAlert, Spin as ASpin, Card as ACard } from 'ant-design-vue';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons-vue'; // Import necessary icons

const store = useStore();
const router = useRouter(); // Import router
const actualUser = computed(() => store.getters['auth/user']);

// --- State ---
const loadingMyAssignments = ref(false);
const myAssignmentsError = ref(null);
const myAssignments = ref([]);
const activePanelKeys = ref([]);
const submissionSuccessMessage = ref(null);

// Modal State
const isSubmitUpdateModalVisible = ref(false);
const submittingUpdate = ref(false);
const currentSubmittingAssignment = ref(null);
const submitFormRef = ref(null);
const submitUpdateForm = reactive({ projectValues: [], notes: '' });

// --- Computed Properties ---
// Gom nhóm KPI cá nhân theo Perspective
const groupedPersonalKpis = computed(() => {
  const grouped = {};
  if (!myAssignments.value || myAssignments.value.length === 0) return grouped;
  myAssignments.value.forEach(kpi => {
    // API cần trả về kpi.perspective.id và kpi.perspective.name
    const key = kpi.perspective?.id || 'uncategorized';
    if (!grouped[key]) { grouped[key] = []; }
    grouped[key].push(kpi);
  });
  return grouped;
});
const hasKpis = computed(() => myAssignments.value && myAssignments.value.length > 0);

const myPersonalKpiColumns = [{
  title: 'KPI Name',
  dataIndex: 'name',
  key: 'name',
  width: '25%',
  ellipsis: true
},
{
  title: 'Level',
  dataIndex: 'created_by_type',
  key: 'level',
  width: '10%',
  align: 'center'
}, // Corrected dataIndex to created_by_type
{
  title: 'Target',
  dataIndex: 'target',
  key: 'target',
  align: 'right',
  width: '9%'
},
// Giảm width chút
{
  title: 'Unit',
  dataIndex: 'unit',
  key: 'unit',
  align: 'center',
  width: '8%'
},
{
  title: 'Approved Value',
  dataIndex: 'last_approved_value',
  key: 'value',
  align: 'right',
  width: '12%'
},
// Giảm width chút
{
  title: 'Progress (%)',
  key: 'progress',
  align: 'center',
  width: '12%'
},
// Giảm width chút
{
  title: 'Last Update Status',
  dataIndex: 'latest_update_status',
  key: 'status',
  align: 'center',
  width: '12%'
},
// Giảm width chút
{
  title: 'Actions',
  key: 'actions',
  align: 'center',
  width: '12%'
},
  // Giảm width chút
];

// --- Watcher ---
watch(groupedPersonalKpis, (newGroups) => { if (newGroups && typeof newGroups === 'object') { activePanelKeys.value = Object.keys(newGroups); } else { activePanelKeys.value = []; } }, { immediate: true, deep: true });

// --- Helper Functions ---
const getStatusColor = (status) => { switch (status) { case 'Approved': return 'success'; case 'Rejected': return 'error'; case 'Pending Section Approval': case 'Pending Dept Approval': case 'Pending Owner Approval': return 'processing'; default: return 'default'; } };
const calculateProgress = (current, target) => { const currentValue = parseFloat(current); const targetValue = parseFloat(target); if (isNaN(currentValue) || isNaN(targetValue) || targetValue === 0) return 0; const percent = (currentValue / targetValue) * 100; return parseFloat(Math.min(percent, 100).toFixed(2)); };
const isSubmitDisabled = (status) => { return status && !['Approved', 'Rejected', null, undefined, ''].includes(status); };
const submitButtonText = (status) => { return isSubmitDisabled(status) ? 'Pending...' : 'Submit Update'; };

const getKpiLevelColor = (level) => {
  switch (level?.toLowerCase()) {
    case 'company': return 'blue';
    case 'department': return 'green';
    case 'section': return 'orange';
    case 'personal': case 'user': return 'purple';
    default: return 'default';
  }
};
// ================================

// --- Methods ---
// Fetch danh sách KPI được gán (GỌI ACTION THẬT)
const fetchMyAssignedKpis = async () => {
  const userId = actualUser.value?.id;
  if (!userId) { myAssignmentsError.value = "Could not determine current user ID."; loadingMyAssignments.value = false; return; }
  loadingMyAssignments.value = true; myAssignmentsError.value = null; submissionSuccessMessage.value = null;
  try {
    console.log("Fetching assigned KPIs for user ID:", userId);
    const assignments = await store.dispatch('kpis/fetchMyAssignments', userId);
    myAssignments.value = assignments || [];
  } catch (error) { myAssignmentsError.value = store.getters['kpis/error'] || error.message || "Failed to load assigned KPIs."; myAssignments.value = []; }
  finally { loadingMyAssignments.value = false; }
};

// Xóa lỗi
const clearError = () => { myAssignmentsError.value = null; };

// Mở Modal Submit Update
const openSubmitUpdateModal = (assignment) => {
  if (!assignment || !assignment.assignment_id) {
    notification.error({ message: "Error", description: "Cannot identify assignment." });
    return;
  }
  currentSubmittingAssignment.value = assignment;
  submitUpdateForm.projectValues = [];
  submitUpdateForm.notes = '';
  addProjectValue();
  isSubmitUpdateModalVisible.value = true;
  submitFormRef.value?.clearValidate();
}
// Đóng Modal Submit Update
const closeSubmitUpdateModal = () => { isSubmitUpdateModalVisible.value = false; currentSubmittingAssignment.value = null; };
// Thêm dòng Project Value
const addProjectValue = () => { submitUpdateForm.projectValues.push({ id: Date.now(), projectName: '', projectValue: null }); };
// Xóa dòng Project Value
const removeProjectValue = (itemToRemove) => { const index = submitUpdateForm.projectValues.findIndex(item => item.id === itemToRemove.id); if (index !== -1 && submitUpdateForm.projectValues.length > 1) { submitUpdateForm.projectValues.splice(index, 1); } else if (submitUpdateForm.projectValues.length === 1) { notification.warn({ message: "Cannot remove last entry" }) } };

// Xử lý khi nhấn OK trên Modal Submit Update (GỌI API THẬT)
const handleSubmitUpdate = async () => {
  try { await submitFormRef.value?.validate(); if (submitUpdateForm.projectValues.length === 0) { notification.error({ message: 'Validation Failed', description: 'Add at least one project entry.' }); return; } const invalidEntry = submitUpdateForm.projectValues.some(p => p.projectName.trim() === '' || p.projectValue === null || p.projectValue < 0); if (invalidEntry) { notification.error({ message: 'Validation Failed', description: 'Enter project name and valid value (>=0).' }); return; } }
  catch (errorInfo) { console.log('Form Validation Failed:', errorInfo); return; }

  submittingUpdate.value = true;
  const assignmentId = currentSubmittingAssignment.value?.assignment_id;
  if (!assignmentId) { notification.error({ message: 'Error', description: 'Cannot identify KPI assignment.' }); submittingUpdate.value = false; return; }

  const payload = { notes: submitUpdateForm.notes, project_details: submitUpdateForm.projectValues.map(p => ({ name: p.projectName, value: Number(p.projectValue) })) };

  try {
    await store.dispatch('kpis/submitKpiUpdate', { assignmentId: assignmentId, updateData: payload });
    notification.success({ message: 'Update Submitted', description: 'Progress submitted for approval.' });
    closeSubmitUpdateModal();
    await fetchMyAssignedKpis(); // <<< TẢI LẠI DỮ LIỆU
    submissionSuccessMessage.value = `Update for KPI "${currentSubmittingAssignment.value?.kpi_name}" submitted successfully.`;
  } catch (error) { notification.error({ message: 'Submission Failed', description: store.getters['kpis/submitUpdateError'] || error.message || 'An error occurred.' }); } // <<< Dùng getter lỗi riêng
  finally { submittingUpdate.value = false; }
};


const goToCreatePersonalKpi = () => { router.push({ name: 'KpiPersonalCreate', query: { scope: 'personal' } }) };


// --- Lifecycle Hooks ---
onMounted(() => {
  console.log("KpiPersonal component mounted.");
  fetchMyAssignedKpis(); // Gọi fetch dữ liệu thật khi component mount
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