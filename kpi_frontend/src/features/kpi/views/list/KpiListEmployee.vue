<template>
  <div class="kpi-employee-list-page">
    <div class="list-header-modern">
      <schedule-outlined class="header-icon" />
      <div>
        <h2>{{ t("kpiEmployee.employeeManagement") }}</h2>
        <div class="header-desc">
          {{
            t("kpiEmployee.employeeManagementDesc") ||
            t("kpiEmployee.employeeKpis")
          }}
        </div>
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
    <div style="margin-top: 20px; margin-bottom: 20px">
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
    </div>
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
            <a-button type="primary" @click.stop="openKpiModal(record)">
              <schedule-outlined /> {{ t("kpiEmployee.viewKpis") }}
            </a-button>
          </div>
        </template>
        <template v-else>
          <span>{{ record[column.dataIndex] || "--" }}</span>
        </template>
      </template>
    </a-table>
    <a-modal
      v-model:open="isKpiModalVisible"
      :title="selectedEmployee ? modalTitle : t('kpiEmployee.employeeKpis')"
      width="70%"
      @cancel="handleKpiModalCancel"
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
                t("kpiEmployee.kpisOf", {
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
      <div v-if="loadingKpis" class="kpi-modal-loading">
        <a-spin size="large" />
        <span style="margin-left: 12px">{{
          t("kpiEmployee.loadingKpis")
        }}</span>
      </div>
      <div v-else-if="kpiError">
        <a-alert :message="kpiError" type="error" show-icon closable />
      </div>
      <div v-else>
        <div style="min-height: 220px">
          <a-table
            v-if="employeeKpis.length > 0"
            :columns="kpiColumns"
            :data-source="employeeKpis"
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
                  <span class="goal-status-text">{{ record.status }}</span>
                </a-tag>
              </template>
              <template v-else-if="column.key === 'target'">
                <span class="kpi-value">{{
                  record.target !== undefined &&
                  record.target !== null &&
                  record.target !== "--"
                    ? Number(record.target).toLocaleString() +
                      (record.unit ? " " + record.unit : "")
                    : "--"
                }}</span>
              </template>
              <template v-else-if="column.key === 'actual_value'">
                <span class="kpi-value kpi-actual">{{
                  record.actual_value !== undefined &&
                  record.actual_value !== null &&
                  record.actual_value !== "--"
                    ? Number(record.actual_value).toLocaleString() +
                      (record.unit ? " " + record.unit : "")
                    : "--"
                }}</span>
              </template>
              <template v-else-if="column.key === 'start_date'">
                <span class="kpi-date">{{ record.start_date || "--" }}</span>
              </template>
              <template v-else-if="column.key === 'end_date'">
                <span class="kpi-date">{{ record.end_date || "--" }}</span>
              </template>
              <template v-else-if="column.key === 'name'">
                <span class="kpi-name">{{ record.name || "--" }}</span>
              </template>
              <template v-else>
                <span>{{ record[column.dataIndex] || "--" }}</span>
              </template>
            </template>
          </a-table>
          <a-empty
            v-else
            :description="t('kpiEmployee.noKpisFound')"
            class="kpi-empty"
          />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, ref, watch, h } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import {
  FormItem as AFormItem,
  Modal as AModal,
  Button as AButton,
  Table as ATable,
  Tag as ATag,
  Alert as AAlert,
  Spin as ASpin,
  Empty as AEmpty,
} from "ant-design-vue";
import {
  FilterOutlined,
  ReloadOutlined,
  ScheduleOutlined,
} from "@ant-design/icons-vue";
import { KpiDefinitionStatus } from "@/core/constants/kpiStatus";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import {
  TeamOutlined,
  ApartmentOutlined,
  UserOutlined,
} from "@ant-design/icons-vue";
import { Avatar as AAvatar, Card as ACard } from "ant-design-vue";

const { t } = useI18n();
const store = useStore();

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
const canViewEmployeeKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, "employee")
);

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

const isKpiModalVisible = ref(false);
const selectedEmployee = ref(null);
const employeeKpis = ref([]);
const loadingKpis = ref(false);
const kpiError = ref("");

const validityStatusColor = {
  active: "green",
  expiring_soon: "orange",
  expired: "red",
};

const kpiColumns = computed(() => [
  {
    title: t("kpiEmployee.kpiName"),
    dataIndex: "name",
    key: "name",
    width: "20%",
  },
  {
    title: t("kpiEmployee.target"),
    dataIndex: "target",
    key: "target",
    width: "10%",
  },
  {
    title: t("kpiEmployee.actualValue"),
    dataIndex: "actual_value",
    key: "actual_value",
    width: "10%",
  },
  {
    title: t("kpiEmployee.status"),
    dataIndex: "status",
    key: "status",
    width: "10%",
  },
  {
    title: t("validityStatus.name"),
    dataIndex: "validityStatus",
    key: "validityStatus",
    width: "11%",
    align: "center",
    customRender: ({ text }) => {
      return h(
        ATag,
        { color: validityStatusColor[text] || "default" },
        () => t(`validityStatus.${text}`) || text
      );
    },
  },
  {
    title: t("kpiEmployee.startDate"),
    dataIndex: "start_date",
    key: "start_date",
    width: "12%",
  },
  {
    title: t("kpiEmployee.endDate"),
    dataIndex: "end_date",
    key: "end_date",
    width: "12%",
  },
]);

const modalTitle = computed(() =>
  selectedEmployee.value
    ? `${selectedEmployee.value.first_name} ${selectedEmployee.value.last_name}`
    : t("kpiEmployee.employeeKpis")
);

const openKpiModal = async (employee) => {
  selectedEmployee.value = employee;
  isKpiModalVisible.value = true;
  employeeKpis.value = [];
  kpiError.value = "";
  await fetchEmployeeKpis(employee.id);
};

const fetchEmployeeKpis = async (employeeId) => {
  loadingKpis.value = true;
  kpiError.value = "";
  try {
    await store.dispatch("kpis/fetchKpisByEmployee", { employeeId });
    let rawKpis = store.getters["kpis/employeeKpiList"] || [];
    if (rawKpis && rawKpis.data) rawKpis = rawKpis.data;

    rawKpis = Array.isArray(rawKpis) ? rawKpis : [];
    employeeKpis.value = rawKpis.map((kpi) => {
      const assignment =
        kpi.assignments && kpi.assignments.length > 0 ? kpi.assignments[0] : {};
      let actualValue = "--";
      let status = "--";
      if (
        assignment.kpiValues &&
        Array.isArray(assignment.kpiValues) &&
        assignment.kpiValues.length > 0
      ) {
        const approvedValues = assignment.kpiValues.filter(
          (v) => v.status === "APPROVED"
        );
        if (approvedValues.length > 0) {
          approvedValues.sort(
            (a, b) =>
              new Date(b.created_at || b.timestamp) -
              new Date(a.created_at || a.timestamp)
          );
          actualValue = approvedValues[0].value;
          status = approvedValues[0].status || "--";
        }
      }
      return {
        id: kpi.id,
        name: kpi.name,
        target: assignment.targetValue || kpi.target,
        actual_value: actualValue,
        unit: assignment.unit || kpi.unit || "",
        status: status,
        validityStatus: kpi.validityStatus,
        start_date: assignment.startDate
          ? assignment.startDate.split("T")[0]
          : kpi.start_date,
        end_date: assignment.endDate
          ? assignment.endDate.split("T")[0]
          : kpi.end_date,
      };
    });

    employeeKpis.value = Array.isArray(employeeKpis.value)
      ? employeeKpis.value
      : [];
  } catch (err) {
    kpiError.value = err.message || "Failed to fetch KPIs";
    employeeKpis.value = [];
  } finally {
    loadingKpis.value = false;
  }
};

const getStatusColor = (status) => {
  return status === KpiDefinitionStatus.APPROVED ? "success" : "red";
};

const onEmployeeRowClick = (record) => {
  openKpiModal(record);
};

function filterEmployeeOption(input, option) {
  return option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0;
}

const user = computed(() => store.getters["auth/user"] || {});

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

onMounted(async () => {
  if (!canViewEmployeeKpi.value) return;
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

function handleKpiModalCancel() {
  isKpiModalVisible.value = false;
  employeeKpis.value = [];
  kpiError.value = "";
  selectedEmployee.value = null;
}
</script>

<style scoped>
.kpi-employee-list-page {
  padding: 24px;
  background: #f6f8fa;
  min-height: 100vh;
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
  font-size: 15px;
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
</style>
