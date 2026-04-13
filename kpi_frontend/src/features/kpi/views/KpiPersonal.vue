<template>
  <div class="kpi-personal-list-page">
    <a-card>
      <template #title>
        <span style="display: flex; align-items: center; gap: 8px">
    <history-outlined style="color: #1890ff; font-size: 24px" />
    <span style="font-size: 20px; font-weight: 600">{{ $t("myAssignedKpis") }}</span>
        </span>
      </template>
      <template #extra>
        <a-space>
          <a-button
            type="primary"
            @click="goToCreatePersonalTemplatesKpi"
            v-if="canCreatePersonalKpi"
          >
            <plus-outlined />
            {{ $t("createPersonalTemplatesKpi") }}
          </a-button>
          <a-button
            type="primary"
            @click="goToCreatePersonalKpi"
            v-if="canCreatePersonalKpi"
          >
            <plus-outlined />
            {{ $t("createPersonalKpi") }}
          </a-button>
        </a-space>
      </template>

      <!-- Header with Submit Button -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          gap: 16px;
          flex-wrap: nowrap;
        "
      >
        <p style="margin: 0; flex: 1; min-width: 0">
          {{ $t("listOfAssignedKpis", { user: actualUser?.username || "" }) }}
        </p>
        <a-button
          v-if="!loadingMyAssignments && hasKpis"
          type="primary"
          :disabled="selectedKpiIds.size === 0"
          :loading="batchSubmitting"
          @click="handleBatchSubmit"
          style="flex-shrink: 0"
        >
          <upload-outlined />
          {{ $t("batchSubmitSelected", { count: selectedKpiIds.size }) }}
        </a-button>
      </div>

      <div style="margin-bottom: 20px">
        <a-alert
          v-if="loadingMyAssignments"
          :message="$t('loadingYourKpis')"
          type="info"
          show-icon
        >
          <template #icon>
            <a-spin />
          </template>
        </a-alert>
        <a-alert
          v-else-if="myAssignmentsError"
          :message="myAssignmentsError"
          type="error"
          show-icon
          closable
          @close="clearError"
        />
        <a-alert
          v-else-if="!loadingMyAssignments && myAssignments.length === 0"
          :message="$t('noAssignedKpis')"
          type="warning"
          show-icon
        />
      </div>

      <div v-if="!loadingMyAssignments && hasKpis">
        <a-collapse
          v-model:activeKey="activePanelKeys"
          expandIconPosition="end"
          class="kpi-collapse-modern"
        >
          <a-collapse-panel
            v-for="(kpiList, perspectiveId) in groupedPersonalKpis"
            :key="perspectiveId"
            :header="`${kpiList[0].perspective?.id || '?'}. ${kpiList[0].perspective?.name || $t('uncategorized')} (${kpiList.length} ${kpiList.length > 1 ? $t('kpis') : $t('kpi')})`"
          >
            <a-table
              :columns="myPersonalKpiColumns"
              :data-source="kpiList"
              :row-key="'id'"
              :pagination="false"
              size="middle"
              bordered
              class="kpi-table-modern"
              :scroll="{ x: 'max-content' }"
            >
              <template #headerCell="{ column }">
                <template v-if="column.key === 'checkbox'">
                  <a-checkbox
                    :checked="isAllSelectedForPerspective(kpiList)"
                    :indeterminate="isIndeterminateForPerspective(kpiList)"
                    @change="
                      (e) =>
                        toggleSelectAllForPerspective(kpiList, e.target.checked)
                    "
                  />
                </template>
              </template>
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'checkbox'">
                  <a-checkbox
                    :checked="selectedKpiIds.has(record.id)"
                    :disabled="isCheckboxDisabled(record)"
                    @change="
                      (e) => toggleKpiSelection(record.id, e.target.checked)
                    "
                  />
                </template>
                <template v-else-if="column.key === 'name'">
                  <a
                    @click="
                      $router.push({
                        name: 'KpiDetail',
                        params: { id: record.id },
                      })
                    "
                    style="cursor: pointer; color: #1890ff; font-weight: 500"
                  >
                    {{ record.name }}
                  </a>
                </template>
                <template v-else-if="column.key === 'level'">
                  <a-tag
                    :color="getKpiLevelColor(record.created_by_type)"
                    style="font-weight: 500"
                  >
                    {{ record.created_by_type?.toUpperCase() || "" }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'target'">
                  <div style="text-align: right">
                    {{ getTargetValue(record)?.toLocaleString() ?? "" }}
                    <span v-if="record.unit"> {{ record.unit }}</span>
                  </div>
                </template>
                <template v-else-if="column.key === 'value'">
                  <div style="text-align: right">
                    {{ getApprovedValue(record)?.toLocaleString() ?? "-" }}
                    <span v-if="record.unit"> {{ record.unit }}</span>
                  </div>
                </template>
                <template v-else-if="column.key === 'progress'">
                  <template
                    :set="APPROVEDVal = getApprovedValue(record)"
                  ></template>
                  <template
                    :set="targetVal = getTargetValue(record)"
                  ></template>
                  <div style="text-align: center">
                    <a-progress
                      v-if="
                        targetVal != null &&
                        APPROVEDVal != null &&
                        targetVal !== 0
                      "
                      :percent="calculateProgress(APPROVEDVal, targetVal)"
                      size="small"
                      status="active"
                      :strokeColor="{ from: '#108ee9', to: '#87d068' }"
                      style="width: 90px"
                    />
                    <span v-else> - </span>
                  </div>
                </template>
                <template v-else-if="column.key === 'status'">
                  <template
                    :set="
                      latestValue = findLatestKpiValue(
                        getRelevantAssignment(record),
                      )
                        ? findLatestKpiValue(getRelevantAssignment(record))
                        : getRelevantAssignment(record)
                    "
                  ></template>
                  <div style="text-align: center">
                    <a-tag
                      :color="getValueStatusColor(latestValue?.status)"
                      style="font-weight: 500; font-size: 13px"
                    >
                      {{ getValueStatusText(latestValue?.status) }}
                    </a-tag>
                    <div
                      v-if="
                        latestValue?.rejection_reason &&
                        latestValue.status?.startsWith('REJECTED')
                      "
                      style="margin-top: 4px"
                    >
                      <a-tooltip
                        placement="topLeft"
                        :title="latestValue.rejection_reason"
                      >
                        <span
                          style="
                            color: #ff4d4f;
                            font-size: 0.85em;
                            cursor: help;
                          "
                        >
                          <info-circle-outlined style="margin-right: 4px" />
                          {{ $t("rejectionReason") }}
                        </span>
                      </a-tooltip>
                    </div>
                  </div>
                </template>
                <template v-else-if="column.key === 'validityStatus'">
                  <a-tag
                    :color="
                      validityStatusColor[record.validityStatus] || 'default'
                    "
                    style="font-weight: 500"
                  >
                    {{
                      $t("validityStatus." + record.validityStatus) ||
                      record.validityStatus
                    }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'workflow'">
                  <template
                    :set="workflowSummary = getPersonalWorkflowSummary(record)"
                  ></template>
                  <div class="workflow-cell">
                    <a-tag :color="workflowSummary.tagColor">
                      {{ workflowSummary.currentStep }}
                    </a-tag>
                    <div class="workflow-next">
                      {{ workflowSummary.nextAction }}
                    </div>
                  </div>
                </template>
                <template v-else-if="column.key === 'actions'">
                  <div style="text-align: center">
                    <a-space>
                      <template
                        :set="
                          latestValueForActions = findLatestKpiValue(
                            getRelevantAssignment(record),
                          )
                        "
                      ></template>
                      <a-button
                        type="primary"
                        size="small"
                        @click="openSubmitUpdateModal(record)"
                        :disabled="
                          isSubmitDisabled(
                            latestValueForActions,
                            record.status,
                            record.validityStatus,
                          )
                        "
                        :loading="
                          submittingUpdate &&
                          currentSubmittingAssignment?.assignment_id ===
                            getRelevantAssignment(record)?.id
                        "
                        style="min-width: 110px"
                      >
                        <upload-outlined style="margin-right: 4px" />
                        {{ submitButtonText(latestValueForActions) }}
                      </a-button>
                      <a-button
                        v-if="canEditPersonalKpi"
                        type="primary"
                        size="small"
                        :disabled="record.status !== KpiDefinitionStatus.DRAFT"
                        @click="handleEditKpi(record)"
                      >
                        <edit-outlined /> {{ $t("edit") }}
                      </a-button>
                      <a-tooltip :title="$t('viewUpdateApprovalHistory')">
                        <a-button
                          type="default"
                          size="small"
                          @click="openHistoryModal(record)"
                        >
                          <history-outlined />
                        </a-button>
                      </a-tooltip>
                    </a-space>
                  </div>
                </template>
              </template>
            </a-table>
          </a-collapse-panel>
        </a-collapse>
      </div>
      <a-empty v-else :description="$t('noAssignedKpis')" />
    </a-card>
    <a-modal
      :open="isSubmitUpdateModalVisible"
      @update:open="isSubmitUpdateModalVisible = $event"
      :title="
        $t('submitProgressUpdate', {
          kpiName: currentSubmittingAssignment?.kpi_name,
        })
      "
      @cancel="closeSubmitUpdateModal"
      :mask-closable="false"
      destroyOnClose
      width="720px"
      class="submit-update-modal"
    >
      <a-form layout="vertical" :model="submitUpdateForm" ref="submitFormRef">
        <div class="submit-update-month-toggle">
          <div class="submit-update-month-label">
            {{ $t("useMonthLabel") || "Có nhập số tháng (Man-Month)?" }}
          </div>
          <a-radio-group v-model:value="useWithMonth" size="small">
            <a-radio-button :value="false">
              {{ $t("noMonth") || "Không có tháng" }}
            </a-radio-button>
            <a-radio-button :value="true">
              {{ $t("useMonth") || "Có tháng" }}
            </a-radio-button>
          </a-radio-group>
        </div>

        <div class="submit-update-project-entries">
          <div
            class="project-entries-header"
            :class="{ 'with-month': useWithMonth }"
          >
            <span class="col-name">{{ $t("projectName") }}</span>
            <span class="col-value">{{ $t("value") }}</span>
            <span v-if="useWithMonth" class="col-month">
              {{ $t("month") || "Tháng (MM)" }}
            </span>
            <span class="col-action"></span>
          </div>
          <div class="project-entries-body">
            <div
              v-for="(project, index) in submitUpdateForm.projectValues"
              :key="project.id"
              class="project-entry-row"
              :class="{ 'with-month': useWithMonth }"
            >
              <div class="col-name">
                <a-form-item
                  :name="['projectValues', index, 'projectName']"
                  :rules="[
                    { required: true, message: $t('projectNameRequired') },
                  ]"
                  class="project-entry-form-item"
                >
                  <a-input
                    v-model:value="project.projectName"
                    :placeholder="$t('projectName')"
                    size="middle"
                    allow-clear
                  />
                </a-form-item>
              </div>
              <div class="col-value">
                <a-form-item
                  :name="['projectValues', index, 'projectValue']"
                  :rules="[
                    { required: true, message: $t('valueRequired') },
                    {
                      type: 'number',
                      message: $t('mustBeNumber'),
                      transform: (v) => Number(v),
                    },
                  ]"
                  class="project-entry-form-item"
                >
                  <a-input-number
                    v-model:value="project.projectValue"
                    :step="0.1"
                    size="middle"
                    :controls="false"
                    class="project-value-input"
                  />
                </a-form-item>
              </div>
              <div v-if="useWithMonth" class="col-month">
                <a-form-item
                  :name="['projectValues', index, 'month']"
                  class="project-entry-form-item"
                >
                  <a-input-number
                    v-model:value="project.month"
                    :min="0.1"
                    :step="0.5"
                    size="middle"
                    :controls="false"
                    class="project-month-input"
                  />
                </a-form-item>
              </div>
              <div class="col-action">
                <MinusCircleOutlined
                  v-if="submitUpdateForm.projectValues.length > 1"
                  class="project-remove-icon"
                  @click="removeProjectValue(project)"
                />
              </div>
            </div>
          </div>
        </div>
        <a-button
          type="dashed"
          block
          @click="addProjectValue"
          class="add-project-entry-btn"
        >
          <plus-outlined />
          {{ $t("addProjectEntry") }}
        </a-button>
        <a-form-item :label="$t('overallNotesOptional')" name="notes">
          <a-textarea
            v-model:value="submitUpdateForm.notes"
            rows="3"
            :placeholder="$t('addOverallNotes')"
          />
        </a-form-item>
        <a-divider />

        <!-- Progress summary: Total Actual / Target (for user understanding) -->
        <div
          v-if="currentSubmittingAssignment?.target != null"
          class="progress-summary-box"
        >
          <div class="progress-summary-title">
            {{ $t("progressSummary") || "Tổng quan tiến độ" }}
          </div>
          <a-row :gutter="16" class="progress-summary-stats">
            <a-col :xs="24" :sm="8">
              <div class="progress-summary-stat">
                <div class="progress-summary-stat-label">
                  {{ $t("totalActualEntered") || "Tổng Actual" }}
                </div>
                <div class="progress-summary-stat-value">
                  {{ totalActualValue.toLocaleString() }}
                  <span
                    v-if="currentSubmittingAssignment?.unit"
                    class="progress-summary-unit"
                  >
                    {{ currentSubmittingAssignment.unit }}
                  </span>
                </div>
              </div>
            </a-col>
            <a-col :xs="24" :sm="8">
              <div class="progress-summary-stat">
                <div class="progress-summary-stat-label">
                  {{ $t("kpiTarget") || "Target KPI" }}
                </div>
                <div class="progress-summary-stat-value">
                  {{
                    (currentSubmittingAssignment?.target ?? 0).toLocaleString()
                  }}
                  <span
                    v-if="currentSubmittingAssignment?.unit"
                    class="progress-summary-unit"
                  >
                    {{ currentSubmittingAssignment.unit }}
                  </span>
                </div>
              </div>
            </a-col>
            <a-col
              v-if="
                currentSubmittingAssignment?.target != null &&
                Number(currentSubmittingAssignment.target) > 0
              "
              :xs="24"
              :sm="8"
            >
              <div class="progress-summary-stat progress-summary-stat-ratio">
                <div class="progress-summary-stat-label">
                  {{ $t("ratioToTarget") || "Tỷ lệ đạt" }}
                </div>
                <div class="progress-summary-stat-value">
                  {{
                    (
                      (totalActualValue /
                        Number(currentSubmittingAssignment.target)) *
                      100
                    ).toFixed(1)
                  }}%
                </div>
              </div>
            </a-col>
          </a-row>
        </div>

        <!-- Nút Tính điểm gợi ý (chỉ khi KPI có Scoring Rules) -->
        <div
          v-if="
            currentSubmittingAssignment?.kpi?.formula?.scoringRules?.enabled
          "
          style="margin-bottom: 16px"
        >
          <a-button
            type="primary"
            ghost
            :loading="calculatingScore"
            @click="handleCalculateSuggestedScore"
          >
            {{ $t("calculateSuggestedScore") || "Tính điểm gợi ý" }}
          </a-button>
        </div>

        <a-form-item
          name="selfScore"
          :rules="[
            {
              required: true,
              message:
                $t('selfScoreRequired', { maxScore: 5 }) ||
                'Self Score is required',
              type: 'number',
              min: 0.5,
              max: 5,
              trigger: ['change'],
            },
          ]"
        >
          <template #label>
            <span>{{ $t("selfScore") }}</span>
            <a-badge
              v-if="
                currentSubmittingAssignment?.kpi?.formula?.scoringRules?.enabled
              "
              count="Auto"
              :number-style="{ backgroundColor: '#52c41a', marginLeft: '8px' }"
            />
          </template>
          <a-rate
            v-model:value="submitUpdateForm.selfScore"
            :count="5"
            allow-half
            style="font-size: 20px"
          />
          <div style="margin-top: 8px; color: #8c8c8c; font-size: 12px">
            {{ $t("selfScoreHint") }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('selfComment')" name="selfComment">
          <a-textarea
            v-model:value="submitUpdateForm.selfComment"
            rows="3"
            :placeholder="$t('selfCommentPlaceholder')"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="closeSubmitUpdateModal">
            {{ $t("cancel") }}
          </a-button>
          <a-button @click="handleSaveDraft" :loading="submittingUpdate">
            {{ $t("saveDraft") }}
          </a-button>
          <a-button
            type="primary"
            @click="handleSubmitUpdate"
            :loading="submittingUpdate"
          >
            {{ $t("common.submit") }}
          </a-button>
        </a-space>
      </template>
    </a-modal>
    <a-modal
      :open="isHistoryModalVisible"
      :title="$t('updateApprovalHistory')"
      @cancel="closeHistoryModal"
      :width="1000"
      :footer="null"
      destroyOnClose
    >
      <a-spin :spinning="isLoadingHistory" :tip="$t('loadingHistory')">
        <a-alert
          v-if="historyError"
          type="error"
          show-icon
          :message="historyError"
          style="margin-bottom: 10px"
        />
        <a-table
          v-if="!historyError && kpiValueHistory.length > 0"
          :columns="historyColumns"
          :data-source="kpiValueHistory"
          :row-key="'id'"
          size="small"
          bordered
          :pagination="{ pageSize: 5, size: 'small' }"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'timestamp'">
              {{ formatDate(record.changed_at || record.timestamp) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <span>
                {{ getActionText(record.action) }}
              </span>
            </template>
            <template v-else-if="column.key === 'value'">
              {{ formatValue(record.value) }}
            </template>
            <template v-else-if="column.key === 'noteOrReason'">
              <a-tooltip
                placement="topLeft"
                v-if="record.reason"
                :title="record.reason"
              >
                <span style="color: red">
                  {{ $t("reason") }}: {{ truncateText(record.reason, 70) }}
                </span>
              </a-tooltip>
              <a-tooltip v-else-if="record.notes" :title="record.notes">
                <span>
                  {{ truncateText(record.notes, 70) }}
                </span>
              </a-tooltip>
              <span v-else style="color: #888"> - </span>
            </template>
            <template v-else-if="column.key === 'changed_by'">
              <span v-if="record.changedByUser">
                {{ $getFullName(record.changedByUser) }}
              </span>
              <span v-else-if="record.changed_by">
                {{ $t("id") }}: {{ record.changed_by }}
              </span>
              <span v-else> </span>
            </template>
          </template>
        </a-table>
        <a-empty
          v-if="!historyError && kpiValueHistory.length === 0"
          :description="$t('noHistory')"
        />
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, nextTick, h, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import {
  notification,
  Collapse as ACollapse,
  CollapsePanel as ACollapsePanel,
  Form as AForm,
  FormItem as AFormItem,
  Modal as AModal,
  Input as AInput,
  InputNumber as AInputNumber,
  Textarea as ATextarea,
  Space as ASpace,
  Button as AButton,
  Table as ATable,
  Tag as ATag,
  Progress as AProgress,
  Tooltip as ATooltip,
  Alert as AAlert,
  Spin as ASpin,
  Card as ACard,
  Empty as AEmpty,
  Checkbox as ACheckbox,
  Rate as ARate,
  Divider as ADivider,
} from "ant-design-vue";
import {
  PlusOutlined,
  MinusCircleOutlined,
  InfoCircleOutlined,
  HistoryOutlined,
  UploadOutlined,
  EditOutlined,
} from "@ant-design/icons-vue";
import dayjs from "dayjs";
import {
  KpiValueStatus,
  getKpiValueStatusText,
  KpiValueStatusColor,
  KpiDefinitionStatus,
} from "@/core/constants/kpiStatus";
import { useI18n } from "vue-i18n";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import apiClient from "@/core/services/api";
import { getAssignmentWorkflowSummary } from "@/core/utils/workflowTasks";

const { t: $t } = useI18n();

const store = useStore();
const router = useRouter();
const actualUser = computed(() => store.getters["auth/user"]);

const userPermissions = computed(() => actualUser.value?.permissions || []);
function hasPermission(action, resource, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action === action &&
      p.resource === resource &&
      (scope ? p.scope === scope : true),
  );
}
const canCreatePersonalKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI),
);
const canEditPersonalKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.UPDATE, RBAC_RESOURCES.KPI),
);

const loadingMyAssignments = ref(false);
const myAssignmentsError = ref(null);
const myAssignments = ref([]);
const activePanelKeys = ref([]);
const isSubmitUpdateModalVisible = ref(false);
const currentSubmittingAssignment = ref(null);
const submitFormRef = ref(null);
const submitUpdateForm = reactive({
  projectValues: [],
  notes: "",
  selfScore: undefined,
  selfComment: "",
});
const isHistoryModalVisible = ref(false);
const selectedKpiValueForHistory = ref(null);
const kpiValueHistory = ref([]);
const isLoadingHistory = ref(false);
const historyError = ref(null);
const selectedKpiIds = ref(new Set());
const batchSubmitting = ref(false);
const calculationInfo = ref(null);
const calculatingScore = ref(false);
const useWithMonth = ref(false);

const hasKpis = computed(
  () => myAssignments.value && myAssignments.value.length > 0,
);
const submittingUpdate = computed(
  () => store.getters["kpiValues/isSubmittingUpdate"],
);

const validityStatusColor = {
  active: "green",
  expiring_soon: "orange",
  expired: "red",
  not_started: "blue",
};

const groupedPersonalKpis = computed(() => {
  const grouped = {};
  if (!myAssignments.value || myAssignments.value.length === 0) return grouped;
  myAssignments.value.forEach((kpi) => {
    if (kpi && kpi.assignments && kpi.assignments.length > 0) {
      const key = kpi.perspective?.id || "uncategorized";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(kpi);
    } else {
      console.warn("KPI object missing assignments:", kpi);
    }
  });
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    if (a === "uncategorized") return 1;
    if (b === "uncategorized") return -1;
    return String(a).localeCompare(String(b));
  });
  const sortedGrouped = {};
  sortedKeys.forEach((key) => {
    sortedGrouped[key] = grouped[key];
  });
  return sortedGrouped;
});

const myPersonalKpiColumns = computed(() => [
  {
    title: "", // Empty title, we'll use headerCell slot instead
    key: "checkbox",
    width: "50px",
    fixed: "left",
    align: "center",
  },
  {
    title: $t("kpiName"),
    key: "name",
    width: "20%",
    ellipsis: true,
    fixed: "left",
  },
  {
    title: $t("level"),
    dataIndex: "created_by_type",
    key: "level",
    width: "8%",
    align: "center",
  },
  { title: $t("target"), key: "target", align: "right", width: "10%" },
  { title: $t("approvedValue"), key: "value", align: "right", width: "10%" },
  {
    title: $t("progressPercentage"),
    key: "progress",
    align: "center",
    width: "10%",
  },
  {
    title: $t("validityStatus.name"),
    dataIndex: "validityStatus",
    key: "validityStatus",
    width: "11%",
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
    title: $t("workflowStatus"),
    key: "workflow",
    width: "22%",
  },
  {
    title: $t("common.actions"),
    key: "actions",
    align: "center",
    width: "15%",
    fixed: "right",
  },
]);

const historyColumns = computed(() => [
  { title: $t("timestamp"), key: "timestamp", width: 140 },
  {
    title: $t("common.actions"),
    dataIndex: "action",
    key: "action",
    width: 180,
  },
  {
    title: $t("value"),
    dataIndex: "value",
    key: "value",
    align: "right",
    width: 180,
  },
  { title: $t("changedBy"), key: "changed_by", width: 150 },
]);

const getRelevantAssignment = (kpiRecord) =>
  kpiRecord?.assignments?.[0] || null;

const findLatestKpiValue = (assignment) => {
  if (!assignment?.kpiValues || assignment.kpiValues.length === 0) return null;
  return [...assignment.kpiValues].sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at).getTime() -
      new Date(a.updated_at || a.created_at).getTime(),
  )[0];
};

const findLatestApprovedKpiValue = (assignment) => {
  if (!assignment?.kpiValues || assignment.kpiValues.length === 0) return null;
  const APPROVEDValues = assignment.kpiValues.filter(
    (v) => v.status === KpiValueStatus.APPROVED,
  );
  if (APPROVEDValues.length === 0) return null;
  return [...APPROVEDValues].sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at).getTime() -
      new Date(a.updated_at || a.created_at).getTime(),
  )[0];
};

const getApprovedValue = (kpiRecord) => {
  const assignment = getRelevantAssignment(kpiRecord);
  const latestApproved = findLatestApprovedKpiValue(assignment);
  return latestApproved ? Number(latestApproved.value) : null;
};

const getTargetValue = (kpiRecord) => {
  const assignment = getRelevantAssignment(kpiRecord);
  const target = assignment?.targetValue ?? kpiRecord?.target;
  return target !== null && target !== undefined ? Number(target) : null;
};

const getWeightValue = (kpiRecord) => {
  const assignment = getRelevantAssignment(kpiRecord);
  const w = assignment?.weight ?? kpiRecord?.weight;
  return w !== null && w !== undefined ? Number(w) : null;
};

const calculateProgress = (current, target) => {
  const currentValue = parseFloat(current);
  const targetValue = parseFloat(target);
  if (
    isNaN(currentValue) ||
    isNaN(targetValue) ||
    targetValue === 0 ||
    currentValue === null ||
    targetValue === null
  )
    return 0;
  const percent = (currentValue / targetValue) * 100;
  return parseFloat(Math.min(percent, 100).toFixed(2));
};

const isSubmitDisabled = (latestValue, kpiDefinitionStatus, validityStatus) => {
  if (kpiDefinitionStatus !== KpiDefinitionStatus.APPROVED) {
    return true;
  }

  // Check validity status - disable submit for expired or not started KPIs
  if (validityStatus === "expired" || validityStatus === "not_started") {
    return true;
  }

  const valueStatus = latestValue?.status;
  const allowedStatuses = [
    null,
    undefined,
    KpiValueStatus.DRAFT,
    KpiValueStatus.REJECTED_BY_SECTION,
    KpiValueStatus.REJECTED_BY_DEPT,
    KpiValueStatus.REJECTED_BY_MANAGER,
  ];

  const isDisabled = !allowedStatuses.includes(valueStatus);
  return isDisabled;
};

const submitButtonText = (latestValue) => {
  const status = latestValue?.status;
  switch (status) {
    case KpiValueStatus.DRAFT:
      return $t("editDraft");
    case KpiValueStatus.REJECTED_BY_SECTION:
    case KpiValueStatus.REJECTED_BY_DEPT:
    case KpiValueStatus.REJECTED_BY_MANAGER:
      return $t("resubmitUpdate");
    case KpiValueStatus.SUBMITTED:
    case KpiValueStatus.PENDING_SECTION_APPROVAL:
    case KpiValueStatus.PENDING_DEPT_APPROVAL:
    case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      return $t("awaitingApproval");
    case KpiValueStatus.APPROVED:
      return $t("approved");
    default:
      return $t("submitUpdate");
  }
};

const getValueStatusColor = (status) =>
  KpiValueStatusColor[status] || "default";
const getValueStatusText = (status) =>
  getKpiValueStatusText($t)[status] || status || $t("draft");

const getPersonalWorkflowSummary = (kpiRecord) => {
  const latestValue = findLatestKpiValue(getRelevantAssignment(kpiRecord));
  return getAssignmentWorkflowSummary(latestValue?.status || "NOT_SUBMIT", $t);
};

const isCheckboxDisabled = (kpiRecord) => {
  const assignment = getRelevantAssignment(kpiRecord);
  const latestValue = findLatestKpiValue(assignment);

  // Disable if KPI is not approved
  if (kpiRecord.status !== KpiDefinitionStatus.APPROVED) {
    return true;
  }

  // Disable if KPI is expired or not started
  if (
    kpiRecord.validityStatus === "expired" ||
    kpiRecord.validityStatus === "not_started"
  ) {
    return true;
  }

  // Only enable for DRAFT status
  return !latestValue || latestValue.status !== KpiValueStatus.DRAFT;
};

const toggleKpiSelection = (kpiId, checked) => {
  if (checked) {
    selectedKpiIds.value.add(kpiId);
  } else {
    selectedKpiIds.value.delete(kpiId);
  }
};

const isAllSelectedForPerspective = (kpiList) => {
  if (!kpiList || kpiList.length === 0) return false;

  const enabledKpis = kpiList.filter((kpi) => !isCheckboxDisabled(kpi));
  if (enabledKpis.length === 0) return false;

  return enabledKpis.every((kpi) => selectedKpiIds.value.has(kpi.id));
};

const isIndeterminateForPerspective = (kpiList) => {
  if (!kpiList || kpiList.length === 0) return false;

  const enabledKpis = kpiList.filter((kpi) => !isCheckboxDisabled(kpi));
  if (enabledKpis.length === 0) return false;

  const selectedCount = enabledKpis.filter((kpi) =>
    selectedKpiIds.value.has(kpi.id),
  ).length;

  return selectedCount > 0 && selectedCount < enabledKpis.length;
};

const toggleSelectAllForPerspective = (kpiList, checked) => {
  if (checked) {
    kpiList.forEach((kpi) => {
      if (!isCheckboxDisabled(kpi)) {
        selectedKpiIds.value.add(kpi.id);
      }
    });
  } else {
    kpiList.forEach((kpi) => {
      selectedKpiIds.value.delete(kpi.id);
    });
  }
};

const handleBatchSubmit = async () => {
  if (selectedKpiIds.value.size === 0) {
    notification.warning({
      message: $t("noKpiSelected"),
      description: $t("pleaseSelectAtLeastOneKpi"),
    });
    return;
  }

  const allKpis = [];
  Object.values(groupedPersonalKpis.value).forEach((kpiList) => {
    allKpis.push(...kpiList);
  });

  const assignmentIds = [];
  const missingDrafts = [];

  for (const kpiId of selectedKpiIds.value) {
    const kpi = allKpis.find((k) => k.id === kpiId);
    if (!kpi) continue;

    const assignment = getRelevantAssignment(kpi);
    const latestValue = findLatestKpiValue(assignment);

    if (!latestValue || latestValue.status !== KpiValueStatus.DRAFT) {
      missingDrafts.push(kpi.name);
    } else {
      assignmentIds.push(assignment.id);
    }
  }

  if (missingDrafts.length > 0) {
    notification.error({
      message: $t("validationFailed"),
      description: $t("kpisMissingDraft", { kpis: missingDrafts.join(", ") }),
    });
    return;
  }

  batchSubmitting.value = true;
  try {
    const result = await store.dispatch("kpiValues/batchSubmitDrafts", {
      assignmentIds,
    });

    if (result.failed && result.failed.length > 0) {
      notification.warning({
        message: $t("partialSuccess"),
        description: $t("submittedCountOfTotal", {
          success: result.success.length,
          total: assignmentIds.length,
        }),
      });
    } else {
      notification.success({
        message: $t("batchSubmitSuccess"),
        description: $t("successfullySubmittedKpis", {
          count: result.success.length,
        }),
      });
    }

    selectedKpiIds.value.clear();
    await fetchMyAssignedKpis();
  } catch (error) {
    console.error("Batch submit failed:", error);
    notification.error({
      message: $t("batchSubmitFailed"),
      description: error.message || $t("unknownError"),
    });
  } finally {
    batchSubmitting.value = false;
  }
};

const getKpiLevelColor = (level) => {
  switch (level?.toLowerCase()) {
    case "company":
      return "blue";
    case "department":
      return "green";
    case "section":
      return "orange";
    case "personal":
    case "user":
      return "purple";
    default:
      return "default";
  }
};
const formatDate = (dateString) =>
  dateString ? dayjs(dateString).format("YYYY-MM-DD HH:mm") : "";
const truncateText = (text, length) =>
  text?.length > length ? `${text.substring(0, length)}...` : text || "";
const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "";

  // Convert to number if it's a string
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(numValue)) return value; // Return original if not a number

  // Format with commas for thousands separator
  return numValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
};
const getActionText = (actionKey) => {
  const actionMap = {
    SUBMIT_CREATE: $t("createAndSubmit"),
    SUBMIT_UPDATE: $t("updateAndSubmit"),
    APPROVE_SECTION: $t("sectionApprove"),
    REJECT_SECTION: $t("sectionReject"),
    APPROVE_DEPT: $t("deptApprove"),
    REJECT_DEPT: $t("deptReject"),
    APPROVE_MANAGER: $t("managerApprove"),
    REJECT_MANAGER: $t("managerReject"),
    CREATE: $t("create"),
    UPDATE: $t("update"),
    DELETE: $t("delete"),
  };
  return actionMap[actionKey?.toUpperCase()] || actionKey || $t("unknown");
};

const fetchMyAssignedKpis = async () => {
  const userId = actualUser.value?.id;
  if (!userId) {
    myAssignmentsError.value = $t("couldNotDetermineUserId");
    loadingMyAssignments.value = false;
    return;
  }
  loadingMyAssignments.value = true;
  myAssignmentsError.value = null;
  try {
    const assignmentsData = await store.dispatch(
      "kpis/fetchMyAssignments",
      userId,
    );
    myAssignments.value = assignmentsData || [];
    await nextTick(); // Đợi DOM cập nhật (hoặc computed property tính toán xong)
    const groups = groupedPersonalKpis.value;
    if (groups && typeof groups === "object") {
      activePanelKeys.value = Object.keys(groups); // Lấy tất cả các key (perspectiveId)
    } else {
      activePanelKeys.value = [];
    }
  } catch (error) {
    myAssignmentsError.value =
      store.getters["kpis/error"] ||
      error.message ||
      $t("failedToLoadAssignedKpis");
    myAssignments.value = [];
    console.error("Fetch my assignments error:", error);
  } finally {
    loadingMyAssignments.value = false;
  }
};
const clearError = () => {
  myAssignmentsError.value = null;
};

const openSubmitUpdateModal = async (kpiRecord) => {
  const relevantAssignment = getRelevantAssignment(kpiRecord);
  if (!relevantAssignment || !relevantAssignment.id) {
    notification.error({
      message: $t("error"),
      description: $t("cannotIdentifyAssignment"),
    });
    return;
  }
  if (kpiRecord.status !== KpiDefinitionStatus.APPROVED) {
    notification.warn({
      message: $t("notifications"),
      description: $t("kpiNotApproved", { kpiName: kpiRecord.name }),
    });
    return;
  }
  // Check validity status before allowing submit
  if (kpiRecord.validityStatus === "expired") {
    notification.warn({
      message: $t("notifications"),
      description: $t("cannotSubmitExpiredKpi", { kpiName: kpiRecord.name }),
    });
    return;
  }

  if (kpiRecord.validityStatus === "not_started") {
    notification.warn({
      message: $t("notifications"),
      description: $t("cannotSubmitNotStartedKpi", { kpiName: kpiRecord.name }),
    });
    return;
  }

  const latestValue = findLatestKpiValue(relevantAssignment);
  if (
    !isSubmitDisabled(latestValue, kpiRecord.status, kpiRecord.validityStatus)
  ) {
    let formula = kpiRecord.formula;
    if (!formula && (kpiRecord.formula_id ?? kpiRecord.formulaId)) {
      try {
        const formulaId = kpiRecord.formula_id ?? kpiRecord.formulaId;
        const res = await apiClient.get(`/kpi-formulas/${formulaId}`);
        formula = res.data;
      } catch (e) {
        console.warn("Could not load formula for KPI:", kpiRecord.id, e);
      }
    }
    currentSubmittingAssignment.value = {
      kpi_id: kpiRecord.id,
      kpi_name: kpiRecord.name,
      unit: kpiRecord.unit,
      target: getTargetValue(kpiRecord),
      weight: getWeightValue(kpiRecord),
      assignment_id: relevantAssignment.id,
      kpi: formula ? { formula } : {},
    };

    // Load existing draft data if available
    if (latestValue && latestValue.status === KpiValueStatus.DRAFT) {
      const projectDetails = latestValue.project_details;
      if (
        projectDetails &&
        Array.isArray(projectDetails) &&
        projectDetails.length > 0
      ) {
        submitUpdateForm.projectValues = projectDetails.map((p, idx) => ({
          id: Date.now() + idx,
          projectName: p.name || "",
          projectValue: p.value || null,
          targetValue: p.targetValue ?? null,
          weight: p.weight ?? null,
          month: p.month ?? p.weight ?? null,
        }));
      } else {
        submitUpdateForm.projectValues = [
          {
            id: Date.now(),
            projectName: "",
            projectValue: null,
            targetValue: null,
            weight: null,
            month: null,
          },
        ];
      }
      submitUpdateForm.notes = latestValue.notes || "";

      // Fetch KpiReview to load selfScore and selfComment
      try {
        const reviewResponse = await apiClient.get(
          `/kpi-review/assignment/${relevantAssignment.id}`,
        );
        const reviewPayload = reviewResponse.data;
        const activeReview =
          reviewPayload?.activeReview ?? reviewPayload ?? null;
        if (activeReview) {
          submitUpdateForm.selfScore =
            activeReview.selfScore ?? undefined;
          submitUpdateForm.selfComment = activeReview.selfComment || "";
        } else {
          submitUpdateForm.selfScore = undefined;
          submitUpdateForm.selfComment = "";
        }
      } catch (error) {
        // If no review found, that's okay - just reset values
        console.log("No KpiReview found for this assignment:", error);
        submitUpdateForm.selfScore = undefined;
        submitUpdateForm.selfComment = "";
      }
    } else {
      submitUpdateForm.projectValues = [
        {
          id: Date.now(),
          projectName: "",
          projectValue: null,
          targetValue: null,
          weight: null,
          month: null,
        },
      ];
      submitUpdateForm.notes = "";

      // Try to fetch existing KpiReview even if no draft value
      try {
        const reviewResponse = await apiClient.get(
          `/kpi-review/assignment/${relevantAssignment.id}`,
        );
        const reviewPayload = reviewResponse.data;
        const activeReview =
          reviewPayload?.activeReview ?? reviewPayload ?? null;
        if (activeReview) {
          submitUpdateForm.selfScore =
            activeReview.selfScore ?? undefined;
          submitUpdateForm.selfComment = activeReview.selfComment || "";
        } else {
          submitUpdateForm.selfScore = undefined;
          submitUpdateForm.selfComment = "";
        }
      } catch (error) {
        submitUpdateForm.selfScore = undefined;
        submitUpdateForm.selfComment = "";
      }
    }

    isSubmitUpdateModalVisible.value = true;
    nextTick(() => {
      submitFormRef.value?.resetFields();
    });
  } else {
    notification.info({
      message: $t("notifications"),
      description: $t("currentStatusDoesNotAllowUpdate"),
    });
  }
};

const closeSubmitUpdateModal = () => {
  isSubmitUpdateModalVisible.value = false;
  currentSubmittingAssignment.value = null;
  calculationInfo.value = null;
  // Reset form
  submitUpdateForm.projectValues = [
    {
      id: Date.now(),
      projectName: "",
      projectValue: null,
      targetValue: null,
      weight: null,
      month: null,
    },
  ];
  submitUpdateForm.notes = "";
  submitUpdateForm.selfScore = undefined;
  submitUpdateForm.selfComment = "";
};
const addProjectValue = () => {
  submitUpdateForm.projectValues.push({
    id: Date.now(),
    projectName: "",
    projectValue: null,
    targetValue: null,
    weight: null,
    month: null,
  });
};
const removeProjectValue = (itemToRemove) => {
  const index = submitUpdateForm.projectValues.findIndex(
    (item) => item.id === itemToRemove.id,
  );
  if (index !== -1 && submitUpdateForm.projectValues.length > 1) {
    submitUpdateForm.projectValues.splice(index, 1);
  } else if (submitUpdateForm.projectValues.length === 1) {
    notification.warn({ message: $t("cannotRemoveLastEntry") });
  }
};

const handleCalculateSuggestedScore = async () => {
  const assignment = currentSubmittingAssignment.value;
  const formula = assignment?.kpi?.formula;
  if (!formula?.scoringRules?.enabled || !formula?.id) return;

  const rows = submitUpdateForm.projectValues;
  const values = rows.map((p) => Number(p.projectValue) ?? 0);
  const withMonth = useWithMonth.value;
  const months = withMonth
    ? rows.map((p) => Number(p.month) || 1)
    : rows.map(() => 1);

  const valuesValid =
    values.length > 0 && values.every((v) => Number.isFinite(v));
  if (!valuesValid) {
    notification.warn({
      message: $t("validationFailed"),
      description:
        $t("enterProjectValuesToCalculate") ||
        $t("enterProjectScoresToCalculate"),
    });
    return;
  }
  if (withMonth && months.some((m) => !m || m <= 0)) {
    notification.warn({
      message: $t("validationFailed"),
      description: $t("enterMonthPerProject"),
    });
    return;
  }
  const targetVal =
    assignment?.target != null && Number(assignment.target)
      ? Number(assignment.target)
      : undefined;
  const weightVal =
    assignment?.weight != null && Number(assignment.weight)
      ? Number(assignment.weight)
      : undefined;
  const body = {
    values,
    ...(withMonth && { months }),
    ...(targetVal != null && { target: targetVal }),
    ...(weightVal != null && { weight: weightVal }),
  };
  calculatingScore.value = true;
  try {
    const response = await apiClient.post(
      `/kpi-formulas/${formula.id}/calculate-score`,
      body,
    );
    if (response?.data?.applied) {
      submitUpdateForm.selfScore = response.data.score;
      calculationInfo.value = {
        formula: response.data.formula,
        calculatedValue: response.data.calculatedValue,
        score: response.data.score,
        applied: true,
      };
      notification.success({
        message: $t("common.success"),
        description: `${$t("suggestedScore")}: ${response.data.score}/5`,
      });
    } else if (
      response?.data?.calculatedValue != null &&
      response?.data?.formula
    ) {
      calculationInfo.value = {
        formula: response.data.formula,
        calculatedValue: response.data.calculatedValue,
        score: undefined,
        applied: false,
      };
      const val = Number(response.data.calculatedValue).toFixed(2);
      notification.warn({
        message: $t("noScoringRangeMatched"),
        description: $t("noScoringRangeMatchedDesc", { value: val }),
      });
    } else {
      calculationInfo.value = null;
    }
  } catch (error) {
    console.error("Failed to calculate score:", error);
    notification.error({
      message: $t("error") || "Lỗi",
      description: error.response?.data?.message || error.message,
    });
  } finally {
    calculatingScore.value = false;
  }
};

const handleSaveDraft = async () => {
  try {
    await submitFormRef.value?.validate();
  } catch (errorInfo) {
    return;
  }
  if (submitUpdateForm.projectValues.length === 0) {
    notification.error({
      message: $t("validationFailed"),
      description: $t("addAtLeastOneProjectEntry"),
    });
    return;
  }
  if (
    submitUpdateForm.projectValues.some(
      (p) => !p.projectName || p.projectValue == null,
    )
  ) {
    notification.error({
      message: $t("validationFailed"),
      description: $t("enterValidProjectDetails"),
    });
    return;
  }
  if (!currentSubmittingAssignment.value?.assignment_id) return;

  const useMulti = useMultiProjectFormula.value;
  const payload = {
    notes: submitUpdateForm.notes,
    project_details: submitUpdateForm.projectValues.map((p) => ({
      name: p.projectName,
      value: Number(p.projectValue),
      ...(useWithMonth.value && { month: Number(p.month) || 1 }),
      ...(!useMulti && {
        ...(p.targetValue != null && { targetValue: Number(p.targetValue) }),
        ...(p.weight != null && { weight: Number(p.weight) }),
      }),
    })),
    selfScore: submitUpdateForm.selfScore,
    selfComment: submitUpdateForm.selfComment,
  };

  try {
    await store.dispatch("kpiValues/saveDraftKpiUpdate", {
      assignmentId: currentSubmittingAssignment.value.assignment_id,
      updateData: payload,
    });
    notification.success({
      message: $t("draftSaved"),
      description: $t("valueSavedSuccessfully"),
    });
    closeSubmitUpdateModal();
    await fetchMyAssignedKpis();
  } catch (error) {
    console.error("handleSaveDraft failed:", error);
  }
};

const handleSubmitUpdate = async () => {
  try {
    await submitFormRef.value?.validate();
  } catch (errorInfo) {
    return;
  }
  if (submitUpdateForm.projectValues.length === 0) {
    notification.error({
      message: $t("validationFailed"),
      description: $t("addAtLeastOneProjectEntry"),
    });
    return;
  }
  if (
    submitUpdateForm.projectValues.some(
      (p) => !p.projectName || p.projectValue == null,
    )
  ) {
    notification.error({
      message: $t("validationFailed"),
      description: $t("enterValidProjectDetails"),
    });
    return;
  }
  // Validate selfScore is required
  if (
    submitUpdateForm.selfScore === undefined ||
    submitUpdateForm.selfScore === null ||
    (typeof submitUpdateForm.selfScore === "number" &&
      submitUpdateForm.selfScore <= 0)
  ) {
    notification.error({
      message: $t("validationFailed"),
      description: $t("selfScoreRequired"),
    });
    return;
  }
  if (!currentSubmittingAssignment.value?.assignment_id) return;

  const useMulti = useMultiProjectFormula.value;
  const payload = {
    notes: submitUpdateForm.notes,
    project_details: submitUpdateForm.projectValues.map((p) => ({
      name: p.projectName,
      value: Number(p.projectValue),
      ...(useWithMonth.value && { month: Number(p.month) || 1 }),
      ...(!useMulti && {
        ...(p.targetValue != null && { targetValue: Number(p.targetValue) }),
        ...(p.weight != null && { weight: Number(p.weight) }),
      }),
    })),
    selfScore: submitUpdateForm.selfScore,
    selfComment: submitUpdateForm.selfComment,
  };

  try {
    await store.dispatch("kpiValues/submitKpiUpdate", {
      assignmentId: currentSubmittingAssignment.value.assignment_id,
      updateData: payload,
    });
    notification.success({
      message: $t("updateSubmitted"),
      description: $t("valueSubmittedSuccessfully"),
    });
    closeSubmitUpdateModal();
    await fetchMyAssignedKpis();
  } catch (error) {
    console.error("handleSubmitUpdate failed:", error);
  }
};

const goToCreatePersonalKpi = () => {
  router.push({ name: "KpiPersonalCreate", query: { scope: "personal" } });
};

const goToCreatePersonalTemplatesKpi = () => {
  router.push({ name: "KpiPersonalTemplatesCreate" });
};

const handleEditKpi = (record) => {
  if (record && record.id) {
    router.push({
      name: "KpiPersonalCreate",
      query: {
        templateKpiId: String(record.id),
      },
    });
  } else {
    notification.warning({
      message: "Cannot edit due to missing KPI information.",
    });
  }
};

const openHistoryModal = async (kpiRecord) => {
  const assignment = getRelevantAssignment(kpiRecord);
  if (!assignment || !assignment.id) {
    notification.error({ message: $t("cannotViewHistoryWithoutAssignmentId") });
    return;
  }
  const latestValue = findLatestKpiValue(assignment);
  if (!latestValue || !latestValue.id) {
    notification.info({ message: $t("noSubmissionHistoryFound") });
    return;
  }
  selectedKpiValueForHistory.value = latestValue;
  kpiValueHistory.value = [];
  historyError.value = null;
  isHistoryModalVisible.value = true;
  await loadHistory(latestValue.id);
};

const loadHistory = async (valueId) => {
  if (!valueId) return;
  isLoadingHistory.value = true;
  historyError.value = null;
  try {
    const historyData = await store.dispatch("kpiValues/fetchValueHistory", {
      valueId,
    });
    kpiValueHistory.value = historyData || [];
  } catch (error) {
    historyError.value = error.message || $t("errorLoadingHistory");
  } finally {
    isLoadingHistory.value = false;
  }
};

const closeHistoryModal = () => {
  isHistoryModalVisible.value = false;
  setTimeout(() => {
    selectedKpiValueForHistory.value = null;
    kpiValueHistory.value = [];
    isLoadingHistory.value = false;
    historyError.value = null;
  }, 300);
};

// Computed: Total actual value from project values
const totalActualValue = computed(() => {
  return submitUpdateForm.projectValues.reduce(
    (sum, p) => sum + (p.projectValue || 0),
    0,
  );
});

// Formula uses multi-project (IE: months = Man-Month). Show Est. Effort & Wi columns.
const useMultiProjectFormula = computed(() => {
  const expr =
    currentSubmittingAssignment.value?.kpi?.formula?.expression || "";
  return (
    typeof expr === "string" &&
    (expr.includes("months") || expr.includes("weights"))
  );
});

// Watch selfScore to clear validation errors when value changes
watch(
  () => submitUpdateForm.selfScore,
  (newValue) => {
    if (newValue !== undefined && newValue !== null && newValue > 0) {
      nextTick(() => {
        submitFormRef.value?.clearValidate(["selfScore"]);
      });
    }
  },
);

onMounted(() => {
  fetchMyAssignedKpis();
});
</script>

<style scoped>
/* Style chung */
:deep(.ant-collapse-header) {
  background-color: #f0f2f5;
  font-weight: bold;
}

:deep(.ant-collapse-content > .ant-collapse-content-box) {
  padding: 0;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.kpi-actions-button {
  font-size: 0.8em;
  padding: 3px 6px;
  margin: 0 3px;
}

.mb-6 {
  margin-bottom: 1.5rem;
}

.text-lg {
  font-size: 1.125rem;
}

.font-bold {
  font-weight: 600;
}

.mb-2 {
  margin-bottom: 0.75rem;
}

.kpi-table-modern .ant-table {
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.kpi-table-modern .ant-table-thead > tr > th {
  background: #e6f7ff;
  font-weight: 600;
  font-size: 15px;
  text-align: center;
  border-bottom: 1px solid #91d5ff;
}
.kpi-table-modern .ant-table-tbody > tr > td {
  padding: 10px 8px;
  font-size: 14px;
  vertical-align: middle;
}
.kpi-table-modern .ant-table-tbody > tr:hover > td {
  background: #fafafa;
}
.kpi-collapse-modern .ant-collapse-item {
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
  border: 1px solid #e6f7ff;
}
.kpi-collapse-modern .ant-collapse-header {
  background: #f0f5ff;
  font-weight: bold;
  font-size: 16px;
}
.goal-status-tag {
  border-radius: 6px;
  padding: 2px 12px;
}

/* Submit Progress Update modal – project entries */
.submit-update-modal :deep(.ant-modal-body) {
  padding-top: 16px;
}

.submit-update-month-toggle {
  margin-bottom: 16px;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.submit-update-month-label {
  font-size: 13px;
  color: #475569;
  margin-bottom: 8px;
  font-weight: 500;
}

.submit-update-project-entries {
  margin-bottom: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.project-entries-header {
  display: grid;
  grid-template-columns: 1fr 90px 44px;
  gap: 12px;
  padding: 10px 14px;
  background: linear-gradient(180deg, #f0f5ff 0%, #e6f0ff 100%);
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border-bottom: 1px solid #bfdbfe;
}

.project-entries-header.with-month {
  grid-template-columns: 1fr 90px 80px 44px;
}

.project-entries-body {
  max-height: 280px;
  overflow-y: auto;
}

.project-entry-row {
  display: grid;
  grid-template-columns: 1fr 90px 44px;
  gap: 12px;
  align-items: start;
  padding: 10px 14px;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s ease;
}

.project-entry-row:last-child {
  border-bottom: none;
}

.project-entry-row:hover {
  background: #fafbff;
}

.project-entry-row.with-month {
  grid-template-columns: 1fr 90px 80px 44px;
}

.project-entry-row .project-entry-form-item {
  margin-bottom: 0;
}

.project-entry-row .project-entry-form-item :deep(.ant-form-item-label) {
  display: none;
}

.project-entry-row
  .project-entry-form-item
  :deep(.ant-form-item-control-input) {
  min-height: 32px;
}

.project-entry-row .project-entry-form-item :deep(.ant-input),
.project-entry-row .project-entry-form-item :deep(.ant-input-number) {
  width: 100%;
}

.project-value-input :deep(.ant-input-number-input),
.project-month-input :deep(.ant-input-number-input) {
  text-align: center;
}

.project-remove-icon {
  cursor: pointer;
  color: #ff4d4f;
  font-size: 18px;
  margin-top: 6px;
  padding: 4px;
  border-radius: 4px;
  transition:
    background 0.15s,
    color 0.15s;
}

.project-remove-icon:hover {
  background: #fff1f0;
  color: #cf1322;
}

.add-project-entry-btn {
  margin-bottom: 16px;
}

/* Progress summary box (Submit Progress Update modal) */
.progress-summary-box {
  margin-bottom: 20px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.progress-summary-title {
  font-weight: 600;
  font-size: 14px;
  color: #334155;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.progress-summary-stats {
  margin-bottom: 0;
}

.progress-summary-stat {
  padding: 12px 14px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  text-align: center;
}

.progress-summary-stat-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.progress-summary-stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.progress-summary-unit {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-left: 4px;
}

.progress-summary-stat-ratio .progress-summary-stat-value {
  color: #0369a1;
}

.progress-summary-stat-hint {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}

.workflow-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workflow-next {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

@media (max-width: 576px) {
  .progress-summary-stat {
    margin-bottom: 8px;
  }
  .progress-summary-stat:last-child {
    margin-bottom: 0;
  }
}
</style>
