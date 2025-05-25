<template>
  <a-modal
    :visible="visible"
    title="Lịch sử đánh giá KPI"
    @cancel="$emit('close')"
    :footer="null"
  >
    <div v-if="history && history.length">
      <a-timeline>
        <a-timeline-item v-for="item in history" :key="item.id">
          <div><b>Thời gian:</b> {{ formatDate(item.createdAt) }}</div>
          <div><b>Người đánh giá:</b> {{ item.reviewerName || "N/A" }}</div>
          <div><b>Điểm:</b> {{ item.score ?? item.selfScore ?? "-" }}</div>
          <div>
            <b>Nhận xét:</b> {{ item.comment || item.selfComment || "-" }}
          </div>
          <div><b>Trạng thái:</b> {{ item.status }}</div>
        </a-timeline-item>
      </a-timeline>
    </div>
    <div v-else>
      <a-empty description="Không có lịch sử đánh giá" />
    </div>
  </a-modal>
</template>

<script setup>
import { watch, ref } from "vue";
import dayjs from "dayjs";

const props = defineProps({
  visible: Boolean,
  review: Object,
});
const history = ref([]);

function formatDate(date) {
  return date ? dayjs(date).format("YYYY-MM-DD HH:mm") : "";
}

watch(
  () => props.review,
  async (val) => {
    if (val && val.kpi && val.cycle) {
      // Gọi API lấy lịch sử review nếu cần, ở đây chỉ demo lấy từ review.history
      history.value = val.history || [];
    } else {
      history.value = [];
    }
  },
  { immediate: true }
);
</script>
