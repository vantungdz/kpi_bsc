<template>
    <a-popover v-model:open="popoverVisible" trigger="click" placement="bottomRight"
        overlayClassName="notification-popover" :get-popup-container="(trigger) => trigger.parentElement">
        <template #content>
            <div class="notification-panel">
                <div class="notification-header">
                    <h3>Thông báo</h3>
                    <a-button v-if="unreadCount > 0" type="link" size="small" @click="handleMarkAllAsRead"
                        :loading="isProcessingMarkAll">
                        Đánh dấu tất cả đã đọc
                    </a-button>
                </div>
                <a-spin :spinning="isLoadingNotifications" tip="Đang tải...">
                    <a-list v-if="notifications.length > 0" item-layout="horizontal" :data-source="notifications"
                        class="notification-list">
                        <template #renderItem="{ item }">
                            {{ console.log('item', item) }}
                            <a-list-item :class="{ 'notification-unread': !item.is_read }"
                                @click="handleNotificationClick(item)">
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
                                        <a-avatar :style="{
                                            backgroundColor: getNotificationIconColor(item.type),
                                        }">
                                            <template #icon>
                                                <bell-outlined v-if="!item.type" />
                                                <profile-outlined v-if="item.type === 'NEW_KPI_ASSIGNMENT'" />
                                                <check-circle-outlined v-if="item.type === 'KPI_APPROVAL_PENDING'" />
                                            </template>
                                        </a-avatar>
                                    </template>
                                </a-list-item-meta>
                                <template #actions>
                                    <a-tooltip title="Đánh dấu đã đọc" v-if="!item.is_read">
                                        <a-button type="text" shape="circle" size="small"
                                            @click.stop="handleMarkAsRead(item.id)"
                                            :loading="isProcessingMarkOne && currentMarkingId === item.id">
                                            <eye-outlined />
                                        </a-button>
                                    </a-tooltip>
                                </template>
                            </a-list-item>
                        </template>
                    </a-list>
                    <a-empty v-if="!isLoadingNotifications && notifications.length === 0"
                        description="Không có thông báo nào." style="padding: 20px 0" />
                </a-spin>
                <div class="notification-footer" v-if="notifications.length > 0">
                    <a-button type="link" block @click="viewAllNotifications">
                        Xem tất cả thông báo
                    </a-button>
                </div>
            </div>
        </template>
        <a-badge :count="unreadCount" :overflow-count="99" class="notification-badge">
            <bell-outlined style="font-size: 20px; cursor: pointer" />
        </a-badge>
    </a-popover>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
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
} from "@ant-design/icons-vue";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi"; 

dayjs.extend(relativeTime);
dayjs.locale("vi"); 

const store = useStore();
const router = useRouter();

const popoverVisible = ref(false);
const isProcessingMarkAll = ref(false);
const isProcessingMarkOne = ref(false);
const currentMarkingId = ref(null);


const notifications = computed(() => store.getters["notifications/allNotifications"]);
const unreadCount = computed(() => store.getters["notifications/unreadNotificationCount"]);
const isLoadingNotifications = computed(() => store.getters["notifications/isLoadingNotifications"]);



onMounted(() => {
    store.dispatch("notifications/fetchUnreadCount");
    
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
        case 'NEW_KPI_ASSIGNMENT':
            return '#1890ff'; 
        case 'KPI_APPROVAL_PENDING':
            return '#faad14'; 
        default:
            return '#bfbfbf'; 
    }
};

const handleNotificationClick = async (notificationItem) => {
    
    if (!notificationItem.is_read) {
        await handleMarkAsRead(notificationItem.id);
    }

  
  const { related_entity_type, related_entity_id, kpi_id } = notificationItem; 

  if (related_entity_id) {
    switch (related_entity_type) {
      case 'KPI_ASSIGNMENT': 
        
        
        router.push({ name: 'KpiDetail', params: { id: kpi_id || related_entity_id } }); 
        break;
      case 'KPI_VALUE': 
        
        
        
        
        if (kpi_id) { 
            router.push({ name: 'KpiDetail', params: { id: kpi_id } });
        } else {
            console.warn("Không có kpi_id để điều hướng cho KPI_VALUE notification:", notificationItem);
            
            
        }
        break;
      
      
      
      
      default:
        console.log("Loại thông báo không xác định hoặc không có quy tắc điều hướng:", notificationItem);
        
        break;
    }
  } else {
    console.warn("Thông báo không có related_entity_id để điều hướng:", notificationItem);
  }

    popoverVisible.value = false; 
};

const handleMarkAsRead = async (notificationId) => {
    if (!notificationId) return;
    isProcessingMarkOne.value = true;
    currentMarkingId.value = notificationId;
    try {
        await store.dispatch("notifications/markNotificationAsRead", notificationId);
    } catch (error) {
        console.error("Lỗi khi đánh dấu thông báo đã đọc:", error);
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
        console.error("Lỗi khi đánh dấu tất cả thông báo đã đọc:", error);
    } finally {
        isProcessingMarkAll.value = false;
    }
};

const viewAllNotifications = () => {
    popoverVisible.value = false;
    antNotification.info({ message: "Chức năng 'Xem tất cả' sẽ được phát triển sau." });
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
