<template>
  <div class="kpi-section-list-page">
    <div class="list-header-modern">
      <schedule-outlined class="header-icon" />
      <div class="header-title-group">
        <h2>{{ $t("sectionKpiList") }}</h2>
        <div class="header-desc">
          {{ $t("sectionKpiListDesc") || $t("sectionKpiList") }}
        </div>
      </div>
      <div class="action-buttons right-align">
        <a-button
          v-if="canCreateSectionKpiSection"
          type="primary"
          @click="goToCreateKpi"
        >
          <plus-outlined /> {{ $t("createNewKpi") }}
        </a-button>
      </div>
    </div>
    <a-card class="filter-card-modern">
      <a-form layout="vertical" class="filter-form-modern">
        <a-row :gutter="[16, 0]" align="middle" style="flex-wrap: wrap">
          <a-col :span="5">
            <a-form-item :label="$t('search')" class="filter-label-top">
              <a-input
                v-model:value="localFilters.name"
                :placeholder="$t('kpiNamePlaceholder')"
                @pressEnter="applyFilters"
                allow-clear
                size="middle"
              >
                <template #prefix><schedule-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="5" v-if="!isSectionUser">
            <a-form-item :label="$t('department')" class="filter-label-top">
              <a-select
                v-model:value="localFilters.departmentId"
                style="width: 100%"
                @change="handleDepartmentChange"
                :disabled="
                  (isSectionUser && !!currentUser?.departmentId) ||
                  isDepartmentUser
                "
                allow-clear
                size="middle"
              >
                <template #suffixIcon><team-outlined /></template>
                <a-select-option
                  v-if="
                    !(
                      (isSectionUser && !!currentUser?.departmentId) ||
                      isDepartmentUser
                    )
                  "
                  :value="null"
                  >{{ $t("allDepartments") }}</a-select-option
                >
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
          <a-col :span="4">
            <a-form-item :label="$t('section')" class="filter-label-top">
              <a-select
                v-model:value="localFilters.sectionId"
                style="width: 100%"
                :disabled="isSectionUser"
                allow-clear
                size="middle"
              >
                <a-select-option v-if="!isSectionUser" :value="0">{{
                  $t("allSections")
                }}</a-select-option>
                <a-select-option
                  v-for="section in selectSectionList"
                  :key="section.id"
                  :value="section.id"
                >
                  {{ section.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="3">
            <a-form-item :label="$t('startDate')" class="filter-label-top">
              <a-date-picker
                v-model:value="localFilters.startDate"
                style="width: 100%"
                @change="applyFilters"
                allow-clear
                size="middle"
              />
            </a-form-item>
          </a-col>
          <a-col :span="3">
            <a-form-item :label="$t('endDate')" class="filter-label-top">
              <a-date-picker
                v-model:value="localFilters.endDate"
                style="width: 100%"
                @change="applyFilters"
                allow-clear
                size="middle"
              />
            </a-form-item>
          </a-col>
          <a-col
            :span="4"
            style="display: flex; align-items: flex-end; height: 100%"
          >
            <div class="filter-btn-group">
              <a-button type="primary" @click="applyFilters" size="middle">{{
                $t("apply")
              }}</a-button>
              <a-button
                @click="
                  () => {
                    localFilters.name = '';
                    localFilters.departmentId = null;
                    localFilters.sectionId = 0;
                    localFilters.startDate = '';
                    localFilters.endDate = '';
                    applyFilters();
                  }
                "
                size="middle"
                >{{ $t("reset") }}</a-button
              >
            </div>
          </a-col>
        </a-row>
      </a-form>
    </a-card>
    <div style="margin-top: 20px; margin-bottom: 20px">
      <a-alert
        v-if="loading"
        :message="$t('loadingKpis')"
        type="info"
        show-icon
      >
        <template #icon> <a-spin /> </template>
      </a-alert>
      <a-alert
        v-else-if="error"
        :message="error"
        type="error"
        show-icon
        closable
      />
      <a-alert
        v-else-if="isDisplayResult && sectionGroups.length === 0"
        :message="$t('noKpisFound')"
        type="warning"
        show-icon
        closable
      />
      <a-alert
        v-if="deletedKpiName"
        :message="$t('kpiDeleted', { name: deletedKpiName })"
        type="success"
        closable
        @close="deletedKpiName = null"
        show-icon
      />
    </div>
    <div v-if="isDisplayResult" class="data-container">
      <div
        v-for="(sectionGroup, sectionIndex) in sectionGroups"
        :key="'sec-' + sectionIndex"
        class="mb-8"
      >
        <h4 class="text-lg font-bold mb-2 section-header-modern">
          {{ $t("sectionHeader", { name: sectionGroup.section }) }}
        </h4>
        <a-collapse
          v-model:activeKey="activePanelKeys"
          expandIconPosition="end"
          class="kpi-collapse-modern"
        >
          <a-collapse-panel
            v-for="(perspectiveGroupRows, perspectiveKey) in sectionGroup.data"
            :key="'pers-' + sectionIndex + '-' + perspectiveKey"
            :header="perspectiveKey.split('. ')[1] || perspectiveKey"
          >
            <a-table
              :columns="columns"
              :dataSource="tableData(perspectiveGroupRows)"
              :pagination="false"
              rowKey="key"
              :rowClassName="rowClassName"
              size="small"
              bordered
              class="kpi-table-modern section-table-modern"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'kpiName'">
                  <span class="kpi-name">{{ record.kpiName }}</span>
                </template>
                <template v-else-if="column.dataIndex === 'chart'">
                  <ApexChart
                    type="donut"
                    width="120px"
                    height="100"
                    :options="{
                      chart: { height: 100, type: 'donut' },
                      labels: [$t('actual'), $t('remaining')],
                      colors: ['#008FFB', '#B9E5FF'],
                      dataLabels: {
                        enabled: true,
                        formatter: function (val, opts) {
                          const actual = parseFloat(opts.w.config.series[0]);
                          const target =
                            actual + parseFloat(opts.w.config.series[1]);
                          if (!target || isNaN(target)) return '--';
                          if (!actual || isNaN(actual)) return '0%';
                          let percent = Math.round((actual / target) * 100);
                          if (percent > 100) percent = 100;
                          if (percent < 0) percent = 0;
                          return percent + '%';
                        },
                        style: {
                          fontSize: '12px',
                          colors: ['black'],
                        },
                      },
                      legend: { show: false },
                    }"
                    :series="[
                      parseFloat(record.actual) && parseFloat(record.actual) > 0
                        ? parseFloat(record.actual)
                        : 0,
                      parseFloat(record.target) && parseFloat(record.target) > 0
                        ? Math.max(
                            parseFloat(record.target) -
                              parseFloat(record.actual),
                            0
                          )
                        : 0,
                    ]"
                  />
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
                  <a-tag
                    :bordered="false"
                    :color="getStatusColor(record.status)"
                    class="goal-status-tag"
                  >
                    {{ record.status }}
                  </a-tag>
                </template>
                <template v-else-if="column.dataIndex === 'validityStatus'">
                  <a-tag
                    :color="
                      validityStatusColor[record.validityStatus] || 'default'
                    "
                  >
                    {{
                      $t("validityStatus." + record.validityStatus) ||
                      record.validityStatus
                    }}
                  </a-tag>
                </template>
                <template v-else-if="column.dataIndex === 'action'">
                  <div style="text-align: center">
                    <a-tooltip :title="$t('viewDetails')">
                      <a-button
                        type="default"
                        class="kpi-actions-button"
                        @click="
                          $router.push({
                            name: 'KpiDetail',
                            params: { id: record.kpiId },
                            query: { contextSectionId: sectionGroup.sectionId },
                          })
                        "
                      >
                        <schedule-outlined /> {{ $t("details") }}
                      </a-button>
                    </a-tooltip>
                    <a-tooltip v-if="canCopySectionKpi" :title="$t('copyKpi')">
                      <a-button
                        type="dashed"
                        class="kpi-actions-button"
                        size="small"
                        @click="handleCopyKpi(record)"
                      >
                        <copy-outlined /> {{ $t("copy") }}
                      </a-button>
                    </a-tooltip>
                    <a-tooltip
                      v-if="canDeleteSectionKpiSection"
                      :title="$t('deleteKpi')"
                    >
                      <a-button
                        danger
                        class="kpi-actions-button"
                        @click="
                          showConfirmDeleteDialog(record.kpiId, record.kpiName)
                        "
                      >
                        <delete-outlined /> {{ $t("delete") }}
                      </a-button>
                    </a-tooltip>
                  </div>
                </template>
              </template>
            </a-table>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </div>
    <a-modal
      danger
      v-model:open="isDeleteModalVisible"
      :title="$t('confirmDialog')"
      @ok="handleDeleteKpi"
      @cancel="isDeleteModalVisible = false"
    >
      <p>{{ $t("confirmDelete", { name: selectedKpiName }) }}</p>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, ref, watch, h } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Button as AButton,
  Input as AInput,
  Select as ASelect,
  SelectOption as ASelectOption,
  DatePicker as ADatePicker,
  FormItem as AFormItem,
  Alert as AAlert,
  Spin as ASpin,
  Collapse as ACollapse,
  CollapsePanel as ACollapsePanel,
  Table as ATable,
  Tag as ATag,
  Card as ACard,
} from "ant-design-vue";
import {
  TeamOutlined,
  ScheduleOutlined,
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
} from "@ant-design/icons-vue";
import { KpiDefinitionStatus } from "@/core/constants/kpiStatus";
import { notification } from "ant-design-vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

const store = useStore();
const router = useRouter();
const { t: $t } = useI18n();

const currentUser = computed(() => store.getters["auth/currentUser"]);
const loading = computed(() => store.getters["kpis/isLoading"]);
const error = computed(() => store.getters["kpis/error"]);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const sectionKpiList = computed(
  () => store.getters["kpis/sectionKpiList"] || []
);

const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);

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

const canCopySectionKpi = computed(() =>
  hasPermission(RBAC_ACTIONS.COPY_TEMPLATE, RBAC_RESOURCES.KPI, "company")
);
const canCreateSectionKpiSection = computed(() =>
  hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI, "section")
);
const canDeleteSectionKpiSection = computed(() =>
  hasPermission(RBAC_ACTIONS.DELETE, RBAC_RESOURCES.KPI, "company")
);

const selectSectionList = ref([]);

const isSectionUser = computed(() => effectiveRole.value === "section");
const isDepartmentUser = computed(() => effectiveRole.value === "department");

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
  startDate: "",
  endDate: "",
});

const sectionGroups = computed(() => {
  const groupedData = {};

  const displayData = Array.isArray(sectionKpiList.value?.data)
    ? sectionKpiList.value.data
    : Array.isArray(sectionKpiList.value)
      ? sectionKpiList.value
      : [];

  const allSections = store.getters["sections/sectionList"] || [];
  const currentFilterDepartmentId = localFilters.departmentId;
  const currentFilterSectionId = localFilters.sectionId;

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
      let targetSectionId = null;
      let departmentIdOfSection = null;

      const sectionInfoFromAssignment = allSections.find(
        (s) =>
          (assignment.assigned_to_section &&
            s.id === Number(assignment.assigned_to_section)) ||
          (assignment.assigned_to_employee &&
            assignment.employee?.sectionId &&
            s.id === Number(assignment.employee.sectionId))
      );

      if (sectionInfoFromAssignment) {
        targetSectionId = sectionInfoFromAssignment.id;
        departmentIdOfSection =
          sectionInfoFromAssignment.department_id ||
          sectionInfoFromAssignment.department?.id;

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

      if (
        currentFilterDepartmentId &&
        Number(departmentIdOfSection) !== Number(currentFilterDepartmentId)
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

        displayStatus =
          sectionData.sectionAssignmentDetails.status ?? displayStatus;
        displayStartDate =
          sectionData.sectionAssignmentDetails.startDate ?? displayStartDate;
        displayEndDate =
          sectionData.sectionAssignmentDetails.endDate ?? displayEndDate;
      } else {
        const hasEmployeeAssignmentsInThisSectionForKpi = kpi.assignments.some(
          (assign) =>
            assign.assigned_to_employee &&
            Number(assign.employee?.sectionId) === sectionId
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
                "actual_value_field"
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
          (a, b) => a.kpiName.localeCompare(b.kpiName)
        );
        return sortedMap;
      }, {});

    return {
      section: sectionGroup.section,
      sectionId: sectionGroup.sectionId,
      data: sortedPerspectives,
    };
  });

  finalGroupedArray.sort((a, b) => a.section.localeCompare(b.section));
  return finalGroupedArray;
});

const applyFilters = async () => {
  loading.value = true;
  error.value = null;
  isDisplayResult.value = false;

  const departmentId =
    localFilters.departmentId === null ||
    Number.isNaN(Number(localFilters.departmentId))
      ? null
      : Number(localFilters.departmentId);

  const sectionIdForPath =
    localFilters.sectionId === null ||
    Number.isNaN(Number(localFilters.sectionId))
      ? 0
      : Number(localFilters.sectionId);

  try {
    const filtersToSend = {
      sectionIdForApi: sectionIdForPath,
      departmentIdForQuery: departmentId,
      name: localFilters.name,
      startDate: localFilters.startDate,
      endDate: localFilters.endDate,
    };

    await store.dispatch("kpis/fetchSectionKpis", filtersToSend);

    isDisplayResult.value = true;
  } catch (err) {
    error.value = err.message || "Failed to fetch KPIs.";
  } finally {
    loading.value = false;
  }
};

const handleDepartmentChange = async () => {
  if (isDepartmentUser.value && currentUser.value?.departmentId) {
    localFilters.departmentId = currentUser.value.departmentId;
    notification.info({
      message: "Thông báo",
      description: "Bạn chỉ có thể xem các bộ phận trong phòng ban của mình.",
    });
    return;
  }

  try {
    if (localFilters.departmentId && localFilters.departmentId !== null) {
      await store.dispatch(
        "sections/fetchSectionsByDepartment",
        localFilters.departmentId
      );
      selectSectionList.value =
        store.getters["sections/sectionsByDepartment"](
          localFilters.departmentId
        ) || [];

      if (
        localFilters.sectionId &&
        !selectSectionList.value.some((s) => s.id === localFilters.sectionId)
      ) {
        localFilters.sectionId = 0;
      }
    } else {
      await store.dispatch("sections/fetchSections");
      selectSectionList.value = store.getters["sections/sectionList"] || [];
      localFilters.sectionId = 0;
    }
  } catch (err) {
    notification.error({
      message: "Lỗi tải bộ phận",
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
  return status === KpiDefinitionStatus.APPROVED ? "success" : "red";
};

const handleCopyKpi = (record) => {
  if (record && record.kpiId) {
    router.push({
      path: "/kpis/create",
      query: {
        templateKpiId: record.kpiId,
      },
    });
  } else {
    notification.warning({
      message: "Không thể sao chép do thiếu thông tin KPI.",
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
};

const renderProgress = (record) => {
  const actual = parseFloat(record.actual);
  const target = parseFloat(record.target);
  if (!target || isNaN(target)) return "--";
  if (!actual || isNaN(actual)) return "0%";
  let percent = Math.round((actual / target) * 100);
  if (percent > 100) percent = 100;
  if (percent < 0) percent = 0;
  return `${percent}%`;
};

const columns = computed(() => [
  {
    title: $t("kpiName"),
    dataIndex: "kpiName",
    key: "kpiName",
    width: "15%",
  },
  {
    title: $t("currentProgress"),
    dataIndex: "chart",
    key: "chart",
    width: "10%",
    customRender: ({ record }) => renderProgress(record),
  },
  {
    title: $t("assignTo"),
    dataIndex: "assignTo",
    key: "assignTo",
    width: "12%",
  },
  {
    title: $t("startDate"),
    dataIndex: "startDate",
    key: "startDate",
    width: "10%",
  },
  { title: $t("endDate"), dataIndex: "endDate", key: "endDate", width: "10%" },
  { title: $t("weight"), dataIndex: "weight", key: "weight", width: "10%" },
  {
    title: $t("target"),
    dataIndex: "target",
    key: "target",
    width: "10%",
  },
  {
    title: $t("actual"),
    dataIndex: "actual",
    key: "actual",
    width: "10%",
  },
  {
    title: $t("status"),
    dataIndex: "status",
    key: "status",
    width: "8%",
  },
  {
    title: $t("validityStatus.name"),
    dataIndex: "validityStatus",
    key: "validityStatus",
    width: "8%",
    align: "center",
    customRender: ({ text }) => {
      return h(
        ATag,
        { color: validityStatusColor[text] || "default" },
        () => $t(`validityStatus.${text}`) || text
      );
    },
  },
  {
    title: $t("common.actions"),
    dataIndex: "action",
    key: "action",
    width: "15%",
    rowClassName: "action-column-cell",
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
    console.log("KPI Section List - sectionGroups:", newGroups);
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
    console.log("Generated activePanelKeys for Sections (JS):", keys);
    activePanelKeys.value = keys;
  },
  {
    immediate: true,
    deep: true,
  }
);

onMounted(async () => {
  try {
    await store.dispatch("departments/fetchDepartments");

    localFilters.departmentId = null;
    await store.dispatch("sections/fetchSections");
    selectSectionList.value = store.getters["sections/sectionList"] || [];
    localFilters.sectionId = 0;
    await applyFilters();
  } catch (err) {
    error.value = err.message || "Failed to fetch initial data.";
  }
});
</script>

<style scoped>
.kpi-section-list-page {
  padding: 24px;
  background: #f6f8fa;
  min-height: 100vh;
}
.list-header-modern {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 18px;
  justify-content: space-between;
}
.header-icon {
  font-size: 32px;
  color: #2563eb;
  background: #e0e7ff;
  border-radius: 50%;
  padding: 8px;
}
.header-title-group {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.header-desc {
  color: #64748b;
  font-size: 15px;
  margin-top: 2px;
}
.action-buttons.right-align {
  margin-left: auto;
  display: flex;
  align-items: center;
}
.filter-form-modern {
  margin-bottom: 0;
}
.filter-label-top .ant-form-item-label {
  display: block;
  text-align: left !important;
  margin-bottom: 4px;
  font-weight: 500;
  color: #334155;
  font-size: 15px;
}
.filter-card-modern {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 18px;
  padding: 10px 14px 2px 14px;
  max-width: 98%;
}
.filter-btn-group {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 40px;
}
@media (max-width: 1200px) {
  .filter-btn-group {
    flex-direction: column;
    align-items: flex-start;
    height: auto;
    gap: 4px;
  }
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
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}
</style>
