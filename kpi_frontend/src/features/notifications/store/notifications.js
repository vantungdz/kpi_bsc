import apiClient from "@/core/services/api"; 
import { notification as antNotification } from "ant-design-vue";

const state = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  isLoadingCount: false,
  errorCount: null,
};

const getters = {
  allNotifications: (state) => state.notifications,
  unreadNotificationCount: (state) => state.unreadCount,
  isLoadingNotifications: (state) => state.isLoading,
  notificationError: (state) => state.error,
  isLoadingUnreadCount: (state) => state.isLoadingCount,
};

const mutations = {
  SET_NOTIFICATIONS(state, notifications) {
    state.notifications = notifications || [];
  },
  ADD_NOTIFICATION(state, newNotification) {
    state.notifications.unshift(newNotification);
    state.unreadCount++;
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
      ? error.response?.data?.message || error.message || "Lỗi tải thông báo."
      : null;
  },
  SET_LOADING_COUNT(state, isLoading) {
    state.isLoadingCount = isLoading;
  },
  SET_ERROR_COUNT(state, error) {
    state.errorCount = error
      ? error.response?.data?.message ||
        error.message ||
        "Lỗi tải số lượng thông báo."
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
      if (Object.prototype.hasOwnProperty.call(response.data, 'unreadCount')) {
        commit("SET_UNREAD_COUNT", response.data.unreadCount || 0);
      }
      return fetchedNotifications;
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
      await apiClient.post(`/notifications/${notificationId}/mark-as-read`); 
      await new Promise((resolve) => setTimeout(resolve, 200));
      
    } catch (error) {
      if (wasUnread) {
        const failedNotification = state.notifications.find(
          (n) => n.id === notificationId
        );
        if (failedNotification) failedNotification.is_read = false;
        commit("SET_UNREAD_COUNT", state.unreadCount + 1);
      }
      antNotification.error({
        message: "Lỗi",
        description: "Không thể đánh dấu thông báo đã đọc.",
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
        message: "Lỗi",
        description: "Không thể đánh dấu tất cả thông báo đã đọc.",
      });
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  },

  handleRealtimeNotification({ commit, dispatch }, notificationData) {
    console.log("Adding notification to store:", notificationData);
    commit("ADD_NOTIFICATION", notificationData);
    console.log("Updated unread count:", state.unreadCount);

    antNotification.info({
      message: "Thông báo mới!",
      description: notificationData.message,
      duration: 5,
      onClick: () => {
        
        
        if (notificationData.id) {
          dispatch("markNotificationAsRead", notificationData.id);
        }
      },
    });
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
