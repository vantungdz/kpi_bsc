<template>
  <div class="personal-goal-employee-list-page">
    <div class="list-header-modern">
      <schedule-outlined class="header-icon" />
      <div>
        <h4>{{ t("personalGoal.employeeGoalManagement") }}</h4>
        <div class="header-desc">{{ t("personalGoal.employeeGoals") }}</div>
      </div>
    </div>
    <a-card class="filter-card-modern">
      <a-row :gutter="[22]">
        <a-col :span="5">
          <a-form-item :label="t('kpiEmployee.department')">
            <a-select
              v-model:value="employeeFilters.departmentId"
              style="width: 100%"
              :disabled="isDepartmentRole || isSectionRole"
            >
              <template #suffixIcon><team-outlined /></template>
              <a-select-option value="">{{ t("common.all") }}</a-select-option>
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
        <a-col :span="5">
          <a-form-item :label="t('kpiEmployee.section')">
            <a-select
              v-model:value="employeeFilters.sectionId"
              style="width: 100%"
              :disabled="isSectionRole"
            >
              <template #suffixIcon><apartment-outlined /></template>
              <a-select-option value="">{{ t("common.all") }}</a-select-option>
              <a-select-option
                v-for="section in sectionList"
                :key="section.id"
                :value="section.id"
              >
                {{ section.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item :label="t('kpiEmployee.employeeName')">
            <a-select
              v-model:value="employeeFilters.name"
              show-search
              allow-clear
              :placeholder="t('kpiEmployee.selectEmployee')"
              :filter-option="filterEmployeeOption"
              style="width: 100%"
            >
              <template #suffixIcon><user-outlined /></template>
              <a-select-option
                v-for="emp in filteredEmployees"
                :key="emp.id"
                :value="emp.first_name + ' ' + emp.last_name"
              >
                <a-avatar
                  :size="20"
                  :src="emp.avatar || undefined"
                  style="margin-right: 6px"
                />
                {{ emp.first_name }} {{ emp.last_name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8" style="text-align: right">
          <a-button
            type="primary"
            @click="applyEmployeeFilters"
            :loading="loadingEmployees"
          >
            <template #icon><filter-outlined /></template>
            {{ t("common.apply") }}
          </a-button>
          <a-button
            @click="resetEmployeeFilters"
            :loading="loadingEmployees"
            style="margin-left: 8px"
          >
            <template #icon><reload-outlined /></template>
            {{ t("common.reset") }}
          </a-button>
        </a-col>
      </a-row>
    </a-card>
    <a-alert
      v-if="loadingEmployees"
      :message="t('kpiEmployee.loadingEmployees')"
      type="info"
      show-icon
    >
      <template #icon>
        <a-spin />
      </template>
    </a-alert>
    <a-alert
      v-else-if="employeeError"
      :message="employeeError"
      type="error"
      show-icon
      closable
    />
    <a-alert
      v-else-if="employees.length === 0"
      :message="t('kpiEmployee.noEmployeesFound')"
      type="warning"
      show-icon
      closable
    />
    <a-table
      :columns="employeeColumns"
      :data-source="employees"
      row-key="id"
      :pagination="false"
      :loading="loadingEmployees"
      @rowClick="onEmployeeRowClick"
      class="kpi-table-modern employee-table-modern"
      :rowClassName="() => 'employee-row-hover'"
      style="margin-bottom: 24px"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'fullName'">
          <a-avatar
            :size="28"
            :src="record.avatar || undefined"
            style="margin-right: 8px; vertical-align: middle"
          />
          <span class="kpi-name"
            >{{ record.first_name }} {{ record.last_name }}</span
          >
        </template>
        <template v-else-if="column.dataIndex === 'department'">
          {{ record.department ? record.department.name : "--" }}
        </template>
        <template v-else-if="column.dataIndex === 'section'">
          {{ record.section ? record.section.name : "--" }}
        </template>
        <template v-else-if="column.dataIndex === 'action'">
          <div style="text-align: center">
            <a-button type="primary" @click.stop="openGoalModal(record)">
              <schedule-outlined /> {{ t("personalGoal.viewGoals") }}
            </a-button>
          </div>
        </template>
        <template v-else>
          <span>{{ record[column.dataIndex] || "--" }}</span>
        </template>
      </template>
    </a-table>
    <a-modal
      v-model:open="isGoalModalVisible"
      :title="selectedEmployee ? modalTitle : t('personalGoal.employeeGoals')"
      width="70%"
      @cancel="handleGoalModalCancel"
      :footer="null"
      centered
      class="kpi-modal-modern goal-modal-modern"
    >
      <template #title>
        <div class="goal-modal-header">
          <a-avatar
            :size="40"
            :src="selectedEmployee?.avatar || undefined"
            style="margin-right: 12px"
          />
          <div>
            <div class="goal-modal-title">
              {{
                selectedEmployee
                  ? selectedEmployee.first_name +
                    " " +
                    selectedEmployee.last_name
                  : ""
              }}
            </div>
            <div class="goal-modal-desc">
              {{
                t("personalGoal.goalsOf", {
                  name: selectedEmployee
                    ? selectedEmployee.first_name +
                      " " +
                      selectedEmployee.last_name
                    : "",
                })
              }}
            </div>
          </div>
        </div>
      </template>
      <div v-if="loadingGoals" class="kpi-modal-loading">
        <a-spin size="large" />
        <span style="margin-left: 12px">{{
          t("personalGoal.loadingGoals")
        }}</span>
      </div>
      <div v-else-if="goalError">
        <a-alert :message="goalError" type="error" show-icon closable />
      </div>
      <div v-else>
        <div style="min-height: 220px">
          <a-table
            v-if="employeeGoals.length > 0"
            :columns="goalColumns"
            :data-source="employeeGoals"
            row-key="id"
            :pagination="false"
            size="middle"
            :customRow="() => {}"
            class="kpi-table-modern goal-table-modern"
            bordered
            :scroll="{ x: 900 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag
                  :bordered="false"
                  :color="getStatusColor(record.status)"
                  class="goal-status-tag"
                >
                  <span class="goal-status-text">{{
                    t("personalGoal." + record.status)
                  }}</span>
                </a-tag>
              </template>
              <template v-else-if="column.key === 'timeRange'">
                <span class="kpi-date"
                  >{{ record.startDate }} - {{ record.endDate }}</span
                >
              </template>
              <template v-else-if="column.key === 'progress'">
                <a-progress
                  :percent="record.progress"
                  :show-info="true"
                  strokeColor="#52c41a"
                  :strokeWidth="8"
                  class="goal-progress-bar"
                />
              </template>
              <template v-else-if="column.key === 'name'">
                <span class="kpi-name">{{ record.title || "--" }}</span>
              </template>
              <template v-else>
                <span>{{ record[column.dataIndex] || "--" }}</span>
              </template>
            </template>
          </a-table>
          <a-empty
            v-else
            :description="t('personalGoal.noGoalsFound')"
            class="kpi-empty"
          />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import {
  FilterOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  TeamOutlined,
  ApartmentOutlined,
  UserOutlined,
} from "@ant-design/icons-vue";
import {
  Tag as ATag,
  Progress as AProgress,
  Alert as AAlert,
  Spin as ASpin,
  Empty as AEmpty,
  Avatar as AAvatar,
  Card as ACard,
} from "ant-design-vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

const { t } = useI18n();
const store = useStore();

const user = computed(() => store.getters["auth/user"] || {});

// Permission checking function
function hasPermission(action, resource, scope) {
  const userPermissions = user.value?.permissions || [];
  return userPermissions.some(
    (p) =>
      p.action === action &&
      p.resource === resource &&
      (scope ? p.scope === scope : true)
  );
}

// Permission-based role checks
const isAdminOrManager = computed(() => {
  return (
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE, "company") ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, "company")
  );
});

const isDepartmentRole = computed(() => {
  if (isAdminOrManager.value) return false;
  return (
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE, "department") ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, "department")
  );
});

const isSectionRole = computed(() => {
  if (isAdminOrManager.value) return false;
  return (
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE, "section") ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, "section")
  );
});

const employeeFilters = reactive({
  name: "",
  departmentId: "",
  sectionId: "",
});
const employees = ref([]);
const loadingEmployees = ref(false);
const employeeError = ref("");
const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const sectionList = computed(() => store.getters["sections/sectionList"] || []);

const filteredEmployees = computed(() => {
  if (employeeFilters.sectionId) {
    return store.getters["employees/usersBySection"](employeeFilters.sectionId);
  } else if (employeeFilters.departmentId) {
    return store.getters["employees/usersByDepartment"](
      employeeFilters.departmentId
    );
  }
  return store.getters["employees/userList"] || [];
});

watch(
  () => [employeeFilters.departmentId, employeeFilters.sectionId],
  async ([newDept, newSection]) => {
    if (newSection) {
      await store.dispatch("employees/fetchUsers", { sectionId: newSection });
    } else if (newDept) {
      await store.dispatch("employees/fetchUsers", { departmentId: newDept });
    } else {
      await applyEmployeeFilters();
    }
  }
);

const employeeColumns = computed(() => [
  {
    title: t("kpiEmployee.employee.name"),
    dataIndex: "fullName",
    key: "fullName",
    width: "20%",
    customRender: ({ record }) => `${record.first_name} ${record.last_name}`,
  },
  {
    title: t("kpiEmployee.employee.email"),
    dataIndex: "email",
    key: "email",
    width: "20%",
  },
  {
    title: t("kpiEmployee.employee.department"),
    dataIndex: "department",
    key: "department",
    width: "15%",
  },
  {
    title: t("kpiEmployee.employee.section"),
    dataIndex: "section",
    key: "section",
    width: "15%",
  },
  {
    title: t("kpiEmployee.employee.action"),
    dataIndex: "action",
    key: "action",
    width: "15%",
  },
]);

const applyEmployeeFilters = async () => {
  loadingEmployees.value = true;
  employeeError.value = "";
  try {
    const params = {
      name: employeeFilters.name || undefined,
      departmentId: employeeFilters.departmentId || undefined,
      sectionId: employeeFilters.sectionId || undefined,
    };
    Object.keys(params).forEach(
      (key) => params[key] === undefined && delete params[key]
    );
    if (!params.departmentId && !params.sectionId) {
      await store.dispatch("employees/fetchUsers");
    } else if (params.sectionId) {
      await store.dispatch("employees/fetchUsers", {
        sectionId: params.sectionId,
      });
    } else if (params.departmentId) {
      await store.dispatch("employees/fetchUsers", {
        departmentId: params.departmentId,
      });
    }
    let list = filteredEmployees.value;
    if (params.name) {
      const nameLower = params.name.toLowerCase();
      list = list.filter((emp) =>
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(nameLower)
      );
    }
    employees.value = list;
  } catch (err) {
    employeeError.value = err.message || "Failed to fetch employees";
  } finally {
    loadingEmployees.value = false;
  }
};
const resetEmployeeFilters = () => {
  employeeFilters.name = "";
  employeeFilters.departmentId = "";
  employeeFilters.sectionId = "";
  applyEmployeeFilters();
};

// --- Personal Goal Modal State ---
const isGoalModalVisible = ref(false);
const selectedEmployee = ref(null);
const employeeGoals = ref([]);
const loadingGoals = ref(false);
const goalError = ref("");

const modalTitle = computed(() =>
  selectedEmployee.value
    ? `${selectedEmployee.value.first_name} ${selectedEmployee.value.last_name}`
    : t("personalGoal.employeeGoals")
);

const goalColumns = computed(() => [
  {
    title: t("personalGoal.name"),
    dataIndex: "title",
    key: "name",
    width: "20%",
  },
  {
    title: t("personalGoal.description"),
    dataIndex: "description",
    key: "description",
    width: "20%",
  },
  {
    title: t("personalGoal.timeRange"),
    dataIndex: "timeRange",
    key: "timeRange",
    width: "15%",
  },
  {
    title: t("personalGoal.status"),
    dataIndex: "status",
    key: "status",
    width: "10%",
  },
  {
    title: t("personalGoal.progress"),
    dataIndex: "progress",
    key: "progress",
    width: "10%",
  },
]);

const openGoalModal = async (employee) => {
  selectedEmployee.value = employee;
  isGoalModalVisible.value = true;
  employeeGoals.value = [];
  goalError.value = "";
  await fetchEmployeeGoals(employee.id);
};

const fetchEmployeeGoals = async (employeeId) => {
  loadingGoals.value = true;
  goalError.value = "";
  try {
    await store.dispatch("personalGoal/fetchGoalsByEmployee", { employeeId });
    let rawGoals = store.getters["personalGoal/employeeGoalList"] || [];
    if (rawGoals && rawGoals.data) rawGoals = rawGoals.data;
    rawGoals = Array.isArray(rawGoals) ? rawGoals : [];
    employeeGoals.value = rawGoals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      description: goal.description,
      startDate: goal.startDate,
      endDate: goal.endDate,
      timeRange:
        goal.startDate && goal.endDate
          ? `${goal.startDate} - ${goal.endDate}`
          : "",
      status: goal.status,
      progress: goal.progress,
    }));
    employeeGoals.value = Array.isArray(employeeGoals.value)
      ? employeeGoals.value
      : [];
  } catch (err) {
    goalError.value = err.message || "Failed to fetch personal goals";
    employeeGoals.value = [];
  } finally {
    loadingGoals.value = false;
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case "completed":
      return "green";
    case "in_progress":
      return "blue";
    case "cancelled":
      return "red";
    default:
      return "gray";
  }
};

const onEmployeeRowClick = (record) => {
  openGoalModal(record);
};

function filterEmployeeOption(input, option) {
  return option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0;
}

onMounted(async () => {
  await store.dispatch("departments/fetchDepartments");
  await store.dispatch("sections/fetchSections");
  if (!isAdminOrManager.value) {
    if (isSectionRole.value && user.value.sectionId) {
      employeeFilters.sectionId = user.value.sectionId;
      const section = sectionList.value.find(
        (s) => String(s.id) === String(user.value.sectionId)
      );
      if (section && section.department_id) {
        employeeFilters.departmentId = section.department_id;
      } else if (section && section.department && section.department.id) {
        employeeFilters.departmentId = section.department.id;
      }
    } else if (isDepartmentRole.value && user.value.departmentId) {
      employeeFilters.departmentId = user.value.departmentId;
    }
  }
  await applyEmployeeFilters();
});

function handleGoalModalCancel() {
  isGoalModalVisible.value = false;
  employeeGoals.value = [];
  goalError.value = "";
  selectedEmployee.value = null;
}
</script>

<style scoped>
.personal-goal-employee-list-page {
  background: #f6f8fa;
  min-height: auto;
}
.list-header-modern {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 18px;
}
.header-icon {
  font-size: 32px;
  color: #2563eb;
  background: #e0e7ff;
  border-radius: 50%;
  padding: 8px;
}
.header-desc {
  color: #64748b;
  font-size: 14px;
  margin-top: 2px;
}
.filter-card-modern {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 18px;
  padding: 18px 18px 6px 18px;
}
.employee-table-modern {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 0;
}
.employee-row-hover:hover {
  background: #f0fdfa !important;
  cursor: pointer;
}
.goal-modal-modern .ant-modal-content {
  border-radius: 16px;
  background: #f9fafb;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}
.goal-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.goal-modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}
.goal-modal-desc {
  color: #64748b;
  font-size: 14px;
}
.goal-table-modern {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 0;
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
.goal-progress-bar {
  min-width: 90px;
}
.kpi-modal-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
}
.kpi-table-modern .ant-table-thead > tr > th {
  background: #f1f5f9;
  font-weight: 600;
  font-size: 15px;
  color: #334155;
  border-bottom: 1.5px solid #e5e7eb;
}
.kpi-table-modern .ant-table-tbody > tr > td {
  font-size: 14px;
  color: #22223b;
  padding: 8px 12px;
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
.kpi-empty {
  margin: 32px 0 12px 0;
  text-align: center;
}

:deep(.ant-card-body) {
  padding: 0 !important;
}
</style>
