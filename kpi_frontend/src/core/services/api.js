import axios from "axios";
import store from "../store";
import { notification } from "ant-design-vue";

function getFriendlyErrorMessage(technicalMessage) {
  const messageMap = {
    "toggle-status kpi": "You don't have permission to toggle KPI status",
    "create kpi": "You don't have permission to create new KPI",
    "update kpi": "You don't have permission to edit KPI",
    "delete kpi": "You don't have permission to delete KPI",
    "view kpi": "You don't have permission to view KPI",
    "assign kpi": "You don't have permission to assign KPI",
    "evaluate kpi": "You don't have permission to evaluate KPI",
    "approve kpi": "You don't have permission to approve KPI",
    "submit kpi": "You don't have permission to submit KPI",
    "review kpi": "You don't have permission to review KPI",
    "create employee": "You don't have permission to create new employee",
    "update employee": "You don't have permission to edit employee information",
    "delete employee": "You don't have permission to delete employee",
    "view employee": "You don't have permission to view employee information",
    "create department": "You don't have permission to create new department",
    "update department": "You don't have permission to edit department",
    "delete department": "You don't have permission to delete department",
    "view department":
      "You don't have permission to view department information",
    "create section": "You don't have permission to create new section",
    "update section": "You don't have permission to edit section",
    "delete section": "You don't have permission to delete section",
    "view section": "You don't have permission to view section information",
    "create report": "You don't have permission to create report",
    "export report": "You don't have permission to export report",
    "view report": "You don't have permission to view report",
    "create formula": "You don't have permission to create new formula",
    "update formula": "You don't have permission to edit formula",
    "delete formula": "You don't have permission to delete formula",
    "view formula": "You don't have permission to view formula",
    "create notification": "You don't have permission to create notification",
    "view notification": "You don't have permission to view notification",
    "update notification": "You don't have permission to edit notification",
    "delete notification": "You don't have permission to delete notification",
  };

  for (const [key, friendlyText] of Object.entries(messageMap)) {
    if (technicalMessage.toLowerCase().includes(key.toLowerCase())) {
      return friendlyText;
    }
  }

  return "You don't have permission to perform this action. Please contact your administrator to request access.";
}
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
        // Check if it's a permission error or actual authentication error
        if (serverMessage && serverMessage.includes("No permission")) {
          // This is a permission error, not authentication error
          const friendlyMessage = getFriendlyErrorMessage(serverMessage);
          notification.error({
            message: "Access Denied",
            description: friendlyMessage,
            duration: 5,
          });
          console.error("Permission denied (401). Access denied.");
        } else {
          // This is a real authentication error (expired token, invalid credentials, session expired)
          let errorMessage = "Your session has expired. Please login again.";

          if (serverMessage) {
            if (
              serverMessage.includes("Session expired") ||
              serverMessage.includes("Session invalid")
            ) {
              errorMessage =
                "Your session has been terminated. Please login again.";
            } else if (serverMessage.includes("concurrent")) {
              errorMessage =
                "Your account is already logged in from another device. Please login again.";
            } else {
              errorMessage = serverMessage;
            }
          }

          notification.error({
            message: "Session Expired",
            description: errorMessage,
            duration: 5,
          });
          store.dispatch("auth/logout");
        }
      } else if (status === 403) {
        const friendlyMessage = getFriendlyErrorMessage(serverMessage);
        notification.error({
          message: "Access Denied",
          description: friendlyMessage,
          duration: 5,
        });
        console.error("Forbidden (403). Access denied.");
      } else {
        console.error(`API Error ${status}:`, error.response.data);
      }
    } else if (error.request) {
      console.error("Network Error:", error.request);
      notification.error({
        message: "Network Error",
        description:
          "Unable to connect to the server. Please check your network connection.",
        duration: 5,
      });
    } else {
      console.error("Request Setup Error:", error.message);
      notification.error({
        message: "Request Error",
        description: "An error occurred while setting up the request.",
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
