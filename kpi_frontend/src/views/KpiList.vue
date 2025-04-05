<template>
  <a-row>
    <a-col :span="22"></a-col>
    <a-col :span="2">
      <a-button type="primary" @click="$router.push('/kpi/create')" style="margin-bottom: 10px;">
        <plus-outlined /> Tạo KPI
      </a-button>
    </a-col>
  </a-row>

  <a-card title="Danh sách KPI">
    <a-skeleton :loading="loading" active>
      <a-table :columns="columns" :data-source="filteredKpis" row-key="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <a-tag :bordered="false" :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'action'">
            <a-space>
              <a-button type="link" @click="viewKpiDetail(record.id)">
                <eye-outlined /> Detail
              </a-button>
              <a-button type="link" danger @click="showDeleteModal(record.id)">
                <delete-outlined /> Delete
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-skeleton>
  </a-card>

  <a-modal v-model:visible="isDeleteModalVisible" title="Xác nhận xóa" @ok="confirmDelete" @cancel="isDeleteModalVisible = false">
    <p>Bạn có chắc chắn muốn xóa KPI này không?</p>
  </a-modal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { notification } from 'ant-design-vue';

const router = useRouter();
const store = useStore();
const searchTerm = ref('');
const filterStatus = ref('');
const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const loading = ref(true);

const columns = [
  { title: 'Tên KPI', dataIndex: 'name', key: 'name' },
  { title: 'Mô tả', dataIndex: 'description', key: 'description' },
  { title: 'Mục tiêu', dataIndex: 'target', key: 'target' },
  { title: 'Tần suất', dataIndex: 'frequency', key: 'frequency' },
  { title: 'Trọng số', dataIndex: 'weight', key: 'weight' },
  { title: 'Trạng thái', dataIndex: 'status', key: 'status' },
  { title: 'Hành động', dataIndex: 'action', key: 'action' }
];

const kpis = computed(() => store.getters.allKpis);

const filteredKpis = computed(() => {
  return kpis.value.filter(kpi => {
    return (
      (!searchTerm.value || kpi.name.toLowerCase().includes(searchTerm.value.toLowerCase())) &&
      (!filterStatus.value || kpi.status === filterStatus.value)
    );
  });
});

const getStatusColor = (status) => {
  return status === 'Active' ? 'success' : 'red';
};

const getStatusText = (status) => {
  return status === 'Active' ? 'Hoạt động' : 'Không hoạt động';
};

const viewKpiDetail = (id) => {
  router.push({ name: 'KpiDetail', params: { id } }); 
};

const showDeleteModal = (id) => {
  selectedKpiId.value = id;
  isDeleteModalVisible.value = true;
};

const confirmDelete = async () => {
  const success = await store.dispatch('deleteKpi', selectedKpiId.value);
  if (success) {
    notification.success({ message: "Xóa KPI thành công!" });
  } else {
    notification.error({ message: "Xóa KPI thất bại!" });
  }
  isDeleteModalVisible.value = false;
};

onMounted(async () => {
  await store.dispatch('fetchKpis');
  loading.value = false;
});
</script>
