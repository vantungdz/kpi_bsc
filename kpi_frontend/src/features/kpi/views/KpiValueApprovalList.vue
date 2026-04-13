<template>
  <div class="kpi-value-approval-list">
    <a-card class="modern-card">
      <template #title>
        <div class="page-header">
          <trophy-outlined class="page-icon" />
          <span class="page-title">{{ $t("kpiValueApprovalManagement") }}</span>
        </div>
      </template>

      <!-- Loading State -->
      <a-spin v-if="loading" :tip="$t('loading')" size="large" />

      <!-- No Permission State -->
      <a-result
        v-else-if="!hasAnyApprovalPermission"
        status="403"
        :title="$t('noPermission')"
        :sub-title="$t('noApprovalPermission')"
      />

      <!-- Error State -->
      <a-alert
        v-else-if="error"
        type="error"
        show-icon
        :message="$t('errorLoadingApprovalList')"
        :description="error"
        closable
        @close="clearError"
        style="margin-bottom: 16px"
      />

      <!-- Table Content -->
      <div v-else-if="groupedApprovals.length > 0" class="table-container">
        <!-- Batch Approve Button -->
        <div
          style="
            display: flex;
            justify-content: space-between;
            margin-bottom: 16px;
            gap: 16px;
            flex-wrap: nowrap;
          "
        >
          <p style="flex: 1; min-width: 0">
            {{ $t("listOfEmployeesWithPendingKpis") }}
          </p>
          <a-button
            type="primary"
            :disabled="selectedEmployeeIds.size === 0"
            :loading="batchApproving"
            @click="handleBatchApprove"
            style="flex-shrink: 0"
          >
            <check-outlined />
            {{
              $t("approveSelected", {
                count: selectedEmployeeIds.size,
              })
            }}
          </a-button>
        </div>

        <a-table
          :columns="employeeColumns"
          :data-source="groupedApprovals"
          :row-key="(record) => record.employee.id"
          :pagination="pagination"
          bordered
          class="modern-table"
          :scroll="{ x: 'max-content' }"
        >
          <template #headerCell="{ column }">
            <!-- Checkbox Header Column -->
            <template v-if="column.key === 'checkbox'">
              <a-checkbox
                :checked="isAllSelected"
                :indeterminate="isIndeterminate"
                @change="(e) => toggleSelectAll(e.target.checked)"
              />
            </template>
          </template>

          <template #bodyCell="{ column, record }">
            <!-- Checkbox Column -->
            <template v-if="column.key === 'checkbox'">
              <a-checkbox
                :checked="selectedEmployeeIds.has(record.employee.id)"
                :disabled="isCheckboxDisabled(record)"
                @change="
                  (e) =>
                    toggleEmployeeSelection(
                      record.employee.id,
                      e.target.checked,
                    )
                "
              />
            </template>

            <!-- Employee Name Column -->
            <template v-else-if="column.key === 'employeeName'">
              <span>
                <user-outlined style="margin-right: 4px; color: #b37feb" />
                {{ $getFullName(record.employee, true) }}
              </span>
            </template>

            <!-- Section Column -->
            <template v-else-if="column.key === 'section'">
              <span>
                {{ record.employee.section?.name || "-" }}
              </span>
            </template>

            <!-- Department Column -->
            <template v-else-if="column.key === 'department'">
              <span>
                {{ record.employee.department?.name || "-" }}
              </span>
            </template>

            <!-- Total KPIs Column -->
            <template v-else-if="column.key === 'totalKpis'">
              <a-tag color="blue">{{ record.totalKpis }}</a-tag>
            </template>

            <template v-else-if="column.key === 'workflow'">
              <div class="workflow-cell">
                <a-tag color="processing">
                  {{ getGroupedApprovalSummary(record).currentStep }}
                </a-tag>
                <div class="workflow-next">
                  {{ getGroupedApprovalSummary(record).nextAction }}
                </div>
              </div>
            </template>

            <!-- Actions Column -->
            <template v-else-if="column.key === 'actions'">
              <a-button
                type="primary"
                size="small"
                :disabled="isCheckboxDisabled(record)"
                @click="openEmployeeKpisModal(record)"
              >
                <eye-outlined />
                {{ $t("viewAndEditKpis") }}
              </a-button>
            </template>
          </template>
        </a-table>
      </div>

      <!-- Empty State -->
      <a-empty
        v-else
        :description="$t('noPendingApprovals')"
        class="empty-state"
      />
    </a-card>

    <!-- Employee KPIs Modal -->
    <a-modal
      :open="isEmployeeKpisModalVisible"
      :title="
        $t('kpisOfEmployee', {
          name: $getFullName(currentViewingEmployee?.employee) || currentViewingEmployee?.employee?.username || '',
        })
      "
      @ok="handleSaveCorrections"
      @cancel="closeEmployeeKpisModal"
      :width="1400"
      :ok-text="$t('saveCorrections')"
      :cancel-text="$t('cancel')"
      destroyOnClose
      :body-style="{ padding: '16px' }"
    >
      <a-spin :spinning="savingCorrections">
        <div
          v-if="currentViewingEmployee"
          style="max-height: 70vh; overflow-y: auto; padding: 8px"
          class="kpi-modal-content"
        >
          <a-space direction="vertical" :size="16" style="width: 100%">
            <a-card
              v-for="record in currentViewingEmployee.kpiValues"
              :key="record.id"
              :title="record.kpiAssignment?.kpi?.name || ''"
              size="small"
              style="margin-bottom: 0"
            >
              <template #extra>
                <a-space>
                  <a-tag :color="getStatusColor(record.status)">
                    {{ getStatusText(record.status) }}
                  </a-tag>
                  <a-button
                    v-if="
                      Array.isArray(record.project_details) &&
                      record.project_details.length > 0
                    "
                    size="small"
                    type="link"
                    @click="openProjectDetailsModal(record)"
                  >
                    <file-text-outlined />
                    {{ $t("viewDetails") }}
                  </a-button>
                </a-space>
              </template>

              <!-- Section 1: Basic Information -->
              <a-row :gutter="[16, 16]">
                <a-col :xs="24" :sm="12" :md="8" :lg="6">
                  <div
                    style="color: #8c8c8c; font-size: 12px; margin-bottom: 4px"
                  >
                    {{ $t("target") }}
                  </div>
                  <div style="font-size: 14px; font-weight: 500">
                    {{
                      record.kpiAssignment?.targetValue?.toLocaleString() ?? ""
                    }}
                    {{ record.kpiAssignment?.kpi?.unit || "" }}
                  </div>
                </a-col>
                <a-col :xs="24" :sm="12" :md="8" :lg="6">
                  <div
                    style="color: #8c8c8c; font-size: 12px; margin-bottom: 4px"
                  >
                    {{ $t("submittedValue") }}
                  </div>
                  <div style="font-size: 14px">
                    {{
                      editingValues[
                        record.id
                      ]?.originalValue?.toLocaleString() ?? ""
                    }}
                    {{ record.kpiAssignment?.kpi?.unit || "" }}
                  </div>
                </a-col>
                <a-col :xs="24" :sm="24" :md="8" :lg="12">
                  <div
                    style="color: #8c8c8c; font-size: 12px; margin-bottom: 4px"
                  >
                    {{ $t("editableActualValue") }}
                  </div>
                  <a-space>
                    <a-input-number
                      v-model:value="editingValues[record.id].value"
                      :min="0"
                      style="width: 150px"
                      @change="() => onValueChange(record.id)"
                    />
                    <span v-if="record.kpiAssignment?.kpi?.unit">
                      {{ record.kpiAssignment.kpi.unit }}
                    </span>
                  </a-space>
                </a-col>
              </a-row>

              <a-divider style="margin: 16px 0" />

              <!-- Section 2: Employee Self-Review -->
              <div style="margin-bottom: 16px">
                <div
                  style="
                    display: flex;
                    align-items: center;
                    margin-bottom: 12px;
                    color: #595959;
                    font-weight: 500;
                  "
                >
                  <UserOutlined style="margin-right: 8px; color: #1890ff" />
                  {{ $t("employeeSelfReview") }}
                </div>
                <a-row :gutter="[16, 12]">
                  <a-col :span="12">
                    <div
                      style="
                        color: #8c8c8c;
                        font-size: 12px;
                        margin-bottom: 4px;
                      "
                    >
                      {{ $t("selfScore") }}
                    </div>
                    <a-rate
                      v-if="record.review?.selfScore"
                      :value="record.review.selfScore"
                      :count="5"
                      allow-half
                      disabled
                      style="font-size: 16px"
                    />
                    <span v-else style="color: #8c8c8c">-</span>
                  </a-col>
                  <a-col :span="12">
                    <div
                      style="
                        color: #8c8c8c;
                        font-size: 12px;
                        margin-bottom: 4px;
                      "
                    >
                      {{ $t("selfComment") }}
                    </div>
                    <div
                      v-if="record.review?.selfComment"
                      class="read-only-comment"
                    >
                      {{ record.review.selfComment }}
                    </div>
                    <span v-else style="color: #8c8c8c">-</span>
                  </a-col>
                </a-row>
              </div>

              <!-- Section 3: Section Review (Read-only, conditional) -->
              <div
                v-if="managerLevel && managerLevel !== 'section'"
                style="margin-bottom: 16px"
              >
                <a-divider style="margin: 16px 0" />
                <div
                  style="
                    display: flex;
                    align-items: center;
                    margin-bottom: 12px;
                    color: #595959;
                    font-weight: 500;
                  "
                >
                  <TeamOutlined style="margin-right: 8px; color: #52c41a" />
                  {{ $t("sectionReview") }}
                </div>
                <a-row :gutter="[16, 12]">
                  <a-col :span="12">
                    <div
                      style="
                        color: #8c8c8c;
                        font-size: 12px;
                        margin-bottom: 4px;
                      "
                    >
                      {{ $t("sectionScore") }}
                    </div>
                    <a-rate
                      v-if="record.review?.sectionScore"
                      :value="record.review.sectionScore"
                      :count="5"
                      allow-half
                      disabled
                      style="font-size: 16px"
                    />
                    <span v-else style="color: #8c8c8c">-</span>
                  </a-col>
                  <a-col :span="12">
                    <div
                      style="
                        color: #8c8c8c;
                        font-size: 12px;
                        margin-bottom: 4px;
                      "
                    >
                      {{ $t("sectionComment") }}
                    </div>
                    <div
                      v-if="record.review?.sectionComment"
                      class="read-only-comment"
                    >
                      {{ record.review.sectionComment }}
                    </div>
                    <span v-else style="color: #8c8c8c">-</span>
                  </a-col>
                </a-row>
              </div>

              <!-- Section 4: Department Review (Read-only, chỉ cho manager) -->
              <div
                v-if="managerLevel === 'manager'"
                style="margin-bottom: 16px"
              >
                <a-divider style="margin: 16px 0" />
                <div
                  style="
                    display: flex;
                    align-items: center;
                    margin-bottom: 12px;
                    color: #595959;
                    font-weight: 500;
                  "
                >
                  <BankOutlined style="margin-right: 8px; color: #faad14" />
                  {{ $t("departmentReview") }}
                </div>
                <a-row :gutter="[16, 12]">
                  <a-col :span="12">
                    <div
                      style="
                        color: #8c8c8c;
                        font-size: 12px;
                        margin-bottom: 4px;
                      "
                    >
                      {{ $t("departmentScore") }}
                    </div>
                    <a-rate
                      v-if="record.review?.departmentScore"
                      :value="record.review.departmentScore"
                      :count="5"
                      allow-half
                      disabled
                      style="font-size: 16px"
                    />
                    <span v-else style="color: #8c8c8c">-</span>
                  </a-col>
                  <a-col :span="12">
                    <div
                      style="
                        color: #8c8c8c;
                        font-size: 12px;
                        margin-bottom: 4px;
                      "
                    >
                      {{ $t("departmentComment") }}
                    </div>
                    <div
                      v-if="record.review?.departmentComment"
                      class="read-only-comment"
                    >
                      {{ record.review.departmentComment }}
                    </div>
                    <span v-else style="color: #8c8c8c">-</span>
                  </a-col>
                </a-row>
              </div>

              <!-- Section 5: Manager Review (Editable) -->
              <div
                v-if="managerLevel"
                class="editable-section"
                style="margin-bottom: 16px"
              >
                <a-divider style="margin: 16px 0" />
                <div
                  style="
                    display: flex;
                    align-items: center;
                    margin-bottom: 12px;
                    color: #1890ff;
                    font-weight: 500;
                  "
                >
                  <CrownOutlined style="margin-right: 8px" />
                  {{
                    managerLevel === "manager"
                      ? $t("managerReview")
                      : managerLevel === "department"
                        ? $t("departmentReview")
                        : $t("sectionReview")
                  }}
                  <a-tag color="blue" style="margin-left: 8px; font-size: 11px">
                    {{ $t("editable") }}
                  </a-tag>
                </div>
                <a-row :gutter="[16, 12]">
                  <a-col :span="12">
                    <div
                      style="
                        color: #8c8c8c;
                        font-size: 12px;
                        margin-bottom: 8px;
                      "
                    >
                      {{
                        managerLevel === "manager"
                          ? $t("managerScore")
                          : managerLevel === "department"
                            ? $t("departmentScore")
                            : $t("sectionScore")
                      }}
                    </div>
                    <a-rate
                      v-model:value="
                        editingValues[record.id].managerReviewScore
                      "
                      :count="5"
                      allow-half
                      style="font-size: 18px"
                      @change="() => onManagerReviewScoreChange(record.id)"
                    />
                  </a-col>
                  <a-col :span="12">
                    <div
                      style="
                        color: #8c8c8c;
                        font-size: 12px;
                        margin-bottom: 8px;
                      "
                    >
                      {{
                        managerLevel === "manager"
                          ? $t("managerComment")
                          : managerLevel === "department"
                            ? $t("departmentComment")
                            : $t("sectionComment")
                      }}
                    </div>
                    <a-textarea
                      v-model:value="
                        editingValues[record.id].managerReviewComment
                      "
                      :rows="3"
                      :maxlength="500"
                      show-count
                      style="width: 100%"
                      @change="() => onManagerReviewCommentChange(record.id)"
                    />
                  </a-col>
                </a-row>
              </div>

              <!-- Section 6: Corrections (Conditional) -->
              <div
                v-if="editingValues[record.id]?.edited"
                class="correction-section"
                style="margin-bottom: 16px"
              >
                <a-divider style="margin: 16px 0" />
                <div
                  style="
                    display: flex;
                    align-items: center;
                    margin-bottom: 12px;
                    color: #d46b08;
                    font-weight: 500;
                  "
                >
                  <EditOutlined style="margin-right: 8px" />
                  {{ $t("correctionReason") }}
                </div>
                <a-textarea
                  v-model:value="editingValues[record.id].notes"
                  :placeholder="$t('enterCorrectionReason')"
                  :rows="3"
                  :maxlength="500"
                  show-count
                  style="width: 100%"
                />
              </div>
            </a-card>
          </a-space>
        </div>
      </a-spin>
    </a-modal>

    <!-- Project Details Modal -->
    <a-modal
      :open="projectDetailsModalVisible"
      :title="$t('kpiDetailsAndCorrection')"
      @cancel="closeProjectDetailsModal"
      :footer="null"
      :width="700"
      destroyOnClose
    >
      <div v-if="selectedKpiForDetails">
        <!-- KPI Info Card -->
        <a-card size="small" style="margin-bottom: 16px">
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
            "
          >
            <div>
              <h3 style="margin: 0">
                {{ selectedKpiForDetails.kpiAssignment?.kpi?.name }}
              </h3>
              <p style="margin: 4px 0 0 0; color: #8c8c8c">
                {{ $t("target") }}:
                <strong>{{
                  selectedKpiForDetails.kpiAssignment?.targetValue?.toLocaleString()
                }}</strong>
                {{ selectedKpiForDetails.kpiAssignment?.kpi?.unit }}
              </p>
            </div>
            <a-tag :color="getStatusColor(selectedKpiForDetails.status)">
              {{ getStatusText(selectedKpiForDetails.status) }}
            </a-tag>
          </div>
        </a-card>

        <!-- Project Details Card -->
        <a-card
          :title="$t('projectDetails')"
          size="small"
          style="margin-bottom: 16px"
        >
          <a-table
            :columns="projectDetailsColumns"
            :data-source="selectedKpiForDetails.project_details"
            :pagination="false"
            size="small"
            :row-key="(r) => r.name"
            bordered
          >
            <template #bodyCell="{ column: col, record: proj }">
              <template v-if="col.key === 'value'">
                <strong>{{ proj.value?.toLocaleString() ?? "" }}</strong>
              </template>
            </template>
          </a-table>
        </a-card>

        <!-- Correction Alert & Details Card -->
        <div
          v-if="
            selectedKpiForDetails.corrected_value !== null &&
            selectedKpiForDetails.corrected_value !== undefined
          "
        >
          <a-alert type="warning" show-icon style="margin-bottom: 16px">
            <template #message>
              <strong>{{ $t("valueWasCorrectedByApprover") }}</strong>
            </template>
            <template #description>
              {{ $t("approverHasModifiedSubmittedValue") }}
            </template>
          </a-alert>

          <a-card :title="$t('correctionDetails')" size="small">
            <a-row :gutter="16">
              <a-col :span="12">
                <div class="value-compare-card original">
                  <div class="value-label">
                    {{ $t("originalSubmittedValue") }}
                  </div>
                  <div class="value-number">
                    {{ selectedKpiForDetails.value?.toLocaleString() ?? "" }}
                    <span class="unit">{{
                      selectedKpiForDetails.kpiAssignment?.kpi?.unit
                    }}</span>
                  </div>
                </div>
              </a-col>
              <a-col :span="12">
                <div class="value-compare-card corrected">
                  <div class="value-label">{{ $t("correctedValue") }}</div>
                  <div class="value-number">
                    {{
                      selectedKpiForDetails.corrected_value?.toLocaleString() ??
                      ""
                    }}
                    <span class="unit">{{
                      selectedKpiForDetails.kpiAssignment?.kpi?.unit
                    }}</span>
                  </div>
                </div>
              </a-col>
            </a-row>

            <a-divider style="margin: 16px 0" />

            <div v-if="selectedKpiForDetails.correction_notes">
              <div style="font-weight: 600; margin-bottom: 8px; color: #595959">
                {{ $t("correctionReason") }}:
              </div>
              <a-alert
                :message="selectedKpiForDetails.correction_notes"
                type="info"
                show-icon
              />
            </div>
          </a-card>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { notification, Rate as ARate } from "ant-design-vue";
import apiClient from "@/core/services/api";
import {
  TrophyOutlined,
  UserOutlined,
  EyeOutlined,
  CheckOutlined,
  FileTextOutlined,
  TeamOutlined,
  BankOutlined,
  CrownOutlined,
  EditOutlined,
} from "@ant-design/icons-vue";
import {
  KpiValueStatus,
  getKpiValueStatusText,
  KpiValueStatusColor,
} from "@/core/constants/kpiStatus";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import { summarizeGroupedApprovals } from "@/core/utils/workflowTasks";

const store = useStore();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

// Reactive data
const selectedEmployeeIds = ref(new Set());
const batchApproving = ref(false);
const currentViewingEmployee = ref(null);
const isEmployeeKpisModalVisible = ref(false);
const editingValues = ref({});
const savingCorrections = ref(false);
const projectDetailsModalVisible = ref(false);
const selectedKpiForDetails = ref(null);

// Computed properties
const loading = computed(() => store.getters["loading/isLoading"]);
const error = computed(() => store.getters["kpiValues/getPendingError"]);
const groupedApprovals = computed(
  () => store.getters["kpiValues/getPendingApprovals"] || [],
);
const currentUser = computed(() => store.getters["auth/user"]);
const userPermissions = computed(() => currentUser.value?.permissions || []);

// Permission checking function
function hasPermission(action, resource, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action?.trim() === action &&
      p.resource?.trim() === resource &&
      (scope ? p.scope?.trim() === scope : true),
  );
}

// Permission checks
const canApproveSection = computed(() =>
  hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, "section"),
);
const canApproveDepartment = computed(() =>
  hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, "department"),
);
const canApproveManager = computed(() =>
  hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, "manager"),
);

// Determine manager level for review score editing
const managerLevel = computed(() => {
  if (canApproveManager.value) return "manager";
  if (canApproveDepartment.value) return "department";
  if (canApproveSection.value) return "section";
  return null;
});

// Check if user has any view or approval permissions
const hasAnyApprovalPermission = computed(() => {
  const canViewSection = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI_VALUE,
    "section",
  );
  const canViewDepartment = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI_VALUE,
    "department",
  );
  const canViewManager = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI_VALUE,
    "manager",
  );

  const hasApprovalPermissions =
    canApproveSection.value ||
    canApproveDepartment.value ||
    canApproveManager.value;

  const hasViewPermissions =
    canViewSection || canViewDepartment || canViewManager;

  return hasApprovalPermissions || hasViewPermissions;
});

// Employee table columns
const employeeColumns = computed(() => [
  {
    title: "",
    key: "checkbox",
    width: 50,
  },
  {
    title: t("employeeName"),
    key: "employeeName",
    width: 200,
  },
  {
    title: t("department"),
    key: "department",
    width: 150,
  },
  {
    title: t("section"),
    key: "section",
    width: 150,
  },
  {
    title: t("totalPendingKpis"),
    key: "totalKpis",
    width: 120,
    align: "center",
  },
  {
    title: t("workflowStatus"),
    key: "workflow",
    width: 280,
  },
  {
    title: t("actions"),
    key: "actions",
    width: 180,
    align: "center",
    fixed: "right",
  },
]);

// kpiModalColumns đã được thay thế bằng card-based layout

// Project details columns (for popover)
const projectDetailsColumns = computed(() => [
  {
    title: t("projectOrTaskName"),
    dataIndex: "name",
    key: "name",
  },
  {
    title: t("value"),
    dataIndex: "value",
    key: "value",
    align: "right",
  },
]);

// Pagination configuration
const pagination = computed(() => ({
  pageSize: 10,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total, range) =>
    t("showingResults", { start: range[0], end: range[1], total }),
  pageSizeOptions: ["10", "20", "50", "100"],
}));

// Helper functions
const getStatusColor = (status) => {
  return KpiValueStatusColor[status] || "default";
};

const getStatusText = (status) => {
  const statusTextMap = getKpiValueStatusText(t);
  return statusTextMap[status] || status || t("unknown");
};

const getGroupedApprovalSummary = (group) => summarizeGroupedApprovals(group, t);

const isCheckboxDisabled = (employeeData) => {
  if (employeeData.kpiValues.length === 0) {
    return true;
  }

  // Check if user has permission to approve at least one KPI
  const hasApprovableKpi = employeeData.kpiValues.some((kpiValue) => {
    if (
      kpiValue.status === KpiValueStatus.PENDING_SECTION_APPROVAL &&
      canApproveSection.value
    ) {
      return true;
    }
    if (
      kpiValue.status === KpiValueStatus.PENDING_DEPT_APPROVAL &&
      canApproveDepartment.value
    ) {
      return true;
    }
    if (
      kpiValue.status === KpiValueStatus.PENDING_MANAGER_APPROVAL &&
      canApproveManager.value
    ) {
      return true;
    }
    return false;
  });

  return !hasApprovableKpi;
};

const isAllSelected = computed(() => {
  if (groupedApprovals.value.length === 0) return false;

  const enabledEmployees = groupedApprovals.value.filter(
    (emp) => !isCheckboxDisabled(emp),
  );
  if (enabledEmployees.length === 0) return false;

  return enabledEmployees.every((emp) =>
    selectedEmployeeIds.value.has(emp.employee.id),
  );
});

const isIndeterminate = computed(() => {
  if (groupedApprovals.value.length === 0) return false;

  const enabledEmployees = groupedApprovals.value.filter(
    (emp) => !isCheckboxDisabled(emp),
  );
  if (enabledEmployees.length === 0) return false;

  const selectedCount = enabledEmployees.filter((emp) =>
    selectedEmployeeIds.value.has(emp.employee.id),
  ).length;

  return selectedCount > 0 && selectedCount < enabledEmployees.length;
});

const toggleSelectAll = (checked) => {
  if (checked) {
    const enabledEmployees = groupedApprovals.value.filter(
      (emp) => !isCheckboxDisabled(emp),
    );
    enabledEmployees.forEach((emp) => {
      selectedEmployeeIds.value.add(emp.employee.id);
    });
  } else {
    selectedEmployeeIds.value.clear();
  }
};

const toggleEmployeeSelection = (employeeId, checked) => {
  if (checked) {
    selectedEmployeeIds.value.add(employeeId);
  } else {
    selectedEmployeeIds.value.delete(employeeId);
  }
};

// Modal functions
/**
 * Helper function to get score from lower level if current level score is not provided
 * @param {Object} review - KpiReview object
 * @param {string} level - Current manager level: "section", "department", or "manager"
 * @param {number|undefined} currentScore - Score entered by current manager (may be undefined)
 * @returns {number|undefined} - Score to use (either currentScore or fallback from lower level)
 */
const getScoreWithFallback = (review, level, currentScore) => {
  // If current score is provided, use it
  if (currentScore !== undefined && currentScore !== null && currentScore > 0) {
    return currentScore;
  }

  // Otherwise, fallback to lower level scores
  if (level === "section") {
    // Section: fallback to selfScore
    return review?.selfScore ?? undefined;
  } else if (level === "department") {
    // Department: fallback to sectionScore, then selfScore
    return review?.sectionScore ?? review?.selfScore ?? undefined;
  } else if (level === "manager") {
    // Manager: fallback to departmentScore, then sectionScore, then selfScore
    return (
      review?.departmentScore ??
      review?.sectionScore ??
      review?.selfScore ??
      undefined
    );
  }

  return undefined;
};

const openEmployeeKpisModal = (employeeData) => {
  currentViewingEmployee.value = employeeData;

  // Initialize editing values
  editingValues.value = {};
  employeeData.kpiValues.forEach((kv) => {
    // Determine which score and comment fields to edit based on manager level
    let managerReviewScore = undefined;
    let originalManagerReviewScore = undefined;
    let managerReviewComment = undefined;
    let originalManagerReviewComment = undefined;

    if (managerLevel.value === "manager") {
      managerReviewScore = kv.review?.managerScore ?? undefined;
      originalManagerReviewScore = kv.review?.managerScore ?? undefined;
      managerReviewComment = kv.review?.managerComment ?? null;
      originalManagerReviewComment = kv.review?.managerComment ?? null;
    } else if (managerLevel.value === "department") {
      managerReviewScore = kv.review?.departmentScore ?? undefined;
      originalManagerReviewScore = kv.review?.departmentScore ?? undefined;
      managerReviewComment = kv.review?.departmentComment ?? null;
      originalManagerReviewComment = kv.review?.departmentComment ?? null;
    } else if (managerLevel.value === "section") {
      managerReviewScore = kv.review?.sectionScore ?? undefined;
      originalManagerReviewScore = kv.review?.sectionScore ?? undefined;
      managerReviewComment = kv.review?.sectionComment ?? null;
      originalManagerReviewComment = kv.review?.sectionComment ?? null;
    }

    editingValues.value[kv.id] = {
      value: kv.corrected_value ?? kv.value, // Use corrected_value if exists, else original value
      notes: kv.correction_notes || "", // Load existing correction notes from database
      edited: false,
      originalValue: kv.value, // Always the original submitted value
      managerReviewScore: managerReviewScore, // Score for manager's level
      originalManagerReviewScore: originalManagerReviewScore, // Track original score
      managerReviewComment: managerReviewComment, // Comment for manager's level
      originalManagerReviewComment: originalManagerReviewComment, // Track original comment
      reviewId: kv.review?.id ?? null, // Store review ID for update
    };
  });

  isEmployeeKpisModalVisible.value = true;
};

const closeEmployeeKpisModal = () => {
  isEmployeeKpisModalVisible.value = false;
  currentViewingEmployee.value = null;
  editingValues.value = {};
  if (route.query.employeeId) {
    const nextQuery = { ...route.query };
    delete nextQuery.employeeId;
    router.replace({ query: nextQuery });
  }
};

const tryOpenEmployeeFromQuery = () => {
  const employeeId = Number(route.query.employeeId);
  if (!employeeId || !groupedApprovals.value.length) return;

  const targetEmployee = groupedApprovals.value.find(
    (group) => Number(group.employee?.id) === employeeId,
  );

  if (targetEmployee && !isEmployeeKpisModalVisible.value) {
    openEmployeeKpisModal(targetEmployee);
  }
};

const onValueChange = (kpiValueId) => {
  const editData = editingValues.value[kpiValueId];
  editData.edited = editData.value !== editData.originalValue;
};

const onManagerReviewScoreChange = (kpiValueId) => {
  const editData = editingValues.value[kpiValueId];
  // Mark as edited if manager review score changed
  const scoreChanged =
    editData.managerReviewScore !== editData.originalManagerReviewScore;
  // Also mark as edited if value changed
  const valueChanged = editData.value !== editData.originalValue;
  // Also mark as edited if comment changed
  const commentChanged =
    editData.managerReviewComment !== editData.originalManagerReviewComment;
  editData.edited = valueChanged || scoreChanged || commentChanged;
};

const onManagerReviewCommentChange = (kpiValueId) => {
  const editData = editingValues.value[kpiValueId];
  // Mark as edited if manager review comment changed
  const commentChanged =
    editData.managerReviewComment !== editData.originalManagerReviewComment;
  // Also mark as edited if value or score changed
  const valueChanged = editData.value !== editData.originalValue;
  const scoreChanged =
    editData.managerReviewScore !== editData.originalManagerReviewScore;
  editData.edited = valueChanged || scoreChanged || commentChanged;
};

const handleSaveCorrections = async () => {
  // Separate value corrections and review score updates
  const valueCorrections = Object.entries(editingValues.value)
    .filter(([, data]) => {
      // Only include if value was changed (not just selfScore)
      return data.value !== data.originalValue;
    })
    .map(([id, data]) => ({ id: Number(id), ...data }));

  const reviewUpdates = Object.entries(editingValues.value)
    .filter(([, data]) => {
      // Include if manager review score or comment was changed and review exists
      const scoreChanged =
        data.managerReviewScore !== data.originalManagerReviewScore &&
        data.managerReviewScore !== undefined;
      const commentChanged =
        (data.managerReviewComment ?? null) !==
        (data.originalManagerReviewComment ?? null);
      return data.reviewId && (scoreChanged || commentChanged);
    })
    .map(([id, data]) => {
      const updateData = {
        kpiValueId: Number(id),
        reviewId: data.reviewId,
      };

      // Set the appropriate score and comment fields based on manager level
      if (managerLevel.value === "manager") {
        if (data.managerReviewScore !== data.originalManagerReviewScore) {
          updateData.managerScore = data.managerReviewScore;
        }
        if (data.managerReviewComment !== data.originalManagerReviewComment) {
          updateData.managerComment = data.managerReviewComment;
        }
      } else if (managerLevel.value === "department") {
        if (data.managerReviewScore !== data.originalManagerReviewScore) {
          updateData.departmentScore = data.managerReviewScore;
        }
        if (data.managerReviewComment !== data.originalManagerReviewComment) {
          updateData.departmentComment = data.managerReviewComment;
        }
      } else if (managerLevel.value === "section") {
        if (data.managerReviewScore !== data.originalManagerReviewScore) {
          updateData.sectionScore = data.managerReviewScore;
        }
        if (data.managerReviewComment !== data.originalManagerReviewComment) {
          updateData.sectionComment = data.managerReviewComment;
        }
      }

      return updateData;
    });

  // Validate: nếu có sửa value thì phải có notes
  for (const correction of valueCorrections) {
    if (!correction.notes || correction.notes.trim() === "") {
      notification.error({
        message: t("validationError"),
        description: t("correctionNotesRequired"),
      });
      return;
    }
  }

  // Call API to update corrections
  savingCorrections.value = true;
  try {
    // Update KPI values if any were corrected
    for (const correction of valueCorrections) {
      await store.dispatch("kpiValues/updateKpiValue", {
        kpiValueId: correction.id,
        updateData: {
          value: correction.value,
          notes: correction.notes,
          correctedByApprover: true,
          correctionNotes: correction.notes,
        },
        showNotification: false,
      });
    }

    // Update review score and comment if changed (based on manager level)
    for (const reviewUpdate of reviewUpdates) {
      try {
        const updatePayload = {};

        // Add score if changed
        if (reviewUpdate.managerScore !== undefined) {
          updatePayload.managerScore = reviewUpdate.managerScore;
        }
        if (reviewUpdate.departmentScore !== undefined) {
          updatePayload.departmentScore = reviewUpdate.departmentScore;
        }
        if (reviewUpdate.sectionScore !== undefined) {
          updatePayload.sectionScore = reviewUpdate.sectionScore;
        }

        // Add comment if changed
        if (reviewUpdate.managerComment !== undefined) {
          updatePayload.managerComment = reviewUpdate.managerComment;
        }
        if (reviewUpdate.departmentComment !== undefined) {
          updatePayload.departmentComment = reviewUpdate.departmentComment;
        }
        if (reviewUpdate.sectionComment !== undefined) {
          updatePayload.sectionComment = reviewUpdate.sectionComment;
        }

        await apiClient.patch(
          `/kpi-review/${reviewUpdate.reviewId}`,
          updatePayload,
        );
      } catch (error) {
        console.error(
          `Failed to update review ${reviewUpdate.reviewId}:`,
          error,
        );
        // Continue with other updates even if one fails
      }
    }

    notification.success({
      message: t("correctionsSaved"),
      description: t("correctionsSavedSuccessfully"),
    });

    isEmployeeKpisModalVisible.value = false;
    await fetchPendingApprovals(); // Refresh list
  } catch (error) {
    notification.error({
      message: t("saveFailed"),
      description: error.message || t("failedToSaveCorrections"),
    });
  } finally {
    savingCorrections.value = false;
  }
};

const handleBatchApprove = async () => {
  if (selectedEmployeeIds.value.size === 0) {
    notification.warning({
      message: t("noEmployeeSelected"),
      description: t("pleaseSelectAtLeastOneEmployee"),
    });
    return;
  }

  batchApproving.value = true;
  try {
    // Get all KPI values of selected employees
    const selectedEmployees = groupedApprovals.value.filter((emp) =>
      selectedEmployeeIds.value.has(emp.employee.id),
    );

    // First, save any pending review score/comment updates from editingValues
    // This ensures that if manager entered score/comment in modal but didn't save, it will be saved before approve
    if (Object.keys(editingValues.value).length > 0 && managerLevel.value) {
      const reviewUpdates = Object.entries(editingValues.value)
        .filter(([, data]) => {
          const scoreChanged =
            data.managerReviewScore !== data.originalManagerReviewScore &&
            data.managerReviewScore !== undefined;
          const commentChanged =
            data.managerReviewComment !== data.originalManagerReviewComment;
          return data.reviewId && (scoreChanged || commentChanged);
        })
        .map(([, data]) => {
          const updateData = {
            reviewId: data.reviewId,
          };

          if (managerLevel.value === "manager") {
            if (data.managerReviewScore !== data.originalManagerReviewScore) {
              updateData.managerScore = data.managerReviewScore;
            }
            if (
              data.managerReviewComment !== data.originalManagerReviewComment
            ) {
              updateData.managerComment = data.managerReviewComment;
            }
          } else if (managerLevel.value === "department") {
            if (data.managerReviewScore !== data.originalManagerReviewScore) {
              updateData.departmentScore = data.managerReviewScore;
            }
            if (
              data.managerReviewComment !== data.originalManagerReviewComment
            ) {
              updateData.departmentComment = data.managerReviewComment;
            }
          } else if (managerLevel.value === "section") {
            if (data.managerReviewScore !== data.originalManagerReviewScore) {
              updateData.sectionScore = data.managerReviewScore;
            }
            if (
              data.managerReviewComment !== data.originalManagerReviewComment
            ) {
              updateData.sectionComment = data.managerReviewComment;
            }
          }

          return updateData;
        });

      // Save review updates before approving
      for (const reviewUpdate of reviewUpdates) {
        try {
          const updatePayload = {};
          if (reviewUpdate.managerScore !== undefined) {
            updatePayload.managerScore = reviewUpdate.managerScore;
          }
          if (reviewUpdate.departmentScore !== undefined) {
            updatePayload.departmentScore = reviewUpdate.departmentScore;
          }
          if (reviewUpdate.sectionScore !== undefined) {
            updatePayload.sectionScore = reviewUpdate.sectionScore;
          }
          if (reviewUpdate.managerComment !== undefined) {
            updatePayload.managerComment = reviewUpdate.managerComment;
          }
          if (reviewUpdate.departmentComment !== undefined) {
            updatePayload.departmentComment = reviewUpdate.departmentComment;
          }
          if (reviewUpdate.sectionComment !== undefined) {
            updatePayload.sectionComment = reviewUpdate.sectionComment;
          }

          if (Object.keys(updatePayload).length > 0) {
            await apiClient.patch(
              `/kpi-review/${reviewUpdate.reviewId}`,
              updatePayload,
            );
          }
        } catch (error) {
          console.error(
            `Failed to save review before approve: ${error.message}`,
          );
          // Continue with approval even if review save fails
        }
      }
    }

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const empData of selectedEmployees) {
      for (const kpiValue of empData.kpiValues) {
        let actionTaken = false;
        try {
          // Determine which approve action to call based on status and permissions
          // Priority: Manager > Department > Section
          // Department can approve from PENDING_SECTION_APPROVAL (skip level)
          // Manager can approve from any pending status (skip levels)
          if (kpiValue.status === KpiValueStatus.PENDING_SECTION_APPROVAL) {
            // If user has manager permission, approve as manager
            if (canApproveManager.value) {
              const editData = editingValues.value[kpiValue.id];
              let managerScore =
                editData && managerLevel.value === "manager"
                  ? editData.managerReviewScore
                  : undefined;
              if (
                (managerScore === undefined ||
                  managerScore === null ||
                  managerScore === 0) &&
                kpiValue.review
              ) {
                managerScore = getScoreWithFallback(
                  kpiValue.review,
                  "manager",
                  managerScore,
                );
              }
              const managerComment =
                editData && managerLevel.value === "manager"
                  ? editData.managerReviewComment
                  : undefined;

              await store.dispatch("kpiValues/approveValueManager", {
                valueId: kpiValue.id,
                showNotification: false,
                skipRefresh: true,
                managerScore: managerScore,
                managerComment: managerComment,
              });
              actionTaken = true;
            }
            // If user has department permission (but not manager), approve as department
            else if (canApproveDepartment.value) {
              const editData = editingValues.value[kpiValue.id];
              let departmentScore =
                editData && managerLevel.value === "department"
                  ? editData.managerReviewScore
                  : undefined;
              if (
                (departmentScore === undefined ||
                  departmentScore === null ||
                  departmentScore === 0) &&
                kpiValue.review
              ) {
                departmentScore = getScoreWithFallback(
                  kpiValue.review,
                  "department",
                  departmentScore,
                );
              }
              const departmentComment =
                editData && managerLevel.value === "department"
                  ? editData.managerReviewComment
                  : undefined;

              await store.dispatch("kpiValues/approveValueDept", {
                valueId: kpiValue.id,
                showNotification: false,
                skipRefresh: true,
                departmentScore: departmentScore,
                departmentComment: departmentComment,
              });
              actionTaken = true;
            }
            // If user only has section permission, approve as section
            else if (canApproveSection.value) {
              const editData = editingValues.value[kpiValue.id];
              let sectionScore =
                editData && managerLevel.value === "section"
                  ? editData.managerReviewScore
                  : undefined;
              if (
                (sectionScore === undefined ||
                  sectionScore === null ||
                  sectionScore === 0) &&
                kpiValue.review
              ) {
                sectionScore = getScoreWithFallback(
                  kpiValue.review,
                  "section",
                  sectionScore,
                );
              }
              const sectionComment =
                editData && managerLevel.value === "section"
                  ? editData.managerReviewComment
                  : undefined;

              await store.dispatch("kpiValues/approveValueSection", {
                valueId: kpiValue.id,
                showNotification: false,
                skipRefresh: true,
                sectionScore: sectionScore,
                sectionComment: sectionComment,
              });
              actionTaken = true;
            }
          } else if (kpiValue.status === KpiValueStatus.PENDING_DEPT_APPROVAL) {
            // If user has manager permission, approve as manager
            if (canApproveManager.value) {
              const editData = editingValues.value[kpiValue.id];
              let managerScore =
                editData && managerLevel.value === "manager"
                  ? editData.managerReviewScore
                  : undefined;
              if (
                (managerScore === undefined ||
                  managerScore === null ||
                  managerScore === 0) &&
                kpiValue.review
              ) {
                managerScore = getScoreWithFallback(
                  kpiValue.review,
                  "manager",
                  managerScore,
                );
              }
              const managerComment =
                editData && managerLevel.value === "manager"
                  ? editData.managerReviewComment
                  : undefined;

              await store.dispatch("kpiValues/approveValueManager", {
                valueId: kpiValue.id,
                showNotification: false,
                skipRefresh: true,
                managerScore: managerScore,
                managerComment: managerComment,
              });
              actionTaken = true;
            }
            // If user has department permission, approve as department
            else if (canApproveDepartment.value) {
              const editData = editingValues.value[kpiValue.id];
              let departmentScore =
                editData && managerLevel.value === "department"
                  ? editData.managerReviewScore
                  : undefined;
              if (
                (departmentScore === undefined ||
                  departmentScore === null ||
                  departmentScore === 0) &&
                kpiValue.review
              ) {
                departmentScore = getScoreWithFallback(
                  kpiValue.review,
                  "department",
                  departmentScore,
                );
              }
              const departmentComment =
                editData && managerLevel.value === "department"
                  ? editData.managerReviewComment
                  : undefined;

              await store.dispatch("kpiValues/approveValueDept", {
                valueId: kpiValue.id,
                showNotification: false,
                skipRefresh: true,
                departmentScore: departmentScore,
                departmentComment: departmentComment,
              });
              actionTaken = true;
            }
          } else if (
            kpiValue.status === KpiValueStatus.PENDING_MANAGER_APPROVAL &&
            canApproveManager.value
          ) {
            // Get review score/comment from editingValues if available
            const editData = editingValues.value[kpiValue.id];
            let managerScore =
              editData && managerLevel.value === "manager"
                ? editData.managerReviewScore
                : undefined;
            // If no score entered, fallback to departmentScore, sectionScore, or selfScore
            if (
              (managerScore === undefined ||
                managerScore === null ||
                managerScore === 0) &&
              kpiValue.review
            ) {
              managerScore = getScoreWithFallback(
                kpiValue.review,
                "manager",
                managerScore,
              );
            }
            const managerComment =
              editData && managerLevel.value === "manager"
                ? editData.managerReviewComment
                : undefined;

            await store.dispatch("kpiValues/approveValueManager", {
              valueId: kpiValue.id,
              showNotification: false,
              skipRefresh: true,
              managerScore: managerScore,
              managerComment: managerComment,
            });
            actionTaken = true;
          } else {
            skippedCount++;
          }

          if (actionTaken) {
            successCount++;
          }
        } catch (error) {
          failedCount++;
        }
      }
    }

    console.groupEnd();

    if (successCount > 0 || failedCount > 0) {
      notification.success({
        message: t("batchApproveComplete"),
        description: t("batchApproveResult", {
          success: successCount,
          failed: failedCount,
        }),
      });
    } else if (skippedCount > 0) {
      notification.warning({
        message: t("noItemsApproved") || "No Items Approved",
        description: "No items were approved. Please check permissions.",
      });
    }

    selectedEmployeeIds.value.clear();
    await fetchPendingApprovals(); // Refresh list once at the end
  } catch (error) {
    notification.error({
      message: t("batchApproveFailed"),
      description: error.message || t("failedToBatchApprove"),
    });
  } finally {
    batchApproving.value = false;
  }
};

const clearError = () => {
  store.commit("kpiValues/SET_PENDING_ERROR", null);
};

const openProjectDetailsModal = (kpiRecord) => {
  selectedKpiForDetails.value = kpiRecord;
  projectDetailsModalVisible.value = true;
};

const closeProjectDetailsModal = () => {
  projectDetailsModalVisible.value = false;
  selectedKpiForDetails.value = null;
};

const fetchPendingApprovals = async () => {
  await store.dispatch("kpiValues/fetchPendingApprovals", {
    groupByEmployee: true,
  });
};

// Lifecycle hooks
onMounted(async () => {
  try {
    await fetchPendingApprovals();
    tryOpenEmployeeFromQuery();
  } catch (error) {
    // Handle loading error silently
  }
});

watch(groupedApprovals, () => {
  tryOpenEmployeeFromQuery();
});
</script>

<style scoped>
.kpi-value-approval-list {
  background-color: #f5f5f5;
  min-height: auto;
}

.modern-card {
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: none;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-icon {
  font-size: 24px;
  color: #1890ff;
}

.page-title {
  font-size: 17px;
  font-weight: 600;
  color: #262626;
}

.table-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.modern-table {
  border-radius: 8px;
}

.modern-table :deep(.ant-table-thead > tr > th) {
  background-color: #fafafa;
  font-weight: 600;
  color: #262626;
  border-bottom: 2px solid #f0f0f0;
}

.modern-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
}

.modern-table :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #f8f9fa;
}

.empty-state {
  padding: 48px 0;
}

.value-compare-card {
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  transition: all 0.3s ease;
}

.value-compare-card.original {
  background: linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%);
  border: 2px solid #91d5ff;
}

.value-compare-card.corrected {
  background: linear-gradient(135deg, #fff2e8 0%, #ffe7ba 100%);
  border: 2px solid #ffbb96;
}

.value-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.value-number {
  font-size: 32px;
  font-weight: 700;
  color: #262626;
  line-height: 1;
}

.value-compare-card.corrected .value-number {
  color: #d4380d;
}

.value-number .unit {
  font-size: 14px;
  font-weight: 500;
  color: #8c8c8c;
  margin-left: 4px;
}

/* Responsive design */
@media (max-width: 768px) {
  .kpi-value-approval-list {
    padding: 16px;
  }

  .page-title {
    font-size: 15px;
  }

  .modern-table :deep(.ant-table-tbody > tr > td) {
    padding: 8px;
    font-size: 14px;
  }

  .kpi-modal-content {
    scrollbar-width: thin;
    scrollbar-color: #d9d9d9 #f5f5f5;
  }

  .kpi-modal-content::-webkit-scrollbar {
    width: 6px;
  }

  .kpi-modal-content::-webkit-scrollbar-track {
    background: #f5f5f5;
    border-radius: 3px;
  }

  .kpi-modal-content::-webkit-scrollbar-thumb {
    background: #d9d9d9;
    border-radius: 3px;
  }

  .kpi-modal-content::-webkit-scrollbar-thumb:hover {
    background: #bfbfbf;
  }

  /* Card styling improvements */
  :deep(.ant-card) {
    transition: box-shadow 0.3s ease;
  }

  :deep(.ant-card):hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }

  /* Section header styling */
  .section-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    color: #595959;
    font-weight: 500;
    font-size: 14px;
  }

  /* Read-only comment box */
  .read-only-comment {
    padding: 8px;
    background: #f5f5f5;
    border-radius: 4px;
    white-space: pre-wrap;
    min-height: 32px;
    border: 1px solid #e8e8e8;
  }

  /* Editable section highlight */
  .editable-section {
    padding: 12px;
    background: #e6f7ff;
    border-radius: 4px;
    border: 1px solid #91d5ff;
  }

  /* Correction section highlight */
  .correction-section {
    padding: 12px;
    background: #fff7e6;
    border-radius: 4px;
    border: 1px solid #ffd591;
  }

  .workflow-cell {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .workflow-next {
    color: #64748b;
    font-size: 12px;
    line-height: 1.4;
  }
}
</style>
