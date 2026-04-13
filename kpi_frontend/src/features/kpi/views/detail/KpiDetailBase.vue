<template>
  <div>
    <LoadingOverlay
      :visible="
        loadingKpi ||
        loadingUserAssignments ||
        loadingDepartmentSectionAssignments
      "
    />
    <a-card class="kpi-detail-card">
      <template #title>
        <div class="kpi-detail-title">
          <span class="kpi-detail-title-content">
            <fund-outlined class="kpi-detail-title-icon" />
            <span>{{ contextName ? `${contextName} KPI: ` : `${contextTypeLabel} KPI: ` }}</span>
            <span class="kpi-detail-kpi-name">{{ kpiDetailData?.name || $t('loading') }}</span>
          </span>
        </div>
      </template>
      <a-skeleton :loading="loadingKpi" active :paragraph="{ rows: 6 }">
        <a-descriptions v-if="kpiDetailData" :column="2" bordered size="small">
          <template #title>
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
              "
            >
              <span>{{ $t("kpiInformation") }}</span>
              <a-button
                v-if="kpiDetailData?.id && canCopyTemplate"
                @click="copyKpiAsTemplate"
                :disabled="loadingKpi"
              >
                {{ $t("copyAsTemplate") }}
              </a-button>
            </div>
          </template>
          <a-descriptions-item :label="$t('createdBy')">
            {{ $getFullName(kpiDetailData.createdBy) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('weight')">
            {{ kpiDetailData.weight ?? "" }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('frequency')">
            {{ getFrequencyText(kpiDetailData.frequency) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('perspective')">
            {{ kpiDetailData.perspective?.name || "" }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('target')">
            {{ Number(displayTargetValue).toLocaleString() }}
            {{ kpiDetailData.unit || "" }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('status')">
            <a-tag
              :color="getKpiDefinitionStatusColor(kpiDetailData.status)"
              style="margin-right: 10px"
            >
              {{ getKpiDefinitionStatusText(kpiDetailData.status) }}</a-tag
            >
            <div
              v-if="toggleStatusError"
              style="color: red; font-size: 0.9em; margin-top: 5px"
            >
              {{ $t("error") }}: {{ toggleStatusError }}
              <a @click="clearToggleError" style="margin-left: 5px"
                >({{ $t("clear") }})</a
              >
            </div>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('startDate')">
            {{
              kpiDetailData.start_date
                ? formatDate(kpiDetailData.start_date)
                : ""
            }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('endDate')">
            {{
              kpiDetailData.end_date ? formatDate(kpiDetailData.end_date) : ""
            }}
          </a-descriptions-item>

          <a-descriptions-item :label="$t('description')" :span="2">
            <v-md-editor
              v-if="kpiDetailData.description"
              :model-value="kpiDetailData.description"
              mode="preview"
            ></v-md-editor>
          </a-descriptions-item>
        </a-descriptions>
        <a-empty
          v-else-if="!loadingKpi"
          :description="$t('couldNotLoadKpiDetails')"
        />
      </a-skeleton>

      <WorkflowTimeline
        v-if="relevantAssignmentId"
        :workflow="assignmentWorkflow"
        :loading="loadingWorkflow"
      />

      <a-row
        v-if="shouldShowAssignmentStats"
        :gutter="12"
        style="
          margin-top: 16px;
          margin-bottom: 16px;
          background: #f0f2f5;
          padding: 8px;
          border-radius: 4px;
        "
      >
        <a-col :span="8">
          <a-statistic
            :title="$t('overallTarget')"
            :value="overallTargetValueDetail"
            :precision="2"
          />
        </a-col>
        <a-col :span="8">
          <a-statistic
            :title="$t('totalAssigned')"
            :value="totalAssignedTargetDetail"
            :precision="2"
          />
        </a-col>
        <a-col :span="8">
          <a-statistic
            :title="$t('remaining')"
            :value="remainingTargetDetail"
            :precision="2"
            :value-style="isOverAssignedDetail ? { color: '#cf1322' } : {}"
          />
        </a-col>
      </a-row>
    </a-card>

    <!-- Context-specific content will be inserted here -->
    <slot
      name="context-content"
      :kpi-id="kpiId"
      :kpi-detail-data="kpiDetailData"
      :loading-kpi="loadingKpi"
      :loading-user-assignments="loadingUserAssignments"
      :loading-department-section-assignments="
        loadingDepartmentSectionAssignments
      "
      :user-assignment-error="userAssignmentError"
      :department-section-assignment-error="departmentSectionAssignmentError"
      :all-departments="allDepartments"
      :all-sections="allSections"
      :can-assign-department="canAssignDepartment"
      :can-assign-section="canAssignSection"
      :can-assign-employees="canAssignEmployees"
      :load-detail="loadDetail"
      :context-department-id="contextDepartmentId"
      :context-section-id="contextSectionId"
      :is-company-overview-mode="isCompanyOverviewMode"
      :current-user="currentUser"
      :all-user-assignments-for-kpi="allUserAssignmentsForKpi"
      :department-has-sections="departmentHasSections"
      :has-permission="hasPermission"
    >
    </slot>

    <!-- Common modals -->
    <slot
      name="modals"
      :kpi-id="kpiId"
      :kpi-detail-data="kpiDetailData"
      :loading-kpi="loadingKpi"
      :loading-user-assignments="loadingUserAssignments"
      :loading-department-section-assignments="
        loadingDepartmentSectionAssignments
      "
      :user-assignment-error="userAssignmentError"
      :department-section-assignment-error="departmentSectionAssignmentError"
      :all-departments="allDepartments"
      :all-sections="allSections"
      :can-assign-department="canAssignDepartment"
      :can-assign-section="canAssignSection"
      :can-assign-employees="canAssignEmployees"
      :load-detail="loadDetail"
      :context-department-id="contextDepartmentId"
      :context-section-id="contextSectionId"
      :department-has-sections="departmentHasSections"
    >
    </slot>

    <div style="display: flex; justify-content: flex-end;">
      <a-button type="default" style="margin-top: 15px; margin-bottom: 15px;" @click="goBack">
        {{ $t("back") }}
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";

const { t: $t } = useI18n();

import {
  notification,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Empty as AEmpty,
  Tag as ATag,
  Card as ACard,
  Skeleton as ASkeleton,
  Button as AButton,
  Statistic as AStatistic,
  Row as ARow,
  Col as ACol,
} from "ant-design-vue";
import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
dayjs.extend(LocalizedFormat);
import {
  KpiDefinitionStatusText,
  KpiDefinitionStatusColor,
} from "@/core/constants/kpiStatus";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import WorkflowTimeline from "@/core/components/common/WorkflowTimeline.vue";
import { useNavigation } from "@/core/utils/navigation";
import { FundOutlined } from "@ant-design/icons-vue";
import apiClient from "@/core/services/api";

const router = useRouter();
const { goBack } = useNavigation();
const store = useStore();
const route = useRoute();

const props = defineProps({
  contextType: {
    type: String,
    required: true,
    validator: (value) => ["company", "department", "section"].includes(value),
  },
});

const kpiId = computed(() => {
  const id = route.params.id;
  const parsedId = id ? parseInt(id, 10) : null;
  return !isNaN(parsedId) ? parsedId : null;
});

const contextDepartmentId = computed(() => {
  const id = route.query.contextDepartmentId;
  const parsedId = id ? parseInt(String(id), 10) : null;
  return !isNaN(parsedId) ? parsedId : null;
});

const contextSectionId = computed(() => {
  const id = route.query.contextSectionId;
  return id ? parseInt(id, 10) : null;
});

const isCompanyOverviewMode = computed(() => {
  const noDeptContext = !contextDepartmentId.value;
  const noSectionContext = !contextSectionId.value;
  return noDeptContext && noSectionContext;
});

const loadingKpi = computed(() => store.getters["kpis/isLoading"]);
const kpiDetailData = computed(() => store.getters["kpis/currentKpi"]);
const currentUser = computed(() => store.getters["auth/user"]);
const allUserAssignmentsForKpi = computed(
  () => store.getters["kpis/currentKpiUserAssignments"],
);
const loadingUserAssignments = computed(
  () => store.getters["kpis/isLoadingUserAssignments"],
);
const userAssignmentError = computed(
  () => store.getters["kpis/userAssignmentError"],
);
const toggleStatusError = computed(
  () => store.getters["kpis/toggleKpiStatusError"],
);

const loadingDepartmentSectionAssignments = computed(
  () => store.getters["kpis/isLoadingDepartmentSectionAssignments"] || false,
);
const departmentSectionAssignmentError = computed(
  () => store.getters["kpis/departmentSectionAssignmentError"] || null,
);
const allDepartments = computed(
  () => store.getters["departments/departmentList"] || [],
);
const allSections = computed(() => store.getters["sections/sectionList"] || []);

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || [],
);

/**
 * Helper kiểm tra quyền động RBAC FE (resource:action)
 * @param {string} action
 * @param {string} resource
 * @param {string} scope
 * @returns {boolean}
 */
function hasPermission(action, resource, scope) {
  return userPermissions.value.some(
    (p) =>
      p.action === action &&
      p.resource === resource &&
      (scope ? p.scope === scope : true),
  );
}

const canCopyTemplate = computed(() =>
  hasPermission(RBAC_ACTIONS.COPY_TEMPLATE, RBAC_RESOURCES.KPI, "company"),
);

const canAssignDepartment = computed(() =>
  hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI, "company"),
);

const canAssignSection = computed(() =>
  hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI, "department"),
);

const canAssignEmployees = computed(() =>
  hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI, "section"),
);

const sectionNameFromContext = computed(() => {
  const currentSectionId = contextSectionId.value;
  const currentDepartmentId = contextDepartmentId.value;

  if (currentSectionId !== null) {
    if (!Array.isArray(allSections.value) || allSections.value.length === 0) {
      return "";
    }
    const foundSection = allSections.value.find(
      (s) => String(s.id) === String(currentSectionId),
    );
    return foundSection?.name || "";
  }

  if (currentDepartmentId !== null) {
    if (!Array.isArray(allSections.value) || allSections.value.length === 0) {
      return "";
    }
    const sectionsInDepartment = allSections.value.filter(
      (s) =>
        s.department_id === currentDepartmentId ||
        s.department?.id === currentDepartmentId,
    );

    if (sectionsInDepartment.length === 1) {
      return sectionsInDepartment[0].name || "";
    }

    return "";
  }

  const kpi = kpiDetailData.value;
  if (!kpi) return "";

  if (kpi.created_by_type === "section" && kpi.created_by) {
    const section = allSections.value.find(
      (s) => String(s.id) === String(kpi.created_by),
    );
    return section?.name || "";
  }

  return "";
});

const departmentNameFromSectionContext = computed(() => {
  const currentSectionId = contextSectionId.value;
  const currentDepartmentId = contextDepartmentId.value;

  if (currentSectionId !== null) {
    if (
      !Array.isArray(allSections.value) ||
      allSections.value.length === 0 ||
      !Array.isArray(allDepartments.value) ||
      allDepartments.value.length === 0
    ) {
      return "";
    }
    const section = allSections.value.find(
      (s) => String(s.id) === String(currentSectionId),
    );
    if (!section) {
      return "";
    }

    const departmentId = section.department.id;
    if (departmentId === null || typeof departmentId === "undefined") {
      return "";
    }
    const department = allDepartments.value.find(
      (d) => String(d.id) === String(departmentId),
    );
    if (!department) {
      return "";
    }
    return department.name || "";
  }

  if (currentDepartmentId !== null) {
    if (
      !Array.isArray(allDepartments.value) ||
      allDepartments.value.length === 0
    ) {
      return "";
    }
    const department = allDepartments.value.find(
      (d) => String(d.id) === String(currentDepartmentId),
    );
    return department?.name || "";
  }

  const kpi = kpiDetailData.value;
  if (!kpi) return "";

  if (kpi.created_by_type === "department" && kpi.created_by) {
    const department = allDepartments.value.find(
      (d) => String(d.id) === String(kpi.created_by),
    );
    return department?.name || "";
  }

  if (kpi.created_by_type === "section" && kpi.created_by) {
    const section = allSections.value.find(
      (s) => String(s.id) === String(kpi.created_by),
    );
    if (section?.department) {
      return section.department.name || "";
    }
  }

  return "";
});

const contextTypeLabel = computed(() => {
  const labels = {
    company: $t('companyLabel'),
    department: $t('department'),
    section: $t('section'),
  };
  return labels[props.contextType] || props.contextType;
});

const contextName = computed(() => {
  if (props.contextType === 'section') {
    return sectionNameFromContext.value;
  }
  if (props.contextType === 'department') {
    return departmentNameFromSectionContext.value;
  }
  return '';
});

const departmentHasSections = ref(null);
const assignmentWorkflow = ref(null);
const loadingWorkflow = ref(false);

const relevantAssignment = computed(() => {
  const assignments = kpiDetailData.value?.assignments || [];
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return null;
  }

  if (contextSectionId.value != null) {
    return (
      assignments.find(
        (assignment) => assignment.assigned_to_section === contextSectionId.value,
      ) || null
    );
  }

  if (contextDepartmentId.value != null) {
    return (
      assignments.find(
        (assignment) =>
          assignment.assigned_to_department === contextDepartmentId.value,
      ) || null
    );
  }

  const currentUserId = currentUser.value?.id;
  if (currentUserId != null) {
    return (
      assignments.find(
        (assignment) =>
          assignment.assigned_to_employee === currentUserId ||
          assignment.employee_id === currentUserId,
      ) || assignments[0]
    );
  }

  return assignments[0];
});

const relevantAssignmentId = computed(() => relevantAssignment.value?.id || null);

const displayTargetValue = computed(() => {
  const currentContextSectId = contextSectionId.value;
  const currentContextDeptId = contextDepartmentId.value;
  const kpiData = kpiDetailData.value;
  const assignments = kpiData?.assignments;

  if (!kpiData) return 0;

  if (currentContextSectId !== null && currentContextSectId !== undefined) {
    if (Array.isArray(assignments)) {
      const contextAssignment = assignments.find(
        (assign) => assign.assigned_to_section === currentContextSectId,
      );
      if (
        contextAssignment &&
        typeof contextAssignment.targetValue !== "undefined" &&
        contextAssignment.targetValue !== null
      ) {
        return contextAssignment.targetValue;
      }
    }
  } else if (
    currentContextDeptId !== null &&
    currentContextDeptId !== undefined
  ) {
    if (Array.isArray(assignments)) {
      const contextAssignment = assignments.find(
        (assign) => assign.assigned_to_department === currentContextDeptId,
      );
      if (
        contextAssignment &&
        typeof contextAssignment.targetValue !== "undefined" &&
        contextAssignment.targetValue !== null
      ) {
        return contextAssignment.targetValue;
      }
    }
  }

  return kpiData.target;
});

const overallTargetValueDetail = computed(() => {
  const currentContextSectId = contextSectionId.value;
  const currentContextDeptId = contextDepartmentId.value;
  const kpiData = kpiDetailData.value;
  const assignments = kpiData?.assignments;

  if (!Array.isArray(assignments)) {
    const originalTarget = parseFloat(kpiData?.target);
    return isNaN(originalTarget) ? 0 : originalTarget;
  }

  if (currentContextSectId !== null && currentContextSectId !== undefined) {
    const contextAssignment = assignments.find(
      (assign) => assign.assigned_to_section === currentContextSectId,
    );
    if (
      contextAssignment &&
      typeof contextAssignment.targetValue !== "undefined" &&
      contextAssignment.targetValue !== null
    ) {
      const contextTarget = parseFloat(contextAssignment.targetValue);
      return isNaN(contextTarget) ? 0 : contextTarget;
    }
  } else if (
    currentContextDeptId !== null &&
    currentContextDeptId !== undefined
  ) {
    const contextAssignment = assignments.find(
      (assign) => assign.assigned_to_department === currentContextDeptId,
    );
    if (
      contextAssignment &&
      typeof contextAssignment.targetValue !== "undefined" &&
      contextAssignment.targetValue !== null
    ) {
      const contextTarget = parseFloat(contextAssignment.targetValue);
      return isNaN(contextTarget) ? 0 : contextTarget;
    }
  }

  const originalTarget = parseFloat(kpiData?.target);
  return isNaN(originalTarget) ? 0 : originalTarget;
});

const totalAssignedTargetDetail = computed(() => {
  let total = 0;
  const assignments = kpiDetailData.value?.assignments;
  const userAssignments = allUserAssignmentsForKpi.value;
  const currentContextSectId = contextSectionId.value;
  const currentContextDeptId = contextDepartmentId.value;
  const sectionsData = allSections.value;

  if (currentContextSectId !== null && currentContextSectId !== undefined) {
    if (userAssignments && Array.isArray(userAssignments)) {
      const sectionUserAssignments = userAssignments.filter(
        (assign) =>
          assign.employee && assign.employee.sectionId === currentContextSectId,
      );
      sectionUserAssignments.forEach((assign) => {
        const targetValue = assign.targetValue ?? assign.target;
        if (
          targetValue !== null &&
          targetValue !== undefined &&
          !isNaN(targetValue)
        ) {
          total += Number(targetValue);
        }
      });
      return total;
    } else {
      return 0;
    }
  } else if (
    currentContextDeptId !== null &&
    currentContextDeptId !== undefined
  ) {
    if (!assignments || !Array.isArray(assignments)) {
      return 0;
    }
    if (!sectionsData || !Array.isArray(sectionsData)) {
      return 0;
    }

    // Build section to department mapping
    const sectionToDeptMap = new Map();
    sectionsData.forEach((section) => {
      const sectionId = section?.id;
      const deptId = section?.department?.id ?? section?.department_id;
      if (typeof sectionId === "number" && typeof deptId === "number") {
        sectionToDeptMap.set(sectionId, deptId);
      }
    });

    // Check if department has sections
    const sectionsInDept = Array.from(sectionToDeptMap.entries())
      .filter(([, deptId]) => deptId === currentContextDeptId)
      .map(([sectId]) => sectId);

    const hasSections = sectionsInDept.length > 0;

    assignments.forEach((assign) => {
      // Count section assignments in this department
      const sectionId = assign.assigned_to_section;
      if (sectionId !== null && sectionId !== undefined) {
        const targetValue = assign.targetValue;
        if (
          targetValue !== null &&
          targetValue !== undefined &&
          !isNaN(targetValue)
        ) {
          const assignedSectionId = Number(sectionId);
          if (
            !isNaN(assignedSectionId) &&
            sectionToDeptMap.get(assignedSectionId) === currentContextDeptId
          ) {
            total += Number(targetValue);
          }
        }
      }
      // If department has no sections, also count direct user assignments
      else if (
        !hasSections &&
        assign.assigned_to_employee !== null &&
        assign.assigned_to_employee !== undefined
      ) {
        const empDeptId =
          assign.employee?.departmentId || assign.employee?.department_id;
        const empSectionId =
          assign.employee?.sectionId || assign.employee?.section?.id;
        const targetValue = assign.targetValue;

        // Only count users in this department who don't have sections
        if (
          empDeptId === currentContextDeptId &&
          !empSectionId &&
          targetValue !== null &&
          targetValue !== undefined &&
          !isNaN(targetValue)
        ) {
          total += Number(targetValue);
        }
      }
    });
    return total;
  } else {
    // Company level: Total Assigned = sum of all department assignment targets
    if (!assignments || !Array.isArray(assignments)) {
      return 0;
    }

    // Count all department assignments (with or without section), but exclude employee assignments
    // Use a map to deduplicate: if there are both pure department and department+section assignments
    // for the same department, prefer the pure department assignment
    const departmentMap = new Map();

    assignments.forEach((assign) => {
      const hasDept = assign.assigned_to_department !== null && assign.assigned_to_department !== undefined;
      const hasSection = assign.assigned_to_section !== null && assign.assigned_to_section !== undefined;
      const hasEmployee = assign.assigned_to_employee !== null && assign.assigned_to_employee !== undefined;
      const targetValue = assign.targetValue;

      // Count department assignments (with or without section), but exclude employee assignments
      if (hasDept && !hasEmployee) {
        if (
          targetValue !== undefined &&
          targetValue !== null &&
          !isNaN(targetValue) &&
          Number(targetValue) >= 0
        ) {
          const deptId = assign.assigned_to_department;
          const existing = departmentMap.get(deptId);

          // Prefer pure department assignment over department+section assignment for the same department
          // If no existing entry, or existing has section but current doesn't, use current
          if (!existing || (existing.hasSection && !hasSection)) {
            departmentMap.set(deptId, {
              id: assign.id,
              targetValue: Number(targetValue),
              hasSection: hasSection
            });
          } else if (!existing.hasSection && hasSection) {
            // Keep existing pure department assignment, don't replace with department+section
          } else {
            // Both have section or both don't have section - use the first one encountered
            // (This shouldn't happen in normal cases, but handle it)
            if (!existing.hasSection && !hasSection) {
              // Both are pure department - keep first one
            }
          }
        }
      }
    });

    // Sum up all unique department assignments
    departmentMap.forEach((entry) => {
      total += entry.targetValue;
    });

    return total;
  }
});

const remainingTargetDetail = computed(() => {
  const overall = parseFloat(overallTargetValueDetail.value);
  const assigned = parseFloat(totalAssignedTargetDetail.value);
  const validOverall = isNaN(overall) ? 0 : overall;
  const validAssigned = isNaN(assigned) ? 0 : assigned;
  const difference = validOverall - validAssigned;
  return parseFloat(difference.toFixed(5));
});

const isOverAssignedDetail = computed(() => {
  return remainingTargetDetail.value < -1e-9;
});

const shouldShowAssignmentStats = computed(() => {
  const kpi = kpiDetailData.value;
  if (!kpi) return false;

  return (
    (kpi.created_by_type === "company" ||
      kpi.created_by_type === "department") &&
    (kpi.assignments?.length > 0 || overallTargetValueDetail.value > 0)
  );
});

const getKpiDefinitionStatusText = (status) =>
  KpiDefinitionStatusText($t)[status] || status || "";

const getKpiDefinitionStatusColor = (status) =>
  KpiDefinitionStatusColor[status] || "default";

const getFrequencyText = (frequency) => {
  if (!frequency) return "";
  return $t(frequency) || frequency;
};

const clearToggleError = () => {
  store.commit("kpis/SET_TOGGLE_KPI_STATUS_ERROR", null);
};

const fetchWorkflow = async () => {
  if (!relevantAssignmentId.value) {
    assignmentWorkflow.value = null;
    return;
  }

  loadingWorkflow.value = true;
  try {
    const response = await apiClient.get(
      `/kpi-assignments/${relevantAssignmentId.value}/workflow`,
    );
    assignmentWorkflow.value = response.data;
  } catch (error) {
    assignmentWorkflow.value = null;
    console.error("Failed to load assignment workflow:", error);
  } finally {
    loadingWorkflow.value = false;
  }
};

const copyKpiAsTemplate = () => {
  if (kpiDetailData.value?.id) {
    router.push({
      path: "/kpis/create",
      query: {
        templateKpiId: kpiDetailData.value.id,
        isCopy: true,
      },
    });
  } else {
    notification.warning({
      message: "Cannot copy: KPI ID not available.",
    });
  }
};

const loadDetail = async () => {
  const id = kpiId.value;
  if (id && !isNaN(id)) {
    await store.dispatch("kpis/fetchKpiDetail", id);

    store.commit("kpis/SET_TOGGLE_KPI_STATUS_ERROR", null);
  } else {
    console.error(
      "KpiDetail: Invalid KPI ID from route params:",
      route.params.id,
    );
  }
};

const fetchKpiUserAssignmentsData = async (id) => {
  if (!id || typeof id !== "number") {
    store.commit("kpis/SET_KPI_USER_ASSIGNMENTS", []);
    return;
  }
  try {
    await store.dispatch("kpis/fetchKpiUserAssignments", id);
  } catch (error) {
    console.error("Error dispatching fetchKpiUserAssignments:", error);
    /* Lỗi đã được set trong store */
  }
};

watch(
  kpiDetailData,
  async (newDetail, oldDetail) => {
    const newKpiId = newDetail?.id;
    const oldKpiId = oldDetail?.id;
    if (newKpiId && typeof newKpiId === "number" && newKpiId !== oldKpiId) {
      store.commit("kpis/SET_KPI_USER_ASSIGNMENTS", []);
      try {
        await Promise.all([
          store.dispatch("sections/fetchSections", { forceRefresh: true }),
          store.dispatch("departments/fetchDepartments", {
            forceRefresh: true,
          }),
        ]);
      } catch (fetchError) {
        console.error("Error fetching all sections/departments:", fetchError);
        notification.error({
          message: $t("couldNotLoadSectionsDepartments"),
        });
      }

      departmentHasSections.value = null;
      if (newDetail.created_by_type === "department" && newDetail.created_by) {
        const departmentId = newDetail.created_by;
        const allDepartmentsList = allDepartments.value;

        const kpiDepartment = Array.isArray(allDepartmentsList)
          ? allDepartmentsList.find((d) => d.id == departmentId)
          : undefined;

        if (kpiDepartment) {
          try {
            const sections = await store.dispatch("sections/fetchSections", {
              params: { department_id: departmentId },
              limit: 1,
              forceRefresh: true,
            });
            const sectionData =
              sections?.data?.data || sections?.data || sections;
            departmentHasSections.value =
              Array.isArray(sectionData) && sectionData.length > 0;
          } catch (e) {
            departmentHasSections.value = null;
            console.error(
              "Error checking sections for department:",
              departmentId,
              e,
            );
          }
        } else {
          departmentHasSections.value = null;
        }
      } else {
        departmentHasSections.value = null;
      }

      await fetchKpiUserAssignmentsData(newKpiId);
    } else if (!newKpiId && oldKpiId) {
      store.commit("kpis/SET_KPI_USER_ASSIGNMENTS", []);
      departmentHasSections.value = null;
    }
  },
  {
    deep: false,
  },
);

watch(kpiId, (newId, oldId) => {
  if (newId !== oldId && newId !== null && !isNaN(newId)) {
    loadDetail();
  }
});

watch(
  relevantAssignmentId,
  () => {
    fetchWorkflow();
  },
  { immediate: true },
);

onMounted(loadDetail);

const formatDate = (dateString) => {
  if (!dateString) return "";
  return dayjs(dateString).format("DD/MM/YYYY");
};

defineExpose({
  kpiId,
  contextDepartmentId,
  contextSectionId,
  isCompanyOverviewMode,
  kpiDetailData,
  currentUser,
  allUserAssignmentsForKpi,
  loadingUserAssignments,
  userAssignmentError,
  allDepartments,
  allSections,
  departmentHasSections,
  hasPermission,
  canAssignDepartment,
  canAssignSection,
  canAssignEmployees,
  loadDetail,
  fetchKpiUserAssignmentsData,
});
</script>

<style scoped>
.kpi-detail-card {
  box-shadow: 0 2px 8px #0001;
  border-radius: 8px;
  margin-bottom: 20px;
}

.kpi-detail-card :deep(.ant-card-head) {
  background: #fff7e6;
  border-radius: 8px 8px 0 0;
  border: none;
}

.kpi-detail-card :deep(.ant-card-body) {
  padding: 16px;
  border-radius: 0 0 8px 8px;
  background: #fff;
}

.kpi-detail-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kpi-detail-title-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
}

.kpi-detail-title-icon {
  color: #fa8c16;
  font-size: 24px;
}

.kpi-detail-kpi-name {
  font-size: 1.2em;
  font-weight: 700;
  color: #000;
}

.ant-descriptions-item-label {
  font-weight: bold;
}

p {
  margin-bottom: 0.5em;
}
</style>
