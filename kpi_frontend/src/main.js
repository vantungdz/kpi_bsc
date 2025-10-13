import Antd from "ant-design-vue";
import "ant-design-vue/dist/reset.css";
import { createApp } from "vue";
import VueApexCharts from "vue3-apexcharts";
import i18n from "@/core/i18n";
import App from "./App.vue";
import "@/core/assets/styles/main.css"; // Global styles
import router from "@/core/router"; // Vue Router
import store from "@/core/store";
import { watch } from "vue";
import FlagIcon from "vue-flag-icon";
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
} from "@/core/services/socket";
import { setupGlobalErrorHandler } from "@/core/utils/errorHandler";
import "@/core/utils/axios-interceptor";
import "@fortawesome/fontawesome-free/css/all.min.css"; // Import Font Awesome

// Patch ResizeObserver loop error (completely hide this warning)
const resizeObserverErrMsg =
  "ResizeObserver loop completed with undelivered notifications";
const realConsoleError = window.console.error;
window.console.error = function (msg, ...args) {
  if (typeof msg === "string" && msg.includes(resizeObserverErrMsg)) {
    return;
  }
  realConsoleError.apply(window.console, [msg, ...args]);
};

let notificationSocket = null;

function setupNotificationSocket(store) {
  // Get userId from store
  const user = store.getters["auth/user"];
  if (!user || !user.id) return;
  if (notificationSocket) return; // Already connected

  notificationSocket = connectNotificationSocket(user.id);

  notificationSocket.on("connect", () => {});

  notificationSocket.on("notification", (data) => {
    // Send to store for realtime processing
    store.dispatch("notifications/handleRealtimeNotification", data);
  });

  notificationSocket.on("disconnect", () => {});
}

function teardownNotificationSocket() {
  disconnectNotificationSocket();
  notificationSocket = null;
}

const app = createApp(App);
app.component("ApexChart", VueApexCharts);
app.use(FlagIcon);
app.use(router);
app.use(store);
app.use(Antd);
app.use(i18n);

// Setup global error handler
setupGlobalErrorHandler(app);

watch(
  () => i18n.global.locale,
  (newLocale) => {
    console.log("Locale changed globally to:", newLocale);
    app._container.__vue_app__.config.globalProperties.$forceUpdate();
  }
);

// Auto connect when user logs in, disconnect when logout
const storeInstance =
  app.config.globalProperties.$store ||
  app._context.provides.store ||
  app.store;
if (storeInstance) {
  storeInstance.watch(
    (state, getters) => getters["auth/isAuthenticated"],
    (isAuthenticated) => {
      if (isAuthenticated) {
        setupNotificationSocket(storeInstance);
      } else {
        teardownNotificationSocket();
      }
    },
    { immediate: true }
  );
}

app.mount("#app");

export default i18n;
