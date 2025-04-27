import { createRouter, createWebHistory } from "vue-router";

// Views
import PerformanceObjectives from "../views/PerformanceObjectives.vue";
import KpiListCompany from "../views/KpiListCompany.vue";
import KpiListDepartment from "../views/KpiListDepartment.vue";
import KpiListSection from "../views/KpiListSection.vue";
// import KpiListIndividual from "../views/KpiListIndividual.vue";
import KpiCreateCompany from "../views/KpiCreateCompany.vue";
import KpiDetail from "../views/KpiDetail.vue";
import PersonalCreate from "../views/PersonalCreate.vue";
import KpiPersonal from "../views/KpiPersonal.vue";
import KpiCreateDepartment from "../views/KpiCreateDepartment.vue";
import LoginPage from "../views/LoginPage.vue";
import ForgotPasswordPage from "../views/ForgotPasswordPage.vue";

const routes = [
  {
    path: "/",
    name: "LoginPage",
    component: LoginPage,
  },
  {
    path: "/forgot-password",
    name: "ForgotPasswordPage",
    component: ForgotPasswordPage,
  },
  {
    path: "/performance",
    name: "PerformanceObjectives",
    component: PerformanceObjectives,
  },
  {
    path: "/kpis",
    name: "Kpis",
    children: [
      {
        path: "company",
        name: "KpiListCompany",
        component: KpiListCompany,
      },
      {
        path: "department",
        name: "KpiListDepartment",
        component: KpiListDepartment,
      },
      {
        path: "department-create/:departmentId",
        name: "KpiCreateDepartment",
        component: KpiCreateDepartment,
        props: true,
      },
      {
        path: "section",
        name: "KpiListSection",
        component: KpiListSection,
      },
      // {
      //   path: "individual",
      //   name: "KpiListIndividual",
      //   component: KpiListIndividual,
      // },
      {
        path: "create",
        name: "KpiCreateCompany",
        component: KpiCreateCompany,
        props: (route) => ({ scope: route.query.scope }),
      },
      {
        path: ":id",
        name: "KpiDetail",
        component: KpiDetail,
        props: true,
      },
    ],
  },

  {
    path: "/personal/create",
    name: "KpiPersonalCreate",
    component: PersonalCreate,
  },
  {
    path: "/personal",
    name: "KpiPersonal",
    component: KpiPersonal,
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
