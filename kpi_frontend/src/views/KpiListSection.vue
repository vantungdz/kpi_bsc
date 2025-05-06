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
import { useRouter } from "vue-router";
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

const loading = computed(() => store.getters["kpis/isLoading"]);
const error = computed(() => store.getters["kpis/error"]);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const sectionList = computed(() => store.getters["sections/sectionList"] || []);
const sectionKpiList = computed(
  () => store.getters["kpis/sectionKpiList"] || []
);

const selectSectionList = ref([]);

const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
const isDisplayResult = ref(false);
const activePanelKeys = ref([]);

const sectionGroups = computed(() => {
  const groupedData = {}; // Format: { sectionId: { section: 'Section Name', sectionId: 123, data: { 'PerspectiveKey': [rowData1, rowData2] } } }

  // Lấy dữ liệu KPI đã fetch, đảm bảo nó là một mảng
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
    // Mỗi 'kpi' ở đây là một đối tượng định nghĩa KPI, giờ đã bao gồm kpi.actuals_by_section_id từ backend
    if (!kpi || !kpi.assignments) {
      // Vẫn cần assignments để lấy target, status của assignment cho section, etc.
      return;
    }

    const kpiDetails = {
      kpiId: kpi.id,
      kpiName: kpi.name,
      kpiUnit: kpi.unit || "",
      kpiStartDate: kpi.start_date,
      kpiEndDate: kpi.end_date,
      kpiWeight: kpi.weight, // Weight từ định nghĩa KPI
      kpiStatus: kpi.status, // Status của định nghĩa KPI
      kpiTarget: kpi.target, // Target của định nghĩa KPI
      perspectiveId: kpi.perspective_id,
      perspectiveName: kpi.perspective ? kpi.perspective.name : "Uncategorized",
    };

    // Xác định các section liên quan cho KPI này dựa trên assignments của nó
    // Map<sectionId, { sectionName: string, sectionAssignmentDetails: object | null }>
    const sectionsForThisKpi = new Map();

    kpi.assignments.forEach((assignment) => {
      let targetSectionId = null;
      let departmentIdOfSection = null; // Department ID của section mà assignment này thuộc về

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
            // Đây là assignment trực tiếp cho section
            details = {
              target: assignment.targetValue,
              weight: assignment.weight, // Giả sử weight có thể được gán theo section
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
          // Nếu đã có entry cho section này (từ employee assignment) nhưng chưa có details từ direct section assignment
          sectionsForThisKpi.get(targetSectionId).sectionAssignmentDetails = {
            target: assignment.targetValue,
            weight: assignment.weight,
            status: assignment.status,
            startDate: assignment.start_date || kpiDetails.kpiStartDate,
            endDate: assignment.end_date || kpiDetails.kpiEndDate,
          };
        }
      }

      if (targetSectionId === null) return; // Bỏ qua nếu không xác định được section

      // Áp dụng bộ lọc department và section
      if (
        currentFilterDepartmentId &&
        Number(departmentIdOfSection) !== Number(currentFilterDepartmentId)
      ) {
        sectionsForThisKpi.delete(targetSectionId); // Xóa section này khỏi map nếu không khớp department filter
        return;
      }
      if (
        currentFilterSectionId &&
        currentFilterSectionId !== 0 &&
        targetSectionId !== Number(currentFilterSectionId)
      ) {
        sectionsForThisKpi.delete(targetSectionId); // Xóa section này khỏi map nếu không khớp section filter
        return;
      }
    });

    // Với mỗi section liên quan cho KPI này, tạo một dòng dữ liệu (rowData)
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
      const displayWeight = kpiDetails.kpiWeight; // Weight luôn lấy từ KPI definition theo yêu cầu trước
      let displayStatus = kpiDetails.kpiStatus;
      let displayStartDate = kpiDetails.kpiStartDate;
      let displayEndDate = kpiDetails.kpiEndDate;
      let displayAssignTo = sectionData.sectionName; // Mặc định là tên section

      if (sectionData.sectionAssignmentDetails) {
        // Nếu có assignment trực tiếp cho section, ưu tiên các giá trị từ đó
        displayTarget =
          sectionData.sectionAssignmentDetails.target ?? displayTarget;
        // displayWeight không được ghi đè ở đây, giữ nguyên từ kpiDetails.kpiWeight
        displayStatus =
          sectionData.sectionAssignmentDetails.status ?? displayStatus;
        displayStartDate =
          sectionData.sectionAssignmentDetails.startDate ?? displayStartDate;
        displayEndDate =
          sectionData.sectionAssignmentDetails.endDate ?? displayEndDate;
      } else {
        // Nếu không có assignment trực tiếp cho section, có thể nó là tổng hợp từ user assignments
        // hoặc KPI này được áp dụng cho section mà không có target/status riêng cho section.
        // Trong trường hợp này, `assignTo` có thể cần làm rõ hơn.
        // Ví dụ: nếu có employee assignments trong section này cho KPI này.
        const hasEmployeeAssignmentsInThisSectionForKpi = kpi.assignments.some(
          (assign) =>
            assign.assigned_to_employee &&
            Number(assign.employee?.sectionId) === sectionId
        );
        if (hasEmployeeAssignmentsInThisSectionForKpi) {
          displayAssignTo = `Users in ${sectionData.sectionName}`;
        }
      }

      // Lấy giá trị actual đã được tổng hợp từ backend cho section này
      const sectionSpecificActual =
        kpi.actuals_by_section_id &&
        kpi.actuals_by_section_id[sectionId] !== undefined
          ? kpi.actuals_by_section_id[sectionId]
          : null;

      const rowData = {
        key: `kpi-${kpi.id}-section-${sectionId}`, // Key duy nhất cho mỗi dòng
        kpiId: kpiDetails.kpiId,
        kpiName: kpiDetails.kpiName,
        perspectiveName: kpiDetails.perspectiveName,
        assignTo: displayAssignTo,
        startDate: displayStartDate,
        endDate: displayEndDate,
        weight: displayWeight,
        target: displayTarget,
        actual:
          sectionSpecificActual !== null
            ? sectionSpecificActual.toString()
            : "0", // Sử dụng giá trị từ backend
        unit: kpiDetails.kpiUnit,
        status: displayStatus, // Status của assignment cho section, hoặc của KPI definition
      };
      groupedData[sectionId].data[perspectiveKey].push(rowData);
    });
  });

  // Chuyển đổi object groupedData thành mảng và sắp xếp
  const finalGroupedArray = Object.values(groupedData).map((sectionGroup) => {
    const sortedPerspectives = Object.keys(sectionGroup.data)
      .sort() // Sắp xếp các perspective theo key (ví dụ: "1. Financial")
      .reduce((sortedMap, perspectiveKey) => {
        // Sắp xếp các KPI trong mỗi perspective theo tên (ví dụ)
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

  // Sắp xếp các section theo tên
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
  router.push({
    name: "KpiCreateSection",
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
    await handleDepartmentChange();
  } catch (err) {
    error.value = err.message || "Failed to fetch initial data.";
    loading.value = false;
  }
});
</script>

<style scoped></style>
