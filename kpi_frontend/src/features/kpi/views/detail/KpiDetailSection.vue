<template>
  <KpiDetailBase context-type="section">
    <template #context-content="slotProps">
      <!-- SECTION CONTEXT ASSIGNMENT CARDS -->
      <a-card
        :title="$t('manageUserAssignments')"
        style="margin-top: 20px"
        v-if="shouldShowSectionUserAssignmentCard(slotProps)"
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
            v-show="filteredSectionUserAssignments(slotProps).length > 0"
            :columns="userAssignmentColumns"
            :data-source="filteredSectionUserAssignments(slotProps)"
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
                {{ Number(record.latest_actual_value).toLocaleString() ?? "0" }}
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
            v-show="filteredSectionUserAssignments(slotProps).length === 0"
            :description="$t('noSectionUserAssignmentsYet')"
          />
        </a-skeleton>
      </a-card>
    </template>

    <template #modals="slotProps">
      <!-- Section-specific modals -->
      <SectionAssignmentModals
        ref="sectionAssignmentModalsRef"
        :kpi-id="slotProps.kpiId"
        :kpi-detail-data="slotProps.kpiDetailData"
        :loading-kpi="slotProps.loadingKpi"
        :loading-user-assignments="slotProps.loadingUserAssignments"
        :user-assignment-error="slotProps.userAssignmentError"
        :all-departments="slotProps.allDepartments"
        :all-sections="slotProps.allSections"
        :context-section-id="slotProps.contextSectionId"
        :can-assign-employees="slotProps.canAssignEmployees"
        :section-id-for-user-assignments-card="
          sectionIdForUserAssignmentsCard(slotProps)
        "
        @refresh="slotProps.loadDetail"
      />
    </template>
  </KpiDetailBase>
</template>

<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import KpiDetailBase from "./KpiDetailBase.vue";
import SectionAssignmentModals from "../components/SectionAssignmentModals.vue";
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
} from "@ant-design/icons-vue";
import {
  KpiDefinitionStatus,
  KpiDefinitionStatusText,
} from "@/core/constants/kpiStatus";

const { t: $t } = useI18n();

// Refs for modals
const sectionAssignmentModalsRef = ref(null);

const sectionIdForUserAssignmentsCard = (slotProps) => {
  if (slotProps.contextDepartmentId) {
    const sectionsInDepartment = slotProps.allSections.filter(
      (section) =>
        section.department_id === slotProps.contextDepartmentId ||
        section.department?.id === slotProps.contextDepartmentId
    );
    if (sectionsInDepartment.length > 0) {
      return sectionsInDepartment[0].id;
    }
  }

  if (slotProps.contextSectionId) {
    return slotProps.contextSectionId;
  }

  if (slotProps.currentUser?.sectionId) {
    return slotProps.currentUser.sectionId;
  }

  if (
    slotProps.kpiDetailData?.created_by_type === "section" &&
    slotProps.kpiDetailData?.created_by
  ) {
    return slotProps.kpiDetailData.created_by;
  }

  return null;
};

const filteredSectionUserAssignments = (slotProps) => {
  const allAssignments = slotProps.kpiDetailData?.assignments;
  const sectionIdToFilterBy = sectionIdForUserAssignmentsCard(slotProps);

  if (!Array.isArray(allAssignments)) {
    return [];
  }

  // In section context, show user assignments that belong to this section
  return allAssignments.filter((assign) => {
    const isUserAssignment = assign.assigned_to_employee !== null;

    if (!isUserAssignment) {
      return false;
    }

    // If we have a specific section to filter by, check if employee belongs to that section
    if (sectionIdToFilterBy && assign.employee?.sectionId) {
      return Number(assign.employee.sectionId) === Number(sectionIdToFilterBy);
    }

    // If no specific section filter, show all user assignments
    return true;
  });
};

const shouldShowSectionUserAssignmentCard = (slotProps) => {
  const kpi = slotProps.kpiDetailData;
  const user = slotProps.currentUser;
  const sectionId = sectionIdForUserAssignmentsCard(slotProps);

  if (!kpi || !user || !sectionId) return false;

  // Use canAssignEmployees instead of checking permission directly
  if (!slotProps.canAssignEmployees) return false;

  return true;
};

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

// Modal handlers - these will be handled by SectionAssignmentModals component
const openAssignUserModal = () => {
  sectionAssignmentModalsRef.value?.openAssignUserModal();
};

const openEditUserModal = (record) => {
  sectionAssignmentModalsRef.value?.openEditUserModal(record);
};

const confirmDeleteUserAssignment = (record) => {
  sectionAssignmentModalsRef.value?.confirmDeleteUserAssignment(record);
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
