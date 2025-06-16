<template>
  <div class="audit-log-view-modern">
    <a-card class="audit-header-card" bordered>
      <template #title>
        <span style="display:flex;align-items:center;gap:8px;">
          <file-search-outlined style="color:#2563eb;font-size:22px;" />
          <span>Audit Log</span>
        </span>
      </template>
      <a-form layout="inline" class="filter-bar-modern" @submit.prevent>
        <a-form-item>
          <a-input v-model:value="usernameFilter" placeholder="Username" allow-clear style="width:140px" />
        </a-form-item>
        <a-form-item>
          <a-input v-model:value="actionFilter" placeholder="Action" allow-clear style="width:120px" />
        </a-form-item>
        <a-form-item>
          <a-input v-model:value="resourceFilter" placeholder="Resource" allow-clear style="width:120px" />
        </a-form-item>
        <a-form-item>
          <a-date-picker v-model:value="fromDateFilter" placeholder="From date" style="width: 120px" />
        </a-form-item>
        <a-form-item>
          <a-date-picker v-model:value="toDateFilter" placeholder="To date" style="width: 120px" />
        </a-form-item>
      </a-form>
    </a-card>
    <a-card class="audit-table-card" bordered>
      <a-spin :spinning="loading">
        <a-table
          :dataSource="logs"
          :columns="columns"
          rowKey="id"
          :pagination="{ pageSize: 10 }"
          :scroll="{ x: 900 }"
          bordered
          class="audit-table-modern"
          :locale="{emptyText: error ? error : 'No logs found.'}"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'createdAt'">
              <span class="audit-date">{{ formatDate(record.createdAt) }}</span>
            </template>
            <template v-else-if="column.dataIndex === 'data'">
              <a-button type="link" size="small" @click="showDetail(record)">
                <eye-outlined /> View
              </a-button>
            </template>
            <template v-else-if="column.dataIndex === 'username'">
              <span class="audit-user">{{ record.username || record.userId || '-' }}</span>
            </template>
            <template v-else>
              <span>{{ record[column.dataIndex] }}</span>
            </template>
          </template>
        </a-table>
      </a-spin>
    </a-card>
    <a-modal v-model:visible="detailVisible" title="Log Detail" width="600px" :footer="null" @cancel="() => detailVisible = false" class="audit-modal-modern">
      <div class="modal-header-modern">
        <file-text-outlined style="color:#2563eb;font-size:20px;margin-right:8px;" />
        <span style="font-weight:600;font-size:17px;">Log Detail</span>
      </div>
      <a-typography-paragraph copyable style="max-height:60vh;overflow:auto;white-space:pre-wrap;background:#f6f8fa;padding:16px;border-radius:8px;">
        <pre>{{ prettyDetail }}</pre>
      </a-typography-paragraph>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';
import dayjs from 'dayjs';
import { FileSearchOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons-vue';

const store = useStore();

const usernameFilter = ref('');
const actionFilter = ref('');
const resourceFilter = ref('');
const fromDateFilter = ref('');
const toDateFilter = ref('');

const detailVisible = ref(false);
const prettyDetail = ref('');

const columns = computed(() => [
  { title: 'Date', dataIndex: 'createdAt', width: 170 },
  { title: 'User', dataIndex: 'username', width: 120 },
  { title: 'Action', dataIndex: 'action', width: 100 },
  { title: 'Resource', dataIndex: 'resource', width: 120 },
  { title: 'Data', dataIndex: 'data', width: 300 },
]);

const logs = computed(() => store.state.auditLog.logs);
const loading = computed(() => store.state.auditLog.loading);
const error = computed(() => store.state.auditLog.error);

const filters = computed(() => ({
  username: usernameFilter.value,
  action: actionFilter.value,
  resource: resourceFilter.value,
  fromDate: fromDateFilter.value,
  toDate: toDateFilter.value,
}));

function fetchLogs() {
  const payload = { ...filters.value };
  // Normalize filter values: trim and convert empty string to undefined
  Object.keys(payload).forEach((key) => {
    if (typeof payload[key] === 'string') {
      payload[key] = payload[key].trim();
      if (payload[key] === '') payload[key] = undefined;
    }
  });
  if (payload.fromDate) payload.fromDate = dayjs(payload.fromDate).format('YYYY-MM-DD');
  if (payload.toDate) payload.toDate = dayjs(payload.toDate).format('YYYY-MM-DD');
  store.dispatch('auditLog/fetchAuditLogs', payload);
}

function formatDate(date) {
  if (!date) return '';
  return dayjs(date).format('M/D/YYYY, h:mm:ss A');
}

function showDetail(record) {
  prettyDetail.value = typeof record.data === 'string' ? record.data : JSON.stringify(record.data, null, 2);
  detailVisible.value = true;
}

// Xử lý chuyển đổi fromDate/toDate thành string khi người dùng chọn ngày
watch([usernameFilter, actionFilter, resourceFilter, fromDateFilter, toDateFilter], () => {
  fetchLogs();
});

onMounted(() => {
  fetchLogs();
});
</script>

<style scoped>
.audit-log-view-modern {
  padding: 24px;
  background: #f6f8fa;
  min-height: 100vh;
}
.audit-header-card {
  margin-bottom: 18px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.filter-bar-modern {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 0;
}
.audit-table-card {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.audit-table-modern .ant-table-thead > tr > th {
  background: #f1f5f9;
  font-weight: 600;
  font-size: 15px;
  color: #334155;
  border-bottom: 1.5px solid #e5e7eb;
}
.audit-table-modern .ant-table-tbody > tr > td {
  font-size: 14px;
  color: #22223b;
  padding: 8px 12px;
}
.audit-date {
  color: #2563eb;
  font-weight: 500;
}
.audit-user {
  font-weight: 500;
  color: #0f172a;
}
.audit-modal-modern .ant-modal-content {
  border-radius: 14px;
  background: #f9fafb;
}
.modal-header-modern {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
</style>
