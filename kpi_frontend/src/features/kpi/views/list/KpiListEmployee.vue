<template>
  <div class="kpi-employee-list-page">
    <LoadingOverlay :visible="loadingEmployees" />
    <div class="list-header-modern">
      <team-outlined class="header-icon" />
      <div>
        <h4>{{ t("kpiEmployee.employeeManagement") }}</h4>
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
        <a-col :span="6">
          <a-form-item :label="t('kpiEmployee.department')">
            <a-select v-model:value="localFilters.departmentId" style="width: 100%" size="small"
              :disabled="isDepartmentRole || isSectionRole">
              <template #suffixIcon><apartment-outlined /></template>
              <a-select-option value="">{{ t("common.all") }}</a-select-option>
              <a-select-option v-for="department in departmentList" :key="department.id" :value="department.id">
                {{ department.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item :label="t('kpiEmployee.section')">
            <a-select v-model:value="localFilters.sectionId" style="width: 100%" size="small" :disabled="isSectionRole">
              <template #suffixIcon><cluster-outlined /></template>
              <a-select-option value="">{{ t("common.all") }}</a-select-option>
              <a-select-option v-for="section in sectionList" :key="section.id" :value="section.id">
                {{ section.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item :label="t('kpiEmployee.employeeName')">
            <a-input v-model:value="localFilters.name" :placeholder="t('kpiEmployee.selectEmployee')" allow-clear
              size="small" style="width: 100%">
              <template #prefix><user-outlined /></template>
            </a-input>
          </a-form-item>
        </a-col>
        <a-col :span="6" style="text-align: right">
          <a-button
            type="primary"
            size="small"
            @click="applyEmployeeFilters"
            :loading="loadingEmployees"
          >
            <template #icon><filter-outlined /></template>
            {{ t("common.apply") }}
          </a-button>
          <a-button size="small" @click="resetEmployeeFilters" :loading="loadingEmployees" style="margin-left: 8px">
            <template #icon><reload-outlined /></template>
            {{ t("common.reset") }}
          </a-button>
        </a-col>
      </a-row>
    </a-card>
    <a-alert v-if="loadingEmployees" :message="t('kpiEmployee.loadingEmployees')" type="info" show-icon>
      <template #icon>
        <a-spin />
      </template>
    </a-alert>
    <a-alert v-else-if="employeeError" :message="employeeError" type="error" show-icon closable />
    <a-alert v-else-if="employees.length === 0" :message="t('kpiEmployee.noEmployeesFound')" type="warning" show-icon
      closable />
    <a-table :columns="employeeColumns" :data-source="employees" row-key="id" :pagination="false"
      :loading="loadingEmployees" @rowClick="onEmployeeRowClick" class="kpi-table-modern employee-table-modern"
      :rowClassName="() => 'employee-row-hover'" style="margin-bottom: 24px" :showSorterTooltip="{ title: t('common.clickToSort') || 'Click để sắp xếp nhiều cột' }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'fullName'">
          <a-avatar :size="28" :src="record.avatar || undefined" style="margin-right: 8px; vertical-align: middle" />
          <span class="kpi-name">{{ $getFullName(record) }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'department'">
          {{ record.department ? record.department.name : "--" }}
        </template>
        <template v-else-if="column.dataIndex === 'section'">
          {{ record.section ? record.section.name : "--" }}
        </template>
        <template v-else-if="column.dataIndex === 'totalWeightScore'">
          <span class="kpi-value" style="font-weight: 600; color: #059669;">
            {{ record.totalWeightScore !== undefined && record.totalWeightScore !== null
               ? Number(record.totalWeightScore).toFixed(2)
               : effectiveCycleIdStr ? '0.00' : '--' }}
          </span>
        </template>
        <template v-else-if="column.dataIndex === 'averageScore'">
          <span class="kpi-value" style="font-weight: 600; color: #7c3aed;">
            {{ record.averageScore !== undefined && record.averageScore !== null
               ? Number(record.averageScore).toFixed(2)
               : effectiveCycleIdStr ? '0.00' : '--' }}
          </span>
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
    <a-modal v-model:open="isKpiModalVisible" :title="selectedEmployee ? modalTitle : t('kpiEmployee.employeeKpis')"
      width="70%" @cancel="handleKpiModalCancel" :footer="null" centered class="kpi-modal-modern goal-modal-modern">
      <template #title>
        <div class="goal-modal-header">
          <a-avatar :size="40" :src="selectedEmployee?.avatar || undefined" style="margin-right: 12px" />
          <div>
            <div class="goal-modal-title">
              {{ $getFullName(selectedEmployee) }}
            </div>
            <div class="goal-modal-desc">
              {{
                t("kpiEmployee.kpisOf", {name: $getFullName(selectedEmployee)})
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
          <a-table v-if="employeeKpis.length > 0" :columns="kpiColumns" :data-source="employeeKpis" row-key="id"
            :pagination="false" size="middle" :customRow="() => { }" class="kpi-table-modern goal-table-modern" bordered
            :scroll="{ x: 900 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'weight'">
                <span class="kpi-value" style="font-weight: 600; color: #9333ea;">
                  {{ record.weight !== null && record.weight !== undefined
                     ? Number(record.weight).toFixed(2)
                     : '--' }}
                </span>
              </template>
              <template v-else-if="column.key === 'selfScore'">
                <span class="kpi-value" style="font-weight: 600; color: #2563eb;">
                  {{ record.selfScore !== null && record.selfScore !== undefined
                     ? record.selfScore
                     : effectiveCycleIdStr ? '0.00' : '--' }}
                </span>
              </template>
              <template v-else-if="column.key === 'weightSelftScore'">
                <span class="kpi-value" style="font-weight: 600; color: #059669;">
                  {{ record.weightSelftScore !== null && record.weightSelftScore !== undefined
                     ? record.weightSelftScore
                     : effectiveCycleIdStr ? '0.00' : '--' }}
                </span>
              </template>
              <template v-else-if="column.key === 'score'">
                <span style="display: inline-flex; align-items: center; gap: 4px;">
                  <span class="kpi-value" style="font-weight: 600; color: #2563eb;">
                    {{ record.managerScore !== null && record.managerScore !== undefined
                       ? record.managerScore
                       : effectiveCycleIdStr ? '0.00' : '--' }}
                  </span>
                  <a-popover placement="left" trigger="click">
                    <template #content>
                      <div class="supervisor-comments-popover">
                        <div class="comments-popover-title">
                          {{ t("kpiEmployee.evaluationComments") || "Comment đánh giá" }}
                        </div>
                        <div class="comment-block">
                          <div class="comment-label">Section</div>
                          <div class="comment-text">
                            {{ (record.sectionComment && record.sectionComment.trim()) || (t("kpiEmployee.noComment") || "Không có comment") }}
                          </div>
                        </div>
                        <div class="comment-block">
                          <div class="comment-label">Department</div>
                          <div class="comment-text">
                            {{ (record.departmentComment && record.departmentComment.trim()) || (t("kpiEmployee.noComment") || "Không có comment") }}
                          </div>
                        </div>
                        <div class="comment-block">
                          <div class="comment-label">Manager</div>
                          <div class="comment-text">
                            {{ (record.managerComment && record.managerComment.trim()) || (t("kpiEmployee.noComment") || "Không có comment") }}
                          </div>
                        </div>
                      </div>
                    </template>
                    <comment-outlined class="comment-icon-trigger" />
                  </a-popover>
                </span>
              </template>
              <template v-else-if="column.key === 'score_weight'">
                <span class="kpi-value" style="font-weight: 600; color: #059669;">
                  {{ record.score !== null && record.score !== undefined
                     ? record.score
                     : effectiveCycleIdStr ? '0.00' : '--' }}
                </span>
              </template>
              <template v-else-if="column.key === 'target_1'">
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
              <template v-else-if="column.key === 'name'">
                <span class="kpi-name">{{ record.name || "--" }}</span>
              </template>
              <template v-else>
                <span>{{ record[column.dataIndex] || "--" }}</span>
              </template>
            </template>
            <template #summary>
              <a-table-summary>
                <a-table-summary-row class="summary-total-row">
                  <a-table-summary-cell :index="0" :col-span="2">
                    <strong>{{ t("kpiEmployee.totalScore") || "Total Score" }}</strong>
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="2" align="center">
                    <strong style="color: #9333ea;">{{ totalWeight.toFixed(2) }}</strong>
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="3" align="center">
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="4" align="center">
                    <strong style="color: #059669;">{{ totalWeightSelftScore.toFixed(2) }}</strong>
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="5" align="center">
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="6" align="center">
                    <strong style="color: #059669;">{{ displayTotalScoreManager }}</strong>
                  </a-table-summary-cell>
                </a-table-summary-row>
                <a-table-summary-row class="summary-average-row">
                  <a-table-summary-cell :index="0" :col-span="2">
                    <strong>{{ t("kpiEmployee.averageScore") || "Average Score" }}</strong>
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="2" align="center">
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="3" align="center">
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="4" align="center">
                    <strong style="color: #059669;">{{ averageWeightSelftScore }}</strong>
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="5" align="center">
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="6" align="center">
                    <strong style="color: #059669;">{{ displayAverageScoreManager }}</strong>
                  </a-table-summary-cell>
                </a-table-summary-row>
              </a-table-summary>
            </template>
          </a-table>
          <a-empty v-else :description="t('kpiEmployee.noKpisFound')" class="kpi-empty" />
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
  FormItem as AFormItem,
  Modal as AModal,
  Button as AButton,
  Table as ATable,
  TableSummary as ATableSummary,
  TableSummaryRow as ATableSummaryRow,
  TableSummaryCell as ATableSummaryCell,
  Alert as AAlert,
  Spin as ASpin,
  Empty as AEmpty,
  Input as AInput,
  Select as ASelect,
  SelectOption as ASelectOption,
  Popover as APopover,
} from "ant-design-vue";
import {
  FilterOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  CommentOutlined,
} from "@ant-design/icons-vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import {
  ApartmentOutlined,
  ClusterOutlined,
  UserOutlined,
  TeamOutlined,
} from "@ant-design/icons-vue";
import { Avatar as AAvatar, Card as ACard } from "ant-design-vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { getFullName } from "@/core/utils/format";
import { getReviewCycles } from "@/core/services/kpiReviewApi";
function reviewCyclesListIncludesId(cycles, gid) {
  if (gid == null || gid === "") return true;
  if (!Array.isArray(cycles) || !cycles.length) return false;
  return cycles.some((c) => Number(c.id) === Number(gid));
}

const { t } = useI18n();
const store = useStore();

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
const localFilters = reactive({
  name: "",
  departmentId: "",
  sectionId: "",
});
// Applied filters - chỉ filter khi đã click Apply
const appliedFilters = reactive({
  name: "",
  departmentId: "",
  sectionId: "",
});
const employees = ref([]);
const loadingEmployees = ref(false);
const employeeError = ref("");
const reviewCycles = ref([]);

/** Chu kỳ từ header (Vuex); dùng cho API và hiển thị điểm */
const effectiveCycleIdStr = computed(() => {
  const id = store.getters["reviewCycle/selectedCycleId"];
  if (id == null || id === "") return "";
  return String(id);
});
const departmentList = computed(
  () => store.getters["departments/departmentList"] || [],
);
const sectionList = computed(() => store.getters["sections/sectionList"] || []);

const employeeColumns = computed(() => [
  {
    title: t("kpiEmployee.employee.name"),
    dataIndex: "fullName",
    key: "fullName",
    width: "20%",
    customRender: ({ record }) => getFullName(record),
    sorter: (a, b) => getFullName(a).localeCompare(getFullName(b)),
  },
  {
    title: t("kpiEmployee.employee.email"),
    dataIndex: "email",
    key: "email",
    width: "14%",
  },
  {
    title: t("kpiEmployee.employee.department"),
    dataIndex: "department",
    key: "department",
    width: "14%",
    sorter: {
      compare: (a, b) => {
        const deptA = a.department?.name || "";
        const deptB = b.department?.name || "";
        return deptA.localeCompare(deptB);
      },
      multiple: 4,
    },
  },
  {
    title: t("kpiEmployee.employee.section"),
    dataIndex: "section",
    key: "section",
    width: "14%",
    sorter: {
      compare: (a, b) => {
        const sectionA = a.section?.name || "";
        const sectionB = b.section?.name || "";
        return sectionA.localeCompare(sectionB);
      },
      multiple: 3,
    },
  },
  {
    title: t("kpiEmployee.totalWeightScore"),
    dataIndex: "totalWeightScore",
    key: "totalWeightScore",
    width: "14%",
    sorter: {
      compare: (a, b) => {
        const scoreA = a.totalWeightScore !== undefined && a.totalWeightScore !== null
          ? Number(a.totalWeightScore)
          : 0;
        const scoreB = b.totalWeightScore !== undefined && b.totalWeightScore !== null
          ? Number(b.totalWeightScore)
          : 0;
        return scoreA - scoreB;
      },
      multiple: 2,
    },
  },
  {
    title: t("kpiEmployee.averageScore"),
    dataIndex: "averageScore",
    key: "averageScore",
    width: "14%",
    sorter: {
      compare: (a, b) => {
        const scoreA = a.averageScore !== undefined && a.averageScore !== null
          ? Number(a.averageScore)
          : 0;
        const scoreB = b.averageScore !== undefined && b.averageScore !== null
          ? Number(b.averageScore)
          : 0;
        return scoreA - scoreB;
      },
      multiple: 1,
    },
  },
  {
    title: t("kpiEmployee.employee.action"),
    dataIndex: "action",
    key: "action",
    width: "14%",
  },
]);

const applyEmployeeFilters = async () => {
  loadingEmployees.value = true;
  employeeError.value = "";

  // Copy localFilters vào appliedFilters trước khi gọi API
  appliedFilters.name = localFilters.name;
  appliedFilters.departmentId = localFilters.departmentId;
  appliedFilters.sectionId = localFilters.sectionId;

  try {
    const params = {
      name: appliedFilters.name || undefined,
      departmentId: appliedFilters.departmentId || undefined,
      sectionId: appliedFilters.sectionId || undefined,
      cycle: effectiveCycleIdStr.value || undefined,
    };
    Object.keys(params).forEach(
      (key) => params[key] === undefined && delete params[key],
    );

    // Gọi một API duy nhất với cả departmentId, sectionId và name va cycle (nếu có)
    const apiParams = {};
    if (params.departmentId && params.departmentId !== "") {
      apiParams.departmentId = params.departmentId;
    }
    if (params.sectionId && params.sectionId !== "") {
      apiParams.sectionId = params.sectionId;
    }
    if (params.cycle && params.cycle !== "") {
      apiParams.cycle = params.cycle;
    }
    // Thêm name vào apiParams nếu có (khi API hỗ trợ)
    if (params.name && params.name.trim()) {
      apiParams.name = params.name.trim();
      // Hoặc apiParams.search = params.name.trim(); tùy API hỗ trợ param nào
    }

    // Gọi API với force: true để đảm bảo luôn fetch data mới
    const fetchParams = Object.keys(apiParams).length > 0
      ? { ...apiParams, force: true }
      : { force: true };

    // Gọi API và lấy data trực tiếp từ response
    const fetchedUsers = await store.dispatch("employees/fetchUsers", fetchParams);

    // Lấy data từ response hoặc từ store getters
    let list = Array.isArray(fetchedUsers) ? fetchedUsers : [];

    // Chỉ dùng fallback khi KHÔNG có cycle filter và list rỗng
    // Nếu có cycle filter, luôn tin response từ API (kể cả khi rỗng)
    if (list.length === 0 && !effectiveCycleIdStr.value) {
      if (appliedFilters.sectionId && appliedFilters.sectionId !== "") {
        list = store.getters["employees/usersBySection"](appliedFilters.sectionId) || [];
      } else if (appliedFilters.departmentId && appliedFilters.departmentId !== "") {
        list = store.getters["employees/usersByDepartment"](appliedFilters.departmentId) || [];
      }
    }

    // Filter theo name ở client-side (fallback nếu API không hỗ trợ)
    if (params.name && params.name.trim()) {
      const nameLower = params.name.toLowerCase();
      list = list.filter((emp) =>
        getFullName(emp).toLowerCase().includes(nameLower),
      );
    }

    employees.value = list;

  } catch (err) {
    employeeError.value = err.message || "Failed to fetch employees";
  } finally {
    loadingEmployees.value = false;
  }
};

watch(
  () => store.getters["reviewCycle/selectedCycleId"],
  () => {
    if (!reviewCycles.value.length) return;
    const gid = store.getters["reviewCycle/selectedCycleId"];
    if (!reviewCyclesListIncludesId(reviewCycles.value, gid)) return;
    applyEmployeeFilters();
  },
);

const resetEmployeeFilters = () => {
  localFilters.name = "";
  localFilters.departmentId = "";
  localFilters.sectionId = "";
  appliedFilters.name = "";
  appliedFilters.departmentId = "";
  appliedFilters.sectionId = "";
  applyEmployeeFilters();
};

const isKpiModalVisible = ref(false);
const selectedEmployee = ref(null);
const employeeKpis = ref([]);
const loadingKpis = ref(false);
const kpiError = ref("");

const kpiColumns = computed(() => [
  {
    title: t("kpiEmployee.kpiName"),
    dataIndex: "name",
    key: "name",
    width: 150,
    fixed: 'left',
  },
  {
    title: t("kpiEmployee.target"),
    dataIndex: "target",
    key: "target",
    width: 120,
  },
  {
    title: t("weight"),
    dataIndex: "weight",
    key: "weight",
    width: 100,
    align: 'center',
  },
  {
    title: t("kpiEmployee.evaluationTime") || "Evaluation Time",
    key: "evaluationTime",
    children: [
      {
        title: t("kpiEmployee.selfEvaluation") || "Self Evaluation",
        key: "selfEvaluation",
        children: [
          {
            title: t("kpiEmployee.score") || "Score",
            dataIndex: "selfScore",
            key: "selfScore",
            width: 100,
            align: 'center',
          },
          {
            title: t("kpiEmployee.weightScore"),
            dataIndex: "weightSelftScore",
            key: "weightSelftScore",
            width: 120,
            align: 'center',
          },
        ],
      },
      {
        title: t("kpiEmployee.supervisorEvaluation") || "Supervisor Evaluation",
        key: "supervisorEvaluation",
        children: [
          {
            title: t("kpiEmployee.score") || "Score",
            dataIndex: "score",
            key: "score",
            width: 100,
            align: 'center',
          },
          {
            title: t("kpiEmployee.weightScore"),
            dataIndex: "score_weight",
            key: "score_weight",
            width: 120,
            align: 'center',
          },
        ],
      },
    ],
  },
]);

const modalTitle = computed(() =>
  selectedEmployee.value
    ? getFullName(selectedEmployee.value)
    : t("kpiEmployee.employeeKpis"),
);

// Computed properties for totals and averages
const totalWeight = computed(() => {
  return employeeKpis.value.reduce((sum, kpi) => {
    const weight = kpi.weight !== null && kpi.weight !== undefined ? Number(kpi.weight) : 0;
    return sum + weight;
  }, 0);
});

const totalWeightSelftScore = computed(() => {
  return employeeKpis.value.reduce((sum, kpi) => {
    const score = kpi.weightSelftScore !== null && kpi.weightSelftScore !== undefined ? Number(kpi.weightSelftScore) : 0;
    return sum + score;
  }, 0);
});

const totalScore = computed(() => {
  return employeeKpis.value.reduce((sum, kpi) => {
    const score = kpi.score !== null && kpi.score !== undefined ? Number(kpi.score) : 0;
    return sum + score;
  }, 0);
});

const averageWeightSelftScore = computed(() => {
  if (totalWeight.value === 0) return 0;
  return (totalWeightSelftScore.value / totalWeight.value).toFixed(2);
});

const averageScore = computed(() => {
  if (totalWeight.value === 0) return 0;
  return (totalScore.value / totalWeight.value).toFixed(2);
});

// Summary từ backend (khớp bảng ngoài) — dùng cho cột Đánh giá của cấp trên
const employeeKpiSummary = computed(() => store.getters["kpis/employeeKpiSummary"]);
const displayTotalScoreManager = computed(() =>
  employeeKpiSummary.value?.totalWeightScore != null
    ? Number(employeeKpiSummary.value.totalWeightScore).toFixed(2)
    : totalScore.value.toFixed(2),
);
const displayAverageScoreManager = computed(() =>
  employeeKpiSummary.value?.averageScore != null
    ? Number(employeeKpiSummary.value.averageScore).toFixed(2)
    : averageScore.value,
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

  const filters = {};
  // Only add cycle to filters if it has a value (not empty string)
  if (effectiveCycleIdStr.value) {
    filters.cycle = effectiveCycleIdStr.value;
  }

  try {
    await store.dispatch("kpis/fetchKpisByEmployee", {
      employeeId,
      filters,
    });
    let rawKpis = store.getters["kpis/employeeKpiList"] || [];
    if (rawKpis && rawKpis.data) rawKpis = rawKpis.data;

    rawKpis = Array.isArray(rawKpis) ? rawKpis : [];
    // Chỉ hiển thị KPI có ít nhất một kpiValue với status APPROVED (bỏ qua kpiValues rỗng hoặc không có approved)
    const kpisWithApprovedValue = rawKpis.filter((kpi) => {
      const assignment =
        kpi.assignments && kpi.assignments.length > 0 ? kpi.assignments[0] : {};
      const kpiValues = assignment.kpiValues;
      if (!kpiValues || !Array.isArray(kpiValues) || kpiValues.length === 0)
        return false;
      return kpiValues.some((v) => v.status === "APPROVED");
    });
    employeeKpis.value = kpisWithApprovedValue.map((kpi) => {
      const assignment =
        kpi.assignments && kpi.assignments.length > 0 ? kpi.assignments[0] : {};
      let actualValue = "--";
      let status = "APPROVED";
      const approvedValues = (assignment.kpiValues || []).filter(
        (v) => v.status === "APPROVED",
      );
      if (approvedValues.length > 0) {
        approvedValues.sort(
          (a, b) =>
            new Date(b.created_at || b.timestamp) -
            new Date(a.created_at || a.timestamp),
        );
        actualValue = approvedValues[0].value ?? "--";
        actualValue =
          approvedValues[0].corrected_value != null
            ? approvedValues[0].corrected_value
            : actualValue;
        status = approvedValues[0].status || "APPROVED";
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
        weight: kpi.weight !== undefined && kpi.weight !== null
          ? Number(kpi.weight)
          : null,
        selfScore: kpi.selfScore !== undefined && kpi.selfScore !== null
          ? Number(kpi.selfScore).toFixed(2)
          : null,
        weightSelftScore: kpi.weightSelftScore !== undefined && kpi.weightSelftScore !== null
          ? Number(kpi.weightSelftScore).toFixed(2)
          : null,
        managerScore: kpi.managerScore !== undefined && kpi.managerScore !== null
          ? Number(kpi.managerScore).toFixed(2)
          : null,
        score: kpi.score !== undefined && kpi.score !== null
          ? Number(kpi.score).toFixed(2)
          : null,
        sectionComment: kpi.sectionComment ?? null,
        departmentComment: kpi.departmentComment ?? null,
        managerComment: kpi.managerComment ?? null,
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

const fetchReviewCyclesData = async () => {
  try {
    const cycles = await getReviewCycles();
    reviewCycles.value = cycles || [];
  } catch (error) {
    console.error("Failed to fetch review cycles:", error);
    reviewCycles.value = [];
  }
};

const onEmployeeRowClick = (record) => {
  openKpiModal(record);
};

const user = computed(() => store.getters["auth/user"] || {});

const isAdminOrManager = computed(() => {
  return hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, "company");
});

const isDepartmentRole = computed(() => {
  if (isAdminOrManager.value) return false;
  return hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, "department");
});

const isSectionRole = computed(() => {
  if (isAdminOrManager.value) return false;
  return hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, "section");
});

const isEmployeeRole = computed(() => {
  if (isAdminOrManager.value || isDepartmentRole.value || isSectionRole.value) return false;
  return hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, "employee");
});
onMounted(async () => {
  // Fetch review cycles first and set default to current year
  await fetchReviewCyclesData();

  await store.dispatch("departments/fetchDepartments");
  await store.dispatch("sections/fetchSections");

  // Auto-set filters based on KPI permissions
  if (!isAdminOrManager.value) {
    if (isSectionRole.value && user.value.sectionId) {
      // View KPI (Section): Filter by section
      localFilters.sectionId = user.value.sectionId;
      const section = sectionList.value.find(
        (s) => String(s.id) === String(user.value.sectionId),
      );
      if (section && section.department_id) {
        localFilters.departmentId = section.department_id;
      } else if (section && section.department && section.department.id) {
        localFilters.departmentId = section.department.id;
      }
    } else if (isDepartmentRole.value && user.value.departmentId) {
      // View KPI (Department): Filter by department
      localFilters.departmentId = user.value.departmentId;
    } else if (isEmployeeRole.value) {
      // View KPI (Employee): Backend will filter to show only current user
      // No need to set filters here as backend handles it
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
  /* padding: 24px; */
  background: #f6f8fa;
  min-height: auto;
}

.filter-card-modern .ant-form-item-label > label {
  font-size: 13px;
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

.kpi-table-modern .ant-table-thead>tr>th {
  background: #f1f5f9;
  font-weight: 600;
  font-size: 15px;
  color: #334155;
  border-bottom: 1.5px solid #e5e7eb;
  text-align: center;
}

:deep(.ant-table-thead .ant-table-cell) {
  text-align: center !important;
  vertical-align: middle;
}

:deep(.ant-table-thead tr:first-child th) {
  background: #e0e7ff !important;
  font-weight: 700;
  font-size: 14px;
}

:deep(.ant-table-thead tr:nth-child(2) th) {
  background: #dbeafe !important;
  font-weight: 600;
  font-size: 13px;
}

:deep(.ant-table-thead tr:nth-child(3) th) {
  background: #f1f5f9 !important;
  font-weight: 500;
  font-size: 13px;
}

.kpi-table-modern .ant-table-tbody>tr>td {
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

.summary-total-row {
  background-color: #f0f9ff !important;
  font-weight: 600;
}

.summary-average-row {
  background-color: #ecfdf5 !important;
  font-weight: 600;
}

:deep(.summary-total-row td) {
  background-color: #f0f9ff !important;
  font-weight: 600;
}

:deep(.summary-average-row td) {
  background-color: #ecfdf5 !important;
  font-weight: 600;
}

.comment-icon-trigger {
  color: #1890ff;
  cursor: pointer;
  font-size: 14px;
}
.comment-icon-trigger:hover {
  color: #40a9ff;
}
</style>

<style lang="scss">
/* Popover content rendered in overlay - no scoped so it applies when content is teleported */
.supervisor-comments-popover {
  min-width: 280px;
  max-width: 360px;
}
.supervisor-comments-popover .comments-popover-title {
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}
.supervisor-comments-popover .comment-block {
  margin-bottom: 10px;
}
.supervisor-comments-popover .comment-block:last-child {
  margin-bottom: 0;
}
.supervisor-comments-popover .comment-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  margin-bottom: 4px;
}
.supervisor-comments-popover .comment-text {
  font-size: 13px;
  color: #334155;
  line-height: 1.5;
  padding: 6px 8px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
}
</style>
