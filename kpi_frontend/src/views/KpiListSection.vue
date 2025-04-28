<template>
  <div class="kpi-section-list-page">
    <div class="list-header">
      <h2>Section KPI List</h2>
      <div class="action-buttons">
        <a-button type="primary" @click="goToCreateKpi" style="float: bottom">
          <plus-outlined /> Create New KPI
        </a-button>
      </div>
    </div>

    <div class="filter-controls">
      <a-row :gutter="[20]">
        <a-col :span="5">
          <a-form-item label="Department:">
            <a-select
              v-model:value="localFilters.departmentId"
              style="width: 100%"
              @change="handleDepartmentChange"
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
          <a-form-item label="Section:">
            <a-select
              v-model:value="localFilters.sectionId"
              style="width: 100%"
            >
              <a-select-option
                v-if="
                  selectSectionList.length > 1 || localFilters.sectionId === 0
                "
                :value="0"
                >All</a-select-option
              >
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
        <a-col :span="4">
          <a-form-item label="Start Date:">
            <a-date-picker
              v-model:value="localFilters.startDate"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item label="End Date:">
            <a-date-picker
              v-model:value="localFilters.endDate"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :span="7" style="text-align: right">
          <a-button type="primary" @click="applyFilters" :loading="loading">
            <template #icon><filter-outlined /></template>
            Apply
          </a-button>
          <a-button
            @click="resetFilters"
            :loading="loading"
            style="margin-left: 8px"
          >
            <template #icon><reload-outlined /></template>
            Reset
          </a-button>
        </a-col>
      </a-row>
    </div>

    <div style="margin-top: 20px; margin-bottom: 20px">
      <a-alert v-if="loading" message="Loading KPIs..." type="info" show-icon>
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
        message="No KPIs found matching your criteria."
        type="warning"
        show-icon
        closable
      />

      <a-alert
        v-if="deletedKpiName"
        :message="`KPI '${deletedKpiName}' was deleted successfully!`"
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
        <h4
          class="text-lg font-bold mb-2"
          style="margin-top: 10px; margin-bottom: 10px"
        >
          {{ sectionGroup.section }}
        </h4>

        <a-collapse
          v-model:activeKey="activePanelKeys"
          expandIconPosition="end"
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
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'kpiName'">
                  <span>{{ record.kpiName }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'chart'">
                  <apexchart
                    type="donut"
                    width="80%"
                    height="80"
                    :options="{
                      chart: { height: 80, type: 'donut' },
                      labels: ['Actual', 'Remaining'],
                      plotOptions: {
                        pie: { donut: { thickness: '40px' } },
                      },
                      colors: ['#008FFB', '#B9E5FF'],
                      dataLabels: {
                        enabled: true,
                        style: {
                          fontSize: '10px',
                          fontWeight: 'bold',
                          colors: ['black'],
                        },
                      },
                      legend: { show: false },
                    }"
                    :series="[
                      parseFloat(record.actual) || 0,
                      Math.max(
                        parseFloat(record.target) - parseFloat(record.actual),
                        0
                      ),
                    ]"
                  />
                </template>

                <template v-else-if="column.dataIndex === 'assignTo'">
                  <span>{{ record.assignTo }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'startDate'"
                  ><span>{{ record.startDate }}</span></template
                >

                <template v-else-if="column.dataIndex === 'endDate'"
                  ><span>{{ record.endDate }}</span></template
                >

                <template v-else-if="column.dataIndex === 'weight'"
                  ><span>{{ record.weight }}</span></template
                >

                <template v-else-if="column.dataIndex === 'target'"
                  ><span>{{
                    `${record.target} ${record.unit}`
                  }}</span></template
                >

                <template v-else-if="column.dataIndex === 'actual'"
                  ><span>{{
                    `${record.actual} ${record.unit}`
                  }}</span></template
                >

                <template v-else-if="column.dataIndex === 'status'">
                  <a-tag
                    :bordered="false"
                    :color="getStatusColor(record.status)"
                  >
                    {{ record.status }}
                  </a-tag>
                </template>

                <template v-else-if="column.dataIndex === 'action'">
                  <a-tooltip title="View Details">
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
                      <schedule-outlined /> Details
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="Copy KPI">
                    <a-button
                      type="dashed"
                      class="kpi-actions-button"
                      size="small"
                      @click="handleCopyKpi(record)"
                    >
                      <copy-outlined /> Copy
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="Delete KPI">
                    <a-button
                      danger
                      class="kpi-actions-button"
                      @click="
                        showConfirmDeleteDialog(record.kpiId, record.kpiName)
                      "
                    >
                      <delete-outlined /> Delete
                    </a-button>
                  </a-tooltip>
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
      title="Confirm Dialog"
      @ok="handleDeleteKpi"
      @cancel="isDeleteModalVisible = false"
    >
      <p>Are you sure to delete "{{ selectedKpiName }}"?</p>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";
import {
  PlusOutlined,
  FilterOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  DeleteOutlined,
  CopyOutlined,
} from "@ant-design/icons-vue";
import { notification } from "ant-design-vue";

const store = useStore();
const router = useRouter();
const route = useRoute();

const loading = computed(() => store.getters["kpis/isLoading"]);
const error = computed(() => store.getters["kpis/error"]);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const sectionList = computed(() => store.getters["sections/sectionList"] || []);
const sectionKpiList = computed(
  () => store.getters["kpis/sectionKpiList"] || []
);

const creationScope = computed(() => route.query.scope || "section");
const selectSectionList = ref([]);

const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);

const isDisplayResult = ref(false);
const activePanelKeys = ref([]);

const sectionGroups = computed(() => {
  const groupedData = {};

  const displayData = sectionKpiList.value
    ? sectionKpiList.value.data || sectionKpiList.value
    : [];
  const allSections = store.getters["sections/sectionList"] || [];
  const currentFilterDepartmentId = localFilters.departmentId;
  const currentFilterSectionId = localFilters.sectionId;
  if (
    displayData === null ||
    displayData === undefined ||
    !Array.isArray(displayData) ||
    displayData.length === 0
  ) {
    return [];
  }

  displayData.forEach((kpi) => {
    if (!kpi || !kpi.assignments || kpi.assignments.length === 0) {
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

    kpi.assignments.forEach((assignment) => {
      let assignedDepartmentId = undefined;
      if (
        assignment?.assigned_to_department !== null &&
        assignment?.assigned_to_department !== undefined
      ) {
        assignedDepartmentId = assignment.assigned_to_department;
      } else if (
        assignment?.assigned_to_section !== null &&
        assignment?.assigned_to_section !== undefined
      ) {
        if (assignment.section) {
          if (
            assignment.section.department?.id !== null &&
            assignment.section.department?.id !== undefined
          ) {
            assignedDepartmentId = assignment.section.department.id;
          } else if (
            assignment.section?.department_id !== null &&
            assignment.section?.department_id !== undefined
          ) {
            assignedDepartmentId = assignment.section.department_id;
          }
        }
      } else if (
        assignment?.assigned_to_employee !== null &&
        assignment?.assigned_to_employee !== undefined
      ) {
        if (assignment.employee?.section) {
          if (
            assignment.employee.section.department?.id !== null &&
            assignment.employee.section.department?.id !== undefined
          ) {
            assignedDepartmentId = assignment.employee.section.department.id;
          } else if (
            assignment.employee.section.department_id !== null &&
            assignment.employee.section.department_id !== undefined
          ) {
            assignedDepartmentId = assignment.employee.section.department_id;
          }
        }
      }

      const assignedSectionId =
        assignment?.assigned_to_section || assignment?.employee?.section_id;
      if (!assignedSectionId) {
        return;
      }

      if (currentFilterDepartmentId && currentFilterDepartmentId !== "") {
        const filterDeptIdNumber = parseInt(currentFilterDepartmentId, 10);
        if (
          !isNaN(filterDeptIdNumber) &&
          Number(assignedDepartmentId) !== filterDeptIdNumber
        ) {
          return;
        }
      }

      if (currentFilterSectionId && currentFilterSectionId !== 0) {
        const filterSectionIdNumber = parseInt(currentFilterSectionId, 10);
        if (
          !isNaN(filterSectionIdNumber) &&
          Number(assignedSectionId) !== filterSectionIdNumber
        ) {
          return;
        }
      }

      const assignedSection = allSections.find(
        (s) => Number(s.id) === Number(assignedSectionId)
      );

      if (!assignedSection) {
        return;
      }

      const sectionName = assignedSection.name;
      const perspectiveKey = `${kpiDetails.perspectiveId}. ${kpiDetails.perspectiveName}`;
      if (!groupedData[assignedSectionId]) {
        groupedData[assignedSectionId] = {
          section: sectionName,
          sectionId: assignedSectionId,
          data: {},
        };
      }
      if (!groupedData[assignedSectionId].data[perspectiveKey]) {
        groupedData[assignedSectionId].data[perspectiveKey] = [];
      }

      let assignToDisplay = sectionName;
      if (assignment?.assigned_to_employee && assignment?.employee) {
        assignToDisplay = assignment.employee.name;
      } else if (assignment?.assigned_to_team && assignment?.team) {
        assignToDisplay = assignment.team.name;
      }
      const rowData = {
        key: `assignment-${assignment?.id}`,
        kpiId: kpiDetails.kpiId,
        kpiName: kpiDetails.kpiName,
        perspectiveName: kpiDetails.perspectiveName,
        assignTo: assignToDisplay,
        startDate: kpiDetails.kpiStartDate,
        endDate: kpiDetails.kpiEndDate,
        weight: kpiDetails.kpiWeight,
        target: assignment?.targetValue || "0",
        actual:
          assignment?.kpiValues && assignment.kpiValues.length > 0
            ? assignment.kpiValues[0].value || "0"
            : "0",
        unit: kpiDetails.kpiUnit,
        status: assignment?.status || "Unknown",
      };
      groupedData[assignedSectionId].data[perspectiveKey].push(rowData);
    });
  });

  const finalGroupedArray = Object.values(groupedData).map((sectionGroup) => {
    const sortedPerspectives = Object.keys(sectionGroup.data)
      .sort()
      .reduce((sortedMap, perspectiveKey) => {
        sortedMap[perspectiveKey] = sectionGroup.data[perspectiveKey];
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

  try {
    const filtersToSend = {
      departmentId: localFilters.departmentId || "",
      sectionId: localFilters.sectionId,
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
  loading.value = true;
  error.value = null;

  try {
    if (localFilters.departmentId) {
      await store.dispatch("sections/fetchSections", {
        department_id: localFilters.departmentId,
      });
    } else {
      console.warn(
        "Department filter is not selected in handleDepartmentChange."
      );
      await store.dispatch("sections/fetchSections");
    }
  } catch (err) {
    error.value = err.message || "Failed to fetch sections.";
  } finally {
    selectSectionList.value = sectionList.value;

    localFilters.sectionId =
      selectSectionList.value.length > 1
        ? 0
        : selectSectionList.value[0]?.id || "";

    loading.value = false;
  }
};

const tableData = (perspectiveGroupRowsArray) => {
  return perspectiveGroupRowsArray;
};

const goToCreateKpi = () => {
  const targetSectionId = localFilters.value;
  if (!targetSectionId && creationScope.value === "section") {
    console.warn("Cannot navigate to create KPI: Section ID is not selected.");
    notification.warning({
      message: "Please select a Section to create a KPI for.",
    });
    return;
  }
  router.push({
    name: "KpiCreate",
    query: {
      scope: "section",
      sectionId: targetSectionId,
    },
  });
};

const getStatusColor = (status) => {
  return status === "Active" ? "success" : "red";
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
      alert(
        `Delete failed KPI: ${store.getters["kpis/error"] || "Unknown error"}`
      );
      console.error("Delete KPI error:", err);
    });
};

const localFilters = reactive({
  name: "",
  departmentId: 1,
  sectionId: 0,
  startDate: "",
  endDate: "",
});

const columns = [
  {
    title: "KPI Name",
    dataIndex: "kpiName",
    key: "kpiName",
    width: "15%",
  },
  {
    title: "Assign To",
    dataIndex: "assignTo",
    key: "assignTo",
    width: "12%",
  },
  {
    title: "Start Date",
    dataIndex: "startDate",
    key: "startDate",
    width: "10%",
  },
  { title: "End Date", dataIndex: "endDate", key: "endDate", width: "10%" },
  { title: "Weight", dataIndex: "weight", key: "weight", width: "10%" },
  {
    title: "Target",
    dataIndex: "target",
    key: "target",
    width: "10%",
  },
  {
    title: "Actual",
    dataIndex: "actual",
    key: "actual",
    width: "10%",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: "8%",
  },
  {
    title: "Action",
    dataIndex: "action",
    key: "action",
    width: "15%",
    rowClassName: "action-column-cell",
  },
];

watch(
  () => [localFilters.departmentId, localFilters.sectionId],
  ([newDeptId, newSectionId], [oldDeptId, oldSectionId] = []) => {
    if (newDeptId !== oldDeptId || newSectionId !== oldSectionId) {
      applyFilters();
    }
  },
  { immediate: true }
);

const resetFilters = () => {
  localFilters.name = "";
  localFilters.departmentId = 1;
  localFilters.sectionId = "";
  localFilters.startDate = "";
  localFilters.endDate = "";
};

const rowClassName = (record) => {
  return record.isParent ? "row-parent" : "";
};

watch(
  sectionGroups,
  (newGroups) => {
    if (newGroups && typeof newGroups === "object") {
      const allKeys = Object.keys(newGroups);
      activePanelKeys.value = allKeys;
    } else {
      activePanelKeys.value = [];
    }
  },
  {
    immediate: true,
  }
);

onMounted(async () => {
  try {
    await store.dispatch("departments/fetchDepartments");
    await handleDepartmentChange();
  } catch (err) {
    error.value = err.message || "Failed to fetch initial data.";
    loading.value = false;
  }
});
</script>

<style scoped></style>
