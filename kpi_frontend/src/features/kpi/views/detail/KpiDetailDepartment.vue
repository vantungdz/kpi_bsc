<template>
  <KpiDetailBase context-type="department">
    <template #context-content="slotProps">
      <!-- DEPARTMENT CONTEXT ASSIGNMENT CARDS -->
      <a-card
        :title="$t('manageDepartmentSectionAssignments')"
        style="margin-top: 20px"
        v-if="
          shouldShowDepartmentSectionAssignmentCard(slotProps) &&
          slotProps.canAssignSection
        "
      >
        <template #extra>
          <a-button
            type="primary"
            @click="openManageDepartmentSectionAssignments"
          >
            <template #icon>
              <plus-outlined />
            </template>
            {{ $t("addAssignment") }}
          </a-button>
        </template>
        <a-skeleton
          :loading="slotProps.loadingDepartmentSectionAssignments"
          active
          :paragraph="{ rows: 4 }"
        >
          <a-table
            :columns="departmentSectionAssignmentColumns"
            :data-source="filteredAssignmentsForContextDepartment(slotProps)"
            row-key="id"
            size="small"
            bordered
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'assignedUnit'">
                <span v-if="record.section"
                  >{{ record.section.name }} ({{ $t("section") }})</span
                >
                <span v-else-if="record.department"
                  >{{ record.department.name }} ({{ $t("department") }})</span
                >
                <span v-else></span>
              </template>
              <template v-else-if="column.key === 'targetValue'">
                {{ Number(record.targetValue).toLocaleString() ?? "-" }}
                <span v-if="slotProps.kpiDetailData?.unit">
                  {{ slotProps.kpiDetailData.unit }}</span
                >
              </template>

              <template v-else-if="column.key === 'actual'">
                {{ Number(record.latest_actual_value).toLocaleString() ?? "-" }}
                <span v-if="slotProps.kpiDetailData?.unit">
                  {{ slotProps.kpiDetailData.unit }}</span
                >
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getAssignmentStatusColor(record.status)">
                  {{ getAssignmentStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="$t('editAssignment')">
                    <a-button
                      type="primary"
                      ghost
                      shape="circle"
                      size="small"
                      @click="openEditDepartmentSectionAssignment(record)"
                    >
                      <edit-outlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteAssignment')">
                    <a-button
                      danger
                      shape="circle"
                      size="small"
                      @click="confirmDeleteDepartmentSectionAssignment(record)"
                    >
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
          <a-empty
            v-show="
              currentDepartmentSectionAssignments(slotProps).length === 0 &&
              !slotProps.loadingDepartmentSectionAssignments
            "
            :description="$t('noDepartmentSectionAssignments')"
          />
        </a-skeleton>
      </a-card>

      <a-card
        :title="$t('manageDirectUserAssignments')"
        style="margin-top: 20px"
        v-if="
          shouldShowUserAssignmentsInDepartmentSectionsCard(slotProps) &&
          slotProps.canAssignEmployees
        "
      >
        <template #extra>
          <a-button
            type="primary"
            @click="openAssignUsersInDeptSectionsModal"
            :disabled="
              slotProps.loadingUserAssignments || !slotProps.kpiDetailData?.id
            "
          >
            <template #icon>
              <user-add-outlined />
            </template>
            {{ $t("addEditUserAssignment") }}
          </a-button>
        </template>
        <a-skeleton
          :loading="slotProps.loadingUserAssignments"
          active
          :paragraph="{ rows: 4 }"
        >
          <a-alert
            v-if="slotProps.userAssignmentError"
            :message="slotProps.userAssignmentError"
            type="error"
            show-icon
            closable
            @close="clearAssignmentError"
            style="margin-bottom: 16px"
          />
          <a-table
            :columns="userAssignmentColumns"
            :data-source="
              filteredUserAssignmentsInDepartmentSections(slotProps)
            "
            row-key="id"
            size="small"
            bordered
            :pagination="false"
            style="min-height: 180px"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'user'">
                <a-avatar
                  :src="record.employee?.avatar_url"
                  size="small"
                  style="margin-right: 8px"
                >
                  {{ record.employee?.first_name?.charAt(0) }}
                </a-avatar>
                {{ record.employee?.first_name }}
                {{ record.employee?.last_name }}
              </template>
              <template v-else-if="column.key === 'target'">
                {{ Number(record.targetValue).toLocaleString() }}
                {{ slotProps.kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'actual'">
                {{ Number(record.latest_actual_value).toLocaleString() ?? "" }}
                {{ slotProps.kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getAssignmentStatusColor(record.status)">
                  {{ getAssignmentStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="$t('editAssignment')">
                    <a-button
                      type="primary"
                      ghost
                      shape="circle"
                      size="small"
                      @click="openEditUserModal(record)"
                    >
                      <edit-outlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteAssignment')">
                    <a-button
                      danger
                      shape="circle"
                      size="small"
                      @click="confirmDeleteUserAssignment(record)"
                    >
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-skeleton>
      </a-card>

      <a-card
        :title="$t('manageDirectUserAssignments')"
        style="margin-top: 20px"
        v-if="
          shouldShowDirectUserAssignmentCard(slotProps) &&
          slotProps.canAssignEmployees
        "
      >
        <template #extra>
          <a-button
            type="primary"
            @click="openAssignUserModal"
            :disabled="
              slotProps.loadingUserAssignments || !slotProps.kpiDetailData?.id
            "
          >
            <template #icon>
              <user-add-outlined />
            </template>
            {{ $t("addEditUserAssignment") }}
          </a-button>
        </template>
        <a-skeleton
          :loading="slotProps.loadingUserAssignments"
          active
          :paragraph="{ rows: 4 }"
        >
          <a-alert
            v-if="slotProps.userAssignmentError"
            :message="slotProps.userAssignmentError"
            type="error"
            show-icon
            closable
            @close="clearAssignmentError"
            style="margin-bottom: 16px"
          />
          <a-table
            v-show="filteredDirectUserAssignments(slotProps).length > 0"
            :columns="userAssignmentColumns"
            :data-source="filteredDirectUserAssignments(slotProps)"
            row-key="id"
            size="small"
            bordered
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'user'">
                <a-avatar
                  :src="record.employee?.avatar_url"
                  size="small"
                  style="margin-right: 8px"
                >
                  {{ record.employee?.first_name?.charAt(0) }}
                </a-avatar>
                {{ record.employee?.first_name }}
                {{ record.employee?.last_name }} ({{
                  record.employee?.username
                }})
              </template>
              <template v-else-if="column.key === 'target'">
                {{ Number(record.targetValue).toLocaleString() }}
                {{ slotProps.kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'actual'">
                {{ Number(record.latest_actual_value).toLocaleString() ?? "" }}
                {{ slotProps.kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getAssignmentStatusColor(record.status)">
                  {{ getAssignmentStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="$t('editAssignment')">
                    <a-button
                      type="primary"
                      ghost
                      shape="circle"
                      size="small"
                      @click="openEditUserModal(record)"
                    >
                      <edit-outlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteAssignment')">
                    <a-button
                      danger
                      shape="circle"
                      size="small"
                      @click="confirmDeleteUserAssignment(record)"
                    >
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
          <a-empty
            v-if="
              companyOverviewUserAssignments(slotProps).length === 0 &&
              !slotProps.loadingUserAssignments
            "
            :description="$t('noDirectUserAssignments')"
          />
        </a-skeleton>
      </a-card>
    </template>

    <template #modals="slotProps">
      <!-- Department-specific modals -->
      <DepartmentAssignmentModals
        ref="departmentAssignmentModalsRef"
        :kpi-id="slotProps.kpiId"
        :kpi-detail-data="slotProps.kpiDetailData"
        :loading-kpi="slotProps.loadingKpi"
        :loading-user-assignments="slotProps.loadingUserAssignments"
        :loading-department-section-assignments="
          slotProps.loadingDepartmentSectionAssignments
        "
        :user-assignment-error="slotProps.userAssignmentError"
        :department-section-assignment-error="
          slotProps.departmentSectionAssignmentError
        "
        :all-departments="slotProps.allDepartments"
        :all-sections="slotProps.allSections"
        :context-department-id="slotProps.contextDepartmentId"
        :can-assign-section="slotProps.canAssignSection"
        :can-assign-employees="slotProps.canAssignEmployees"
        :department-has-sections="slotProps.departmentHasSections"
        @refresh="slotProps.loadDetail"
      />
    </template>
  </KpiDetailBase>
</template>

<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import KpiDetailBase from "./KpiDetailBase.vue";
import DepartmentAssignmentModals from "../components/DepartmentAssignmentModals.vue";
import {
  Table as ATable,
  Tag as ATag,
  Card as ACard,
  Skeleton as ASkeleton,
  Button as AButton,
  Space as ASpace,
  Tooltip as ATooltip,
  Avatar as AAvatar,
  Alert as AAlert,
  Empty as AEmpty,
} from "ant-design-vue";
import {
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
  PlusOutlined,
} from "@ant-design/icons-vue";
import {
  KpiDefinitionStatus,
  KpiDefinitionStatusText,
} from "@/core/constants/kpiStatus";

const { t: $t } = useI18n();

// Refs for modals
const departmentAssignmentModalsRef = ref(null);

const currentDepartmentSectionAssignments = (slotProps) => {
  return (
    slotProps.kpiDetailData?.assignments?.filter(
      (assign) =>
        assign.assigned_to_department !== null ||
        assign.assigned_to_section !== null
    ) || []
  );
};

const filteredAssignmentsForContextDepartment = (slotProps) => {
  const allAssignments = slotProps.kpiDetailData?.assignments;
  const deptIdContext = slotProps.contextDepartmentId;

  const sectionToDeptMap = new Map();
  slotProps.allSections.forEach((section) => {
    const sectionId = section?.id;

    const deptId = section?.department?.id ?? section?.department_id;
    if (typeof sectionId === "number" && typeof deptId === "number") {
      sectionToDeptMap.set(sectionId, deptId);
    }
  });

  if (
    deptIdContext === null ||
    deptIdContext === undefined ||
    !Array.isArray(allAssignments)
  ) {
    return [];
  }

  return allAssignments.filter((assign) => {
    if (
      assign.assigned_to_section !== null &&
      assign.assigned_to_section !== undefined
    ) {
      const sectionId = Number(assign.assigned_to_section);
      if (
        !isNaN(sectionId) &&
        sectionToDeptMap.get(sectionId) === deptIdContext
      ) {
        return true;
      }
    }

    return false;
  });
};

const shouldShowDepartmentSectionAssignmentCard = (slotProps) => {
  const kpi = slotProps.kpiDetailData;
  const hasDeptContext = !!slotProps.contextDepartmentId;
  const hasSectionContext = !!slotProps.contextSectionId;

  if (!kpi || hasSectionContext) {
    return false;
  }

  if (hasDeptContext) {
    return true;
  }

  if (
    kpi.created_by_type !== "company" &&
    kpi.created_by_type !== "department"
  ) {
    return false;
  }

  if (kpi.created_by_type === "department") {
    const deptHasSections = slotProps.departmentHasSections;
    if (deptHasSections === null) {
      return false;
    }
    if (deptHasSections === false) {
      return false;
    }
  }
  return true;
};

const filteredDirectUserAssignments = (slotProps) => {
  const allAssignments = slotProps.kpiDetailData?.assignments;
  const kpi = slotProps.kpiDetailData;

  const currentDeptId =
    kpi?.created_by_type === "department" ? kpi?.created_by : null;

  if (
    !kpi ||
    kpi.created_by_type !== "department" ||
    !currentDeptId ||
    !Array.isArray(allAssignments)
  ) {
    return [];
  }

  return allAssignments.filter((assign) => {
    const isUserAssignment = assign.assigned_to_employee !== null;

    let employeeDepartmentId = assign.employee?.departmentId;
    let employeeHasSection =
      assign.employee?.sectionId !== null &&
      assign.employee?.sectionId !== undefined;

    return (
      isUserAssignment &&
      employeeDepartmentId === currentDeptId &&
      !employeeHasSection
    );
  });
};

const filteredUserAssignmentsInDepartmentSections = (slotProps) => {
  const allAssignments = slotProps.kpiDetailData?.assignments;
  const deptId = slotProps.contextDepartmentId;
  const sections = slotProps.allSections;

  if (!deptId || !Array.isArray(allAssignments) || !Array.isArray(sections)) {
    return [];
  }

  const sectionIdsInDept = sections
    .filter(
      (s) =>
        s.department_id === deptId ||
        (s.department && s.department.id === deptId)
    )
    .map((s) => s.id);

  return allAssignments.filter((assign) => {
    const isUserAssignment = assign.assigned_to_employee !== null;
    const sectionId = assign.employee?.sectionId;
    return (
      isUserAssignment &&
      sectionId !== null &&
      sectionId !== undefined &&
      sectionIdsInDept.includes(sectionId)
    );
  });
};

const shouldShowUserAssignmentsInDepartmentSectionsCard = (slotProps) => {
  const deptId = slotProps.contextDepartmentId;
  if (!deptId) return false;

  const sections = slotProps.allSections.filter(
    (s) =>
      s.department_id === deptId || (s.department && s.department.id === deptId)
  );
  if (sections.length === 0) return false;

  if (!slotProps.hasPermission("ASSIGN", "KPI", "section")) return false;

  return true;
};

const shouldShowDirectUserAssignmentCard = (slotProps) => {
  const kpi = slotProps.kpiDetailData;

  if (!kpi || kpi.created_by_type !== "department") {
    return false;
  }

  const departmentId = kpi.created_by;
  const allDepartmentsList = slotProps.allDepartments;

  const kpiDepartment = Array.isArray(allDepartmentsList)
    ? allDepartmentsList.find((d) => d.id == departmentId)
    : undefined;

  if (!kpiDepartment) {
    return false;
  }

  const deptHasSections = slotProps.departmentHasSections;
  if (deptHasSections === null || deptHasSections === true) {
    return false;
  }

  if (!slotProps.hasPermission("ASSIGN", "KPI", "section")) return false;

  return true;
};

const companyOverviewUserAssignments = (slotProps) => {
  if (!slotProps.kpiDetailData?.assignments) return [];

  const assignmentsArray = Array.isArray(slotProps.kpiDetailData?.assignments)
    ? slotProps.kpiDetailData.assignments
    : [];

  return assignmentsArray.filter((a) => a.assigned_to_employee);
};

const departmentSectionAssignmentColumns = computed(() => [
  { title: $t("assignedUnit"), key: "assignedUnit", width: "30%" },
  {
    title: $t("targetValue"),
    key: "targetValue",
    dataIndex: "targetValue",
    width: "15%",
    align: "right",
  },
  {
    title: $t("latestActual"),
    key: "actual",
    dataIndex: "latest_actual_value",
    width: "15%",
    align: "right",
  },
  {
    title: $t("status"),
    key: "status",
    dataIndex: "status",
    width: "15%",
    align: "center",
  },
  {
    title: $t("common.actions"),
    key: "actions",
    align: "center",
    width: "150px",
  },
]);

const userAssignmentColumns = computed(() => [
  {
    title: $t("user"),
    key: "user",
    dataIndex: "user",
    width: "30%",
  },
  {
    title: $t("target"),
    key: "target",
    dataIndex: "target",
    align: "right",
    width: "15%",
  },
  {
    title: $t("latestActual"),
    key: "actual",
    dataIndex: "latest_actual_value",
    align: "right",
    width: "15%",
  },
  {
    title: $t("status"),
    key: "status",
    dataIndex: "status",
    align: "center",
    width: "15%",
  },
  {
    title: $t("common.actions"),
    key: "actions",
    align: "center",
    width: "150px",
  },
]);

const getAssignmentStatusText = (status) => {
  return KpiDefinitionStatusText($t)[status] || status || "";
};

const getAssignmentStatusColor = (status) => {
  if (status === KpiDefinitionStatus.APPROVED) return "success";
  if (status === KpiDefinitionStatus.DRAFT) return "default";
  return "default";
};

const clearAssignmentError = () => {
  // This will be handled by the modals component
};

// Modal handlers - these will be handled by DepartmentAssignmentModals component
const openManageDepartmentSectionAssignments = () => {
  departmentAssignmentModalsRef.value?.openManageDepartmentSectionAssignments();
};

const openEditDepartmentSectionAssignment = (record) => {
  departmentAssignmentModalsRef.value?.openEditDepartmentSectionAssignment(
    record
  );
};

const confirmDeleteDepartmentSectionAssignment = (record) => {
  departmentAssignmentModalsRef.value?.confirmDeleteDepartmentSectionAssignment(
    record
  );
};

const openAssignUsersInDeptSectionsModal = () => {
  departmentAssignmentModalsRef.value?.openAssignUsersInDeptSectionsModal();
};

const openAssignUserModal = () => {
  departmentAssignmentModalsRef.value?.openAssignUserModal();
};

const openEditUserModal = (record) => {
  departmentAssignmentModalsRef.value?.openEditUserModal(record);
};

const confirmDeleteUserAssignment = (record) => {
  departmentAssignmentModalsRef.value?.confirmDeleteUserAssignment(record);
};
</script>

<style scoped>
.ant-descriptions-item-label {
  font-weight: bold;
}

p {
  margin-bottom: 0.5em;
}
</style>
