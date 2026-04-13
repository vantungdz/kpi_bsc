<template>
  <div class="kpi-department-list-page">
    <div class="list-header-modern">
      <bank-outlined class="header-icon" />
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
          <a-col :span="canAssignKpiCompany ? 8 : 12">
            <a-form-item :label="$t('search')" class="filter-label-top">
              <a-input
                v-model:value="localFilters.name"
                :placeholder="$t('kpiNamePlaceholder')"
                allow-clear
                size="small"
              >
                <template #prefix><schedule-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="8" v-if="canAssignKpiCompany">
            <a-form-item :label="$t('department')" class="filter-label-top">
              <a-select
                v-model:value="localFilters.departmentId"
                style="width: 100%"
                allow-clear
                size="small"
              >
                <template #suffixIcon><apartment-outlined /></template>
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
          <a-col :span="canAssignKpiCompany ? 8 : 12">
            <a-form-item :label="' '" class="filter-label-top">
              <div class="filter-btn-group">
                <a-button type="primary" @click="applyFilters" size="small">{{
                  $t("apply")
                }}</a-button>
                <a-button @click="resetFilters" size="small">{{ $t("reset") }}</a-button>
              </div>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>
    <LoadingOverlay :visible="loading" />
    <a-alert
      v-if="!loading && error"
      type="error"
      :message="error"
      show-icon
      closable
    />
    <a-alert
      v-if="!loading && isDisplayResult && departmentGroups.length === 0"
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
      <div v-if="!loading" class="data-container">
        <div
          v-for="(departmentItem, departmentIndex) in departmentGroups"
          :key="'dept-' + departmentIndex"
          class="mb-8"
        >
          <h4
            style="margin-top: 10px"
            class="text-base font-bold mb-1.5 department-header-modern"
          >
            {{ $t("departmentHeader", { name: departmentItem.department }) }}
          </h4>
          <a-collapse
            v-model:activeKey="activePanelKeys"
            expandIconPosition="end"
            class="kpi-collapse-modern"
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
                    <div style="text-align: center">
                      <a-progress
                        v-if="
                          listKpiProgressTarget(record) != null &&
                          listKpiProgressTarget(record) !== 0 &&
                          listKpiProgressActual(record) != null
                        "
                        :percent="
                          calculateListKpiProgress(
                            listKpiProgressActual(record),
                            listKpiProgressTarget(record),
                          )
                        "
                        size="small"
                        status="active"
                        :strokeColor="{ from: '#108ee9', to: '#87d068' }"
                        style="width: 90px; margin: 0 auto"
                      />
                      <span v-else> - </span>
                    </div>
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
                    <a-space>
                      <a-tooltip :title="$t('viewDetails')">
                        <a-button
                          type="primary"
                          ghost
                          shape="circle"
                          size="small"
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
                          <eye-outlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip
                        v-if="canEditDepartmentKpi"
                        :title="$t('edit')"
                      >
                        <a-button
                          type="primary"
                          ghost
                          shape="circle"
                          size="small"
                          @click="handleEditKpi(record)"
                          :disabled="
                            record.status !== KpiDefinitionStatus.DRAFT
                          "
                        >
                          <edit-outlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip
                        v-if="canCopyDepartmentKpi"
                        :title="$t('copyKpi')"
                      >
                        <a-button
                          type="primary"
                          ghost
                          shape="circle"
                          size="small"
                          @click="handleCopyKpi(record)"
                        >
                          <copy-outlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip
                        v-if="canDeleteDepartmentKpi"
                        :title="$t('deleteKpi')"
                      >
                        <a-button
                          danger
                          shape="circle"
                          size="small"
                          @click="
                            showConfirmDeleteDialog(record.key, record.kpiName)
                          "
                        >
                          <delete-outlined />
                        </a-button>
                      </a-tooltip>
                    </a-space>
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
  Row as ARow,
  Col as ACol,
  FormItem as AFormItem,
  Alert as AAlert,
  Collapse as ACollapse,
  CollapsePanel as ACollapsePanel,
  Table as ATable,
  Tag as ATag,
  Card as ACard,
} from "ant-design-vue";
import {
  ScheduleOutlined,
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
  EyeOutlined,
  ApartmentOutlined,
  BankOutlined,
} from "@ant-design/icons-vue";
import { notification } from "ant-design-vue";
import dayjs from "dayjs";
import { KpiDefinitionStatus, KpiDefinitionStatusColor } from "@/core/constants/kpiStatus";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
  SCOPES,
} from "@/core/constants/rbac.constants";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { getReviewCycles } from "@/core/services/kpiReviewApi";
import {
  pickReviewCycleIdFromStore,
  syncLocalReviewCycleFromStore,
} from "@/core/composables/useReviewCycleGlobalSync";

const store = useStore();
const router = useRouter();
const { t: $t } = useI18n();

const currentUser = computed(
  () => store.getters["auth/currentUser"] || store.getters["auth/user"],
);
const loading = computed(() => store.getters["kpis/isLoading"]);
const error = computed(() => store.getters["kpis/error"]);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || [],
);
const departmentKpiList = computed(
  () => store.getters["kpis/departmentKpiList"] || [],
);

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || [],
);
function hasPermission(action, resource, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action === action &&
      p.resource === resource &&
      (scope ? p.scope === scope : true),
  );
}
const canCreateDepartmentKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI, SCOPES.DEPARTMENT),
);
const canEditDepartmentKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.UPDATE, RBAC_RESOURCES.KPI, SCOPES.DEPARTMENT),
);
const canCopyDepartmentKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.COPY_TEMPLATE, RBAC_RESOURCES.KPI, SCOPES.COMPANY),
);

const canDeleteDepartmentKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.DELETE, RBAC_RESOURCES.KPI, SCOPES.COMPANY),
);

const canAssignKpiCompany = computed(() =>
  hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI, SCOPES.COMPANY),
);

// Check if user can only view department-level KPIs (not company-level)
const isDepartmentUser = computed(() => {
  // If user has company assign permission, they can see all departments
  if (canAssignKpiCompany.value) return false;

  // If user has department view permission but no company assign permission
  const hasDepartmentView = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI,
    SCOPES.DEPARTMENT,
  );
  const hasCompanyView = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI,
    SCOPES.COMPANY,
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
const localFilters = reactive({
  name: "",
  departmentId: null,
  status: "",
  reviewCycleId: null,
});
// Applied filters - chỉ filter khi đã click Apply
const appliedFilters = reactive({
  name: "",
  departmentId: null,
  status: "",
  reviewCycleId: null,
});
const reviewCycles = ref([]);

const validityStatusColor = {
  active: "green",
  expiring_soon: "orange",
  expired: "red",
  not_started: "blue",
};

/** Same progress semantics as KpiPersonal.vue (a-progress bar). */
const listKpiProgressActual = (record) => {
  const v = record?.actual;
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const listKpiProgressTarget = (record) => {
  const v = record?.target;
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const calculateListKpiProgress = (current, target) => {
  const currentValue = parseFloat(current);
  const targetValue = parseFloat(target);
  if (
    isNaN(currentValue) ||
    isNaN(targetValue) ||
    targetValue === 0
  ) {
    return 0;
  }
  const percent = (currentValue / targetValue) * 100;
  return parseFloat(Math.min(percent, 100).toFixed(2));
};

const renderProgress = (record) => {
  const actual = listKpiProgressActual(record);
  const target = listKpiProgressTarget(record);
  if (target == null || target === 0 || actual == null) return "--";
  return `${Math.round(calculateListKpiProgress(actual, target))}%`;
};

const columns = computed(() => [
  {
    title: $t("kpiName"),
    dataIndex: "kpiName",
    key: "kpiName",
    width: "22%",
  },
  {
    title: $t("currentProgress"),
    dataIndex: "chart",
    key: "chart",
    width: "12%",
    align: "center",
    customRender: ({ record }) => renderProgress(record),
  },
  { title: $t("weight"), dataIndex: "weight", key: "weight", width: "8%" },
  {
    title: $t("target"),
    dataIndex: "target",
    key: "target",
    width: "12%",
  },
  {
    title: $t("actual"),
    dataIndex: "actual",
    key: "actual",
    width: "12%",
  },
  {
    title: $t("status"),
    dataIndex: "status",
    key: "status",
    width: "10%",
    align: "center",
    customRender: ({ text }) => $t(`status_chart.${text}`) || text,
  },
  {
    title: $t("validityStatus.name"),
    dataIndex: "validityStatus",
    key: "validityStatus",
    width: "12%",
    align: "center",
    customRender: ({ text }) => {
      return h(
        ATag,
        { color: validityStatusColor[text] || "default" },
        () => $t(`validityStatus.${text}`) || text,
      );
    },
  },
  {
    title: $t("common.actions"),
    dataIndex: "action",
    key: "action",
    width: 120,
    fixed: "right",
    align: "center",
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

function defaultReviewCycleIdFromList() {
  const cycles = reviewCycles.value;
  if (!cycles?.length) return null;
  const today = dayjs().startOf("day");
  const currentCycle = cycles.find((cycle) => {
    const startDate = dayjs(cycle.startDate).startOf("day");
    const endDate = dayjs(cycle.endDate).startOf("day");
    return (
      (today.isAfter(startDate, "day") || today.isSame(startDate, "day")) &&
      (today.isBefore(endDate, "day") || today.isSame(endDate, "day"))
    );
  });
  return currentCycle?.id ?? null;
}

const resetFilters = () => {
  localFilters.name = "";
  localFilters.departmentId = null;
  localFilters.status = "";
  localFilters.reviewCycleId =
    pickReviewCycleIdFromStore(store, reviewCycles.value) ??
    defaultReviewCycleIdFromList();
  applyFilters();
};

const applyFilters = async () => {
  loading.value = true;
  error.value = null;
  isDisplayResult.value = false;

  try {
    // Copy localFilters vào appliedFilters trước khi gọi API
    appliedFilters.name = localFilters.name;
    appliedFilters.departmentId = localFilters.departmentId;
    appliedFilters.status = localFilters.status;
    appliedFilters.reviewCycleId = localFilters.reviewCycleId;

    const filters = {
      ...(localFilters.name && { name: localFilters.name }),
      ...(localFilters.perspectiveId && {
        perspectiveId: localFilters.perspectiveId,
      }),
      ...(localFilters.status && { status: localFilters.status }),
    };

    // Get start_date and end_date from selected review cycle
    if (localFilters.reviewCycleId) {
      const selectedCycle = reviewCycles.value.find(
        (c) => c.id === localFilters.reviewCycleId,
      );
      if (selectedCycle) {
        filters.start_date = dayjs(selectedCycle.startDate).format(
          "YYYY-MM-DD",
        );
        filters.end_date = dayjs(selectedCycle.endDate).format("YYYY-MM-DD");
      }
    }

    await store.dispatch("kpis/fetchDepartmentKpis", {
      departmentId:
        localFilters.departmentId === "" ? null : localFilters.departmentId,
      filters,
    });
  } catch (err) {
    error.value = err.message || "Failed to fetch KPIs.";
  } finally {
    loading.value = false;
    isDisplayResult.value = true;
  }
};

syncLocalReviewCycleFromStore(store, {
  cyclesRef: reviewCycles,
  getLocalCycleId: () => localFilters.reviewCycleId,
  setLocalCycleId: (id) => {
    localFilters.reviewCycleId = id;
  },
  apply: applyFilters,
});

const fetchReviewCycles = async () => {
  try {
    const cycles = await getReviewCycles();
    reviewCycles.value = cycles;

    const fromStore = pickReviewCycleIdFromStore(store, cycles);
    if (fromStore != null) {
      localFilters.reviewCycleId = fromStore;
    } else if (cycles && cycles.length > 0 && !localFilters.reviewCycleId) {
    // Tự động chọn chu kì mà ngày hiện tại nằm trong khoảng thời gian
    // Chỉ set giá trị, không gọi API - API chỉ được gọi khi click button Apply
      const today = dayjs().startOf("day");
      const currentCycle = cycles.find((cycle) => {
        const startDate = dayjs(cycle.startDate).startOf("day");
        const endDate = dayjs(cycle.endDate).startOf("day");
        return (
          (today.isAfter(startDate, "day") || today.isSame(startDate, "day")) &&
          (today.isBefore(endDate, "day") || today.isSame(endDate, "day"))
        );
      });

      if (currentCycle) {
        localFilters.reviewCycleId = currentCycle.id;
      }
    }
  } catch (error) {
    console.error("Error fetching review cycles:", error);
    notification.error({
      message: "Failed to load review cycles",
    });
  }
};

const handleEditKpi = (record) => {
  if (record && record.kpiId) {
    router.push({
      name: "KpiCreateDepartment",
      query: {
        templateKpiId: String(record.kpiId),
        contextDepartmentId: record.departmentId,
      },
    });
  } else {
    notification.warning({
      message: "Cannot edit due to missing KPI information.",
    });
  }
};

const handleCopyKpi = (record) => {
  if (record && record.kpiId) {
    router.push({
      name: "KpiCreateDepartment",
      query: {
        templateKpiId: record.kpiId,
        contextDepartmentId: record.departmentId,
        isCopy: true,
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

  // Extract kpiId from the key format: "kpi-{kpiId}-{departmentId}"
  const keyParts = selectedKpiId.value.split("-");
  const kpiId = keyParts[1]; // Get the kpiId from the key

  if (!kpiId) {
    notification.error({
      message: "Delete failed",
      description: "Invalid KPI ID",
      duration: 5,
    });
    isDeleteModalVisible.value = false;
    return;
  }

  try {
    // Call the store action to delete the KPI
    await store.dispatch("kpis/deleteKpi", kpiId);

    deletedKpiName.value = selectedKpiName.value;

    // Reload the list after successful deletion
    await applyFilters();
  } catch (error) {
    // Error handling is already done in the store action
    // Just log here for debugging
    console.error("Error deleting KPI:", error);
  } finally {
    isDeleteModalVisible.value = false;
    selectedKpiId.value = null;
    selectedKpiName.value = null;
  }
};

const departmentGroups = computed(() => {
  // Don't display data when loading or no results yet
  if (loading.value || !isDisplayResult.value) {
    return [];
  }

  const groupedData = {};
  const displayData = departmentKpiList.value
    ? departmentKpiList.value.data.filter((item) => {
      if (item.status === KpiDefinitionStatus.DRAFT) {
          return item.created_by_type === "department" && item.created_by === currentUser.value.id;
        }
        return true;
    })
    : [];
  const allDepartments = store.getters["departments/departmentList"] || [];

  const currentFilterDepartmentId = appliedFilters.departmentId;

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
          assignment,
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
        (d) => d.id === assignmentDepartmentId,
      );

      if (!assignedDepartment) {
        console.warn(
          `LOG (WARN): Không tìm thấy thông tin Department ID ${assignmentDepartmentId} trong danh sách department:`,
          assignment,
        );
        return;
      }

      const departmentName = assignedDepartment.name;
      const departmentSortOrder = assignedDepartment.sort_order ?? 9999;
      const perspectiveKey = `${kpiDetails.perspectiveId}. ${kpiDetails.perspectiveName}`;

      if (!groupedData[assignmentDepartmentId]) {
        groupedData[assignmentDepartmentId] = {
          department: departmentName,
          departmentSortOrder: departmentSortOrder,
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
          status: kpiDetails.kpiStatus || kpi.status || "Unknown",
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
      departmentSortOrder: deptGroup.departmentSortOrder,
      data: sortedPerspectives,
      actualSum: actualSum,
    };
  });

  // Sort by sort_order instead of name
  finalGroupedArray.sort((a, b) => {
    const orderA = a.departmentSortOrder ?? 9999;
    const orderB = b.departmentSortOrder ?? 9999;
    return orderA - orderB;
  });

  return finalGroupedArray;
});

const rowClassName = (record) => {
  return record.isParent ? "row-parent" : "";
};

const getStatusColor = (status) => {
  return KpiDefinitionStatusColor[status] || "default";
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
  },
);

onMounted(async () => {
  try {
    document.body.classList.add("no-outer-scroll");
    await Promise.all([
      fetchReviewCycles(),
      store.dispatch("departments/fetchDepartments"),
    ]);
    if (isDepartmentUser.value && currentUser.value?.departmentId) {
      localFilters.departmentId = currentUser.value.departmentId;
    } else {
      // Admin/Manager
      localFilters.departmentId = null; // Mặc định "All Departments"
    }
    await applyFilters(); // Load initial KPI data
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
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
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
