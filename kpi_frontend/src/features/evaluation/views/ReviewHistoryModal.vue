<template>
  <a-modal
    :visible="visible"
    :title="$t('reviewHistoryTitle')"
    @cancel="$emit('close')"
    :footer="null"
    width="80%"
    wrap-class-name="kpi-review-modal"
    body-style="padding: 0; background: #f4f7fb; border-radius: 14px;"
    class="modern-modal"
  >
    <div v-if="loading" class="loading-container">
      <a-spin />
      <div class="loading-text">{{ $t('loadingHistory') }}</div>
    </div>
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    <div v-else-if="filteredHistory.length">
      <div class="history-list">
        <a-timeline>
          <a-timeline-item v-for="item in filteredHistory" :key="item.id">
            <div class="history-item-box pro" :class="statusClass(item.status)">
              <div class="history-section-title" :class="statusTitleClass(item.status)">
                {{ $t('statusReview.' + item.status.toLowerCase()) }}
              </div>
              <div class="history-row">
                <span class="history-label">{{ $t('reviewTime') }}:</span>
                <span class="history-value">{{ formatDate(item.createdAt) }}</span>
              </div>
              <div class="history-row">
                <span class="history-label">{{ $t('reviewer') }}:</span>
                <span class="history-value">{{ item.reviewerName || $t('notAvailable') }}</span>
              </div>
              <div class="history-row">
                <span class="history-label">{{ $t('score') }}:</span>
                <span class="history-score">{{ item.score ?? item.selfScore ?? '-' }}</span>
              </div>
              <div class="history-row">
                <span class="history-label">{{ $t('comment') }}:</span>
                <span class="history-value">{{ item.comment || item.selfComment || '-' }}</span>
              </div>
              <div v-if="item.rejectionReason" class="history-row">
                <span class="history-label rejection">{{ $t('rejectionReason') }}:</span>
                <span class="history-value rejection">{{ item.rejectionReason }}</span>
              </div>
            </div>
          </a-timeline-item>
        </a-timeline>
      </div>
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

function statusClass(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s.includes('section')) return 'section';
  if (s.includes('department')) return 'manager';
  if (s.includes('manager')) return 'manager';
  if (s.includes('self')) return 'self';
  if (s.includes('feedback')) return 'feedback';
  if (s.includes('completed')) return 'completed';
  return '';
}
function statusTitleClass(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s === 'self_reviewed') return 'self';
  if (s === 'section_reviewed' || s === 'section_rejected') return 'section';
  if (s === 'department_reviewed' || s === 'department_rejected') return 'department';
  if (s === 'manager_reviewed' || s === 'manager_rejected') return 'manager';
  if (s === 'employee_feedback') return 'feedback';
  if (s === 'completed') return 'completed';
  return '';
}

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
.kpi-review-modal .ant-modal-content {
  border-radius: 14px;
  background: #f4f7fb;
  box-shadow: 0 4px 18px #b3c6e022;
  max-width: 900px;
  min-width: 320px;
}
.history-list {
  padding: 24px 18px 12px 18px;
  background: #f4f7fb;
  border-radius: 14px;
}
.history-item-box.pro {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px #e6f7ff22;
  padding: 14px 18px 10px 18px;
  margin-bottom: 12px;
  border-left: 4px solid #eaf2fb;
  transition: border-color 0.2s;
}
.history-item-box.pro.self { border-left: 4px solid #409eff; }
.history-item-box.pro.section { border-left: 4px solid #13c2c2; }
.history-item-box.pro.department { border-left: 4px solid #1890ff; }
.history-item-box.pro.manager { border-left: 4px solid #722ed1; }
.history-item-box.pro.feedback { border-left: 4px solid #faad14; }
.history-item-box.pro.completed { border-left: 4px solid #52c41a; }
.history-section-title {
  font-weight: 700;
  margin-bottom: 6px;
  font-size: 15px;
  letter-spacing: 0.2px;
}
.history-section-title.self { color: #409eff; border-left: 3px solid #409eff; padding-left: 4px; }
.history-section-title.section { color: #13c2c2; border-left: 3px solid #13c2c2; padding-left: 4px; }
.history-section-title.department { color: #1890ff; border-left: 3px solid #1890ff; padding-left: 4px; }
.history-section-title.manager { color: #722ed1; border-left: 3px solid #722ed1; padding-left: 4px; }
.history-section-title.feedback { color: #faad14; border-left: 3px solid #faad14; padding-left: 4px; }
.history-section-title.completed { color: #52c41a; border-left: 3px solid #52c41a; padding-left: 4px; }
.history-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 6px;
  font-size: 15px;
}
.history-label {
  min-width: 110px;
  color: #666;
  font-weight: 500;
  margin-right: 8px;
}
.history-label.rejection {
  color: #ff4d4f;
}
.history-value.rejection {
  color: #ff4d4f;
}
.history-score {
  color: #faad14;
  font-weight: 600;
  font-size: 16px;
}
.loading-container {
  text-align: center;
  padding: 32px 0 24px 0;
}
.loading-text {
  margin-top: 8px;
  color: #888;
}
.error-message {
  color: #ff4d4f;
  text-align: center;
  padding: 20px;
}
@media (max-width: 600px) {
  .history-list {
    padding: 10px 4px 4px 4px;
  }
  .history-item-box.pro {
    padding: 10px 8px;
    font-size: 14px;
  }
  .history-row {
    font-size: 13px;
  }
  .history-label {
    min-width: 80px;
    font-size: 13px;
  }
}
</style>
