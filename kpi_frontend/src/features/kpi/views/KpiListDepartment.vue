<template>
  <div class="kpi-department-list-page">
    <div class="list-header">
      <h2>{{ $t("departmentKpiList") }}</h2>

      <div class="action-buttons" v-if="canCreateDepartmentKpi">
        <a-button type="primary" style="float: bottom" @click="goToCreateKpi">
          <plus-outlined /> {{ $t("createNewKpi") }}
        </a-button>
      </div>
    </div>

    <div class="filter-controls">
      <a-row :gutter="[22]">
        <a-col :span="6">
          <a-form-item :label="$t('search')">
            <a-input
              v-model:value="localFilters.name"
              :placeholder="$t('kpiNamePlaceholder')"
              @pressEnter="applyFilters"
            />
          </a-form-item>
        </a-col>

        <a-col :span="5">
          <a-form-item :label="$t('department')">
            <a-select
              v-model:value="localFilters.departmentId"
              style="width: 100%"
              @change="applyFilters"
            >
              <a-select-option :value="null">{{ $t('allDepartments') }}</a-select-option>
              <a-select-option
                v-for="department in departmentList"
                :key="department.id"
                :value="department.id"
              >
                {{ department.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :span="4">
          <a-form-item :label="$t('startDate')">
            <a-date-picker
              v-model:value="localFilters.startDate"
              style="width: 100%"
              @change="applyFilters"
            />
          </a-form-item>
        </a-col>

        <a-col :span="4">
          <a-form-item :label="$t('endDate')">
            <a-date-picker
              v-model:value="localFilters.endDate"
              style="width: 100%"
              @change="applyFilters"
            />
          </a-form-item>
        </a-col>
      </a-row>
    </div>

    <div style="margin-top: 20px; margin-bottom: 20px">
      <a-alert
        v-if="loading"
        type="info"
        :message="$t('loadingKpis')"
        show-icon
      >
        <template #icon> <a-spin /> </template>
      </a-alert>

      <a-alert
        v-else-if="error"
        type="error"
        :message="error"
        show-icon
        closable
      />

      <a-alert
        v-else-if="isDisplayResult && departmentGroups.length === 0"
        type="warning"
        :message="$t('noKpisFound')"
        show-icon
        closable
      />

      <a-alert
        v-if="deletedKpiName"
        type="success"
        :message="$t('kpiDeleted', { name: deletedKpiName })"
        show-icon
        closable
        @close="deletedKpiName = null"
      />
    </div>

    <div class="data-container">
      <div
        v-for="(departmentItem, departmentIndex) in departmentGroups"
        :key="'dept-' + departmentIndex"
        class="mb-8"
      >
        <h4 style="margin-top: 10px" class="text-lg font-bold mb-2">
          {{ $t("departmentHeader", { name: departmentItem.department }) }}
        </h4>

        <a-collapse
          v-model:activeKey="activePanelKeys"
          expandIconPosition="end"
        >
          <a-collapse-panel
            v-for="(
              perspectiveGroupRows, perspectiveKey
            ) in departmentItem.data"
            :key="'pers-' + departmentIndex + '-' + perspectiveKey"
            :header="perspectiveKey.split('. ')[1] || perspectiveKey"
          >
            <a-table
              :columns="columns"
              :dataSource="tableData(perspectiveGroupRows)"
              :pagination="false"
              rowKey="key"
              :rowClassName="rowClassName"
              size="small"
              bordered
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'kpiName'">
                  <span>{{ record.kpiName }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'chart'">
                  <ApexChart
                    type="donut"
                    width="120px"
                    height="100"
                    :options="{
                      chart: { height: 100, type: 'donut' },
                      labels: [$t('actual'), $t('remaining')],
                      colors: ['#008FFB', '#B9E5FF'],
                      dataLabels: {
                        enabled: true,
                        style: {
                          fontSize: '12px',
                          colors: ['black'],
                        },
                      },
                      legend: { show: false },
                    }"
                    :series="[
                      parseFloat(record.actual) || 0,
                      Math.max(
                        parseFloat(record.target) - parseFloat(record.actual),
                        0
                      ),
                    ]"
                  />
                </template>
                <template v-else-if="column.dataIndex === 'startDate'">
                  <span>{{ record.startDate }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'endDate'">
                  <span>{{ record.endDate }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'weight'">
                  <span>{{ record.weight }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'target'">
                  <span>{{
                    `${Number(record.target).toLocaleString()} ${record.unit}`
                  }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'actual'">
                  <span>{{
                    `${Number(record.actual).toLocaleString()} ${record.unit}`
                  }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'status'">
                  <a-tag
                    :bordered="false"
                    :color="getStatusColor(record.status)"
                  >
                    {{ $t("status_chart." + record.status) || record.status }}
                  </a-tag>
                </template>

                <template v-else-if="column.dataIndex === 'action'">
                  <a-tooltip :title="$t('viewDetails')">
                    <a-button
                      type="default"
                      class="kpi-actions-button"
                      @click="
                        $router.push({
                          name: 'KpiDetail',
                          params: { id: record.kpiId },
                          query: { contextDepartmentId: record.departmentId },
                        })
                      "
                    >
                      <schedule-outlined /> {{ $t("details") }}
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('copyKpi')">
                    <a-button
                      type="dashed"
                      size="small"
                      @click="handleCopyKpi(record)"
                      v-if="canCopyDepartmentKpi"
                    >
                      <copy-outlined /> {{ $t("copy") }}
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteKpi')">
                    <a-button
                      danger
                      class="kpi-actions-button"
                      @click="
                        showConfirmDeleteDialog(record.key, record.kpiName)
                      "
                      v-if="canDeleteDepartmentKpi"
                    >
                      <delete-outlined /> {{ $t("delete") }}
                    </a-button>
                  </a-tooltip>
                </template>
              </template>
            </a-table>
          </a-collapse-panel>
        </a-collapse>

        <a-modal
          danger
          v-model:open="isDeleteModalVisible"
          :title="$t('confirmDialog')"
          @ok="handleDeleteKpi"
          @cancel="isDeleteModalVisible = false"
        >
          <p>{{ $t("confirmDeleteAssignment", { name: selectedKpiName }) }}</p>
        </a-modal>
      </div>
    </div>

    <router-view></router-view>
  </div>
</template>
<script setup>
import { reactive, computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  PlusOutlined,
  ScheduleOutlined,
  DeleteOutlined,
  CopyOutlined,
} from "@ant-design/icons-vue";
import { notification } from "ant-design-vue";
import { KpiDefinitionStatus } from "@/core/constants/kpiStatus";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

const store = useStore();
const router = useRouter();
const { t: $t } = useI18n();

const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);

const currentUser = computed(() => store.getters["auth/currentUser"]);
const loading = computed(() => store.getters["kpis/isLoading"]);
const error = computed(() => store.getters["kpis/error"]);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const departmentKpiList = computed(
  () => store.getters["kpis/departmentKpiList"] || []
);

const userPermissions = computed(() => store.getters["auth/user"]?.permissions || []);
function hasPermission(action, resource) {
  return userPermissions.value?.some(
    (p) => p.action === action && p.resource === resource
  );
}
const canCreateDepartmentKpi = computed(() => hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI_DEPARTMENT));
const canCopyDepartmentKpi = computed(() => hasPermission(RBAC_ACTIONS.COPY_TEMPLATE, RBAC_RESOURCES.KPI));
const canDeleteDepartmentKpi = computed(() => hasPermission(RBAC_ACTIONS.DELETE, RBAC_RESOURCES.KPI_DEPARTMENT));

const isDepartmentUser = computed(() => effectiveRole.value === "department");

const activePanelKeys = ref([]);
const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
const isDisplayResult = ref(false);

const localFilters = reactive({
  name: "",
  departmentId: null,
  status: "",
  startDate: "",
  endDate: "",
});

const columns = computed(() => [
  {
    title: $t("kpiName"),
    dataIndex: "kpiName",
    key: "kpiName",
    width: "15%",
  },
  {
    title: $t("currentProgress"),
    dataIndex: "chart",
    key: "chart",
    width: "10%",
  },
  {
    title: $t("startDate"),
    dataIndex: "startDate",
    key: "startDate",
    width: "7%",
  },
  { title: $t("endDate"), dataIndex: "endDate", key: "endDate", width: "7%" },
  { title: $t("weight"), dataIndex: "weight", key: "weight", width: "6%" },
  {
    title: $t("target"),
    dataIndex: "target",
    key: "target",
    width: "11%",
  },
  {
    title: $t("actual"),
    dataIndex: "actual",
    key: "actual",
    width: "11%",
  },
  {
    title: $t("status"),
    dataIndex: "status",
    key: "status",
    width: "6%",
    align: "center",
    customRender: ({ text }) => $t(`status_chart.${text}`) || text,
  },
  {
    title: $t("action"),
    dataIndex: "action",
    key: "action",
    width: "13%",
    rowClassName: "action-column-cell",
  },
]);

const tableData = (perspectiveGroupRowsArray) => {
  return perspectiveGroupRowsArray;
};

const goToCreateKpi = () => {
  router.push({
    name: "KpiCreateDepartment",
  });
};

const applyFilters = async () => {
  loading.value = true;
  error.value = null;
  isDisplayResult.value = false;

  try {
    const filters = {
      name: localFilters.name,
      perspectiveId: localFilters.perspectiveId,
      startDate: localFilters.startDate,
      endDate: localFilters.endDate,
      status: localFilters.status,
    };
    await store.dispatch("kpis/fetchDepartmentKpis", {
      // departmentId có thể là null/0 cho "All" (đối với admin/manager)
      departmentId:
        localFilters.departmentId === "" ? null : localFilters.departmentId,
      filters,
    });
    isDisplayResult.value = true;
  } catch (err) {
    error.value = err.message || "Failed to fetch KPIs.";
  } finally {
    loading.value = false;
  }
};

const handleCopyKpi = (record) => {
  if (record && record.kpiId) {
    router.push({
      path: "/kpis/create",
      query: {
        templateKpiId: record.kpiId,
      },
    });
  } else {
    notification.warning({
      message: "Không thể sao chép do thiếu thông tin KPI.",
    });
  }
};

const showConfirmDeleteDialog = (assignmentKey, kpiName) => {
  isDeleteModalVisible.value = true;
  selectedKpiId.value = assignmentKey;
  selectedKpiName.value = kpiName;
};

const handleDeleteKpi = async () => {
  if (!selectedKpiId.value) return;

  loading.value = true;

  try {
    notification.success({
      message: `Gán KPI '${selectedKpiName.value}' đã được xóa thành công!`,
    });
    deletedKpiName.value = selectedKpiName.value;

    applyFilters();
  } catch (error) {
    const errorMessage =
      error?.response?.data?.message ||
      error?.message ||
      "Xóa gán KPI thất bại.";
    notification.error({
      message: "Xóa thất bại",
      description: errorMessage,
      duration: 5,
    });
  } finally {
    loading.value = false;
    isDeleteModalVisible.value = false;
    selectedKpiId.value = null;
    selectedKpiName.value = null;
  }
};

const departmentGroups = computed(() => {
  const groupedData = {};
  const displayData = departmentKpiList.value
    ? departmentKpiList.value.data
    : [];
  const allDepartments = store.getters["departments/departmentList"] || [];

  const currentFilterDepartmentId = localFilters.departmentId;

  if (!displayData || displayData.length === 0) {
    return [];
  }

  displayData.forEach((kpi) => {
    if (!kpi || !kpi.assignments) return;

    const kpiDetails = {
      /* ... giữ nguyên logic lấy kpiDetails ... */ kpiId: kpi.id,
      kpiName: kpi.name,
      kpiUnit: kpi.unit || "",
      kpiStartDate: kpi.start_date,
      kpiEndDate: kpi.end_date,
      kpiWeight: kpi.weight,
      kpiStatus: kpi.status,
      kpiTarget: kpi.target,
      perspectiveId: kpi.perspective_id,
      perspectiveName: kpi.perspective ? kpi.perspective.name : "Uncategorized",
    };

    kpi.assignments.forEach((assignment) => {
      const assignmentDepartmentId =
        assignment.assigned_to_department || assignment.section?.department_id;

      if (!assignmentDepartmentId) {
        console.warn(
          "LOG (WARN): Assignment không xác định được Department ID:",
          assignment
        );
        return;
      }

      if (currentFilterDepartmentId && currentFilterDepartmentId !== "") {
        const filterIdNumber = parseInt(currentFilterDepartmentId, 10);
        if (
          !isNaN(filterIdNumber) &&
          assignmentDepartmentId !== filterIdNumber
        ) {
          return;
        }
      }

      const assignedDepartment = allDepartments.find(
        (d) => d.id === assignmentDepartmentId
      );

      if (!assignedDepartment) {
        console.warn(
          `LOG (WARN): Không tìm thấy thông tin Department ID ${assignmentDepartmentId} trong danh sách department:`,
          assignment
        );
        return;
      }

      const departmentName = assignedDepartment.name;
      const perspectiveKey = `${kpiDetails.perspectiveId}. ${kpiDetails.perspectiveName}`;

      if (!groupedData[assignmentDepartmentId]) {
        groupedData[assignmentDepartmentId] = {
          department: departmentName,
          data: {},
          actualSum: 0,
        };
      }

      if (!groupedData[assignmentDepartmentId].data[perspectiveKey]) {
        groupedData[assignmentDepartmentId].data[perspectiveKey] = [];
      }

      let assignToDisplay = departmentName;
      if (assignment.assigned_to_section && assignment.section) {
        assignToDisplay = assignment.section.name;
      } else if (assignment.assigned_to_employee && assignment.employee) {
        assignToDisplay = assignment.employee.name;
      }

      // Use the aggregated actual_value from the KPI for the actual field
      const actualValue =
        kpi.actual_value !== undefined && kpi.actual_value !== null
          ? parseFloat(kpi.actual_value) || 0
          : 0;

      const rowData = {
        key: `assignment-${assignment.id}`,
        departmentId: assignmentDepartmentId,
        kpiId: kpiDetails.kpiId,
        kpiName: kpiDetails.kpiName,
        perspectiveName: kpiDetails.perspectiveName,
        assignTo: assignToDisplay,
        startDate: kpiDetails.kpiStartDate,
        endDate: kpiDetails.kpiEndDate,
        weight: kpiDetails.kpiWeight,
        target: assignment.targetValue || "0",
        actual: actualValue.toString(),
        unit: kpiDetails.kpiUnit,
        status: assignment.status || "Unknown",
      };

      groupedData[assignmentDepartmentId].data[perspectiveKey].push(rowData);

      groupedData[assignmentDepartmentId].actualSum += actualValue;
    });
  });

  const finalGroupedArray = Object.values(groupedData).map((deptGroup) => {
    const sortedPerspectives = Object.keys(deptGroup.data)
      .sort()
      .reduce((sortedMap, perspectiveKey) => {
        sortedMap[perspectiveKey] = deptGroup.data[perspectiveKey];
        return sortedMap;
      }, {});

    // Update actualSum to sum of kpi.actual_value for KPIs in this department group
    const actualSum = Object.values(deptGroup.data)
      .flat()
      .reduce((sum, row) => {
        // row.actual is string, convert to float
        const actualVal = parseFloat(row.actual) || 0;
        return sum + actualVal;
      }, 0);

    return {
      department: deptGroup.department,
      data: sortedPerspectives,
      actualSum: actualSum,
    };
  });

  finalGroupedArray.sort((a, b) => a.department.localeCompare(b.department));

  return finalGroupedArray;
});

const rowClassName = (record) => {
  return record.isParent ? "row-parent" : "";
};

const getStatusColor = (status) => {
  return status === KpiDefinitionStatus.APPROVED ? "success" : "red";
};

watch(
  departmentGroups,
  (newGroups) => {
    const keys = [];
    if (Array.isArray(newGroups)) {
      newGroups.forEach((departmentItem, departmentIndex) => {
        if (
          departmentItem &&
          typeof departmentItem.data === "object" &&
          departmentItem.data !== null
        ) {
          Object.keys(departmentItem.data).forEach((perspectiveKey) => {
            const panelKey = `pers-${departmentIndex}-${perspectiveKey}`;
            keys.push(panelKey);
          });
        }
      });
    }
    activePanelKeys.value = keys;
  },
  {
    immediate: true,
    deep: true,
  }
);

onMounted(async () => {
  try {
    const initialLoading = ref(true);
    await store.dispatch("departments/fetchDepartments");
    if (isDepartmentUser.value && currentUser.value?.departmentId) {
      localFilters.departmentId = currentUser.value.departmentId;
    } else {
      // Admin/Manager
      localFilters.departmentId = null; // Mặc định "All Departments"
    }
    await applyFilters(); // Tải dữ liệu KPI ban đầu
    initialLoading.value = false;
  } catch (err) {
    console.error("Failed to fetch departments:", err);
    notification.error({ message: "Failed to load department list." });
  }
});
</script>

<style scoped></style>
