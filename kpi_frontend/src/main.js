import Antd from "ant-design-vue";
import "ant-design-vue/dist/reset.css";
import { createApp } from "vue";
import VueApexCharts from "vue3-apexcharts";
import App from "./App.vue";
import "@/core/assets/styles/main.css"; // Global styles
import router from "@/core/router"; // Vue Router
import store from "@/core/store";

createApp(App)
  .component("apexchart", VueApexCharts)
  .use(router)
  .use(store)
  .use(Antd)
  .mount("#app");
