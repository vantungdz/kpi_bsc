<template>
  <div class="kpi-review-approval">
    <a-table
      :columns="columns"
      :data-source="reviews"
      :row-key="'id'"
      bordered
      size="small"
      :loading="isLoading"
    >
      <template #actions="{ record }">
        <a-space>
          <a-button
            type="primary"
            size="small"
            @click="approveReview(record.id)"
            :loading="isProcessing && currentActionItemId === record.id"
            :disabled="!canApprove || (isProcessing && currentActionItemId !== record.id)"
          >
            {{ $t("approve") }}
          </a-button>
          <a-button
            danger
            size="small"
            @click="rejectReview(record.id)"
            :loading="isProcessing && currentActionItemId === record.id"
            :disabled="!canReject || (isProcessing && currentActionItemId !== record.id)"
          >
            {{ $t("reject") }}
          </a-button>
        </a-space>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";
import { notification } from "ant-design-vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

const store = useStore();
const reviews = ref([]);
const isLoading = ref(false);
const isProcessing = ref(false);
const currentActionItemId = ref(null);

// Lấy effectiveRole từ store RBAC entity
const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);

// RBAC entity: lấy permission động
const userPermissions = computed(() => store.getters["auth/user"]?.permissions || []);
function hasPermission(action, resource) {
  return userPermissions.value?.some(
    (p) => p.action?.trim() === action && p.resource?.trim() === resource
  );
}
const canApprove = computed(() => hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_REVIEW));
const canReject = computed(() => hasPermission(RBAC_ACTIONS.REJECT, RBAC_RESOURCES.KPI_REVIEW));

const columns = [
  { title: "Review ID", dataIndex: "id", key: "id" },
  { title: "Reviewer", dataIndex: "reviewer", key: "reviewer" },
  { title: "Status", dataIndex: "status", key: "status" },
  { title: "Actions", key: "actions", slots: { customRender: "actions" } },
];

const fetchReviews = async () => {
  isLoading.value = true;
  try {
    const data = await store.dispatch("kpiReviews/fetchPendingReviews");
    reviews.value = data || [];
  } catch (error) {
    notification.error({ message: "Error fetching reviews" });
  } finally {
    isLoading.value = false;
  }
};

const approveReview = async (id) => {
  isProcessing.value = true;
  currentActionItemId.value = id;
  try {
    await store.dispatch("kpiReviews/approveReview", id);
    notification.success({ message: "Review approved successfully" });
    fetchReviews();
  } catch (error) {
    notification.error({ message: "Error approving review" });
  } finally {
    isProcessing.value = false;
    currentActionItemId.value = null;
  }
};

const rejectReview = async (id) => {
  isProcessing.value = true;
  currentActionItemId.value = id;
  try {
    await store.dispatch("kpiReviews/rejectReview", id);
    notification.success({ message: "Review rejected successfully" });
    fetchReviews();
  } catch (error) {
    notification.error({ message: "Error rejecting review" });
  } finally {
    isProcessing.value = false;
    currentActionItemId.value = null;
  }
};

onMounted(() => {
  fetchReviews();
});
</script>

<style scoped>
.kpi-review-approval {
  padding: 16px;
}
</style>
