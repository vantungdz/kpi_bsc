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
            <a-select v-model:value="localFilters.departmentId" style="width: 100%">
              <a-select-option value="">All</a-select-option>
              <a-select-option v-for="department in departmentList" :key="department.id" :value="department.id">
                {{ department.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item label="Start Date:">
            <a-date-picker v-model:value="localFilters.startDate" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item label="End Date:">
            <a-date-picker v-model:value="localFilters.endDate" style="width: 100%" />
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
        <template #icon>
          <a-spin />
        </template>
      </a-alert>
      <a-alert v-else-if="error" type="error" :message="error" show-icon closable />
      <a-alert v-else-if="isDisplayResult && departmentKpiList.value?.length === 0" type="warning"
        message="No KPIs found matching your criteria." show-icon closable />
      <a-alert v-if="deletedKpiName" type="success" :message="`KPI '${deletedKpiName}' was deleted successfully!`"
        show-icon closable @close="deletedKpiName = null" />
    </div>

    <div class="data-container">
      <div v-for="(departmentItem, departmentIndex) in departmentGroups" :key="departmentIndex" class="mb-8">
        {{ console.log("departmentGroup", departmentItem.department) }}
        <h4 style="margin-top: 10px" class="text-lg font-bold mb-2">
          {{ `Department: ${departmentItem.department}` }}
        </h4>
        {{ console.log("departmentItem", departmentItem, departmentIndex) }}

        <a-collapse v-model:activeKey="activePanelKeys" expandIconPosition="end">
          <a-collapse-panel v-for="(perspectiveGroup, perspectiveIndex) in departmentItem.data" :key="perspectiveIndex"
            :header="perspectiveIndex">
            {{ console.log("perspectiveGroup", perspectiveGroup) }}
            <a-table :columns="columns" :dataSource="tableData(perspectiveGroup)" :pagination="false"
              :rowClassName="rowClassName" rowKey="key" size="small" bordered>
              {{ console.log("columns", columns) }}
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'kpiName'">
                  <div style="
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      height: 100px;
                      width: 100%;
                    ">
                    <span v-if="record.isParent">{{ record.kpiName }}</span>
                  </div>
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
                      Math.max(parseFloat(record.target) - parseFloat(record.actual), 0),
                    ]" />
                </template>

                <template v-else-if="column.dataIndex === 'assignTo'">
                  <span>{{ record.assignTo }}</span>
                </template>

                <template v-else-if="column.dataIndex === 'target'">
                  <span>{{ `${record.target} ${record.unit}` }}</span>
                  <a-progress v-if="record.target && record.isParent" :percent="record.targetPercent" size="small"
                    style="display: block; margin-top: 4px;" />
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

        <a-modal danger v-model:open="isDeleteModalVisible" title="Confirm Dialog" @ok="handleDeleteKpi"
          @cancel="isDeleteModalVisible = false">
          <p>Are you sure to delete "{{ selectedKpiName }}"?</p>
        </a-modal>
      </div>
    </div>

    <router-view></router-view>
  </div>
</template>

<script setup>

import { reactive, computed, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router' 
import { PlusOutlined, FilterOutlined, ReloadOutlined, ScheduleOutlined, DeleteOutlined } from '@ant-design/icons-vue';
import { notification } from 'ant-design-vue'; 

// --- Store  ---
const store = useStore();
const router = useRouter();

const loading = computed(() => store.getters['kpis/isLoading']);
const error = computed(() => store.getters['kpis/error']);
const departmentList = computed(() => store.getters['departments/departmentList'] || []);
const departmentKpiList = computed(() => store.getters['kpis/departmentKpiList'] || []);

const resultKpiList = ref([]);
// const departmentId = ref('');

const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
const isDisplayResult = ref(false);

// --- Local State for Filters & Sorting ---
const localFilters = reactive({
  name: '',
  departmentId: '',
  status: '',
  startDate: '',
  endDate: '',
});

// Columns
const columns = [
  {
    title: 'KPI Name',
    dataIndex: 'kpiName',
    key: 'kpiName',
    customCell: (record) => {
      if (record.isParent) {
        return {
          rowSpan: record.childCount + 1, // Mục tiêu + số dòng thành viên
        };
      } else {
        return {
          rowSpan: 0,
        };
      }
    },
    width: '15%',
  },
  {
    title: 'Current Progress',
    dataIndex: 'chart',
    key: 'chart',
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
    width: '10%',
  },
  {
    title: 'Assigned To',
    dataIndex: 'assignTo',
    key: 'assignTo',
    width: '10%',
  },
  { title: 'Start Date', dataIndex: 'startDate', key: 'startDate', width: '7%' },
  { title: 'End Date', dataIndex: 'endDate', key: 'endDate', width: '7%' },
  { title: 'Weight', dataIndex: 'weight', key: 'weight', width: '7%' },
  {
    title: 'Target',
    dataIndex: 'target',
    key: 'target',
    width: '7%',
  },
  {
    title: 'Actual',
    dataIndex: 'actual',
    key: 'actual',
    width: '7%',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: '7%',
  },
  {
    title: 'Action',
    dataIndex: 'action',
    key: 'action',
    width: '10%',
    rowClassName: 'action-column-cell',
  },
];

const tableData = (perspectiveGroup) => {
  return Object.values(perspectiveGroup).flat();
}

const goToCreateKpi = () => {
  // Lấy ID của department đang được chọn trong filter dropdown
  const targetDepartmentId = localFilters.departmentId;

  // Kiểm tra xem người dùng đã chọn một Department cụ thể chưa
  if (!targetDepartmentId) {
    notification.warning({ message: "Please select a Department to create a KPI for." });
    return;
  }

  // Điều hướng đến route KpiCreateDepartment và truyền departmentId qua route params
  router.push({
    name: 'KpiCreateDepartment', // Sử dụng tên route đã định nghĩa trong router/index.js
    params: {
      departmentId: targetDepartmentId
    }
    // Không cần truyền scope hay departmentId qua query nữa cho route này
  });
};


const applyFilters = async () => {
  try {
    if (localFilters.departmentId) {
      await store.dispatch('kpis/fetchDepartmentKpis', localFilters.departmentId);
    }
  } catch (err) {
    error.value = err.message || 'Failed to fetch items';
  } finally {
    loading.value = false;
    console.log('departmentKpiList.value', departmentKpiList.value);
    resultKpiList.value = departmentKpiList.value;
    isDisplayResult.value = true;
  }
}

const showConfirmDeleteDialog = (id, name) => {
  isDeleteModalVisible.value = true;
  selectedKpiId.value = id;
  selectedKpiName.value = name;
};

// Gom nhóm theo DepartmentName và KPI
const departmentGroups = computed(() => {
  const map = {};

  const displayData = resultKpiList.value ? resultKpiList.value.data : [];
  console.log('displayData', displayData);

  if (!displayData || displayData.length === 0) return [];


  let perspectiveKey = '';
  let assignToCount = 0;
  let totalActual = 0;

  const departmentName = getDepartmentName();

  displayData.forEach((departmentItem) => {
    if (!departmentItem) return;

    const perspectiveName = departmentItem.perspective ? departmentItem.perspective.name : '';
    const currPerspectiveKey = `${departmentItem.perspective_id}. ${perspectiveName}`;
    const kpiName = departmentItem ? departmentItem.name : 'No Department';

    if (perspectiveKey !== currPerspectiveKey) {
      perspectiveKey = currPerspectiveKey;
      map[perspectiveKey] = [];

    }

    if (!map[perspectiveKey][kpiName]) {
      map[perspectiveKey][kpiName] = [];
    }

    assignToCount = departmentItem.assignments ? departmentItem.assignments.length : 0;
    const totalTarget = getTotalTarget(departmentItem.assignments || []);
    const percentageAssigned = departmentItem.target && Number(departmentItem.target) !== 0
      ? (totalTarget / Number(departmentItem.target)) * 100
      : 0; // Tránh chia cho 0
    const finalTargetPercent = Math.min(percentageAssigned, 100);

    map[perspectiveKey][kpiName].push({
      key: `parent-${perspectiveKey}-${kpiName}`,
      perspectiveName: perspectiveName,
      kpiId: departmentItem.id,
      kpiName: departmentItem.name,
      assignTo: `Total assignTos: ${assignToCount}`,
      startDate: departmentItem.start_date,
      endDate: departmentItem.end_date,
      target: departmentItem.target,
      actual: totalActual,
      unit: departmentItem.unit || '',
      status: departmentItem.status,
      isParent: true,
      childCount: assignToCount,
      targetPercent: finalTargetPercent, // parseFloat(Number(departmentItem.target) !== 0 ? Math.min((totalTarget + 20) / Number(departmentItem.target), 100).toFixed(2) : 0.00),
    });

    departmentItem.assignments?.forEach((kpiItem) => {
      if (!kpiItem) return;
      map[perspectiveKey][kpiName].push({
        key: `child-${perspectiveKey}-${kpiName}`,
        kpiId: kpiItem.id,
        assignTo: kpiItem.section ? kpiItem.section.name : '',
        startDate: departmentItem.start_date,
        endDate: departmentItem.end_date,
        target: kpiItem.targetValue || '0',
        actual: kpiItem.values && kpiItem.values.length > 0 ? kpiItem.values[0].value : '0',
        unit: departmentItem.unit || '',
        status: kpiItem.status,
        isParent: false,
      });
    });
  });
  return [{ department: departmentName, data: map }];
});

const getTotalTarget = (data) => {
  let result = 0;
  if (!data || data.length === 0) return 0;
  data.forEach((item) => {
    const target = Number(item.targetValue); // Lấy targetValue từ mỗi assignment con
    if (!isNaN(target)) {
      result = result + target;
    }
  });
  return result || 0;
};

const rowClassName = (record) => {
  return record.isParent ? 'row-parent' : '';
};

const getDepartmentName = () => {
  const targetItem = (departmentList.value && localFilters.departmentId) ? departmentList.value.find(item => item.id === localFilters.departmentId) : null;
  return targetItem ? targetItem.name : '';
};

const getStatusColor = (status) => {
  return status === 'Active' ? 'success' : 'red';
};

onMounted(async () => {
  try {
    await store.dispatch('departments/fetchDepartments');
  } catch (err) {
    error.value = err.message || 'Failed to fetch items';
  } finally {
    loading.value = false;
    isDisplayResult.value = true;
    console.log(resultKpiList.value);

  }
});
</script>

<style scoped></style>