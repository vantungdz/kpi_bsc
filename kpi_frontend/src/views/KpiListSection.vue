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
            <a-select v-model:value="localFilters.departmentId" style="width: 100%" @change="handleDepartmentChange">
              <a-select-option v-for="department in departmentList" :key="department.id" :value="department.id">
                {{ department.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item label="Section:">
            <a-select v-model:value="localFilters.sectionId" style="width: 100%">
              <a-select-option v-if="selectSectionList.length > 1" value="0">All</a-select-option>
              <a-select-option v-for="section in selectSectionList" :key="section.id" :value="section.id">
                {{ section.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item label="Start Date:">
            <a-date-picker v-model:value="startDate" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item label="End Date:">
            <a-date-picker v-model:value="endDate" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="7" style="text-align: right">
          <a-button type="primary" @click="applyFilters" :loading="loading">
            <template #icon><filter-outlined /></template>
            Apply
          </a-button>
          <a-button @click="resetFilters" :loading="loading" style="margin-left: 8px">
            <template #icon><reload-outlined /></template>
            Reset
          </a-button>
        </a-col>
      </a-row>
    </div>

    <div style="margin-top: 20px; margin-bottom: 20px">
      <h3 v-if="isDisplayResult" class="text-lg font-bold mb-2" style="border-bottom: 1px solid #ccc">
        {{
          `Department:
        ${selectedDepartmentName}`
        }}
      </h3>
      <a-alert v-if="loading" message="Loading KPIs..." type="info" show-icon>
        <template #icon>
          <a-spin />
        </template>
      </a-alert>
      <a-alert v-else-if="error" :message="error" type="error" show-icon closable />
      <a-alert v-else-if="isDisplayResult && resultKpiList && resultKpiList.length === 0"
        message="No KPIs found matching your criteria." type="warning" show-icon closable />
      <a-alert v-if="deletedKpiName" :message="`KPI '${deletedKpiName}' was deleted successfully!`" type="success"
        closable @close="deletedKpiName = null" show-icon />
    </div>

    <div v-if="isDisplayResult" class="data-container">
      <div v-for="(sectionGroup, sectionIndex) in sectionGroups" :key="sectionIndex" class="mb-8">
        <!-- Section Title -->
        <h4 class="text-lg font-bold mb-2" style="margin-top: 10px; margin-bottom: 10px">
          {{ sectionGroup.section }}
        </h4>
        <a-collapse v-model:activeKey="activePanelKeys" expandIconPosition="end">
          <a-collapse-panel v-for="(perspectiveGroup, perspectiveName) in sectionGroup.data" :key="perspectiveName"
            :header="perspectiveName">
            <!-- <h4 class="text-lg font-bold mb-2">{{ perspectiveName }}</h4> -->
            <!-- <span class="ant-collapse-header-text text-lg font-bold mb-2">{{ perspectiveName }}</span> -->

            <!-- KPI Table -->
            <a-table :columns="columns" :dataSource="tableData(perspectiveGroup)" :pagination="false"
              :rowClassName="rowClassName" rowKey="key" size="small" bordered>
              <template #bodyCell="{ column, record }">
                <!-- KPI Column with Donut Chart -->
                <template v-if="column.dataIndex === 'kpi'">
                  <div>
                    <span v-if="record.isParent">{{ record.kpiName }}</span>
                    <apexchart type="donut" width="80%" height="80" :options="{
                      chart: { height: 80, type: 'donut' },
                      labels: ['Actual', 'Remaining'],
                      plotOptions: {
                        pie: {
                          donut: {
                            thickness: '40px',
                          },
                        },
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
                    }" :series="[
                        parseFloat(record.actual) || 0,
                        Math.max(
                          parseFloat(record.target) - parseFloat(record.actual),
                          0
                        ),
                      ]" />
                  </div>
                </template>

                <!-- Assign To -->
                <template v-else-if="column.dataIndex === 'assignTo'">
                  <span>{{ record.assignTo }}</span>
                </template>

                <!-- Target -->
                <template v-else-if="column.dataIndex === 'target'">
                  <span>{{ `${record.target} ${record.unit}` }}</span>
                </template>

                <!-- Actual -->
                <template v-else-if="column.dataIndex === 'actual'">
                  <span>{{ `${record.actual} ${record.unit}` }}</span>
                </template>

                <!-- Status -->
                <template v-else-if="column.dataIndex === 'status'">
                  <a-tag :bordered="false" :color="getStatusColor(record.status)">
                    {{ record.status }}
                  </a-tag>
                </template>

                <!-- Actions -->
                <template v-else-if="column.dataIndex === 'action'">
                  <a-button type="default" class="kpi-actions-button" @click="
                    $router.push({
                      name: 'KpiDetail',
                      params: { id: record.kpiId },
                    })
                    ">
                    <schedule-outlined /> Details
                  </a-button>
                  <a-button danger class="kpi-actions-button"
                    @click="showConfirmDeleteDialog(record.kpiId, record.kpiName)">
                    <delete-outlined /> Delete
                  </a-button>
                </template>
              </template>
            </a-table>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </div>

    <a-modal danger v-model:open="isDeleteModalVisible" title="Confirm Dialog" @ok="handleDeleteKpi"
      @cancel="isDeleteModalVisible = false">
      <p>Are you sure to delete "{{ selectedKpiName }}"?</p>
    </a-modal>
  </div>
</template>

<script setup>

import { reactive, computed, onMounted, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router' 
import { PlusOutlined, FilterOutlined, ReloadOutlined, ScheduleOutlined, DeleteOutlined } from '@ant-design/icons-vue';
import { notification } from 'ant-design-vue';

// --- Store  ---
const store = useStore();
const router = useRouter()
const route = useRoute();

const loading = computed(() => store.getters["kpis/isLoading"]);
const error = computed(() => store.getters["kpis/error"]);
const departmentList = computed(() => store.getters["departments/departmentList"] || []);
const departmentKpiList = computed(
  () => store.getters["departments/departmentKpiList"] || []
);
const sectionList = computed(() => store.getters["sections/sectionList"] || []);
const sectionKpiList = computed(() => store.getters["kpis/sectionKpiList"] || []);

const creationScope = computed(() => route.query.scope || "section"); 
const selectSectionList = ref([]);

const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);

const isDisplayResult = ref(false);
const resultKpiList = ref([]);
const selectedDepartmentName = ref(null);

const activePanelKeys = ref([]);

// Columns
const columns = [
  {
    title: "KPI Name",
    dataIndex: "kpi",
    key: "kpi",
    customCell: (record) => {
      if (record.isParent) {
        return {
          rowSpan: record.childCount + 1,
        };
      } else {
        return {
          rowSpan: 0,
        };
      }
    },
    width: "15%",
  },
  {
    title: "Assign To",
    dataIndex: "assignTo",
    key: "assignTo",
    width: "12%",
  },
  { title: "Start Date", dataIndex: "startDate", key: "startDate", width: "10%" },
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
    width: "11%",
  },
  {
    title: "Action",
    dataIndex: "action",
    key: "action",
    width: "12%",
    rowClassName: "action-column-cell",
  },
];

const localFilters = reactive({
  name: "",
  departmentId: 1,
  sectionId: 0,
  startDate: "",
  endDate: "",
});

const resetFilters = () => {
  console.log("resetFilters");
  localFilters.name = "";
  localFilters.departmentId = 1;
  localFilters.sectionId = "";
  localFilters.startDate = "";
  localFilters.endDate = "";
  applyFilters();
};

const handleDepartmentChange = async () => {
  try {
    if (localFilters.departmentId) {
      await store.dispatch("sections/fetchSections", {
        department_id: localFilters.departmentId,
      });
    } else {
      await store.dispatch("sections/fetchSections");
    }
  } catch (err) {
    error.value = err.message || "Failed to fetch items";
  } finally {
    selectSectionList.value = sectionList.value;
    // Set default value
    if (selectSectionList.value.length === 1) {
      localFilters.sectionId = selectSectionList.value[0].id;
    } else {
      localFilters.sectionId = "";
    }
  }
};

const applyFilters = async () => {
  try {
    isDisplayResult.value = false;

    if (localFilters.sectionId) {
      console.log("applyFilters: kpis/fetchSectionKpiList", localFilters.sectionId);
      await store.dispatch("kpis/fetchSectionKpis", localFilters.sectionId);
    }
  } catch (err) {
    error.value = err.message || "Failed to fetch items";
  } finally {
    loading.value = false;
    console.log("sectionKpiList.value", sectionKpiList.value);
    console.log("departmentKpiList.value", departmentKpiList.value);
    resultKpiList.value = localFilters.sectionId
      ? sectionKpiList.value
      : departmentKpiList.value;
    isDisplayResult.value = true;
  }
};

const tableData = (perspectiveGroup) => {
  return Object.values(perspectiveGroup).flat();
};

const goToCreateKpi = () => {
   // Lấy ID của section đang được chọn trong filter
   // Hoặc lấy ID section của người dùng hiện tại nếu trang này là trang cá nhân của Section đó
  const targetSectionId = localFilters.value; // Giả định bạn lấy từ filter

   if (!targetSectionId && creationScope.value === 'section') {
       // Thêm kiểm tra nếu ID không có khi scope là section
        console.warn("Cannot navigate to create KPI: Section ID is not selected.");
        notification.warning({ message: "Please select a Section to create a KPI for." });
        return;
   }

  router.push({
    name: 'KpiCreate', // Đảm bảo tên route 'KpiCreate' là đúng
    query: {
      scope: 'section', // Đặt scope là 'section'
      sectionId: targetSectionId // Truyền sectionId được chọn
    }
  });
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
      applyFilters(); // Tải lại trang hiện tại sau khi xóa
      deletedKpiName.value = selectedKpiName.value;
      isDeleteModalVisible.value = false;
      selectedKpiId.value = "";
      selectedKpiName.value = "";
    })
    .catch((err) => {
      alert(`Delete failed KPI: ${store.getters["kpis/error"] || "Unknown error"}`);
      console.error("Delete KPI error:", err);
    });
};

const getSectionName = () => {
  const targetItem =
    sectionList.value && localFilters.sectionId
      ? sectionList.value.find((item) => item.id === localFilters.sectionId)
      : null;
  return targetItem ? targetItem.name : "";
};

// Gom nhóm theo Section và KPI
const sectionGroups = computed(() => {
  const map = {};

  const displayData = resultKpiList.value ? resultKpiList.value : [];
  console.log("displayData", displayData);

  if (!displayData || displayData.length === 0) return [];

  let perspectiveKey = "";
  let assignToCount = 0;
  let totalActual = 0;

  const sectionName = getSectionName();

  displayData.forEach((sectionItem) => {
    if (!sectionItem) return;

    const perspectiveName = sectionItem.perspective ? sectionItem.perspective.name : "";
    const currPerspectiveKey = `${sectionItem.perspective_id}. ${perspectiveName}`;
    const kpiName = sectionItem ? sectionItem.name : "No Department";

    if (perspectiveKey !== currPerspectiveKey) {
      perspectiveKey = currPerspectiveKey;
      map[perspectiveKey] = [];
    }

    if (!map[perspectiveKey][kpiName]) {
      map[perspectiveKey][kpiName] = [];
    }

    assignToCount = sectionItem.assignments ? sectionItem.assignments.length : 0;

    map[perspectiveKey][kpiName].push({
      key: `parent-${perspectiveKey}-${kpiName}`,
      perspectiveName: perspectiveName,
      kpiId: sectionItem.id,
      kpiName: sectionItem.name,
      assignTo: `Total: ${assignToCount}`,
      startDate: sectionItem.start_date,
      endDate: sectionItem.end_date,
      target: sectionItem.target,
      actual: totalActual,
      unit: sectionItem.unit || "",
      status: sectionItem.status,
      isParent: true,
      childCount: assignToCount,
    });

    sectionItem.assignments?.forEach((kpiItem) => {
      if (!kpiItem) return;
      map[perspectiveKey][kpiName].push({
        key: `child-${perspectiveKey}-${kpiName}`,
        kpiId: kpiItem.id,
        assignTo: kpiItem.section ? kpiItem.section.name : "",
        startDate: sectionItem.start_date,
        endDate: sectionItem.end_date,
        target: kpiItem.target || "0",
        actual:
          kpiItem.values && kpiItem.values.length > 0 ? kpiItem.values[0].value : "0",
        unit: sectionItem.unit || "",
        status: kpiItem.status,
        isParent: false,
      });
    });
  });
  console.log("sectionGroups", [{ section: sectionName, data: map }]);

  return [{ section: sectionName, data: map }];
});

const rowClassName = (record) => {
  return record.isParent ? "row-parent" : "";
};

const getStatusColor = (status) => {
  return status === "Active" ? "success" : "red";
};

// --- Watcher to set all keys active ---
watch(
  sectionGroups,
  (newGroups) => {
    if (newGroups && typeof newGroups === "object") {
      const allKeys = Object.keys(newGroups);
      // Update the activePanelKeys ref with ALL the keys from the data
      activePanelKeys.value = allKeys;
    } else {
      activePanelKeys.value = []; // Clear if no groups
    }
  },
  {
    immediate: true, // Run once immediately on component setup
  }
);

onMounted(async () => {
  try {
    console.log("onMounted: departments/fetchDepartments");

    await store.dispatch("departments/fetchDepartments");
  } catch (err) {
    error.value = err.message || "Failed to fetch items";
  } finally {
    // set init data
    handleDepartmentChange();
    // applyFilters();
  }
});
</script>

<style scoped></style>
