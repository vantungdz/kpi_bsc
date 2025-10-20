<template>
  <div class="notification-list-page">
    <div class="page-header">
      <h1>{{ $t("notifications") }}</h1>
      <div class="header-actions">
        <a-select
          v-model:value="filterType"
          style="width: 120px"
          @change="handleFilterChange"
        >
          <a-select-option value="all">{{ $t("all") }}</a-select-option>
          <a-select-option value="unread">{{ $t("unread") }}</a-select-option>
          <a-select-option value="read">{{ $t("read") }}</a-select-option>
        </a-select>
        <a-button
          v-if="unreadCount > 0"
          type="primary"
          @click="handleMarkAllAsRead"
          :loading="isProcessingMarkAll"
        >
          {{ $t("markAllAsRead") }}
        </a-button>
      </div>
    </div>

    <a-spin :spinning="isLoading" :tip="$t('loading')">
      <a-list
        v-if="notifications.length > 0"
        item-layout="horizontal"
        :data-source="notifications"
        :pagination="paginationConfig"
        @change="handlePageChange"
      >
        <template #renderItem="{ item }">
          <a-list-item
            :class="{ 'notification-unread': !item.is_read }"
            @click="handleNotificationClick(item)"
          >
            <a-list-item-meta>
              <template #title>
                <span class="notification-message">{{ item.message }}</span>
              </template>
              <template #description>
                <span class="notification-time">
                  {{ formatRelativeTime(item.created_at) }}
                </span>
              </template>
              <template #avatar>
                <a-avatar
                  :style="{
                    backgroundColor: getNotificationIconColor(item.type),
                  }"
                >
                  <template #icon>
                    <bell-outlined v-if="!item.type" />
                    <profile-outlined
                      v-if="item.type === 'NEW_KPI_ASSIGNMENT'"
                    />
                    <check-circle-outlined
                      v-if="item.type === 'KPI_APPROVAL_PENDING'"
                    />
                    <message-outlined
                      v-if="
                        item.type === 'REVIEW_PENDING_EMPLOYEE_FEEDBACK' ||
                        item.type === 'REVIEW_EMPLOYEE_RESPONDED'
                      "
                    />
                    <file-done-outlined
                      v-if="item.type === 'REVIEW_COMPLETED'"
                    />
                    <close-circle-outlined
                      v-if="item.type === 'KPI_VALUE_REJECTED'"
                      style="color: #ff4d4f"
                    />
                    <check-circle-outlined
                      v-if="item.type === 'KPI_VALUE_APPROVED'"
                      style="color: #52c41a"
                    />
                    <clock-circle-outlined
                      v-if="item.type === 'KPI_EXPIRY'"
                      style="color: #faad14"
                    />
                  </template>
                </a-avatar>
              </template>
            </a-list-item-meta>
            <template #actions>
              <a-tooltip :title="$t('markAsRead')" v-if="!item.is_read">
                <a-button
                  type="text"
                  shape="circle"
                  size="small"
                  @click.stop="handleMarkAsRead(item.id)"
                  :loading="isProcessingMarkOne && currentMarkingId === item.id"
                >
                  <eye-outlined />
                </a-button>
              </a-tooltip>
              <a-tooltip :title="$t('delete')">
                <a-button
                  type="text"
                  shape="circle"
                  size="small"
                  danger
                  @click.stop="handleDeleteNotification(item.id)"
                  :loading="isProcessingDelete && currentDeletingId === item.id"
                >
                  <delete-outlined />
                </a-button>
              </a-tooltip>
            </template>
          </a-list-item>
        </template>
      </a-list>
      <a-empty
        v-if="!isLoading && notifications.length === 0"
        :description="$t('noNotifications')"
        style="padding: 40px 0"
      />
    </a-spin>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import {
  List as AList,
  ListItem as AListItem,
  ListItemMeta as AListItemMeta,
  Avatar as AAvatar,
  Button as AButton,
  Spin as ASpin,
  Empty as AEmpty,
  Tooltip as ATooltip,
  Select as ASelect,
  SelectOption as ASelectOption,
  notification as antNotification,
} from "ant-design-vue";
import {
  BellOutlined,
  EyeOutlined,
  ProfileOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  FileDoneOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons-vue";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";

dayjs.extend(relativeTime);
dayjs.locale("vi");

const store = useStore();
const router = useRouter();

// Reactive state
const filterType = ref("all");
const currentPage = ref(1);
const pageSize = ref(10);
const isProcessingMarkOne = ref(false);
const isProcessingMarkAll = ref(false);
const isProcessingDelete = ref(false);
const currentMarkingId = ref(null);
const currentDeletingId = ref(null);

// Computed properties
const notifications = computed(() => {
  const allNotifications = store.getters["notifications/allNotifications"];
  if (filterType.value === "all") return allNotifications;
  if (filterType.value === "unread")
    return allNotifications.filter((n) => !n.is_read);
  if (filterType.value === "read")
    return allNotifications.filter((n) => n.is_read);
  return allNotifications;
});

const unreadCount = computed(
  () => store.getters["notifications/unreadNotificationCount"]
);

const isLoading = computed(
  () => store.getters["notifications/isLoadingNotifications"]
);

const totalNotifications = computed(
  () => store.getters["notifications/totalNotifications"] || 0
);

// Pagination configuration
const paginationConfig = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: totalNotifications.value,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
  pageSizeOptions: ["10", "20", "50", "100"],
}));

// Methods
const formatRelativeTime = (dateString) => {
  if (!dateString) return "";
  return dayjs(dateString).fromNow();
};

const getNotificationIconColor = (type) => {
  switch (type) {
    case "NEW_KPI_ASSIGNMENT":
      return "#1890ff";
    case "KPI_APPROVAL_PENDING":
      return "#faad14";
    case "REVIEW_PENDING_EMPLOYEE_FEEDBACK":
      return "#13c2c2";
    case "REVIEW_EMPLOYEE_RESPONDED":
      return "#52c41a";
    case "REVIEW_COMPLETED":
      return "#722ed1";
    case "KPI_EXPIRY":
      return "#faad14";
    default:
      return "#bfbfbf";
  }
};

const handleNotificationClick = async (notificationItem) => {
  if (!notificationItem.is_read) {
    await handleMarkAsRead(notificationItem.id);
  }

  // Navigate based on notification type (same logic as NotificationBell)
  const notificationType = notificationItem.type;

  if (!notificationType) {
    antNotification.warning({
      message: "Notification type not found.",
    });
    return;
  }

  switch (notificationType) {
    case "NEW_KPI_ASSIGNMENT":
    case "KPI_VALUE_APPROVED":
    case "KPI_VALUE_REJECTED":
    case "KPI_EXPIRY":
      router.push({ name: "KpiPersonal" });
      break;

    case "KPI_APPROVAL_PENDING":
    case "KPI_VALUE_SUBMITTED":
      router.push({ name: "PendingApprovals" });
      break;

    case "REVIEW_PENDING_EMPLOYEE_FEEDBACK":
    case "REVIEW_COMPLETED":
    case "REVIEW_REJECTED_BY_SECTION":
    case "REVIEW_REJECTED_BY_DEPARTMENT":
    case "REVIEW_REJECTED_BY_MANAGER":
      router.push({ name: "MyKpiSelfReview" });
      break;

    case "REVIEW_EMPLOYEE_RESPONDED":
    case "REVIEW_PENDING_SECTION_REVIEW":
    case "REVIEW_PENDING_DEPARTMENT_REVIEW":
    case "REVIEW_PENDING_MANAGER_REVIEW":
      router.push({ name: "KpiReviewList" });
      break;

    default:
      antNotification.info({
        message: `Navigation for notification type "${notificationType}" is not yet implemented.`,
      });
      break;
  }
};

const handleMarkAsRead = async (notificationId) => {
  if (!notificationId) return;
  isProcessingMarkOne.value = true;
  currentMarkingId.value = notificationId;
  try {
    await store.dispatch(
      "notifications/markNotificationAsRead",
      notificationId
    );
  } catch (error) {
    console.error("Error marking notification as read:", error);
  } finally {
    isProcessingMarkOne.value = false;
    currentMarkingId.value = null;
  }
};

const handleMarkAllAsRead = async () => {
  isProcessingMarkAll.value = true;
  try {
    await store.dispatch("notifications/markAllNotificationsAsRead");
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  } finally {
    isProcessingMarkAll.value = false;
  }
};

const handleDeleteNotification = async (notificationId) => {
  if (!notificationId) return;
  isProcessingDelete.value = true;
  currentDeletingId.value = notificationId;
  try {
    await store.dispatch("notifications/deleteNotification", notificationId);
  } catch (error) {
    console.error("Error deleting notification:", error);
  } finally {
    isProcessingDelete.value = false;
    currentDeletingId.value = null;
  }
};

const handleFilterChange = () => {
  currentPage.value = 1;
  // Filter is handled by computed property
};

const handlePageChange = (page, size) => {
  currentPage.value = page;
  pageSize.value = size;
  fetchNotifications();
};

const fetchNotifications = async () => {
  try {
    await store.dispatch("notifications/fetchNotifications", {
      page: currentPage.value,
      limit: pageSize.value,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
  }
};

// Lifecycle
onMounted(() => {
  fetchNotifications();
});

// Watch for route changes to refresh notifications
watch(
  () => router.currentRoute.value.path,
  () => {
    if (router.currentRoute.value.name === "NotificationList") {
      fetchNotifications();
    }
  }
);
</script>

<style scoped>
.notification-list-page {
  padding: 24px;
  background: #fff;
  min-height: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.ant-list-item {
  cursor: pointer;
  transition: background-color 0.3s;
  border-radius: 6px;
  margin-bottom: 8px;
}

.ant-list-item:hover {
  background-color: #f0f2f5;
}

.notification-unread {
  background-color: #e6f7ff;
}

.notification-unread:hover {
  background-color: #d9f0ff;
}

.notification-message {
  font-weight: 500;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.notification-time {
  font-size: 12px;
  color: #888;
}

.ant-list-item-actions {
  opacity: 0;
  transition: opacity 0.3s;
}

.ant-list-item:hover .ant-list-item-actions {
  opacity: 1;
}

@media (max-width: 768px) {
  .notification-list-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
