<template>
  <div class="kpi-company-list-page">
    <div class="list-header-modern">
      <global-outlined class="header-icon" />
      <div class="header-title-group">
        <h2>{{ $t("companyKpiList") }}</h2>
        <div class="header-desc">
          {{ $t("companyKpiListDesc") || $t("companyKpiList") }}
        </div>
      </div>
      <div class="action-buttons right-align">
        <a-button
          type="primary"
          @click="goToCreateKpi"
          v-if="canCreateCompanyKpiCompany"
        >
          <plus-outlined /> {{ $t("createNewKpi") }}
        </a-button>
      </div>
    </div>
    <a-card class="filter-card-modern">
      <a-form layout="vertical" class="filter-form-modern">
        <a-row :gutter="[16, 0]" align="middle" style="flex-wrap: wrap">
          <a-col :span="8">
            <a-form-item :label="$t('search')" class="filter-label-top">
              <a-input
                :placeholder="$t('kpiNamePlaceholder')"
                v-model:value="localFilters.name"
                allow-clear
                size="small"
              >
                <template #prefix><schedule-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('department')" class="filter-label-top">
              <a-select
                v-model:value="localFilters.departmentId"
                style="width: 100%"
                allow-clear
                size="small"
              >
                <template #suffixIcon><apartment-outlined /></template>
                <a-select-option value="">{{ $t("all") }}</a-select-option>
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
          <a-col :span="8">
            <a-form-item :label="' '" class="filter-label-top">
              <div class="filter-btn-group">
                <a-button type="primary" @click="applyFilters" size="middle">{{
                  $t("apply")
                }}</a-button>
                <a-button @click="resetFilters" size="middle">{{ $t("reset") }}</a-button>
              </div>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>
    <LoadingOverlay :visible="loading" />
    <a-alert
      v-if="!loading && error"
      :message="error"
      type="error"
      show-icon
      closable
    />
    <a-alert
      v-if="!loading && kpis.length === 0"
      :message="$t('noKpisFound')"
      type="warning"
      show-icon
      closable
    />
    <a-alert
      v-if="deletedKpiName"
      :message="$t('kpiDeleted', { name: deletedKpiName })"
      type="success"
      closable
      @close="deletedKpiName = null"
      show-icon
    />
    <a-alert
      v-if="toggleStatusError"
      :message="$t('toggleStatusError')"
      :description="toggleStatusError"
      type="error"
      show-icon
      closable
      @close="clearToggleError"
      style="margin-top: 10px"
    />
    <div class="kpi-list-scroll">
      <div v-if="!loading && groupedKpis" class="data-container">
        <a-collapse
          v-model:activeKey="activePanelKeys"
          expandIconPosition="end"
          class="kpi-collapse-modern"
        >
          <a-collapse-panel
            v-for="(kpiList, perspectiveId) in groupedKpis"
            :key="perspectiveId"
            :header="
              $t('perspectiveHeader', {
                id: kpiList[0]?.perspective?.id || perspectiveId,
                name: kpiList[0]?.perspective?.name || $t('uncategorized'),
                count: kpiList ? kpiList.length : 0,
              })
            "
            accordion
          >
            <div v-if="kpiList && kpiList.length > 0">
              <a-table
                :columns="columns"
                :data-source="kpiList"
                row-key="id"
                :pagination="false"
                :size="'small'"
                bordered
                class="kpi-table-modern company-table-modern"
                :rowClassName="() => 'kpi-row-hover'"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'department'">
                    <avatar-group>
                      <template
                        v-for="assignment in Array.isArray(record.assignments)
                          ? record.assignments.filter(
                              (a) => a.assigned_to_department && a.department,
                            )
                          : []"
                        :key="assignment.id"
                      >
                        <a-tooltip :title="assignment.department.name">
                          <a-avatar style="background-color: #1890ff">{{
                            assignment.department.name[0]
                          }}</a-avatar>
                        </a-tooltip>
                      </template>
                    </avatar-group>
                  </template>
                  <template v-else-if="column.dataIndex === 'section'">
                    <avatar-group>
                      <template
                        v-for="assignment in Array.isArray(record.assignments)
                          ? record.assignments.filter(
                              (a) => a.assigned_to_section && a.section,
                            )
                          : []"
                        :key="assignment.id"
                      >
                        <a-tooltip :title="assignment.section.name">
                          <a-avatar style="background-color: #1890ff">{{
                            assignment.section.name[0]
                          }}</a-avatar>
                        </a-tooltip>
                      </template>
                    </avatar-group>
                  </template>
                  <template v-else-if="column.dataIndex === 'employee'">
                    <avatar-group>
                      <template
                        v-for="assignment in Array.isArray(record.assignments)
                          ? record.assignments.filter(
                              (a) => a.assigned_to_employee && a.employee,
                            )
                          : []"
                        :key="assignment.id"
                      >
                        <a-tooltip
                          :title="getFullName(assignment.employee)"
                        >
                          <a-avatar style="background-color: #f56a00">{{
                            assignment.employee.first_name[0]
                          }}</a-avatar>
                        </a-tooltip>
                      </template>
                    </avatar-group>
                  </template>
                  <template v-else-if="column.dataIndex === 'target'">
                    <span class="kpi-value"
                      >{{ Number(record.target).toLocaleString() }}
                      {{ record.unit || "" }}</span
                    >
                  </template>
                  <template v-else-if="column.key === 'status'">
                    <a-tag
                      :color="getKpiDefinitionStatusColor(record.status)"
                      class="goal-status-tag"
                    >
                      {{
                        $t("status_chart." + record.status) ||
                        getKpiDefinitionStatusText(record.status)
                      }}
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
                          @click="goToDetail(record)"
                        >
                          <eye-outlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip :title="$t('edit')">
                        <a-button
                          type="primary"
                          ghost
                          shape="circle"
                          size="small"
                          @click="handleEditKpi(record)"
                          v-if="canEditCompanyKpi"
                          :disabled="
                            record.status !== KpiDefinitionStatus.DRAFT
                          "
                        >
                          <edit-outlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip :title="$t('copyKpi')">
                        <a-button
                          type="primary"
                          ghost
                          shape="circle"
                          size="small"
                          @click="handleCopyKpi(record)"
                          v-if="canCopyCompanyKpi"
                        >
                          <copy-outlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip
                        v-if="canDeleteCompanyKpiCompany"
                        :title="$t('deleteKpi')"
                      >
                        <a-button
                          danger
                          shape="circle"
                          size="small"
                          @click="
                            showConfirmDeleteDialog(record.id, record.name)
                          "
                        >
                          <delete-outlined />
                        </a-button>
                      </a-tooltip>
                    </a-space>
                  </template>
                  <template v-else>
                    <span>{{ record[column.dataIndex] || "--" }}</span>
                  </template>
                </template>
              </a-table>
            </div>
            <span v-else>{{ $t("noKpisForPerspective") }}</span>
          </a-collapse-panel>
        </a-collapse>
      </div>
      <a-empty
        v-else-if="!loading && !error"
        :description="$t('noKpisFound')"
      />
    </div>
    <a-modal
      danger
      v-model:open="isDeleteModalVisible"
      :title="$t('confirmDialog')"
      @ok="handleDeleteKpi"
      @cancel="isDeleteModalVisible = false"
    >
      <p>{{ $t("confirmDelete", { name: selectedKpiName }) }}</p>
    </a-modal>
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
  Space as ASpace,
  Modal as AModal,
  Empty as AEmpty,
  Avatar,
  Tooltip,
  Card as ACard,
} from "ant-design-vue";
import {
  PlusOutlined,
  ScheduleOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  EyeOutlined,
  notification,
  ApartmentOutlined,
  GlobalOutlined,
} from "@ant-design/icons-vue";
import dayjs from "dayjs";
import {
  KpiDefinitionStatus,
  KpiDefinitionStatusText,
  KpiDefinitionStatusColor,
} from "@/core/constants/kpiStatus";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { getReviewCycles } from "@/core/services/kpiReviewApi";
import {
  pickReviewCycleIdFromStore,
  syncLocalReviewCycleFromStore,
} from "@/core/composables/useReviewCycleGlobalSync";
import { getFullName } from '@/core/utils/format';

const store = useStore();
const router = useRouter();
const { t: $t } = useI18n();

const localFilters = reactive({
  name: "",
  departmentId: "",
  status: "",
  reviewCycleId: null,
});
// Applied filters - chỉ filter khi đã click Apply
const appliedFilters = reactive({
  name: "",
  departmentId: "",
  status: "",
  reviewCycleId: null,
});
const reviewCycles = ref([]);
const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
const activePanelKeys = ref([]);
const currentUser = computed(
  () => store.getters["auth/currentUser"] || store.getters["auth/user"],
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
const canCreateCompanyKpiCompany = computed(() =>
  hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI, "company"),
);
const canDeleteCompanyKpiCompany = computed(() =>
  hasPermission(RBAC_ACTIONS.DELETE, RBAC_RESOURCES.KPI, "company"),
);
const canEditCompanyKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.UPDATE, RBAC_RESOURCES.KPI, "company"),
);
const canCopyCompanyKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.COPY_TEMPLATE, RBAC_RESOURCES.KPI, "company"),
);

const loading = computed(() => store.getters["kpis/isLoading"]);
const error = computed(() => store.getters["kpis/error"]);
const kpis = computed(() => store.getters["kpis/kpiList"] || []);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || [],
);

const groupedKpis = computed(() => {
  // Don't display data when loading
  if (loading.value) {
    return {};
  }

  const grouped = {};
  if (!kpis.value || kpis.value.length === 0) return grouped;

  // Filter only KPIs with created_by_type: "company"
  const companyKpis = kpis.value.filter(
    (kpi) => {
      if(kpi.status === KpiDefinitionStatus.DRAFT) {
        return kpi.created_by_type === "company" && kpi.created_by === currentUser.value.id;
      }
      return true
    },
  );

  companyKpis.forEach((kpi) => {
    const key = kpi.perspective?.id || "uncategorized";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(kpi);
  });
  return grouped;
});

const validityStatusColor = {
  active: "green",
  expiring_soon: "orange",
  expired: "red",
  not_started: "blue",
};

const columns = computed(() => [
  {
    title: $t("kpiName"),
    dataIndex: "name",
    key: "name",
    width: "20%",
    ellipsis: true,
  },
  {
    title: $t("department"),
    dataIndex: "department",
    key: "department",
    width: "10%",
    ellipsis: true,
    customRender({ record }) {
      const departmentAssignments = Array.isArray(record.assignments)
        ? record.assignments.filter(
            (assignment) =>
              assignment.assigned_to_department && assignment.department,
          )
        : []; // Ensure it's an array
      return h(
        Avatar.Group,
        {},
        departmentAssignments.map((assignment) =>
          h(
            Tooltip,
            { title: assignment.department.name, key: assignment.id },
            () =>
              h(
                Avatar,
                { style: { backgroundColor: "#1890ff" } },
                assignment.department.name[0],
              ),
          ),
        ),
      );
    },
  },
  {
    title: $t("section"),
    dataIndex: "section",
    key: "section",
    width: "10%",
    ellipsis: true,
    customRender({ record }) {
      const sectionAssignments = Array.isArray(record.assignments)
        ? record.assignments.filter(
            (assignment) =>
              assignment.assigned_to_section && assignment.section,
          )
        : []; // Ensure it's an array
      return h(
        Avatar.Group,
        {},
        sectionAssignments.map((assignment) =>
          h(
            Tooltip,
            { title: assignment.section.name, key: assignment.id },
            () =>
              h(
                Avatar,
                { style: { backgroundColor: "#1890ff" } },
                assignment.section.name[0],
              ),
          ),
        ),
      );
    },
  },
  {
    title: $t("employee"),
    dataIndex: "employee",
    key: "employee",
    width: "14%",
    ellipsis: true,
    customRender({ record }) {
      const employeeAssignments = Array.isArray(record.assignments)
        ? record.assignments.filter(
            (assignment) =>
              assignment.assigned_to_employee && assignment.employee,
          )
        : []; // Ensure it's an array
      return h(
        Avatar.Group,
        {},
        employeeAssignments.map((assignment) =>
          h(
            Tooltip,
            {
              title: getFullName(assignment.employee),
              key: assignment.id,
            },
            () =>
              h(
                Avatar,
                { style: { backgroundColor: "#f56a00" } },
                assignment.employee.first_name[0],
              ),
          ),
        ),
      );
    },
  },
  {
    title: $t("target"),
    dataIndex: "target",
    key: "target",
    width: "8%",
    align: "right",
  },
  {
    title: $t("weight"),
    dataIndex: "weight",
    key: "weight",
    width: "7%",
    align: "right",
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
    width: "8%",
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

const goToCreateKpi = () => {
  router.push({ name: "KpiCreateCompany", query: { scope: "company" } });
};

const loadKpis = (page = 1) => {
  const params = {
    page: page,
    limit: 1000, // Get all KPIs since we don't have pagination in UI
    scope: "company", // Only fetch KPIs created by company
  };

  // Sử dụng appliedFilters thay vì localFilters
  // Chỉ thêm params khi giá trị thực sự có (không phải empty string, null, hoặc undefined)
  if (appliedFilters.name && appliedFilters.name.trim()) {
    params.name = appliedFilters.name;
  }
  if (
    appliedFilters.departmentId &&
    appliedFilters.departmentId !== "" &&
    appliedFilters.departmentId !== null
  ) {
    params.department_id = appliedFilters.departmentId;
  }
  if (appliedFilters.status && appliedFilters.status.trim()) {
    params.status = appliedFilters.status;
  }

  // Get start_date and end_date from selected review cycle
  // Chỉ apply khi reviewCycleId có giá trị hợp lệ
  if (
    appliedFilters.reviewCycleId !== null &&
    appliedFilters.reviewCycleId !== undefined &&
    appliedFilters.reviewCycleId !== ""
  ) {
    const selectedCycle = reviewCycles.value.find((c) => {
      // So sánh cả string và number để đảm bảo tìm đúng
      const cycleId = String(c.id);
      const filterId = String(appliedFilters.reviewCycleId);
      return cycleId === filterId || Number(cycleId) === Number(filterId);
    });
    if (selectedCycle) {
      params.start_date = dayjs(
        selectedCycle.startDate || selectedCycle.start_date,
      ).format("YYYY-MM-DD");
      params.end_date = dayjs(
        selectedCycle.endDate || selectedCycle.end_date,
      ).format("YYYY-MM-DD");
    } else {
      console.warn("Selected review cycle not found:", {
        requestedId: appliedFilters.reviewCycleId,
        requestedType: typeof appliedFilters.reviewCycleId,
        availableCycles: reviewCycles.value.map((c) => ({
          id: c.id,
          idType: typeof c.id,
          name: c.name,
        })),
      });
    }
  }

  store.dispatch("kpis/fetchKpis", params);
};

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
  localFilters.departmentId = "";
  localFilters.status = "";
  localFilters.reviewCycleId =
    pickReviewCycleIdFromStore(store, reviewCycles.value) ??
    defaultReviewCycleIdFromList();
  applyFilters();
};

const applyFilters = () => {
  // Copy localFilters vào appliedFilters trước khi gọi API
  appliedFilters.name = localFilters.name;
  appliedFilters.departmentId = localFilters.departmentId;
  appliedFilters.status = localFilters.status;
  // Đảm bảo reviewCycleId được copy đúng (có thể là number hoặc string)
  appliedFilters.reviewCycleId =
    localFilters.reviewCycleId !== null &&
    localFilters.reviewCycleId !== undefined &&
    localFilters.reviewCycleId !== ""
      ? localFilters.reviewCycleId
      : null;

  loadKpis(1);
};

const handleEditKpi = (record) => {
  if (record && record.id) {
    router.push({
      path: "/kpis/create",
      query: {
        templateKpiId: record.id,
      },
    });
  } else {
    notification.warning({
      message: "Cannot edit due to missing KPI information.",
    });
  }
};

const handleCopyKpi = (record) => {
  if (record && record.id) {
    router.push({
      name: "KpiCreateCompany",
      query: {
        templateKpiId: record.id,
        isCopy: true,
        scope: "company",
      },
    });
  } else {
    notification.warning({
      message: "Cannot copy due to missing KPI information.",
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

const getKpiDefinitionStatusText = (status) => {
  return KpiDefinitionStatusText[status] || status || "";
};
const getKpiDefinitionStatusColor = (status) => {
  return KpiDefinitionStatusColor[status] || "default";
};

const clearToggleError = () => {
  store.commit("kpis/SET_TOGGLE_KPI_STATUS_ERROR", null);
};

watch(
  groupedKpis,
  (newGroups) => {
    if (newGroups && typeof newGroups === "object") {
      activePanelKeys.value = Object.keys(newGroups);
    } else {
      activePanelKeys.value = [];
    }
  },
  { immediate: true },
);

const goToDetail = (record) => {
  if (record && record.id) {
    router.push({ name: "KpiDetail", params: { id: record.id } });
  } else {
    console.error(
      "Cannot navigate to detail: Invalid record or missing ID",
      record,
    );
    notification.error({ message: "Cannot view details for this item." });
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

onMounted(async () => {
  await Promise.all([
    fetchReviewCycles(),
    store.dispatch("departments/fetchDepartments"),
  ]);
  // Gọi applyFilters() để copy localFilters vào appliedFilters và load data
  await applyFilters();
  document.body.classList.add("no-outer-scroll");
});

onUnmounted(() => {
  document.body.classList.remove("no-outer-scroll");
});
</script>

<style scoped>
.kpi-company-list-page {
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
  overscroll-behavior: contain;
}

.data-container {
  overflow: visible !important;
  height: auto !important;
}

.kpi-table-modern {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 0;
}
.company-table-modern {
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
.goal-status-tag {
  font-weight: 500;
  font-size: 13px;
  padding: 0 10px;
  border-radius: 8px;
}
.goal-status-text {
  letter-spacing: 0.5px;
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
.kpi-table-modern .ant-table-cell .ant-avatar-group {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-start;
}
.kpi-table-modern .ant-avatar {
  min-width: 28px;
  min-height: 28px;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.kpi-table-modern .ant-table-cell {
  vertical-align: middle;
}
.validity-status-pill {
  font-weight: 600 !important;
  border-radius: 999px !important;
  font-size: 13px !important;
  padding: 2px 16px !important;
  letter-spacing: 0.5px;
  text-transform: capitalize;
  border: none !important;
  display: inline-block;
}

:deep(.kpi-list-scroll .ant-table-body),
:deep(.kpi-list-scroll .ant-table-content),
:deep(.kpi-list-scroll .ant-table-container),
:deep(.kpi-list-scroll .ant-table-header) {
  overflow: visible !important;
  max-height: none !important;
}

:deep(.kpi-list-scroll .ant-table-thead th) {
  position: sticky;
  top: 0;
  z-index: 2;
}

:deep(.kpi-list-scroll .ant-collapse-content-box) {
  overflow: visible !important;
}

:deep(.ant-card-body) {
  padding: 0 !important;
}
</style>
