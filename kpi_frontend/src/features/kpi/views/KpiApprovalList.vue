<template>
  <div class="kpi-approval-container">
    <a-card
      :headStyle="{ background: '#e6f7ff', borderRadius: '8px 8px 0 0', border: 'none' }"
      :bodyStyle="{ padding: '16px', borderRadius: '0 0 8px 8px', background: '#fff' }"
      style="box-shadow:0 2px 8px #0001;border-radius:8px;"
    >
      <template #title>
        <audit-outlined style="margin-right: 8px; color: #1890ff; font-size: 24px" /><span style="font-size: 20px; font-weight: 600">{{ $t('kpiApprovalList') }}</span>
      </template>
      <template #extra>
        <a-space>
          <a-button @click="fetchPendingKpis" :loading="loading">
            <reload-outlined /> {{ $t('refresh') }}
          </a-button>
        </a-space>
      </template>

      <!-- Batch Action Buttons -->
      <div
        v-if="pendingKpis.length > 0"
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding: 12px;
          background: #f0f9ff;
          border-radius: 6px;
        "
      >
        <span style="color: #666; font-size: 14px;">
          {{ $t('selectedCount', { count: selectedKpiIds.size }) }}
        </span>
        <a-space>
          <a-button
            type="primary"
            :disabled="selectedKpiIds.size === 0"
            :loading="batchApproving"
            @click="handleBatchApprove"
          >
            <check-outlined />
            {{ $t('approveSelected', { count: selectedKpiIds.size }) }}
          </a-button>
        </a-space>
      </div>

      <a-table
        :columns="columns"
        :data-source="pendingKpis"
        :loading="loading || loadingReviewCycles"
        row-key="id"
        size="middle"
        bordered
        :pagination="{ pageSize: 10 }"
        class="kpi-approval-table"
        :scroll="{ x: 1200 }"
      >
        <template #headerCell="{ column }">
          <!-- Checkbox Header Column -->
          <template v-if="column.key === 'checkbox'">
            <div style="display: flex; justify-content: center; align-items: center;">
              <a-checkbox
                :checked="isAllSelected"
                :indeterminate="isIndeterminate"
                @change="(e) => toggleSelectAll(e.target.checked)"
              />
            </div>
          </template>
        </template>
        <template #bodyCell="{ column, record }">
          <!-- Checkbox Column -->
          <template v-if="column.key === 'checkbox'">
            <div style="display: flex; justify-content: center; align-items: center;">
              <a-checkbox
                :checked="selectedKpiIds.has(record.id)"
                @change="(e) => toggleKpiSelection(record.id, e.target.checked)"
              />
            </div>
          </template>

          <template v-else-if="column.key === 'name'">
            <a @click="goToDetail(record.id)" style="font-weight: 500; color: #1890ff;">
              {{ record.name }}
            </a>
          </template>

          <template v-else-if="column.key === 'target'">
            <div style="text-align:right;">
              {{ Number(record.target).toLocaleString() }}
              <span v-if="record.unit"> {{ record.unit }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'createdBy'">
            <a-avatar
              v-if="record.createdBy?.avatar"
              :src="record.createdBy.avatar"
              size="28"
              style="margin-right:8px;vertical-align:middle;"
            />
            <a-avatar
              v-else
              style="background:#f56a00;margin-right:8px;vertical-align:middle;"
              size="28"
            >
              {{ record.createdBy?.first_name?.[0] || '?' }}
            </a-avatar>
            <span style="vertical-align:middle;">
              {{ $getFullName(record.createdBy) }}
            </span>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            <span style="color:#888;">{{ formatDate(record.created_at) }}</span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag color="processing" style="font-weight:500;font-size:13px;">
              {{ $t('pendingApproval') }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'actions'">
            <div style="text-align:center;">
              <a-space>
                <a-button
                  type="primary"
                  size="small"
                  @click="handleApprove(record.id)"
                  :loading="approvingId === record.id"
                >
                  <check-outlined /> {{ $t('approve') }}
                </a-button>
                <a-button
                  size="small"
                  @click="goToDetail(record.id)"
                >
                  <eye-outlined /> {{ $t('viewDetail') }}
                </a-button>
              </a-space>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import dayjs from 'dayjs';
import {
  ReloadOutlined,
  CheckOutlined,
  EyeOutlined,
  AuditOutlined,
} from '@ant-design/icons-vue';
import { getReviewCycles } from '@/core/services/kpiReviewApi';
import {
  pickReviewCycleIdFromStore,
  syncLocalReviewCycleFromStore,
} from '@/core/composables/useReviewCycleGlobalSync';

const { t: $t } = useI18n();
const store = useStore();
const router = useRouter();
const loading = ref(false);
const loadingReviewCycles = ref(false);
const reviewCycles = ref([]);
/** Chu kỳ đang chọn (đồng bộ với header) — dùng để lọc API pending-approval */
const reviewCycleId = ref(null);
const approvingId = ref(null);
const batchApproving = ref(false);
const selectedKpiIds = ref(new Set());

const pendingKpis = computed(() => store.getters['kpis/pendingApprovalList'] || []);

const columns = computed(() => [
  { title: '', key: 'checkbox', width: 50, fixed: 'left', align: 'center' },
  { title: $t('kpiName'), dataIndex: 'name', key: 'name', width: 250 },
  { title: $t('unit'), dataIndex: 'unit', key: 'unit', width: 80 },
  { title: $t('target'), dataIndex: 'target', key: 'target', width: 120 },
  { title: $t('createdBy'), dataIndex: 'createdBy', key: 'createdBy', width: 180 },
  { title: $t('createdAt'), dataIndex: 'created_at', key: 'createdAt', width: 150 },
  { title: $t('status'), dataIndex: 'status', key: 'status', width: 120 },
  { title: $t('actions'), key: 'actions', width: 200, fixed: 'right' },
]);

const handleApprove = async (kpiId) => {
  approvingId.value = kpiId;
  try {
    await store.dispatch('kpis/approveKpi', kpiId);
    selectedKpiIds.value.delete(kpiId);
    await fetchPendingKpis();
  } catch (error) {
    console.error('Error approving KPI:', error);
  } finally {
    approvingId.value = null;
  }
};

const handleBatchApprove = async () => {
  if (selectedKpiIds.value.size === 0) {
    return;
  }

  batchApproving.value = true;
  try {
    const kpiIdsArray = Array.from(selectedKpiIds.value);
    await store.dispatch('kpis/batchApproveKpis', kpiIdsArray);
    selectedKpiIds.value.clear();
    await fetchPendingKpis();
  } catch (error) {
    console.error('Error batch approving KPIs:', error);
  } finally {
    batchApproving.value = false;
  }
};

const toggleSelectAll = (checked) => {
  if (checked) {
    pendingKpis.value.forEach((kpi) => {
      selectedKpiIds.value.add(kpi.id);
    });
  } else {
    selectedKpiIds.value.clear();
  }
};

const toggleKpiSelection = (kpiId, checked) => {
  if (checked) {
    selectedKpiIds.value.add(kpiId);
  } else {
    selectedKpiIds.value.delete(kpiId);
  }
};

const isAllSelected = computed(() => {
  if (pendingKpis.value.length === 0) return false;
  return pendingKpis.value.every((kpi) => selectedKpiIds.value.has(kpi.id));
});

const isIndeterminate = computed(() => {
  if (pendingKpis.value.length === 0) return false;
  const selectedCount = pendingKpis.value.filter((kpi) =>
    selectedKpiIds.value.has(kpi.id),
  ).length;
  return selectedCount > 0 && selectedCount < pendingKpis.value.length;
});

function buildPendingApprovalQueryParams() {
  const id = reviewCycleId.value;
  if (id == null || id === '') {
    return {};
  }
  const selectedCycle = reviewCycles.value.find(
    (c) =>
      String(c.id) === String(id) || Number(c.id) === Number(id),
  );
  if (!selectedCycle) {
    return {};
  }
  const start = selectedCycle.startDate || selectedCycle.start_date;
  const end = selectedCycle.endDate || selectedCycle.end_date;
  if (!start || !end) {
    return {};
  }
  return {
    start_date: dayjs(start).format('YYYY-MM-DD'),
    end_date: dayjs(end).format('YYYY-MM-DD'),
  };
}

const fetchPendingKpis = async () => {
  loading.value = true;
  try {
    const kpis = await store.dispatch(
      'kpis/fetchPendingApprovalKpis',
      buildPendingApprovalQueryParams(),
    );
    const allowed = new Set((kpis || []).map((k) => k.id));
    selectedKpiIds.value = new Set(
      [...selectedKpiIds.value].filter((kid) => allowed.has(kid)),
    );
  } catch (error) {
    console.error('Error fetching pending KPIs:', error);
  } finally {
    loading.value = false;
  }
};

syncLocalReviewCycleFromStore(store, {
  cyclesRef: reviewCycles,
  getLocalCycleId: () => reviewCycleId.value,
  setLocalCycleId: (id) => {
    reviewCycleId.value = id;
  },
  apply: fetchPendingKpis,
});

const fetchReviewCyclesAndPending = async () => {
  loadingReviewCycles.value = true;
  try {
    const cycles = await getReviewCycles();
    reviewCycles.value = cycles;
    const fromStore = pickReviewCycleIdFromStore(store, cycles);
    if (fromStore != null) {
      reviewCycleId.value = fromStore;
    }
    await fetchPendingKpis();
  } catch (e) {
    console.error('Error loading review cycles for KPI approval list:', e);
    await fetchPendingKpis();
  } finally {
    loadingReviewCycles.value = false;
  }
};

const goToDetail = (id) => {
  router.push({ name: 'KpiDetail', params: { id } });
};

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '';
}

onMounted(() => {
  fetchReviewCyclesAndPending();
});
</script>

<style scoped>
.kpi-approval-container {
  padding: 16px;
}

.kpi-approval-table :deep(.ant-table) {
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.kpi-approval-table :deep(.ant-table-thead > tr > th) {
  background: #e6f7ff;
  font-weight: 600;
  font-size: 15px;
  text-align: center;
  border-bottom: 1px solid #91d5ff;
}

.kpi-approval-table :deep(.ant-table-tbody > tr > td) {
  padding: 10px 8px;
  font-size: 14px;
  vertical-align: middle;
}

.kpi-approval-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f0f9ff;
}
</style>
