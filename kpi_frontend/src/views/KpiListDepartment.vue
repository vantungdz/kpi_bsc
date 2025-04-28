<template>
  <div class="kpi-department-list-page">
    <div class="list-header">
      <h2>Department KPI List</h2>

      <div class="action-buttons">
        <a-button type="primary" style="float: bottom" @click="goToCreateKpi">
          <plus-outlined /> Create New KPI
        </a-button>
      </div>
    </div>

    <div class="filter-controls">
      <a-row :gutter="[22]">
        <a-col :span="6">
          <a-form-item label="Search:">
            <a-input
              v-model:value="localFilters.name"
              placeholder="KPI name..."
              @pressEnter="applyFilters"
            />
          </a-form-item>
        </a-col>

        <a-col :span="5">
          <a-form-item label="Department:">
            <a-select
              v-model:value="localFilters.departmentId"
              style="width: 100%"
              @change="applyFilters"
            >
              <a-select-option value="">All</a-select-option>

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
          <a-form-item label="Start Date:">
            <a-date-picker
              v-model:value="localFilters.startDate"
              style="width: 100%"
              @change="applyFilters"
            />
          </a-form-item>
        </a-col>

        <a-col :span="4">
          <a-form-item label="End Date:">
            <a-date-picker
              v-model:value="localFilters.endDate"
              style="width: 100%"
              @change="applyFilters"
            />
          </a-form-item>
        </a-col>

        <a-col :span="5" style="text-align: right">
          <a-button type="primary" :loading="loading" @click="applyFilters">
            <template #icon><filter-outlined /></template>
            Apply
          </a-button>

          <a-button
            style="margin-left: 8px"
            :loading="loading"
            @click="resetFilters"
          >
            <template #icon><reload-outlined /></template>
            Reset
          </a-button>
        </a-col>
      </a-row>
    </div>

    <div style="margin-top: 20px; margin-bottom: 20px">
      <a-alert v-if="loading" type="info" message="Loading KPIs..." show-icon>
        <template #icon> <a-spin /> </template>
      </a-alert>

      <a-alert
        v-else-if="error"
        type="error"
        :message="error"
        show-icon
        closable
      />

      <a-alert
        v-else-if="isDisplayResult && departmentGroups.length === 0"
        type="warning"
        message="No KPIs found matching your criteria."
        show-icon
        closable
      />

      <a-alert
        v-if="deletedKpiName"
        type="success"
        :message="`KPI '${deletedKpiName}' was deleted successfully!`"
        show-icon
        closable
        @close="deletedKpiName = null"
      />
    </div>

    <div class="data-container">
      <div
        v-for="(departmentItem, departmentIndex) in departmentGroups"
        :key="'dept-' + departmentIndex"
        class="mb-8"
      >
        <h4 style="margin-top: 10px" class="text-lg font-bold mb-2">
          {{ `Department: ${departmentItem.department}` }}
        </h4>

        <a-collapse
          v-model:activeKey="activePanelKeys"
          expandIconPosition="end"
        >
          <a-collapse-panel
            v-for="(
              perspectiveGroupRows, perspectiveKey
            ) in departmentItem.data"
            :key="'pers-' + departmentIndex + '-' + perspectiveKey"
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
                    width="120px"
                    height="100"
                    :options="{
                      chart: { height: 100, type: 'donut' },
                      labels: ['Actual', 'Remaining'],
                      colors: ['#008FFB', '#B9E5FF'],
                      dataLabels: {
                        enabled: true,
                        style: {
                          fontSize: '12px',
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

                <template v-else-if="column.dataIndex === 'startDate'">
                  <span>{{ record.startDate }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'endDate'">
                  <span>{{ record.endDate }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'weight'">
                  <span>{{ record.weight }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'target'">
                  <span>{{ `${record.target} ${record.unit}` }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'actual'">
                  <span>{{ `${record.actual} ${record.unit}` }}</span>
                </template>

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
                        })
                      "
                    >
                      <schedule-outlined /> Details
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="Copy KPI">
                    <a-button
                      type="dashed"
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
                        showConfirmDeleteDialog(record.key, record.kpiName)
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

        <a-modal
          danger
          v-model:open="isDeleteModalVisible"
          title="Confirm Dialog"
          @ok="handleDeleteKpi"
          @cancel="isDeleteModalVisible = false"
        >
          <p>Are you sure to delete assignment for "{{ selectedKpiName }}"?</p>
        </a-modal>
      </div>
    </div>

    <router-view></router-view>
  </div>
</template>
<script setup>
import { reactive, computed, onMounted, ref } from "vue";
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
const departmentKpiList = computed(
  () => store.getters["kpis/departmentKpiList"] || []
);

const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
const isDisplayResult = ref(false);

const localFilters = reactive({
  name: "",
  departmentId: "",
  status: "",
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
    title: "Current Progress",
    dataIndex: "chart",
    key: "chart",
    width: "10%",
  },
  {
    title: "Assigned To",
    dataIndex: "assignTo",
    key: "assignTo",
    width: "10%",
  },
  {
    title: "Start Date",
    dataIndex: "startDate",
    key: "startDate",
    width: "7%",
  },
  { title: "End Date", dataIndex: "endDate", key: "endDate", width: "7%" },
  { title: "Weight", dataIndex: "weight", key: "weight", width: "6%" },
  {
    title: "Target",
    dataIndex: "target",
    key: "target",
    width: "6%",
  },
  {
    title: "Actual",
    dataIndex: "actual",
    key: "actual",
    width: "6%",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: "6%",
  },
  {
    title: "Action",
    dataIndex: "action",
    key: "action",
    width: "13%",
    rowClassName: "action-column-cell",
  },
];

const tableData = (perspectiveGroupRowsArray) => {
  return perspectiveGroupRowsArray;
};

const goToCreateKpi = () => {
  const targetDepartmentId = localFilters.departmentId;

  if (!targetDepartmentId) {
    notification.warning({
      message: "Please select a Department to create a KPI for.",
    });
    return;
  }

  router.push({
    name: "KpiCreateDepartment",
    params: {
      departmentId: targetDepartmentId,
    },
  });
};

const applyFilters = async () => {
  loading.value = true;
  error.value = null;
  isDisplayResult.value = false;

  try {
    await store.dispatch("kpis/fetchDepartmentKpis", localFilters.departmentId);
    isDisplayResult.value = true;
  } catch (err) {
    error.value = err.message || "Failed to fetch KPIs.";
  } finally {
    loading.value = false;
  }
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

const showConfirmDeleteDialog = (assignmentKey, kpiName) => {
  isDeleteModalVisible.value = true;
  selectedKpiId.value = assignmentKey;
  selectedKpiName.value = kpiName;
};

const handleDeleteKpi = async () => {
  if (!selectedKpiId.value) return;

  loading.value = true;

  try {
    console.log("Deleting assignment with key:", selectedKpiId.value);

    notification.success({
      message: `Gán KPI '${selectedKpiName.value}' đã được xóa thành công!`,
    });
    deletedKpiName.value = selectedKpiName.value;

    applyFilters();
  } catch (error) {
    console.error("Xóa gán KPI thất bại:", error);
    const errorMessage =
      error?.response?.data?.message ||
      error?.message ||
      "Xóa gán KPI thất bại.";
    notification.error({
      message: "Xóa thất bại",
      description: errorMessage,
      duration: 5,
    });
  } finally {
    loading.value = false;
    isDeleteModalVisible.value = false;
    selectedKpiId.value = null;
    selectedKpiName.value = null;
  }
};

const departmentGroups = computed(() => {
  const groupedData = {};
  const displayData = departmentKpiList.value
    ? departmentKpiList.value.data
    : [];
  const allDepartments = store.getters["departments/departmentList"] || [];

  const currentFilterDepartmentId = localFilters.departmentId;

  console.log(
    "LOG 1: Dữ liệu gốc từ store (departmentKpiList.value):",
    departmentKpiList.value
  );
  console.log("LOG 2: Mảng dữ liệu KPI (displayData):", displayData);

  if (!displayData || displayData.length === 0) {
    console.log("LOG 3: displayData rỗng, trả về mảng gom nhóm rỗng");
    return [];
  }

  displayData.forEach((kpi) => {
    if (!kpi || !kpi.assignments) return;

    const kpiDetails = {
      /* ... giữ nguyên logic lấy kpiDetails ... */ kpiId: kpi.id,
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
      const assignmentDepartmentId =
        assignment.assigned_to_department || assignment.section?.department_id;

      if (!assignmentDepartmentId) {
        console.warn(
          "LOG (WARN): Assignment không xác định được Department ID:",
          assignment
        );
        return;
      }

      if (currentFilterDepartmentId && currentFilterDepartmentId !== "") {
        const filterIdNumber = parseInt(currentFilterDepartmentId, 10);
        if (
          !isNaN(filterIdNumber) &&
          assignmentDepartmentId !== filterIdNumber
        ) {
          console.log(
            `Đã bỏ qua assignment ${assignment.id} của KPI ${kpi.id}: Được gán tới Department ${assignmentDepartmentId}, Bộ lọc: ${currentFilterDepartmentId}`
          );
          return;
        }
      }

      const assignedDepartment = allDepartments.find(
        (d) => d.id === assignmentDepartmentId
      );

      if (!assignedDepartment) {
        console.warn(
          `LOG (WARN): Không tìm thấy thông tin Department ID ${assignmentDepartmentId} trong danh sách department:`,
          assignment
        );
        return;
      }

      const departmentName = assignedDepartment.name;
      const perspectiveKey = `${kpiDetails.perspectiveId}. ${kpiDetails.perspectiveName}`;

      if (!groupedData[assignmentDepartmentId]) {
        groupedData[assignmentDepartmentId] = {
          department: departmentName,
          data: {},
        };
      }

      if (!groupedData[assignmentDepartmentId].data[perspectiveKey]) {
        groupedData[assignmentDepartmentId].data[perspectiveKey] = [];
      }

      let assignToDisplay = departmentName;
      if (assignment.assigned_to_section && assignment.section) {
        assignToDisplay = assignment.section.name;
      } else if (assignment.assigned_to_employee && assignment.employee) {
        assignToDisplay = assignment.employee.name;
      }

      const rowData = {
        key: `assignment-${assignment.id}`,
        kpiId: kpiDetails.kpiId,
        kpiName: kpiDetails.kpiName,
        perspectiveName: kpiDetails.perspectiveName,
        assignTo: assignToDisplay,
        startDate: kpiDetails.kpiStartDate,
        endDate: kpiDetails.kpiEndDate,
        weight: kpiDetails.kpiWeight,
        target: assignment.targetValue || "0",
        actual:
          assignment.kpiValues && assignment.kpiValues.length > 0
            ? assignment.kpiValues[0].value || "0"
            : "0",
        unit: kpiDetails.kpiUnit,
        status: assignment.status || "Unknown",
      };

      groupedData[assignmentDepartmentId].data[perspectiveKey].push(rowData);
    });
  });

  console.log("LOG 4: Dữ liệu đã gom nhóm (groupedData):", groupedData);

  const finalGroupedArray = Object.values(groupedData).map((deptGroup) => {
    const sortedPerspectives = Object.keys(deptGroup.data)
      .sort()
      .reduce((sortedMap, perspectiveKey) => {
        sortedMap[perspectiveKey] = deptGroup.data[perspectiveKey];
        return sortedMap;
      }, {});

    return {
      department: deptGroup.department,
      data: sortedPerspectives,
    };
  });

  finalGroupedArray.sort((a, b) => a.department.localeCompare(b.department));

  console.log(
    "LOG 5: Mảng dữ liệu đã gom nhóm cuối cùng (finalGroupedArray):",
    finalGroupedArray
  );

  return finalGroupedArray;
});

const rowClassName = (record) => {
  return record.isParent ? "row-parent" : "";
};

const getStatusColor = (status) => {
  return status === "Active" ? "success" : "red";
};

onMounted(async () => {
  try {
    await store.dispatch("departments/fetchDepartments");
    applyFilters();
  } catch (err) {
    console.error("Failed to fetch departments:", err);
    notification.error({ message: "Failed to load department list." });
  }
});
</script>

<style scoped></style>
