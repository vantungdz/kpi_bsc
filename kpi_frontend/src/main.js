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

const app = createApp(App);
app.component("ApexChart", VueApexCharts);
app.use(FlagIcon);
app.use(router);
app.use(store);
app.use(Antd);
app.use(i18n);

watch(
  () => i18n.global.locale,
  (newLocale) => {
    console.log("Locale changed globally to:", newLocale);
    app._container.__vue_app__.config.globalProperties.$forceUpdate();
  }
);

app.mount("#app");

export default i18n;
