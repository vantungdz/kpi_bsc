<template>
  <div class="kpi-section-list-page">
    <div class="list-header-modern">
      <partition-outlined class="header-icon" />
      <div class="header-title-group">
        <h2>{{ $t("sectionKpiList") }}</h2>
        <div class="header-desc">
          {{ $t("sectionKpiListDesc") || $t("sectionKpiList") }}
        </div>
      </div>
      <div class="action-buttons right-align">
        <a-button v-if="canCreateSectionKpiSection" type="primary" @click="goToCreateKpi">
          <plus-outlined /> {{ $t("createNewKpi") }}
        </a-button>
      </div>
    </div>
    <a-card class="filter-card-modern">
      <a-form layout="vertical" class="filter-form-modern">
        <a-row :gutter="[16, 0]" align="middle" style="flex-wrap: wrap">
          <a-col :span="6">
            <a-form-item :label="$t('search')" class="filter-label-top">
              <a-input v-model:value="localFilters.name" :placeholder="$t('kpiNamePlaceholder')" allow-clear
                size="small">
                <template #prefix><schedule-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="6" v-if="!isSectionUser && canAssignKpiCompany">
            <a-form-item :label="$t('department')" class="filter-label-top">
              <a-select v-model:value="localFilters.departmentId" style="width: 100%" @change="handleDepartmentChange"
                :disabled="(isSectionUser && !!currentUser?.departmentId) ||
                  isDepartmentUser
                  " allow-clear size="small">
                <template #suffixIcon><apartment-outlined /></template>
                <a-select-option v-if="
                  !(
                    (isSectionUser && !!currentUser?.departmentId) ||
                    isDepartmentUser
                  )
                " :value="null">{{ $t("allDepartments") }}</a-select-option>
                <a-select-option v-for="department in departmentList" :key="department.id" :value="department.id">
                  {{ department.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item :label="$t('section')" class="filter-label-top">
              <a-select v-model:value="localFilters.sectionId" style="width: 100%" :disabled="isSectionUser" allow-clear
                size="small">
                <template #suffixIcon><cluster-outlined /></template>
                <a-select-option v-if="!isSectionUser" :value="0">{{
                  $t("allSections")
                }}</a-select-option>
                <a-select-option v-for="section in selectSectionList" :key="section.id" :value="section.id">
                  {{ section.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="6">
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
    <a-alert v-if="!loading && error" :message="error" type="error" show-icon closable />
    <a-alert v-if="!loading && isDisplayResult && sectionGroups.length === 0" :message="$t('noKpisFound')"
      type="warning" show-icon closable />
    <a-alert v-if="deletedKpiName" :message="$t('kpiDeleted', { name: deletedKpiName })" type="success" closable
      @close="deletedKpiName = null" show-icon />
    <div class="kpi-list-scroll">
      <div v-if="!loading && isDisplayResult" class="data-container">
        <div v-for="(sectionGroup, sectionIndex) in sectionGroups" :key="'sec-' + sectionIndex" class="mb-8">
          <h4 class="text-base font-bold mb-1.5 section-header-modern">
            {{ $t("sectionHeader", { name: sectionGroup.section }) }}
          </h4>
            <a-collapse v-model:activeKey="activePanelKeys" expandIconPosition="end" class="kpi-collapse-modern">
            <a-collapse-panel v-for="(perspectiveGroupRows, perspectiveKey) in sectionGroup.data" :key="'pers-' + sectionIndex + '-' + perspectiveKey"
              :header="perspectiveKey.split('. ')[1] || perspectiveKey">
              <a-table :columns="columns" :dataSource="tableData(perspectiveGroupRows)" :pagination="false" rowKey="key"
                :rowClassName="rowClassName" size="small" bordered class="kpi-table-modern section-table-modern">
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
                  <template v-else-if="column.dataIndex === 'assignTo'">
                    <span>{{ record.assignTo }}</span>
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
                    <a-tag :color="getStatusColor(record.status)" class="goal-status-tag">
                      {{ $t("status_chart." + record.status) || record.status }}
                    </a-tag>
                  </template>
                  <template v-else-if="column.dataIndex === 'validityStatus'">
                    <a-tag :color="validityStatusColor[record.validityStatus] || 'default'
                      ">
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
                                contextSectionId: sectionGroup.sectionId,
                              },
                            })
                          "
                        >
                          <eye-outlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip v-if="canEditSectionKpi" :title="$t('edit')">
                        <a-button
                          type="primary"
                          ghost
                          shape="circle"
                          size="small"
                          @click="handleEditKpi(record, sectionGroup.sectionId)"
                          :disabled="record.status !== KpiDefinitionStatus.DRAFT"
                        >
                          <edit-outlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip v-if="canCopySectionKpi" :title="$t('copyKpi')">
                        <a-button
                          type="primary"
                          ghost
                          shape="circle"
                          size="small"
                          @click="handleCopyKpi(record, sectionGroup.sectionId)"
                        >
                          <copy-outlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip v-if="canDeleteSectionKpiSection" :title="$t('deleteKpi')">
                        <a-button
                          danger
                          shape="circle"
                          size="small"
                          @click="
                            showConfirmDeleteDialog(
                              record.kpiId,
                              record.kpiName,
                            )
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
        </div>
      </div>
    </div>
    <a-modal danger v-model:open="isDeleteModalVisible" :title="$t('confirmDialog')" @ok="handleDeleteKpi"
      @cancel="isDeleteModalVisible = false">
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
  ClusterOutlined,
  PartitionOutlined,
} from "@ant-design/icons-vue";
import { KpiDefinitionStatus, KpiDefinitionStatusColor } from "@/core/constants/kpiStatus";
import { notification } from "ant-design-vue";
import dayjs from "dayjs";
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
const sectionKpiList = computed(
  () => store.getters["kpis/sectionKpiList"] || [],
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

const canEditSectionKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.UPDATE, RBAC_RESOURCES.KPI, SCOPES.SECTION),
);
const canCopySectionKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.COPY_TEMPLATE, RBAC_RESOURCES.KPI, SCOPES.COMPANY),
);
const canCreateSectionKpiSection = computed(() =>
  hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI, SCOPES.SECTION),
);
const canDeleteSectionKpiSection = computed(() =>
  hasPermission(RBAC_ACTIONS.DELETE, RBAC_RESOURCES.KPI, SCOPES.COMPANY),
);

const canAssignKpiCompany = computed(() =>
  hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI, SCOPES.COMPANY),
);

const selectSectionList = ref([]);

// Check if user can only view section-level KPIs (not company/department-level)
const isSectionUser = computed(() => {
  // If user has company assign permission, they can see all sections
  if (canAssignKpiCompany.value) return false;

  // If user has section view permission but no company/department assign permission
  const hasSectionView = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI,
    SCOPES.SECTION,
  );
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

  // User is section-level if they have section view but no higher level permissions
  return hasSectionView && !hasDepartmentView && !hasCompanyView;
});

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

const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
const isDisplayResult = ref(false);
const activePanelKeys = ref([]);
const localFilters = reactive({
  name: "",
  departmentId: null,
  sectionId: null,
  reviewCycleId: null,
});
// Applied filters - chỉ filter khi đã click Apply
const appliedFilters = reactive({
  name: "",
  departmentId: null,
  sectionId: null,
  reviewCycleId: null,
});
const reviewCycles = ref([]);

const sectionGroups = computed(() => {
  // Don't display data when loading
  if (loading.value) {
    return [];
  }

  const groupedData = {};

  const displayData = Array.isArray(sectionKpiList.value?.data)
    ? sectionKpiList.value.data.filter((item) => {
      // Show DRAFT status if KPI was created from section, otherwise hide DRAFT
      if (item.status === KpiDefinitionStatus.DRAFT) {
        return item.created_by_type === 'section' && item.created_by === currentUser.value.id;
      }
      return true;
    })
    : Array.isArray(sectionKpiList.value)
      ? sectionKpiList.value.filter((item) => {
        // Show DRAFT status if KPI was created from section, otherwise hide DRAFT
        if (item.status === KpiDefinitionStatus.DRAFT) {
          return item.created_by_type === 'section' && item.created_by === currentUser.value.id;
        }
        return true;
      })
      : [];

  const allSections = store.getters["sections/sectionList"] || [];
  const currentFilterDepartmentId = appliedFilters.departmentId;
  const currentFilterSectionId = appliedFilters.sectionId;

  if (!Array.isArray(displayData) || displayData.length === 0) {
    return [];
  }

  displayData.forEach((kpi) => {
    if (!kpi || !kpi.assignments) {
      return;
    }

    const kpiDetails = {
      kpiId: kpi.id,
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

    const sectionsForThisKpi = new Map();

    kpi.assignments.forEach((assignment) => {
      // Use section info directly from assignment if available
      let sectionInfoFromAssignment = null;
      let targetSectionId = null;
      let departmentIdOfSection = null;

      if (assignment.assigned_to_section && assignment.section) {
        // Use section info from assignment
        sectionInfoFromAssignment = assignment.section;
        targetSectionId = sectionInfoFromAssignment.id;
        departmentIdOfSection = sectionInfoFromAssignment.department?.id;
      } else if (
        assignment.assigned_to_employee &&
        assignment.employee?.section
      ) {
        // Use section info from employee
        sectionInfoFromAssignment = assignment.employee.section;
        targetSectionId = sectionInfoFromAssignment.id;
        departmentIdOfSection = sectionInfoFromAssignment.department?.id;
      } else {
        // Fallback to finding in allSections
        sectionInfoFromAssignment = allSections.find(
          (s) =>
            (assignment.assigned_to_section &&
              s.id === Number(assignment.assigned_to_section)) ||
            (assignment.assigned_to_employee &&
              assignment.employee?.sectionId &&
              s.id === Number(assignment.employee.sectionId)),
        );

        if (sectionInfoFromAssignment) {
          targetSectionId = sectionInfoFromAssignment.id;
          departmentIdOfSection =
            sectionInfoFromAssignment.department_id ||
            sectionInfoFromAssignment.department?.id;
        }
      }

      if (sectionInfoFromAssignment) {
        if (!sectionsForThisKpi.has(targetSectionId)) {
          let details = null;
          if (
            assignment.assigned_to_section &&
            Number(assignment.assigned_to_section) === targetSectionId
          ) {
            details = {
              target: assignment.targetValue,
              weight: assignment.weight,
              status: assignment.status,
              startDate: assignment.start_date || kpiDetails.kpiStartDate,
              endDate: assignment.end_date || kpiDetails.kpiEndDate,
            };
          }
          sectionsForThisKpi.set(targetSectionId, {
            sectionName: sectionInfoFromAssignment.name,
            sectionSortOrder: sectionInfoFromAssignment.sort_order ?? 9999,
            sectionAssignmentDetails: details,
          });
        } else if (
          assignment.assigned_to_section &&
          Number(assignment.assigned_to_section) === targetSectionId &&
          !sectionsForThisKpi.get(targetSectionId).sectionAssignmentDetails
        ) {
          sectionsForThisKpi.get(targetSectionId).sectionAssignmentDetails = {
            target: assignment.targetValue,
            weight: assignment.weight,
            status: assignment.status,
            startDate: assignment.start_date || kpiDetails.kpiStartDate,
            endDate: assignment.end_date || kpiDetails.kpiEndDate,
          };
        }
      }

      if (targetSectionId === null) return;

      // Only filter by department if user has company assign permission
      // Otherwise, show sections from user's department
      if (
        canAssignKpiCompany.value &&
        currentFilterDepartmentId &&
        Number(departmentIdOfSection) !== Number(currentFilterDepartmentId)
      ) {
        sectionsForThisKpi.delete(targetSectionId);
        return;
      } else if (
        !canAssignKpiCompany.value &&
        currentUser.value?.departmentId &&
        Number(departmentIdOfSection) !== Number(currentUser.value.departmentId)
      ) {
        sectionsForThisKpi.delete(targetSectionId);
        return;
      }
      if (
        currentFilterSectionId &&
        currentFilterSectionId !== 0 &&
        targetSectionId !== Number(currentFilterSectionId)
      ) {
        sectionsForThisKpi.delete(targetSectionId);
        return;
      }
    });

    sectionsForThisKpi.forEach((sectionData, sectionId) => {
      const perspectiveKey = `${kpiDetails.perspectiveId}. ${kpiDetails.perspectiveName}`;

      if (!groupedData[sectionId]) {
        groupedData[sectionId] = {
          section: sectionData.sectionName,
          sectionId: sectionId,
          sectionSortOrder: sectionData.sectionSortOrder ?? 9999,
          data: {},
        };
      }
      if (!groupedData[sectionId].data[perspectiveKey]) {
        groupedData[sectionId].data[perspectiveKey] = [];
      }

      let displayTarget = kpiDetails.kpiTarget;
      const displayWeight = kpiDetails.kpiWeight;
      let displayStatus = kpiDetails.kpiStatus;
      let displayStartDate = kpiDetails.kpiStartDate;
      let displayEndDate = kpiDetails.kpiEndDate;
      let displayAssignTo = sectionData.sectionName;

      if (sectionData.sectionAssignmentDetails) {
        displayTarget =
          sectionData.sectionAssignmentDetails.target ?? displayTarget;

        // Status always comes from KPI, not from assignment
        // displayStatus remains as kpiDetails.kpiStatus
        displayStartDate =
          sectionData.sectionAssignmentDetails.startDate ?? displayStartDate;
        displayEndDate =
          sectionData.sectionAssignmentDetails.endDate ?? displayEndDate;
      } else {
        const hasEmployeeAssignmentsInThisSectionForKpi = kpi.assignments.some(
          (assign) =>
            assign.assigned_to_employee &&
            Number(assign.employee?.sectionId) === sectionId,
        );
        if (hasEmployeeAssignmentsInThisSectionForKpi) {
          displayAssignTo = `Users in ${sectionData.sectionName}`;
        }
      }

      const sectionSpecificActual =
        kpi.actuals_by_section_id &&
          kpi.actuals_by_section_id[sectionId] !== undefined
          ? kpi.actuals_by_section_id[sectionId]
          : undefined;

      const rowData = {
        key: `kpi-${kpi.id}-section-${sectionId}`,
        kpiId: kpiDetails.kpiId,
        kpiName: kpiDetails.kpiName,
        perspectiveName: kpiDetails.perspectiveName,
        assignTo: displayAssignTo,
        startDate: displayStartDate,
        endDate: displayEndDate,
        weight: displayWeight,
        target: displayTarget,
        actual: (() => {
          let numericValue = null;
          if (
            sectionSpecificActual !== undefined &&
            sectionSpecificActual !== null
          ) {
            if (
              typeof sectionSpecificActual === "object" &&
              Object.prototype.hasOwnProperty.call(
                sectionSpecificActual,
                "actual_value_field",
              )
            ) {
              numericValue = sectionSpecificActual.actual_value_field;
            } else if (!isNaN(parseFloat(sectionSpecificActual))) {
              numericValue = sectionSpecificActual;
            }
          }
          return numericValue !== null ? numericValue.toString() : "0";
        })(),
        unit: kpiDetails.kpiUnit,
        status: displayStatus,
        validityStatus: kpi.validityStatus || "active",
      };
      groupedData[sectionId].data[perspectiveKey].push(rowData);
    });
  });

  const finalGroupedArray = Object.values(groupedData).map((sectionGroup) => {
    const sortedPerspectives = Object.keys(sectionGroup.data)
      .sort()
      .reduce((sortedMap, perspectiveKey) => {
        sortedMap[perspectiveKey] = sectionGroup.data[perspectiveKey].sort(
          (a, b) => a.kpiName.localeCompare(b.kpiName),
        );
        return sortedMap;
      }, {});

    return {
      section: sectionGroup.section,
      sectionId: sectionGroup.sectionId,
      sectionSortOrder: sectionGroup.sectionSortOrder,
      data: sortedPerspectives,
    };
  });

  // Sort by sort_order instead of name
  finalGroupedArray.sort((a, b) => {
    const orderA = a.sectionSortOrder ?? 9999;
    const orderB = b.sectionSortOrder ?? 9999;
    return orderA - orderB;
  });

  return finalGroupedArray;
});

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
  if (isSectionUser.value && currentUser.value?.sectionId) {
    localFilters.sectionId = Number(currentUser.value.sectionId);
  } else {
    localFilters.sectionId = 0;
  }
  localFilters.reviewCycleId =
    pickReviewCycleIdFromStore(store, reviewCycles.value) ??
    defaultReviewCycleIdFromList();
  applyFilters();
};

const applyFilters = async () => {
  loading.value = true;
  error.value = null;
  isDisplayResult.value = false;

  // Copy localFilters vào appliedFilters trước khi gọi API
  appliedFilters.name = localFilters.name;
  appliedFilters.departmentId = localFilters.departmentId;
  appliedFilters.sectionId = localFilters.sectionId;
  appliedFilters.reviewCycleId = localFilters.reviewCycleId;

  const departmentId =
    appliedFilters.departmentId === null ||
      Number.isNaN(Number(appliedFilters.departmentId))
      ? null
      : Number(appliedFilters.departmentId);

  const sectionIdForPath =
    appliedFilters.sectionId === null ||
      Number.isNaN(Number(appliedFilters.sectionId))
      ? 0
      : Number(appliedFilters.sectionId);

  try {
    const filtersToSend = {
      sectionIdForApi: sectionIdForPath,
      departmentIdForQuery: departmentId,
      name: appliedFilters.name,
    };

    // Get start_date and end_date from selected review cycle
    if (appliedFilters.reviewCycleId) {
      const selectedCycle = reviewCycles.value.find((c) => {
        // So sánh cả string và number để đảm bảo tìm đúng
        const cycleId = String(c.id);
        const filterId = String(appliedFilters.reviewCycleId);
        return cycleId === filterId || Number(cycleId) === Number(filterId);
      });
      if (selectedCycle) {
        filtersToSend.start_date = dayjs(
          selectedCycle.startDate || selectedCycle.start_date,
        ).format("YYYY-MM-DD");
        filtersToSend.end_date = dayjs(
          selectedCycle.endDate || selectedCycle.end_date,
        ).format("YYYY-MM-DD");
      }
    }

    await store.dispatch("kpis/fetchSectionKpis", filtersToSend);

    isDisplayResult.value = true;
  } catch (err) {
    error.value = err.message || "Failed to fetch KPIs.";
  } finally {
    loading.value = false;
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

const handleDepartmentChange = async () => {
  if (isDepartmentUser.value && currentUser.value?.departmentId) {
    localFilters.departmentId = currentUser.value.departmentId;
    notification.info({
      message: "Notification",
      description: "You can only view sections within your department.",
    });
    return;
  }

  try {
    if (localFilters.departmentId && localFilters.departmentId !== null) {
      await store.dispatch(
        "sections/fetchSectionsByDepartment",
        localFilters.departmentId,
      );
      selectSectionList.value =
        store.getters["sections/sectionsByDepartment"](
          localFilters.departmentId,
        ) || [];

      if (
        localFilters.sectionId &&
        !selectSectionList.value.some((s) => s.id === localFilters.sectionId)
      ) {
        localFilters.sectionId = 0;
      }
    } else {
      // Only load all sections if user has company assign permission
      if (canAssignKpiCompany.value) {
        await store.dispatch("sections/fetchSections");
        selectSectionList.value = store.getters["sections/sectionList"] || [];
        localFilters.sectionId = 0;
      } else {
        // For users without company permission, load sections from their department
        if (currentUser.value?.departmentId) {
          await store.dispatch(
            "sections/fetchSectionsByDepartment",
            currentUser.value.departmentId,
          );
          selectSectionList.value =
            store.getters["sections/sectionsByDepartment"](
              currentUser.value.departmentId,
            ) || [];
        } else {
          selectSectionList.value = [];
        }
        localFilters.sectionId = 0;
      }
    }
  } catch (err) {
    notification.error({
      message: "Error loading sections",
      description: err.message || "Failed to fetch sections.",
    });
  }
};

const tableData = (perspectiveGroupRowsArray) => {
  return perspectiveGroupRowsArray;
};

const goToCreateKpi = () => {
  router.push({
    name: "KpiCreateSection",
  });
};

const getStatusColor = (status) => {
  return KpiDefinitionStatusColor[status] || "default";
};

const handleEditKpi = (record, sectionId) => {
  if (record && record.kpiId) {
    router.push({
      name: "KpiCreateSection",
      query: {
        templateKpiId: record.kpiId,
        contextSectionId: sectionId,
      },
    });
  } else {
    notification.warning({
      message: "Cannot edit due to missing KPI information.",
    });
  }
};

const handleCopyKpi = (record, sectionId) => {
  if (record && record.kpiId) {
    router.push({
      name: "KpiCreateSection",
      query: {
        templateKpiId: record.kpiId,
        contextSectionId: sectionId,
        isCopy: true,
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

const handleDeleteKpi = () => {
  store
    .dispatch("kpis/deleteKpi", selectedKpiId.value)
    .then(() => {
      applyFilters();
      deletedKpiName.value = selectedKpiName.value;
      isDeleteModalVisible.value = false;
      selectedKpiId.value = "";
      selectedKpiName.value = "";
    })
    .catch((err) => {
      console.error("Delete KPI error:", err);
    });
};

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
    width: "20%",
  },
  {
    title: $t("currentProgress"),
    dataIndex: "chart",
    key: "chart",
    width: "12%",
    align: "center",
    customRender: ({ record }) => renderProgress(record),
  },
  {
    title: $t("assignTo"),
    dataIndex: "assignTo",
    key: "assignTo",
    width: "12%",
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

watch(() => [localFilters.departmentId, localFilters.sectionId], {
  immediate: true,
});

const rowClassName = (record) => {
  return record.isParent ? "row-parent" : "";
};

watch(
  sectionGroups,
  (newGroups) => {
    const keys = [];
    if (Array.isArray(newGroups)) {
      newGroups.forEach((sectionGroup, sectionIndex) => {
        if (
          sectionGroup &&
          typeof sectionGroup.data === "object" &&
          sectionGroup.data !== null
        ) {
          Object.keys(sectionGroup.data).forEach((perspectiveKey) => {
            const panelKey = `pers-${sectionIndex}-${perspectiveKey}`;
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

    localFilters.departmentId = null;

    // Always load all sections for sectionGroups computation
    await store.dispatch("sections/fetchSections");

    // Only load all sections if user has company assign permission
    if (canAssignKpiCompany.value) {
      selectSectionList.value = store.getters["sections/sectionList"] || [];
    } else {
      // For users without company permission, load sections from their department
      if (currentUser.value?.departmentId) {
        await store.dispatch(
          "sections/fetchSectionsByDepartment",
          currentUser.value.departmentId,
        );
        const sectionsFromStore = store.getters[
          "sections/sectionsByDepartment"
        ](currentUser.value.departmentId);
        selectSectionList.value = sectionsFromStore || [];
      } else {
        selectSectionList.value = [];
      }
    }

    // For section users (employees), set their sectionId in the filter
    if (isSectionUser.value && currentUser.value?.sectionId) {
      const userSectionId = Number(currentUser.value.sectionId);
      // Make sure the section is in the selectSectionList
      const allSections = store.getters["sections/sectionList"] || [];
      const userSection = allSections.find(
        (s) => Number(s.id) === userSectionId,
      );
      if (
        userSection &&
        !selectSectionList.value.some((s) => Number(s.id) === userSectionId)
      ) {
        selectSectionList.value.push(userSection);
      }
      localFilters.sectionId = userSectionId;
    } else {
      localFilters.sectionId = 0;
    }

    await applyFilters();

    // After fetching KPIs, populate dropdown with sections from the data
    if (!canAssignKpiCompany.value) {
      const sectionsFromData = [];
      const sectionIds = new Set();

      // Handle both cases: sectionKpiList.value.data or sectionKpiList.value as array
      const kpiData = sectionKpiList.value?.data || sectionKpiList.value;

      if (kpiData && Array.isArray(kpiData)) {
        kpiData.forEach((kpi) => {
          if (kpi.assignments) {
            kpi.assignments.forEach((assignment) => {
              if (assignment.assigned_to_section && assignment.section) {
                if (!sectionIds.has(assignment.section.id)) {
                  sectionIds.add(assignment.section.id);
                  sectionsFromData.push({
                    id: assignment.section.id,
                    name: assignment.section.name,
                    department: assignment.section.department,
                  });
                }
              } else if (
                assignment.assigned_to_employee &&
                assignment.employee?.section
              ) {
                if (!sectionIds.has(assignment.employee.section.id)) {
                  sectionIds.add(assignment.employee.section.id);
                  sectionsFromData.push({
                    id: assignment.employee.section.id,
                    name: assignment.employee.section.name,
                    department: assignment.employee.section.department,
                  });
                }
              }
            });
          }
        });
      }

      // If no sections found from KPI data, try to get from sectionGroups
      if (sectionsFromData.length === 0) {
        sectionGroups.value.forEach((sectionGroup) => {
          if (sectionGroup.sectionId && sectionGroup.section) {
            sectionsFromData.push({
              id: sectionGroup.sectionId,
              name: sectionGroup.section,
              department: null, // We don't have department info in sectionGroups
            });
          }
        });
      }

      // Ensure employee's section is included if they are a section user
      if (isSectionUser.value && currentUser.value?.sectionId) {
        const userSectionId = Number(currentUser.value.sectionId);
        const allSections = store.getters["sections/sectionList"] || [];
        const userSection = allSections.find(
          (s) => Number(s.id) === userSectionId,
        );
        if (
          userSection &&
          !sectionsFromData.some((s) => Number(s.id) === userSectionId)
        ) {
          sectionsFromData.push(userSection);
        }
      }

      selectSectionList.value = sectionsFromData;
    }
  } catch (err) {
    error.value = err.message || "Failed to fetch initial data.";
  }
});

onUnmounted(() => {
  document.body.classList.remove("no-outer-scroll");
});
</script>

<style scoped>
.kpi-section-list-page {
  /* padding: 24px; */
  background: #f6f8fa;
  height: 100%;
  min-height: 0;
  /* quan trọng khi cha dùng flex */
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

.filter-card-modern {
  max-width: 98%;
}

.kpi-table-modern {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 0;
}

.section-table-modern {
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

.section-header-modern {
  color: #2563eb;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
}

:deep(.kpi-list-scroll .ant-table-thead th) {
  position: sticky;
  top: 0;
  z-index: 2;
}

:deep(.kpi-list-scroll .ant-table-body),
:deep(.kpi-list-scroll .ant-table-content),
:deep(.kpi-list-scroll .ant-table-container),
:deep(.kpi-list-scroll .ant-table-header) {
  overflow: visible !important;
  max-height: none !important;
}

:deep(.kpi-list-scroll .ant-collapse-content-box) {
  overflow: visible !important;
}

:deep(.ant-card-body) {
  padding: 0 !important;
}
</style>
