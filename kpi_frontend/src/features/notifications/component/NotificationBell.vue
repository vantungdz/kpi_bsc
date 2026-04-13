<template>
  <a-popover
    v-model:open="popoverVisible"
    trigger="click"
    placement="bottomRight"
    overlayClassName="notification-popover"
    :get-popup-container="(trigger) => trigger.parentElement"
  >
    <template #content>
      <div class="notification-panel">
        <div class="notification-header">
          <h3>{{ $t("notifications") }}</h3>
          <a-button
            v-if="unreadCount > 0"
            type="link"
            size="small"
            @click="handleMarkAllAsRead"
            :loading="isProcessingMarkAll"
          >
            {{ $t("markAllAsRead") }}
          </a-button>
        </div>
        <a-spin :spinning="isLoadingNotifications" :tip="$t('loading')">
          <a-list
            v-if="notifications.length > 0"
            item-layout="horizontal"
            :data-source="notifications"
            class="notification-list"
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
                      :loading="
                        isProcessingMarkOne && currentMarkingId === item.id
                      "
                    >
                      <eye-outlined />
                    </a-button>
                  </a-tooltip>
                </template>
              </a-list-item>
            </template>
          </a-list>
          <a-empty
            v-if="!isLoadingNotifications && notifications.length === 0"
            :description="$t('noNotifications')"
            style="padding: 20px 0"
          />
        </a-spin>
        <div class="notification-footer" v-if="notifications.length > 0">
          <a-button type="link" block @click="viewAllNotifications">
            {{ $t("viewAllNotifications") }}
          </a-button>
        </div>
      </div>
    </template>
    <a-badge
      :count="unreadCount"
      :overflow-count="99"
      class="notification-badge"
    >
      <bell-outlined style="font-size: 20px; cursor: pointer" />
    </a-badge>
  </a-popover>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import {
  Popover as APopover,
  Badge as ABadge,
  List as AList,
  ListItem as AListItem,
  ListItemMeta as AListItemMeta,
  Avatar as AAvatar,
  Button as AButton,
  Spin as ASpin,
  Empty as AEmpty,
  Tooltip as ATooltip,
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
} from "@ant-design/icons-vue";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
} from "@/core/services/socket";

dayjs.extend(relativeTime);
dayjs.locale("vi");

const store = useStore();
const router = useRouter();

const popoverVisible = ref(false);
const isProcessingMarkAll = ref(false);
const isProcessingMarkOne = ref(false);
const currentMarkingId = ref(null);

const notifications = computed(
  () => store.getters["notifications/allNotifications"]
);
const unreadCount = computed(
  () => store.getters["notifications/unreadNotificationCount"]
);
const isLoadingNotifications = computed(
  () => store.getters["notifications/isLoadingNotifications"]
);

onMounted(() => {
  store.dispatch("notifications/fetchUnreadCount");

  const userId = store.getters["auth/user"]?.id;
  if (!userId) {
    console.error(
      "Error: userId is undefined. Please check Vuex store or authentication state."
    );
  }

  const socket = connectNotificationSocket(userId);

  socket.on("connect", () => {
    console.log("WebSocket connected successfully");
  });

  socket.on("connect_error", (error) => {
    console.error("WebSocket connection error:", error);
  });

  socket.on("notification", (notification) => {
    store.dispatch("notifications/handleRealtimeNotification", notification);
  });
});

onUnmounted(() => {
  disconnectNotificationSocket();
});

watch(popoverVisible, (newValue) => {
  if (newValue && notifications.value.length === 0) {
    store.dispatch("notifications/fetchNotifications");
  }
});

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
    default:
      return "#bfbfbf";
  }
};

const handleNotificationClick = async (notificationItem) => {
  if (!notificationItem.isRead && !notificationItem.is_read) {
    await handleMarkAsRead(notificationItem.id);
  }

  // Navigate based on notification type
  const notificationType = notificationItem.type;

  if (!notificationType) {
    antNotification.warning({
      message: "Notification type not found.",
    });
    popoverVisible.value = false;
    return;
  }

  // Navigation mapping based on notification type
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

  popoverVisible.value = false;
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

const viewAllNotifications = () => {
  popoverVisible.value = false;
  router.push({ name: "NotificationList" });
};
</script>

<style scoped>
.notification-badge {
  cursor: pointer;
}

.notification-panel {
  width: 350px;
  max-height: 450px;
  display: flex;
  flex-direction: column;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.notification-header h3 {
  margin-bottom: 0;
  font-size: 16px;
}

.notification-list {
  flex-grow: 1;
  overflow-y: auto;
  max-height: 350px;
  /* Giới hạn chiều cao của danh sách */
}

.notification-list .ant-list-item {
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.notification-list .ant-list-item:hover {
  background-color: #f0f2f5;
}

.notification-list .ant-list-item.notification-unread {
  background-color: #e6f7ff;
  /* Màu nền cho thông báo chưa đọc */
}

.notification-list .ant-list-item.notification-unread:hover {
  background-color: #d9f0ff;
}

.notification-message {
  font-weight: 500;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.notification-time {
  font-size: 12px;
  color: #888;
}

.notification-footer {
  padding: 8px 0;
  text-align: center;
  border-top: 1px solid #f0f0f0;
}

/* Tùy chỉnh thanh cuộn cho đẹp hơn */
.notification-list::-webkit-scrollbar {
  width: 6px;
}

.notification-list::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.notification-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.notification-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
