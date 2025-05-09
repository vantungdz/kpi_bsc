<template>
  <div class="kpi-company-list-page">
    <div class="list-header">
      <h2>Company KPI List</h2>
      <div class="action-buttons">
        <a-button type="primary" @click="goToCreateKpi" style="float: bottom" v-if="canCreateCompanyKpi">
          <plus-outlined /> Create New KPI
        </a-button>
      </div>
    </div>
    <div class="filter-controls">
      <a-row :gutter="[22]">
        <a-col :span="6">
          <a-form-item label="Search:">
            <a-input placeholder="KPI name..." v-model:value="localFilters.name" @pressEnter="applyFilters" />
          </a-form-item>
        </a-col>
        <a-col :span="5">
          <a-form-item label="Department:">
            <a-select v-model:value="localFilters.departmentId" style="width: 100%">
              <a-select-option value="">All</a-select-option>
              <a-select-option v-for="department in departmentList" :key="department.id" :value="department.id">
                {{ department.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item label="Start Date:">
            <a-date-picker v-model:value="localFilters.startDate" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item label="End Date:">
            <a-date-picker v-model:value="localFilters.endDate" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="5" style="text-align: right">
          <a-button type="primary" @click="applyFilters" :loading="loading">
            <template #icon><filter-outlined /></template> Apply
          </a-button>
          <a-button @click="resetFilters" :loading="loading" style="margin-left: 8px">
            <template #icon><reload-outlined /></template> Reset
          </a-button>
        </a-col>
      </a-row>
    </div>

    <div style="margin-top: 20px; margin-bottom: 20px">
      <a-alert v-if="loading" message="Loading KPIs..." type="info" show-icon>
        <template #icon> <a-spin /> </template>
      </a-alert>
      <a-alert v-else-if="error" :message="error" type="error" show-icon closable />
      <a-alert v-else-if="kpis.length === 0" message="No KPIs found matching your criteria." type="warning" show-icon
        closable />
      <a-alert v-if="deletedKpiName" :message="`KPI '${deletedKpiName}' was deleted successfully!`" type="success"
        closable @close="deletedKpiName = null" show-icon />
      <a-alert v-if="toggleStatusError" message="Lỗi cập nhật trạng thái KPI" :description="toggleStatusError"
        type="error" show-icon closable @close="clearToggleError" style="margin-top: 10px;" />
    </div>

    <div v-if="groupedKpis" class="data-container">
      <a-collapse v-model:activeKey="activePanelKeys" expandIconPosition="end">
        <a-collapse-panel v-for="(kpiList, perspectiveId) in groupedKpis" :key="perspectiveId"
          :header="`${kpiList[0]?.perspective?.id || perspectiveId}. ${kpiList[0]?.perspective?.name || 'Uncategorized'} (${kpiList ? kpiList.length : 0} KPIs)`"
          accordion>
          <div v-if="kpiList && kpiList.length > 0">
            <a-table :columns="columns" :data-source="kpiList" row-key="id" :pagination="false" :size="'small'"
              bordered>
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'department'">
                  {{ record.department?.name || "--" }}
                </template>
                <template v-else-if="column.dataIndex === 'section'">
                  {{ record.section?.name || "--" }}
                </template>
                <template v-else-if="column.dataIndex === 'assignedTo'">
                  {{
                  record.assignedTo
                  ? `${record.assignedTo.first_name || ""} ${record.assignedTo.last_name || ""}`.trim()
                  : "--"
                  }}
                </template>
                <template v-else-if="column.key === 'status'"> 
                  <a-tag
                    :color="getKpiDefinitionStatusColor(record.status)" style="margin-right: 8px;"> {{
                      getKpiDefinitionStatusText(record.status) }} </a-tag>
                  <a-switch v-if="isManagerOrAdmin" :checked="record.status === KpiDefinitionStatus.APPROVED"
                    :loading="isToggling && currentToggleKpiId === record.id"
                    :disabled="isToggling && currentToggleKpiId !== record.id" checked-children="ON"
                    un-checked-children="OFF" size="small" @change="() => handleToggleStatus(record.id)"
                    title="Toggle DRAFT/APPROVED status" />
                </template>
                <template v-else-if="column.dataIndex === 'action'">
                  <a-space>
                    <a-tooltip title="View Details">
                      <a-button type="default" size="small" class="kpi-actions-button" @click="goToDetail(record)">
                        <schedule-outlined /> Details
                      </a-button>
                    </a-tooltip>
                    <a-tooltip title="Copy KPI">
                      <a-button type="dashed" size="small" @click="handleCopyKpi(record)">
                        <copy-outlined /> Copy
                      </a-button>
                    </a-tooltip>
                    <a-tooltip title="Delete KPI">
                      <a-button danger size="small" class="kpi-actions-button" v-if="canDeleteCompanyKpi"
                        @click="showConfirmDeleteDialog(record.id, record.name)"><delete-outlined /> Delete
                      </a-button>
                    </a-tooltip>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>
          <span v-else>No KPIs found for this perspective.</span>
        </a-collapse-panel>
      </a-collapse>
    </div>
    <a-empty v-else-if="!loading && !error" description="No KPIs found." />
    <a-modal danger v-model:open="isDeleteModalVisible" title="Confirm Dialog" @ok="handleDeleteKpi"
      @cancel="isDeleteModalVisible = false">
      <p>Are you sure to delete "{{ selectedKpiName }}"?</p>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

import {
  Button as AButton,
  Input as AInput,
  Select as ASelect,
  SelectOption as ASelectOption,
  DatePicker as ADatePicker,
  Row as ARow,
  Col as ACol,
  FormItem as AFormItem,
  Alert as AAlert,
  Spin as ASpin,
  Collapse as ACollapse,
  CollapsePanel as ACollapsePanel,
  Table as ATable,
  Tag as ATag,
  Space as ASpace,
  Modal as AModal,
  Empty as AEmpty,
} from "ant-design-vue";
import {
  PlusOutlined,
  FilterOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  CopyOutlined,
  DeleteOutlined,
  notification,
} from "@ant-design/icons-vue";
import dayjs from "dayjs";
import { KpiDefinitionStatus, KpiDefinitionStatusText, KpiDefinitionStatusColor } from '@/core/constants/kpiStatus';

const store = useStore();
const router = useRouter();

const localFilters = reactive({
  name: "",
  departmentId: "",
  status: "",
  startDate: null,
  endDate: null,
});
const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
const activePanelKeys = ref([]);
const currentToggleKpiId = ref(null);

const loading = computed(() => store.getters["kpis/isLoading"]);
const error = computed(() => store.getters["kpis/error"]);
const kpis = computed(() => store.getters["kpis/kpiList"] || []);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);

const groupedKpis = computed(() => {
  const grouped = {};
  if (!kpis.value || kpis.value.length === 0) return grouped;
  kpis.value.forEach((kpi) => {
    const key = kpi.perspective?.id || "uncategorized";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(kpi);
  });
  return grouped;
});

const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);
const isToggling = computed(() => store.getters['kpis/isTogglingKpiStatus']); // Getter for toggle loading
const toggleStatusError = computed(() => store.getters['kpis/toggleKpiStatusError']); // Getter for toggle error
const isManagerOrAdmin = computed(() => {
  return ['manager', 'admin'].includes(effectiveRole.value);
});

const canCreateCompanyKpi = computed(() =>
  ["admin", "manager"].includes(effectiveRole.value)
);

const canDeleteCompanyKpi = computed(() =>
  ["admin", "manager"].includes(effectiveRole.value)
);

const columns = [
  {
    title: "KPI name",
    dataIndex: "name",
    key: "name",
    width: "20%",
    ellipsis: true,
  },
  {
    title: "Department",
    dataIndex: "department",
    key: "department",
    width: "12%",
    ellipsis: true,
  },
  {
    title: "Section",
    dataIndex: "section",
    key: "section",
    width: "12%",
    ellipsis: true,
  },
  {
    title: "Assigned To",
    dataIndex: "assignedTo",
    key: "assignedTo",
    width: "12%",
    ellipsis: true,
  },
  {
    title: "Target",
    dataIndex: "target",
    key: "target",
    width: "8%",
    align: "right",
  },
  {
    title: "Weight",
    dataIndex: "weight",
    key: "weight",
    width: "7%",
    align: "right",
  },
  { title: "Frequency", dataIndex: "frequency", key: "frequency", width: "8%" },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: "8%",
    align: "center",
  },
  {
    title: "Action",
    dataIndex: "action",
    key: "action",
    width: "300px",
    align: "center",
  },
];

const goToCreateKpi = () => {
  router.push({ name: "KpiCreateCompany", query: { scope: "company" } });
};

const loadKpis = (page = 1) => {
  const params = {
    scope: "company",
    page: page,
  };

  if (localFilters.name) params.search = localFilters.name;
  if (localFilters.departmentId)
    params.department_id = localFilters.departmentId;
  if (localFilters.status) params.status = localFilters.status;
  if (localFilters.startDate)
    params.start_date = dayjs(localFilters.startDate).format("YYYY-MM-DD");
  if (localFilters.endDate)
    params.end_date = dayjs(localFilters.endDate).format("YYYY-MM-DD");

  store.dispatch("kpis/fetchKpis", params);
};

const applyFilters = () => {
  loadKpis(1);
};
const resetFilters = () => {
  localFilters.name = "";
  localFilters.departmentId = "";
  localFilters.status = "";
  localFilters.startDate = null;
  localFilters.endDate = null;
  loadKpis(1);
};

const handleCopyKpi = (record) => {
  if (record && record.id) {
    router.push({
      path: "/kpis/create",
      query: {
        templateKpiId: record.id,
      },
    });
  } else {
    notification.warning({
      message: "Không thể sao chép do thiếu thông tin KPI.",
    });
  }
};

const showConfirmDeleteDialog = (id, name) => {
  isDeleteModalVisible.value = true;
  selectedKpiId.value = id;
  selectedKpiName.value = name;
};
const handleDeleteKpi = async () => {
  if (!selectedKpiId.value) return;
  const kpiNameToDelete = selectedKpiName.value;
  isDeleteModalVisible.value = false;

  try {
    await store.dispatch("kpis/deleteKpi", selectedKpiId.value);
    deletedKpiName.value = kpiNameToDelete;
    selectedKpiId.value = null;
    selectedKpiName.value = null;

    loadKpis(1);
  } catch (err) {
    const errorMsg =
      store.getters["kpis/error"] || "Unknown error during deletion.";
    notification.error({ message: "Delete Failed", description: errorMsg });
    console.error("Delete KPI error:", err);
  }
};

const handleToggleStatus = async (kpiId) => {
  if (!kpiId || isToggling.value) return;
  currentToggleKpiId.value = kpiId;
  store.commit('kpis/SET_TOGGLE_KPI_STATUS_ERROR', null);
  try {
    await store.dispatch('kpis/toggleKpiStatus', { kpiId });
  } catch (error) {
    console.error("Failed to toggle KPI status from component:", error);
  } finally {
    currentToggleKpiId.value = null; // Reset ID đang xử lý
  }
};

const getKpiDefinitionStatusText = (status) => {
  return KpiDefinitionStatusText[status] || status || 'N/A';
};
const getKpiDefinitionStatusColor = (status) => {
  return KpiDefinitionStatusColor[status] || 'default';
};

const clearToggleError = () => {
  store.commit('kpis/SET_TOGGLE_KPI_STATUS_ERROR', null);
}

watch(
  groupedKpis,
  (newGroups) => {
    if (newGroups && typeof newGroups === "object") {
      activePanelKeys.value = Object.keys(newGroups);
    } else {
      activePanelKeys.value = [];
    }
  },
  { immediate: true }
);


const goToDetail = (record) => {
  if (record && record.id) {
    router.push({ name: "KpiDetail", params: { id: record.id } });
  } else {
    console.error(
      "Cannot navigate to detail: Invalid record or missing ID",
      record
    );
    notification.error({ message: "Cannot view details for this item." });
  }
};

onMounted(async () => {
  await loadKpis();

  await store.dispatch("departments/fetchDepartments");
});
</script>

<style scoped></style>
