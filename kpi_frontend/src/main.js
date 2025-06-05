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
import { connectNotificationSocket, disconnectNotificationSocket } from "@/core/services/socket";
import { setupGlobalErrorHandler } from "@/core/utils/errorHandler";
import '@/core/utils/axios-interceptor';

let notificationSocket = null;

function setupNotificationSocket(store) {
  // Lấy userId từ store
  const user = store.getters["auth/user"];
  if (!user || !user.id) return;
  if (notificationSocket) return; // Đã kết nối rồi

  notificationSocket = connectNotificationSocket(user.id);

  notificationSocket.on("connect", () => {
  });

  notificationSocket.on("notification", (data) => {
    // Gửi vào store để xử lý realtime
    store.dispatch("notifications/handleRealtimeNotification", data);
  });

  notificationSocket.on("disconnect", () => {
  });
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

// Thiết lập global error handler
setupGlobalErrorHandler(app);

watch(
  () => i18n.global.locale,
  (newLocale) => {
    console.log("Locale changed globally to:", newLocale);
    app._container.__vue_app__.config.globalProperties.$forceUpdate();
  }
);

// Tự động kết nối khi user đăng nhập, ngắt khi logout
const storeInstance = app.config.globalProperties.$store || app._context.provides.store || app.store;
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
