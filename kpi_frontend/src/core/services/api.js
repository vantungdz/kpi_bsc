import axios from "axios";
import store from "../store";
import { notification } from "ant-design-vue";
import {
  translateErrorMessage,
  getTranslatedErrorMessage,
} from "./messageTranslator";
import i18n from "@/core/i18n";
const apiClient = axios.create({
  baseURL: process.env.VUE_APP_API_URL || "/api",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = store.getters["auth/token"];
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("API Request Setup Error:", error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Response Error:", error.response || error.message);

    if (error.response) {
      const status = error.response.status;
      const serverMessage = error.response.data?.message;
      // Log entire response for debugging
      console.error("API Error Response:", error.response);

      if (status === 401) {
        // Check if it's a permission error
        if (serverMessage && serverMessage.includes("No permission")) {
          // Permission error - only show notification
          const translatedMessage = translateErrorMessage(serverMessage);
          notification.error({
            message: i18n.global.t("errors.accessDenied"),
            description: translatedMessage,
            duration: 5,
          });
          console.error("Permission denied (401). Access denied.");
        }
        // Check if it's a session expiry (should logout)
        else if (
          serverMessage &&
          (serverMessage.includes("Session expired") ||
            serverMessage.includes("Session invalid") ||
            serverMessage.includes("Token expired") ||
            serverMessage.includes("concurrent"))
        ) {
          const translatedMessage = translateErrorMessage(serverMessage);

          notification.error({
            message: i18n.global.t("errors.sessionExpired"),
            description: translatedMessage,
            duration: 5,
          });
          store.dispatch("auth/logout");
        }
        // Other authentication errors - just show notification
        else {
          const translatedMessage = getTranslatedErrorMessage(serverMessage);
          notification.error({
            message: i18n.global.t("errors.authenticationError"),
            description: translatedMessage,
            duration: 5,
          });
          console.error("Authentication failed (401).");
        }
      } else if (status === 403) {
        const translatedMessage = translateErrorMessage(serverMessage);
        notification.error({
          message: i18n.global.t("errors.accessDenied"),
          description: translatedMessage,
          duration: 5,
        });
        console.error("Forbidden (403). Access denied.");
      } else {
        console.error(`API Error ${status}:`, error.response.data);
      }
    } else if (error.request) {
      console.error("Network Error:", error.request);
      notification.error({
        message: i18n.global.t("errors.networkError"),
        description: i18n.global.t("errors.networkError"),
        duration: 5,
      });
    } else {
      console.error("Request Setup Error:", error.message);
      notification.error({
        message: i18n.global.t("errors.unknownError"),
        description: i18n.global.t("errors.unknownError"),
        duration: 5,
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
