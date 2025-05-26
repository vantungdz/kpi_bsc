<template>
  <a-modal
    :visible="visible"
    :title="$t('reviewHistoryTitle')"
    @cancel="$emit('close')"
    :footer="null"
    class="modern-modal"
  >
    <div v-if="loading" style="text-align:center; margin: 24px 0;">
      <a-spin />
      <div style="margin-top: 8px; color: #888;">{{ $t('loadingHistory') }}</div>
    </div>
    <div v-else-if="error" style="color: #ff4d4f; text-align:center; margin: 16px 0;">
      {{ error }}
    </div>
    <div v-else-if="filteredHistory.length">
      <a-timeline>
        <a-timeline-item v-for="item in filteredHistory" :key="item.id">
          <div class="history-item-box">
            <div class="history-row">
              <span class="history-label">{{ $t('reviewTime') }}:</span>
              <span>{{ formatDate(item.createdAt) }}</span>
            </div>
            <div class="history-row">
              <span class="history-label">{{ $t('reviewer') }}:</span>
              <span>{{ item.reviewerName || $t('notAvailable') }}</span>
            </div>
            <div class="history-row">
              <span class="history-label">{{ $t('score') }}:</span>
              <span class="history-score">{{ item.score ?? item.selfScore ?? '-' }}</span>
            </div>
            <div class="history-row">
              <span class="history-label">{{ $t('comment') }}:</span>
              <span>{{ item.comment || item.selfComment || '-' }}</span>
            </div>
            <div class="history-row">
              <span class="history-label">{{ $t('status') }}:</span>
              <span :class="['status-tag', (item.status || '').toLowerCase().replace(/_/g, '-')]"><!-- status tag with kebab-case for CSS -->
                {{ $t((item.status || '').toLowerCase()) }}
              </span>
            </div>
          </div>
        </a-timeline-item>
      </a-timeline>
    </div>
    <div v-else>
      <a-empty :description="$t('noReviewHistory')" />
    </div>
  </a-modal>
</template>

<script setup>
import { watch, ref, computed } from "vue";
import dayjs from "dayjs";
import { useI18n } from 'vue-i18n';
import { getKpiReviewHistory } from '@/core/services/kpiReviewApi';

const { t } = useI18n();
const props = defineProps({
  visible: Boolean,
  review: Object,
});
const history = ref([]);
const loading = ref(false);
const error = ref("");

function formatDate(date) {
  return date ? dayjs(date).format("YYYY-MM-DD HH:mm") : "";
}

const filteredHistory = computed(() =>
  (history.value || []).filter(item => (item.status || '').toUpperCase() !== 'PENDING')
);

watch(
  () => props.review,
  async (val) => {
    if (val && val.kpi && val.cycle) {
      loading.value = true;
      error.value = "";
      try {
        history.value = await getKpiReviewHistory(val);
      } catch (e) {
        error.value = t('errorLoadingHistory') + ': ' + (e?.message || e);
        history.value = [];
      } finally {
        loading.value = false;
      }
    } else {
      history.value = [];
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.history-item-box {
  background: #f9fafb;
  border-radius: 12px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.04);
  padding: 14px 18px 10px 18px;
  margin-bottom: 8px;
}
.history-row {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  font-size: 15px;
}
.history-label {
  min-width: 110px;
  color: #666;
  font-weight: 500;
  margin-right: 8px;
}
.history-score {
  color: #faad14;
  font-weight: 600;
  font-size: 16px;
}
.status-tag {
  display: inline-block;
  padding: 2px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  text-transform: capitalize;
}
.status-tag.department-reviewed {
  background: #722ed1;
}
.status-tag.section-reviewed {
  background: #1890ff;
}
.status-tag.self-reviewed {
  background: #fa8c16;
}
.status-tag.pending {
  background: #f59e42;
}
.status-tag.manager-reviewed {
  background: #409eff;
}
.status-tag.awaitingemployeefeedback, .status-tag.employee-feedback {
  background: #13c2c2;
}
.status-tag.completed {
  background: #52c41a;
}
.loading-container {
  text-align: center;
  padding: 20px;
}
.error-message {
  color: #ff4d4f;
  text-align: center;
  padding: 20px;
}
@media (max-width: 600px) {
  .history-item-box {
    padding: 10px 8px;
    font-size: 14px;
  }
  .history-row {
    font-size: 13px;
  }
}
</style>
