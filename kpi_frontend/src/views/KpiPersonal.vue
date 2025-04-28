<template>
  <div class="kpi-personal-list-page">
    <a-card>
      <template #title> My Assigned KPIs </template>
      <template #extra>
        <a-button type="primary" @click="goToCreatePersonalKpi">
          <plus-outlined /> Create Personal KPI
        </a-button>
      </template>

      <p style="margin-bottom: 16px">
        List of KPIs assigned to you (User:
        {{ actualUser?.username || "N/A" }}). Submit your progress updates here.
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
          <a-collapse-panel v-for="(kpiList, perspectiveId) in groupedPersonalKpis" :key="perspectiveId" :header="`${kpiList[0].perspective?.id || '?'}. ${kpiList[0].perspective?.name || 'Uncategorized'
            } (${kpiList.length} KPI${kpiList.length > 1 ? 's' : ''})`">
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
                    {{ record.created_by_type?.toUpperCase() || "" }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'target'">
                  {{ record.target?.toLocaleString() ?? 0 }}
                  {{ record.unit }}
                </template>
                <template v-else-if="column.key === 'value'">
                  {{ getApprovedValue(record)?.toLocaleString() ?? 0 }}
                </template>
                <template v-else-if="column.key === 'progress'">
                  <a-progress v-if="getTargetValue(record) && getApprovedValue(record) != null"
                    :percent="calculateProgress(getApprovedValue(record), getTargetValue(record))" size="small" />
                  <span v-else>0</span>
                </template>
                <template v-else-if="column.key === 'status'">
                  <template :set="latestValue = findLatestKpiValue(getRelevantAssignment(record))"></template> <a-tag
                    :color="getStatusColor(findLatestKpiValue(getRelevantAssignment(record))?.status || 'Not Submitted')">
                    {{ findLatestKpiValue(getRelevantAssignment(record))?.status || 'Not Submitted' }}

                    <template v-if="
                      (findLatestKpiValue(getRelevantAssignment(record))?.status === 'submitted' ||
                        findLatestKpiValue(getRelevantAssignment(record))?.status?.startsWith('Pending'))
                      && findLatestKpiValue(getRelevantAssignment(record))?.value != null
                    ">
                      : {{ Number(findLatestKpiValue(getRelevantAssignment(record))?.value).toLocaleString() }}
                    </template>
                  </a-tag>
                </template>

                <template v-else-if="column.key === 'actions'">
                  <a-space>
                    <template
                      :set="latestValueForActions = findLatestKpiValue(getRelevantAssignment(record))"></template>
                    <a-button type="primary" size="small" @click="openSubmitUpdateModal(record)"
                      :disabled="isSubmitDisabled(findLatestKpiValue(getRelevantAssignment(record)))" :loading="submittingUpdate &&
                        currentSubmittingAssignment?.assignment_id === getRelevantAssignment(record)?.id">
                      {{ submitButtonText(findLatestKpiValue(getRelevantAssignment(record))) }} </a-button>
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
          <div v-for="(project, index) in submitUpdateForm.projectValues" :key="project.id">
            <a-row :gutter="16" style="margin-bottom: 12px; display: flex; align-items: center">
              <a-col :span="10">
                <a-form-item :name="['projectValues', index, 'projectName']" label="Project Name" :rules="[
                  { required: true, message: 'Project name required' },
                ]" style="margin-bottom: 0">
                  <a-input v-model:value="project.projectName" placeholder="Project Name" style="height: 36px" />
                </a-form-item>
              </a-col>
              <a-col :span="10">
                <a-form-item :name="['projectValues', index, 'projectValue']" label="Value" :rules="[
                  { required: true, message: 'Value required' },
                  {
                    type: 'number',
                    message: 'Must be a number',
                    transform: (value) => Number(value),
                  },
                ]" style="margin-bottom: 0">
                  <a-input-number v-model:value="project.projectValue"
                    :placeholder="`Value (${currentSubmittingAssignment?.unit || ''})`"
                    style="width: 100%; height: 36px" :min="0" />
                </a-form-item>
              </a-col>
              <a-col :span="4" style="
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">
                <MinusCircleOutlined v-if="submitUpdateForm.projectValues.length > 1"
                  @click="removeProjectValue(project)" style="cursor: pointer; color: #ff4d4f; font-size: 16px" />
              </a-col>
            </a-row>
          </div>
        </div>
        <a-button type="dashed" block @click="addProjectValue">
          <PlusOutlined /> Add Project Entry
        </a-button>

        <a-form-item label="Overall Notes (Optional)" name="notes">
          <a-textarea v-model:value="submitUpdateForm.notes" rows="3" placeholder="Add any overall notes" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, reactive } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import {
  notification,
  Collapse as ACollapse,
  CollapsePanel as ACollapsePanel,
  Form as AForm,
  FormItem as AFormItem,
  Modal as AModal,
  Input as AInput,
  InputNumber as AInputNumber,
  Textarea as ATextarea,
  Space as ASpace,
  Button as AButton,
  Table as ATable,
  Tag as ATag,
  Progress as AProgress,
  Tooltip as ATooltip,
  Alert as AAlert,
  Spin as ASpin,
  Card as ACard,
} from "ant-design-vue";
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons-vue";
import dayjs from 'dayjs';

const store = useStore();
const router = useRouter();
const actualUser = computed(() => store.getters["auth/user"]);

const loadingMyAssignments = ref(false);
const myAssignmentsError = ref(null);
const myAssignments = ref([]);
const activePanelKeys = ref([]);
const submissionSuccessMessage = ref(null);

const isSubmitUpdateModalVisible = ref(false);
const submittingUpdate = ref(false);
const currentSubmittingAssignment = ref(null);
const submitFormRef = ref(null);
const submitUpdateForm = reactive({
  projectValues: [],
  notes: "",
});

const getRelevantAssignment = (kpiRecord) => {
  return kpiRecord?.assignments?.[0] || null;
};

const findLatestKpiValue = (assignment) => {
  if (!assignment?.kpiValues || assignment.kpiValues.length === 0) {
    return null;
  }

  return [...assignment.kpiValues].sort((a, b) =>
    dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf()
  )[0];
};

const findLatestApprovedKpiValue = (assignment) => {
  if (!assignment?.kpiValues || assignment.kpiValues.length === 0) {
    return null;
  }
  const approvedValues = assignment.kpiValues.filter(v => v.status === 'approved');
  if (approvedValues.length === 0) {
    return null;
  }
  return [...approvedValues].sort((a, b) =>
    dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf()
  )[0];
};

const getApprovedValue = (kpiRecord) => {
  const assignment = getRelevantAssignment(kpiRecord);
  const latestApproved = findLatestApprovedKpiValue(assignment);
  console.log("assignment:", assignment);
  return latestApproved ? Number(latestApproved.value) : null;
}

const getTargetValue = (kpiRecord) => {
  const assignment = getRelevantAssignment(kpiRecord);
  const target = assignment?.targetValue ?? kpiRecord?.target;
  return target !== null && target !== undefined ? Number(target) : null;
}

const groupedPersonalKpis = computed(() => {
  const grouped = {};
  if (!myAssignments.value || myAssignments.value.length === 0) return grouped;
  myAssignments.value.forEach((kpi) => {
    const key = kpi.perspective?.id || "uncategorized";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(kpi);
  });
  return grouped;
});

const hasKpis = computed(
  () => myAssignments.value && myAssignments.value.length > 0
);

const myPersonalKpiColumns = [
  { title: "KPI Name", dataIndex: "name", key: "name", width: "25%", ellipsis: true },
  { title: "Level", dataIndex: "created_by_type", key: "level", width: "10%", align: "center" },
  { title: "Target", key: "target", align: "right", width: "9%" },
  { title: "Approved Value", key: "value", align: "right", width: "12%" },
  { title: "Progress (%)", key: "progress", align: "center", width: "12%" },
  { title: "Last Update Status", key: "status", align: "center", width: "12%" },
  { title: "Actions", key: "actions", align: "center", width: "12%" },
];

watch(
  groupedPersonalKpis,
  (newGroups) => {
    if (newGroups && typeof newGroups === "object") {
      activePanelKeys.value = Object.keys(newGroups);
    } else {
      activePanelKeys.value = [];
    }
  },
  { immediate: true, deep: true }
);

const getStatusColor = (status) => {
  switch (status) {
    case "Approved":
      return "success";
    case "Rejected":
      return "error";
    case "Pending Section Approval":
    case "Pending Dept Approval":
    case "Pending Owner Approval":
      return "processing";
    default:
      return "default";
  }
};
const calculateProgress = (current, target) => {
  const currentValue = parseFloat(current);
  const targetValue = parseFloat(target);
  if (isNaN(currentValue) || isNaN(targetValue) || targetValue === 0) return 0;
  const percent = (currentValue / targetValue) * 100;
  return parseFloat(Math.min(percent, 100).toFixed(2));
};
const isSubmitDisabled = (latestValue) => {
  const status = latestValue?.status || 'Not Submitted';
  return (
    status && !["Approved", "Rejected", null, undefined, "", "Not Submitted"].includes(status)
  );
};

const submitButtonText = (latestValue) => {

  return isSubmitDisabled(latestValue) ? "Pending..." : "Submit Update";
};

const getKpiLevelColor = (level) => {
  switch (level?.toLowerCase()) {
    case "company":
      return "blue";
    case "department":
      return "green";
    case "section":
      return "orange";
    case "personal":
    case "user":
      return "purple";
    default:
      return "default";
  }
};

const fetchMyAssignedKpis = async () => {
  const userId = actualUser.value?.id;
  if (!userId) {
    myAssignmentsError.value = "Could not determine current user ID.";
    loadingMyAssignments.value = false;
    return;
  }
  loadingMyAssignments.value = true;
  myAssignmentsError.value = null;
  submissionSuccessMessage.value = null;
  try {
    console.log("Fetching assigned KPIs for user ID:", userId);
    const assignments = await store.dispatch("kpis/fetchMyAssignments", userId);
    myAssignments.value = assignments || [];
  } catch (error) {
    myAssignmentsError.value =
      store.getters["kpis/error"] ||
      error.message ||
      "Failed to load assigned KPIs.";
    myAssignments.value = [];
  } finally {
    loadingMyAssignments.value = false;
  }
};


const clearError = () => {
  myAssignmentsError.value = null;
};


const openSubmitUpdateModal = (kpiData) => {
  const relevantAssignment = kpiData?.assignments?.[0];
  if (!relevantAssignment || !relevantAssignment.id) {
    notification.error({
      message: "Error",
      description: "Cannot identify the specific assignment for this KPI.",
    });
    return;
  }

  currentSubmittingAssignment.value = {
    kpi_id: kpiData.id,
    kpi_name: kpiData.name,
    unit: kpiData.unit,
    target: kpiData.target,
    assignment_id: relevantAssignment.id,
    latest_update_status: relevantAssignment.status,
  };

  submitUpdateForm.projectValues = [];
  submitUpdateForm.notes = "";
  addProjectValue();
  isSubmitUpdateModalVisible.value = true;
  submitFormRef.value?.clearValidate();
};

const closeSubmitUpdateModal = () => {
  isSubmitUpdateModalVisible.value = false;
  currentSubmittingAssignment.value = null;
};

const addProjectValue = () => {
  submitUpdateForm.projectValues.push({
    id: Date.now(),
    projectName: "",
    projectValue: null,
  });
};

const removeProjectValue = (itemToRemove) => {
  const index = submitUpdateForm.projectValues.findIndex(
    (item) => item.id === itemToRemove.id
  );
  if (index !== -1 && submitUpdateForm.projectValues.length > 1) {
    submitUpdateForm.projectValues.splice(index, 1);
  } else if (submitUpdateForm.projectValues.length === 1) {
    notification.warn({ message: "Cannot remove last entry" });
  }
};

const handleSubmitUpdate = async () => {
  try {
    await submitFormRef.value?.validate();
    if (submitUpdateForm.projectValues.length === 0) {
      notification.error({
        message: "Validation Failed",
        description: "Add at least one project entry.",
      });
      return;
    }
    const invalidEntry = submitUpdateForm.projectValues.some(
      (p) =>
        p.projectName.trim() === "" ||
        p.projectValue === null ||
        p.projectValue < 0
    );
    if (invalidEntry) {
      notification.error({
        message: "Validation Failed",
        description: "Enter project name and valid value (>=0).",
      });
      return;
    }
  } catch (errorInfo) {
    console.log("Form Validation Failed:", errorInfo);
    return;
  }

  submittingUpdate.value = true;
  const assignmentId = currentSubmittingAssignment.value?.assignment_id;
  if (!assignmentId) {
    notification.error({
      message: "Error",
      description: "Cannot identify KPI assignment.",
    });
    submittingUpdate.value = false;
    return;
  }

  const payload = {
    notes: submitUpdateForm.notes,
    project_details: submitUpdateForm.projectValues.map((p) => ({
      name: p.projectName,
      value: Number(p.projectValue),
    })),
  };

  try {
    await store.dispatch("kpiValues/submitKpiUpdate", {
      assignmentId,
      updateData: payload,
    });
    notification.success({
      message: "Update Submitted",
      description: "Progress submitted for approval.",
    });
    closeSubmitUpdateModal();
    await fetchMyAssignedKpis();
  } catch (error) {
    notification.error({
      message: "Submission Failed",
      description:
        store.getters["kpiValue/getSubmitUpdateError"] ||
        error.message ||
        "An error occurred.",
    });
  } finally {
    submittingUpdate.value = false;
  }
};

const goToCreatePersonalKpi = () => {
  router.push({ name: "KpiPersonalCreate", query: { scope: "personal" } });
};


onMounted(() => {
  console.log("KpiPersonal component mounted.");
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
