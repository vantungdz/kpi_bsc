import apiClient from "@/core/services/api";
import { notification as antNotification } from "ant-design-vue";

// Helper function to normalize notification data from backend
const normalizeNotification = (notification) => {
  return {
    ...notification,
    is_read: notification.is_read ?? notification.isRead ?? false,
    created_at: notification.created_at ?? notification.createdAt,
    updated_at: notification.updated_at ?? notification.updatedAt,
    related_entity_id:
      notification.related_entity_id ?? notification.relatedEntityId,
    related_entity_type:
      notification.related_entity_type ?? notification.relatedEntityType,
    kpi_id: notification.kpi_id ?? notification.kpiId,
    user_id: notification.user_id ?? notification.userId,
  };
};

const state = {
  notifications: [],
  totalNotifications: 0,
  unreadCount: 0,
  isLoading: false,
  error: null,
  isLoadingCount: false,
  errorCount: null,
};

const getters = {
  allNotifications: (state) => state.notifications,
  totalNotifications: (state) => state.totalNotifications,
  unreadNotificationCount: (state) => state.unreadCount,
  isLoadingNotifications: (state) => state.isLoading,
  notificationError: (state) => state.error,
  isLoadingUnreadCount: (state) => state.isLoadingCount,
};

const mutations = {
  SET_NOTIFICATIONS(state, notifications) {
    state.notifications = (notifications || []).map(normalizeNotification);
  },
  SET_TOTAL_NOTIFICATIONS(state, total) {
    state.totalNotifications = total || 0;
  },
  ADD_NOTIFICATION(state, newNotification) {
    const normalizedNotification = normalizeNotification(newNotification);

    // Check for duplicates before adding
    const isDuplicate = state.notifications.some(
      (existing) =>
        existing.id === normalizedNotification.id ||
        (existing.type === normalizedNotification.type &&
          existing.message === normalizedNotification.message &&
          existing.user_id === normalizedNotification.user_id &&
          existing.kpi_id === normalizedNotification.kpi_id &&
          Math.abs(
            new Date(existing.created_at).getTime() -
              new Date(normalizedNotification.created_at).getTime()
          ) < 5000) // Within 5 seconds
    );

    if (!isDuplicate) {
      state.notifications.unshift(normalizedNotification);
      if (!normalizedNotification.is_read) {
        state.unreadCount++;
      }
    }
  },
  SET_UNREAD_COUNT(state, count) {
    state.unreadCount = count || 0;
  },
  MARK_AS_READ(state, notificationId) {
    const notification = state.notifications.find(
      (n) => n.id === notificationId
    );
    if (notification && !notification.is_read) {
      notification.is_read = true;
      if (state.unreadCount > 0) {
        state.unreadCount--;
      }
    }
  },
  MARK_ALL_AS_READ(state) {
    state.notifications.forEach((n) => {
      if (!n.is_read) {
        n.is_read = true;
      }
    });
    state.unreadCount = 0;
  },
  SET_LOADING(state, isLoading) {
    state.isLoading = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error
      ? error.response?.data?.message ||
        error.message ||
        "Error loading notifications."
      : null;
  },
  SET_LOADING_COUNT(state, isLoading) {
    state.isLoadingCount = isLoading;
  },
  SET_ERROR_COUNT(state, error) {
    state.errorCount = error
      ? error.response?.data?.message ||
        error.message ||
        "Error loading notification count."
      : null;
  },
  DECREMENT_UNREAD_COUNT(state) {
    if (state.unreadCount > 0) {
      state.unreadCount--;
    }
  },
};

const actions = {
  async fetchNotifications({ commit }, params = { page: 1, limit: 10 }) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/notifications", { params });
      const fetchedNotifications = response.data.data || [];
      commit("SET_NOTIFICATIONS", fetchedNotifications);
      if (Object.prototype.hasOwnProperty.call(response.data, "unreadCount")) {
        commit("SET_UNREAD_COUNT", response.data.unreadCount || 0);
      }
      if (Object.prototype.hasOwnProperty.call(response.data, "total")) {
        commit("SET_TOTAL_NOTIFICATIONS", response.data.total || 0);
      }
      return fetchedNotifications.map(normalizeNotification);
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_NOTIFICATIONS", []);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async fetchUnreadCount({ commit }) {
    commit("SET_LOADING_COUNT", true);
    commit("SET_ERROR_COUNT", null);
    try {
      const response = await apiClient.get("/notifications/unread-count");
      const unreadCount = response.data.count || response.data.unreadCount || 0;
      commit("SET_UNREAD_COUNT", unreadCount);
      return unreadCount;
    } catch (error) {
      commit("SET_ERROR_COUNT", error);
      commit("SET_UNREAD_COUNT", 0);
      throw error;
    } finally {
      commit("SET_LOADING_COUNT", false);
    }
  },

  async markNotificationAsRead({ commit, state }, notificationId) {
    const notification = state.notifications.find(
      (n) => n.id === notificationId
    );
    const wasUnread = notification && !notification.is_read;

    if (wasUnread) {
      commit("MARK_AS_READ", notificationId);
    }

    try {
      const response = await apiClient.post(
        `/notifications/${notificationId}/mark-as-read`
      );
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Update the notification with the response data if available
      if (response.data) {
        const updatedNotification = normalizeNotification(response.data);
        const index = state.notifications.findIndex(
          (n) => n.id === notificationId
        );
        if (index !== -1) {
          state.notifications[index] = updatedNotification;
        }
      }
    } catch (error) {
      if (wasUnread) {
        const failedNotification = state.notifications.find(
          (n) => n.id === notificationId
        );
        if (failedNotification) failedNotification.is_read = false;
        commit("SET_UNREAD_COUNT", state.unreadCount + 1);
      }
      antNotification.error({
        message: "Error",
        description: "Cannot mark notification as read.",
      });
      console.error("Error marking notification as read:", error);
      throw error;
    }
  },

  async markAllNotificationsAsRead({ commit, state }) {
    const unreadNotificationsExist = state.notifications.some(
      (n) => !n.is_read
    );
    if (!unreadNotificationsExist && state.unreadCount === 0) return;

    const oldNotifications = JSON.parse(JSON.stringify(state.notifications));
    const oldUnreadCount = state.unreadCount;
    commit("MARK_ALL_AS_READ");

    try {
      await apiClient.post("/notifications/mark-all-as-read");
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      commit("SET_NOTIFICATIONS", oldNotifications);
      commit("SET_UNREAD_COUNT", oldUnreadCount);
      antNotification.error({
        message: "Error",
        description: "Cannot mark all notifications as read.",
      });
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  },

  handleRealtimeNotification({ commit, dispatch, state }, notificationData) {
    const normalizedNotification = normalizeNotification(notificationData);

    // Check for duplicates before adding to store and showing popup
    const isDuplicate = state.notifications.some(
      (existing) =>
        existing.id === normalizedNotification.id ||
        (existing.type === normalizedNotification.type &&
          existing.message === normalizedNotification.message &&
          existing.user_id === normalizedNotification.user_id &&
          existing.kpi_id === normalizedNotification.kpi_id &&
          Math.abs(
            new Date(existing.created_at).getTime() -
              new Date(normalizedNotification.created_at).getTime()
          ) < 5000) // Within 5 seconds
    );

    if (!isDuplicate) {
      commit("ADD_NOTIFICATION", normalizedNotification);

      antNotification.info({
        message: "New notification!",
        description: normalizedNotification.message,
        duration: 5,
        onClick: () => {
          if (normalizedNotification.id) {
            dispatch("markNotificationAsRead", normalizedNotification.id);
          }
        },
      });
    }
  },

  async deleteNotification({ state }, notificationId) {
    try {
      await apiClient.delete(`/notifications/${notificationId}`);

      // Remove notification from state
      const notificationIndex = state.notifications.findIndex(
        (n) => n.id === notificationId
      );

      if (notificationIndex !== -1) {
        const notification = state.notifications[notificationIndex];

        // Remove from notifications array
        state.notifications.splice(notificationIndex, 1);

        // Update unread count if notification was unread
        if (!notification.is_read && state.unreadCount > 0) {
          state.unreadCount--;
        }

        // Update total count
        if (state.totalNotifications > 0) {
          state.totalNotifications--;
        }

        antNotification.success({
          message: "Success",
          description: "Notification deleted successfully",
        });
      }
    } catch (error) {
      antNotification.error({
        message: "Error",
        description: "Cannot delete notification.",
      });
      console.error("Error deleting notification:", error);
      throw error;
    }
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
