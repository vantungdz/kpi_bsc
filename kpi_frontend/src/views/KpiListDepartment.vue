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
            <a-input v-model:value="localFilters.name" placeholder="KPI name..." @pressEnter="applyFilters" />
          </a-form-item>
        </a-col>

        <a-col :span="5">
          <a-form-item label="Department:">
            <a-select v-model:value="localFilters.departmentId" style="width: 100%" @change="applyFilters">
              <a-select-option value="">All</a-select-option>

              <a-select-option v-for="department in departmentList" :key="department.id" :value="department.id">
                {{ department.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :span="4">
          <a-form-item label="Start Date:">
            <a-date-picker v-model:value="localFilters.startDate" style="width: 100%" @change="applyFilters" />
          </a-form-item>
        </a-col>

        <a-col :span="4">
          <a-form-item label="End Date:">
            <a-date-picker v-model:value="localFilters.endDate" style="width: 100%" @change="applyFilters" />
          </a-form-item>
        </a-col>

        <a-col :span="5" style="text-align: right">
          <a-button type="primary" :loading="loading" @click="applyFilters">
            <template #icon><filter-outlined /></template>
            Apply
          </a-button>

          <a-button style="margin-left: 8px" :loading="loading" @click="resetFilters">
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

      <a-alert v-else-if="error" type="error" :message="error" show-icon closable />

      <a-alert v-else-if="isDisplayResult && departmentGroups.length === 0" type="warning"
        message="No KPIs found matching your criteria." show-icon closable />

      <a-alert v-if="deletedKpiName" type="success" :message="`KPI '${deletedKpiName}' was deleted successfully!`"
        show-icon closable @close="deletedKpiName = null" />
    </div>

    <div class="data-container">
      <div v-for="(departmentItem, departmentIndex) in departmentGroups" :key="'dept-' + departmentIndex" class="mb-8">
        <h4 style="margin-top: 10px" class="text-lg font-bold mb-2">
          {{ `Department: ${departmentItem.department}` }}
        </h4>

        <a-collapse v-model:activeKey="activePanelKeys" expandIconPosition="end">
          <a-collapse-panel v-for="(
perspectiveGroupRows, perspectiveKey
            ) in departmentItem.data" :key="'pers-' + departmentIndex + '-' + perspectiveKey"
            :header="perspectiveKey.split('. ')[1] || perspectiveKey">
            <a-table :columns="columns" :dataSource="tableData(perspectiveGroupRows)" :pagination="false" rowKey="key"
              :rowClassName="rowClassName" size="small" bordered>
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'kpiName'">
                  <span>{{ record.kpiName }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'chart'">
                  <apexchart type="donut" width="120px" height="100" :options="{
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
                  }" :series="[
                    parseFloat(record.actual) || 0,
                    Math.max(
                      parseFloat(record.target) - parseFloat(record.actual),
                      0
                    ),
                  ]" />
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
                  <a-tag :bordered="false" :color="getStatusColor(record.status)">
                    {{ record.status }}
                  </a-tag>
                </template>

                <template v-else-if="column.dataIndex === 'action'">
                  <a-tooltip title="View Details">
                    <a-button type="default" class="kpi-actions-button" @click="
                      $router.push({
                        name: 'KpiDetail', // Sử dụng tên route chi tiết KPI gốc
                        params: { id: record.kpiId }, // Truyền ID của KPI gốc
                      })
                      ">
                      <schedule-outlined /> Details
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="Copy KPI">
                    <a-button type="dashed" size="small" @click="handleCopyKpi(record)">
                      <copy-outlined /> Copy
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="Delete KPI">
                    <a-button danger class="kpi-actions-button" @click="
                      showConfirmDeleteDialog(record.key, record.kpiName) // Truyền key (assignment ID) và tên KPI
                      ">
                      <delete-outlined /> Delete
                    </a-button>
                  </a-tooltip>
                </template>
              </template>
            </a-table>
          </a-collapse-panel>
        </a-collapse>

        <a-modal danger v-model:open="isDeleteModalVisible" title="Confirm Dialog" @ok="handleDeleteKpi"
          @cancel="isDeleteModalVisible = false">
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
  CopyOutlined
} from "@ant-design/icons-vue";
import { notification } from "ant-design-vue";

// --- Store  ---
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

// --- Local State for Filters & Sorting ---
const localFilters = reactive({
  name: "",
  departmentId: "",
  status: "",
  startDate: "",
  endDate: "",
});

// Columns
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
  { title: "Weight", dataIndex: "weight", key: "weight", width: "6%" }, // Trọng số của KPI gốc
  {
    title: "Target",
    dataIndex: "target", // Đây là target của assignment
    key: "target",
    width: "6%",
  },
  {
    title: "Actual",
    dataIndex: "actual", // Đây là actual của assignment
    key: "actual",
    width: "6%",
  },
  {
    title: "Status",
    dataIndex: "status", // Đây là status của assignment
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
  // perspectiveGroupRowsArray giờ đây là mảng các đối tượng rowData (assignments)
  return perspectiveGroupRowsArray;
};

const goToCreateKpi = () => {
  // Lấy ID của department đang được chọn trong filter dropdown
  const targetDepartmentId = localFilters.departmentId;

  // Kiểm tra xem người dùng đã chọn một Department cụ thể chưa
  if (!targetDepartmentId) {
    notification.warning({
      message: "Please select a Department to create a KPI for.",
    });
    return;
  }

  // Điều hướng đến route KpiCreateDepartment và truyền departmentId qua route params
  router.push({
    name: "KpiCreateDepartment", // Sử dụng tên route đã định nghĩa trong router/index.js
    params: {
      departmentId: targetDepartmentId,
    },
    // Không cần truyền scope hay departmentId qua query nữa cho route này
  });
};

const applyFilters = async () => {
  loading.value = true; // Bắt đầu trạng thái loading
  error.value = null; // Xóa lỗi trước đó
  isDisplayResult.value = false; // Đặt false trước khi fetch

  try {
    // Bỏ điều kiện if (localFilters.departmentId)
    // Action fetchDepartmentKpis sẽ được gọi với giá trị departmentId hiện tại (có thể là "" cho All)
    await store.dispatch(
      "kpis/fetchDepartmentKpis",
      localFilters.departmentId // Truyền giá trị departmentId hiện tại
    );
    isDisplayResult.value = true; // Chỉ đặt true khi fetch thành công
  } catch (err) {
    error.value = err.message || "Failed to fetch KPIs.";
    // Giữ isDisplayResult là false hoặc xử lý hiển thị lỗi
  } finally {
    loading.value = false; // Kết thúc trạng thái loading
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
    notification.warning({ message: "Không thể sao chép do thiếu thông tin KPI." });
  }
};

const showConfirmDeleteDialog = (assignmentKey, kpiName) => {
  isDeleteModalVisible.value = true;
  selectedKpiId.value = assignmentKey; // Lưu key của assignment vào đây
  selectedKpiName.value = kpiName; // Lưu tên KPI để hiển thị trong dialog
};

const handleDeleteKpi = async () => {
  // selectedKpiId hiện đang giữ key của assignment
  if (!selectedKpiId.value) return;

  loading.value = true;
  // assignmentError.value = null; // Có thể dùng biến lỗi khác hoặc dùng chung assignmentError

  try {
    // Bạn cần một action Vuex mới để gọi API xóa một assignment theo ID
    // Ví dụ: await store.dispatch("kpis/deleteKpiAssignment", selectedKpiId.value);
    // Giả định action này sẽ gọi DELETE /api/assignments/{assignmentId}

    // TODO: Implement deleteKpiAssignment action in your Vuex store
    console.log("Deleting assignment with key:", selectedKpiId.value);
    // Thay thế dòng console.log này bằng dispatch action thực tế:
    // await store.dispatch("kpis/deleteKpiAssignment", selectedKpiId.value);

    notification.success({
      message: `Gán KPI '${selectedKpiName.value}' đã được xóa thành công!`,
    });
    deletedKpiName.value = selectedKpiName.value; // Hiển thị tên KPI trong thông báo thành công

    // Làm mới danh sách sau khi xóa bằng cách gọi lại applyFilters
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
    isDeleteModalVisible.value = false; // Đóng modal
    selectedKpiId.value = null; // Reset key/ID đã chọn
    selectedKpiName.value = null; // Reset tên đã chọn
  }
};
// Gom nhóm theo DepartmentName và KPI
const departmentGroups = computed(() => {
  const groupedData = {};
  const displayData = departmentKpiList.value
    ? departmentKpiList.value.data
    : [];
  const allDepartments = store.getters["departments/departmentList"] || [];
  // Lấy Department ID hiện tại từ bộ lọc
  const currentFilterDepartmentId = localFilters.departmentId;

  // LOGs (có thể giữ hoặc xóa)
  console.log(
    "LOG 1: Dữ liệu gốc từ store (departmentKpiList.value):",
    departmentKpiList.value
  );
  console.log("LOG 2: Mảng dữ liệu KPI (displayData):", displayData);

  if (!displayData || displayData.length === 0) {
    console.log("LOG 3: displayData rỗng, trả về mảng gom nhóm rỗng");
    return [];
  }

  // Duyệt qua từng KPI nhận được từ backend
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

    // Duyệt qua từng assignment của KPI này
    kpi.assignments.forEach((assignment) => {
      // Xác định Department ID được gán cho assignment này
      const assignmentDepartmentId =
        assignment.assigned_to_department || assignment.section?.department_id;

      // Bỏ qua nếu không xác định được Department ID cho assignment
      if (!assignmentDepartmentId) {
        console.warn(
          "LOG (WARN): Assignment không xác định được Department ID:",
          assignment
        );
        return;
      }

      // *** BƯỚC LỌC MỚI ĐƯỢC THÊM ***
      // Nếu bộ lọc Department đang được chọn là một ID cụ thể (không phải "All"),
      // VÀ Department ID của assignment này KHÔNG khớp với Department ID đang lọc,
      // thì bỏ qua assignment này.
      if (currentFilterDepartmentId && currentFilterDepartmentId !== "") {
        // Chuyển Department ID từ bộ lọc sang kiểu số để so sánh chính xác
        const filterIdNumber = parseInt(currentFilterDepartmentId, 10);
        if (
          !isNaN(filterIdNumber) &&
          assignmentDepartmentId !== filterIdNumber
        ) {
          // Assignment này không thuộc department đang lọc, bỏ qua.
          console.log(
            `Đã bỏ qua assignment ${assignment.id} của KPI ${kpi.id}: Được gán tới Department ${assignmentDepartmentId}, Bộ lọc: ${currentFilterDepartmentId}`
          );
          return; // Dừng xử lý assignment này
        }
      }
      // *** KẾT THÚC BƯỚC LỌC MỚI ***

      // Nếu assignment vượt qua bước lọc (hoặc bộ lọc là "All"), tiếp tục xử lý:

      // Tìm thông tin Department từ danh sách tổng dựa trên assignmentDepartmentId
      const assignedDepartment = allDepartments.find(
        (d) => d.id === assignmentDepartmentId
      );

      // Bỏ qua nếu không tìm thấy Department trong danh sách tổng (dữ liệu không đồng bộ)
      if (!assignedDepartment) {
        console.warn(
          `LOG (WARN): Không tìm thấy thông tin Department ID ${assignmentDepartmentId} trong danh sách department:`,
          assignment
        );
        return;
      }

      const departmentName = assignedDepartment.name; // Tên Department từ danh sách tổng
      const perspectiveKey = `${kpiDetails.perspectiveId}. ${kpiDetails.perspectiveName}`; // Key cho perspective

      // Gom nhóm theo Department ID
      if (!groupedData[assignmentDepartmentId]) {
        groupedData[assignmentDepartmentId] = {
          department: departmentName, // Tên Department
          data: {}, // Map con cho perspective
        };
      }

      // Gom nhóm theo perspective
      if (!groupedData[assignmentDepartmentId].data[perspectiveKey]) {
        groupedData[assignmentDepartmentId].data[perspectiveKey] = []; // Mảng chứa các dòng assignment
      }

      // Xác định chuỗi hiển thị cho cột 'Assigned To' (giữ nguyên logic)
      let assignToDisplay = departmentName;
      if (assignment.assigned_to_section && assignment.section) {
        assignToDisplay = assignment.section.name;
        // Tùy chọn kết hợp: assignToDisplay = `${departmentName} - ${assignment.section.name}`;
      } else if (assignment.assigned_to_employee && assignment.employee) {
        assignToDisplay = assignment.employee.name;
      }

      // Tạo đối tượng dữ liệu cho dòng (assignment) (giữ nguyên logic)
      const rowData = {
        key: `assignment-${assignment.id}`, // Key là assignment ID
        kpiId: kpiDetails.kpiId, // ID KPI gốc
        kpiName: kpiDetails.kpiName, // Tên KPI gốc
        perspectiveName: kpiDetails.perspectiveName, // Tên Perspective
        assignTo: assignToDisplay, // Chuỗi "Assigned To"
        startDate: kpiDetails.kpiStartDate,
        endDate: kpiDetails.kpiEndDate,
        weight: kpiDetails.kpiWeight,
        target: assignment.targetValue || "0", // Target assignment
        actual:
          assignment.kpiValues && assignment.kpiValues.length > 0
            ? assignment.kpiValues[0].value || "0"
            : "0", // Actual assignment
        unit: kpiDetails.kpiUnit,
        status: assignment.status || "Unknown", // Status assignment
      };

      // Thêm dòng dữ liệu assignment vào nhóm phù hợp
      groupedData[assignmentDepartmentId].data[perspectiveKey].push(rowData);
    });
  });

  // LOG 4 (có thể giữ hoặc xóa)
  console.log("LOG 4: Dữ liệu đã gom nhóm (groupedData):", groupedData);

  // Chuyển đổi map gom nhóm thành mảng cuối cùng (giữ nguyên logic)
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

  // Sắp xếp department (tùy chọn) (giữ nguyên logic)
  finalGroupedArray.sort((a, b) => a.department.localeCompare(b.department));

  // LOG 5 (có thể giữ hoặc xóa)
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
    applyFilters(); // <--- Thêm dòng này
  } catch (err) {
    console.error("Failed to fetch departments:", err);
    notification.error({ message: "Failed to load department list." });
  }
});
</script>

<style scoped></style>
