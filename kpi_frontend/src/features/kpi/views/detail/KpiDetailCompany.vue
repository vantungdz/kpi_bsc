<template>
  <KpiDetailBase context-type="company">
    <template #context-content="slotProps">
      <!-- COMPANY OVERVIEW MODE CARDS -->
      <a-card
        :title="$t('departmentAssignments')"
        style="margin-top: 20px"
        v-if="slotProps.canAssignDepartment"
      >
        <template #extra>
          <a-button
            type="primary"
            @click="openManageDepartmentSectionAssignments"
          >
            <plus-outlined /> {{ $t("addDepartmentAssignment") }}
          </a-button>
        </template>
        <a-skeleton
          :loading="slotProps.loadingKpi"
          active
          :paragraph="{ rows: 3 }"
        >
          <a-table
            :columns="departmentSectionAssignmentColumns"
            :data-source="companyOverviewDepartmentAssignments(slotProps)"
            row-key="id"
            size="small"
            bordered
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'assignedUnit'">
                <span v-if="record.department">{{
                  record.department.name
                }}</span>
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
                {{ slotProps.kpiDetailData?.unit }}
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
              <template v-else>
                <span>{{ record[column.dataIndex] }}</span>
              </template>
            </template>
          </a-table>
        </a-skeleton>
      </a-card>

      <a-card
        :title="$t('sectionAssignments')"
        style="margin-top: 20px"
        v-if="slotProps.canAssignSection"
      >
        <template #extra>
          <a-button
            type="primary"
            @click="openManageDepartmentSectionAssignments"
          >
            <plus-outlined /> {{ $t("addSectionAssignment") }}
          </a-button>
        </template>
        <a-skeleton
          :loading="slotProps.loadingKpi"
          active
          :paragraph="{ rows: 3 }"
        >
          <a-table
            :columns="departmentSectionAssignmentColumns"
            :data-source="companyOverviewSectionAssignments(slotProps)"
            row-key="id"
            size="small"
            bordered
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'assignedUnit'">
                <span v-if="record.section">
                  {{ record.section.name }}
                  <span
                    v-if="record.section.department"
                    style="font-size: 0.9em; color: #888"
                  >
                    ({{ $t("dept") }}: {{ record.section.department.name }})
                  </span>
                </span>
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
                {{ slotProps.kpiDetailData?.unit }}
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
        </a-skeleton>
      </a-card>

      <a-card
        :title="$t('directUserAssignments')"
        style="margin-top: 20px"
        v-if="slotProps.canAssignEmployees"
      >
        <template #extra>
          <a-button type="primary" @click="openAssignUserModal">
            <user-add-outlined /> {{ $t("addUserAssignment") }}
          </a-button>
        </template>
        <a-skeleton
          :loading="slotProps.loadingUserAssignments"
          active
          :paragraph="{ rows: 3 }"
        >
          <a-table
            :columns="userAssignmentColumns"
            :data-source="companyOverviewUserAssignments(slotProps)"
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
                {{ record.employee?.last_name }}
                <span style="font-size: 0.9em; color: #888">
                  ({{ record.employee?.username }})
                  <template v-if="record.employee?.section">
                    - {{ $t("section") }}: {{ record.employee.section.name }}
                  </template>
                  <template v-else-if="record.employee?.department">
                    - {{ $t("dept") }}: {{ record.employee.department.name }}
                  </template>
                </span>
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
    </template>

    <template #modals="slotProps">
      <!-- Company-specific modals -->
      <CompanyAssignmentModals
        ref="companyAssignmentModalsRef"
        :kpi-id="slotProps.kpiId"
        :kpi-detail-data="slotProps.kpiDetailData"
        :loading-kpi="slotProps.loadingKpi"
        :loading-user-assignments="slotProps.loadingUserAssignments"
        :user-assignment-error="slotProps.userAssignmentError"
        :all-departments="slotProps.allDepartments"
        :all-sections="slotProps.allSections"
        :can-assign-department="slotProps.canAssignDepartment"
        :can-assign-section="slotProps.canAssignSection"
        :can-assign-employees="slotProps.canAssignEmployees"
        @refresh="slotProps.loadDetail"
      />
    </template>
  </KpiDetailBase>
</template>

<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import KpiDetailBase from "./KpiDetailBase.vue";
import CompanyAssignmentModals from "../components/CompanyAssignmentModals.vue";
import {
  Table as ATable,
  Tag as ATag,
  Card as ACard,
  Skeleton as ASkeleton,
  Button as AButton,
  Space as ASpace,
  Tooltip as ATooltip,
  Avatar as AAvatar,
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
const companyAssignmentModalsRef = ref(null);

const companyOverviewDepartmentAssignments = (slotProps) => {
  const assignmentsArray = Array.isArray(slotProps.kpiDetailData?.assignments)
    ? slotProps.kpiDetailData.assignments
    : [];

  return assignmentsArray.filter(
    (a) =>
      a.assigned_to_department &&
      (!a.assigned_to_section || a.assigned_to_section === null) &&
      (!a.assigned_to_employee || a.assigned_to_employee === null)
  );
};

const companyOverviewSectionAssignments = (slotProps) => {
  if (!slotProps.kpiDetailData?.assignments) return [];

  const assignmentsArray = Array.isArray(slotProps.kpiDetailData?.assignments)
    ? slotProps.kpiDetailData.assignments
    : [];

  const sectionsList = slotProps.allSections;

  return assignmentsArray
    .filter(
      (a) =>
        a.assigned_to_section &&
        (!a.assigned_to_employee || a.assigned_to_employee === null)
    )
    .map((a) => ({
      ...a,
      section: Array.isArray(sectionsList)
        ? sectionsList.find((s) => s.id === a.assigned_to_section) || a.section
        : a.section,
    }));
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

// Modal handlers - these will be handled by CompanyAssignmentModals component
const openManageDepartmentSectionAssignments = () => {
  companyAssignmentModalsRef.value?.openManageDepartmentSectionAssignments();
};

const openEditDepartmentSectionAssignment = (record) => {
  companyAssignmentModalsRef.value?.openEditDepartmentSectionAssignment(record);
};

const confirmDeleteDepartmentSectionAssignment = (record) => {
  companyAssignmentModalsRef.value?.confirmDeleteDepartmentSectionAssignment(
    record
  );
};

const openAssignUserModal = () => {
  companyAssignmentModalsRef.value?.openAssignUserModal();
};

const openEditUserModal = (record) => {
  companyAssignmentModalsRef.value?.openEditUserModal(record);
};

const confirmDeleteUserAssignment = (record) => {
  companyAssignmentModalsRef.value?.confirmDeleteUserAssignment(record);
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
