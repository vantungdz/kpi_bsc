<template>
  <div class="kpi-department-list-page">
    <div class="list-header-modern">
      <schedule-outlined class="header-icon" />
      <div class="header-title-group">
        <h2>{{ $t("departmentKpiList") }}</h2>
        <div class="header-desc">
          {{ $t("departmentKpiListDesc") || $t("departmentKpiList") }}
        </div>
      </div>
      <div class="action-buttons right-align" v-if="canCreateDepartmentKpi">
        <a-button type="primary" @click="goToCreateKpi">
          <plus-outlined /> {{ $t("createNewKpi") }}
        </a-button>
      </div>
    </div>
    <a-card class="filter-card-modern">
      <a-form layout="vertical" class="filter-form-modern">
        <a-row :gutter="[16, 0]" align="middle" style="flex-wrap: wrap">
          <a-col :span="6">
            <a-form-item :label="$t('search')" class="filter-label-top">
              <a-input
                v-model:value="localFilters.name"
                :placeholder="$t('kpiNamePlaceholder')"
                @pressEnter="applyFilters"
                allow-clear
                size="middle"
              >
                <template #prefix><schedule-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="5" v-if="canAssignKpiCompany">
            <a-form-item :label="$t('department')" class="filter-label-top">
              <a-select
                v-model:value="localFilters.departmentId"
                style="width: 100%"
                allow-clear
                size="middle"
                @change="applyFilters"
              >
                <template #suffixIcon><team-outlined /></template>
                <a-select-option :value="null">{{
                  $t("allDepartments")
                }}</a-select-option>
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
            <a-form-item :label="$t('startDate')" class="filter-label-top">
              <a-date-picker
                v-model:value="localFilters.startDate"
                style="width: 100%"
                allow-clear
                size="middle"
                @change="applyFilters"
              />
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item :label="$t('endDate')" class="filter-label-top">
              <a-date-picker
                v-model:value="localFilters.endDate"
                style="width: 100%"
                allow-clear
                size="middle"
                @change="applyFilters"
              />
            </a-form-item>
          </a-col>
          <a-col
            :span="5"
            style="display: flex; align-items: flex-end; height: 100%"
          >
            <div class="filter-btn-group">
              <a-button type="primary" @click="applyFilters" size="middle">{{
                $t("apply")
              }}</a-button>
              <a-button
                @click="
                  () => {
                    localFilters.name = '';
                    localFilters.departmentId = null;
                    localFilters.startDate = '';
                    localFilters.endDate = '';
                    applyFilters();
                  }
                "
                size="middle"
                >{{ $t("reset") }}</a-button
              >
            </div>
          </a-col>
        </a-row>
      </a-form>
    </a-card>
    <a-alert v-if="loading" type="info" :message="$t('loadingKpis')" show-icon>
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
    <div class="kpi-list-scroll">
      <div class="data-container">
        <div
          v-for="(departmentItem, departmentIndex) in departmentGroups"
          :key="'dept-' + departmentIndex"
          class="mb-8"
        >
          <h4
            style="margin-top: 10px"
            class="text-lg font-bold mb-2 department-header-modern"
          >
            {{ $t("departmentHeader", { name: departmentItem.department }) }}
          </h4>
          <a-collapse
            v-model:activeKey="activePanelKeys"
            expandIconPosition="end"
            class="kpi-collapse-modern"
            @change="onCollapseChange"
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
                class="kpi-table-modern department-table-modern"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'kpiName'">
                    <span class="kpi-name">{{ record.kpiName }}</span>
                  </template>
                  <template v-else-if="column.dataIndex === 'chart'">
                    <ApexChart
                      :key="chartKey"
                      type="donut"
                      width="120px"
                      height="100"
                      :options="{
                        chart: { height: 100, type: 'donut' },
                        labels: [$t('actual'), $t('remaining')],
                        colors: ['#008FFB', '#B9E5FF'],
                        dataLabels: {
                          enabled: true,
                          formatter: function (val, opts) {
                            const seriesIndex = opts.seriesIndex;
                            const actual = parseFloat(opts.w.config.series[0]);
                            const remaining = parseFloat(
                              opts.w.config.series[1]
                            );
                            const target = actual + remaining;

                            if (!target || isNaN(target)) return '--';

                            if (seriesIndex === 0) {
                              // Actual slice - show actual percentage
                              if (!actual || isNaN(actual)) return '0%';
                              let percent = Math.round((actual / target) * 100);
                              if (percent > 100) percent = 100;
                              if (percent < 0) percent = 0;
                              return percent + '%';
                            } else {
                              // Remaining slice - show remaining percentage
                              if (!remaining || isNaN(remaining)) return '0%';
                              let percent = Math.round(
                                (remaining / target) * 100
                              );
                              if (percent > 100) percent = 100;
                              if (percent < 0) percent = 0;
                              return percent + '%';
                            }
                          },
                          style: {
                            fontSize: '12px',
                            colors: ['black'],
                          },
                        },
                        legend: { show: false },
                      }"
                      :series="[
                        parseFloat(record.actual) &&
                        parseFloat(record.actual) > 0
                          ? parseFloat(record.actual)
                          : 0,
                        parseFloat(record.target) &&
                        parseFloat(record.target) > 0
                          ? Math.max(
                              parseFloat(record.target) -
                                parseFloat(record.actual),
                              0
                            )
                          : 0,
                      ]"
                    />
                  </template>
                  <template v-else-if="column.dataIndex === 'startDate'">
                    <span class="kpi-date">{{ record.startDate }}</span>
                  </template>
                  <template v-else-if="column.dataIndex === 'endDate'">
                    <span class="kpi-date">{{ record.endDate }}</span>
                  </template>
                  <template v-else-if="column.dataIndex === 'weight'">
                    <span>{{ record.weight }}</span>
                  </template>
                  <template v-else-if="column.dataIndex === 'target'">
                    <span class="kpi-value">{{
                      `${Number(record.target).toLocaleString()} ${record.unit}`
                    }}</span>
                  </template>
                  <template v-else-if="column.dataIndex === 'actual'">
                    <span class="kpi-value kpi-actual">{{
                      `${Number(record.actual).toLocaleString()} ${record.unit}`
                    }}</span>
                  </template>
                  <template v-else-if="column.dataIndex === 'status'">
                    <a-tag
                      :bordered="false"
                      :color="getStatusColor(record.status)"
                      class="goal-status-tag"
                    >
                      {{ $t("status_chart." + record.status) || record.status }}
                    </a-tag>
                  </template>
                  <template v-else-if="column.dataIndex === 'validityStatus'">
                    <a-tag
                      :color="
                        validityStatusColor[record.validityStatus] || 'default'
                      "
                    >
                      {{
                        $t("validityStatus." + record.validityStatus) ||
                        record.validityStatus
                      }}
                    </a-tag>
                  </template>
                  <template v-else-if="column.dataIndex === 'action'">
                    <div style="text-align: center">
                      <a-tooltip :title="$t('viewDetails')">
                        <a-button
                          type="default"
                          class="kpi-actions-button"
                          @click="
                            $router.push({
                              name: 'KpiDetail',
                              params: { id: record.kpiId },
                              query: {
                                contextDepartmentId: record.departmentId,
                              },
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
                    </div>
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
            <p>
              {{ $t("confirmDeleteAssignment", { name: selectedKpiName }) }}
            </p>
          </a-modal>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, onUnmounted, ref, watch, h } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
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
  Card as ACard,
} from "ant-design-vue";
import {
  TeamOutlined,
  ScheduleOutlined,
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
} from "@ant-design/icons-vue";
import { notification } from "ant-design-vue";
import dayjs from "dayjs";
import { KpiDefinitionStatus } from "@/core/constants/kpiStatus";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
  SCOPES,
} from "@/core/constants/rbac.constants";

const store = useStore();
const router = useRouter();
const { t: $t } = useI18n();

const currentUser = computed(() => store.getters["auth/currentUser"]);
const loading = computed(() => store.getters["kpis/isLoading"]);
const error = computed(() => store.getters["kpis/error"]);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const departmentKpiList = computed(
  () => store.getters["kpis/departmentKpiList"] || []
);

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);
function hasPermission(action, resource, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action === action &&
      p.resource === resource &&
      (scope ? p.scope === scope : true)
  );
}
const canCreateDepartmentKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI, SCOPES.DEPARTMENT)
);
const canCopyDepartmentKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.COPY_TEMPLATE, RBAC_RESOURCES.KPI, SCOPES.COMPANY)
);

const canDeleteDepartmentKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.DELETE, RBAC_RESOURCES.KPI, SCOPES.COMPANY)
);

const canAssignKpiCompany = computed(() =>
  hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI, SCOPES.COMPANY)
);

// Check if user can only view department-level KPIs (not company-level)
const isDepartmentUser = computed(() => {
  // If user has company assign permission, they can see all departments
  if (canAssignKpiCompany.value) return false;

  // If user has department view permission but no company assign permission
  const hasDepartmentView = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI,
    SCOPES.DEPARTMENT
  );
  const hasCompanyView = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI,
    SCOPES.COMPANY
  );

  // User is department-level if they have department view but no company assign/view
  return hasDepartmentView && !hasCompanyView;
});

const activePanelKeys = ref([]);
const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
const isDisplayResult = ref(false);
const chartKey = ref(0);

const localFilters = reactive({
  name: "",
  departmentId: null,
  status: "",
  startDate: "",
  endDate: "",
});

const validityStatusColor = {
  active: "green",
  expiring_soon: "orange",
  expired: "red",
  not_started: "blue",
};

const renderProgress = (record) => {
  const actual = parseFloat(record.actual);
  const target = parseFloat(record.target);
  if (!target || isNaN(target)) return "--";
  if (!actual || isNaN(actual)) return "0%";
  let percent = Math.round((actual / target) * 100);
  if (percent > 100) percent = 100;
  if (percent < 0) percent = 0;
  return `${percent}%`;
};

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
    customRender: ({ record }) => renderProgress(record),
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
    width: "10%",
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
    title: $t("validityStatus.name"),
    dataIndex: "validityStatus",
    key: "validityStatus",
    width: "8%",
    align: "center",
    customRender: ({ text }) => {
      return h(
        ATag,
        { color: validityStatusColor[text] || "default" },
        () => $t(`validityStatus.${text}`) || text
      );
    },
  },
  {
    title: $t("common.actions"),
    dataIndex: "action",
    key: "action",
    width: "15%",
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
      ...(localFilters.name && { name: localFilters.name }),
      ...(localFilters.perspectiveId && {
        perspectiveId: localFilters.perspectiveId,
      }),
      ...(localFilters.startDate && {
        start_date: dayjs(localFilters.startDate).format("YYYY-MM-DD"),
      }),
      ...(localFilters.endDate && {
        end_date: dayjs(localFilters.endDate).format("YYYY-MM-DD"),
      }),
      ...(localFilters.status && { status: localFilters.status }),
    };
    await store.dispatch("kpis/fetchDepartmentKpis", {
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
      message: "Cannot copy due to missing KPI information.",
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
      "Failed to delete KPI assignment.";
    notification.error({
      message: "Delete failed",
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

const onCollapseChange = () => {
  // Whenever the collapse state changes (open or close),
  // we increment the chart's key. This forces a redraw.
  chartKey.value++;
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
          "LOG (WARN): Assignment could not determine Department ID:",
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

      // Check if this KPI already exists in this department/perspective
      const existingKpiIndex = groupedData[assignmentDepartmentId].data[
        perspectiveKey
      ].findIndex((item) => item.kpiId === kpiDetails.kpiId);

      if (existingKpiIndex === -1) {
        // KPI doesn't exist yet, add it
        const rowData = {
          key: `kpi-${kpiDetails.kpiId}-${assignmentDepartmentId}`,
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
          validityStatus: kpi.validityStatus || "active",
        };

        groupedData[assignmentDepartmentId].data[perspectiveKey].push(rowData);
        groupedData[assignmentDepartmentId].actualSum += actualValue;
      } else {
        // KPI already exists, update the assignTo field to show multiple assignments
        const existingRow =
          groupedData[assignmentDepartmentId].data[perspectiveKey][
            existingKpiIndex
          ];
        if (existingRow.assignTo !== assignToDisplay) {
          existingRow.assignTo += `, ${assignToDisplay}`;
        }
        // Don't add actualValue again since it's already counted
      }
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
    document.body.classList.add("no-outer-scroll");
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

onUnmounted(() => {
  document.body.classList.remove("no-outer-scroll");
});
</script>

<style scoped>
/* .kpi-department-list-page {
  padding: 24px;
  background: #f6f8fa;
  min-height: 100vh;
} */

.kpi-department-list-page {
  /* padding: 24px; */
  background: #f6f8fa;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kpi-list-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

:deep(.kpi-list-scroll .ant-table-thead th) {
  position: sticky;
  top: 0;
  z-index: 2;
}

.data-container {
  overflow: visible !important;
  height: auto !important;
  min-height: 0;
}

.list-header-modern {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 18px;
  justify-content: flex-start;
  position: relative;
}
.header-icon {
  font-size: 32px;
  color: #2563eb;
  background: #e0e7ff;
  border-radius: 50%;
  padding: 8px;
}
.header-title-group {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.header-desc {
  color: #64748b;
  font-size: 15px;
  margin-top: 2px;
}
.action-buttons.right-align {
  margin-left: auto;
  display: flex;
  align-items: center;
  position: absolute;
  right: 0;
  top: 0;
}
.filter-form-modern {
  margin-bottom: 0;
}
.filter-label-top .ant-form-item-label {
  display: block;
  text-align: left !important;
  margin-bottom: 4px;
  font-weight: 500;
  color: #334155;
  font-size: 15px;
}
.filter-card-modern {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 18px;
  padding: 10px 18px 2px 18px;
}
.filter-btn-group {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 40px;
}
@media (max-width: 1200px) {
  .filter-btn-group {
    flex-direction: column;
    align-items: flex-start;
    height: auto;
    gap: 4px;
  }
}
.kpi-table-modern {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 0;
}
.department-table-modern {
  margin-bottom: 0;
}
.kpi-row-hover:hover {
  background: #f0fdfa !important;
  cursor: pointer;
}
.kpi-value {
  font-weight: 500;
  color: #2563eb;
}
.kpi-actual {
  color: #059669;
}
.kpi-date {
  color: #64748b;
  font-size: 13px;
}
.kpi-name {
  font-weight: 500;
  color: #0f172a;
}
.goal-status-tag {
  font-weight: 500;
  font-size: 13px;
  padding: 0 10px;
  border-radius: 8px;
}
.kpi-actions-button {
  border-radius: 6px;
}
.kpi-collapse-modern {
  background: #f9fafb;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 18px;
}
.department-header-modern {
  color: #2563eb;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

:deep(.kpi-list-scroll .ant-table-body),
:deep(.kpi-list-scroll .ant-table-content),
:deep(.kpi-list-scroll .ant-table-container),
:deep(.kpi-list-scroll .ant-table-header) {
  overflow: visible !important;
  max-height: none !important;
}

:deep(.kpi-list-scroll .ant-collapse-content-box) {
  overflow: visible;
}

:deep(.ant-card-body) {
  padding: 0 !important;
}

.kpi-list-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
</style>
